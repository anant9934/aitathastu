/**
 * Per-source sync state machine and onboarding status aggregation (Task 1.9.3).
 * Spec: docs/ONBOARDING_SYNC_STATE_MACHINE.md. Every scraper/import emits
 * these states through `transition()`; nothing writes ad-hoc status strings.
 */

export const SYNC_SOURCES = ["resume", "github", "linkedin", "scholar", "kaggle", "leetcode", "hackerrank", "stackoverflow", "portfolio"] as const;
export type SyncSource = (typeof SYNC_SOURCES)[number];

export const SOURCE_SYNC_STATES = [
  "not_started",      // never requested for this person
  "queued",           // requested; waiting for a worker
  "running",          // a worker holds it
  "awaiting_user",    // paused on user input (LinkedIn OTP, bounded 60 s)
  "succeeded",        // terminal for this attempt; data persisted
  "partial",          // terminal; some records persisted, some failed (e.g. one bad repo)
  "failed",           // attempt failed; retryable until the source's max attempts
  "timed_out",        // attempt exceeded its time budget; retryable like failed
  "skipped_optional", // user chose "Skip / I'll do this later", or gave no identifier
  "dead_letter",      // gave up after max attempts or a non-retryable error; manual retry only
] as const;
export type SourceSyncState = (typeof SOURCE_SYNC_STATES)[number];

/** Who may cause a transition. Automatic retries never leave dead_letter. */
export type TransitionTrigger = "user" | "worker" | "scheduler";

type Edge = { to: SourceSyncState; by: readonly TransitionTrigger[] };
const W = ["worker"] as const;
const U = ["user"] as const;
const ANY = ["user", "worker", "scheduler"] as const;
const REFRESH = ["user", "scheduler"] as const;

export const SYNC_TRANSITIONS: Record<SourceSyncState, readonly Edge[]> = {
  not_started: [{ to: "queued", by: REFRESH }, { to: "skipped_optional", by: U }],
  queued: [{ to: "running", by: W }, { to: "skipped_optional", by: U }],
  running: [
    { to: "succeeded", by: W }, { to: "partial", by: W }, { to: "failed", by: W },
    { to: "timed_out", by: W }, { to: "awaiting_user", by: W }, { to: "dead_letter", by: W },
  ],
  awaiting_user: [
    { to: "running", by: U },          // OTP submitted
    { to: "skipped_optional", by: U }, // "Cancel / Skip LinkedIn"
    { to: "timed_out", by: W },        // 60 s window expired
  ],
  // Automatic retry re-queues; exhausting attempts dead-letters (failSyncOperation).
  failed: [{ to: "queued", by: ANY }, { to: "dead_letter", by: W }],
  timed_out: [{ to: "queued", by: ANY }, { to: "dead_letter", by: W }],
  // Refresh after the source TTL (cron) or an explicit "Sync Now".
  succeeded: [{ to: "queued", by: REFRESH }],
  partial: [{ to: "queued", by: REFRESH }],
  skipped_optional: [{ to: "queued", by: U }],
  dead_letter: [{ to: "queued", by: U }], // manual retry only
};

export const TERMINAL_STATES: ReadonlySet<SourceSyncState> = new Set(["succeeded", "partial", "skipped_optional", "dead_letter"]);
const ACTIVE_STATES: ReadonlySet<SourceSyncState> = new Set(["queued", "running"]);
const PROBLEM_STATES: ReadonlySet<SourceSyncState> = new Set(["failed", "timed_out", "dead_letter", "partial"]);

export class InvalidSyncTransitionError extends Error {
  constructor(readonly from: SourceSyncState, readonly to: SourceSyncState, readonly by: TransitionTrigger) {
    super(`Invalid sync transition ${from} -> ${to} (by ${by})`);
  }
}

export function canTransition(from: SourceSyncState, to: SourceSyncState, by: TransitionTrigger): boolean {
  return SYNC_TRANSITIONS[from].some((edge) => edge.to === to && edge.by.includes(by));
}

/** Returns `to` or throws; call sites persist the returned state. */
export function transition(from: SourceSyncState, to: SourceSyncState, by: TransitionTrigger): SourceSyncState {
  if (!canTransition(from, to, by)) throw new InvalidSyncTransitionError(from, to, by);
  return to;
}

export function isSourceSyncState(value: unknown): value is SourceSyncState {
  return typeof value === "string" && (SOURCE_SYNC_STATES as readonly string[]).includes(value);
}

/** Maps the legacy strings still stored in sync_runs / source_processing_jobs. */
export function fromLegacyStatus(status: string | null | undefined): SourceSyncState {
  switch (status) {
    case "completed": return "succeeded";
    case "retry": return "queued";
    case "partial": case "queued": case "running": case "failed": return status;
    default: return isSourceSyncState(status) ? status : "not_started";
  }
}

export type AggregateOnboardingStatus =
  | "not_started"           // nothing requested (or everything skipped)
  | "in_progress"           // at least one source queued/running
  | "awaiting_user"         // a source needs the user (OTP); takes precedence
  | "completed"             // everything requested settled cleanly
  | "completed_with_issues"; // settled, but something failed / partial / dead-lettered

export type SourceSnapshot = { source: SyncSource; state: SourceSyncState; lastError?: string | null };

export type AggregateSummary = {
  status: AggregateOnboardingStatus;
  /** Always true: no source ever blocks onboarding (Tasks 1.6.1, 1.6.6). */
  canProceed: true;
  succeeded: SyncSource[];
  pending: SyncSource[];
  awaitingUser: SyncSource[];
  issues: { source: SyncSource; state: SourceSyncState; lastError?: string | null }[];
  skipped: SyncSource[];
  /** Short user-facing line, e.g. "4 of 6 sources done, 2 still running". */
  headline: string;
};

export function aggregateOnboardingStatus(sources: SourceSnapshot[]): AggregateSummary {
  const requested = sources.filter((s) => s.state !== "not_started" && s.state !== "skipped_optional");
  const succeeded = sources.filter((s) => s.state === "succeeded").map((s) => s.source);
  const pending = sources.filter((s) => ACTIVE_STATES.has(s.state)).map((s) => s.source);
  const awaitingUser = sources.filter((s) => s.state === "awaiting_user").map((s) => s.source);
  // failed / timed_out are not terminal (a retry may follow) but are shown as issues until it does.
  const issues = sources.filter((s) => PROBLEM_STATES.has(s.state)).map(({ source, state, lastError }) => ({ source, state, lastError }));
  const skipped = sources.filter((s) => s.state === "skipped_optional").map((s) => s.source);

  let status: AggregateOnboardingStatus;
  if (awaitingUser.length) status = "awaiting_user";
  else if (pending.length) status = "in_progress";
  else if (!requested.length) status = "not_started";
  else if (issues.length) status = "completed_with_issues";
  else status = "completed";

  const settled = requested.length - pending.length - awaitingUser.length;
  const headline =
    status === "not_started" ? "No sources connected yet — you can add them any time."
    : status === "awaiting_user" ? `${awaitingUser.join(", ")} needs a verification code to continue.`
    : status === "in_progress" ? `${settled} of ${requested.length} sources done, ${pending.length} still running.`
    : status === "completed" ? `All ${requested.length} connected sources are up to date.`
    : `${requested.length - issues.length} of ${requested.length} sources imported; ${issues.length} need attention.`;

  return { status, canProceed: true, succeeded, pending, awaitingUser, issues, skipped, headline };
}
