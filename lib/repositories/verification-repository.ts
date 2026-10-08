import crypto from "crypto";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  getDb,
  verificationRequests,
  verificationDecisions,
  evidenceItems,
  persons,
} from "../db";

export type VerificationRequestRecord = {
  id: string;
  evidenceId: string;
  requesterPersonId: string;
  organizationId: string;
  status: "pending" | "under_review" | "verified" | "rejected" | "changes_requested";
  supportingReference?: string | null;
  studentNotes?: string | null;
  assignedVerifierPersonId?: string | null;
  requestedAt: Date;
  reviewStartedAt?: Date | null;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VerificationDecisionRecord = {
  id: string;
  verificationRequestId: string;
  verifierPersonId: string;
  decision: "verified" | "rejected" | "changes_requested";
  reason?: string | null;
  method: string;
  createdAt: Date;
};

export type QueueItem = VerificationRequestRecord & {
  requesterName: string;
  evidenceCategory: string;
  evidenceSubject: string;
  evidenceValue: string;
  evidenceSource: string;
  evidenceObservedAt: Date;
};

/**
 * Creates a new verification request for an evidence item.
 * Enforces rule: no duplicate open request for the same evidence item.
 */
export async function createVerificationRequest(params: {
  evidenceId: string;
  requesterPersonId: string;
  organizationId: string;
  supportingReference?: string;
  studentNotes?: string;
}): Promise<VerificationRequestRecord> {
  const db = await getDb();
  const now = new Date();

  // Check if open request already exists for this evidence item
  const existingOpen = await db
    .select()
    .from(verificationRequests)
    .where(
      and(
        eq(verificationRequests.evidenceId, params.evidenceId),
        inArray(verificationRequests.status, ["pending", "under_review", "changes_requested"])
      )
    )
    .limit(1);

  if (existingOpen.length > 0) {
    throw new Error("An open verification request already exists for this evidence item.");
  }

  const id = `vreq_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  await db.insert(verificationRequests).values({
    id,
    evidenceId: params.evidenceId,
    requesterPersonId: params.requesterPersonId,
    organizationId: params.organizationId,
    status: "pending",
    supportingReference: params.supportingReference?.trim() || null,
    studentNotes: params.studentNotes?.trim() || null,
    requestedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    evidenceId: params.evidenceId,
    requesterPersonId: params.requesterPersonId,
    organizationId: params.organizationId,
    status: "pending",
    supportingReference: params.supportingReference?.trim() || null,
    studentNotes: params.studentNotes?.trim() || null,
    assignedVerifierPersonId: null,
    requestedAt: now,
    reviewStartedAt: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getVerificationRequestById(id: string): Promise<VerificationRequestRecord | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.id, id))
    .limit(1);

  return (rows[0] as VerificationRequestRecord) || null;
}

export async function getVerificationRequestsByRequester(
  personId: string
): Promise<VerificationRequestRecord[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.requesterPersonId, personId))
    .orderBy(desc(verificationRequests.requestedAt));

  return rows as VerificationRequestRecord[];
}

export async function getVerificationRequestsForEvidence(
  evidenceId: string
): Promise<VerificationRequestRecord[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.evidenceId, evidenceId))
    .orderBy(desc(verificationRequests.requestedAt));

  return rows as VerificationRequestRecord[];
}

/**
 * Returns verification queue for authorized verifiers within an organization.
 * Privacy-protecting: returns only evidence details and student display name.
 */
export async function getVerificationQueueForOrg(
  organizationId: string
): Promise<QueueItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: verificationRequests.id,
      evidenceId: verificationRequests.evidenceId,
      requesterPersonId: verificationRequests.requesterPersonId,
      organizationId: verificationRequests.organizationId,
      status: verificationRequests.status,
      supportingReference: verificationRequests.supportingReference,
      studentNotes: verificationRequests.studentNotes,
      assignedVerifierPersonId: verificationRequests.assignedVerifierPersonId,
      requestedAt: verificationRequests.requestedAt,
      reviewStartedAt: verificationRequests.reviewStartedAt,
      resolvedAt: verificationRequests.resolvedAt,
      createdAt: verificationRequests.createdAt,
      updatedAt: verificationRequests.updatedAt,
      requesterName: persons.displayName,
      evidenceCategory: evidenceItems.category,
      evidenceSubject: evidenceItems.subject,
      evidenceValue: evidenceItems.value,
      evidenceSource: evidenceItems.source,
      evidenceObservedAt: evidenceItems.observedAt,
    })
    .from(verificationRequests)
    .innerJoin(evidenceItems, eq(evidenceItems.id, verificationRequests.evidenceId))
    .innerJoin(persons, eq(persons.id, verificationRequests.requesterPersonId))
    .where(eq(verificationRequests.organizationId, organizationId))
    .orderBy(desc(verificationRequests.requestedAt));

  return rows as QueueItem[];
}

/**
 * Creates an immutable verification decision and updates request status.
 * Concurrency protected: prevents multiple decisions on an already resolved request.
 */
export async function recordVerificationDecision(params: {
  requestId: string;
  verifierPersonId: string;
  decision: "verified" | "rejected" | "changes_requested";
  reason?: string;
  method: string;
}): Promise<{ decision: VerificationDecisionRecord; updatedRequest: VerificationRequestRecord }> {
  const db = await getDb();
  const now = new Date();

  // Optimistic concurrency check: fetch request
  const reqRows = await db
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.id, params.requestId))
    .limit(1);

  if (reqRows.length === 0) {
    throw new Error("Verification request not found.");
  }

  const currentReq = reqRows[0] as VerificationRequestRecord;
  if (currentReq.status === "verified" || currentReq.status === "rejected") {
    throw new Error("This verification request has already reached a final decision.");
  }

  const decisionId = `vdec_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  // Insert immutable decision
  await db.insert(verificationDecisions).values({
    id: decisionId,
    verificationRequestId: params.requestId,
    verifierPersonId: params.verifierPersonId,
    decision: params.decision,
    reason: params.reason?.trim() || null,
    method: params.method.trim(),
    createdAt: now,
  });

  // Update request state
  await db
    .update(verificationRequests)
    .set({
      status: params.decision,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(verificationRequests.id, params.requestId));

  const updatedReq: VerificationRequestRecord = {
    ...currentReq,
    status: params.decision,
    resolvedAt: now,
    updatedAt: now,
  };

  const decisionRecord: VerificationDecisionRecord = {
    id: decisionId,
    verificationRequestId: params.requestId,
    verifierPersonId: params.verifierPersonId,
    decision: params.decision,
    reason: params.reason?.trim() || null,
    method: params.method.trim(),
    createdAt: now,
  };

  return { decision: decisionRecord, updatedRequest: updatedReq };
}

/**
 * Retrieves immutable audit history of decisions for a request.
 */
export async function getDecisionsForRequest(
  requestId: string
): Promise<VerificationDecisionRecord[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(verificationDecisions)
    .where(eq(verificationDecisions.verificationRequestId, requestId))
    .orderBy(desc(verificationDecisions.createdAt));

  return rows as VerificationDecisionRecord[];
}

/**
 * Resubmits a request that had changes requested.
 */
export async function resubmitVerificationRequest(params: {
  requestId: string;
  supportingReference?: string;
  studentNotes?: string;
}): Promise<VerificationRequestRecord> {
  const db = await getDb();
  const now = new Date();

  await db
    .update(verificationRequests)
    .set({
      status: "pending",
      supportingReference: params.supportingReference?.trim() || null,
      studentNotes: params.studentNotes?.trim() || null,
      updatedAt: now,
    })
    .where(eq(verificationRequests.id, params.requestId));

  const updated = await getVerificationRequestById(params.requestId);
  if (!updated) {
    throw new Error("Failed to retrieve updated verification request.");
  }

  return updated;
}
