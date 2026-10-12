/**
 * AI TATHASTU — CANONICAL APPLICATION ORIGIN RESOLVER
 *
 * Ensures consistent canonical origins across Google and GitHub OAuth flows.
 * Handles Netlify deployments, Vercel proxies, custom domains, and local development.
 *
 * Priority order:
 *   1. Request x-forwarded-host header (most accurate in serverless)
 *   2. APP_BASE_URL (explicit override — always wins in production)
 *   3. Netlify URL env vars (set automatically by Netlify runtime)
 *   4. Vercel URL env var (set automatically by Vercel runtime)
 *   5. Hardcoded production fallback
 *   6. Localhost for local development
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

  // Netlify: URL is the canonical deploy URL (production or branch deploy)
  // DEPLOY_URL is the unique URL for every individual deploy
  const netlifyUrl = process.env.URL?.trim() || process.env.DEPLOY_URL?.trim();
  if (netlifyUrl && netlifyUrl.startsWith("https://")) {
    return netlifyUrl.replace(/\/$/, "");
  }

  // Vercel: VERCEL_PROJECT_PRODUCTION_URL is set on Vercel deployments
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`.replace(/\/$/, "");
  }

  if (isProduction) {
    return "https://www.aitathastu.com";
  }

  return envUrl ? envUrl.replace(/\/$/, "") : "http://localhost:3000";
}

