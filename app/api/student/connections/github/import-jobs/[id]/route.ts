import { after, NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { IMPORT_JOB_SOURCE, advanceImportJob, isInFlight, leaseExpired, requestImportCancel, viewOf } from "@/lib/services/github-import-job";

export const runtime = "nodejs";
export const maxDuration = 60;

type Owned =
  | { ok: false; response: NextResponse }
  | { ok: true; job: NonNullable<Awaited<ReturnType<typeof SourceProcessingJobService.getJobForPerson>>>; personId: string };

async function ownedJob(id: string): Promise<Owned> {
  const auth = await getServerAuthContext();
  if (!auth) return { ok: false, response: NextResponse.json({ error: "Your session has expired. Refresh the page and sign in again." }, { status: 401 }) };
  const job = await SourceProcessingJobService.getJobForPerson(id, auth.person.id);
  // Another student's job (or any other kind of job) is indistinguishable from a missing one.
  if (!job || job.sourceId !== IMPORT_JOB_SOURCE) return { ok: false, response: NextResponse.json({ error: "Import not found." }, { status: 404 }) };
  return { ok: true, job, personId: auth.person.id };
}

/** Cheap progress read (database only). If nobody is working on the job, this poll resumes it after responding. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedJob((await params).id);
  if (!found.ok) return found.response;
  const { job, personId } = found;
  if (isInFlight(job) && leaseExpired(job)) {
    after(async () => {
      try { await advanceImportJob(personId, job.id, { budgetMs: 45_000 }); } catch (error) {
        console.error("[github-import] resume failed", { jobId: job.id, error: error instanceof Error ? error.message : String(error) });
      }
    });
  }
  return NextResponse.json(viewOf(job), { headers: { "Cache-Control": "no-store" } });
}

/** Cancels after the current batch; repositories already imported stay. */
async function DELETE_handler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedJob((await params).id);
  if (!found.ok) return found.response;
  return NextResponse.json(await requestImportCancel(found.personId, found.job.id));
}

export const DELETE = withStudentCacheInvalidation(DELETE_handler);
