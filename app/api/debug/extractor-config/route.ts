/**
 * GET /api/debug/extractor-config
 *
 * Safe, non-secret runtime check — only shows whether env vars are SET,
 * never their values. Confirms Render connectivity AND auth token validity.
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
  const token = (
    process.env.EXTRACTOR_API_TOKEN ||
    process.env.RESUME_EXTRACTOR_SERVICE_API_KEY ||
    ""
  ).trim();

  const hasUrl = Boolean(renderUrl);
  const hasToken = Boolean(token);

  // 1. Unauthenticated health check (wakes Render from sleep)
  let renderPing: "ok" | "error" | "not_configured" = "not_configured";
  let renderStatus = 0;
  let renderMs = 0;

  // 2. Authenticated test: GET a non-existent document
  //    - 404 = token is VALID (Render accepted auth, but doc doesn't exist)
  //    - 401 = token is WRONG (token mismatch between Vercel and Render)
  let authTest: "valid_token" | "invalid_token" | "not_configured" | "error" = "not_configured";
  let authStatus = 0;

  if (hasUrl) {
    const base = renderUrl.replace(/\/+$/, "");

    // Health ping
    const t0 = Date.now();
    try {
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(10000),
      });
      renderStatus = res.status;
      renderPing = res.ok ? "ok" : "error";
    } catch {
      renderPing = "error";
    }
    renderMs = Date.now() - t0;

    // Auth test (only if health is ok and we have a token)
    if (hasToken && renderPing === "ok") {
      try {
        const authRes = await fetch(`${base}/api/resumes/probe-auth-test-id`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-User-Id": "debug-probe",
            "X-User-Role": "admin",
          },
          signal: AbortSignal.timeout(8000),
        });
        authStatus = authRes.status;
        // 404 = auth passed (doc not found), 401/403 = auth failed
        authTest = authRes.status === 404 ? "valid_token"
          : authRes.status === 401 || authRes.status === 403 ? "invalid_token"
          : "valid_token"; // 200/other also means auth passed
      } catch {
        authTest = "error";
      }
    }
  }

  const verdict =
    !hasUrl ? "❌ RESUME_EXTRACTOR_URL not set in Vercel — OCR fallback disabled"
    : !hasToken ? "❌ EXTRACTOR_API_TOKEN not set in Vercel — auth will fail"
    : renderPing !== "ok" ? "⚠️ Render health check failed — cold start or wrong URL"
    : authTest === "invalid_token" ? "❌ TOKEN MISMATCH — Vercel token doesn't match Render EXTRACTOR_API_TOKEN. Copy the token from Render dashboard and update Vercel env vars."
    : authTest === "valid_token" ? "✅ Render OCR fallback fully operational"
    : "⚠️ Auth test inconclusive — check Render logs";

  return NextResponse.json({
    env: {
      RESUME_EXTRACTOR_URL: hasUrl ? `${renderUrl.slice(0, 35)}…` : "❌ NOT SET",
      EXTRACTOR_API_TOKEN: hasToken ? "✅ SET" : "❌ NOT SET",
    },
    render: {
      healthPing: renderPing,
      healthHttpStatus: renderStatus,
      healthLatencyMs: renderMs,
      authTest,
      authHttpStatus: authStatus,
    },
    verdict,
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
  });
}
