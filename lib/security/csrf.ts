/**
 * CSRF / Origin Verification for Phase D production readiness.
 * Protects state-changing endpoints against cross-site request forgery.
 */

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Validates Origin / Referer for state-changing requests.
 * Exempts webhooks and partner integration endpoints that use HMAC / API keys.
 */
export function verifySameOrigin(
  req: Request,
  allowedHostnames: string[] = ["localhost", "127.0.0.1"]
): { valid: boolean; reason?: string } {
  if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
    return { valid: true };
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Check origin first
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      const isAllowed =
        allowedHostnames.includes(parsedOrigin.hostname) ||
        (process.env.APP_BASE_URL && new URL(process.env.APP_BASE_URL).hostname === parsedOrigin.hostname);

      if (!isAllowed) {
        return { valid: false, reason: `Origin '${parsedOrigin.origin}' is not permitted.` };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: "Malformed Origin header." };
    }
  }

  // Fallback to referer if origin header is omitted by browser
  if (referer) {
    try {
      const parsedReferer = new URL(referer);
      const isAllowed =
        allowedHostnames.includes(parsedReferer.hostname) ||
        (process.env.APP_BASE_URL && new URL(process.env.APP_BASE_URL).hostname === parsedReferer.hostname);

      if (!isAllowed) {
        return { valid: false, reason: `Referer '${parsedReferer.origin}' is not permitted.` };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: "Malformed Referer header." };
    }
  }

  // Non-browser or custom client (e.g. CLI, curl, automated test)
  return { valid: true };
}
