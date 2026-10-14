/**
 * One registry for every external connector's rate limits and circuit
 * breaker (Task 1.7.2). Connectors call `connectorFetch(provider, url, init)`
 * instead of `fetch`:
 *
 *  - Local rate window: a request over the provider's published limit is
 *    refused before it leaves (ConnectorRateLimitedError), so we never earn
 *    an IP ban by finding the limit the hard way.
 *  - Circuit breaker: 3 consecutive 429s / timeouts / network errors open the
 *    circuit for 5 minutes (longer if Retry-After or X-RateLimit-Reset says
 *    so). While open, calls throw CircuitOpenError without touching the
 *    network, and the caller serves its persisted snapshot.
 *  - Each call has a timeout, and forwards X-Correlation-ID where the target
 *    accepts custom headers.
 *
 * State lives in Upstash Redis so every serverless instance shares one view;
 * without Redis it is per-instance memory.
 */
import { isRedisConfigured, redisPipeline, RedisUnavailableError } from "@/lib/cache/redis";
import { CORRELATION_HEADER, logger } from "@/lib/logger";

export type ConnectorProvider =
  | "github" | "leetcode" | "hackerrank" | "kaggle" | "semantic_scholar" | "openalex" | "orcid"
  | "huggingface" | "devto" | "stackoverflow" | "linkedin_worker";

type ProviderLimits = { maxRequests: number; windowMs: number; timeoutMs: number; forwardCorrelationHeader: boolean };

const MIN = 60_000;
export const CONNECTOR_LIMITS: Record<ConnectorProvider, ProviderLimits> = {
  github:           { maxRequests: 5000, windowMs: 60 * MIN, timeoutMs: 10_000, forwardCorrelationHeader: true },
  semantic_scholar: { maxRequests: 100,  windowMs: 5 * MIN,  timeoutMs: 10_000, forwardCorrelationHeader: false },
  leetcode:         { maxRequests: 20,   windowMs: MIN,      timeoutMs: 6_000,  forwardCorrelationHeader: false },
  hackerrank:       { maxRequests: 30,   windowMs: MIN,      timeoutMs: 5_000,  forwardCorrelationHeader: false },
  kaggle:           { maxRequests: 30,   windowMs: MIN,      timeoutMs: 6_000,  forwardCorrelationHeader: false },
  // OpenAlex polite pool allows 10 req/s; stay well under it.
  openalex:         { maxRequests: 100,  windowMs: MIN,      timeoutMs: 10_000, forwardCorrelationHeader: false },
  orcid:            { maxRequests: 60,   windowMs: MIN,      timeoutMs: 6_000,  forwardCorrelationHeader: false },
  huggingface:      { maxRequests: 60,   windowMs: MIN,      timeoutMs: 6_000,  forwardCorrelationHeader: false },
  devto:            { maxRequests: 30,   windowMs: MIN,      timeoutMs: 5_000,  forwardCorrelationHeader: false },
  stackoverflow:    { maxRequests: 30,   windowMs: MIN,      timeoutMs: 5_000,  forwardCorrelationHeader: false },
  // Our own Render worker (status polls during an import): generous budget; header always forwarded.
  linkedin_worker:  { maxRequests: 600,  windowMs: MIN,      timeoutMs: 30_000, forwardCorrelationHeader: true },
};

export const BREAKER_FAILURE_THRESHOLD = 3;
export const BREAKER_OPEN_MS = 5 * MIN;

export class CircuitOpenError extends Error {
  constructor(readonly provider: ConnectorProvider, readonly retryAt: number) {
    super(`${provider} is cooling down after repeated failures; serving saved data until ${new Date(retryAt).toISOString()}.`);
  }
}
export class ConnectorRateLimitedError extends Error {
  constructor(readonly provider: ConnectorProvider) {
    super(`${provider} request budget for this window is used up; serving saved data.`);
  }
}

// ── state (Redis, else memory) ────────────────────────────────────────────
const mem = new Map<string, { value: number; expiresAt: number }>();
function memGet(key: string) {
  const e = mem.get(key);
  if (!e) return 0;
  if (Date.now() > e.expiresAt) { mem.delete(key); return 0; }
  return e.value;
}
function memIncr(key: string, ttlMs: number) {
  const next = memGet(key) + 1;
  mem.set(key, { value: next, expiresAt: mem.get(key)?.expiresAt ?? Date.now() + ttlMs });
  return next;
}

async function withRedis<T>(redis: () => Promise<T>, memory: () => T): Promise<T> {
  if (!isRedisConfigured()) return memory();
  try {
    return await redis();
  } catch (error) {
    if (!(error instanceof RedisUnavailableError)) throw error;
    logger.warn("connector_breaker_redis_unavailable", { error: error.message, metadata: { fallback: "memory" } });
    return memory();
  }
}

