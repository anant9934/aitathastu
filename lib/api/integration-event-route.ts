import { NextResponse } from "next/server";

type EventProcessor = (input: { rawKey: string | null; payload: unknown }) => Promise<{ status: number; data: unknown }>;

/**
 * Builds the POST handler shared by every partner ingestion endpoint
 * (/api/integrations/{partner}/events). Partners authenticate with the
 * X-Integration-Key header (or a Bearer token); the processor validates it.
 */
export function integrationEventRoute(partnerLabel: string, process: EventProcessor) {
  return async function POST(req: Request) {
    try {
      const rawKey =
        req.headers.get("x-integration-key") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        null;

      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        return NextResponse.json({ status: "rejected", error: "Malformed JSON body." }, { status: 400 });
      }

      const result = await process({ rawKey, payload });
      return NextResponse.json(result.data, { status: result.status });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Internal server error during ${partnerLabel} event ingestion.`;
      console.error(`[${partnerLabel} Ingestion Error]`, message);
      return NextResponse.json({ status: "failed", error: message }, { status: 500 });
    }
  };
}
