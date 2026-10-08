import { NextResponse } from "next/server";
import { getEcosystemIntegrationStatus } from "@/lib/monitoring/integration-status";
import { getServerAuthContext } from "@/lib/auth/server-session";

export const runtime = "nodejs";

/**
 * GET /api/internal/integrations-status
 * Internal administrative/operational probe returning integration health & certification states.
 * Rejects unauthorized non-faculty/non-coordinator access in production mode.
 */
export async function GET() {
  try {
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      const auth = await getServerAuthContext();
      if (!auth) {
        return NextResponse.json({ error: "Forbidden: Operational access required." }, { status: 403 });
      }
    }

    const report = await getEcosystemIntegrationStatus();
    return NextResponse.json(report, {
      status: report.overallHealth === "healthy" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
