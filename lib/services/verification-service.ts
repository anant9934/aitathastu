import { eq, and } from "drizzle-orm";
import { getDb, evidenceItems, organizationMemberships } from "../db";
import { can } from "../auth/rbac";
import {
  createVerificationRequest,
  getVerificationRequestById,
  getVerificationRequestsByRequester,
  getVerificationQueueForOrg,
  recordVerificationDecision,
  getDecisionsForRequest,
  resubmitVerificationRequest,
  type VerificationRequestRecord,
  type VerificationDecisionRecord,
  type QueueItem,
} from "../repositories/verification-repository";
import { createJourneyEventRecord } from "../repositories/journey-repository";

export class VerificationError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "VerificationError";
  }
}

/**
 * Submits an evidence item for independent verification.
 * Enforces rule: Student cannot self-verify (request is submitted as pending review).
 */
export async function submitEvidenceForVerification(
  requesterPersonId: string,
  evidenceId: string,
  options?: {
    supportingReference?: string;
    studentNotes?: string;
  }
): Promise<VerificationRequestRecord> {
  const db = await getDb();

  // 1. Verify evidence ownership
  const evRows = await db
    .select()
    .from(evidenceItems)
    .where(and(eq(evidenceItems.id, evidenceId), eq(evidenceItems.personId, requesterPersonId)))
    .limit(1);

  if (evRows.length === 0) {
    throw new VerificationError("Evidence item not found or does not belong to you.", 404);
  }

  const evidence = evRows[0];
  if (evidence.verificationStatus === "verified") {
    throw new VerificationError("This evidence item has already been independently verified.", 400);
  }

  // 2. Determine requester's active organization
  const memRows = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.personId, requesterPersonId),
        eq(organizationMemberships.status, "active")
      )
    )
    .limit(1);

  const organizationId = memRows.length > 0 ? memRows[0].organizationId : "org_tathastu_default";

  // 3. Create verification request (enforces no duplicate open requests)
  const reqRecord = await createVerificationRequest({
    evidenceId,
    requesterPersonId,
    organizationId,
    supportingReference: options?.supportingReference,
    studentNotes: options?.studentNotes,
  });

  // 4. Update evidence item status to 'verification_requested'
  await db
    .update(evidenceItems)
    .set({
      verificationStatus: "verification_requested",
      sourceReference: options?.supportingReference?.trim() || evidence.sourceReference,
      updatedAt: new Date(),
    })
    .where(eq(evidenceItems.id, evidenceId));

  // 5. Record auditable journey event
  await createJourneyEventRecord(requesterPersonId, {
    type: "verification_requested",
    title: "Verification requested",
    description: `Submitted "${evidence.subject}" (${evidence.category}) for independent faculty verification.`,
    relatedEntityId: reqRecord.id,
    metadata: {
      evidenceId,
      subject: evidence.subject,
      supportingReference: options?.supportingReference,
    },
  });

  return reqRecord;
}

/**
 * Returns verification requests created by a student.
 */
export async function getStudentVerificationRequests(personId: string) {
  const requests = await getVerificationRequestsByRequester(personId);
  const requestsWithHistory = await Promise.all(
    requests.map(async (req) => {
      const decisions = await getDecisionsForRequest(req.id);
      return {
        ...req,
        decisions,
      };
    })
  );
  return requestsWithHistory;
}

/**
 * Retrieves the verification queue for an authorized verifier.
 * Privacy rule: Exposes only the evidence to be verified and requester name,
 * never unrelated private Person 360 data.
 */
export async function getVerifierQueue(verifierPersonId: string): Promise<QueueItem[]> {
  const db = await getDb();

  // Find all organizations where verifier is an active member
  const memberships = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.personId, verifierPersonId),
        eq(organizationMemberships.status, "active")
      )
    );

  if (memberships.length === 0) {
    return [];
  }

  // Filter organizations where verifier has 'student.verify_skill'
  const allQueueItems: QueueItem[] = [];
  for (const mem of memberships) {
    const hasCapability = await can(verifierPersonId, "student.verify_skill", {
      organizationId: mem.organizationId,
    });

    if (hasCapability) {
      const orgItems = await getVerificationQueueForOrg(mem.organizationId);
      allQueueItems.push(...orgItems);
    }
  }

  // Deduplicate by request ID if member of multiple orgs
  const seen = new Set<string>();
  return allQueueItems.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Reviews a verification request and makes an authorized decision.
 * Strict security rules:
 * 1. Verifier identity comes from session.
 * 2. Student cannot verify own evidence.
 * 3. Verifier must possess 'student.verify_skill' in the request's organization context.
 * 4. Reason is mandatory for negative or changes-requested decisions.
 */
