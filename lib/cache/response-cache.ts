/**
 * Per-student response cache for the slow composite reads (Task 2.6.1):
 * /api/student/dashboard, /api/student/skills, /api/student/person-360.
 * Keys are deterministic per person, entries live 120 s, and every mutation
 * that changes what those reads return calls invalidateStudentCache.
 * Fails open: if Redis is not configured or errors, the value is computed
 * fresh and the request still succeeds.
 */
import { isRedisConfigured, redisPipeline } from "./redis";

export const RESPONSE_TTL_SECONDS = 120;

export const studentCacheKeys = (personId: string) => ({
  dashboard: `student:dash:${personId}`,
  skills: `student:skills:${personId}`,
  person360: `student:p360:${personId}`,
});
export type StudentCacheKind = keyof ReturnType<typeof studentCacheKeys>;

/** Returns the cached JSON value for this student and kind, or computes, stores and returns it. */
export async function cachedStudentJson<T>(personId: string, kind: StudentCacheKind, compute: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const key = studentCacheKeys(personId)[kind];
  if (isRedisConfigured()) {
    try {
      const [raw] = await redisPipeline([["GET", key]]);
      if (typeof raw === "string") return { value: JSON.parse(raw) as T, hit: true };
    } catch { /* fail open */ }
  }
  const value = await compute();
  if (isRedisConfigured()) {
    try { await redisPipeline([["SET", key, JSON.stringify(value), "EX", RESPONSE_TTL_SECONDS]]); } catch { /* fail open */ }
  }
  return { value, hit: false };
}

/** Drops every cached read for this student. Call after any write that changes them. */
export async function invalidateStudentCache(personId: string): Promise<void> {
  if (!isRedisConfigured()) return;
  const k = studentCacheKeys(personId);
  try { await redisPipeline([["DEL", k.dashboard, k.skills, k.person360]]); }
  catch (e) { console.warn("[response-cache] invalidation failed; entries expire within 120 s", e instanceof Error ? e.message : e); }
}

/**
 * Wraps a mutating route handler: after a 2xx response, the signed-in
 * student's cached reads are dropped. Applied to every POST/PATCH/PUT/DELETE
 * under /api/student, /api/workspace and /api/onboarding-v2.
 */
export function withStudentCacheInvalidation<A extends unknown[], R extends Response>(handler: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    const response = await handler(...args);
    if (response.status >= 200 && response.status < 300 && isRedisConfigured()) {
      const { getServerAuthContext } = await import("../auth/server-session");
      const auth = await getServerAuthContext().catch(() => null);
      if (auth) await invalidateStudentCache(auth.person.id);
    }
    return response;
  };
}
