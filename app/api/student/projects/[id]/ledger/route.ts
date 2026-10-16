import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { HIGHLIGHT_OPTIONS, type HighlightOption } from "@/lib/domain/project-ledger";
import { updateLedgerProject, type LedgerProjectPatch } from "@/lib/services/project-ledger-service";
import { badUrl, ledgerFailure, requirePerson, unauthorized } from "@/lib/services/ledger-http";

/** In-place edit, portfolio toggle, chosen chips, archive (Tasks 2.2.4, 2.5.1, 2.5.4). */
async function PATCH_handler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const personId = await requirePerson();
  if (!personId) return unauthorized();
  const { id } = await params;
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const invalid = badUrl(body);
  if (invalid) return invalid;
  const patch: LedgerProjectPatch = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.summary === "string") patch.summary = body.summary.slice(0, 1200);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 4000);
  if (Array.isArray(body.technologies)) patch.technologies = body.technologies.map(String).slice(0, 30);
  if ("repositoryUrl" in body) patch.repositoryUrl = typeof body.repositoryUrl === "string" && body.repositoryUrl.trim() ? body.repositoryUrl.trim() : null;
  if ("demoUrl" in body) patch.demoUrl = typeof body.demoUrl === "string" && body.demoUrl.trim() ? body.demoUrl.trim() : null;
  if (typeof body.portfolioIncluded === "boolean") patch.portfolioIncluded = body.portfolioIncluded;
  if (body.status === "confirmed" || body.status === "candidate" || body.status === "archived") patch.status = body.status;
  if (typeof body.role === "string") patch.role = body.role.slice(0, 80);
  if (Array.isArray(body.highlight)) {
    patch.highlight = body.highlight.filter((h): h is HighlightOption => (HIGHLIGHT_OPTIONS as readonly string[]).includes(h as string));
  }
  try {
    return NextResponse.json({ project: await updateLedgerProject(personId, id, patch) });
  } catch (error) {
    return ledgerFailure(error, "PATCH /api/student/projects/[id]/ledger");
  }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const PATCH = withStudentCacheInvalidation(PATCH_handler);
