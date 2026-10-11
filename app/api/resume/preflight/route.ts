/**
 * GET /api/resume/preflight
 *
 * Public, unauthenticated, read-only check of the resume-ingestion gate.
 * Exposes no secret values — only whether the gate is open, and which
 * CV-specific configuration categories are preventing it.
 *
 * Ecosystem integrations (LPU, PadhoCode, ERIS, MentorMaze) are irrelevant
 * to resume upload and must not affect this response.
 */

import { NextResponse } from "next/server";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The minimum set of secrets genuinely required for secure CV ingestion.
// Ecosystem module secrets are intentionally excluded.
const CV_INGESTION_REQUIRED = [
  "SESSION_SECRET",
  "HANDOFF_SIGNING_SECRET",
  "GITHUB_WEBHOOK_SECRET",
  "EXTERNAL_TOKEN_ENCRYPTION_KEY",
] as const;

const CV_INSECURE_DEFAULTS: Record<string, string[]> = {
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
};

function auditCvIngestionSecrets(): { missingRequired: string[]; insecureOrShort: string[] } {
  const missingRequired: string[] = [];
  const insecureOrShort: string[] = [];
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return { missingRequired, insecureOrShort };

  for (const key of CV_INGESTION_REQUIRED) {
    const val = process.env[key];
    if (!val || val.trim() === "") {
      missingRequired.push(key);
      continue;
    }
    if ((CV_INSECURE_DEFAULTS[key] || []).includes(val)) {
      insecureOrShort.push(`${key} (uses known insecure placeholder)`);
    } else if (val.length < 32) {
      insecureOrShort.push(`${key} (length ${val.length} < 32 chars)`);
    }
  }
  return { missingRequired, insecureOrShort };
}

export async function GET() {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  const ready = coreIngestionReady();

  // Pre-warm the Render OCR service in the background.
  // The preflight is called before the file picker, so by the time the user
  // picks a file and uploads, Render has already woken from cold-start sleep.
  const renderUrl = (process.env.RESUME_EXTRACTOR_URL || process.env.RESUME_EXTRACTOR_SERVICE_URL || "").trim();
  let renderReady = false;
  if (renderUrl) {
    try {
      const warmRes = await fetch(`${renderUrl.replace(/\/+$/, "")}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(8000), // don't block preflight more than 8s
      });
      renderReady = warmRes.ok;
    } catch {
      renderReady = false; // Render sleeping — user will experience cold-start delay
    }
  }

  if (ready) {
    return NextResponse.json({ ready: true, renderReady }, { headers });
  }

  // Build a CV-scoped, secret-safe failure summary for operators.
  const audit = auditCvIngestionSecrets();
  const failureCategories: string[] = [];

  if (process.env.CORE_INGESTION_SECURITY_APPROVED !== "true") {
    failureCategories.push("CORE_INGESTION_SECURITY_APPROVED is not set to \"true\" in this deployment");
  }
  if (audit.missingRequired.length > 0) {
    failureCategories.push(
      `Missing CV-ingestion secrets: ${audit.missingRequired.join(", ")}`
    );
  }
  if (audit.insecureOrShort.length > 0) {
    failureCategories.push(
      `Insecure or short CV-ingestion secrets: ${audit.insecureOrShort.join(", ")}`
    );
  }

  return NextResponse.json(
    {
      ready: false,
      renderReady,
      reason:
        "Resume upload is temporarily unavailable. You can still enter your details manually.",
      // Sanitised — key names only, no values. Ecosystem integrations excluded.
      failureCategories,
    },
    { status: 503, headers }
  );
}
