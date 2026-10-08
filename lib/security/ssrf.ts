/**
 * Server-Side Request Forgery (SSRF) Defense for Phase D production readiness.
 * Blocks outbound server requests to private IP ranges, loopback, link-local,
 * and cloud instance metadata services (AWS/GCP/Azure).
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254", // Cloud Instance Metadata Service (AWS, GCP, Azure)
  "metadata.google.internal",
  "instance-data",
]);

/**
 * Checks if an IPv4 string belongs to a private or link-local subnet.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;

  // 10.0.0.0/8 (Private)
  if (parts[0] === 10) return true;

  // 172.16.0.0/12 (Private)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (parts[0] === 192 && parts[1] === 168) return true;

  // 169.254.0.0/16 (Link-local / Cloud metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;

  // 0.0.0.0/8 (Current network)
  if (parts[0] === 0) return true;

  return false;
}

/**
 * Validates whether an external URL is safe to fetch from server-side.
 */
export function validateSafeUrl(urlString: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(urlString);

    // Only allow HTTP/HTTPS
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { safe: false, reason: `Protocol '${parsed.protocol}' is forbidden.` };
    }

    // In production, force HTTPS
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      return { safe: false, reason: "Insecure HTTP protocol is forbidden in production." };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check blocked hostnames
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return { safe: false, reason: `Access to internal host '${hostname}' is prohibited.` };
    }

    // Check private IP ranges
    if (isPrivateIPv4(hostname)) {
      return { safe: false, reason: `Access to private IP range '${hostname}' is prohibited.` };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Invalid or malformed URL string." };
  }
}
