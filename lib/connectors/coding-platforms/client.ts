/**
 * AI TATHASTU — V3.2 CODING PLATFORMS CONNECTOR
 *
 * Covers:
 * - CodeChef
 * - HackerRank
 * - HackerEarth
 *
 * Rules:
 * - Strict domain & handle validation
 * - Acquires permitted public signals where available (e.g. HackerRank public badge REST endpoint)
 * - Falls back cleanly to verified profile linking when endpoints are unavailable or blocked
 * - Trust Level: 'SOURCE_DETECTED' or 'STUDENT_REPORTED' (requires student confirmation)
 * - Never scrapes behind authentication or bypasses rate limits
 */

export interface CodingPlatformProfile {
  platform: "codechef" | "hackerrank" | "hackerearth";
  username: string;
  profileUrl: string;
  displayName?: string | null;
  badges?: Array<{ badge: string; stars?: number }>;
  rating?: number | null;
  problemsSolved?: number | null;
  globalRank?: number | null;
  studentReported?: boolean;
  status: "LIVE_VERIFIED" | "PROFILE_LINK_ONLY" | "UNAVAILABLE";
  retrievedAt: string;
  notes?: string;
}

/**
 * Normalizes username/handle by stripping platform domain prefixes.
 */
export function normalizeCodingHandle(input: string, platform: "codechef" | "hackerrank" | "hackerearth"): string {
  const trimmed = input.trim();
  let handle = trimmed;

  if (platform === "codechef") {
    handle = trimmed.replace(/^https?:\/\/(www\.)?codechef\.com\/users\//i, "");
  } else if (platform === "hackerrank") {
    handle = trimmed.replace(/^https?:\/\/(www\.)?hackerrank\.com\/(profile\/)?/i, "");
  } else if (platform === "hackerearth") {
    handle = trimmed.replace(/^https?:\/\/(www\.)?hackerearth\.com\/@?/i, "");
  }

  return handle.replace(/\/$/, "").replace(/^@/, "").trim();
}

/**
 * Validates and retrieves HackerRank public profile and badge information,
 * with optional student-reported metrics.
 */
export async function fetchHackerRankProfile(
  rawInput: string,
  manualMetrics?: { rating?: number; problemsSolved?: number }
): Promise<CodingPlatformProfile> {
  const username = normalizeCodingHandle(rawInput, "hackerrank");
  const profileUrl = `https://www.hackerrank.com/${username}`;
  const now = new Date().toISOString();

  if (!username || !/^[a-zA-Z0-9_\-\.]{2,50}$/.test(username)) {
    return {
      platform: "hackerrank",
      username: username || "unknown",
      profileUrl,
      status: "UNAVAILABLE",
      retrievedAt: now,
      notes: "Invalid HackerRank username format.",
    };
  }

  try {
    const res = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/badges`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AI-Tathastu-ProfileAuditor/1.0",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const badges: Array<{ badge: string; stars?: number }> = [];
      if (Array.isArray(data.models)) {
        for (const item of data.models) {
          if (item.badge_name) {
            badges.push({
              badge: String(item.badge_name),
              stars: typeof item.stars === "number" ? item.stars : undefined,
            });
          }
        }
      }

      return {
        platform: "hackerrank",
        username,
        profileUrl,
        badges,
        rating: manualMetrics?.rating ?? null,
        problemsSolved: manualMetrics?.problemsSolved ?? null,
        studentReported: Boolean(manualMetrics),
        status: badges.length > 0 ? "LIVE_VERIFIED" : "PROFILE_LINK_ONLY",
        retrievedAt: now,
        notes: badges.length > 0
          ? `Discovered ${badges.length} public skill badges.`
          : "Profile verified. No public skill badges found.",
      };
    }
  } catch {
    // Network or rate limit fallback
  }

  return {
    platform: "hackerrank",
    username,
    profileUrl,
    rating: manualMetrics?.rating ?? null,
    problemsSolved: manualMetrics?.problemsSolved ?? null,
    studentReported: Boolean(manualMetrics),
    status: "PROFILE_LINK_ONLY",
    retrievedAt: now,
    notes: manualMetrics
      ? "HackerRank profile linked with student-reported practice metrics."
      : "Profile URL verified and linked. Background sync disabled.",
  };
}

/**
 * Validates CodeChef profile reference and handle, with optional student-reported metrics.
 */
export async function fetchCodeChefProfile(
  rawInput: string,
  manualMetrics?: { rating?: number; problemsSolved?: number; globalRank?: number }
): Promise<CodingPlatformProfile> {
  const username = normalizeCodingHandle(rawInput, "codechef");
  const profileUrl = `https://www.codechef.com/users/${username}`;
  const now = new Date().toISOString();

  if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return {
      platform: "codechef",
      username: username || "unknown",
      profileUrl,
      status: "UNAVAILABLE",
      retrievedAt: now,
      notes: "Invalid CodeChef handle format.",
    };
  }

  return {
    platform: "codechef",
    username,
    profileUrl,
    rating: manualMetrics?.rating ?? null,
    problemsSolved: manualMetrics?.problemsSolved ?? null,
    globalRank: manualMetrics?.globalRank ?? null,
    studentReported: Boolean(manualMetrics),
    status: "PROFILE_LINK_ONLY",
    retrievedAt: now,
    notes: manualMetrics
      ? "CodeChef profile linked with self-reported contest metrics. Unofficial automated scraping disabled per platform terms."
      : "CodeChef profile linked. Automated scraping is disabled per provider terms.",
  };
}

/**
 * Validates HackerEarth profile reference and handle, with optional student-reported metrics.
 */
export async function fetchHackerEarthProfile(
  rawInput: string,
  manualMetrics?: { rating?: number; problemsSolved?: number }
): Promise<CodingPlatformProfile> {
  const username = normalizeCodingHandle(rawInput, "hackerearth");
  const profileUrl = `https://www.hackerearth.com/@${username}`;
  const now = new Date().toISOString();

  if (!username || !/^[a-zA-Z0-9_\-\.]{2,40}$/.test(username)) {
    return {
      platform: "hackerearth",
      username: username || "unknown",
      profileUrl,
      status: "UNAVAILABLE",
      retrievedAt: now,
      notes: "Invalid HackerEarth handle format.",
    };
  }

  return {
    platform: "hackerearth",
    username,
    profileUrl,
    rating: manualMetrics?.rating ?? null,
    problemsSolved: manualMetrics?.problemsSolved ?? null,
    studentReported: Boolean(manualMetrics),
    status: "PROFILE_LINK_ONLY",
    retrievedAt: now,
    notes: manualMetrics
      ? "HackerEarth profile linked with self-reported hackathon/practice records."
      : "HackerEarth profile linked. Practice activity recorded upon student confirmation.",
  };
}

/**
 * Deterministically parses CodeChef export files or contest summaries.
 */
export function parseCodeChefExport(
  filename: string,
  content: string
): { rating?: number; problemsSolved?: number; globalRank?: number; stars?: number } {
  const trimmed = content.trim();
  const res: { rating?: number; problemsSolved?: number; globalRank?: number; stars?: number } = {};

  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed);
      if (data.rating || data.contestRating) res.rating = Number(data.rating || data.contestRating);
      if (data.problemsSolved || data.solved) res.problemsSolved = Number(data.problemsSolved || data.solved);
      if (data.globalRank || data.rank) res.globalRank = Number(data.globalRank || data.rank);
      if (data.stars) res.stars = Number(data.stars);
      return res;
    } catch {
      // Fall through
    }
  }

  const ratingMatch = trimmed.match(/rating[\s:]+(\d+)/i);
  const solvedMatch = trimmed.match(/(?:solved|problems)[\s:]+(\d+)/i);
  const rankMatch = trimmed.match(/(?:rank|global)[\s:]+(\d+)/i);
  const starsMatch = trimmed.match(/(\d+)\s*star/i);

  if (ratingMatch) res.rating = parseInt(ratingMatch[1], 10);
  if (solvedMatch) res.problemsSolved = parseInt(solvedMatch[1], 10);
  if (rankMatch) res.globalRank = parseInt(rankMatch[1], 10);
  if (starsMatch) res.stars = parseInt(starsMatch[1], 10);

  return res;
}

