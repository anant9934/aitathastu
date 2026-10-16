/**
 * The base every scraper/import runs through (Tasks 1.9.1, 1.9.2, 1.9.4):
 *
 *  - Idempotency: an operation is keyed by sha256(person | source | trigger
 *    bucket or client request id). Starting a sync whose key already exists,
 *    or while another operation for the same (person, source) is in flight,
 *    returns that operation instead of running the work again. Exactly one
 *    worker can claim a queued operation (compare-and-swap on `state`).
 *  - Correlation: each operation gets a correlation ID, stored on the row,
 *    put on every log line (top-level JSON field) and offered to the work as
 *    an outbound header.
 *  - Dead letters: a failure past the source's max attempts, or a
 *    non-retryable error, moves the operation to terminal `dead_letter` with
 *    its last error kept; only an explicit user retry re-queues it.
 *
 * Every statement is single-shot (no interactive transaction), so this runs
 * on the Neon HTTP driver as well as postgres-js and PGlite.
 */
import crypto from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, syncOperations } from "@/lib/db";
import { CORRELATION_HEADER, generateCorrelationId, logger, type Logger } from "@/lib/logger";
import { transition, type SourceSyncState, type SyncSource, type TransitionTrigger } from "./state-machine";
import { SOURCE_SYNC_POLICY, USER_TRIGGER_DEDUPE_WINDOW_MS, retryBackoffMs } from "./policy";
import { invalidateStudentCache } from "../cache/response-cache";

export type SyncOperationRow = typeof syncOperations.$inferSelect;
export type SyncTrigger = Extract<TransitionTrigger, "user" | "scheduler">;

const ACTIVE: SourceSyncState[] = ["queued", "running", "awaiting_user"];

export class SyncError extends Error {
  constructor(message: string, readonly code: string, readonly retryable = true) {
    super(message);
  }
}

export function syncIdempotencyKey(params: { personId: string; source: SyncSource; trigger: SyncTrigger; requestId?: string; now?: number }) {
  const now = params.now ?? Date.now();
  const scope = params.requestId
    ? `req:${params.requestId}`
    : params.trigger === "user"
      ? `user:${Math.floor(now / USER_TRIGGER_DEDUPE_WINDOW_MS)}`
      // A scheduled refresh runs at most once per TTL bucket.
      : `cron:${Math.floor(now / Math.max(SOURCE_SYNC_POLICY[params.source].ttlMs, USER_TRIGGER_DEDUPE_WINDOW_MS))}`;
  return crypto.createHash("sha256").update(`${params.personId}|${params.source}|${scope}`).digest("hex");
}

export type StartResult = { operation: SyncOperationRow; deduplicated: boolean };

