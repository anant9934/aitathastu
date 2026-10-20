/**
 * Persists a CV extraction as a run plus one row per reviewable record, and
 * records the student's decisions on those rows.
 *
 * Idempotency without interactive transactions (Neon HTTP): every write is an
 * upsert keyed by a deterministic id, in an order a retry can repeat safely.
 *   run id     = hash(job id)                          one row per processing job
 *   record id  = hash(person, document, category, key) stable across reprocessing
 * A record the student confirmed or rejected is never overwritten by a later
 * run (the upsert only updates rows still "pending"). Every query is scoped by
 * person id, so one account can never read or change another account's rows.
 */

import crypto from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, resumeDocuments, resumeExtractedRecords, resumeExtractionRuns, resumeReviewHistory } from "@/lib/db";
import type { ExtractionQuality } from "@/lib/intelligence/schemas";

export type DecisionState = "confirmed" | "rejected";

export interface PersistableCandidate {
  candidateId: string;
  category: string;
  value: string;
  sourceSpan: string;
  field?: string;
  recordData?: Record<string, any>;
}

const hash = (...parts: string[]) => crypto.createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
const norm = (v: unknown) => String(v ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, " ").trim();

/** The identity of a record within one document: what makes two extractions "the same item". */
export function recordKey(c: PersistableCandidate): string {
  const r = c.recordData ?? {};
  switch (c.category) {
    case "profile": return `profile:${c.field ?? c.candidateId}`;
    case "education": return [norm(r.institution), norm(r.degree), norm(r.fieldOfStudy)].join("|");
    case "experience": return [norm(r.company), norm(r.role), norm(r.startDate)].join("|");
    case "leadership": case "volunteering": return [norm(r.organization), norm(r.role)].join("|");
    case "project": return norm(r.title ?? c.value);
    case "skill": return norm(r.name ?? c.value);
    case "certification": return [norm(r.name), norm(r.issuer)].join("|");
    case "language": return norm(r.language ?? c.value);
    case "digitalFootprint": case "link": return norm(r.url ?? c.value);
    case "summary": return "summary";
    default: return norm(r.title ?? r.event ?? r.content ?? c.value).slice(0, 200);
  }
}

export function recordId(personId: string, documentId: string, category: string, key: string): string {
  return `rec_${hash(personId, documentId, category, key)}`;
}

/** One run row per document: a retried or re-queued job updates it instead of adding another. */
export function runIdForDocument(documentId: string): string {
  return `run_${hash(documentId)}`;
}

/**
 * Writes the run and its records. Returns the earlier decisions carried over
 * from another upload of the same file (same checksum) by the same person.
 */
