/**
 * AI TATHASTU — CANONICAL DATA PROVENANCE & SOURCE STATES
 * 
 * V4.4: Canonical provenance contract, multi-dimensional source state separation,
 * and review/verification lifecycle definitions.
 */

export type SourceStateType =
  | "PROFILE_DISCOVERED"
  | "PROFILE_LINKED"
  | "DATA_IMPORTING"
  | "DATA_IMPORTED"
  | "ACCOUNT_AUTHENTICATED"
  | "STUDENT_CONFIRMED"
  | "INDEPENDENTLY_VERIFIED"
  | "SYNC_FAILED"
  | "DISCONNECTED";

export type ClaimCategory =
  | "skill"
  | "project"
  | "education"
  | "experience"
  | "achievement"
  | "certification"
  | "goal"
  | "publication";

export type ReviewStatus =
  | "pending_review"
  | "candidate"
  | "student_confirmed"
  | "rejected"
  | "disputed";

export type CanonicalVerificationStatus =
  | "unverified"
  | "self_reported"
  | "faculty_verified"
  | "assessment_verified"
  | "externally_attributed";

export interface CanonicalProvenanceRecord {
  sourceType: "resume" | "github" | "portfolio" | "linkedin" | "leetcode" | "codechef" | "hackerrank" | "self_reported" | "system";
  sourceExternalId?: string;
  sourceRecordId?: string;
  sourceUrl?: string;
  observedAt: string;
  lastSyncedAt?: string;
  claimType: ClaimCategory;
  reviewStatus: ReviewStatus;
  verificationStatus: CanonicalVerificationStatus;
  evidenceRefs?: string[];
  personId: string;
  recordVersion?: number;
}

export interface MultiDimensionalConnectionState {
  discoveryState: "PROFILE_DISCOVERED" | "PROFILE_LINKED";
  ingestionState: "IDLE" | "DATA_IMPORTING" | "DATA_IMPORTED" | "SYNC_FAILED" | "DISCONNECTED";
  authIdentityState: "UNAUTHENTICATED" | "ACCOUNT_AUTHENTICATED";
  studentConfirmationState: "UNCONFIRMED" | "STUDENT_CONFIRMED";
  independentVerificationState: "UNVERIFIED" | "INDEPENDENTLY_VERIFIED";
  lastSyncedAt?: string | null;
  recordsCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Normalizes multi-dimensional connection status from external connection metadata and status.
 */
export function resolveMultiDimensionalState(params: {
  status: string;
  externalAccountId?: string | null;
  metadata?: Record<string, unknown> | null;
}): MultiDimensionalConnectionState {
  const meta = params.metadata || {};
  const isAuth = Boolean(params.externalAccountId || meta.authenticatedIdentity === true);
  const isImported = params.status === "connected" || meta.connectionState === "PUBLIC_DATA_IMPORTED";
  const isSyncing = params.status === "syncing" || meta.connectionState === "DATA_IMPORTING";
  const isFailed = params.status === "needs_attention" || params.status === "unavailable";
  const isDisconnected = params.status === "disconnected";

  return {
    discoveryState: meta.discoveredFromResume ? "PROFILE_DISCOVERED" : "PROFILE_LINKED",
    ingestionState: isDisconnected
      ? "DISCONNECTED"
      : isSyncing
      ? "DATA_IMPORTING"
      : isFailed
      ? "SYNC_FAILED"
      : isImported
      ? "DATA_IMPORTED"
      : "IDLE",
    authIdentityState: isAuth ? "ACCOUNT_AUTHENTICATED" : "UNAUTHENTICATED",
    studentConfirmationState: meta.studentConfirmed === true ? "STUDENT_CONFIRMED" : "UNCONFIRMED",
    independentVerificationState: meta.verifiedByFaculty === true ? "INDEPENDENTLY_VERIFIED" : "UNVERIFIED",
    lastSyncedAt: (meta.lastSuccessfulSync as string) || null,
    recordsCount: (meta.importedRepoCount as number) || 0,
    metadata: meta,
  };
}
