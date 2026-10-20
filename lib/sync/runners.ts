/**
 * Retry plumbing for the sync framework (Task 1.9.4): which work function
 * runs an existing operation for each source, the user-facing manual retry,
 * and the scheduled sweep that re-runs failed attempts whose backoff elapsed.
 */
import { and, inArray, lte, asc } from "drizzle-orm";
import { getDb, syncOperations } from "@/lib/db";
import { logger } from "@/lib/logger";
import { aggregateOnboardingStatus, SYNC_SOURCES, type SourceSyncState, type SyncSource } from "./state-machine";
import {
  executeSyncOperation, latestSyncOperations, retrySyncOperation, SyncError,
  type RunSyncResult, type SyncContext, type SyncOperationRow, type SyncWorkResult,
} from "./sync-operation";

type Work = (ctx: SyncContext) => Promise<SyncWorkResult>;
/** Returns the work, or a reason there is nothing to run (e.g. disconnected). */
type Runner = (personId: string) => Promise<Work | { error: string }>;

/** Sources register here as they move onto the framework (Tasks 1.5.x, 1.6.x). */
export const SYNC_RUNNERS: Partial<Record<SyncSource, Runner>> = {
  github: async (personId) => {
    const { prepareGitHubSync } = await import("@/lib/services/github-sync-service");
    const prepared = await prepareGitHubSync(personId);
    return typeof prepared === "function" ? prepared : { error: prepared.error || "GitHub cannot be synced right now." };
  },
  // Footprint sources resolve lazily, so the retry cron needs no extra imports.
  ...Object.fromEntries((["leetcode", "hackerrank", "kaggle", "scholar", "stackoverflow", "portfolio"] as const).map((source) => [source, async (personId: string) => {
    const { resolveFootprintTarget } = await import("./footprint-sync");
    const target = await resolveFootprintTarget(personId, source);
    return target ? target.run : { error: `${source} is not connected.` };
  }])),
};

export function registerSyncRunner(source: SyncSource, runner: Runner) {
  SYNC_RUNNERS[source] = runner;
}

async function runQueued(queued: SyncOperationRow): Promise<RunSyncResult> {
  const runner = SYNC_RUNNERS[queued.source as SyncSource];
  const work = runner ? await runner(queued.personId) : { error: `${queued.source} has no sync runner yet.` };
  // Nothing runnable (e.g. account disconnected): record why, as a dead letter the user can act on.
  const fn: Work = typeof work === "function" ? work : async () => { throw new SyncError(work.error, "not_runnable", false); };
  return executeSyncOperation(queued, fn);
}

export class RetryNotAllowedError extends Error {}

/** "Retry" button: the only way out of dead_letter; also skips a pending backoff. */
export async function retryLatestForUser(personId: string, source: SyncSource): Promise<RunSyncResult> {
  const latest = (await latestSyncOperations(personId)).find((op) => op.source === source);
  if (!latest) throw new RetryNotAllowedError(`There is no ${source} sync to retry.`);
  if (!["dead_letter", "failed", "timed_out"].includes(latest.state)) {
    throw new RetryNotAllowedError(`The ${source} sync is ${latest.state.replace("_", " ")}; nothing to retry.`);
  }
  const queued = await retrySyncOperation(latest, "user");
  return runQueued(queued!);
}

