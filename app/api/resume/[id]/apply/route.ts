/**
 * POST /api/resume/[id]/apply
 *
 * Body: the review workspace payload (lib/resume/review-workspace.ts serializeWorkspace):
 *   { workspaceVersion: 1, decisions: [{ candidateId, state, correctedValue?, fields?, currentEducation? }],
 *     additions: [...], currentEducationId }. Any other shape is 400.
 *   Every save is checked for the mandatory profile fields (full name, email,
 *   GitHub profile URL, current education) here as well as in the browser; a
 *   failure is 422 MANDATORY_FIELDS_MISSING and nothing is saved. Bodies over
 *   MAX_BODY_BYTES are 413.
 *
 * Records the student's decision for every candidate, then imports only the
 * confirmed records into Person 360 and moves the job review_ready -> completed.
 * Any failure returns a non-2xx response; the client must not report success
 * unless this returns ok.
 */

import { getServerAuthContext } from "@/lib/auth/server-session";
import { applyResumeReviewForPerson } from "@/lib/services/resume-review-apply";
import { jsonNoStore, unauthorized } from "@/lib/api/resume-route-helpers";
import { readJsonBodyLimited } from "@/lib/resume/apply-payload";

export const runtime = "nodejs";

/** A full review of a long CV is well under 100 KB. */
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const read = await readJsonBodyLimited(request, MAX_BODY_BYTES);
  if (read.tooLarge) return jsonNoStore({ ok: false, code: "PAYLOAD_TOO_LARGE", error: "This review is too large to save." }, 413);
  const body = read.body;
  const result = await applyResumeReviewForPerson(auth.person.id, documentId, body);
  return jsonNoStore(result.body, result.status);
}
