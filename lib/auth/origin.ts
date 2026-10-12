/**
 * Canonical application origin, used for OAuth redirect URIs and other absolute links.
 *
 * Production uses APP_BASE_URL only. Request headers (Host,
 * X-Forwarded-Host) are client-influenced, and an OAuth redirect_uri built
 * from them can be pointed at another host. In development, where
 * APP_BASE_URL is often unset, the request's own host is an acceptable fallback.
 */
export function getCanonicalOrigin(req?: Request): string {
  const envUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    if (!envUrl) throw new Error("APP_BASE_URL must be set in production.");
    return envUrl;
  }
  if (envUrl) return envUrl;
  const host = req?.headers.get("host");
  return host ? `http://${host}` : "http://localhost:3000";
}
