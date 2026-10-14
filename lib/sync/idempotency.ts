/**
 * Request-level idempotency for writes that are not sync operations, e.g. a
 * CV upload (Task 1.9.1). The first request claims the key (INSERT ... ON
 * CONFLICT DO NOTHING) and stores its response; a duplicate (double-click,
 * client retry after a timeout) gets that same response instead of creating
 * a second document and job.
 */
import crypto from "crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb, idempotencyKeys } from "@/lib/db";

export function contentIdempotencyKey(personId: string, scope: string, content: Buffer | string, windowMs = 10 * 60_000, now = Date.now()) {
  const digest = crypto.createHash("sha256").update(content).digest("hex");
  return crypto.createHash("sha256").update(`${personId}|${scope}|${digest}|${Math.floor(now / windowMs)}`).digest("hex");
}

export function requestIdempotencyKey(personId: string, scope: string, clientKey: string) {
  return crypto.createHash("sha256").update(`${personId}|${scope}|req:${clientKey}`).digest("hex");
}

/**
 * Runs `fn` once per key. Concurrent duplicates wait (up to `waitMs`) for the
 * first one's stored response. If the first one failed, its claim is released
 * so a retry can run.
 */
export async function withIdempotency<T extends Record<string, unknown>>(
  params: { key: string; personId: string; scope: string; waitMs?: number },
  fn: () => Promise<T>
): Promise<{ response: T; replayed: boolean }> {
  const db = await getDb();
  const [claimed] = await db
    .insert(idempotencyKeys)
    .values({ key: params.key, personId: params.personId, scope: params.scope, createdAt: new Date() })
    .onConflictDoNothing()
    .returning();
  if (claimed) {
    try {
      const response = await fn();
      await db.update(idempotencyKeys).set({ response, completedAt: new Date() }).where(eq(idempotencyKeys.key, params.key));
      return { response, replayed: false };
    } catch (error) {
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, params.key)); // let a retry run
      throw error;
    }
  }
  const deadline = Date.now() + (params.waitMs ?? 8000);
  while (Date.now() < deadline) {
    const [row] = await db.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.key, params.key), eq(idempotencyKeys.personId, params.personId))).limit(1);
    if (!row) return withIdempotency(params, fn); // the first attempt failed and released the key
    if (row.response) return { response: row.response as T, replayed: true };
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("An identical request is still being processed. Try again in a moment.");
}

/** Housekeeping: keys older than a day are no longer needed. */
export async function purgeOldIdempotencyKeys(olderThanMs = 24 * 60 * 60 * 1000) {
  const db = await getDb();
  await db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, sql`now() - ${`${Math.round(olderThanMs / 1000)} seconds`}::interval`));
}
