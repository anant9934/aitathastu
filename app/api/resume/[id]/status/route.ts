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

import { after } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getResumeJobStatus, processResumeJob } from "@/lib/services/resume-ingestion-service";
import { jsonNoStore, unauthorized } from "@/lib/api/resume-route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const personId = auth.person.id;

  try {
    const requestedJobId = new URL(request.url).searchParams.get("jobId");
    const statusRes = await getResumeJobStatus(documentId, personId, requestedJobId);
    if (!statusRes.ok) {
      return jsonNoStore(
        { ok: false, code: statusRes.code, error: statusRes.error },
        statusRes.httpStatus
      );
    }

    if (statusRes.shouldNudge && statusRes.jobId) {
      const jobId = statusRes.jobId;
      after(async () => {
        try {
          await processResumeJob(jobId, personId);
        } catch (err) {
          console.error("[resume-status] background nudge error", { jobId, error: err });
        }
      });
    }

    return jsonNoStore({
      ok: true,
      documentId: statusRes.documentId,
      jobId: statusRes.jobId,
      filename: statusRes.filename,
      status: statusRes.status,
      stage: statusRes.stage,
      errorCode: statusRes.errorCode,
      message: statusRes.message,
      retryable: statusRes.retryable,
      result: statusRes.result,
    });
  } catch (err) {
    console.error("[resume-status] lookup failed", { documentId, error: err instanceof Error ? err.message : err });
    return jsonNoStore({ ok: false, code: "STATUS_FAILED", error: "Failed to fetch document status." }, 500);
  }
}
