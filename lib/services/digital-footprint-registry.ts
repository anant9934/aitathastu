/**
 * AI TATHASTU — DIGITAL FOOTPRINT REGISTRY & URL DISCOVERY V3.9
 *
 * Deterministic, platform-aware URL extraction and validation.
 * Extracts profile and repository references from raw text, PDF hyperlink annotations,
 * and DOCX relationship targets.
 *
 * Strict Zero-LLM Implementation: Pure deterministic regex and RFC-compliant URL parsing.
 */

export interface DiscoveredFootprint {
  platformId: string;
  platformName: string;
  url: string;
  username: string;
  isProfile: boolean;
  isRepository?: boolean;
  source: "text" | "hyperlink" | "label";
  confidence: number;
}

export interface DiscoveredFootprintsSummary {
  profiles: Partial<Record<string, string>>;
  repositories: Array<{ url: string; owner: string; repo: string }>;
  allDiscovered: DiscoveredFootprint[];
}

/**
 * Validates an ORCID identifier using the official ISO 7064 Mod 11,2 check digit algorithm.
 */
export function isValidOrcidChecksum(orcidStr: string): boolean {
  const cleaned = orcidStr.replace(/^https?:\/\/orcid\.org\//i, "").trim();
  const match = cleaned.match(/^(\d{4})-(\d{4})-(\d{4})-(\d{3}[\dX])$/i);
  if (!match) return false;

  const digits = (match[1] + match[2] + match[3] + match[4]).toUpperCase();
  let total = 0;
  for (let i = 0; i < 15; i++) {
    const d = parseInt(digits[i], 10);
    if (isNaN(d)) return false;
    total = (total + d) * 2;
  }
  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const expectedCheck = result === 10 ? "X" : String(result);
  return digits[15] === expectedCheck;
}

const EXCLUDED_PORTFOLIO_HOSTS = new Set([
  "github.com",
  "linkedin.com",
  "leetcode.com",
  "huggingface.co",
  "orcid.org",
  "hackerrank.com",
  "codechef.com",
  "hackerearth.com",
  "kaggle.com",
  "dev.to",
  "google.com",
  "scholar.google.com",
  "stackoverflow.com",
  "researchgate.net",
  "medium.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "coursera.org",
  "udemy.com",
  "drive.google.com",
  "docs.google.com",
  "dropbox.com",
]);

/**
 * Discovers and validates all supported digital footprint platforms deterministically.
 */
export function discoverDigitalFootprints(
  text: string,
  extraHyperlinks: string[] = []
): DiscoveredFootprintsSummary {
  const discovered: DiscoveredFootprint[] = [];
  const discoveredProfiles: Partial<Record<string, string>> = {};
  const repositories: Array<{ url: string; owner: string; repo: string }> = [];

  // 1. Gather all potential URL strings from text and explicit hyperlinks
  const urlRegex = /https?:\/\/[^\s<>"'{}|\\^`\[\]()]+|(?<![\w@])(?:github\.com|linkedin\.com|leetcode\.com|huggingface\.co|orcid\.org|hackerrank\.com|codechef\.com|hackerearth\.com|kaggle\.com|dev\.to|scholar\.google\.com|stackoverflow\.com|researchgate\.net)\/[^\s<>"'{}|\\^`\[\]()]+/gi;
  const textMatches = Array.from(text.matchAll(urlRegex), (m) => m[0]);
  const combinedCandidates = Array.from(new Set([...textMatches, ...extraHyperlinks]))
    .map((u) => u.trim().replace(/[.,;:)\]]+$/, ""))
    .filter(Boolean);

  for (const rawUrl of combinedCandidates) {
    let normalized = rawUrl;
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = `https://${normalized}`;
    }

    try {
      const parsed = new URL(normalized);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      const pathname = parsed.pathname;
      const pathParts = pathname.split("/").filter(Boolean);

      // GitHub
      if (host === "github.com") {
        if (pathParts.length === 1 && !["about", "pricing", "explore", "settings", "features"].includes(pathParts[0].toLowerCase())) {
          const username = pathParts[0];
          const fullUrl = `https://github.com/${username}`;
          discovered.push({
            platformId: "github",
            platformName: "GitHub",
            url: fullUrl,
            username,
            isProfile: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          if (!discoveredProfiles.github) discoveredProfiles.github = fullUrl;
        } else if (pathParts.length >= 2) {
          const owner = pathParts[0];
          const repo = pathParts[1].replace(/\.git$/, "");
          const repoUrl = `https://github.com/${owner}/${repo}`;
          repositories.push({ url: repoUrl, owner, repo });
          discovered.push({
            platformId: "github",
            platformName: "GitHub Repository",
            url: repoUrl,
            username: owner,
            isProfile: false,
            isRepository: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          // Also record owner as profile if no profile set yet
          if (!discoveredProfiles.github) {
            discoveredProfiles.github = `https://github.com/${owner}`;
          }
        }
      }

      // LinkedIn
      else if (host === "linkedin.com") {
        // Disallow company or non-personal paths
        if (pathParts[0]?.toLowerCase() === "in" && pathParts[1]) {
          const username = pathParts[1];
          const fullUrl = `https://linkedin.com/in/${username}`;
          discovered.push({
            platformId: "linkedin",
            platformName: "LinkedIn",
            url: fullUrl,
            username,
            isProfile: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          if (!discoveredProfiles.linkedin) discoveredProfiles.linkedin = fullUrl;
        }
      }

      // LeetCode
      else if (host === "leetcode.com") {
        let username = "";
        if (pathParts[0]?.toLowerCase() === "u" && pathParts[1]) {
          username = pathParts[1];
        } else if (pathParts.length === 1 && !["problems", "contest", "discuss", "explore"].includes(pathParts[0].toLowerCase())) {
          username = pathParts[0];
        }
        if (username) {
          const fullUrl = `https://leetcode.com/u/${username}`;
          discovered.push({
            platformId: "leetcode",
            platformName: "LeetCode",
            url: fullUrl,
            username,
            isProfile: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          if (!discoveredProfiles.leetcode) discoveredProfiles.leetcode = fullUrl;
        }
      }

      // Hugging Face
      else if (host === "huggingface.co") {
        if (pathParts.length === 1 && !["models", "datasets", "spaces", "docs", "pricing"].includes(pathParts[0].toLowerCase())) {
          const username = pathParts[0];
          const fullUrl = `https://huggingface.co/${username}`;
          discovered.push({
            platformId: "huggingface",
            platformName: "Hugging Face",
            url: fullUrl,
            username,
            isProfile: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          if (!discoveredProfiles.huggingface) discoveredProfiles.huggingface = fullUrl;
        }
      }

      // ORCID
      else if (host === "orcid.org") {
        const potentialOrcid = pathParts[0] || "";
        if (isValidOrcidChecksum(potentialOrcid)) {
          const fullUrl = `https://orcid.org/${potentialOrcid}`;
          discovered.push({
            platformId: "orcid",
            platformName: "ORCID",
            url: fullUrl,
            username: potentialOrcid,
            isProfile: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          if (!discoveredProfiles.orcid) discoveredProfiles.orcid = fullUrl;
        }
      }

      // HackerRank
      else if (host === "hackerrank.com") {
        let username = "";
        if (pathParts[0]?.toLowerCase() === "profile" && pathParts[1]) {
          username = pathParts[1];
        } else if (pathParts.length === 1 && !["domains", "challenges", "leaderboard", "auth"].includes(pathParts[0].toLowerCase())) {
          username = pathParts[0];
        }
        if (username) {
          const fullUrl = `https://hackerrank.com/${username}`;
          discovered.push({
            platformId: "hackerrank",
            platformName: "HackerRank",
            url: fullUrl,
            username,
            isProfile: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          if (!discoveredProfiles.hackerrank) discoveredProfiles.hackerrank = fullUrl;
        }
      }

      // CodeChef
      else if (host === "codechef.com") {
        let username = "";
        if (pathParts[0]?.toLowerCase() === "users" && pathParts[1]) {
          username = pathParts[1];
        } else if (pathParts.length === 1) {
          username = pathParts[0];
        }
        if (username) {
          const fullUrl = `https://codechef.com/users/${username}`;
          discovered.push({
            platformId: "codechef",
            platformName: "CodeChef",
            url: fullUrl,
            username,
            isProfile: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          if (!discoveredProfiles.codechef) discoveredProfiles.codechef = fullUrl;
        }
      }

      // HackerEarth
      else if (host === "hackerearth.com") {
        const username = pathParts[0]?.replace(/^@/, "");
        if (username) {
          const fullUrl = `https://hackerearth.com/@${username}`;
          discovered.push({
            platformId: "hackerearth",
            platformName: "HackerEarth",
            url: fullUrl,
            username,
            isProfile: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          if (!discoveredProfiles.hackerearth) discoveredProfiles.hackerearth = fullUrl;
        }
      }

      // Kaggle
      else if (host === "kaggle.com") {
        if (pathParts.length === 1 && !["datasets", "competitions", "models", "code", "learn"].includes(pathParts[0].toLowerCase())) {
          const username = pathParts[0];
          const fullUrl = `https://kaggle.com/${username}`;
          discovered.push({
            platformId: "kaggle",
            platformName: "Kaggle",
            url: fullUrl,
            username,
            isProfile: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          if (!discoveredProfiles.kaggle) discoveredProfiles.kaggle = fullUrl;
        }
      }

      // DEV Community
      else if (host === "dev.to") {
        if (pathParts.length === 1 && !["t", "search", "top", "latest", "podcasts"].includes(pathParts[0].toLowerCase())) {
          const username = pathParts[0];
          const fullUrl = `https://dev.to/${username}`;
          discovered.push({
            platformId: "devto",
            platformName: "DEV Community",
            url: fullUrl,
            username,
            isProfile: true,
            source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
            confidence: 1.0,
          });
          if (!discoveredProfiles.devto) discoveredProfiles.devto = fullUrl;
        }
      }

      // Portfolio / Personal Website
      else if (!EXCLUDED_PORTFOLIO_HOSTS.has(host) && !host.endsWith(".edu") && !host.endsWith(".ac.in")) {
        // Valid web URL that looks like a personal portfolio or blog
        const fullUrl = parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname);
        discovered.push({
          platformId: "portfolio",
          platformName: "Portfolio / Website",
          url: fullUrl,
          username: parsed.hostname,
          isProfile: true,
          source: extraHyperlinks.includes(rawUrl) ? "hyperlink" : "text",
          confidence: 0.9,
        });
        if (!discoveredProfiles.portfolio) discoveredProfiles.portfolio = fullUrl;
      }
    } catch {
      // Ignore malformed candidate URL
    }
  }

  // 2. Discover labeled handles (e.g. "LeetCode: anant99", "GitHub: anant9934", "LinkedIn: /in/anant")
  const labelPatterns: Array<{ regex: RegExp; platformId: string; urlPrefix: string }> = [
    { regex: /(?:github|gh)\s*[:\-]\s*@?([a-zA-Z0-9_\-]+)(?!\.[a-z])/i, platformId: "github", urlPrefix: "https://github.com/" },
    { regex: /(?:leetcode|lc)\s*[:\-]\s*@?([a-zA-Z0-9_\-]+)(?!\.[a-z])/i, platformId: "leetcode", urlPrefix: "https://leetcode.com/u/" },
    { regex: /(?:linkedin|li)\s*[:\-]\s*(?:in\/)?@?([a-zA-Z0-9_\-]+)(?!\.[a-z])/i, platformId: "linkedin", urlPrefix: "https://linkedin.com/in/" },
    { regex: /(?:huggingface|hf)\s*[:\-]\s*@?([a-zA-Z0-9_\-]+)(?!\.[a-z])/i, platformId: "huggingface", urlPrefix: "https://huggingface.co/" },
    { regex: /(?:hackerrank|hr)\s*[:\-]\s*@?([a-zA-Z0-9_\-]+)(?!\.[a-z])/i, platformId: "hackerrank", urlPrefix: "https://hackerrank.com/" },
    { regex: /(?:codechef|cc)\s*[:\-]\s*@?([a-zA-Z0-9_\-]+)(?!\.[a-z])/i, platformId: "codechef", urlPrefix: "https://codechef.com/users/" },
    { regex: /(?:kaggle)\s*[:\-]\s*@?([a-zA-Z0-9_\-]+)(?!\.[a-z])/i, platformId: "kaggle", urlPrefix: "https://kaggle.com/" },
    { regex: /(?:dev\.to|devto)\s*[:\-]\s*@?([a-zA-Z0-9_\-]+)(?!\.[a-z])/i, platformId: "devto", urlPrefix: "https://dev.to/" },
  ];

  for (const { regex, platformId, urlPrefix } of labelPatterns) {
    if (!discoveredProfiles[platformId]) {
      const match = text.match(regex);
      if (match && match[1] && match[1].length >= 3 && match[1].length <= 39) {
        const username = match[1];
        const fullUrl = `${urlPrefix}${username}`;
        discoveredProfiles[platformId] = fullUrl;
        discovered.push({
          platformId,
          platformName: platformId,
          url: fullUrl,
          username,
          isProfile: true,
          source: "label",
          confidence: 0.95,
        });
      }
    }
  }

  // 3. Raw ORCID ID in text (e.g. "ORCID: 0000-0002-1825-0097")
  if (!discoveredProfiles.orcid) {
    const orcidMatch = text.match(/\b(0000-\d{4}-\d{4}-\d{3}[\dX])\b/i);
    if (orcidMatch && isValidOrcidChecksum(orcidMatch[1])) {
      const fullUrl = `https://orcid.org/${orcidMatch[1]}`;
      discoveredProfiles.orcid = fullUrl;
      discovered.push({
        platformId: "orcid",
        platformName: "ORCID",
        url: fullUrl,
        username: orcidMatch[1],
        isProfile: true,
        source: "label",
        confidence: 1.0,
      });
    }
  }

  return {
    profiles: discoveredProfiles,
    repositories,
    allDiscovered: discovered,
  };
}
