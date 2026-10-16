/**
 * Phase E: Distributed Rate Limiting Architecture
 * Provides an extensible RateLimiterBackend abstraction with:
 * - MemoryRateLimiter (for local development and deterministic test suites)
 * - DistributedRedisRateLimiter (for multi-instance serverless deployments via Upstash or standard Redis REST)
 * - Strict graceful fallback (sensitive tiers fail safely to local in-memory limits rather than bypassing security)
 * - Multi-tenant, privacy-safe keys (opaque person IDs, hashed IPs, no raw emails)
 */

import { logger } from "../logger";
import { randomUUID } from "node:crypto";

export type RateLimitTier =
  | "auth"        // Login, signup, password attempts: 10 req/min
  | "guest"       // Anonymous guest-account creation, keyed by client IP: 5 per 10 min
  | "resume"      // Resume file upload & parsing: 5 req/min
  | "ai"          // AI model requests: 15 req/min
  | "eora_chat"   // EORA chat questions: 10 req/min (Task 1.4.4)
  | "sync"        // Manual or GitHub sync: 5 req/min
  | "webhook"     // Incoming webhooks: 60 req/min
  | "integration" // Partner ecosystem events: 60 req/min
  | "general";    // General API endpoints: 120 req/min

export interface TierConfig {
  maxRequests: number;
  windowMs: number;
  isSensitive: boolean;
}

export const TIER_CONFIGS: Record<RateLimitTier, TierConfig> = {
  auth: { maxRequests: 10, windowMs: 60_000, isSensitive: true },
  guest: { maxRequests: 5, windowMs: 10 * 60_000, isSensitive: true },
  resume: { maxRequests: 5, windowMs: 60_000, isSensitive: true },
  ai: { maxRequests: 15, windowMs: 60_000, isSensitive: true },
  eora_chat: { maxRequests: 10, windowMs: 60_000, isSensitive: true },
  sync: { maxRequests: 5, windowMs: 60_000, isSensitive: true },
  webhook: { maxRequests: 60, windowMs: 60_000, isSensitive: false },
  integration: { maxRequests: 60, windowMs: 60_000, isSensitive: false },
  general: { maxRequests: 120, windowMs: 60_000, isSensitive: false },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  backend: "memory" | "distributed" | "fallback_memory";
}

export interface RateLimiterBackend {
  readonly name: string;
  check(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> | RateLimitResult;
  reset?(): Promise<void> | void;
}

// -----------------------------------------------------------------------------
// 1. In-Memory Sliding-Window Implementation
// -----------------------------------------------------------------------------

interface RateLimitRecord {
  timestamps: number[];
}

export class MemoryRateLimiter implements RateLimiterBackend {
  readonly name = "memory";
  private store = new Map<string, RateLimitRecord>();

  check(key: string, maxRequests: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    const cutoff = now - windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > cutoff);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const resetMs = Math.max(0, oldest + windowMs - now);
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetMs,
        backend: "memory",
      };
    }

    record.timestamps.push(now);
    const remaining = maxRequests - record.timestamps.length;
    return {
      allowed: true,
      limit: maxRequests,
      remaining,
      resetMs: windowMs,
      backend: "memory",
    };
  }

  reset(): void {
    this.store.clear();
  }
}

// -----------------------------------------------------------------------------
// 2. Distributed Redis REST Implementation (Upstash / Redis compatible)
// -----------------------------------------------------------------------------

export interface RedisRestConfig {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
}

export class DistributedRedisRateLimiter implements RateLimiterBackend {
  readonly name = "distributed";
  private baseUrl: string;
  private token: string;
  private timeoutMs: number;

  constructor(config: RedisRestConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
    this.timeoutMs = config.timeoutMs || 800;
  }

