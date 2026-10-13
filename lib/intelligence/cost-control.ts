/**
 * AI Cost Control and Usage Accounting for Phase D production readiness.
 * Tracks estimated token usage and enforces per-user / per-day safety limits.
 */

export interface TokenUsageRecord {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

interface UserUsage {
  date: string;
  totalTokens: number;
  requestCount: number;
}

const userDailyUsage = new Map<string, UserUsage>();

// Safety limits
export const MAX_DAILY_TOKENS_PER_USER = 50_000;
export const MAX_DAILY_REQUESTS_PER_USER = 50;

/**
 * Estimates token count from text using standard heuristics (~4 chars/token).
 */
export function estimateTokens(text: string): number {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Checks whether a user is within their daily AI quota.
 */
export function checkAiQuota(personId: string): { allowed: boolean; remainingTokens: number; reason?: string } {
  if (!personId) return { allowed: true, remainingTokens: MAX_DAILY_TOKENS_PER_USER };

  const today = new Date().toISOString().slice(0, 10);
  const usage = userDailyUsage.get(personId);

  if (!usage || usage.date !== today) {
    return { allowed: true, remainingTokens: MAX_DAILY_TOKENS_PER_USER };
  }

  if (usage.totalTokens >= MAX_DAILY_TOKENS_PER_USER) {
    return {
      allowed: false,
      remainingTokens: 0,
      reason: `Daily AI token limit (${MAX_DAILY_TOKENS_PER_USER} tokens) reached. Deterministic fallback will be used.`,
    };
  }

  if (usage.requestCount >= MAX_DAILY_REQUESTS_PER_USER) {
    return {
      allowed: false,
      remainingTokens: 0,
      reason: `Daily AI request limit (${MAX_DAILY_REQUESTS_PER_USER} requests) reached. Deterministic fallback will be used.`,
    };
  }

  return {
    allowed: true,
    remainingTokens: MAX_DAILY_TOKENS_PER_USER - usage.totalTokens,
  };
}

/**
 * Records token consumption for a user.
 */
export function recordAiUsage(personId: string, tokens: number): void {
  if (!personId) return;

  const today = new Date().toISOString().slice(0, 10);
  let usage = userDailyUsage.get(personId);

  if (!usage || usage.date !== today) {
    usage = { date: today, totalTokens: 0, requestCount: 0 };
    userDailyUsage.set(personId, usage);
  }

  usage.totalTokens += tokens;
  usage.requestCount += 1;
}