const k = (provider: ConnectorProvider) => ({ failures: `cb:${provider}:failures`, openUntil: `cb:${provider}:open_until` });

export async function circuitOpenUntil(provider: ConnectorProvider): Promise<number> {
  const until = await withRedis(
    async () => Number((await redisPipeline([["GET", k(provider).openUntil]]))[0] || 0),
    () => memGet(k(provider).openUntil)
  );
  return until > Date.now() ? until : 0;
}

async function takeRateSlot(provider: ConnectorProvider): Promise<boolean> {
  const { maxRequests, windowMs } = CONNECTOR_LIMITS[provider];
  const key = `rl:${provider}:${Math.floor(Date.now() / windowMs)}`;
  const count = await withRedis(
    async () => Number((await redisPipeline([["INCR", key], ["PEXPIRE", key, windowMs]]))[0]),
    () => memIncr(key, windowMs)
  );
  return count <= maxRequests;
}

async function recordFailure(provider: ConnectorProvider, retryAfterMs?: number) {
  const keys = k(provider);
  const failures = await withRedis(
    async () => Number((await redisPipeline([["INCR", keys.failures], ["PEXPIRE", keys.failures, BREAKER_OPEN_MS * 2]]))[0]),
    () => memIncr(keys.failures, BREAKER_OPEN_MS * 2)
  );
  // A provider telling us when to come back is honoured immediately.
  if (failures >= BREAKER_FAILURE_THRESHOLD || retryAfterMs) {
    const openMs = Math.max(BREAKER_OPEN_MS, retryAfterMs ?? 0);
    const until = Date.now() + openMs;
    await withRedis(
      async () => { await redisPipeline([["SET", keys.openUntil, until, "PX", openMs], ["DEL", keys.failures]]); },
      () => { mem.set(keys.openUntil, { value: until, expiresAt: until }); mem.delete(keys.failures); }
    );
    logger.warn("connector_circuit_opened", { metadata: { provider, failures, openMs } });
  }
}

async function recordSuccess(provider: ConnectorProvider) {
  await withRedis(async () => { await redisPipeline([["DEL", k(provider).failures]]); }, () => { mem.delete(k(provider).failures); });
}

/** Retry-After (seconds or HTTP date) or X-RateLimit-Reset (epoch seconds) → ms from now. */
export function retryAfterFromHeaders(headers: Headers, now = Date.now()): number | undefined {
  const ra = headers.get("retry-after");
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs)) return secs * 1000;
    const at = Date.parse(ra);
    if (!Number.isNaN(at)) return Math.max(0, at - now);
  }
  if (headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(headers.get("x-ratelimit-reset"));
    if (Number.isFinite(reset) && reset > 0) return Math.max(0, reset * 1000 - now);
  }
  return undefined;
}

/**
 * fetch() with the registry's rate window, circuit breaker and timeout.
 * Returns the Response for any HTTP status (callers interpret 404 etc.);
 * throws CircuitOpenError / ConnectorRateLimitedError before sending, and
 * rethrows network/timeout errors after counting them.
 */
export async function connectorFetch(
  provider: ConnectorProvider,
  url: string,
  init: RequestInit & { correlationId?: string; timeoutMs?: number } = {}
): Promise<Response> {
  const openUntil = await circuitOpenUntil(provider);
  if (openUntil) throw new CircuitOpenError(provider, openUntil);
  if (!(await takeRateSlot(provider))) throw new ConnectorRateLimitedError(provider);

  const limits = CONNECTOR_LIMITS[provider];
  const { correlationId, timeoutMs, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (correlationId && limits.forwardCorrelationHeader) headers.set(CORRELATION_HEADER, correlationId);
  const timeout = AbortSignal.timeout(timeoutMs ?? limits.timeoutMs);
  const signal = rest.signal ? AbortSignal.any([rest.signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, signal });
  } catch (error) {
    await recordFailure(provider);
    throw error;
  }
  if (res.status === 429 || res.status === 503 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0")) {
    await recordFailure(provider, retryAfterFromHeaders(res.headers));
  } else if (res.status < 500) {
    await recordSuccess(provider);
  } else {
    await recordFailure(provider);
  }
  return res;
}

/** True when an error means "use the saved snapshot", not "the source is broken". */
export function isServeFromCacheError(error: unknown) {
  return error instanceof CircuitOpenError || error instanceof ConnectorRateLimitedError;
}

/** Test helper. */
export function resetConnectorStateForTesting() {
  mem.clear();
}
