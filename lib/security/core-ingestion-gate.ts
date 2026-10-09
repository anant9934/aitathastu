/**
 * Production ingestion stays closed until an operator revokes disclosed keys,
 * installs replacements in every deployed secret store, and certifies the gate.
 */
import { auditProductionSecrets } from "./production-secrets";

export function coreIngestionReady(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  const audit = auditProductionSecrets(env);
  return env.CORE_INGESTION_SECURITY_APPROVED === "true" &&
    Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32) &&
    Boolean(env.HANDOFF_SIGNING_SECRET && env.HANDOFF_SIGNING_SECRET.length >= 32) &&
    Boolean(env.GITHUB_WEBHOOK_SECRET && env.GITHUB_WEBHOOK_SECRET.length >= 32) &&
    Boolean(env.EXTERNAL_TOKEN_ENCRYPTION_KEY && env.EXTERNAL_TOKEN_ENCRYPTION_KEY.length >= 32) &&
    !audit.insecureDefaults.some((name) => /^(SESSION_SECRET|HANDOFF_SIGNING_SECRET|GITHUB_WEBHOOK_SECRET|EXTERNAL_TOKEN_ENCRYPTION_KEY)/.test(name));
}
