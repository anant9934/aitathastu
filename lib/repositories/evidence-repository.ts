import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { getDb, evidenceItems } from "../db";
import { slugify } from "../text/normalize";
import { pageBounds, type PageOptions } from "./pagination";
import type { EvidenceCategory, EvidenceSource, VerificationStatus } from "../domain";

export type EvidenceRecord = {
  id: string;
  personId: string;
  category: EvidenceCategory;
  subject: string;
  value: string;
  source: EvidenceSource;
  verificationStatus: VerificationStatus;
  sourceReference?: string | null;
  verifiedByPersonId?: string | null;
  verifiedAt?: Date | null;
  verificationMethod?: string | null;
  verificationDecisionId?: string | null;
  observedAt: Date;
  interpretation: string;
  whyItMatters: string;
  importKey?: string | null;
  originSource?: string | null;
  confidenceScore?: number | null;
  editable?: boolean;
  createdAt: Date;
  updatedAt: Date;
};


export type EvidenceInsertParams = {
  id?: string;
  category: EvidenceCategory;
  subject: string;
  value: string;
  source: EvidenceSource;
  verificationStatus: VerificationStatus;
  sourceReference?: string | null;
  verifiedByPersonId?: string | null;
  verifiedAt?: Date | string | null;
  verificationMethod?: string | null;
  verificationDecisionId?: string | null;
  observedAt?: Date | string;
  interpretation: string;
  whyItMatters: string;
  importKey?: string;
  /** Platform; derived from importKey/source when omitted (deriveOriginSource). */
  originSource?: string;
  confidenceScore?: number | null;
  editable?: boolean;
};

/** Platform an evidence row came from, for per-source show/hide/delete (Task 1.2.2). */
export function deriveOriginSource(item: Pick<EvidenceInsertParams, "originSource" | "importKey" | "source">): string {
  if (item.originSource) return item.originSource;
  const key = item.importKey || "";
  if (key.startsWith("github_")) return "github";
  if (key.startsWith("resume") || item.source === "resume_extracted") return "resume";
  if (item.source === "institutional") return "institutional";
  return "manual";
}

export async function getEvidenceByPersonId(personId: string, page?: PageOptions): Promise<EvidenceRecord[]> {
  const db = await getDb();
  const { limit, offset } = pageBounds(page);
  const rows = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.personId, personId))
    .orderBy(desc(evidenceItems.observedAt), desc(evidenceItems.id))
    .limit(limit)
    .offset(offset);

  return rows as EvidenceRecord[];
}

/**
 * Creates or updates the evidence row identified by (personId, importKey).
 *
 * A re-submission with the same import key is a correction, so it updates the
 * existing row's value. Returning the old row unchanged used to drop
 * corrections silently. Verified evidence is never overwritten from here:
 * only the verification flow may change it.
 *
 * Race-safe without transactions (the Neon HTTP driver has none): update ->
 * insert-or-nothing -> update. The unique index on (person_id, import_key)
 * makes the insert lose cleanly to a concurrent writer.
 */
export async function createEvidenceRecord(
  personId: string,
  item: EvidenceInsertParams
): Promise<EvidenceRecord> {
  const db = await getDb();
  const now = new Date();
  const observed = item.observedAt ? new Date(item.observedAt) : now;
  const verifiedDate = item.verifiedAt ? new Date(item.verifiedAt) : null;
  const id = item.id || `ev_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const importKey = item.importKey || `key_${item.category}_${slugify(item.subject.trim())}`;
  const keyMatch = and(eq(evidenceItems.personId, personId), eq(evidenceItems.importKey, importKey));

  const updateExisting = async (): Promise<EvidenceRecord | null> => {
    const [existing] = await db.select().from(evidenceItems).where(keyMatch).limit(1);
    if (!existing) return null;
    if (existing.verificationStatus === "verified") return existing as EvidenceRecord;
    const [updated] = await db
      .update(evidenceItems)
      .set({
        subject: item.subject.trim(),
        value: item.value.trim(),
        source: item.source,
        verificationStatus: item.verificationStatus,
        sourceReference: item.sourceReference ?? existing.sourceReference,
        originSource: deriveOriginSource(item),
        ...(item.confidenceScore !== undefined ? { confidenceScore: item.confidenceScore } : {}),
        observedAt: observed,
        interpretation: item.interpretation.trim(),
        whyItMatters: item.whyItMatters.trim(),
        updatedAt: now,
      })
      .where(and(keyMatch, eq(evidenceItems.id, existing.id)))
      .returning();
    return (updated ?? existing) as EvidenceRecord;
  };

  const updated = await updateExisting();
  if (updated) return updated;

  const [created] = await db
    .insert(evidenceItems)
    .values({
      id,
      personId,
      category: item.category,
      subject: item.subject.trim(),
      value: item.value.trim(),
      source: item.source,
      verificationStatus: item.verificationStatus,
      // Every row is traceable: without a reference, point at its own import key.
      sourceReference: item.sourceReference || `${deriveOriginSource(item)}:${importKey}`,
      originSource: deriveOriginSource(item),
      confidenceScore: item.confidenceScore ?? null,
      editable: item.editable ?? item.verificationStatus !== "verified",
      verifiedByPersonId: item.verifiedByPersonId || null,
      verifiedAt: verifiedDate,
      verificationMethod: item.verificationMethod || null,
      verificationDecisionId: item.verificationDecisionId || null,
      observedAt: observed,
      interpretation: item.interpretation.trim(),
      whyItMatters: item.whyItMatters.trim(),
      importKey,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created as EvidenceRecord;

  // Lost a race with a concurrent insert of the same key: apply ours as an update.
  const afterRace = await updateExisting();
  if (!afterRace) throw new Error(`Evidence ${importKey} could not be written for ${personId}`);
  return afterRace;
}

/**
 * Writes many evidence items for one person with bounded concurrency.
 * Items sharing an import key are collapsed (last one wins) so the batch
 * never races against itself.
 */
export async function writeEvidenceBatch(personId: string, items: EvidenceInsertParams[], concurrency = 8): Promise<EvidenceRecord[]> {
  const byKey = new Map<string, EvidenceInsertParams>();
  for (const item of items) byKey.set(item.importKey || `key_${item.category}_${slugify(item.subject.trim())}`, item);
  const unique = [...byKey.values()];
  const out: EvidenceRecord[] = [];
  for (let i = 0; i < unique.length; i += concurrency) {
    out.push(...(await Promise.all(unique.slice(i, i + concurrency).map((item) => createEvidenceRecord(personId, item)))));
  }
  return out;
}

/**
 * Deletes one platform's evidence for a person and nothing else (Task 1.2.2).
 * Verified / non-editable rows are kept: a disconnect must not erase a
 * faculty verification.
 */
export async function deleteEvidenceBySource(personId: string, originSource: string): Promise<number> {
  const db = await getDb();
  const removed = await db
    .delete(evidenceItems)
    .where(and(eq(evidenceItems.personId, personId), eq(evidenceItems.originSource, originSource), eq(evidenceItems.editable, true)))
    .returning();
  return removed.length;
}

/** Per-source counts for the "where did this come from" view. */
export async function countEvidenceBySource(personId: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.select({ origin: evidenceItems.originSource }).from(evidenceItems).where(eq(evidenceItems.personId, personId));
  const out: Record<string, number> = {};
  for (const r of rows) out[r.origin ?? "unknown"] = (out[r.origin ?? "unknown"] ?? 0) + 1;
  return out;
}

