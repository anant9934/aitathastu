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
};

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
      sourceReference: item.sourceReference || null,
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
