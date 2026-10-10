/**
 * GET /api/resume/preflight
 *
 * Returns the readiness of the resume ingestion pipeline.
 * This is a public, unauthenticated, read-only check — it
 * exposes no secret values, only whether the gate is open
 * and which configuration categories are failing.
 *
 * Screen5ResumeUpload probes this on mount to show an honest
 * "ready / blocked" state before the student tries to upload.
 */

import { NextResponse } from "next/server";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { auditProductionSecrets } from "@/lib/security/production-secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ready = coreIngestionReady();
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };

  if (ready) {
    return NextResponse.json({ ready: true }, { headers });
  }

  // Report categories of failure, never secret values.
  const audit = auditProductionSecrets();
  const failureCategories: string[] = [];
  if (audit.missingRequired.length > 0) {
    failureCategories.push(`Missing required configuration: ${audit.missingRequired.join(", ")}`);
  }
  if (audit.insecureDefaults.length > 0) {
    failureCategories.push(`Insecure placeholder values: ${audit.insecureDefaults.join(", ")}`);
  }
  if (process.env.CORE_INGESTION_SECURITY_APPROVED !== "true") {
    failureCategories.push("CORE_INGESTION_SECURITY_APPROVED is not set to true");
  }

  return NextResponse.json(
    {
      ready: false,
      reason:
        "Resume upload is temporarily unavailable. You can still enter your details manually.",
      failureCategories,
    },
    { status: 503, headers }
  );
}