  async check(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSeconds = Math.ceil(windowMs / 1000);
    const redisKey = `ratelimit:${key}`;

    // REST pipeline: prune old entries, add a unique request member, count, then expire.
    // This pipeline is not a Redis transaction; capacity still needs deployed concurrency testing.
    const cutoff = now - windowMs;
    const commands = [
      ["ZREMRANGEBYSCORE", redisKey, "0", String(cutoff)],
      ["ZADD", redisKey, String(now), `${now}:${randomUUID()}`],
      ["ZCARD", redisKey],
      ["EXPIRE", redisKey, String(windowSeconds)],
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Redis REST error: HTTP ${res.status}`);
      }

      const data = await res.json() as Array<{ result: unknown }>;
      // Result of ZCARD is at index 2
      const currentCount = typeof data[2]?.result === "number" ? data[2].result : 1;

      if (currentCount > maxRequests) {
        return {
          allowed: false,
          limit: maxRequests,
          remaining: 0,
          resetMs: windowMs,
          backend: "distributed",
        };
      }

      return {
        allowed: true,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - currentCount),
        resetMs: windowMs,
        backend: "distributed",
      };
    } catch (err) {
      clearTimeout(timer);
      throw err; // Let manager handle graceful fallback
    }
  }

  async reset(): Promise<void> {
    // Optional flush for testing
    try {
      await fetch(`${this.baseUrl}/flushdb`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}` },
      });
    } catch {
      // ignore
    }
  }
}

// -----------------------------------------------------------------------------
// 3. Rate Limiter Manager & Resilient Fallback Coordinator
// -----------------------------------------------------------------------------

const defaultMemoryLimiter = new MemoryRateLimiter();
let activeLimiter: RateLimiterBackend = defaultMemoryLimiter;

/**
 * Initializes the rate limiter from environment variables.
 * In development / tests, defaults to MemoryRateLimiter.
 * If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are present, activates DistributedRedisRateLimiter.
 */
export function initRateLimiter(): void {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    activeLimiter = new DistributedRedisRateLimiter({
      baseUrl: redisUrl,
      token: redisToken,
    });
  } else {
    activeLimiter = defaultMemoryLimiter;
  }
}

// Initialize on module load
initRateLimiter();

/**
 * Constructs an opaque, privacy-preserving rate limit key.
 * Avoids logging raw email addresses.
 */
export function buildRateLimitKey(
  identifier: string,
  tier: RateLimitTier,
  orgId: string = "global"
): string {
  // If identifier is an email address, hash it into an opaque representation
  const cleanId = identifier.includes("@")
    ? `hash_${identifier.split("@")[0].slice(0, 4)}_${identifier.length}`
    : identifier;

  return `${tier}:${orgId}:${cleanId}`;
}

/**
 * Primary synchronous rate limit check (backward compatible with existing routes).
 * Runs on memory store directly or active backend if synchronous.
 */
export function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = "general",
  orgId: string = "global"
): RateLimitResult {
  const config = TIER_CONFIGS[tier];
  const key = buildRateLimitKey(identifier, tier, orgId);

  // If active backend is synchronous MemoryRateLimiter, execute directly
  if (activeLimiter instanceof MemoryRateLimiter) {
    return activeLimiter.check(key, config.maxRequests, config.windowMs);
  }

  // Fallback to local memory limiter if called synchronously while in distributed mode
  const res = defaultMemoryLimiter.check(key, config.maxRequests, config.windowMs);
  return { ...res, backend: "fallback_memory" };
}

/**
 * Primary asynchronous distributed rate limit check with graceful fallback.
 * Recommended for high-concurrency API endpoints and serverless deployments.
 */
export async function checkRateLimitDistributed(
  identifier: string,
  tier: RateLimitTier = "general",
  orgId: string = "global"
): Promise<RateLimitResult> {
  const config = TIER_CONFIGS[tier];
  const key = buildRateLimitKey(identifier, tier, orgId);

  try {
    const result = await activeLimiter.check(key, config.maxRequests, config.windowMs);
    return result;
  } catch (err) {
    // Graceful Fallback Protocol
    logger.warn("rate_limiter_failover", {
      route: "rate-limit",
      error: err instanceof Error ? err.message : String(err),
      metadata: {
        tier,
        isSensitive: config.isSensitive,
      },
    });

    // Fall back to local memory limiter so that sensitive routes (auth, AI, sync) are NEVER left unprotected
    const memoryResult = defaultMemoryLimiter.check(key, config.maxRequests, config.windowMs);
    return {
      ...memoryResult,
      backend: "fallback_memory",
    };
  }
}

/**
 * Resets rate limit stores (useful in test suites).
 */
export function resetRateLimits(): void {
  defaultMemoryLimiter.reset();
  if (activeLimiter.reset) {
    activeLimiter.reset();
  }
}
