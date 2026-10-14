/**
 * AI cost control shared by every serverless instance (Task 1.7.1).
 *
 * Counters live in Upstash Redis so all instances see the same totals:
 *   ai:usage:{personId}:{YYYY-MM-DD}     tokens used by one person today
 *   ai:requests:{personId}:{YYYY-MM-DD}  LLM calls by one person today
 *   ai:usage:global:{YYYY-MM-DD}         LLM calls platform-wide today   (CLOUD_AI_GLOBAL_DAILY_LIMIT)
 *   ai:usage:global:{YYYY-MM}            LLM calls platform-wide this month (CLOUD_AI_GLOBAL_MONTHLY_LIMIT)
 *
 * A call first *reserves* its estimated tokens with one atomic INCRBY
 * pipeline; if any counter is now over its limit the reservation is refunded
 * and the call is denied. Concurrent callers therefore cannot all slip under
 * the limit. After the call, `settleAiQuota` corrects the estimate to the real
 * token count, or `releaseAiQuota` refunds a call that never reached a model.
 *
 * Without Redis (local dev, tests, or a Redis outage) the same logic runs in
 * process memory: correct per instance, not across instances.
 */
import { isRedisConfigured, redisPipeline, RedisUnavailableError } from "@/lib/cache/redis";
import { logger } from "@/lib/logger";

export interface TokenUsageRecord {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export const MAX_DAILY_TOKENS_PER_USER = 50_000;
export const MAX_DAILY_REQUESTS_PER_USER = 50;

const DAY_TTL_S = 2 * 24 * 60 * 60;
const MONTH_TTL_S = 32 * 24 * 60 * 60;

function limitFromEnv(name: string): number | null {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Estimates token count from text using standard heuristics (~4 chars/token). */
export function estimateTokens(text: string): number {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}

export type QuotaReservation = {
  allowed: boolean;
  reason?: string;
  /** Which limit refused the call, for the caller's 429 message. */
  limit?: "user_tokens" | "user_requests" | "global_daily" | "global_monthly";
  personId: string;
  reservedTokens: number;
  day: string;
  month: string;
  backend: "redis" | "memory";
};

function keys(personId: string, day: string, month: string) {
  return {
    userTokens: `ai:usage:${personId}:${day}`,
    userRequests: `ai:requests:${personId}:${day}`,
    globalDay: `ai:usage:global:${day}`,
    globalMonth: `ai:usage:global:${month}`,
  };
}

// In-process fallback store (per instance).
const memory = new Map<string, number>();
const memIncr = (key: string, by: number) => {
  const next = (memory.get(key) || 0) + by;
  memory.set(key, next);
  return next;
};

type Counts = [userTokens: number, userRequests: number, globalDay: number, globalMonth: number];

async function increment(k: ReturnType<typeof keys>, tokens: number, requests: number): Promise<{ counts: Counts; backend: "redis" | "memory" }> {
  if (isRedisConfigured()) {
    try {
      const r = await redisPipeline([
        ["INCRBY", k.userTokens, tokens], ["EXPIRE", k.userTokens, DAY_TTL_S],
        ["INCRBY", k.userRequests, requests], ["EXPIRE", k.userRequests, DAY_TTL_S],
        ["INCRBY", k.globalDay, requests], ["EXPIRE", k.globalDay, DAY_TTL_S],
        ["INCRBY", k.globalMonth, requests], ["EXPIRE", k.globalMonth, MONTH_TTL_S],
      ]);
      return { counts: [Number(r[0]), Number(r[2]), Number(r[4]), Number(r[6])], backend: "redis" };
    } catch (error) {
      if (!(error instanceof RedisUnavailableError)) throw error;
      logger.warn("ai_quota_redis_unavailable", { error: error.message, metadata: { fallback: "memory" } });
    }
  }
  return {
    counts: [memIncr(k.userTokens, tokens), memIncr(k.userRequests, requests), memIncr(k.globalDay, requests), memIncr(k.globalMonth, requests)],
    backend: "memory",
  };
}

/**
 * Reserves quota for one LLM call. Every LLM call site must call this first
 * and must not call a provider when `allowed` is false.
 */
export async function reserveAiQuota(personId: string | undefined, estimatedTokens: number, now = new Date()): Promise<QuotaReservation> {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const subject = personId || "anonymous";
  const k = keys(subject, day, month);
  const tokens = Math.max(1, Math.ceil(estimatedTokens));
  const { counts, backend } = await increment(k, tokens, 1);
  const [userTokens, userRequests, globalDay, globalMonth] = counts;
  const globalDailyLimit = limitFromEnv("CLOUD_AI_GLOBAL_DAILY_LIMIT");
  const globalMonthlyLimit = limitFromEnv("CLOUD_AI_GLOBAL_MONTHLY_LIMIT");

  const refusal: Pick<QuotaReservation, "limit" | "reason"> | null =
    globalMonthlyLimit !== null && globalMonth > globalMonthlyLimit ? { limit: "global_monthly", reason: "The platform's monthly AI budget is used up." }
    : globalDailyLimit !== null && globalDay > globalDailyLimit ? { limit: "global_daily", reason: "The platform's daily AI budget is used up; it resets at 00:00 UTC." }
    : userRequests > MAX_DAILY_REQUESTS_PER_USER ? { limit: "user_requests", reason: `You've reached today's limit of ${MAX_DAILY_REQUESTS_PER_USER} AI requests; it resets at 00:00 UTC.` }
    : userTokens > MAX_DAILY_TOKENS_PER_USER ? { limit: "user_tokens", reason: `You've reached today's AI usage limit (${MAX_DAILY_TOKENS_PER_USER.toLocaleString("en-US")} tokens); it resets at 00:00 UTC.` }
    : null;

  const reservation: QuotaReservation = { allowed: !refusal, ...refusal, personId: subject, reservedTokens: tokens, day, month, backend };
  if (refusal) await increment(k, -tokens, -1); // refund: a denied call consumes nothing
  return reservation;
}

/** Corrects a granted reservation to the tokens the provider actually reported. */
export async function settleAiQuota(reservation: QuotaReservation, actualTokens: number) {
  if (!reservation.allowed) return;
  const delta = Math.ceil(actualTokens) - reservation.reservedTokens;
  if (delta !== 0) await increment(keys(reservation.personId, reservation.day, reservation.month), delta, 0);
}

/** Refunds a granted reservation whose call never produced output (all providers failed). */
export async function releaseAiQuota(reservation: QuotaReservation) {
  if (!reservation.allowed) return;
  await increment(keys(reservation.personId, reservation.day, reservation.month), -reservation.reservedTokens, -1);
}

/** Test helper: clears the in-process fallback store. */
export function resetAiQuotaMemoryForTesting() {
  memory.clear();
}
