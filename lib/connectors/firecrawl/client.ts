/**
 * AI TATHASTU — FIRECRAWL CONNECTOR V3
 *
 * Provides optional enrichment for student-authorized portfolio and research websites.
 * Strictly adheres to security rules:
 * - SSRF protection (re-checks public IP resolving, rejects private/cloud metadata ranges)
 * - Size budget: 250 KB
 * - Timeout budget: 8 seconds
 * - Sanitizes untrusted content (no script execution, markdown/text extraction only)
 * - Credential rotation with capacity for up to 5 API keys
 * - Graceful fallback when unconfigured, rate-limited, or network fails
 */

import { isSafePublicUrl } from "@/lib/connectors/portfolio/client";
import { KeyPool } from "@/lib/intelligence/providers/key-pool";

export interface FirecrawlEnrichedProject {
  title: string;
  description?: string;
  url?: string;
  technologies: string[];
}

export interface FirecrawlEnrichmentResult {
  url: string;
  title: string | null;
  description: string | null;
  technologies: string[];
  projects: FirecrawlEnrichedProject[];
  publications: Array<{ title: string; url?: string; description?: string }>;
  extractedAt: string;
  provider: "firecrawl";
  enriched: boolean;
  notes?: string;
}

export const FIRECRAWL_ENV_VARS = [
  "FIRECRAWL_API_KEY",
  "FIRECRAWL_API_KEYS",
] as const;

const firecrawlKeyPool = new KeyPool([...FIRECRAWL_ENV_VARS]);

export function getFirecrawlCapacity(): { configured: boolean; capacity: number } {
  const pool = new KeyPool([...FIRECRAWL_ENV_VARS]);
  return {
    configured: pool.hasKeys(),
    capacity: pool.capacity(),
  };
}

/**
 * Common technology keywords to match from parsed portfolio text.
 */
const COMMON_TECH_SET = [
  "python", "javascript", "typescript", "react", "next.js", "node.js", "fastapi",
  "pytorch", "tensorflow", "opencv", "scikit-learn", "docker", "kubernetes",
  "postgresql", "mongodb", "redis", "supabase", "graphql", "sql", "git",
  "huggingface", "transformers", "langchain", "rag", "aws", "gcp", "azure",
  "pandas", "numpy", "c++", "golang", "flask", "django", "tailwind",
];

export async function enrichWebsiteWithFirecrawl(targetUrl: string): Promise<FirecrawlEnrichmentResult | null> {
  const now = new Date().toISOString();

  // 1. SSRF Safety Gate
  const check = isSafePublicUrl(targetUrl);
  if (!check.safe) {
    return null;
  }

  // 2. Credential Check
  if (!firecrawlKeyPool.hasKeys()) {
    return null;
  }

  const key = firecrawlKeyPool.getNextKey();
  if (!key) return null;

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ["markdown", "html"],
        onlyMainContent: true,
        timeout: 8000,
      }),
      signal: AbortSignal.timeout(8500),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        firecrawlKeyPool.markKeyFailed(key);
      }
      return null;
    }

    const json = (await res.json()) as {
      success?: boolean;
      data?: {
        markdown?: string;
        metadata?: {
          title?: string;
          description?: string;
          ogTitle?: string;
          ogDescription?: string;
          sourceURL?: string;
        };
      };
    };

    if (!json.success || !json.data) {
      return null;
    }

    const meta = json.data.metadata || {};
    const title = meta.title || meta.ogTitle || null;
    const description = meta.description || meta.ogDescription || null;
    const markdown = (json.data.markdown || "").slice(0, 250_000); // 250KB bounded

    // Extract tech mentions
    const textLower = markdown.toLowerCase();
    const detectedTechnologies: string[] = [];
    for (const tech of COMMON_TECH_SET) {
      const regex = new RegExp(`\\b${tech.replace(".", "\\.")}\\b`, "i");
      if (regex.test(textLower)) {
        detectedTechnologies.push(tech.charAt(0).toUpperCase() + tech.slice(1));
      }
    }

    // Extract project-like sections or links
    const projects: FirecrawlEnrichedProject[] = [];
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(markdown)) !== null) {
      const linkText = match[1].trim();
      const linkUrl = match[2].trim();

      if (
        linkText.length >= 4 &&
        !/^(home|about|contact|blog|privacy|terms|menu|twitter|linkedin|github|resume)$/i.test(linkText) &&
        !linkText.includes("http")
      ) {
        if (/github\.com|demo|project|app\./i.test(linkUrl) || /ai|ml|bot|dashboard|system|tool/i.test(linkText)) {
          projects.push({
            title: linkText.slice(0, 100),
            url: linkUrl,
            technologies: detectedTechnologies.slice(0, 4),
          });
          if (projects.length >= 6) break;
        }
      }
    }

    // Extract publication mentions
    const publications: Array<{ title: string; url?: string; description?: string }> = [];
    const pubLines = markdown.split("\n").filter((line) =>
      /paper|arxiv|doi|proceedings|journal|conference|published/i.test(line) && line.length > 20
    );

    for (const line of pubLines.slice(0, 5)) {
      publications.push({
        title: line.replace(/^[#*\-•\s]+/, "").trim().slice(0, 200),
        url: targetUrl,
      });
    }

    return {
      url: targetUrl,
      title: title ? title.slice(0, 150) : null,
      description: description ? description.slice(0, 300) : null,
      technologies: Array.from(new Set(detectedTechnologies)),
      projects,
      publications,
      extractedAt: now,
      provider: "firecrawl",
      enriched: true,
    };
  } catch {
    // Network / timeout gracefully returns null so caller falls back to lightweight parser
    return null;
  }
}
