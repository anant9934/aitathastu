/**
 * GET /api/debug/extractor-config
 *
 * Safe, non-secret runtime check — only shows whether env vars are SET,
 * never their values. Confirms Render connectivity from Vercel's servers.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const renderUrl = (
    process.env.RESUME_EXTRACTOR_URL ||
    process.env.RESUME_EXTRACTOR_SERVICE_URL ||
    ""
  ).trim();

  const hasUrl = Boolean(renderUrl);
  const hasToken = Boolean(
    process.env.EXTRACTOR_API_TOKEN ||
    process.env.RESUME_EXTRACTOR_SERVICE_API_KEY
  );

  let renderPing: "ok" | "error" | "not_configured" = "not_configured";
  let renderStatus = 0;
  let renderMs = 0;

  if (hasUrl) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${renderUrl.replace(/\/+$/, "")}/health`, {
        signal: AbortSignal.timeout(10000),
      });
      renderStatus = res.status;
      renderPing = res.ok ? "ok" : "error";
    } catch (e) {
      renderPing = "error";
      renderStatus = 0;
    }
    renderMs = Date.now() - t0;
  }

  return NextResponse.json({
    env: {
      RESUME_EXTRACTOR_URL: hasUrl ? `${renderUrl.slice(0, 30)}…` : "❌ NOT SET",
      EXTRACTOR_API_TOKEN: hasToken ? "✅ SET" : "❌ NOT SET",
    },
    render: {
      ping: renderPing,
      httpStatus: renderStatus,
      latencyMs: renderMs,
    },
    verdict:
      hasUrl && hasToken && renderPing === "ok"
        ? "✅ Render OCR fallback will work"
        : !hasUrl
        ? "❌ RESUME_EXTRACTOR_URL not set in Vercel — fallback disabled"
        : !hasToken
        ? "❌ EXTRACTOR_API_TOKEN not set in Vercel — auth will fail"
        : "⚠️ Render URL set but health check failed — cold start or wrong URL",
  });
}
