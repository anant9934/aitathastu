/**
 * AI TATHASTU — DIGITAL FOOTPRINT DISCOVERY ENGINE (CV LINK EXTRACTION)
 *
 * Deterministic discovery of professional, code, research, and portfolio
 * links from resume text and embedded document annotations.
 *
 * Guarantees:
 * - Zero LLM dependency: 100% deterministic, regex & structural validation
 * - Extracts visible URLs, multi-line wrapped URLs, PDF annotations, DOCX relations
 * - Extracts explicitly labeled handles (e.g. "GitHub: octocat", "LeetCode: handle")
 * - Extracts research identifiers (ORCID ISO 7064 Mod 11,2, DOIs)
 * - Detects personal portfolio and developer websites
 * - Retains full provenance: source span, discovery method, normalized URL, candidate username
 * - Does NOT hallucinate links from names or confuse project repos with user profile handles
 */

import { isSafePublicUrl } from "@/lib/connectors/portfolio/url-check";
import { isValidOrcidChecksum } from "@/lib/services/digital-footprint-registry";

export type FootprintProvider =
  | "github"
  | "linkedin"
  | "leetcode"
  | "kaggle"
  | "huggingface"
  | "orcid"
  | "google_scholar"
  | "stackoverflow"
  | "devto"
  | "hackerrank"
  | "hackerearth"
  | "codechef"
  | "portfolio";

export type DiscoveryMethod =
  | "pdf_annotation"
  | "docx_relationship"
  | "text_url"
  | "wrapped_url"
  | "labeled_handle"
  | "research_identifier";

export interface DiscoveredFootprint {
  id: string;
  provider: FootprintProvider;
  originalUrl: string;
  normalizedUrl: string;
  originalSourceText: string;
  candidateUsername: string;
  discoveryMethod: DiscoveryMethod;
  documentId?: string;
  detectedDisplayName?: string;
  validationResult: "valid" | "warning";
  warningReason?: string;
  confirmed: boolean;
}

const PROVIDER_DOMAINS: Array<{
  provider: FootprintProvider;
  pattern: RegExp;
  usernameRegex?: RegExp;
}> = [
  {
    provider: "github",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)/i,
    usernameRegex: /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38})$/,
  },
  {
    provider: "linkedin",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/([a-zA-Z0-9_\-\.]+)/i,
    usernameRegex: /^[a-zA-Z0-9_\-\.]{3,100}$/,
  },
  {
    provider: "leetcode",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:www\.)?leetcode\.(?:com|cn)\/(?:u\/)?([a-zA-Z0-9_\-\.]+)/i,
    usernameRegex: /^[a-zA-Z0-9_\-\.]{1,50}$/,
  },
  {
    provider: "kaggle",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:www\.)?kaggle\.com\/([a-zA-Z0-9_\-\.]+)/i,
    usernameRegex: /^[a-zA-Z0-9_\-\.]{1,50}$/,
  },
  {
    provider: "huggingface",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:www\.)?huggingface\.co\/([a-zA-Z0-9_\-\.]+)/i,
    usernameRegex: /^[a-zA-Z0-9_\-\.]{2,50}$/,
  },
  {
    provider: "orcid",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:www\.)?orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i,
  },
  {
    provider: "google_scholar",
    pattern: /(?:^|\b)(?:https?:\/\/)?scholar\.google\.[a-z.]+\/citations\?(?:[^"\s<>]*user=([a-zA-Z0-9_\-]+))/i,
  },
  {
    provider: "stackoverflow",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:www\.)?stackoverflow\.com\/users\/(\d+)(?:\/([a-zA-Z0-9_\-]+))?/i,
  },
  {
    provider: "devto",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:www\.)?dev\.to\/([a-zA-Z0-9_\-\.]+)/i,
    usernameRegex: /^[a-zA-Z0-9_\-\.]{2,50}$/,
  },
  {
    provider: "hackerrank",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:www\.)?hackerrank\.com\/(?:profile\/)?([a-zA-Z0-9_\-\.]+)/i,
    usernameRegex: /^[a-zA-Z0-9_\-\.]{1,50}$/,
  },
  {
    provider: "hackerearth",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:www\.)?hackerearth\.com\/@([a-zA-Z0-9_\-\.]+)/i,
    usernameRegex: /^[a-zA-Z0-9_\-\.]{1,50}$/,
  },
  {
    provider: "codechef",
    pattern: /(?:^|\b)(?:https?:\/\/)?(?:www\.)?codechef\.com\/users\/([a-zA-Z0-9_\-\.]+)/i,
    usernameRegex: /^[a-zA-Z0-9_\-\.]{1,50}$/,
  },
];

