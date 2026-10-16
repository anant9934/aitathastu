/**
 * Canonical application origin, used for OAuth redirect URIs and other absolute links.
 *
 * Production uses APP_BASE_URL only. Request headers (Host,
 * X-Forwarded-Host) are client-influenced, and an OAuth redirect_uri built
 * from them can be pointed at another host.
 *
 * Outside production, a request arriving on a loopback host (localhost,
 * 127.0.0.1, [::1]) uses that host even when APP_BASE_URL is set: the .env
 * shared with production points APP_BASE_URL at the deployed site, and
 * sending a local developer's OAuth round trip there was BUG #3. Loopback
 * hosts cannot redirect anyone else's browser, so trusting them is safe.
 */
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;

export function getCanonicalOrigin(req?: Request): string {
  const envUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    if (!envUrl) throw new Error("APP_BASE_URL must be set in production.");
    return envUrl;
  }
  const forwarded = req?.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = req?.headers.get("host")?.trim();
  const local = [forwarded, host].find((h): h is string => Boolean(h && LOOPBACK.test(h)));
  if (local) return `http://${local}`;
  if (envUrl) return envUrl;
  return host ? `http://${host}` : "http://localhost:3000";
}
