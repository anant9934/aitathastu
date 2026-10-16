/**
 * CSRF / Origin Verification for Phase D production readiness.
 * Protects state-changing endpoints against cross-site request forgery.
 */

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Validates Origin / Referer for state-changing requests.
 *
 * A request is same-origin when its Origin (or Referer) host is the host the
 * request was actually sent to (the Host header), or the configured
 * APP_BASE_URL host. Browsers never let a page on another site forge either
 * header, so Origin == Host is a sound same-origin proof. Without it, any
 * domain alias of the deployment that isn't byte-for-byte APP_BASE_URL was
 * rejected: production's APP_BASE_URL is https://www.aitathastu.com while
 * www 301-redirects to the apex, so every sign-in on aitathastu.com got a
 * 403 CSRF_REJECTED.
 *
 * Exempts webhooks and partner integration endpoints that use HMAC / API keys.
 */
export function verifySameOrigin(
  req: Request,
  allowedHostnames: string[] = process.env.NODE_ENV === "production" ? [] : ["localhost", "127.0.0.1"]
): { valid: boolean; reason?: string } {
  if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
    return { valid: true };
  }

  const allowed = new Set(allowedHostnames.map((h) => h.toLowerCase()));
  try {
    if (process.env.APP_BASE_URL) allowed.add(new URL(process.env.APP_BASE_URL).hostname.toLowerCase());
  } catch { /* a malformed APP_BASE_URL adds nothing */ }
  const host = req.headers.get("host")?.trim().toLowerCase().replace(/:\d+$/, "");
  if (host) allowed.add(host);

  const check = (value: string, kind: "Origin" | "Referer") => {
    try {
      const parsed = new URL(value);
      return allowed.has(parsed.hostname.toLowerCase())
        ? { valid: true }
        : { valid: false, reason: `${kind} '${parsed.origin}' is not permitted.` };
    } catch {
      return { valid: false, reason: `Malformed ${kind} header.` };
    }
  };

  const origin = req.headers.get("origin");
  if (origin) return check(origin, "Origin");
  // Fallback to referer if origin header is omitted by browser
  const referer = req.headers.get("referer");
  if (referer) return check(referer, "Referer");

  // Non-browser or custom client (e.g. CLI, curl, automated test)
  return { valid: true };
}
