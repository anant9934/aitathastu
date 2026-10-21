/**
 * Applies a student's CV review (POST /api/resume/[id]/apply) for an
 * authenticated person: parses the body, checks every item belongs to this
 * person's document, validates the mandatory profile fields (every save: the
 * review workspace format is the only one accepted), records decisions, field edits and additions, updates the Schema v2
 * profile and Person 360, and completes the job. The route only resolves the
 * session; everything here is scoped by person id.
 */

import { and, eq, ne } from "drizzle-orm";
import { getDb, resumeDocuments } from "@/lib/db";
import type { ExtractorProfileV2 } from "@/lib/services/extractor-service-client";
import { ResumePerson360Mapper } from "@/lib/services/resume-person360-mapper";
import { applyReviewDecisions } from "@/lib/services/resume-review-decisions";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { recordDecisions, userAddedRecords } from "@/lib/services/resume-extraction-persistence";
import { applyPayload, buildWorkspace, saveProblems } from "@/lib/resume/review-workspace";
import { parseApplyBody } from "@/lib/resume/apply-payload";
import type { ResumeReviewPayload } from "@/lib/services/resume-ingestion-service";
import { docMeta, loadOwnedResumeDocument } from "@/lib/api/resume-route-helpers";
import { sanitizeError } from "@/lib/services/resume-ingestion-service";

export async function applyResumeReviewForPerson(personId: string, documentId: string, rawBody: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const parsed = parseApplyBody(rawBody);
  if (!parsed) return { status: 400, body: { ok: false, code: "INVALID_DECISIONS", error: "Send a decision for each reviewed suggestion." } };
  // One contract: a bare list of decisions cannot be checked for the required profile
  // fields (it has no way to supply a value the CV lacked), so it is not accepted.
  const workspace = parsed.workspace;
  if (!workspace) return { status: 400, body: { ok: false, code: "UNSUPPORTED_REVIEW_FORMAT", error: "This review was sent in an old format. Reload the page and save again." } };

  const doc = await loadOwnedResumeDocument(documentId, personId);
  const profile = doc?.extractedProfile as ExtractorProfileV2 | null | undefined;
  const review = doc ? (docMeta(doc).review as ResumeReviewPayload | undefined) : undefined;
  if (!doc || !profile || !review) {
    return { status: 404, body: { ok: false, code: "NOT_READY", error: "This resume has no extraction ready for review." } };
  }

  const known = new Set(review.reviewCandidates.map((c) => c.candidateId));
  // What the student added earlier is decided like any other item (e.g. removed again).
  const earlierAdded = await userAddedRecords(personId, documentId);
  const addedIds = new Set(earlierAdded.map((a) => a.candidateId));
  const decisions = parsed.decisions.filter((d) => !d.candidateId.startsWith("user_"));
  const userDecisions = parsed.decisions.filter((d) => d.candidateId.startsWith("user_") && addedIds.has(d.candidateId));
  const unknown = parsed.decisions.filter((d) => (d.candidateId.startsWith("user_") ? !addedIds.has(d.candidateId) : !known.has(d.candidateId))).map((d) => d.candidateId);
  // Only addition ids not used by an extracted item: an id can never take over another row.
  if (parsed.additions.some((a) => known.has(a.id))) {
    return { status: 400, body: { ok: false, code: "INVALID_DECISIONS", error: "Send a decision for each reviewed suggestion." } };
  }
  // A stale review (the document was reprocessed since it loaded) is refused before anything is checked or saved.
  if (unknown.length > 0) {
    return { status: 409, body: { ok: false, code: "UNKNOWN_CANDIDATES", error: "Some reviewed items no longer match this resume. Reload and review again.", unknown } };
  }

  // The required fields are checked on the state this save produces, whatever the browser did.
  const base = buildWorkspace([
    ...review.reviewCandidates,
    ...earlierAdded.map((a) => ({ candidateId: a.candidateId, category: a.category, field: a.field, value: a.value, decision: a.state, decidedFields: a.fields, userAdded: true })),
  ]);
  const final = applyPayload(base, workspace);
  // The canonical client never confirms an emptied item; a payload that does is malformed.
  const confirmedIds = new Set([...parsed.decisions.filter((d) => d.state === "confirmed").map((d) => d.candidateId), ...parsed.additions.map((a) => a.id)]);
  if (final.items.some((i) => confirmedIds.has(i.linkedCandidateId ?? i.id) && !Object.values(i.values).some((v) => v.trim()))) {
    return { status: 400, body: { ok: false, code: "INVALID_DECISIONS", error: "An empty item cannot be saved. Untick it or fill it in." } };
  }
  const problems = saveProblems(final);
  if (problems.length) {
    // Labels and fixed messages only: nothing the student typed is echoed back.
    return { status: 422, body: {
      ok: false, code: "MANDATORY_FIELDS_MISSING", error: "Some required details are missing or not valid.",
      problems: problems.map((p) => ({ section: p.section, field: p.field, label: p.label, message: p.message, itemId: p.itemId })),
    } };
  }

  // Exactly one current education: the one the checks above validated.
  const current = final.currentEducationId;
  for (const d of [...decisions, ...userDecisions]) d.currentEducation = d.candidateId === current && d.state === "confirmed" ? true : undefined;
  for (const a of parsed.additions) a.currentEducation = a.id === current ? true : undefined;

  const applied = applyReviewDecisions(profile, known, decisions);
  const profileChanged = JSON.stringify(applied.profile) !== JSON.stringify(profile);

  try {
    const db = await getDb();
    if (profileChanged) {
      await db
        .update(resumeDocuments)
        .set({ extractedProfile: applied.profile, updatedAt: new Date() })
        .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));
    }

    const recorded = await recordDecisions(personId, documentId, [...decisions, ...userDecisions], parsed.additions);
    const mappingResult = await ResumePerson360Mapper.applyProfileToPerson360(personId, documentId, applied.profile);

    await db
      .update(resumeDocuments)
      .set({ status: "completed", updatedAt: new Date() })
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId), ne(resumeDocuments.status, "completed")));
    const jobId = docMeta(doc).jobId;
    if (typeof jobId === "string") {
      await SourceProcessingJobService.completeJob({ jobId, personId, resultReference: `resume:${documentId}`, metadata: { applied: true } });
    }

    return { status: 200, body: { ok: true, documentId, confirmed: applied.confirmed, rejected: applied.rejected, added: recorded.added, recordsUpdated: recorded.updated, mappingResult } };
  } catch (err) {
    console.error("[resume-apply] failed", { documentId, ...sanitizeError(err) });
    return { status: 500, body: { ok: false, code: "APPLY_FAILED", error: "We could not save your reviewed details. Please retry." } };
  }
}