/** Creates the operation in `queued`, or returns the one this request duplicates. */
export async function startSyncOperation(params: { personId: string; source: SyncSource; trigger: SyncTrigger; requestId?: string; now?: number }): Promise<StartResult> {
  const db = await getDb();
  const idempotencyKey = syncIdempotencyKey(params);
  const now = new Date(params.now ?? Date.now());
  const [created] = await db
    .insert(syncOperations)
    .values({
      id: `syncop_${crypto.randomUUID()}`,
      personId: params.personId,
      source: params.source,
      idempotencyKey,
      correlationId: generateCorrelationId("sync"),
      trigger: params.trigger,
      state: transition("not_started", "queued", params.trigger),
      maxAttempts: SOURCE_SYNC_POLICY[params.source].maxAttempts,
      createdAt: now,
      updatedAt: now,
    })
    // Either unique index (idempotency key, or one active op per person+source) dedupes.
    .onConflictDoNothing()
    .returning();
  if (created) return { operation: created, deduplicated: false };

  const [existing] = await db
    .select()
    .from(syncOperations)
    .where(eq(syncOperations.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing) return { operation: existing, deduplicated: true };
  const [active] = await db
    .select()
    .from(syncOperations)
    .where(and(eq(syncOperations.personId, params.personId), eq(syncOperations.source, params.source), inArray(syncOperations.state, ACTIVE)))
    .limit(1);
  if (active) return { operation: active, deduplicated: true };
  throw new Error(`Sync operation for ${params.source} conflicted but no existing operation was found.`);
}

/** queued -> running for exactly one caller; null for every other caller. */
export async function claimSyncOperation(operation: SyncOperationRow): Promise<SyncOperationRow | null> {
  const db = await getDb();
  const [claimed] = await db
    .update(syncOperations)
    .set({ state: transition("queued", "running", "worker"), attempts: operation.attempts + 1, startedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(syncOperations.id, operation.id), eq(syncOperations.state, "queued"), eq(syncOperations.attempts, operation.attempts)))
    .returning();
  return claimed ?? null;
}

/**
 * Compare-and-swap state change validated by the state machine. Exported for
 * syncs that span several requests (LinkedIn OTP relay: running ->
 * awaiting_user -> running -> succeeded), which cannot use executeSyncOperation.
 */
export function transitionOperation(operation: SyncOperationRow, to: SourceSyncState, by: TransitionTrigger, extra: Partial<SyncOperationRow> = {}) {
  return setState(operation, to, by, extra);
}

/** Merges into `result` without a state change (e.g. remembering a worker session id). */
export async function setOperationResult(operation: SyncOperationRow, patch: Record<string, unknown>) {
  const db = await getDb();
  const [row] = await db
    .update(syncOperations)
    .set({ result: { ...((operation.result as Record<string, unknown>) || {}), ...patch }, updatedAt: new Date() })
    .where(and(eq(syncOperations.id, operation.id), eq(syncOperations.state, operation.state)))
    .returning();
  if (!row) throw new Error(`Sync operation ${operation.id} changed state concurrently (expected ${operation.state}).`);
  // The dashboard shows sync state and what was imported (Task 2.6.1).
  await invalidateStudentCache(row.personId);
  return row;
}

async function setState(operation: SyncOperationRow, to: SourceSyncState, by: TransitionTrigger, extra: Partial<SyncOperationRow> = {}) {
  const db = await getDb();
  const [row] = await db
    .update(syncOperations)
    .set({ state: transition(operation.state as SourceSyncState, to, by), updatedAt: new Date(), ...extra })
    .where(and(eq(syncOperations.id, operation.id), eq(syncOperations.state, operation.state)))
    .returning();
  if (!row) throw new Error(`Sync operation ${operation.id} changed state concurrently (expected ${operation.state}).`);
  // The dashboard shows sync state and what was imported (Task 2.6.1).
  await invalidateStudentCache(row.personId);
  return row;
}

export function completeSyncOperation(operation: SyncOperationRow, outcome: "succeeded" | "partial", result: Record<string, unknown>) {
  return setState(operation, outcome, "worker", { result, finishedAt: new Date(), lastError: null, lastErrorCode: null, nextAttemptAt: null });
}

/**
 * Records a failed attempt. Retryable errors under the attempt limit become
 * `failed`/`timed_out` with a backoff; anything else becomes `dead_letter`.
 */
export function failSyncOperation(operation: SyncOperationRow, error: unknown, opts: { timedOut?: boolean; now?: number } = {}) {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
  const code = error instanceof SyncError ? error.code : opts.timedOut ? "timeout" : "unexpected_error";
  const retryable = error instanceof SyncError ? error.retryable : true;
  const exhausted = operation.attempts >= operation.maxAttempts;
  const now = opts.now ?? Date.now();
  if (!retryable || exhausted) {
    return setState(operation, "dead_letter", "worker", {
      lastError: message, lastErrorCode: exhausted && retryable ? `max_attempts_exceeded:${code}` : code,
      finishedAt: new Date(now), nextAttemptAt: null,
    });
  }
  return setState(operation, opts.timedOut ? "timed_out" : "failed", "worker", {
    lastError: message, lastErrorCode: code, nextAttemptAt: new Date(now + retryBackoffMs(operation.attempts)),
  });
}

/**
 * Re-queues an operation. Automatic retries (worker/scheduler) only move
 * failed/timed_out operations whose backoff has elapsed; a dead letter is
 * re-queued only by the user, with a fresh attempt budget.
 */
export async function retrySyncOperation(operation: SyncOperationRow, by: TransitionTrigger, now = Date.now()) {
  if (by !== "user" && operation.nextAttemptAt && operation.nextAttemptAt.getTime() > now) return null;
  const isDead = operation.state === "dead_letter";
  return setState(operation, "queued", by, {
    ...(isDead ? { attempts: 0 } : {}),
    nextAttemptAt: null,
    finishedAt: null,
  });
}

export async function latestSyncOperations(personId: string) {
  const db = await getDb();
  const rows = await db.select().from(syncOperations).where(eq(syncOperations.personId, personId)).orderBy(desc(syncOperations.createdAt));
  const latest = new Map<string, SyncOperationRow>();
  for (const row of rows) if (!latest.has(row.source)) latest.set(row.source, row);
  return [...latest.values()];
}

export type SyncContext = {
  operation: SyncOperationRow;
  correlationId: string;
  log: Logger;
  /** Merge into outbound request headers where the target API allows custom headers. */
  outboundHeaders: Record<string, string>;
  /** Stable key for this operation's writes; pass to import keys so replays upsert. */
  idempotencyKey: string;
  /** Aborted when the attempt times out; pass to fetch() and check before writing. */
  signal: AbortSignal;
};

export type SyncWorkResult = { outcome: "succeeded" | "partial"; result?: Record<string, unknown> };

export type RunSyncResult = {
  operation: SyncOperationRow;
  /** True when this call did not run the work (duplicate request, or another worker claimed it). */
  deduplicated: boolean;
};

/**
 * start -> claim -> work -> complete | fail. A duplicate request returns the
 * existing operation without running `work`. The attempt is bounded by the
 * source's `attemptTimeoutMs`; overrunning it records `timed_out`.
 */
export async function runSyncOperation(
  params: { personId: string; source: SyncSource; trigger: SyncTrigger; requestId?: string },
  work: (ctx: SyncContext) => Promise<SyncWorkResult>,
  opts: { timeoutMs?: number } = {}
): Promise<RunSyncResult> {
  const { operation, deduplicated } = await startSyncOperation(params);
  if (deduplicated || operation.state !== "queued") return { operation, deduplicated: true };
  return executeSyncOperation(operation, work, opts);
}

/** Claims and runs an already-queued operation (used by retries and the runner above). */
export async function executeSyncOperation(
  queued: SyncOperationRow,
  work: (ctx: SyncContext) => Promise<SyncWorkResult>,
  opts: { timeoutMs?: number } = {}
): Promise<RunSyncResult> {
  const claimed = await claimSyncOperation(queued);
  if (!claimed) return { operation: queued, deduplicated: true };

  const log = logger.child({ correlationId: claimed.correlationId, metadata: { operationId: claimed.id, source: claimed.source, attempt: claimed.attempts } });
  const started = Date.now();
  log.info("sync.attempt.started", { personId: hashId(claimed.personId) });
  const timeoutMs = opts.timeoutMs ?? SOURCE_SYNC_POLICY[claimed.source as SyncSource].attemptTimeoutMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController();
  try {
    const outcome = await Promise.race([
      work({
        operation: claimed,
        correlationId: claimed.correlationId,
        log,
        outboundHeaders: { [CORRELATION_HEADER]: claimed.correlationId },
        idempotencyKey: claimed.idempotencyKey,
        signal: abort.signal,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          abort.abort();
          reject(new SyncTimeout(timeoutMs));
        }, timeoutMs);
      }),
    ]);
    const done = await completeSyncOperation(claimed, outcome.outcome, outcome.result || {});
    log.info("sync.attempt.finished", { status: done.state, durationMs: Date.now() - started });
    return { operation: done, deduplicated: false };
  } catch (error) {
    const failed = await failSyncOperation(claimed, error, { timedOut: error instanceof SyncTimeout });
    log.warn("sync.attempt.failed", { status: failed.state, durationMs: Date.now() - started, error: failed.lastError ?? undefined, metadata: { errorCode: failed.lastErrorCode } });
    return { operation: failed, deduplicated: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class SyncTimeout extends Error {
  constructor(ms: number) {
    super(`Sync attempt exceeded its ${ms} ms budget.`);
  }
}

function hashId(id: string) {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 12);
}
