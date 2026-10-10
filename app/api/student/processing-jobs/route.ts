import { NextResponse } from "next/server";
import { getServerAuthContext, getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Sign in to view import progress." }, { status: 401 });
  const jobId = new URL(request.url).searchParams.get("jobId");
  const jobs = jobId
    ? [await SourceProcessingJobService.getJobForPerson(jobId, auth.person.id)].filter(Boolean)
    : await SourceProcessingJobService.getJobsForPerson(auth.person.id, 30);
  return NextResponse.json({ jobs }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const authRes = await getOrCreateOnboardingAuthContext().catch(() => null);
  if (!authRes || !authRes.auth) return NextResponse.json({ error: "Sign in before importing." }, { status: 401 });
  const auth = authRes.auth;
  const body = await request.json().catch(() => ({}));
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
  const allowed = new Set(["resume", "github", "portfolio", "linkedin", "leetcode", "huggingface", "orcid", "hackerrank", "codechef", "hackerearth", "kaggle", "devto", "stackoverflow", "google_scholar"]);
  if (!allowed.has(sourceId)) return NextResponse.json({ error: "Unsupported source." }, { status: 400 });
  if ((sourceId === "resume" || sourceId === "github") && !coreIngestionReady()) {
    return NextResponse.json({ error: "Production ingestion security setup is incomplete." }, { status: 503 });
  }
  const jobId = await SourceProcessingJobService.startJob({ personId: auth.person.id, sourceId, stage: "acquire" });
  const response = NextResponse.json({ jobId }, { headers: { "Cache-Control": "private, no-store" } });
  if (authRes.sessionCookieToSet) {
    response.cookies.set(
      authRes.sessionCookieToSet.name,
      authRes.sessionCookieToSet.value,
      authRes.sessionCookieToSet.options as Parameters<typeof response.cookies.set>[2]
    );
  }
  return response;
}

