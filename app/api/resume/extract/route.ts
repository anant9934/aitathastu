/**
 * POST /api/resume/extract
 *
 * Accepts a resume upload and queues it. This route only validates the file,
 * stores it, and creates a `queued` job; it never parses or OCRs inline (see
 * lib/services/resume-ingestion-service.ts for why). Responds 202 with
 * { jobId, documentId }. The client then polls GET /api/resume/[id]/status.
 */

import crypto from "crypto";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { validateDocumentSafety } from "@/lib/resume/document-safety";
import { queueResumeUpload } from "@/lib/services/resume-ingestion-service";
import { RESUME_MAX_UPLOAD_BYTES, RESUME_MAX_UPLOAD_MB } from "@/lib/config/upload-limits";
import { jsonNoStore } from "@/lib/api/resume-route-helpers";
import { contentIdempotencyKey, requestIdempotencyKey, withIdempotency } from "@/lib/sync/idempotency";

export const runtime = "nodejs";
export const maxDuration = 30;

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const fail = (code: string, message: string, status: number, headers?: Record<string, string>) =>
    jsonNoStore({ ok: false, code, message, error: message, retryable: status >= 500 || status === 429, requestId }, status, headers);

  try {
    if (!coreIngestionReady()) {
      return fail("INGESTION_SECURITY_INCOMPLETE", "Resume import is unavailable because production ingestion security setup is incomplete.", 503);
    }

    // Requires an existing (possibly guest) session. Guests are created only by
    // the onboarding draft write, never here.
    const auth = await getServerAuthContext();
    if (!auth) return fail("UNAUTHORIZED", "Your session has expired. Refresh the page and try again.", 401);
    const personId = auth.person.id;

    const rl = await checkRateLimitDistributed(personId, "resume");
    if (!rl.allowed) {
      return fail("RATE_LIMITED", "Too many resume uploads. Please wait a minute before uploading again.", 429, {
        "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
      });
    }

    let file: File;
    try {
      const form = await request.formData();
      if (form.get("aiConsent") !== "true" && form.get("consent") !== "true") {
        return fail("CONSENT_REQUIRED", "Confirm that your resume may be processed.", 400);
      }
      const candidate = form.get("resume");
      if (!(candidate instanceof File)) return fail("MISSING_FILE", "Choose a PDF or DOCX file first.", 400);
      file = candidate;
    } catch {
      return fail("FORM_RECEIVE_FAILED", "The file could not be received. Please try again.", 400);
    }

    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "pdf" && extension !== "docx") return fail("UNSUPPORTED_MEDIA_TYPE", "Use a PDF or DOCX file.", 415);
    if (file.size === 0) return fail("EMPTY_FILE", "This file is empty. Please choose another.", 400);
    if (file.size > RESUME_MAX_UPLOAD_BYTES) {
      return fail("FILE_TOO_LARGE", `Choose a file under ${RESUME_MAX_UPLOAD_MB} MB, or enter details manually.`, 413);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const isPdf = bytes.subarray(0, 5).toString() === "%PDF-";
    const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes.includes(Buffer.from("[Content_Types].xml"));
    if ((extension === "pdf" && !isPdf) || (extension === "docx" && !isDocx)) {
      return fail("INVALID_FILE_CONTENT", "The file content does not match its extension. Please choose another file.", 415);
    }
    const safety = validateDocumentSafety(bytes, extension);
    if (safety.isEncrypted) return fail("ENCRYPTED_DOCUMENT", "Remove the document password, then upload the unencrypted file.", 422);
    if (!safety.isValid) {
      return fail("INVALID_DOCUMENT", "This document is damaged or uses an unsupported structure. Export it again as PDF or DOCX.", 422);
    }

    let queued;
    try {
      // The same file (or the same client Idempotency-Key) within 10 minutes
      // returns the first upload's document and job instead of a duplicate.
      const clientKey = request.headers.get("idempotency-key")?.trim().slice(0, 120);
      const key = clientKey ? requestIdempotencyKey(personId, "resume_upload", clientKey) : contentIdempotencyKey(personId, "resume_upload", bytes);
      const { response, replayed } = await withIdempotency({ key, personId, scope: "resume_upload" }, async () => {
        const q = await queueResumeUpload({ personId, filename: file.name, mimeType: MIME_BY_EXTENSION[extension], bytes });
        return { jobId: q.jobId, documentId: q.documentId };
      });
      queued = response;
      if (replayed) console.info(JSON.stringify({ event: "resume.upload.deduplicated", requestId, documentId: response.documentId }));
    } catch (err) {
      console.error("[resume-extract] storing upload failed", { requestId, error: err instanceof Error ? err.message : err });
      return fail("STORAGE_FAILED", "We could not store your file. Please try again.", 503);
    }

    return jsonNoStore(
      { ok: true, status: "queued", jobId: queued.jobId, documentId: queued.documentId, filename: file.name, requestId },
      202
    );
  } catch (err) {
    console.error("[resume-extract] unexpected failure", { requestId, error: err instanceof Error ? err.message : err });
    return fail("UNKNOWN_PROCESSING_FAILURE", "We could not accept this document. Please retry.", 500);
  }
}
