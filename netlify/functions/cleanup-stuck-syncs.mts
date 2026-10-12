/**
 * Netlify scheduled function (schedule in netlify.toml): daily maintenance.
 *
 * Deliberately thin: it calls the app's own cron route, which holds the
 * logic (stuck sync runs, stuck processing jobs, stale guest purge) and is
 * also callable from any external cron. The request is awaited, so the work
 * finishes before this function returns.
 */
export default async function handler(): Promise<Response> {
  const base = (process.env.APP_BASE_URL || process.env.URL || "").replace(/\/+$/, "");
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!base || !secret) {
    console.error("[cleanup-stuck-syncs] APP_BASE_URL (or URL) and CRON_SECRET must be set");
    return new Response("misconfigured", { status: 500 });
  }
  const res = await fetch(`${base}/api/cron/cleanup-stuck-syncs`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(25_000),
  });
  const body = await res.text();
  console.log(`[cleanup-stuck-syncs] ${res.status} ${body.slice(0, 500)}`);
  return new Response(body, { status: res.status });
}
