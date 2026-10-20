import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import {
  extractLinkedInProfile,
  pollLinkedInRun,
  getLinkedInExtractionConfig,
} from "@/lib/services/apify-linkedin-service";
import { getExternalConnectionByProvider } from "@/lib/repositories/connection-repository";

export const runtime = "nodejs";
export const maxDuration = 35;

/** GET — check extraction config or poll a queued run. */
export async function GET(request: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const cfg = getLinkedInExtractionConfig();
  if (!cfg.configured) {
    return NextResponse.json({
      ok: true,
      status: "not_configured",
      message: cfg.reason,
    });
  }

  // Check for a queued run to poll
  const conn = await getExternalConnectionByProvider(auth.person.id, "linkedin").catch(() => null);
  const meta = conn?.metadata as Record<string, unknown> | null ?? {};
  const runId = typeof meta.extractionRunId === "string" ? meta.extractionRunId : null;
  const actorId = typeof meta.extractionActorId === "string" ? meta.extractionActorId : cfg.actorId;
  const profileUrl = conn?.profileUrl;
  const extractionStatus = typeof meta.extractionStatus === "string" ? meta.extractionStatus : null;

  if (runId && (extractionStatus === "extraction_queued" || extractionStatus === "extracting") && profileUrl && actorId) {
    const result = await pollLinkedInRun({
      personId: auth.person.id,
      runId,
      profileUrl,
      actorId,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  // No active run — return current status from metadata
  return NextResponse.json({
    ok: true,
    status: extractionStatus ?? "not_started",
    configured: cfg.configured,
    lastExtractedAt: typeof meta.lastExtractedAt === "string" ? meta.lastExtractedAt : null,
    recordsPersisted: typeof meta.extractionRecordCount === "number" ? meta.extractionRecordCount : 0,
  });
}

/** POST — start or re-trigger an extraction run. */
async function POST_handler(request: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const limit = await checkRateLimitDistributed(auth.person.id, "sync");
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests. Wait before retrying." }, { status: 429 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const profileUrl = typeof body.profileUrl === "string" ? body.profileUrl.trim() : "";
  if (!profileUrl) {
    return NextResponse.json({ error: "profileUrl is required." }, { status: 400 });
  }

  const requestId = request.headers.get("idempotency-key")?.trim().slice(0, 120) ?? undefined;
  const result = await extractLinkedInProfile({ profileUrl, personId: auth.person.id, requestId });

  if (result.status === "not_configured") {
    return NextResponse.json({ ok: false, ...result }, { status: 503 });
  }
  if (result.status === "failed") {
    return NextResponse.json({ ok: false, ...result }, { status: 422 });
  }
  return NextResponse.json({ ok: true, ...result });
}

export const POST = withStudentCacheInvalidation(POST_handler);