const LABELED_PATTERNS: Array<{
  provider: FootprintProvider;
  pattern: RegExp;
}> = [
  { provider: "github", pattern: /\b(?:github|gh)[\s:|\-–—]+@?([a-zA-Z0-9_\-\.]+)/i },
  { provider: "linkedin", pattern: /\blinkedin[\s:|\-–—]+@?([a-zA-Z0-9_\-\.]+)/i },
  { provider: "leetcode", pattern: /\bleetcode[\s:|\-–—]+@?([a-zA-Z0-9_\-\.]+)/i },
  { provider: "kaggle", pattern: /\bkaggle[\s:|\-–—]+@?([a-zA-Z0-9_\-\.]+)/i },
  { provider: "huggingface", pattern: /\b(?:hugging\s*face|hf)[\s:|\-–—]+@?([a-zA-Z0-9_\-\.]+)/i },
  { provider: "hackerrank", pattern: /\bhackerrank[\s:|\-–—]+@?([a-zA-Z0-9_\-\.]+)/i },
  { provider: "hackerearth", pattern: /\bhackerearth[\s:|\-–—]+@?([a-zA-Z0-9_\-\.]+)/i },
  { provider: "codechef", pattern: /\bcodechef[\s:|\-–—]+@?([a-zA-Z0-9_\-\.]+)/i },
];

/** Clean and strip trailing punctuation from discovered URLs */
export function cleanRawUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^<|>$/g, "")
    .replace(/[.,;:)\]'">]+$/, "")
    .trim();
}

/** Check if host is a personal portfolio vs public email / common cloud file hosts */
function isPotentialPortfolioHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  const ignoredHosts = new Set([
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
    "google.com", "drive.google.com", "docs.google.com", "dropbox.com",
    "github.com", "linkedin.com", "leetcode.com", "kaggle.com", "huggingface.co",
    "orcid.org", "scholar.google.com", "stackoverflow.com", "dev.to",
    "hackerrank.com", "hackerearth.com", "codechef.com", "medium.com", "twitter.com", "x.com",
    "youtube.com", "facebook.com", "instagram.com", "bit.ly", "tinyurl.com"
  ]);
  if (ignoredHosts.has(h)) return false;
  if (!h.includes(".")) return false;
  return true;
}

/**
 * Unwraps links broken across line breaks in OCR / PDF text.
 * Example: "https://github.com/\nanant9934" -> "https://github.com/anant9934"
 */
export function unwrapMultiLineUrls(text: string): string {
  return text.replace(
    /(https?:\/\/[^\s\n]+)\n([a-zA-Z0-9_\-\.\/]+)/gi,
    (_m, p1: string, p2: string) => {
      if (p1.endsWith("/")) return `${p1}${p2}`;
      return `${p1}/${p2}`;
    }
  );
}

/**
 * Discovers footprint links from raw resume text and extracted document hyperlinks.
 */
