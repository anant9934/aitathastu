/**
 * POST /api/resume/[id]/apply
 *
 * Body: { decisions: [{ candidateId, state: "confirmed" | "rejected", correctedValue? }] }
 *
 * Records the student's decision for every candidate, then imports only the
 * confirmed records into Person 360 and moves the job review_ready -> completed.
 * Any failure returns a non-2xx response; the client must not report success
 * unless this returns ok.
 */

import { and, eq } from "drizzle-orm";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getDb, resumeDocuments } from "@/lib/db";
import type { ExtractorProfileV2 } from "@/lib/services/extractor-service-client";
import { ResumePerson360Mapper } from "@/lib/services/resume-person360-mapper";
import { applyReviewDecisions, type ReviewDecision } from "@/lib/services/resume-review-decisions";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { recordDecisions } from "@/lib/services/resume-extraction-persistence";
import type { ResumeReviewPayload } from "@/lib/services/resume-ingestion-service";
import { docMeta, jsonNoStore, loadOwnedResumeDocument, unauthorized } from "@/lib/api/resume-route-helpers";

export const runtime = "nodejs";

function parseDecisions(body: unknown): ReviewDecision[] | null {
  const raw = (body as { decisions?: unknown } | null)?.decisions;
  if (!Array.isArray(raw)) return null;
  const out: ReviewDecision[] = [];
  for (const d of raw) {
    if (!d || typeof d !== "object") return null;
    const { candidateId, state, correctedValue } = d as Record<string, unknown>;
    if (typeof candidateId !== "string" || (state !== "confirmed" && state !== "rejected")) return null;
    out.push({ candidateId, state, correctedValue: typeof correctedValue === "string" ? correctedValue.slice(0, 500) : undefined });
  }
  return out;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const personId = auth.person.id;

  const decisions = parseDecisions(await request.json().catch(() => null));
  if (!decisions) return jsonNoStore({ ok: false, code: "INVALID_DECISIONS", error: "Send a decision for each reviewed suggestion." }, 400);

  const doc = await loadOwnedResumeDocument(documentId, personId);
  const profile = doc?.extractedProfile as ExtractorProfileV2 | null | undefined;
  const review = doc ? (docMeta(doc).review as ResumeReviewPayload | undefined) : undefined;
  if (!doc || !profile || !review) {
    return jsonNoStore({ ok: false, code: "NOT_READY", error: "This resume has no extraction ready for review." }, 404);
  }

  const known = new Set(review.reviewCandidates.map((c) => c.candidateId));
  const applied = applyReviewDecisions(profile, known, decisions);
  if (applied.unknown.length > 0) {
    return jsonNoStore({ ok: false, code: "UNKNOWN_CANDIDATES", error: "Some reviewed items no longer match this resume. Reload and review again.", unknown: applied.unknown }, 409);
  }

  try {
    const db = await getDb();
    await db
      .update(resumeDocuments)
      .set({ extractedProfile: applied.profile, updatedAt: new Date() })
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));

    const recorded = await recordDecisions(personId, documentId, decisions);
    const mappingResult = await ResumePerson360Mapper.applyProfileToPerson360(personId, documentId, applied.profile);

    await db
      .update(resumeDocuments)
      .set({ status: "completed", updatedAt: new Date() })
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));
    const jobId = docMeta(doc).jobId;
    if (typeof jobId === "string") {
      await SourceProcessingJobService.completeJob({ jobId, personId, resultReference: `resume:${documentId}`, metadata: { applied: true } });
    }

    return jsonNoStore({ ok: true, documentId, confirmed: applied.confirmed, rejected: applied.rejected, recordsUpdated: recorded.updated, mappingResult });
  } catch (err) {
    console.error("[resume-apply] failed", { documentId, error: err instanceof Error ? err.message : err });
    return jsonNoStore({ ok: false, code: "APPLY_FAILED", error: "We could not save your reviewed details. Please retry." }, 500);
  }
}
