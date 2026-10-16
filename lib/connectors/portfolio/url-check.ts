/**
 * Client- and server-safe public URL validator without Node-only builtins (dns, https).
 */

function isIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

function isIpv6(host: string): boolean {
  return host.includes(":") && /^[0-9a-fA-F:]+$/.test(host);
}

export function isSafePublicUrl(rawUrl: string): { safe: boolean; reason?: string; parsed?: URL } {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") {
      return { safe: false, reason: "Only HTTPS portfolio URLs are supported." };
    }
    const hostname = parsed.hostname.toLowerCase();
    const hostWithoutBrackets = hostname.replace(/^\[/, "").replace(/\]$/, "");
    if (
      isIpv4(hostWithoutBrackets) ||
      isIpv6(hostWithoutBrackets) ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "localhost.localdomain" ||
      hostname.endsWith(".localdomain") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal"
    ) {
      return { safe: false, reason: "Private, internal, or loopback network addresses are strictly forbidden." };
    }
    if (parsed.port && parsed.port !== "443") {
      return { safe: false, reason: "Non-standard network ports are forbidden." };
    }
    if (parsed.username || parsed.password) {
      return { safe: false, reason: "Portfolio URLs cannot contain credentials." };
    }
    return { safe: true, parsed };
  } catch {
    return { safe: false, reason: "Malformed URL provided." };
  }
}
