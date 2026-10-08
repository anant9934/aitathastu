import crypto from "crypto";

export interface ProductionSecretAuditResult {
  valid: boolean;
  environment: "development" | "staging" | "production";
  missingRequired: string[];
  insecureDefaults: string[];
  warnings: string[];
}

const REQUIRED_PRODUCTION_SECRETS = [
  "SESSION_SECRET",
  "HANDOFF_SIGNING_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_WEBHOOK_SECRET",
  "STUDY_LPU_INTEGRATION_SECRET",
  "PADHO_CODE_INTEGRATION_SECRET",
  "ERIS_INTEGRATION_SECRET",
  "MENTORMAZE_INTEGRATION_SECRET",
  "DATABASE_URL",
];

const KNOWN_INSECURE_DEFAULTS: Record<string, string[]> = {
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
 * Validates that all required production secrets are configured and free of placeholder/dev defaults.
 */
export function auditProductionSecrets(
  env: Record<string, string | undefined> = process.env
): ProductionSecretAuditResult {
  const nodeEnv = env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";
  const isStaging = env.APP_ENV === "staging" || env.VERCEL_ENV === "preview";
  const environment = isProd ? "production" : isStaging ? "staging" : "development";

  const missingRequired: string[] = [];
  const insecureDefaults: string[] = [];
  const warnings: string[] = [];

  for (const secretKey of REQUIRED_PRODUCTION_SECRETS) {
    const val = env[secretKey];
    if (!val || val.trim() === "") {
      if (isProd) {
        missingRequired.push(secretKey);
      } else {
        warnings.push(`Missing ${secretKey} in ${environment} mode.`);
      }
      continue;
    }

    // Check for known insecure default values
    const insecureList = KNOWN_INSECURE_DEFAULTS[secretKey] || [];
    if (insecureList.includes(val)) {
      if (isProd) {
        insecureDefaults.push(secretKey);
      } else {
        warnings.push(`${secretKey} is using a development default value.`);
      }
    }

    // Check minimum length for cryptographic secrets
    if (
      ["SESSION_SECRET", "HANDOFF_SIGNING_SECRET", "GITHUB_WEBHOOK_SECRET"].includes(secretKey) &&
      val.length < 32
    ) {
      if (isProd) {
        insecureDefaults.push(`${secretKey} (length < 32 chars)`);
      } else {
        warnings.push(`${secretKey} should be at least 32 characters in production.`);
      }
    }
  }

  // LLM Key check
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
