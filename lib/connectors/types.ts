/**
 * AI TATHASTU — DIGITAL FOOTPRINT CONNECTOR FOUNDATION V4.0
 *
 * Unified contracts, capability matrix, and trust boundary definitions
 * for all external developer, research, and professional identity sources.
 */

export type AcquisitionMode =
  | "OFFICIAL_OAUTH_API"
  | "OFFICIAL_PUBLIC_API"
  | "APPROVED_PARTNER_API"
  | "PERMITTED_PUBLIC_METADATA"
  | "AUTHORIZED_USER_EXPORT"
  | "MANUAL_PROFILE_REFERENCE"
  | "UNSUPPORTED";

export type AuthMethod =
  | "oauth_app"
  | "github_app"
  | "user_export_upload"
  | "signed_token"
  | "public_url"
  | "none";

export type RefreshMethod =
  | "webhook"
  | "scheduled"
  | "on_demand"
  | "manual_upload";

export type TrustBoundary =
  | "PROFILE_LINKED"
  | "PUBLIC_RECORD_FETCHED"
  | "ACCOUNT_AUTHORIZED"
  | "STUDENT_CONFIRMED"
  | "DOCUMENTED_EVIDENCE"
  | "INDEPENDENTLY_VERIFIED";

export type ProviderDisplayStatus =
  | "Not Connected"
  | "Found in your resume"
  | "Profile Linked"
  | "Connected"
  | "Importing"
  | "Import Completed"
  | "Review Required"
  | "Import Failed"
  | "Permission Required"
  | "Disconnected"
  | "Unsupported";

export interface ProviderCapabilities {
  providerId: string;
  displayName: string;
  category: "code" | "portfolio" | "professional" | "competitive" | "research" | "writing";
  acquisitionMode: AcquisitionMode;
  authMethod: AuthMethod;
  realTimeCapable: boolean;
  refreshMethod: RefreshMethod;
  dataTypesAllowed: string[];
  supportedFields: string[];
  trustLevel: "self_reported" | "unverified" | "institution_verified";
  userConsentRequired: boolean;
  retentionPolicy: string;
}

export interface ProfileValidationResult {
  valid: boolean;
  username: string;
  normalizedUrl: string;
  error?: string;
  detectedIdentifier?: string;
}

export interface NormalizedProjectRecord {
  title: string;
  description?: string;
  technologies: string[];
  url?: string;
  sourceType: "github" | "huggingface" | "kaggle" | "portfolio" | "other";
  sourceReference: string;
  starsOrLikes?: number;
  forksOrDownloads?: number;
  metadata?: Record<string, unknown>;
}

export interface NormalizedEvidenceRecord {
  category: "project" | "skill" | "experience" | "education" | "research" | "writing" | "other";
  subject: string;
  value: string;
  sourceReference: string;
  interpretation: string;
  whyItMatters: string;
  trustBoundary: TrustBoundary;
  metadata?: Record<string, unknown>;
}

export interface NormalizedSourceRecords {
  providerId: string;
  externalUsername: string;
  profileUrl: string;
  displayName?: string;
  projects?: NormalizedProjectRecord[];
  evidence?: NormalizedEvidenceRecord[];
  rawMetadata?: Record<string, unknown>;
}

export interface SyncResult {
  success: boolean;
  providerId: string;
  acquisitionMode: AcquisitionMode;
  trustBoundary: TrustBoundary;
  recordsFetched: number;
  recordsChanged: number;
  summary: string;
  error?: string;
  normalized?: NormalizedSourceRecords;
}

export interface StudentSourceConnector {
  providerId: string;
  getCapabilities(): ProviderCapabilities;
  validateProfile(input: string): ProfileValidationResult;
  normalize(raw: unknown): NormalizedSourceRecords;
}
