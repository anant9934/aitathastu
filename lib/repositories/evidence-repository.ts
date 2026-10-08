import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { getDb, evidenceItems } from "../db";
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

export async function getEvidenceByPersonId(personId: string): Promise<EvidenceRecord[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.personId, personId))
    .orderBy(desc(evidenceItems.observedAt));

  return rows as EvidenceRecord[];
}

export async function createEvidenceRecord(
  personId: string,
  item: EvidenceInsertParams
): Promise<EvidenceRecord> {
  const db = await getDb();
  const now = new Date();
  const observed = item.observedAt ? new Date(item.observedAt) : now;
  const verifiedDate = item.verifiedAt ? new Date(item.verifiedAt) : null;
  const id = item.id || `ev_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  // Deterministic import key if not specified
  const importKey =
    item.importKey ||
    `key_${item.category}_${item.subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

  // Check if item with this importKey already exists for this person to prevent duplicates
  const existing = await db
    .select()
    .from(evidenceItems)
    .where(
      and(
        eq(evidenceItems.personId, personId),
        eq(evidenceItems.importKey, importKey)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0] as EvidenceRecord;
  }

  await db.insert(evidenceItems).values({
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
  });

  return {
    id,
    personId,
    category: item.category,
    subject: item.subject.trim(),
    value: item.value.trim(),
    source: item.source,
    verificationStatus: item.verificationStatus,
    sourceReference: item.sourceReference || null,
    observedAt: observed,
    interpretation: item.interpretation.trim(),
    whyItMatters: item.whyItMatters.trim(),
    importKey,
    createdAt: now,
    updatedAt: now,
  };
}

export async function upsertEvidenceItems(
  personId: string,
  items: EvidenceInsertParams[]
): Promise<EvidenceRecord[]> {
  const results: EvidenceRecord[] = [];
  for (const item of items) {
    const record = await createEvidenceRecord(personId, item);
    results.push(record);
  }
  return results;
}
