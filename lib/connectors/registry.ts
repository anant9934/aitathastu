export type ConnectorPolicy = {
  source: string;
  displayName: string;
  allowedAcquisitionMethod: "api" | "oauth" | "webhook" | "upload" | "signed_server" | "profile_reference";
  authMethod: "oauth_app" | "user_upload" | "signed_token" | "public_url" | "none";
  realTimeCapable: boolean;
  refreshMethod: "webhook" | "on_demand" | "manual" | "scheduled";
  dataTypesAllowed: string[];
  trustLevel: "self_reported" | "unverified" | "institution_verified";
  userConsentRequired: boolean;
  retentionPolicy: string;
};

export const CONNECTOR_POLICIES: Record<string, ConnectorPolicy> = {
  github: {
    source: "github",
    displayName: "GitHub",
    allowedAcquisitionMethod: "api",
    authMethod: "oauth_app",
    realTimeCapable: true,
    refreshMethod: "on_demand",
    dataTypesAllowed: ["repositories", "topics", "languages", "readme_summary", "activity_metadata"],
    trustLevel: "unverified",
    userConsentRequired: true,
    retentionPolicy: "Repository metadata and detected technologies; no full codebase cloning.",
  },
  resume: {
    source: "resume",
    displayName: "Resume (PDF/DOCX)",
    allowedAcquisitionMethod: "upload",
    authMethod: "user_upload",
    realTimeCapable: false,
    refreshMethod: "manual",
    dataTypesAllowed: ["education", "skills", "projects", "certifications", "work_history"],
    trustLevel: "unverified",
    userConsentRequired: true,
    retentionPolicy: "Extracted candidate text and unverified claims; raw upload discarded after processing.",
  },
  linkedin: {
    source: "linkedin",
    displayName: "LinkedIn",
    allowedAcquisitionMethod: "profile_reference",
    authMethod: "public_url",
    realTimeCapable: false,
    refreshMethod: "manual",
    dataTypesAllowed: ["profile_url", "user_reported_headline"],
    trustLevel: "self_reported",
    userConsentRequired: true,
    retentionPolicy: "Profile URL reference only. No unauthorized automated scraping.",
  },
  leetcode: {
    source: "leetcode",
    displayName: "LeetCode",
    allowedAcquisitionMethod: "profile_reference",
    authMethod: "public_url",
    realTimeCapable: false,
    refreshMethod: "manual",
    dataTypesAllowed: ["profile_url", "username"],
    trustLevel: "self_reported",
    userConsentRequired: true,
    retentionPolicy: "Username reference only until official signed API is available.",
  },
  codechef: {
    source: "codechef",
    displayName: "CodeChef",
    allowedAcquisitionMethod: "profile_reference",
    authMethod: "public_url",
    realTimeCapable: false,
    refreshMethod: "manual",
    dataTypesAllowed: ["profile_url", "username"],
    trustLevel: "self_reported",
    userConsentRequired: true,
    retentionPolicy: "Username reference only.",
  },
  hackerrank: {
    source: "hackerrank",
    displayName: "HackerRank",
    allowedAcquisitionMethod: "profile_reference",
    authMethod: "public_url",
    realTimeCapable: false,
    refreshMethod: "manual",
    dataTypesAllowed: ["profile_url", "username"],
    trustLevel: "self_reported",
    userConsentRequired: true,
    retentionPolicy: "Username reference only.",
  },
  hackerearth: {
    source: "hackerearth",
    displayName: "HackerEarth",
    allowedAcquisitionMethod: "profile_reference",
    authMethod: "public_url",
    realTimeCapable: false,
    refreshMethod: "manual",
    dataTypesAllowed: ["profile_url", "username"],
    trustLevel: "self_reported",
    userConsentRequired: true,
    retentionPolicy: "Username reference only.",
  },
  eris: {
    source: "eris",
    displayName: "ERIS Assessment",
    allowedAcquisitionMethod: "signed_server",
    authMethod: "signed_token",
    realTimeCapable: true,
    refreshMethod: "webhook",
    dataTypesAllowed: ["assessment_attempt", "topic_score", "rubric_band"],
    trustLevel: "institution_verified",
    userConsentRequired: true,
    retentionPolicy: "Verified assessment records and institutional evaluation audit logs.",
  },
  mentormaze: {
    source: "mentormaze",
    displayName: "MentorMaze Interview Intelligence",
    allowedAcquisitionMethod: "signed_server",
    authMethod: "signed_token",
    realTimeCapable: true,
    refreshMethod: "webhook",
    dataTypesAllowed: ["interview_session", "dimension_scores", "reasoning_feedback"],
    trustLevel: "unverified",
    userConsentRequired: true,
    retentionPolicy: "Session-specific performance feedback. No permanent trait diagnosis.",
  },
  padho_code: {
    source: "padho_code",
    displayName: "Padho Code",
    allowedAcquisitionMethod: "signed_server",
    authMethod: "signed_token",
    realTimeCapable: true,
    refreshMethod: "webhook",
    dataTypesAllowed: ["practice_topics", "challenge_progress", "problem_count"],
    trustLevel: "self_reported",
    userConsentRequired: true,
    retentionPolicy: "Coding practice activity context. Solved counts are not verified mastery.",
  },
  study_lpu: {
    source: "study_lpu",
    displayName: "Study LPU",
    allowedAcquisitionMethod: "signed_server",
    authMethod: "signed_token",
    realTimeCapable: true,
    refreshMethod: "webhook",
    dataTypesAllowed: ["course_modules", "syllabus_topics", "study_progress"],
    trustLevel: "self_reported",
    userConsentRequired: true,
    retentionPolicy: "Academic study context. Completion does not imply verified proficiency.",
  },
};

export function getConnectorPolicy(source: string): ConnectorPolicy | null {
  return CONNECTOR_POLICIES[source] || null;
}