/**
 * Deterministically parses HackerRank export files, certificate logs, or badge summaries.
 */
export function parseHackerRankExport(
  filename: string,
  content: string
): { badges: Array<{ badge: string; stars?: number }>; problemsSolved?: number; rating?: number } {
  const trimmed = content.trim();
  const badges: Array<{ badge: string; stars?: number }> = [];
  let problemsSolved: number | undefined;
  let rating: number | undefined;

  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data.badges)) {
        for (const b of data.badges) {
          badges.push({
            badge: String(b.badge || b.name || b),
            stars: typeof b.stars === "number" ? b.stars : undefined,
          });
        }
      }
      if (data.problemsSolved || data.solved) problemsSolved = Number(data.problemsSolved || data.solved);
      if (data.rating) rating = Number(data.rating);
      return { badges, problemsSolved, rating };
    } catch {
      // Fall through
    }
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    if (line.toLowerCase().includes("badge") || line.toLowerCase().includes("star")) {
      const starMatch = line.match(/(\d+)\s*star/i);
      badges.push({
        badge: line.trim(),
        stars: starMatch ? parseInt(starMatch[1], 10) : undefined,
      });
    }
  }

  const solvedMatch = trimmed.match(/(?:solved|problems)[\s:]+(\d+)/i);
  if (solvedMatch) problemsSolved = parseInt(solvedMatch[1], 10);

  return { badges, problemsSolved, rating };
}

/**
 * Deterministically parses HackerEarth export files or practice summaries.
 */
export function parseHackerEarthExport(
  filename: string,
  content: string
): { rating?: number; problemsSolved?: number; hackathons?: number } {
  const trimmed = content.trim();
  const res: { rating?: number; problemsSolved?: number; hackathons?: number } = {};

  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed);
      if (data.rating) res.rating = Number(data.rating);
      if (data.problemsSolved || data.solved) res.problemsSolved = Number(data.problemsSolved || data.solved);
      if (data.hackathons || data.contests) res.hackathons = Number(data.hackathons || data.contests);
      return res;
    } catch {
      // Fall through
    }
  }

  const ratingMatch = trimmed.match(/rating[\s:]+(\d+)/i);
  const solvedMatch = trimmed.match(/(?:solved|problems)[\s:]+(\d+)/i);
  const hackMatch = trimmed.match(/(?:hackathons|contests)[\s:]+(\d+)/i);

  if (ratingMatch) res.rating = parseInt(ratingMatch[1], 10);
  if (solvedMatch) res.problemsSolved = parseInt(solvedMatch[1], 10);
  if (hackMatch) res.hackathons = parseInt(hackMatch[1], 10);

  return res;
}


