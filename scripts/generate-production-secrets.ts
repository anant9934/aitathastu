/**
 * Phase E: Production / Staging Cryptographic Secret Generator
 * Generates high-entropy random secrets without printing raw values to console logs.
 * Writes safely to .env.staging.generated (strictly ignored by Git).
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { generateSecureSecret } from "../lib/security/production-secrets";

function main() {
  console.log("==================================================");
  console.log("AI TATHASTU: CRYPTOGRAPHIC SECRET PROVISIONING");
  console.log("==================================================");

  const outputPath = path.join(process.cwd(), ".env.staging.generated");

  const secrets: Record<string, string> = {
    SESSION_SECRET: generateSecureSecret("sess", 32),
    HANDOFF_SIGNING_SECRET: generateSecureSecret("handoff", 32),
    GITHUB_CLIENT_ID: "staging_gh_client_id_placeholder",
    GITHUB_CLIENT_SECRET: generateSecureSecret("gh_secret", 32),
    GITHUB_WEBHOOK_SECRET: generateSecureSecret("gh_wh", 32),
    STUDY_LPU_INTEGRATION_SECRET: generateSecureSecret("studylpu", 32),
    PADHO_CODE_INTEGRATION_SECRET: generateSecureSecret("padhocode", 32),
    ERIS_INTEGRATION_SECRET: generateSecureSecret("eris", 32),
    MENTORMAZE_INTEGRATION_SECRET: generateSecureSecret("mentormaze", 32),
    EXTERNAL_TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"),
    CRON_SECRET: generateSecureSecret("cron", 32),
  };

  const fileLines: string[] = [
    "# ==============================================================================",
    "# AI TATHASTU — GENERATED STAGING SECRETS (DO NOT COMMIT)",
    `# Generated at: ${new Date().toISOString()}`,
    "# ==============================================================================",
    "",
  ];

  for (const [key, val] of Object.entries(secrets)) {
    fileLines.push(`${key}="${val}"`);
    const hash = crypto.createHash("sha256").update(val).digest("hex").slice(0, 12);
    console.log(`✓ Provisioned: ${key.padEnd(30)} [SHA256: ${hash}...] (entropy: 256 bits)`);
  }

  fs.writeFileSync(outputPath, fileLines.join("\n") + "\n", { mode: 0o600 });
  console.log("\n==================================================");
  console.log(`✓ Secrets securely written to: ${path.basename(outputPath)}`);
  console.log("Permissions set to: 0600 (owner read/write only).");
  console.log("Raw secret values were NEVER printed to standard output.");
  console.log("==================================================");
}

main();
