/**
 * AI TATHASTU — V3.2 LEETCODE CONNECTOR & STATS EXTRACTOR
 *
 * Permitted Acquisition Method:
 * - Public GraphQL Endpoint: https://leetcode.com/graphql
 * - Queries public competitive problem-solving metrics without requiring private student credentials.
 * - Handles rate-limits (HTTP 429), timeouts, and private profiles gracefully by falling back to
 *   verified profile reference linking.
 * - Trust Level: 'SOURCE_DETECTED' (public competitive statistics).
 * - Never fabricates counts, rankings, or contest ratings.
 */

export interface LeetCodeStats {
  username: string;
  profileUrl: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  globalRanking: number | null;
  reputation: number | null;
  realName: string | null;
  retrievedAt: string;
  acquisitionStatus: "LIVE_VERIFIED" | "PROFILE_LINK_ONLY" | "RATE_LIMITED" | "NOT_FOUND";
  error?: string;
}

const LEETCODE_GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";

const USER_PROFILE_QUERY = `
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      ranking
      reputation
      realName
    }
    submitStats {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
}
`;

/**
 * Validates and sanitizes a LeetCode username or profile URL.
 */
export function normalizeLeetCodeUsername(input: string): string {
  const trimmed = input.trim();
  const withoutUrl = trimmed
    .replace(/^https?:\/\/(www\.)?leetcode\.com\/(u\/)?/i, "")
    .replace(/\/$/, "");
  return withoutUrl.replace(/[^a-zA-Z0-9_\-]/g, "");
}

/**
 * Fetches public LeetCode statistics using the permitted public GraphQL API.
 */
export async function fetchLeetCodeProfileStats(rawInput: string): Promise<LeetCodeStats> {
  const username = normalizeLeetCodeUsername(rawInput);
  const profileUrl = `https://leetcode.com/u/${username}`;
  const now = new Date().toISOString();

  if (!username) {
    return {
      username: "",
      profileUrl: "",
      totalSolved: 0,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0,
      globalRanking: null,
      reputation: null,
      realName: null,
      retrievedAt: now,
      acquisitionStatus: "NOT_FOUND",
      error: "Username cannot be empty.",
    };
  }

  try {
    const res = await fetch(LEETCODE_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "AI-Tathastu-ProfileAuditor/1.0",
      },
      body: JSON.stringify({
        query: USER_PROFILE_QUERY,
        variables: { username },
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.status === 429) {
      return {
        username,
        profileUrl,
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        globalRanking: null,
        reputation: null,
        realName: null,
        retrievedAt: now,
        acquisitionStatus: "RATE_LIMITED",
        error: "LeetCode public endpoint rate-limited the request. Profile linked as reference.",
      };
    }

    if (!res.ok) {
      return {
        username,
        profileUrl,
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        globalRanking: null,
        reputation: null,
        realName: null,
        retrievedAt: now,
        acquisitionStatus: "PROFILE_LINK_ONLY",
        error: `LeetCode endpoint returned HTTP status ${res.status}.`,
      };
    }

    const data = await res.json();
    const matchedUser = data?.data?.matchedUser;

    if (!matchedUser) {
      return {
        username,
        profileUrl,
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        globalRanking: null,
        reputation: null,
        realName: null,
        retrievedAt: now,
        acquisitionStatus: "PROFILE_LINK_ONLY",
        error: "User not found or profile is marked private on LeetCode.",
      };
    }

    const subStats = matchedUser.submitStats?.acSubmissionNum || [];
    let totalSolved = 0;
    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;

    for (const item of subStats) {
      const diff = (item.difficulty || "").toLowerCase();
      const count = Number(item.count) || 0;
      if (diff === "all") totalSolved = count;
      else if (diff === "easy") easySolved = count;
      else if (diff === "medium") mediumSolved = count;
      else if (diff === "hard") hardSolved = count;
    }

    // In case "All" was missing, sum up
    if (totalSolved === 0 && (easySolved > 0 || mediumSolved > 0 || hardSolved > 0)) {
      totalSolved = easySolved + mediumSolved + hardSolved;
    }

    const ranking = matchedUser.profile?.ranking ? Number(matchedUser.profile.ranking) : null;
    const reputation = matchedUser.profile?.reputation ? Number(matchedUser.profile.reputation) : null;
    const realName = matchedUser.profile?.realName || null;

    return {
      username: matchedUser.username || username,
      profileUrl,
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      globalRanking: ranking,
      reputation,
      realName,
      retrievedAt: now,
      acquisitionStatus: "LIVE_VERIFIED",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Network failure contacting LeetCode.";
    return {
      username,
      profileUrl,
      totalSolved: 0,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0,
      globalRanking: null,
      reputation: null,
      realName: null,
      retrievedAt: now,
      acquisitionStatus: "PROFILE_LINK_ONLY",
      error: `Network timeout or error (${errorMsg}). Profile saved as reference link.`,
    };
  }
}
