import crypto from "crypto";

export interface ProductionSecretAuditResult {
  valid: boolean;
  environment: "development" | "staging" | "production";
  missingRequired: string[];
  insecureDefaults: string[];
  warnings: string[];
}

/**
 * Secrets required for CV ingestion to operate securely.
 * These are the ONLY secrets that can block resume upload.
 */
const CORE_INGESTION_SECRETS = [
  "SESSION_SECRET",
  "HANDOFF_SIGNING_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_WEBHOOK_SECRET",
  "EXTERNAL_TOKEN_ENCRYPTION_KEY",
  "CRON_SECRET",
  "DATABASE_URL",
] as const;

/**
 * Secrets for ecosystem integrations (LPU, PadhoCode, ERIS, MentorMaze).
 * Validated separately — missing/insecure values here produce warnings,
 * NOT errors, and cannot block CV upload or the ingestion gate.
 */
const ECOSYSTEM_INTEGRATION_SECRETS = [
  "STUDY_LPU_INTEGRATION_SECRET",
  "PADHO_CODE_INTEGRATION_SECRET",
  "ERIS_INTEGRATION_SECRET",
  "MENTORMAZE_INTEGRATION_SECRET",
] as const;

const KNOWN_INSECURE_DEFAULTS: Record<string, string[]> = {
  CRON_SECRET: [
    "b7a775fbf56a4587dc79bb1039d9ce3a",
    "cron-secret",
    "secret",
    "change-me",
  ],
  SESSION_SECRET: ["dev-session-secret", "secret", "change-me", "password123"],
  HANDOFF_SIGNING_SECRET: [
    "tathastu_handoff_secret_key_prod_default",
    "dev-handoff-secret",
    "secret",
  ],
  GITHUB_WEBHOOK_SECRET: [
    "aitathastu_gh_webhook_secret",
    "dev_webhook_secret",
    "secret",
  ],
  EXTERNAL_TOKEN_ENCRYPTION_KEY: ["change-me", "secret", "replace-with-random-key"],
  STUDY_LPU_INTEGRATION_SECRET: [
    "study_lpu_sec_key_tathastu_dev_2026",
    "dev_key",
  ],
  PADHO_CODE_INTEGRATION_SECRET: [
    "padho_code_sec_key_tathastu_dev_2026",
    "dev_key",
  ],
  ERIS_INTEGRATION_SECRET: [
    "eris_live_sec_key_tathastu_dev_2026",
    "dev_key",
  ],
  MENTORMAZE_INTEGRATION_SECRET: [
    "mentormaze_sec_key_tathastu_dev_2026",
    "dev_key",
  ],
};


/**
 * Validates production secrets. Core ingestion secrets are mandatory;
 * ecosystem integration secrets are advisory (warnings only).
 */
export function auditProductionSecrets(
  env: Record<string, string | undefined> = process.env
): ProductionSecretAuditResult {
  const nodeEnv = env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";
  // Vercel sets VERCEL_ENV to "preview" for non-production preview deployments.
  const isStaging = env.APP_ENV === "staging" || env.VERCEL_ENV === "preview";
  const environment = isProd ? "production" : isStaging ? "staging" : "development";

  const missingRequired: string[] = [];
  const insecureDefaults: string[] = [];
  const warnings: string[] = [];

  const cryptoLengthKeys = new Set([
    "SESSION_SECRET",
    "HANDOFF_SIGNING_SECRET",
    "GITHUB_WEBHOOK_SECRET",
    "EXTERNAL_TOKEN_ENCRYPTION_KEY",
    "CRON_SECRET",
  ]);

  // --- Core ingestion secrets (errors in production) ---
  for (const secretKey of CORE_INGESTION_SECRETS) {
    const val = env[secretKey];
    if (!val || val.trim() === "") {
      if (isProd) {
        missingRequired.push(secretKey);
      } else {
        warnings.push(`Missing ${secretKey} in ${environment} mode.`);
      }
      continue;
    }
    const insecureList = KNOWN_INSECURE_DEFAULTS[secretKey] || [];
    if (insecureList.includes(val)) {
      if (isProd) insecureDefaults.push(secretKey);
      else warnings.push(`${secretKey} is using a development default value.`);
    }
    if (cryptoLengthKeys.has(secretKey) && val.length < 32) {
      if (isProd) insecureDefaults.push(`${secretKey} (length < 32 chars)`);
      else warnings.push(`${secretKey} should be at least 32 characters in production.`);
    }
  }

  // --- Ecosystem integration secrets (advisory warnings only — never block the gate) ---
  for (const secretKey of ECOSYSTEM_INTEGRATION_SECRETS) {
    const val = env[secretKey];
    if (!val || val.trim() === "") {
      warnings.push(`Ecosystem secret ${secretKey} not configured — its integration will be disabled.`);
      continue;
    }
    const insecureList = KNOWN_INSECURE_DEFAULTS[secretKey] || [];
    if (insecureList.includes(val)) {
      warnings.push(`Ecosystem secret ${secretKey} is using a development placeholder value.`);
    }
  }

  // LLM Key check — advisory only
  const hasLlmKey = Boolean(
    env.GEMINI_API_KEYS ||
    env.GROQ_API_KEYS ||
    env.OPENROUTER_API_KEYS ||
    env.CEREBRAS_API_KEYS ||
    env.MISTRAL_API_KEYS ||
    env.SAMBANOVA_API_KEYS
  );
  if (!hasLlmKey) {
    warnings.push("No LLM provider keys configured; system operates in deterministic offline mode.");
  }

  // OCR extractor — advisory: text PDFs/DOCX still work without it, scanned PDFs do not.
  if (!env.RESUME_EXTRACTOR_URL?.trim()) {
    warnings.push("RESUME_EXTRACTOR_URL not configured — scanned PDFs will fail with OCR_SERVICE_NOT_CONFIGURED.");
  } else if (!env.EXTRACTOR_API_TOKEN?.trim()) {
    warnings.push("RESUME_EXTRACTOR_URL is set but EXTRACTOR_API_TOKEN is missing — extractor calls will be rejected.");
  }
  if (env.NEXT_PUBLIC_RENDER_EXTRACTOR_URL && !env.RESUME_EXTRACTOR_URL?.trim()) {
    warnings.push("NEXT_PUBLIC_RENDER_EXTRACTOR_URL is no longer read; move its value to RESUME_EXTRACTOR_URL.");
  }

  const valid = missingRequired.length === 0 && insecureDefaults.length === 0;

  return {
    valid,
    environment,
    missingRequired,
    insecureDefaults,
    warnings,
  };
}


/**
 * Generates a high-entropy cryptographically secure token.
 */
export function generateSecureSecret(prefix: string = "sec", bytes: number = 32): string {
  return `${prefix}_${crypto.randomBytes(bytes).toString("hex")}`;
}
