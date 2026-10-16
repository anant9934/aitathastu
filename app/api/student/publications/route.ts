import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { saveManualPublication, setPublicationIncluded } from "@/lib/services/project-ledger-service";
import { badUrl, ledgerFailure, requirePerson, unauthorized } from "@/lib/services/ledger-http";

/** Add or correct a self-reported citation (Task 2.5.5). Imported papers are not editable here. */
async function POST_handler(req: Request) {
  const personId = await requirePerson();
  if (!personId) return unauthorized();
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const invalid = badUrl(body);
  if (invalid) return invalid;
  const year = Number(body.year);
  try {
    const row = await saveManualPublication(personId, {
      id: typeof body.id === "string" ? body.id : undefined,
      title: String(body.title ?? ""),
      venue: typeof body.venue === "string" ? body.venue : undefined,
      year: Number.isInteger(year) && year > 1900 && year < 2100 ? year : null,
      url: typeof body.url === "string" && body.url.trim() ? body.url.trim() : null,
    });
    return NextResponse.json({ publication: row }, { status: body.id ? 200 : 201 });
  } catch (error) {
    return ledgerFailure(error, "POST /api/student/publications");
  }
}

/** Include or exclude a publication in the portfolio pack. */
async function PATCH_handler(req: Request) {
  const personId = await requirePerson();
  if (!personId) return unauthorized();
  const body = ((await req.json().catch(() => null)) ?? {}) as { id?: unknown; portfolioIncluded?: unknown };
  if (typeof body.id !== "string" || typeof body.portfolioIncluded !== "boolean") {
    return NextResponse.json({ error: "Send { id, portfolioIncluded }." }, { status: 400 });
  }
  try {
    const row = await setPublicationIncluded(personId, body.id, body.portfolioIncluded);
    return NextResponse.json({ id: row.id, portfolioIncluded: row.portfolioIncluded });
  } catch (error) {
    return ledgerFailure(error, "PATCH /api/student/publications");
  }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
export const PATCH = withStudentCacheInvalidation(PATCH_handler);
