import type { SyncSource } from "./state-machine";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Settled per-source policy (Tasks 1.6.6, 1.7.2, 1.9.4). These values are
 * decisions, not tuning knobs: change them only with the task list.
 */
export const SOURCE_SYNC_POLICY: Record<SyncSource, {
  /** Minimum age of the last successful sync before a scheduled refresh runs. */
  ttlMs: number;
  /** Whether "Sync Now" may bypass the TTL (LinkedIn may not: account protection). */
  manualBypassesTtl: boolean;
  /** Automatic attempts before the operation is dead-lettered. */
  maxAttempts: number;
  /** Wall-clock budget for one attempt; exceeding it is `timed_out`. */
  attemptTimeoutMs: number;
}> = {
  github:     { ttlMs: 6 * HOUR, manualBypassesTtl: true,  maxAttempts: 3, attemptTimeoutMs: 45_000 },
  leetcode:   { ttlMs: DAY,      manualBypassesTtl: true,  maxAttempts: 3, attemptTimeoutMs: 10_000 },
  hackerrank: { ttlMs: DAY,      manualBypassesTtl: true,  maxAttempts: 3, attemptTimeoutMs: 10_000 },
  kaggle:     { ttlMs: DAY,      manualBypassesTtl: true,  maxAttempts: 3, attemptTimeoutMs: 15_000 },
  scholar:    { ttlMs: 7 * DAY,  manualBypassesTtl: true,  maxAttempts: 4, attemptTimeoutMs: 20_000 },
  // One automated login attempt per run; the 14-day cooldown is never bypassed.
  linkedin:   { ttlMs: 14 * DAY, manualBypassesTtl: false, maxAttempts: 1, attemptTimeoutMs: 120_000 },
  resume:     { ttlMs: 0,        manualBypassesTtl: true,  maxAttempts: 3, attemptTimeoutMs: 60_000 },
};

/** Window in which identical "Sync Now" requests collapse into one operation. */
export const USER_TRIGGER_DEDUPE_WINDOW_MS = 60_000;

/** Exponential backoff between automatic retries: 30 s, 2 min, 8 min, ... capped at 1 h. */
export function retryBackoffMs(attempts: number) {
  return Math.min(HOUR, 30_000 * 4 ** Math.max(0, attempts - 1));
}

/**
 * Whether a live sync may run now. Page loads never call this with a
 * trigger: they read persisted data only. A scheduled refresh waits for the
 * TTL; "Sync Now" bypasses it except where the policy forbids (LinkedIn).
 */
export function isSyncDue(source: SyncSource, lastSucceededAt: Date | null | undefined, trigger: "user" | "scheduler", now = Date.now()) {
  if (!lastSucceededAt) return true;
  const policy = SOURCE_SYNC_POLICY[source];
  if (trigger === "user" && policy.manualBypassesTtl) return true;
  return now - lastSucceededAt.getTime() >= policy.ttlMs;
}