export async function persistExtraction(params: {
  personId: string;
  documentId: string;
  jobId: string;
  candidates: PersistableCandidate[];
  quality?: ExtractionQuality;
  llmUsed: boolean;
  timings?: Record<string, number>;
}): Promise<{ runId: string; records: number; carried: Map<string, { state: DecisionState; userValue: string | null }> }> {
  const { personId, documentId, jobId, candidates, quality } = params;
  const db = await getDb();
  const runId = runIdForDocument(documentId);
  const [doc] = await db
    .select({ checksum: resumeDocuments.checksum })
    .from(resumeDocuments)
    .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)))
    .limit(1);
  if (!doc) throw new Error("Document not found for this person.");

  const needsReview = candidates.filter((c) => {
    const s = c.recordData?.review?.status;
    return s && s !== "high_confidence";
  }).length;
  const runValues = {
    id: runId, documentId, personId, jobId,
    schemaVersion: quality?.schemaVersion ?? "unknown",
    parserVersion: "rules-v3",
    method: quality?.method ?? "text",
    textQuality: quality?.textQuality ?? "good",
    status: "persisting",
    documentChecksum: doc.checksum,
    pageCount: quality?.pageCount ?? 1,
    recordCount: candidates.filter((c) => c.category !== "profile").length,
    candidateCount: candidates.length,
    needsReviewCount: needsReview,
    llmUsed: params.llmUsed,
    warnings: (quality?.warnings ?? []).slice(0, 50),
    timings: params.timings ?? {},
    errorCode: null,
    finishedAt: null,
  };
  await db.insert(resumeExtractionRuns).values(runValues).onConflictDoUpdate({
    target: resumeExtractionRuns.id,
    set: { ...runValues, startedAt: sql`${resumeExtractionRuns.startedAt}` },
  });

  const rows = new Map<string, typeof resumeExtractedRecords.$inferInsert>();
  for (const c of candidates) {
    const key = recordKey(c);
    const id = recordId(personId, documentId, c.category, key);
    if (rows.has(id)) continue;
    const r = c.recordData ?? {};
    rows.set(id, {
      id, personId, documentId, runId, category: c.category, recordKey: key.slice(0, 500), candidateId: c.candidateId,
      data: { value: c.value, sourceSpan: c.sourceSpan, ...(c.field ? { field: c.field } : {}), record: stripMeta(r) },
      evidence: r.evidence ?? { text: c.sourceSpan },
      review: r.review ?? null,
      provenance: typeof r.provenance === "string" ? r.provenance : "deterministic",
    });
  }
  const values = [...rows.values()];
  // No interactive transactions on Neon HTTP: if a batch fails, rows this
  // attempt newly inserted are removed again so no half-saved review remains.
  const existing = new Set(
    values.length
      ? (await db.select({ id: resumeExtractedRecords.id }).from(resumeExtractedRecords)
          .where(and(eq(resumeExtractedRecords.personId, personId), eq(resumeExtractedRecords.documentId, documentId)))).map((r) => r.id)
      : []
  );
  try {
    for (let i = 0; i < values.length; i += 200) {
      await db.insert(resumeExtractedRecords).values(values.slice(i, i + 200)).onConflictDoUpdate({
        target: resumeExtractedRecords.id,
        set: {
          runId: sql`excluded.run_id`, candidateId: sql`excluded.candidate_id`, data: sql`excluded.data`,
          evidence: sql`excluded.evidence`, review: sql`excluded.review`, provenance: sql`excluded.provenance`, updatedAt: new Date(),
        },
        // A decided record keeps exactly what the student approved.
        setWhere: sql`${resumeExtractedRecords.reviewStatus} = 'pending'`,
      });
    }
  } catch (err) {
    const inserted = values.map((v) => v.id!).filter((id) => !existing.has(id));
    if (inserted.length) {
      await db.delete(resumeExtractedRecords).where(and(
        eq(resumeExtractedRecords.personId, personId),
        inArray(resumeExtractedRecords.id, inserted),
        eq(resumeExtractedRecords.reviewStatus, "pending"),
      )).catch(() => undefined);
    }
    throw err;
  }

  // Same file uploaded again: bring forward this person's earlier decisions.
  const carried = new Map<string, { state: DecisionState; userValue: string | null }>();
  if (doc.checksum && values.length) {
    const earlierDocs = await db
      .select({ id: resumeDocuments.id })
      .from(resumeDocuments)
      .where(and(eq(resumeDocuments.personId, personId), eq(resumeDocuments.checksum, doc.checksum), ne(resumeDocuments.id, documentId)));
    if (earlierDocs.length) {
      const decided = await db
        .select()
        .from(resumeExtractedRecords)
        .where(and(
          eq(resumeExtractedRecords.personId, personId),
          inArray(resumeExtractedRecords.documentId, earlierDocs.map((d) => d.id)),
          ne(resumeExtractedRecords.reviewStatus, "pending"),
        ));
      for (const row of values) {
        const prior = decided.find((d) => d.category === row.category && d.recordKey === row.recordKey);
        if (!prior) continue;
        await db.update(resumeExtractedRecords)
          .set({ reviewStatus: prior.reviewStatus, userValue: prior.userValue, carriedFromDocumentId: prior.documentId, decidedAt: prior.decidedAt, updatedAt: new Date() })
          .where(and(eq(resumeExtractedRecords.id, row.id!), eq(resumeExtractedRecords.personId, personId), eq(resumeExtractedRecords.reviewStatus, "pending")));
        carried.set(row.candidateId!, { state: prior.reviewStatus as DecisionState, userValue: prior.userValue });
      }
    }
  }

  await db.update(resumeExtractionRuns)
    .set({ status: "completed", finishedAt: new Date() })
    .where(and(eq(resumeExtractionRuns.id, runId), eq(resumeExtractionRuns.personId, personId)));
  return { runId, records: values.length, carried };
}

