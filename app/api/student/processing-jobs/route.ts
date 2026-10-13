/**
 * AI TATHASTU — STUDENT PROCESSING JOBS API V4.2
 *
 * GET /api/student/processing-jobs — List or get processing jobs for student
 * POST /api/student/processing-jobs — Start a tracked processing job
 * PATCH /api/student/processing-jobs — Transition a job to terminal state (timed_out, failed, cancelled)
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";

export const runtime = "nodejs";

function jsonResponse(body: Record<string, unknown>, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    // A read-only poll must not mint a new guest cookie. It can otherwise race
    // the academic save and make the browser switch owners mid-onboarding.
    const auth = await getServerAuthContext();
    if (!auth) return jsonResponse({ ok: true, jobs: [], requestId });

    const jobId = new URL(request.url).searchParams.get("jobId");
    const jobs = jobId
      ? [await SourceProcessingJobService.getJobForPerson(jobId, auth.person.id)].filter(Boolean)
      : await SourceProcessingJobService.getJobsForPerson(auth.person.id, 30);

    return jsonResponse({ ok: true, jobs, requestId });
  } catch {
    return jsonResponse({
      ok: false,
      code: "JOB_LOOKUP_FAILED",
      message: "Failed to look up processing activity.",
      retryable: true,
      requestId,
    }, 500);
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return jsonResponse({
        ok: false,
        code: "UNAUTHORIZED",
        message: "Sign in before importing.",
        retryable: true,
        requestId,
      }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
    const allowed = new Set([
      "resume", "github", "portfolio", "linkedin", "leetcode", "huggingface",
      "orcid", "hackerrank", "codechef", "hackerearth", "kaggle", "devto",
      "stackoverflow", "google_scholar",
    ]);

    if (!allowed.has(sourceId)) {
      return jsonResponse({
        ok: false,
        code: "UNSUPPORTED_SOURCE",
        message: "Unsupported import source.",
        retryable: false,
        requestId,
      }, 400);
    }

    if ((sourceId === "resume" || sourceId === "github") && !coreIngestionReady()) {
      return jsonResponse({
        ok: false,
        code: "INGESTION_SECURITY_INCOMPLETE",
        message: "Production ingestion security setup is incomplete.",
        retryable: false,
        requestId,
      }, 503);
    }

    const jobId = await SourceProcessingJobService.startJob({
      personId: auth.person.id,
      sourceId,
      stage: "acquire",
    });

    // Report the status that was actually stored (legacy sources start as running).
    return jsonResponse({ ok: true, jobId, status: "running", requestId });
  } catch {
    return jsonResponse({
      ok: false,
      code: "JOB_CREATION_FAILED",
      message: "Could not create processing job.",
      retryable: true,
      requestId,
    }, 500);
  }
}

export async function PATCH(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return jsonResponse({ ok: false, code: "UNAUTHORIZED", message: "Sign in required.", retryable: false, requestId }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const jobId = typeof body.jobId === "string" ? body.jobId : "";
    const targetStatus = typeof body.status === "string" ? body.status : "failed";
    const errorMessage = typeof body.errorMessage === "string" ? body.errorMessage : "Client reported termination.";

    if (!jobId) {
      return jsonResponse({ ok: false, code: "MISSING_JOB_ID", message: "jobId is required.", retryable: false, requestId }, 400);
    }

    if (targetStatus === "timed_out") {
      await SourceProcessingJobService.timeoutJob({ jobId, personId: auth.person.id, errorMessage });
    } else if (targetStatus === "cancelled") {
      await SourceProcessingJobService.cancelJob({ jobId, personId: auth.person.id, errorMessage });
    } else {
      await SourceProcessingJobService.failJob({
        jobId,
        personId: auth.person.id,
        errorCode: "CLIENT_TERMINATED",
        errorMessage,
        status: "failed",
        canRetry: true,
      });
    }

    return jsonResponse({ ok: true, jobId, status: targetStatus, requestId });
  } catch {
    return jsonResponse({ ok: false, code: "JOB_UPDATE_FAILED", message: "Failed to update job status.", retryable: true, requestId }, 500);
  }
}
