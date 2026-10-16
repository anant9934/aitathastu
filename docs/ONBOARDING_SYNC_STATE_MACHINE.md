# Onboarding Sync State Machine

Source of truth in code: [`lib/sync/state-machine.ts`](../lib/sync/state-machine.ts). This document and that file must agree; the tests in `scripts/verify-phase1-backend.ts` pin the table below. Task 1.9.3.

## Sources

`resume`, `github`, `linkedin`, `scholar`, `kaggle`, `leetcode`, `hackerrank`. **Every source is optional.** No onboarding step, completeness score, or feature may require any of them. That is why the aggregate always reports `canProceed: true`.

## Per-source states

| State | Meaning | Terminal? |
|---|---|---|
| `not_started` | Never requested for this person (e.g. no ORCID iD given, so Scholar never runs) | — |
| `queued` | Requested, waiting for a worker | no |
| `running` | A worker has claimed it (single claim, compare-and-swap) | no |
| `awaiting_user` | Paused for user input: the LinkedIn OTP relay, bounded to 60 s | no |
| `succeeded` | Attempt finished; data persisted | yes, until the next refresh |
| `partial` | Attempt finished; some records persisted, some failed (e.g. one malformed repo, Task 1.5.3) | yes, until the next refresh |
| `failed` | Attempt failed with a retryable error | no |
| `timed_out` | Attempt exceeded its time budget; retryable like `failed` | no |
| `skipped_optional` | User chose "Skip / I'll do this later", or dismissed the OTP modal | yes, until the user connects |
| `dead_letter` | Max attempts exhausted or a non-retryable error (CAPTCHA, account hold); the last error is preserved | yes; only a manual retry leaves it |

Two states go beyond the seven in the original brief, because real flows need them: `partial` (Task 1.5.3 requires a partial-success outcome) and `awaiting_user` (the OTP pause in Task 1.6.8).

## Transitions

`by` says who may cause the edge: `user` (explicit action), `worker` (the sync job), `scheduler` (cron/TTL refresh). Anything not listed is rejected with `InvalidSyncTransitionError`.

| From | To | By |
|---|---|---|
| `not_started` | `queued` | user, scheduler |
| `not_started` | `skipped_optional` | user |
| `queued` | `running` | worker |
| `queued` | `skipped_optional` | user |
| `running` | `succeeded`, `partial`, `failed`, `timed_out`, `awaiting_user` | worker |
| `running` | `dead_letter` | worker (non-retryable error) |
| `awaiting_user` | `running` | user (OTP submitted) |
| `awaiting_user` | `skipped_optional` | user (Cancel / Skip LinkedIn) |
| `awaiting_user` | `timed_out` | worker (60 s expired) |
| `failed`, `timed_out` | `queued` | user, worker, scheduler (retry while attempts < max) |
| `failed`, `timed_out` | `dead_letter` | worker (attempts ≥ max, see `failSyncOperation` in `lib/sync/sync-operation.ts`) |
| `succeeded`, `partial` | `queued` | user ("Sync Now"), scheduler (TTL elapsed) |
| `skipped_optional` | `queued` | user (connects later) |
| `dead_letter` | `queued` | user only (manual retry) |

Page navigation is never a trigger. Reads always serve persisted data.

## Aggregate onboarding status

`aggregateOnboardingStatus(sources)` reduces the per-source states. `not_started` and `skipped_optional` sources are "not requested": they never count as pending or as problems. The rules, highest precedence first:

1. any `awaiting_user` → **`awaiting_user`** (the user has something to do)
2. else any `queued` / `running` → **`in_progress`**
3. else nothing requested → **`not_started`**
4. else any `failed` / `timed_out` / `partial` / `dead_letter` → **`completed_with_issues`**
5. else → **`completed`**

`failed` and `timed_out` are not terminal, but they count as issues until a retry moves them on.

### Worked combinations

| resume | github | linkedin | scholar | others | Aggregate | Headline |
|---|---|---|---|---|---|---|
| succeeded | succeeded | skipped_optional | not_started (no ORCID) | not_started | `completed` | All 2 connected sources are up to date. |
| succeeded | running | skipped_optional | not_started | leetcode queued | `in_progress` | 1 of 3 sources done, 2 still running. |
| succeeded | succeeded | awaiting_user | not_started | — | `awaiting_user` | linkedin needs a verification code to continue. |
| succeeded | partial | dead_letter | succeeded | — | `completed_with_issues` | 2 of 4 sources imported; 2 need attention. |
| failed | succeeded | skipped_optional | not_started | — | `completed_with_issues` | 1 of 2 sources imported; 1 need attention. |
| skipped_optional | not_started | skipped_optional | not_started | not_started | `not_started` | No sources connected yet — you can add them any time. |
| succeeded | timed_out | running | not_started | — | `in_progress` | 2 of 3 sources done, 1 still running. |

In every row `canProceed` is `true`: the student can finish onboarding regardless.

## Legacy status strings

`sync_runs.status` and `source_processing_jobs.status` predate this spec. `fromLegacyStatus()` maps `completed → succeeded` and `retry → queued`, and passes the others through. New code writes only spec states, through `sync_operations` (`lib/sync/sync-operation.ts`).