export async function markRunFailed(personId: string, documentId: string, jobId: string, errorCode: string): Promise<void> {
  const db = await getDb();
  const runId = runIdForDocument(documentId);
  await db.insert(resumeExtractionRuns).values({
    id: runId, documentId, personId, jobId, schemaVersion: "unknown", parserVersion: "rules-v3", method: "unknown",
    textQuality: "unknown", status: "failed", errorCode, finishedAt: new Date(),
  }).onConflictDoUpdate({
    target: resumeExtractionRuns.id,
    set: { jobId, status: "failed", errorCode, finishedAt: new Date() },
    setWhere: sql`${resumeExtractionRuns.personId} = ${personId}`,
  });
}

/** The student's own decisions on this document, by candidate id (restored on reload). */
export async function decisionsByCandidate(personId: string, documentId: string): Promise<Map<string, { state: DecisionState; userValue: string | null }>> {
  const db = await getDb();
  const rows = await db
    .select({ candidateId: resumeExtractedRecords.candidateId, reviewStatus: resumeExtractedRecords.reviewStatus, userValue: resumeExtractedRecords.userValue })
    .from(resumeExtractedRecords)
    .where(and(eq(resumeExtractedRecords.personId, personId), eq(resumeExtractedRecords.documentId, documentId), ne(resumeExtractedRecords.reviewStatus, "pending")));
  const out = new Map<string, { state: DecisionState; userValue: string | null }>();
  for (const r of rows) if (r.candidateId) out.set(r.candidateId, { state: r.reviewStatus as DecisionState, userValue: r.userValue });
  return out;
}

/**
 * Records the student's decision on each candidate (audit trail included).
 * Re-sending the same decision is a no-op, so a retried save is safe.
 */
export async function recordDecisions(
  personId: string,
  documentId: string,
  decisions: Array<{ candidateId: string; state: DecisionState; correctedValue?: string }>
): Promise<{ updated: number; unchanged: number }> {
  const db = await getDb();
  if (!decisions.length) return { updated: 0, unchanged: 0 };
  const rows = await db
    .select()
    .from(resumeExtractedRecords)
    .where(and(eq(resumeExtractedRecords.personId, personId), eq(resumeExtractedRecords.documentId, documentId)));
  let updated = 0, unchanged = 0;
  for (const d of decisions) {
    const row = rows.find((r) => r.candidateId === d.candidateId);
    if (!row) continue;
    const userValue = d.state === "confirmed" && d.correctedValue?.trim() ? d.correctedValue.trim().slice(0, 500) : row.userValue;
    if (row.reviewStatus === d.state && (row.userValue ?? null) === (userValue ?? null)) { unchanged++; continue; }
    await db.update(resumeExtractedRecords)
      .set({ reviewStatus: d.state, userValue, decidedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(resumeExtractedRecords.id, row.id), eq(resumeExtractedRecords.personId, personId)));
    await db.insert(resumeReviewHistory).values({
      id: `rh_${hash(row.id, d.state, userValue ?? "", String(Date.now()))}`,
      documentId, personId, groupKey: row.category, recordId: row.id, fieldKey: (row.data as { field?: string })?.field ?? null,
      action: d.state === "rejected" ? "reject" : userValue && userValue !== row.userValue ? "correct" : "confirm",
      actor: "student", actorPersonId: personId,
      previousValue: row.userValue ?? (row.data as { value?: string })?.value ?? null,
      newValue: userValue ?? (row.data as { value?: string })?.value ?? null,
      previousState: row.reviewStatus, newState: d.state,
    }).onConflictDoNothing();
    updated++;
  }
  return { updated, unchanged };
}

export async function listRecords(personId: string, documentId: string) {
  const db = await getDb();
  return db.select().from(resumeExtractedRecords)
    .where(and(eq(resumeExtractedRecords.personId, personId), eq(resumeExtractedRecords.documentId, documentId)));
}

/** Drop bulky/duplicated metadata from the stored record body (evidence and review have their own columns). */
function stripMeta(r: Record<string, any>): Record<string, any> {
  const { evidence: _e, review: _r, ...rest } = r;
  return rest;
}
