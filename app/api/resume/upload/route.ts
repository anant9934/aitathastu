import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { ObjectStorageService } from "@/lib/storage/object-storage";
import { ExtractorServiceClient } from "@/lib/services/extractor-service-client";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024; // 12MB

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const authRes = await getOrCreateOnboardingAuthContext().catch(() => null);
    if (!authRes || !authRes.auth) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized session. Please refresh and try again.", requestId },
        { status: 401 }
      );
    }
    const personId = authRes.auth.person.id;

    // Rate limiting
    const rl = await checkRateLimitDistributed(personId, "resume");
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many upload requests. Please wait a minute.", requestId },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
      );
    }

    const form = await request.formData();
    const candidate = form.get("file") || form.get("resume");
    if (!(candidate instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Choose a resume file (PDF, DOCX, TXT, RTF, or image).", requestId },
        { status: 400 }
      );
    }

    const file = candidate;
    if (file.size === 0) {
      return NextResponse.json({ ok: false, error: "The chosen file is empty.", requestId }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "File exceeds 12 MB limit. Use direct upload or a smaller file.", requestId },
        { status: 413 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["pdf", "docx", "txt", "rtf", "jpg", "jpeg", "png"];
    if (!ext || !allowed.includes(ext)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported format. Use PDF, DOCX, TXT, RTF, JPG, or PNG.", requestId },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const documentId = crypto.randomUUID();

    // 1. Store durably in Neon PostgreSQL object storage
    await ObjectStorageService.storeDocument({
      documentId,
      personId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    // 2. Upload to Extractor Backend
    let backendDocId: string = documentId;
    try {
      const backendRes = await ExtractorServiceClient.uploadResume({
        fileBuffer: buffer,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        personId,
      });
      backendDocId = backendRes.document_id;
    } catch (backendErr) {
      console.warn("Backend extractor sync note:", backendErr);
    }

    const response = NextResponse.json({
      ok: true,
      documentId: backendDocId,
      filename: file.name,
      status: "uploaded",
      requestId,
    });

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
      { ok: false, error: "An unexpected error occurred during upload. Please retry.", requestId },
      { status: 500 }
    );
  }
}
