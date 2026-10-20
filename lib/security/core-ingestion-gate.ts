/**
 * Production ingestion gates — kept intentionally narrow per domain.
 *
 * CV upload gate (resumeIngestionReady): requires SESSION_SECRET,
 *   HANDOFF_SIGNING_SECRET, EXTERNAL_TOKEN_ENCRYPTION_KEY.
 *   It has NO dependency on GITHUB_WEBHOOK_SECRET; coupling them caused
 *   every CV upload to fail whenever GitHub webhook credentials were rotated.
 *
 * GitHub gate (githubIngestionReady): requires the CV gate secrets PLUS
 *   GITHUB_WEBHOOK_SECRET (needed to verify webhook payloads from GitHub).
 *
 * coreIngestionReady() = githubIngestionReady() for backwards compatibility
 * with callers that gate both resume and GitHub behind the full set.
 */
import { auditProductionSecrets } from "./production-secrets";

/** Secrets required for CV upload only — no GitHub dependency. */
export const RESUME_GATE_SECRETS = [
  "SESSION_SECRET",
  "HANDOFF_SIGNING_SECRET",
  "EXTERNAL_TOKEN_ENCRYPTION_KEY",
] as const;

/** Additional secrets required for GitHub OAuth / webhook operations. */
export const GITHUB_GATE_EXTRA_SECRETS = [
  "GITHUB_WEBHOOK_SECRET",
] as const;

/** Full set (resume + GitHub) — kept for backwards compatibility. */
export const CORE_INGESTION_GATE_SECRETS = [
  ...RESUME_GATE_SECRETS,
  ...GITHUB_GATE_EXTRA_SECRETS,
] as const;

function describeGate(
  secrets: readonly string[],
  env: NodeJS.ProcessEnv,
): string[] {
  if (env.NODE_ENV !== "production") return [];
  const reasons: string[] = [];
  if (env.CORE_INGESTION_SECURITY_APPROVED !== "true") {
    reasons.push('CORE_INGESTION_SECURITY_APPROVED is not set to "true" in this deployment');
  }
  const insecure = new Set(auditProductionSecrets(env).insecureDefaults.map((name) => name.split(" ")[0]));
  for (const key of secrets) {
    const value = env[key];
    if (!value) reasons.push(`${key} is missing`);
    else if (value.length < 32) reasons.push(`${key} is shorter than 32 characters`);
    else if (insecure.has(key)) reasons.push(`${key} uses a known insecure placeholder`);
  }
  return reasons;
}

/** Reasons the CV-upload gate is closed. Empty = open. */
export function describeResumeIngestionGate(env: NodeJS.ProcessEnv = process.env): string[] {
  return describeGate(RESUME_GATE_SECRETS, env);
}

/** Reasons the GitHub gate is closed (superset of CV gate). Empty = open. */
export function describeCoreIngestionGate(env: NodeJS.ProcessEnv = process.env): string[] {
  return describeGate(CORE_INGESTION_GATE_SECRETS, env);
}

/** CV upload and non-GitHub footprint imports are allowed. */
export function resumeIngestionReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return describeResumeIngestionGate(env).length === 0;
}

/** GitHub OAuth, webhook verification, and GitHub imports are allowed. */
export function githubIngestionReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return describeCoreIngestionGate(env).length === 0;
}

/** Backwards-compatible alias for githubIngestionReady. */
export function coreIngestionReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return githubIngestionReady(env);
}
