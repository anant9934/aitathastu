import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { enhanceProject } from "@/lib/services/project-ledger-service";
import { ledgerFailure, requirePerson, unauthorized } from "@/lib/services/ledger-http";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";

/** "Enhance with AI": one explicit click on one selected project (Task 2.5.2). */
async function POST_handler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const personId = await requirePerson();
  if (!personId) return unauthorized();
  const limit = await checkRateLimitDistributed(personId, "sync");
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });
  const { id } = await params;
  try {
    return NextResponse.json(await enhanceProject(personId, id));
  } catch (error) {
    return ledgerFailure(error, "POST /api/student/projects/[id]/enhance");
  }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
