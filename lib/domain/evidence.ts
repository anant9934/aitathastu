export type EvidenceSource =
  | "self_reported"
  | "resume_extracted"
  | "institutional"
  | "imported"
  | "verified"
  | "ai_inferred"; // Future-compatible type only; do not generate in Phase 3.

export type VerificationStatus =
  | "unverified"
  | "self_reported"
  | "imported"
  | "verification_requested"
  | "under_review"
  | "verified"
  | "rejected"
  | "changes_requested";

export type EvidenceCategory =
  | "skill"
  | "education"
  | "experience"
  | "goal"
  | "project"
  | "assessment"
  | "interview"
  | "other";

export type EvidenceItem = {
  id: string;
  category: EvidenceCategory;
  subject: string;
  value: string;
  source: EvidenceSource;
  verificationStatus: VerificationStatus;
  observedAt: string;
  createdAt: string;
  interpretation: string;
  whyItMatters: string;
  sourceReference?: string | null;
  verifiedByPersonId?: string | null;
  verifiedAt?: string | null;
  verificationMethod?: string | null;
  verificationDecisionId?: string | null;
};

export type EvidenceSummary = {
  availableItems: EvidenceItem[];
  selfReportedItems: EvidenceItem[];
  unknownAreas: string[];
  totalRecorded: number;
};

export function getSourceLabel(source: EvidenceSource): string {
  switch (source) {
    case "resume_extracted":
      return "Resume extracted";
    case "self_reported":
      return "Self-reported";
    case "institutional":
      return "Institutional record";
    case "imported":
      return "Imported record";
    case "verified":
      return "Independently verified";
    case "ai_inferred":
      return "AI inferred (experimental)";
    default:
      return "Unspecified source";
  }
}

export function getVerificationStatusLabel(status: VerificationStatus): string {
  switch (status) {
    case "unverified":
      return "Unverified";
    case "self_reported":
      return "Self-reported";
    case "imported":
      return "Imported";
    case "verification_requested":
      return "Verification requested";
    case "under_review":
      return "Under review";
    case "verified":
      return "Verified";
    case "rejected":
      return "Not accepted";
    case "changes_requested":
      return "Changes requested";
    default:
      return "Unverified";
  }
}

export function defaultInterpretation(
  category: EvidenceCategory,
  source: EvidenceSource,
  verificationStatus: VerificationStatus
): string {
  if (verificationStatus === "verified") {
    return "Independently verified through external evidence, project review, or direct faculty evaluation.";
  }
  if (verificationStatus === "verification_requested") {
    return "Submitted for independent verification review. Pending reviewer evaluation.";
  }
  if (verificationStatus === "under_review") {
    return "Currently under review by an authorized verifier.";
  }
  if (verificationStatus === "changes_requested") {
    return "Verifier requested additional details or supporting references before completing review.";
  }
  if (verificationStatus === "rejected") {
    return "Submitted evidence was not accepted as sufficient verification. This indicates the artifact did not meet verification criteria, not personal inability.";
  }
  if (source === "resume_extracted") {
    return "Extracted from your uploaded resume. This indicates self-reported exposure, not verified proficiency or peer review.";
  }
  if (verificationStatus === "self_reported") {
    return "Entered directly by you. Helpful for direction, but not independently verified.";
  }
  return "Recorded as unverified information in your local journey.";
}

export function createEvidenceItem(params: {
  id?: string;
  category: EvidenceCategory;
  subject: string;
  value: string;
  source: EvidenceSource;
  verificationStatus: VerificationStatus;
  observedAt?: string;
  createdAt?: string;
  interpretation?: string;
  whyItMatters?: string;
  sourceReference?: string | null;
  verifiedByPersonId?: string | null;
  verifiedAt?: string | null;
  verificationMethod?: string | null;
  verificationDecisionId?: string | null;
}): EvidenceItem {
  const now = new Date().toISOString();
  return {
    id: params.id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    category: params.category,
    subject: params.subject.trim(),
    value: params.value.trim(),
    source: params.source,
    verificationStatus: params.verificationStatus,
    observedAt: params.observedAt || now,
    createdAt: params.createdAt || now,
    interpretation: params.interpretation || defaultInterpretation(params.category, params.source, params.verificationStatus),
    whyItMatters: params.whyItMatters || "Provides context for goal alignment and gap detection.",
    sourceReference: params.sourceReference || null,
    verifiedByPersonId: params.verifiedByPersonId || null,
    verifiedAt: params.verifiedAt || null,
    verificationMethod: params.verificationMethod || null,
    verificationDecisionId: params.verificationDecisionId || null,
  };
}


export function summarizeEvidence(evidence: EvidenceItem[], unknownDimensions: string[] = []): EvidenceSummary {
  // Available evidence: facts explicitly known and reviewed (e.g. active goal, entered education)
  const availableItems = evidence.filter(
    (e) => e.category === "goal" || e.category === "education"
  );

  // Self-reported or unverified items (e.g. skills extracted from resume or entered manually)
  const selfReportedItems = evidence.filter(
    (e) => e.verificationStatus === "unverified" || e.verificationStatus === "self_reported"
  );

  return {
    availableItems,
    selfReportedItems,
    unknownAreas: unknownDimensions,
    totalRecorded: evidence.length,
  };
}
