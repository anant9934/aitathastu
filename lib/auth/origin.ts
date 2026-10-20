/**
 * Canonical application origin, used for OAuth redirect URIs and other absolute links.
 *
 * Production uses APP_BASE_URL. Request headers (Host, X-Forwarded-Host) are
 * client-influenced, and an OAuth redirect_uri built from them can be pointed
 * at another host, so they never decide it.
 *
 * APP_BASE_URL is checked against the production domain Vercel itself reports
 * for the project (VERCEL_PROJECT_PRODUCTION_URL, set by the platform, not by
 * a request). A stale value, such as an old *.vercel.app alias whose
 * deployment no longer exists, sent every GitHub and Google sign-in to a
 * DEPLOYMENT_NOT_FOUND page. When the two disagree, the platform's production
 * domain wins and a diagnostic is logged naming the fix. www and the apex
 * count as the same site, so an APP_BASE_URL matching an OAuth app's
 * registered www (or apex) callback is kept.
 *
 * Outside production, a request arriving on a loopback host (localhost,
 * 127.0.0.1, [::1]) uses that host even when APP_BASE_URL is set: the .env
 * shared with production points APP_BASE_URL at the deployed site, and
 * sending a local developer's OAuth round trip there was BUG #3. Loopback
 * hosts cannot redirect anyone else's browser, so trusting them is safe.
 */
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;

export type OriginResolution = { origin: string; source: "APP_BASE_URL" | "VERCEL_PROJECT_PRODUCTION_URL" | "request" | "default"; problem?: string };

/** An absolute https origin (no path, query or credentials), or null. */
export function parseOrigin(value: string | undefined | null, { requireHttps }: { requireHttps: boolean }): string | null {
  const raw = value?.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (u.username || u.password || (u.pathname && u.pathname !== "/") || u.search || u.hash) return null;
    if (requireHttps ? u.protocol !== "https:" : !/^https?:$/.test(u.protocol)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

const siteKey = (origin: string) => new URL(origin).hostname.toLowerCase().replace(/^www\./, "");

export function resolveCanonicalOrigin(env: NodeJS.ProcessEnv = process.env, req?: Request): OriginResolution {
  if (env.NODE_ENV === "production") {
    const configured = parseOrigin(env.APP_BASE_URL, { requireHttps: true });
    // Vercel's own record of this project's production domain; only meaningful on production deployments.
    const platform = env.VERCEL_ENV === "production" ? parseOrigin(env.VERCEL_PROJECT_PRODUCTION_URL, { requireHttps: true }) : null;
    if (configured && (!platform || siteKey(configured) === siteKey(platform))) return { origin: configured, source: "APP_BASE_URL" };
    if (platform) {
      return {
        origin: platform,
        source: "VERCEL_PROJECT_PRODUCTION_URL",
        problem: configured
          ? `APP_BASE_URL (${new URL(configured).host}) is not this project's production domain (${new URL(platform).host}). Set APP_BASE_URL=${platform} in the Vercel project's Production environment and redeploy.`
          : `APP_BASE_URL is ${env.APP_BASE_URL ? "not a valid https origin" : "missing"}. Set APP_BASE_URL=${platform} in the Vercel project's Production environment and redeploy.`,
      };
    }
    throw new Error(
      env.APP_BASE_URL
        ? "APP_BASE_URL must be an https origin such as https://www.aitathastu.com (no path)."
        : "APP_BASE_URL must be set in production (e.g. https://www.aitathastu.com).",
    );
  }
  const forwarded = req?.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = req?.headers.get("host")?.trim();
  const local = [forwarded, host].find((h): h is string => Boolean(h && LOOPBACK.test(h)));
  if (local) return { origin: `http://${local}`, source: "request" };
  const configured = parseOrigin(env.APP_BASE_URL, { requireHttps: false });
  if (configured) return { origin: configured, source: "APP_BASE_URL" };
  return host ? { origin: `http://${host}`, source: "request" } : { origin: "http://localhost:3000", source: "default" };
}

let reported = "";
export function getCanonicalOrigin(req?: Request): string {
  const resolved = resolveCanonicalOrigin(process.env, req);
  if (resolved.problem && resolved.problem !== reported) {
    reported = resolved.problem;
    console.error(`[config] ${resolved.problem}`);
  }
  return resolved.origin;
}

/**
 * Redirect to a path on whatever host the browser is on, as a relative
 * Location (RFC 9110). For hops between our own routes and back to the
 * student's page the browser must stay where it is (its session cookie lives
 * there). The browser resolves the path against its own address, so neither
 * APP_BASE_URL nor any request header (Host, X-Forwarded-Host, request.url)
 * decides it. Only OAuth redirect_uris use the canonical origin.
 */
export function sameHostRedirect(path: string, status: 302 | 303 | 307 = 307): Response {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("sameHostRedirect takes an absolute path on this site.");
  return new Response(null, { status, headers: { Location: path, "Cache-Control": "no-store" } });
}
