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

import { connectorFetch, isServeFromCacheError } from "@/lib/connectors/rate-limiter";

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
  /** Contest data (Task 1.6.4); null when the user never entered a contest. */
  contestRating?: number | null;
  contestGlobalRanking?: number | null;
  contestsAttended?: number | null;
  badges?: string[];
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
    badges {
      displayName
    }
  }
  userContestRanking(username: $username) {
    rating
    globalRanking
    attendedContestsCount
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
export async function fetchLeetCodeProfileStats(rawInput: string, opts: { correlationId?: string } = {}): Promise<LeetCodeStats> {
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
    // Rate window, circuit breaker and 6 s timeout: lib/connectors/rate-limiter.ts.
    const res = await connectorFetch("leetcode", LEETCODE_GRAPHQL_ENDPOINT, {
      correlationId: opts.correlationId,
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
    const contest = data?.data?.userContestRanking ?? null;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

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
      contestRating: contest ? (num(contest.rating) === null ? null : Math.round(num(contest.rating)!)) : null,
      contestGlobalRanking: contest ? num(contest.globalRanking) : null,
      contestsAttended: contest ? num(contest.attendedContestsCount) : null,
      badges: Array.isArray(matchedUser.badges) ? matchedUser.badges.map((b: { displayName?: string }) => String(b.displayName || "")).filter(Boolean).slice(0, 30) : [],
      retrievedAt: now,
      acquisitionStatus: "LIVE_VERIFIED",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Network failure contacting LeetCode.";
    if (isServeFromCacheError(err)) {
      // No request was sent; the caller serves the saved snapshot.
      return {
        username, profileUrl, totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0,
        globalRanking: null, reputation: null, realName: null, retrievedAt: now,
        acquisitionStatus: "RATE_LIMITED", error: errorMsg,
      };
    }
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

export interface ParsedLeetCodeExport {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  globalRanking: number | null;
  reputation: number | null;
  topicCounts: Record<string, number>;
}

/**
 * Deterministically parses a user-provided LeetCode export file (JSON, CSV, or text log)
 * extracting problem metrics and difficulty distributions without manual data entry.
 */
export function parseLeetCodeExport(filename: string, content: string): ParsedLeetCodeExport {
  const result: ParsedLeetCodeExport = {
    totalSolved: 0,
    easySolved: 0,
    mediumSolved: 0,
    hardSolved: 0,
    globalRanking: null,
    reputation: null,
    topicCounts: {},
  };

  const trimmed = content.trim();

  // 1. JSON handling
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data)) {
        for (const item of data) {
          const diff = String(item.difficulty || "").toLowerCase();
          const status = String(item.status || item.verdict || "accepted").toLowerCase();
          if (status.includes("accept") || status.includes("solv") || !item.status) {
            if (diff === "easy") result.easySolved++;
            else if (diff === "medium") result.mediumSolved++;
            else if (diff === "hard") result.hardSolved++;

            if (item.topic) {
              const t = String(item.topic);
              result.topicCounts[t] = (result.topicCounts[t] || 0) + 1;
            }
          }
        }
        result.totalSolved = result.easySolved + result.mediumSolved + result.hardSolved;
        return result;
      } else if (typeof data === "object" && data !== null) {
        result.totalSolved = Number(data.totalSolved || data.problemsSolved || data.solved) || 0;
        result.easySolved = Number(data.easySolved || data.easy) || 0;
        result.mediumSolved = Number(data.mediumSolved || data.medium) || 0;
        result.hardSolved = Number(data.hardSolved || data.hard) || 0;
        if (data.ranking || data.globalRanking) {
          result.globalRanking = Number(data.ranking || data.globalRanking);
        }
        if (data.reputation) {
          result.reputation = Number(data.reputation);
        }
        if (data.topics && typeof data.topics === "object") {
          result.topicCounts = data.topics;
        }
        if (result.totalSolved === 0 && (result.easySolved || result.mediumSolved || result.hardSolved)) {
          result.totalSolved = result.easySolved + result.mediumSolved + result.hardSolved;
        }
        return result;
      }
    } catch {
      // Fall through to text/CSV
    }
  }

  // 2. CSV / Text parsing
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (filename.toLowerCase().endsWith(".csv") || trimmed.includes(",")) {
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes("easy")) result.easySolved++;
      else if (lower.includes("medium") || lower.includes("med")) result.mediumSolved++;
      else if (lower.includes("hard")) result.hardSolved++;
    }
    if (result.easySolved || result.mediumSolved || result.hardSolved) {
      result.totalSolved = result.easySolved + result.mediumSolved + result.hardSolved;
      return result;
    }
  }

  // 3. Text summary regex fallback
  const solvedMatch = trimmed.match(/(?:solved|total|problems)[\s:]+(\d+)/i);
  const easyMatch = trimmed.match(/easy[\s:]+(\d+)/i);
  const medMatch = trimmed.match(/(?:medium|med)[\s:]+(\d+)/i);
  const hardMatch = trimmed.match(/hard[\s:]+(\d+)/i);
  const rankMatch = trimmed.match(/(?:rank|ranking)[\s:]+(\d+)/i);

  if (solvedMatch) result.totalSolved = parseInt(solvedMatch[1], 10);
  if (easyMatch) result.easySolved = parseInt(easyMatch[1], 10);
  if (medMatch) result.mediumSolved = parseInt(medMatch[1], 10);
  if (hardMatch) result.hardSolved = parseInt(hardMatch[1], 10);
  if (rankMatch) result.globalRanking = parseInt(rankMatch[1], 10);

  if (result.totalSolved === 0 && (result.easySolved || result.mediumSolved || result.hardSolved)) {
    result.totalSolved = result.easySolved + result.mediumSolved + result.hardSolved;
  }

  return result;
}

