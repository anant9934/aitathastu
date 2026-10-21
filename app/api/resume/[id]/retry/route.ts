/**
 * POST /api/resume/[id]/retry
 *
 * Re-queues processing for an already-stored document, so a retry never needs
 * the file to be picked again. Only allowed when the latest job did not succeed.
 */

import { after } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { requeueResumeDocument, processResumeJob } from "@/lib/services/resume-ingestion-service";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { docMeta, jsonNoStore, loadOwnedResumeDocument, unauthorized } from "@/lib/api/resume-route-helpers";

export const runtime = "nodejs";

/** Same job as an upload, so the same limit; AI stages fit inside it. */
export const maxDuration = 30;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const deadlineAt = Date.now() + maxDuration * 1000;
  const { id: documentId } = await params;
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const personId = auth.person.id;

  const rl = await checkRateLimitDistributed(personId, "resume");
  if (!rl.allowed) return jsonNoStore({ ok: false, code: "RATE_LIMITED", error: "Please wait a minute before retrying." }, 429);

  const doc = await loadOwnedResumeDocument(documentId, personId);
  if (!doc) return jsonNoStore({ ok: false, code: "NOT_FOUND", error: "Document not found." }, 404);

  const currentJobId = docMeta(doc).jobId as string | undefined;
  const current = currentJobId ? await SourceProcessingJobService.getJobForPerson(currentJobId, personId) : null;
  if (current && ["queued", "processing", "review_ready", "completed"].includes(current.status)) {
    return jsonNoStore({ ok: false, code: "NOT_RETRYABLE", error: `This document is already ${current.status}.`, jobId: current.id }, 409);
  }

  let explicitAiConsent: boolean | undefined = undefined;
  try {
    const text = await _request.text();
    if (text) {
      const parsed = JSON.parse(text);
      if (typeof parsed.aiConsent === "boolean") explicitAiConsent = parsed.aiConsent;
    }
  } catch {}

  const jobId = await requeueResumeDocument(personId, documentId, explicitAiConsent);
  if (!jobId) return jsonNoStore({ ok: false, code: "NOT_FOUND", error: "Document not found." }, 404);

  after(async () => {
    try {
      await processResumeJob(jobId, personId, { deadlineAt });
    } catch (err) {
      console.error("[resume-retry] background processResumeJob error", { jobId, error: err instanceof Error ? err.message : err });
    }
  });

  return jsonNoStore({ ok: true, status: "queued", jobId, documentId }, 202);
}