export async function reviewVerificationRequest(params: {
  verifierPersonId: string;
  requestId: string;
  decision: "verified" | "rejected" | "changes_requested";
  reason?: string;
  method?: string;
}): Promise<{ decision: VerificationDecisionRecord; updatedRequest: VerificationRequestRecord }> {
  const { verifierPersonId, requestId, decision, reason, method = "faculty_review" } = params;

  const db = await getDb();
  const request = await getVerificationRequestById(requestId);
  if (!request) {
    throw new VerificationError("Verification request not found.", 404);
  }

  // RULE: Student cannot self-verify
  if (verifierPersonId === request.requesterPersonId) {
    throw new VerificationError("A student cannot verify their own evidence.", 403);
  }

  // RULE: Authorized verifier capability check in organization scope
  const hasCapability = await can(verifierPersonId, "student.verify_skill", {
    organizationId: request.organizationId,
  });

  if (!hasCapability) {
    throw new VerificationError(
      "You are not authorized to verify evidence in this organization scope (requires student.verify_skill capability).",
      403
    );
  }

  // RULE: Reason is required for negative or changes-requested decisions
  if ((decision === "rejected" || decision === "changes_requested") && (!reason || reason.trim().length === 0)) {
    throw new VerificationError(
      `A reason or feedback explanation is required when selecting "${decision}".`,
      400
    );
  }

  // Fetch the related evidence item
  const evRows = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.id, request.evidenceId))
    .limit(1);

  if (evRows.length === 0) {
    throw new VerificationError("Referenced evidence item was not found.", 404);
  }
  const evidence = evRows[0];

  // Record decision and update request status (protected against concurrent duplicate final decisions)
  const { decision: decisionRecord, updatedRequest } = await recordVerificationDecision({
    requestId,
    verifierPersonId,
    decision,
    reason,
    method,
  });

  const now = new Date();

  // Update evidence item according to the decision
  if (decision === "verified") {
    await db
      .update(evidenceItems)
      .set({
        verificationStatus: "verified",
        verifiedByPersonId: verifierPersonId,
        verifiedAt: now,
        verificationMethod: method,
        verificationDecisionId: decisionRecord.id,
        interpretation: "Independently verified through authorized academic evaluation.",
        updatedAt: now,
      })
      .where(eq(evidenceItems.id, request.evidenceId));

    // Record auditable journey event
    await createJourneyEventRecord(request.requesterPersonId, {
      type: "verification_completed",
      title: "Evidence verified",
      description: `"${evidence.subject}" was independently verified via ${method}.`,
      relatedEntityId: request.id,
      metadata: {
        evidenceId: evidence.id,
        subject: evidence.subject,
        decisionId: decisionRecord.id,
        method,
      },
    });
  } else if (decision === "changes_requested") {
    await db
      .update(evidenceItems)
      .set({
        verificationStatus: "changes_requested",
        updatedAt: now,
      })
      .where(eq(evidenceItems.id, request.evidenceId));

    // Record auditable journey event
    await createJourneyEventRecord(request.requesterPersonId, {
      type: "verification_changes_requested",
      title: "Changes requested on verification",
      description: `Reviewer requested updates for "${evidence.subject}": ${reason}`,
      relatedEntityId: request.id,
      metadata: {
        evidenceId: evidence.id,
        subject: evidence.subject,
        decisionId: decisionRecord.id,
        reason,
      },
    });
  } else if (decision === "rejected") {
    // Rejection means: submitted artifact was not accepted as sufficient verification.
    // DOES NOT mean skill is weak or absent!
    await db
      .update(evidenceItems)
      .set({
        verificationStatus: "rejected",
        interpretation:
          "Submitted evidence was not accepted as sufficient verification. This indicates the artifact did not meet verification criteria, not personal inability.",
        updatedAt: now,
      })
      .where(eq(evidenceItems.id, request.evidenceId));

    // Record auditable journey event
    await createJourneyEventRecord(request.requesterPersonId, {
      type: "verification_rejected",
      title: "Verification not accepted",
      description: `Submitted evidence for "${evidence.subject}" was not accepted: ${reason}`,
      relatedEntityId: request.id,
      metadata: {
        evidenceId: evidence.id,
        subject: evidence.subject,
        decisionId: decisionRecord.id,
        reason,
      },
    });
  }

  return { decision: decisionRecord, updatedRequest };
}

/**
 * Resubmits a verification request after changes were requested.
 * Preserves all prior decision history in verification_decisions.
 */
export async function resubmitEvidenceVerification(params: {
  requesterPersonId: string;
  requestId: string;
  supportingReference?: string;
  studentNotes?: string;
}): Promise<VerificationRequestRecord> {
  const { requesterPersonId, requestId, supportingReference, studentNotes } = params;

  const request = await getVerificationRequestById(requestId);
  if (!request) {
    throw new VerificationError("Verification request not found.", 404);
  }

  if (request.requesterPersonId !== requesterPersonId) {
    throw new VerificationError("You cannot resubmit a request that does not belong to you.", 403);
  }

  if (request.status !== "changes_requested") {
    throw new VerificationError(
      `Cannot resubmit request with status "${request.status}". Only requests with "changes_requested" status can be resubmitted.`,
      400
    );
  }

  const updatedReq = await resubmitVerificationRequest({
    requestId,
    supportingReference,
    studentNotes,
  });

  const db = await getDb();
  await db
    .update(evidenceItems)
    .set({
      verificationStatus: "verification_requested",
      sourceReference: supportingReference?.trim() || undefined,
      updatedAt: new Date(),
    })
    .where(eq(evidenceItems.id, request.evidenceId));

  // Record journey event
  await createJourneyEventRecord(requesterPersonId, {
    type: "verification_resubmitted",
    title: "Verification resubmitted",
    description: `Updated supporting details and resubmitted verification request.`,
    relatedEntityId: requestId,
    metadata: {
      requestId,
      supportingReference,
    },
  });

  return updatedReq;
}
