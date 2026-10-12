/**
 * Best-effort client IP for rate limiting.
 *
 * On Netlify, `x-nf-client-connection-ip` is set by the edge and cannot be
 * spoofed by the client. Elsewhere the first `x-forwarded-for` hop is used;
 * that header is client-controlled, so it is only a speed bump there.
 */
export function getClientIp(request: Request): string {
  const netlify = request.headers.get("x-nf-client-connection-ip");
  if (netlify) return netlify.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
