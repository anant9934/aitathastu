import { NextResponse } from "next/server";
import { processErisEvent } from "@/lib/services/integration-processor-service";

/**
 * POST /api/integrations/eris/events
 * Ingestion endpoint for ERIS Assessment platform.
 * Requires X-Integration-Key header.
 */
export async function POST(req: Request) {
  try {
    const rawKey =
      req.headers.get("x-integration-key") ||
      req.headers.get("X-Integration-Key") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(
        { status: "rejected", error: "Malformed JSON body." },
        { status: 400 }
      );
    }

    const result = await processErisEvent({ rawKey, payload });
    return NextResponse.json(result.data, { status: result.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error during ERIS event ingestion.";
    console.error("[ERIS Ingestion Error]", message);
    return NextResponse.json({ status: "failed", error: message }, { status: 500 });
  }
}
