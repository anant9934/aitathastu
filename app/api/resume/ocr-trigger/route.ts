/**
 * AI TATHASTU — OCR TRIGGER API
 *
 * POST /api/resume/ocr-trigger
 *
 * Step 4 of the OCR job lifecycle:
 * 1. Authenticated upload → /api/resume/upload (stores document in Neon)
 * 2. Create job → /api/resume/extract (creates job record, returns jobId)
 * 3. Trigger background OCR → /api/resume/ocr-trigger (this endpoint)
 *    - Returns 202 immediately
 *    - Invokes Netlify Background Function with ONLY the job reference (not the PDF)
 * 4. Browser polls → /api/resume/{id}/status
 *
 * On Vercel: the extract route runs synchronously within the 60-second budget.
 * On Netlify: this route delegates to the background function for heavy OCR.
 *
 * SECURITY:
 * - Validates authenticated session
 * - Only passes jobId, personId, documentId to background — never the PDF bytes
 * - Background function validates its own secret before processing
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    // Auth check
    const authRes = await getOrCreateOnboardingAuthContext().catch(() => null);
    if (!authRes || !authRes.auth) {
      return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401 });
    }
    const personId = authRes.auth.person.id;

    const body = await request.json().catch(() => ({})) as {
      jobId?: string;
      documentId?: string;
    };

    const { jobId, documentId } = body;
    if (!jobId || !documentId) {
      return NextResponse.json(
        { ok: false, error: "Missing jobId or documentId", requestId },
        { status: 400 }
      );
    }

    // Verify job ownership before triggering
    const job = await SourceProcessingJobService.getJobForPerson(jobId, personId).catch(() => null);
    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Job not found or access denied", requestId },
        { status: 404 }
      );
    }

    // Determine target function URL
    const isNetlify = Boolean(process.env.NETLIFY || process.env.NETLIFY_CONTEXT);
    const appBaseUrl = process.env.APP_BASE_URL ||
      process.env.URL ||
      process.env.DEPLOY_URL ||
      "http://localhost:3000";

    const internalSecret = process.env.OCR_INTERNAL_SECRET?.trim();

    if (!internalSecret) {
      // No background function configured — fall back to inline processing signal
      return NextResponse.json({
        ok: true,
        status: "QUEUED",
        jobId,
        documentId,
        message: "OCR_INTERNAL_SECRET not configured. Job queued for inline processing.",
        requestId,
        mode: "inline",
      }, { status: 202 });
    }

    // Invoke Netlify Background Function
    const backgroundUrl = `${appBaseUrl.replace(/\/$/, "")}/.netlify/functions/ocr-background`;

    // Fire-and-forget: do not await the background function response
    // We only pass the job reference — NOT the PDF bytes
    fetch(backgroundUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${internalSecret}`,
      },
      body: JSON.stringify({ jobId, personId, documentId }),
      signal: AbortSignal.timeout(5000),
    }).catch((triggerErr) => {
      // Log the trigger failure but do not fail the HTTP response
      // The student will see the job remain in QUEUED state and can retry
      console.warn("[OCR-Trigger] Background function invocation failed:", {
        jobId,
        errorType: triggerErr instanceof Error ? triggerErr.name : typeof triggerErr,
        isNetlify,
      });
    });

    // Update job stage to reflect background function was triggered (acquire = job claimed for processing)
    await SourceProcessingJobService.updateStage(jobId, personId, "acquire").catch(() => null);


    const response = NextResponse.json({
      ok: true,
      status: "QUEUED",
      jobId,
      documentId,
      message: "OCR processing accepted. Poll /api/resume/{id}/status for updates.",
      requestId,
      mode: isNetlify ? "netlify_background" : "vercel_async",
    }, { status: 202 });

    if (authRes.sessionCookieToSet) {
      response.cookies.set(
        authRes.sessionCookieToSet.name,
        authRes.sessionCookieToSet.value,
        authRes.sessionCookieToSet.options as Parameters<typeof response.cookies.set>[2]
      );
    }

    return response;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Unexpected error triggering OCR processing.", requestId },
      { status: 500 }
    );
  }
}
