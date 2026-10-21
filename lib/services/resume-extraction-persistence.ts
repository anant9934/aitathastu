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
  const seenKeys = new Map<string, number>();
  for (const c of candidates) {
    // Every review suggestion gets its own row, so each one's decision is kept: two
    // records with the same identity (same school, degree and field, different
    // dates) become "key" and "key#2", in document order.
    const base = recordKey(c);
    const n = (seenKeys.get(`${c.category}|${base}`) ?? 0) + 1;
    seenKeys.set(`${c.category}|${base}`, n);
    const key = n === 1 ? base : `${base}#${n}`;
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

  // Candidate ids are positions ("education_1"), so they can change when a document is
  // reprocessed. A decided row is not rewritten by the upsert above; point it at its
  // record's new id, and stop a decided record that is no longer extracted from
  // claiming an id that now belongs to a different record. The student's own
  // additions keep their ids.
  const newIdByRow = new Map(values.map((v) => [v.id!, v.candidateId!]));
  const decidedRows = await db
    .select({ id: resumeExtractedRecords.id, candidateId: resumeExtractedRecords.candidateId, provenance: resumeExtractedRecords.provenance })
    .from(resumeExtractedRecords)
    .where(and(eq(resumeExtractedRecords.personId, personId), eq(resumeExtractedRecords.documentId, documentId), ne(resumeExtractedRecords.reviewStatus, "pending")));
  for (const r of decidedRows) {
    if (r.provenance === "user") continue;
    const next = newIdByRow.get(r.id) ?? null;
    if (next === r.candidateId) continue;
    await db.update(resumeExtractedRecords).set({ candidateId: next, updatedAt: new Date() })
      .where(and(eq(resumeExtractedRecords.id, r.id), eq(resumeExtractedRecords.personId, personId)));
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

export interface SavedDecision { state: DecisionState; userValue: string | null; fields?: Record<string, string>; currentEducation?: boolean }

/** The student's own decisions on this document, by candidate id (restored on reload). */
export async function decisionsByCandidate(personId: string, documentId: string): Promise<Map<string, SavedDecision>> {
  const db = await getDb();
  const rows = await db
    .select({ candidateId: resumeExtractedRecords.candidateId, reviewStatus: resumeExtractedRecords.reviewStatus, userValue: resumeExtractedRecords.userValue, data: resumeExtractedRecords.data })
    .from(resumeExtractedRecords)
    .where(and(eq(resumeExtractedRecords.personId, personId), eq(resumeExtractedRecords.documentId, documentId), ne(resumeExtractedRecords.reviewStatus, "pending")));
  const out = new Map<string, SavedDecision>();
  for (const r of rows) {
    if (!r.candidateId || (r.data as { userAdded?: boolean })?.userAdded) continue;
    const data = r.data as { userFields?: Record<string, string>; currentEducation?: boolean };
    out.set(r.candidateId, { state: r.reviewStatus as DecisionState, userValue: r.userValue, ...(data?.userFields ? { fields: data.userFields } : {}), ...(data?.currentEducation ? { currentEducation: true } : {}) });
  }
  return out;
}

/** What the student added that the CV did not contain (shown again on reload). */
export interface UserAddedRecord { candidateId: string; category: string; kind: string; field?: string; fields: Record<string, string>; value: string; state: DecisionState; currentEducation: boolean }

export async function userAddedRecords(personId: string, documentId: string): Promise<UserAddedRecord[]> {
  const db = await getDb();
  const rows = await db.select().from(resumeExtractedRecords)
    .where(and(eq(resumeExtractedRecords.personId, personId), eq(resumeExtractedRecords.documentId, documentId), eq(resumeExtractedRecords.provenance, "user"), ne(resumeExtractedRecords.reviewStatus, "pending")));
  return rows.flatMap((r) => {
    const d = r.data as { userAdded?: boolean; kind?: string; field?: string; userFields?: Record<string, string>; value?: string; currentEducation?: boolean };
    if (!d?.userAdded || !r.candidateId) return [];
    return [{ candidateId: r.candidateId, category: r.category, kind: d.kind ?? r.category, ...(d.field ? { field: d.field } : {}), fields: d.userFields ?? {}, value: d.value ?? "", state: r.reviewStatus as DecisionState, currentEducation: Boolean(d.currentEducation) }];
  });
}

export interface DecisionInput { candidateId: string; state: DecisionState; correctedValue?: string; fields?: Record<string, string>; currentEducation?: boolean }
export interface AdditionInput { id: string; category: string; kind: string; field?: string; fields: Record<string, string>; value: string; currentEducation?: boolean }

/**
 * Records the student's decision on each candidate (audit trail included).
 * Field-level edits and the current-education marker are kept in the row's
 * data (no schema change). Re-sending the same decision is a no-op, so a
 * retried save is safe. Additions are what the student typed in themselves:
 * stored as confirmed rows with provenance "user" and no evidence.
 */
export async function recordDecisions(
  personId: string,
  documentId: string,
  decisions: DecisionInput[],
  additions: AdditionInput[] = []
): Promise<{ updated: number; unchanged: number; added: number }> {
  const db = await getDb();
  if (!decisions.length && !additions.length) return { updated: 0, unchanged: 0, added: 0 };
  let rows = await db
    .select()
    .from(resumeExtractedRecords)
    .where(and(eq(resumeExtractedRecords.personId, personId), eq(resumeExtractedRecords.documentId, documentId)));
  let added = 0;
  if (additions.length) {
    // Additions create rows: only on this person's own document.
    const [owned] = await db.select({ id: resumeDocuments.id }).from(resumeDocuments)
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId))).limit(1);
    if (!owned) return { updated: 0, unchanged: 0, added: 0 };
    const runId = rows[0]?.runId ?? runIdForDocument(documentId);
    for (const a of additions) {
      if (rows.some((r) => r.candidateId === a.id)) continue;
      const key = `user:${a.id}`;
      await db.insert(resumeExtractedRecords).values({
        id: recordId(personId, documentId, a.category, key), personId, documentId, runId, category: a.category, recordKey: key, candidateId: a.id,
        data: { value: a.value, userAdded: true, kind: a.kind, ...(a.field ? { field: a.field } : {}), userFields: {} },
        evidence: null, review: null, provenance: "user", reviewStatus: "pending",
      }).onConflictDoNothing();
      added++;
    }
    rows = await db.select().from(resumeExtractedRecords)
      .where(and(eq(resumeExtractedRecords.personId, personId), eq(resumeExtractedRecords.documentId, documentId)));
  }
  const all: DecisionInput[] = [
    ...decisions,
    ...additions.map((a) => ({ candidateId: a.id, state: "confirmed" as const, correctedValue: a.value, fields: a.fields, currentEducation: a.currentEducation })),
  ];
  const hasMarker = all.some((d) => d.currentEducation);
  let updated = 0, unchanged = 0;
  for (const d of all) {
    const row = rows.find((r) => r.candidateId === d.candidateId);
    if (!row) continue;
    const data = (row.data ?? {}) as Record<string, unknown>;
    const userValue = d.state === "confirmed" && d.correctedValue?.trim() ? d.correctedValue.trim().slice(0, 500) : row.userValue;
    const userFields = d.state === "confirmed" && d.fields ? d.fields : (data.userFields as Record<string, string> | undefined);
    const currentEducation = hasMarker ? Boolean(d.currentEducation) && d.state === "confirmed" : Boolean(data.currentEducation);
    const nextData = { ...data, ...(userFields ? { userFields } : {}), currentEducation };
    const sameData = sameFields(data.userFields as Record<string, string> | undefined, userFields) && Boolean(data.currentEducation) === currentEducation;
    if (row.reviewStatus === d.state && (row.userValue ?? null) === (userValue ?? null) && sameData) { unchanged++; continue; }
    await db.update(resumeExtractedRecords)
      .set({ reviewStatus: d.state, userValue, data: nextData, decidedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(resumeExtractedRecords.id, row.id), eq(resumeExtractedRecords.personId, personId)));
    if (row.reviewStatus !== d.state || (row.userValue ?? null) !== (userValue ?? null) || !sameFields(data.userFields as Record<string, string> | undefined, userFields)) {
      await db.insert(resumeReviewHistory).values({
        id: `rh_${hash(row.id, d.state, userValue ?? "", JSON.stringify(userFields ?? null), String(Date.now()))}`,
        documentId, personId, groupKey: row.category, recordId: row.id, fieldKey: (row.data as { field?: string })?.field ?? null,
        action: d.state === "rejected" ? "reject" : row.provenance === "user" && row.reviewStatus === "pending" ? "add" : userValue && userValue !== row.userValue ? "correct" : "confirm",
        actor: "student", actorPersonId: personId,
        previousValue: row.userValue ?? (row.data as { value?: string })?.value ?? null,
        newValue: userValue ?? (row.data as { value?: string })?.value ?? null,
        previousState: row.reviewStatus, newState: d.state,
      }).onConflictDoNothing();
    }
    updated++;
  }
  // Only one record is the current education: clear it on rows not in this save.
  if (hasMarker) {
    const mentioned = new Set(all.map((d) => d.candidateId));
    for (const r of rows) {
      if (mentioned.has(r.candidateId ?? "") || !(r.data as { currentEducation?: boolean })?.currentEducation) continue;
      await db.update(resumeExtractedRecords).set({ data: { ...(r.data as object), currentEducation: false }, updatedAt: new Date() })
        .where(and(eq(resumeExtractedRecords.id, r.id), eq(resumeExtractedRecords.personId, personId)));
    }
  }
  return { updated, unchanged, added };
}

/** jsonb does not keep key order, so field maps are compared key by key. */
function sameFields(a?: Record<string, string>, b?: Record<string, string>): boolean {
  if (!a || !b) return !a === !b;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
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
