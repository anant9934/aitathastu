import { after, NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { getGitHubConnectOverview, startGitHubImport } from "@/lib/services/github-connect-service";
import { advanceImportJob } from "@/lib/services/github-import-job";

export const runtime = "nodejs";
export const maxDuration = 60;

const unauthorized = () => NextResponse.json({ error: "Your session has expired. Refresh the page and sign in again." }, { status: 401 });

/** The student's GitHub connection: state, installations, counts, job progress and every repository they can choose from. */
export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  // Each call lists repositories from GitHub, so it is limited like other API reads.
  const rl = await checkRateLimitDistributed(auth.person.id, "general");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } });
  const overview = await getGitHubConnectOverview(auth.person.id);
  return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Queues an import of the selected repositories ({ repositoryIds: number[] }) and
 * returns 202 with the job at once; batches continue after the response and on
 * every status poll. A second request while one runs returns that same job.
 */
async function POST_handler(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const rl = await checkRateLimitDistributed(auth.person.id, "sync");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many imports in a row. Wait a minute and try again." }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } });
  }
  const body = (await req.json().catch(() => null)) as { repositoryIds?: unknown } | null;
  const ids = Array.isArray(body?.repositoryIds) ? body!.repositoryIds.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 1000) : [];
  if (!ids.length) return NextResponse.json({ error: "Choose at least one repository." }, { status: 400 });
  const personId = auth.person.id;
  const result = await startGitHubImport(personId, ids);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  after(async () => {
    try { await advanceImportJob(personId, result.jobId, { budgetMs: 45_000 }); } catch (error) {
      console.error("[github-import] background batch failed", { jobId: result.jobId, error: error instanceof Error ? error.message : String(error) });
    }
  });
  return NextResponse.json(result, { status: 202 });
}

export const POST = withStudentCacheInvalidation(POST_handler);
