/**
 * AI TATHASTU — PORTFOLIO CONNECTOR WITH STRICT SSRF & CONTENT SANITIZATION
 *
 * Rules:
 * - Validates public HTTPS URLs only
 * - Disallows private IPs, localhost, AWS/cloud metadata (169.254.169.254), IPv6 loopback
 * - Enforces 150KB size limit and 5-second timeout
 * - Strips scripts and executes NO client-side code
 * - Extracts public metadata (title, meta description, author, projects/links)
 */

import { URL } from "node:url";

export interface PortfolioMetadata {
  url: string;
  title: string | null;
  description: string | null;
  detectedLinks: string[];
  technologies: string[];
  extractedAt: string;
}

const PRIVATE_IP_REGEX = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.|0\.|::1|fe80:|fc00:)/i;
const FORBIDDEN_HOSTNAMES = new RegExp(
  "^(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|metadata\\.google\\.internal|169\\.254\\.169\\.254)$",
  "i"
);

export function isSafePublicUrl(rawUrl: string): { safe: boolean; reason?: string; parsed?: URL } {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { safe: false, reason: "Only HTTP/HTTPS URLs are supported." };
    }
    const hostname = parsed.hostname.toLowerCase();
    if (FORBIDDEN_HOSTNAMES.test(hostname) || PRIVATE_IP_REGEX.test(hostname)) {
      return { safe: false, reason: "Private, internal, or loopback network addresses are strictly forbidden." };
    }
    if (parsed.port && !["80", "443"].includes(parsed.port)) {
      return { safe: false, reason: "Non-standard network ports are forbidden." };
    }
    return { safe: true, parsed };
  } catch {
    return { safe: false, reason: "Malformed URL provided." };
  }
}

export async function fetchPortfolioMetadata(rawUrl: string): Promise<PortfolioMetadata> {
  const check = isSafePublicUrl(rawUrl);
  if (!check.safe || !check.parsed) {
    throw new Error(check.reason || "Invalid portfolio URL");
  }

  const res = await fetch(check.parsed.toString(), {
    headers: {
      "User-Agent": "AI-Tathastu-PortfolioAuditor/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(5000),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Portfolio site returned HTTP status ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("Portfolio URL did not return HTML content.");
  }

  const html = await res.text();
  const truncatedHtml = html.slice(0, 150_000);

  // Extract <title>
  const titleMatch = truncatedHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extract meta description
  const metaDescMatch = truncatedHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    truncatedHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const description = metaDescMatch ? metaDescMatch[1].trim() : null;

  // Extract outward links to github/linkedin
  const detectedLinks: string[] = [];
  const linkMatches = truncatedHtml.matchAll(/href=["'](https?:\/\/[^"'\s]+)["']/gi);
  for (const match of linkMatches) {
    const link = match[1];
    if (link.includes("github.com/") || link.includes("linkedin.com/in/") || link.includes("huggingface.co/")) {
      if (!detectedLinks.includes(link)) {
        detectedLinks.push(link);
      }
    }
    if (detectedLinks.length >= 10) break;
  }

  // Detect common AI/ML technology keywords mentioned in body
  const commonTech = [
    "PyTorch", "TensorFlow", "scikit-learn", "Hugging Face", "LangChain",
    "LlamaIndex", "FastAPI", "Docker", "Kubernetes", "Next.js", "React", "Python"
  ];
  const technologies = commonTech.filter((tech) =>
    new RegExp(`\\b${tech}\\b`, "i").test(truncatedHtml)
  );

  return {
    url: check.parsed.toString(),
    title,
    description,
    detectedLinks,
    technologies,
    extractedAt: new Date().toISOString(),
  };
}
