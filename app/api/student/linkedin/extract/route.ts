/**
 * LinkedIn public-profile extraction for the signed-in student.
 *
 *   GET     state, the latest job, and the saved profile with its records
 *           (also resumes a job nobody is working on, after responding)
 *   POST    { action: "start" | "retry" | "refresh", profileUrl? } → 202 with the job
 *           (an extraction already running is returned instead of starting another)
 *   DELETE  cancel the running extraction; a profile saved earlier stays
 *
 * The student is always the session's person; no identifier is taken from the request.
 */
import { after, NextResponse } from "next/server";
import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { getExternalConnectionByProvider } from "@/lib/repositories/connection-repository";
import {
  ExtractionRequestError, advanceExtractionJob, getLinkedInExtractionConfig, isInFlight, latestExtractionJob, leaseExpired,
  readSavedProfile, requestExtraction, requestExtractionCancel, viewOf, type ExtractionTrigger,
} from "@/lib/services/linkedin-extraction-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
const unauthorized = () => NextResponse.json({ error: "Your session has expired. Refresh the page and sign in again." }, { status: 401 });

function resumeAfterResponse(personId: string, jobId: string) {
  after(async () => {
    try {
      await advanceExtractionJob(personId, jobId, { budgetMs: 50_000 });
    } catch (error) {
      console.error("[linkedin-extract] advance failed", { jobId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    }
  });
}

async function snapshot(personId: string) {
  const cfg = getLinkedInExtractionConfig();
  const [job, saved, connection] = await Promise.all([
    latestExtractionJob(personId),
    readSavedProfile(personId),
    getExternalConnectionByProvider(personId, "linkedin").catch(() => null),
  ]);
  const linkedUrl = connection && connection.status !== "disconnected" ? connection.profileUrl || null : null;
  const view = job ? viewOf(job) : null;
  const state = view?.state ?? (saved ? "succeeded" : linkedUrl ? "ready" : "not_connected");
  return {
    job,
    body: {
      configured: cfg.configured,
      ...(cfg.configured ? {} : { notConfiguredMessage: "LinkedIn extraction isn't available on this server yet. You can still save your profile link." }),
      state,
      profileUrl: saved?.profile.profileUrl ?? view?.profileUrl ?? linkedUrl,
      lastSuccessfulAt: saved?.profile.lastSuccessfulAt ?? null,
      job: view,
      profile: saved?.profile ?? null,
      counts: saved?.counts ?? null,
      records: saved?.records ?? [],
    },
  };
}

export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const { job, body } = await snapshot(auth.person.id);
  if (isInFlight(job) && leaseExpired(job)) resumeAfterResponse(auth.person.id, job.id);
  return NextResponse.json(body, { headers: NO_STORE });
}

async function POST_handler(request: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const personId = auth.person.id;

  const limit = await checkRateLimitDistributed(personId, "sync");
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests. Wait a minute and try again.", code: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action === "retry" || body.action === "refresh" ? body.action : "start";
  let profileUrl = typeof body.profileUrl === "string" ? body.profileUrl.trim().slice(0, 300) : "";
  if (!profileUrl && action !== "start") {
    // Retry and refresh reuse the profile already on record.
    const [job, saved] = await Promise.all([latestExtractionJob(personId), readSavedProfile(personId)]);
    profileUrl = saved?.profile.profileUrl ?? (job ? viewOf(job).profileUrl : "") ?? "";
  }
  if (!profileUrl) return NextResponse.json({ error: "Enter your LinkedIn profile URL.", code: "invalid_url" }, { status: 400 });

  try {
    const trigger: ExtractionTrigger = action === "start" ? "initial" : action;
    const { job, existing } = await requestExtraction(personId, profileUrl, trigger);
    if (leaseExpired(job)) resumeAfterResponse(personId, job.id);
    return NextResponse.json({ job: viewOf(job), existing }, { status: existing ? 200 : 202, headers: NO_STORE });
  } catch (error) {
    if (error instanceof ExtractionRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : undefined },
      );
    }
    console.error("[linkedin-extract] start failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return NextResponse.json({ error: "Couldn't start the extraction. Try again.", code: "internal" }, { status: 500 });
  }
}

async function DELETE_handler() {
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const job = await latestExtractionJob(auth.person.id);
  if (!isInFlight(job)) return NextResponse.json({ error: "No extraction is running.", code: "not_running" }, { status: 409 });
  return NextResponse.json({ job: await requestExtractionCancel(auth.person.id, job.id) }, { headers: NO_STORE });
}

export const POST = withStudentCacheInvalidation(POST_handler);
export const DELETE = withStudentCacheInvalidation(DELETE_handler);
