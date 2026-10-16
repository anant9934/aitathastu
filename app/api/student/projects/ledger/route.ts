import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { addManualProject, getLedger } from "@/lib/services/project-ledger-service";
import { badUrl, ledgerFailure, requirePerson, unauthorized } from "@/lib/services/ledger-http";

/** The Project Evidence Ledger: every project from every source, plus publications (Task 2.5.1). */
export async function GET() {
  const personId = await requirePerson();
  if (!personId) return unauthorized();
  try {
    return NextResponse.json(await getLedger(personId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return ledgerFailure(error, "GET /api/student/projects/ledger");
  }
}

/** Manual "add a project". */
async function POST_handler(req: Request) {
  const personId = await requirePerson();
  if (!personId) return unauthorized();
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const invalid = badUrl(body);
  if (invalid) return invalid;
  try {
    const project = await addManualProject(personId, {
      title: String(body.title ?? ""),
      summary: typeof body.summary === "string" ? body.summary : undefined,
      technologies: Array.isArray(body.technologies) ? body.technologies.map(String) : undefined,
      repositoryUrl: typeof body.repositoryUrl === "string" ? body.repositoryUrl.trim() || null : null,
      demoUrl: typeof body.demoUrl === "string" ? body.demoUrl.trim() || null : null,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return ledgerFailure(error, "POST /api/student/projects/ledger");
  }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
