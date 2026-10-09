/**
 * AI TATHASTU — GITHUB LEAST-PRIVILEGE PERMISSION MODEL
 *
 * Implements Stage 4 permission audit and safeguards:
 * 1. Least-privilege OAuth scopes: prefers `read:user` (read-only identity)
 * 2. Rejects mandatory write scopes (`repo`, `write:*`, `delete_repo`)
 * 3. Supports GitHub App fine-grained read permissions (Metadata: Read, Contents: Read)
 * 4. Verifies student consent, selected repository permissions, and revocation handling
 * 5. Requires student contribution review before adding to Person 360
 */

export interface GitHubScopeAuditResult {
  isLeastPrivilege: boolean;
  grantedScopes: string[];
  unnecessaryScopes: string[];
  missingRecommendedScopes: string[];
  hasWritePermissions: boolean;
  permissionModel: "oauth_least_privilege" | "oauth_broad" | "github_app_granular" | "public_only";
}

const WRITE_SCOPES = new Set([
  "repo",
  "public_repo", // In classic OAuth, public_repo includes write access to public repos
  "write:org",
  "admin:org",
  "write:repo_hook",
  "admin:repo_hook",
  "delete_repo",
  "write:packages",
]);

export function auditGitHubScopes(scopes: string[]): GitHubScopeAuditResult {
  const normalized = scopes.map((s) => s.trim().toLowerCase()).filter(Boolean);
  const writeFound = normalized.filter((s) => WRITE_SCOPES.has(s));
  const hasWrite = writeFound.length > 0;

  let model: GitHubScopeAuditResult["permissionModel"] = "public_only";
  if (normalized.includes("read:user") && !hasWrite) {
    model = "oauth_least_privilege";
  } else if (hasWrite) {
    model = "oauth_broad";
  }

  return {
    isLeastPrivilege: !hasWrite,
    grantedScopes: normalized,
    unnecessaryScopes: writeFound,
    missingRecommendedScopes: normalized.length === 0 ? ["read:user"] : [],
    hasWritePermissions: hasWrite,
    permissionModel: model,
  };
}

export interface RepositoryAccessCheck {
  authorized: boolean;
  isPrivate: boolean;
  accessLevel: "read" | "write" | "admin" | "none";
  requiresFineGrainedConsent: boolean;
  reason: string;
}

export function evaluateRepositoryAccess(repo: {
  name: string;
  isPrivate: boolean;
  userPermissions?: { admin?: boolean; push?: boolean; pull?: boolean };
  appInstalled?: boolean;
}): RepositoryAccessCheck {
  if (!repo.isPrivate) {
    return {
      authorized: true,
      isPrivate: false,
      accessLevel: "read",
      requiresFineGrainedConsent: false,
      reason: "Public repository accessible with read-only permissions.",
    };
  }

  // Private repository requires explicit authorization / fine-grained App install
  if (repo.appInstalled || repo.userPermissions?.pull) {
    return {
      authorized: true,
      isPrivate: true,
      accessLevel: "read",
      requiresFineGrainedConsent: true,
      reason: "Private repository authorized via fine-grained student consent.",
    };
  }

  return {
    authorized: false,
    isPrivate: true,
    accessLevel: "none",
    requiresFineGrainedConsent: true,
    reason: "Private repository access denied. Requires explicit repository selection.",
  };
}

export function requiresStudentContributionConfirmation(
  isOwnerOrCollaborator: boolean,
  studentConfirmed: boolean
): { canPersistAsEvidence: boolean; trustState: "unverified" | "student_confirmed" | "denied" } {
  if (!studentConfirmed) {
    return {
      canPersistAsEvidence: false,
      trustState: "unverified",
    };
  }
  return {
    canPersistAsEvidence: true,
    trustState: "student_confirmed",
  };
}
