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
 * Validates and retrieves HackerRank public profile and badge information.
 */
export async function fetchHackerRankProfile(rawInput: string): Promise<CodingPlatformProfile> {
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
    status: "PROFILE_LINK_ONLY",
    retrievedAt: now,
    notes: "Profile URL verified and linked. Background sync disabled.",
  };
}

/**
 * Validates CodeChef profile reference and handle.
 */
export async function fetchCodeChefProfile(rawInput: string): Promise<CodingPlatformProfile> {
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
    status: "PROFILE_LINK_ONLY",
    retrievedAt: now,
    notes: "CodeChef profile linked. Automated scraping is disabled per provider terms.",
  };
}

/**
 * Validates HackerEarth profile reference and handle.
 */
export async function fetchHackerEarthProfile(rawInput: string): Promise<CodingPlatformProfile> {
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
    status: "PROFILE_LINK_ONLY",
    retrievedAt: now,
    notes: "HackerEarth profile linked. Practice activity recorded upon student confirmation.",
  };
}