/** Cron sweep: re-run failed / timed-out attempts whose backoff has elapsed. Never touches dead letters. */
export async function runDueRetries(params: { now?: number; limit?: number } = {}) {
  const now = new Date(params.now ?? Date.now());
  const db = await getDb();
  const due = await db
    .select()
    .from(syncOperations)
    .where(and(inArray(syncOperations.state, ["failed", "timed_out"]), lte(syncOperations.nextAttemptAt, now)))
    .orderBy(asc(syncOperations.nextAttemptAt))
    .limit(params.limit ?? 10);
  const outcomes: { operationId: string; source: string; state: string }[] = [];
  for (const op of due) {
    if (!SYNC_RUNNERS[op.source as SyncSource]) continue;
    try {
      const queued = await retrySyncOperation(op, "scheduler", now.getTime());
      if (!queued) continue;
      const { operation } = await runQueued(queued);
      outcomes.push({ operationId: op.id, source: op.source, state: operation.state });
    } catch (error) {
      // Lost a race with another sweep or a manual retry; the other one owns it.
      logger.warn("sync.retry_sweep.skipped", { correlationId: op.correlationId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { checked: due.length, outcomes };
}

const PLAIN_REASONS: Record<string, string> = {
  github_auth: "GitHub no longer accepts our access. Reconnect GitHub to continue.",
  github_not_found: "We couldn't find that GitHub account.",
  github_rate_limited: "GitHub is limiting requests right now. We'll retry automatically.",
  github_circuit_open: "GitHub is limiting requests right now. We'll retry automatically.",
  timeout: "It took too long to respond.",
  not_runnable: "This source isn't connected any more.",
  leetcode_not_found: "LeetCode has no user with that username. Check it and save it again.",
  hackerrank_invalid: "HackerRank didn't recognise that username. Check it and save it again.",
  kaggle_invalid: "Kaggle didn't recognise that username or key. Check them and save again.",
  scholar_invalid_id: "That research ID didn't match a profile. Check it and save it again.",
  linkedin_bad_credentials: "LinkedIn didn't accept the email or password.",
  linkedin_otp_timeout: "The LinkedIn code wasn't entered in time.",
  linkedin_session_lost: "LinkedIn ended the sign-in session. Try connecting again.",
  linkedin_worker_unavailable: "LinkedIn import isn't available right now. Try again later.",
};

const RECONNECT_CODES = new Set(["github_auth", "not_runnable"]);
const RECONNECT_URLS: Record<string, string> = { github: "/api/auth/github/connect?returnTo=/student/connections" };

/** What the sync-status UI shows for one source. */
export function describeOperation(op: SyncOperationRow) {
  const code = (op.lastErrorCode || "").replace(/^max_attempts_exceeded:/, "");
  const exhausted = (op.lastErrorCode || "").startsWith("max_attempts_exceeded:");
  const state = op.state as SourceSyncState;
  return {
    source: op.source as SyncSource,
    state,
    operationId: op.id,
    correlationId: op.correlationId,
    attempts: op.attempts,
    maxAttempts: op.maxAttempts,
    lastError: op.lastError,
    reason: op.lastError
      ? `${PLAIN_REASONS[code] ?? "Something went wrong on their side."}${exhausted ? ` We tried ${op.attempts} times and stopped.` : ""}`
      : null,
    nextAutomaticRetryAt: state === "failed" || state === "timed_out" ? op.nextAttemptAt?.toISOString() ?? null : null,
    // Nothing to retry when the source is no longer connected and has no reconnect flow here.
    canRetry: (state === "dead_letter" || state === "failed" || state === "timed_out") && !(code === "not_runnable" && !RECONNECT_URLS[op.source]),
    /** What fixes it: a retry, or reconnecting the account (a retry would fail the same way). */
    action: RECONNECT_CODES.has(code) ? ("reconnect" as const) : ("retry" as const),
    reconnectUrl: RECONNECT_CODES.has(code) ? RECONNECT_URLS[op.source] ?? null : null,
    finishedAt: op.finishedAt?.toISOString() ?? null,
    result: op.result,
  };
}

/** One short "what we found" line per source, from the operation's result (Task 2.1.10). */
export function describeFound(source: string, result: unknown): string | null {
  const r = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const n = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : null);
  const plural = (count: number, word: string) =>
    `${count} ${count === 1 ? word : word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}s`}`;
  if (r.servedFromCache) return "Showing your last saved import";
  switch (source) {
    case "resume": return n("candidates") !== null ? `${plural(n("candidates")!, "item")} found` : null;
    case "github": return n("recordsFetched") !== null ? `${plural(n("recordsFetched")!, "repository")} read` : null;
    case "linkedin": return n("experiences") !== null ? `${plural(n("experiences")!, "role")}, ${plural(n("educations") ?? 0, "school")}` : null;
    case "scholar": return n("papers") !== null ? `${plural(n("papers")!, "paper")} found` : null;
    case "kaggle": return n("datasets") !== null ? `${plural(n("datasets")!, "dataset")}, ${plural(n("notebooks") ?? 0, "notebook")}` : null;
    case "leetcode": return n("totalSolved") !== null ? `${n("totalSolved")} problems solved` : null;
    case "hackerrank": return n("badges") !== null ? plural(n("badges")!, "badge") : null;
    case "stackoverflow": return n("reputation") !== null ? `${n("reputation")} reputation` : null;
    case "portfolio": return n("projects") !== null ? `${plural(n("projects")!, "project")} found` : null;
    default: return null;
  }
}

const RESUME_JOB_STATE: Record<string, SourceSyncState> = {
  queued: "queued", running: "running", processing: "running",
  review_ready: "succeeded", completed: "succeeded",
  failed: "failed", retry: "failed", timed_out: "timed_out", cancelled: "skipped_optional",
};

/**
 * The CV is not on the sync ledger: its progress lives in source_processing_jobs.
 * Folded into the same shape so one endpoint drives every progress UI (Task 2.1.3).
 */
async function describeResumeJob(personId: string) {
  const { SourceProcessingJobService } = await import("@/lib/services/source-processing-job-service");
  const job = (await SourceProcessingJobService.getJobsForPerson(personId, 10)).find((j) => j.sourceId === "resume");
  if (!job) return null;
  const state = RESUME_JOB_STATE[job.status] ?? "not_started";
  const meta = (job.metadata ?? {}) as Record<string, unknown>;
  return {
    source: "resume" as SyncSource,
    state,
    stage: job.stage,
    lastError: job.errorMessage,
    reason: state === "failed" || state === "timed_out"
      ? "We couldn't read your CV. You can upload it again or fill in the details yourself."
      : job.stage === "awaiting_extractor" ? "Our document reader is waking up; this can take up to a minute." : null,
    // A CV is re-uploaded, not retried, so there is no Retry button for it.
    canRetry: false,
    finishedAt: job.completedAt?.toISOString() ?? null,
    found: describeFound("resume", meta),
  };
}

export async function getSyncStatus(personId: string) {
  const [ops, resume] = await Promise.all([latestSyncOperations(personId), describeResumeJob(personId)]);
  const sources = SYNC_SOURCES.map((source) => {
    if (source === "resume" && resume) return resume;
    const op = ops.find((o) => o.source === source);
    return op ? { ...describeOperation(op), found: describeFound(source, op.result) } : { source, state: "not_started" as SourceSyncState, canRetry: false };
  });
  return { sources, aggregate: aggregateOnboardingStatus(sources.map((s) => ({ source: s.source, state: s.state, lastError: "lastError" in s ? s.lastError : null }))) };
}

/**
 * Cron: refresh footprint sources whose settled TTL has elapsed (24 h
 * LeetCode/HackerRank/Kaggle, 7 d Scholar). Bounded per run.
 */
export async function runScheduledFootprintRefresh(params: { limit?: number } = {}) {
  const db = await getDb();
  const { externalConnections } = await import("@/lib/db");
  const { syncAllFootprints, FOOTPRINT_SOURCES } = await import("./footprint-sync");
  const rows = await db
    .select({ personId: externalConnections.personId })
    .from(externalConnections)
    .where(inArray(externalConnections.provider, [...FOOTPRINT_SOURCES]))
    .limit(500);
  const people = [...new Set(rows.map((r) => r.personId))].slice(0, params.limit ?? 20);
  const out: { personId: string; ran: number }[] = [];
  for (const personId of people) {
    const results = await syncAllFootprints(personId, "scheduler");
    out.push({ personId, ran: results.filter((r) => r.outcome === "ran").length });
  }
  return { people: people.length, refreshed: out.reduce((n, o) => n + o.ran, 0) };
}

