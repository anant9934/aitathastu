import { NextResponse, type NextRequest } from "next/server";
import { verifySameOrigin } from "@/lib/security/csrf";

/**
 * CSRF protection for the JSON API. The session cookie is SameSite=Lax, which
 * still allows some cross-site requests, so every state-changing /api request
 * from a browser must carry an Origin (or Referer) matching APP_BASE_URL.
 * Server-to-server endpoints authenticate with HMAC or a bearer secret instead
 * and are exempt.
 */
const EXEMPT_PREFIXES = ["/api/integrations/", "/api/cron/"];

export function middleware(request: NextRequest) {
  if (EXEMPT_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p))) return NextResponse.next();
  const check = verifySameOrigin(request);
  if (!check.valid) {
    return NextResponse.json({ ok: false, code: "CSRF_REJECTED", error: "Cross-site request rejected." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
