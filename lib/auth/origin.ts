/**
 * AI TATHASTU — CANONICAL APPLICATION ORIGIN RESOLVER
 *
 * Ensures consistent canonical origins across Google and GitHub OAuth flows.
 * Handles production Vercel proxies, custom domains, and local development.
 */

export function getCanonicalOrigin(req?: Request): string {
  const isProduction = process.env.NODE_ENV === "production";

  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || (isProduction ? "https" : "http");
    if (forwardedHost) {
      if (!isProduction || !forwardedHost.includes("localhost")) {
        return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
      }
    }
  }

  const envUrl = process.env.APP_BASE_URL?.trim();
  if (envUrl && (!isProduction || !envUrl.includes("localhost"))) {
    return envUrl.replace(/\/$/, "");
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`.replace(/\/$/, "");
  }

  if (isProduction) {
    return "https://www.aitathastu.com";
  }

  return envUrl ? envUrl.replace(/\/$/, "") : "http://localhost:3000";
}
