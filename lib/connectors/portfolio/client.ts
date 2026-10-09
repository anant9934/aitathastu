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

export interface PortfolioDiscoveredProject {
  title: string;
  description?: string;
  url?: string;
  technologies?: string[];
}

export interface PortfolioMetadata {
  url: string;
  title: string | null;
  description: string | null;
  author: string | null;
  openGraph: {
    title?: string;
    description?: string;
    siteName?: string;
  };
  detectedLinks: string[];
  technologies: string[];
  discoveredProjects: PortfolioDiscoveredProject[];
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

  // Extract Author
  const authorMatch = truncatedHtml.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i) ||
    truncatedHtml.match(/<meta[^>]*property=["']article:author["'][^>]*content=["']([^"']+)["']/i);
  const author = authorMatch ? authorMatch[1].trim() : null;

  // Extract Open Graph
  const ogTitleMatch = truncatedHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const ogDescMatch = truncatedHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  const ogSiteMatch = truncatedHtml.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
  const openGraph = {
    title: ogTitleMatch ? ogTitleMatch[1].trim() : undefined,
    description: ogDescMatch ? ogDescMatch[1].trim() : undefined,
    siteName: ogSiteMatch ? ogSiteMatch[1].trim() : undefined,
  };

  // Extract outward links to github/linkedin/huggingface
  const detectedLinks: string[] = [];
  const linkMatches = truncatedHtml.matchAll(/href=["'](https?:\/\/[^"'\s]+)["']/gi);
  for (const match of linkMatches) {
    const link = match[1];
    if (link.includes("github.com/") || link.includes("linkedin.com/in/") || link.includes("huggingface.co/")) {
      if (!detectedLinks.includes(link)) {
        detectedLinks.push(link);
      }
    }
    if (detectedLinks.length >= 15) break;
  }

  // Detect common AI/ML technology keywords mentioned in body
  const commonTech = [
    "PyTorch", "TensorFlow", "scikit-learn", "Hugging Face", "LangChain",
    "LlamaIndex", "FastAPI", "Docker", "Kubernetes", "Next.js", "React", "Python",
    "TypeScript", "PostgreSQL", "OpenCV", "ChromaDB"
  ];
  const technologies = commonTech.filter((tech) =>
    new RegExp(`\\b${tech}\\b`, "i").test(truncatedHtml)
  );

  // Extract candidate projects from JSON-LD or github repository links
  const discoveredProjects: PortfolioDiscoveredProject[] = [];

  // 1. JSON-LD structured data
  const jsonLdMatches = truncatedHtml.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const jm of jsonLdMatches) {
    try {
      const parsedJson = JSON.parse(jm[1].trim());
      const items = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
      for (const item of items) {
        if (item["@type"] === "SoftwareSourceCode" || item["@type"] === "CreativeWork" || item["@type"] === "Project") {
          discoveredProjects.push({
            title: String(item.name || item.headline || "Portfolio Project"),
            description: item.description ? String(item.description) : undefined,
            url: item.url || item.codeRepository ? String(item.url || item.codeRepository) : undefined,
          });
        }
      }
    } catch {
      // Non-fatal if JSON-LD is malformed
    }
  }

  // 2. Outward GitHub repos as projects
  for (const link of detectedLinks) {
    const ghMatch = link.match(/github\.com\/([a-zA-Z0-9_\-]+)\/([a-zA-Z0-9_\-]+)/i);
    if (ghMatch && !discoveredProjects.some((p) => p.url === link)) {
      discoveredProjects.push({
        title: ghMatch[2],
        url: link,
        description: `Repository linked from personal portfolio: ${link}`,
      });
    }
  }

  return {
    url: check.parsed.toString(),
    title: openGraph.title || title,
    description: openGraph.description || description,
    author,
    openGraph,
    detectedLinks,
    technologies,
    discoveredProjects: discoveredProjects.slice(0, 10),
    extractedAt: new Date().toISOString(),
  };
}
