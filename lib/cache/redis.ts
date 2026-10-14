/**
 * Minimal Upstash Redis REST client (pipeline endpoint). Shared by the AI
 * quota (lib/intelligence/cost-control.ts) and the connector circuit breaker
 * (lib/connectors/rate-limiter.ts). Not configured => callers use their
 * in-process fallback; that fallback is per-instance, so production must set
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 */

export type RedisCommand = (string | number)[];

export class RedisUnavailableError extends Error {}

export function isRedisConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/** Runs commands in one round trip. Each command's result, or throws RedisUnavailableError. */
export async function redisPipeline(commands: RedisCommand[], timeoutMs = 800): Promise<unknown[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new RedisUnavailableError("Redis is not configured.");
  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands.map((c) => c.map(String))),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new RedisUnavailableError(`Redis request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!res.ok) throw new RedisUnavailableError(`Redis REST HTTP ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: string }[];
  const failed = body.find((entry) => entry.error);
  if (failed) throw new RedisUnavailableError(`Redis command error: ${failed.error}`);
  return body.map((entry) => entry.result);
}
