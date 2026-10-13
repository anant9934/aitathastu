/**
 * Production ingestion stays closed until an operator revokes disclosed keys,
 * installs replacements in every deployed secret store, and certifies the gate.
 *
 * In production, CV upload (and GitHub import) return 503 unless ALL of these hold:
 *   CORE_INGESTION_SECURITY_APPROVED=true
 *   SESSION_SECRET, HANDOFF_SIGNING_SECRET, GITHUB_WEBHOOK_SECRET,
 *   EXTERNAL_TOKEN_ENCRYPTION_KEY each set, >= 32 chars, not a known placeholder.
 */
import { auditProductionSecrets } from "./production-secrets";

export const CORE_INGESTION_GATE_SECRETS = [
  "SESSION_SECRET",
  "HANDOFF_SIGNING_SECRET",
  "GITHUB_WEBHOOK_SECRET",
  "EXTERNAL_TOKEN_ENCRYPTION_KEY",
] as const;

/** Human-readable reasons the gate is closed, by env var name only (never values). Empty when open. */
export function describeCoreIngestionGate(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const reasons: string[] = [];
  if (env.CORE_INGESTION_SECURITY_APPROVED !== "true") {
    reasons.push('CORE_INGESTION_SECURITY_APPROVED is not set to "true" in this deployment');
  }
  const insecure = new Set(auditProductionSecrets(env).insecureDefaults.map((name) => name.split(" ")[0]));
  for (const key of CORE_INGESTION_GATE_SECRETS) {
    const value = env[key];
    if (!value) reasons.push(`${key} is missing`);
    else if (value.length < 32) reasons.push(`${key} is shorter than 32 characters`);
    else if (insecure.has(key)) reasons.push(`${key} uses a known insecure placeholder`);
  }
  return reasons;
}

export function coreIngestionReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return describeCoreIngestionGate(env).length === 0;
}
