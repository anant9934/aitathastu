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
import { lookup } from "node:dns/promises";
import https from "node:https";
import { isIP } from "node:net";

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

const MAX_HTML_BYTES = 150_000;

function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

import { isSafePublicUrl } from "./url-check";
export { isSafePublicUrl };

export async function fetchSafeHtml(rawUrl: string, redirectsRemaining = 3): Promise<{ url: string; html: string }> {
  const check = isSafePublicUrl(rawUrl);
  if (!check.safe || !check.parsed) {
    throw new Error(check.reason || "Invalid portfolio URL");
  }
  const addresses = await lookup(check.parsed.hostname, { all: true, family: 4 });
  const address = addresses.find((entry) => isPublicIpv4(entry.address));
  if (!address || addresses.some((entry) => !isPublicIpv4(entry.address))) {
    throw new Error("Portfolio host did not resolve exclusively to public IPv4 addresses.");
  }
  const response = await new Promise<{ status: number; contentType: string; location?: string; html: string }>((resolve, reject) => {
    const request = https.get(check.parsed!, {
      headers: { "User-Agent": "AI-Tathastu-PortfolioAuditor/1.0", Accept: "text/html,application/xhtml+xml" },
      timeout: 5000,
      // Node's automatic address-family selection requests { all: true }.
      // Preserve DNS pinning in both callback forms; returning a string for
      // an all-address lookup makes Node read an undefined IP address.
      lookup: (_host, options, callback) => options.all
        ? callback(null, [{ address: address.address, family: 4 }])
        : callback(null, address.address, 4),
    }, (res) => {
      const status = res.statusCode || 0;
      const contentType = String(res.headers["content-type"] || "");
      const location = typeof res.headers.location === "string" ? res.headers.location : undefined;
      if (status >= 300 && status < 400) {
        res.resume();
        resolve({ status, contentType, location, html: "" });
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_HTML_BYTES) {
          res.destroy(new Error("Portfolio HTML exceeded the 150 KB limit."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ status, contentType, html: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("Portfolio request timed out.")));
    request.on("error", reject);
  });
  if (response.status >= 300 && response.status < 400) {
    if (!response.location || redirectsRemaining === 0) throw new Error("Portfolio redirect could not be followed safely.");
    return fetchSafeHtml(new URL(response.location, check.parsed).toString(), redirectsRemaining - 1);
  }
  if (response.status < 200 || response.status >= 300) throw new Error(`Portfolio site returned HTTP status ${response.status}`);
  if (!/text\/html|application\/xhtml\+xml/i.test(response.contentType)) throw new Error("Portfolio URL did not return HTML content.");
  return { url: check.parsed.toString(), html: response.html };
}

export async function fetchPortfolioMetadata(rawUrl: string): Promise<PortfolioMetadata> {
  const { url, html: truncatedHtml } = await fetchSafeHtml(rawUrl);

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
    url,
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
