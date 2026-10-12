/**
 * GET /api/resume/[id]/status   ([id] = documentId; optional ?jobId=)
 *
 * Advances the document's current processing job by one step (see
 * resume-ingestion-service) and returns the job's real stored state:
 *   queued | processing | review_ready | completed | failed | timed_out | cancelled
 * When review_ready/completed, the review payload (candidates, structured data)
 * is included, which also lets a refreshed page rehydrate the review.
 *
 * Requires an existing session. It never creates a guest.
 */

import { getServerAuthContext } from "@/lib/auth/server-session";
import { advanceResumeJob, failureInfo } from "@/lib/services/resume-ingestion-service";
import { docMeta, jsonNoStore, loadOwnedResumeDocument, unauthorized } from "@/lib/api/resume-route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const personId = auth.person.id;

  try {
    const doc = await loadOwnedResumeDocument(documentId, personId);
    if (!doc) return jsonNoStore({ ok: false, code: "NOT_FOUND", error: "Document not found." }, 404);

    const requestedJobId = new URL(request.url).searchParams.get("jobId");
    const jobId = requestedJobId || (docMeta(doc).jobId as string | undefined);
    if (!jobId) return jsonNoStore({ ok: false, code: "NO_JOB", error: "This document has no processing job." }, 404);

    const job = await advanceResumeJob(jobId, personId);
    if (!job || job.sourceId !== "resume" || (job.metadata as Record<string, unknown>)?.documentId !== documentId) {
      return jsonNoStore({ ok: false, code: "NOT_FOUND", error: "Processing job not found." }, 404);
    }

    const ready = job.status === "review_ready" || job.status === "completed";
    // Re-read after advancing: a step may have just written the review payload.
    const fresh = ready ? await loadOwnedResumeDocument(documentId, personId) : doc;
    const failure = failureInfo(job.errorCode);

    return jsonNoStore({
      ok: true,
      documentId,
      jobId: job.id,
      filename: doc.filename,
      status: job.status,
      stage: job.stage,
      errorCode: job.errorCode,
      message: job.errorMessage,
      retryable: failure ? failure.retryable : Boolean((job.metadata as Record<string, unknown>)?.retryable),
      result: ready && fresh ? docMeta(fresh).review ?? null : null,
    });
  } catch (err) {
    console.error("[resume-status] lookup failed", { documentId, error: err instanceof Error ? err.message : err });
    return jsonNoStore({ ok: false, code: "STATUS_FAILED", error: "Failed to fetch document status." }, 500);
  }
}