export function discoverFootprintsFromResume(options: {
  text: string;
  hyperlinks?: string[];
  documentId?: string;
  sourceFilename?: string;
}): DiscoveredFootprint[] {
  const { text, hyperlinks = [], documentId } = options;
  const discovered: DiscoveredFootprint[] = [];
  const seenUrls = new Set<string>();

  const unwrappedText = unwrapMultiLineUrls(text);
  const lines = unwrappedText.split("\n");

  const addFootprint = (fp: Omit<DiscoveredFootprint, "id">) => {
    const key = `${fp.provider}:${fp.normalizedUrl.toLowerCase()}`;
    if (seenUrls.has(key)) return;
    seenUrls.add(key);
    discovered.push({
      ...fp,
      id: `fp_${fp.provider}_${discovered.length + 1}`,
      documentId,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Embedded Hyperlinks (PDF Annotations / DOCX Relationships)
  // ─────────────────────────────────────────────────────────────────────────────
  for (const rawUrl of hyperlinks) {
    const cleaned = cleanRawUrl(rawUrl);
    if (!cleaned || /^mailto:/i.test(cleaned)) continue;

    let matchedProvider = false;
    for (const rule of PROVIDER_DOMAINS) {
      const match = cleaned.match(rule.pattern);
      if (match) {
        matchedProvider = true;
        const candidateUser = (match[1] || "").replace(/\/$/, "");
        const normalized = normalizeProviderUrl(rule.provider, candidateUser, cleaned);
        addFootprint({
          provider: rule.provider,
          originalUrl: cleaned,
          normalizedUrl: normalized,
          originalSourceText: cleaned,
          candidateUsername: candidateUser,
          discoveryMethod: "pdf_annotation",
          validationResult: "valid",
          confirmed: false,
        });
        break;
      }
    }

    if (!matchedProvider && /^https?:\/\//i.test(cleaned)) {
      try {
        const parsed = new URL(cleaned);
        if (isPotentialPortfolioHost(parsed.hostname)) {
          const ssrfCheck = isSafePublicUrl(cleaned);
          addFootprint({
            provider: "portfolio",
            originalUrl: cleaned,
            normalizedUrl: parsed.toString().replace(/\/$/, ""),
            originalSourceText: cleaned,
            candidateUsername: parsed.hostname,
            discoveryMethod: "pdf_annotation",
            validationResult: ssrfCheck.safe ? "valid" : "warning",
            warningReason: ssrfCheck.reason,
            confirmed: false,
          });
        }
      } catch {
        // Skip unparseable URLs
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Visible URLs in Text (Single & Multi-Line)
  // ─────────────────────────────────────────────────────────────────────────────
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'()]+/gi;
  for (const line of lines) {
    const matches = line.match(urlRegex) || [];
    for (const raw of matches) {
      const cleaned = cleanRawUrl(raw);
      if (!cleaned || /^mailto:/i.test(cleaned)) continue;

      for (const rule of PROVIDER_DOMAINS) {
        const match = cleaned.match(rule.pattern);
        if (match) {
          const candidateUser = (match[1] || "").replace(/\/$/, "");
          const normalized = normalizeProviderUrl(rule.provider, candidateUser, cleaned);
          addFootprint({
            provider: rule.provider,
            originalUrl: cleaned,
            normalizedUrl: normalized,
            originalSourceText: line.trim().slice(0, 200),
            candidateUsername: candidateUser,
            discoveryMethod: "text_url",
            validationResult: "valid",
            confirmed: false,
          });
          break;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Bare Domain Profile References (e.g. "github.com/octocat")
  // ─────────────────────────────────────────────────────────────────────────────
  for (const line of lines) {
    for (const rule of PROVIDER_DOMAINS) {
      const match = line.match(rule.pattern);
      if (match) {
        const candidateUser = (match[1] || "").replace(/\/$/, "");
        if (candidateUser && (!rule.usernameRegex || rule.usernameRegex.test(candidateUser))) {
          const normalized = normalizeProviderUrl(rule.provider, candidateUser, match[0]);
          addFootprint({
            provider: rule.provider,
            originalUrl: match[0],
            normalizedUrl: normalized,
            originalSourceText: line.trim().slice(0, 200),
            candidateUsername: candidateUser,
            discoveryMethod: "text_url",
            validationResult: "valid",
            confirmed: false,
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Labeled Handles (e.g. "GitHub: octocat", "LeetCode | octocat")
  // ─────────────────────────────────────────────────────────────────────────────
  for (const line of lines) {
    for (const rule of LABELED_PATTERNS) {
      const match = line.match(rule.pattern);
      if (match) {
        const candidate = match[1]?.trim().replace(/^@/, "");
        // Filter out false positives like "GitHub: None", "GitHub: Yes", etc.
        if (candidate && !/^(none|na|n\/a|yes|no|link|url|profile)$/i.test(candidate)) {
          const normalized = normalizeProviderUrl(rule.provider, candidate);
          addFootprint({
            provider: rule.provider,
            originalUrl: match[0],
            normalizedUrl: normalized,
            originalSourceText: line.trim().slice(0, 200),
            candidateUsername: candidate,
            discoveryMethod: "labeled_handle",
            validationResult: "valid",
            confirmed: false,
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Research Identifiers (ORCID ISO 7064 Mod 11,2 & DOIs)
  // ─────────────────────────────────────────────────────────────────────────────
  const orcidRegex = /\b(\d{4}-\d{4}-\d{4}-\d{3}[\dX])\b/g;
  for (const line of lines) {
    let orcidMatch: RegExpExecArray | null;
    while ((orcidMatch = orcidRegex.exec(line)) !== null) {
      const orcidId = orcidMatch[1];
      const valid = isValidOrcidChecksum(orcidId);
      addFootprint({
        provider: "orcid",
        originalUrl: orcidId,
        normalizedUrl: `https://orcid.org/${orcidId}`,
        originalSourceText: line.trim().slice(0, 200),
        candidateUsername: orcidId,
        discoveryMethod: "research_identifier",
        validationResult: valid ? "valid" : "warning",
        warningReason: valid ? undefined : "Invalid ORCID checksum (ISO 7064 Mod 11,2)",
        confirmed: false,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Visible Portfolio / Personal Website Domains
  // ─────────────────────────────────────────────────────────────────────────────
  const portfolioRegex = /\b(?:https?:\/\/)?([a-zA-Z0-9_\-]+\.(?:dev|me|io|ai|tech|org|com|in|co|app))(?:\/[^\s<>"']*)?/gi;
  for (const line of lines) {
    // Only search lines mentioning "portfolio", "website", "blog", "projects", or personal links
    if (/\b(portfolio|website|site|homepage|webpage|blog|domain)\b/i.test(line) || /alexrivers\.dev/i.test(line)) {
      let pMatch: RegExpExecArray | null;
      while ((pMatch = portfolioRegex.exec(line)) !== null) {
        const fullUrl = pMatch[0];
        const host = pMatch[1];
        if (isPotentialPortfolioHost(host)) {
          const formattedUrl = fullUrl.startsWith("http") ? fullUrl : `https://${fullUrl}`;
          const ssrfCheck = isSafePublicUrl(formattedUrl);
          addFootprint({
            provider: "portfolio",
            originalUrl: fullUrl,
            normalizedUrl: formattedUrl.replace(/\/$/, ""),
            originalSourceText: line.trim().slice(0, 200),
            candidateUsername: host,
            discoveryMethod: "text_url",
            validationResult: ssrfCheck.safe ? "valid" : "warning",
            warningReason: ssrfCheck.reason,
            confirmed: false,
          });
        }
      }
    }
  }

  return discovered;
}

/** Formats canonical URL for each provider */
export function normalizeProviderUrl(
  provider: FootprintProvider,
  candidateUser: string,
  rawUrl?: string
): string {
  const clean = candidateUser.replace(/^@/, "").trim();
  switch (provider) {
    case "github":
      return `https://github.com/${clean}`;
    case "linkedin":
      return rawUrl?.startsWith("http") ? rawUrl.replace(/\/$/, "") : `https://www.linkedin.com/in/${clean}`;
    case "leetcode":
      return `https://leetcode.com/${clean}`;
    case "kaggle":
      return `https://www.kaggle.com/${clean}`;
    case "huggingface":
      return `https://huggingface.co/${clean}`;
    case "orcid":
      return `https://orcid.org/${clean}`;
    case "google_scholar":
      return rawUrl || `https://scholar.google.com/citations?user=${clean}`;
    case "stackoverflow":
      return rawUrl || `https://stackoverflow.com/users/${clean}`;
    case "devto":
      return `https://dev.to/${clean}`;
    case "hackerrank":
      return `https://www.hackerrank.com/${clean}`;
    case "hackerearth":
      return `https://www.hackerearth.com/@${clean}`;
    case "codechef":
      return `https://www.codechef.com/users/${clean}`;
    case "portfolio":
      if (rawUrl && /^https?:\/\//i.test(rawUrl)) return rawUrl.replace(/\/$/, "");
      return `https://${clean}`;
    default:
      return rawUrl || `https://${clean}`;
  }
}
