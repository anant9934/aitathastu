/**
 * GET /api/resume/preflight
 *
 * Public, read-only check of the resume-ingestion gate. Exposes no secret
 * values: only whether the gate is open and, if not, which env var names are
 * blocking it (from the same function the gate itself uses).
 *
 * Also pings the extractor's /health so a sleeping Render instance starts
 * waking before the student picks a file. One short GET with a 5s timeout,
 * so it cannot be used to amplify load.
 */

import { NextResponse } from "next/server";
import { describeCoreIngestionGate } from "@/lib/security/core-ingestion-gate";
import { ExtractorServiceClient } from "@/lib/services/extractor-service-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  const failureCategories = describeCoreIngestionGate();

  const scannedPdfSupported = ExtractorServiceClient.isConfigured();
  let renderReady = false;
  if (scannedPdfSupported) {
    renderReady = await ExtractorServiceClient.checkHealth().then(() => true, () => false);
  }

  if (failureCategories.length === 0) {
    return NextResponse.json({ ready: true, renderReady, scannedPdfSupported }, { headers });
  }
  return NextResponse.json(
    {
      ready: false,
      renderReady,
      scannedPdfSupported,
      reason: "Resume upload is temporarily unavailable. You can still enter your details manually.",
      failureCategories,
    },
    { status: 503, headers }
  );
}
