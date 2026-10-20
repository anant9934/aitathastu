/**
 * Durable GitHub repository imports on the existing source_processing_jobs
 * table, driven the same way as the resume pipeline: no always-on worker, but
 * every step is short, claimed with a lease, and its progress is persisted, so
 * whoever comes next (the request that started it via after(), the student's
 * status poll, or the retry cron) continues from where it stopped.
 *
 *   queued ──claim──▶ processing ──(batches of BATCH_SIZE)──▶ completed | failed | cancelled
 *
 * - Lease: a step runs only after a compare-and-swap on metadata.leaseUntil, so
 *   two polls never import the same batch; a crashed step's lease simply expires.
 * - Progress: done / failed / per-repository retry counts are written after every
 *   batch. A refresh, restart or retry never repeats finished repositories, and
 *   every write underneath is keyed, so a repeated batch upserts, not duplicates.
 * - Failures: rate limits pause the whole job with backoff (the GitHub client's
 *   circuit breaker honours X-RateLimit-Reset); transient errors retry a
 *   repository up to MAX_REPO_ATTEMPTS; deleted, unshared or forbidden
 *   repositories fail at once with the reason.
 */
import crypto from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, sourceProcessingJobs } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getExternalConnectionByProvider, saveExternalConnection } from "@/lib/repositories/connection-repository";
import { decryptConnectionTokenWithMeta } from "@/lib/security/connection-token";
import { SourceProcessingJobService, type SourceProcessingJob } from "./source-processing-job-service";
import type { SyncContext } from "@/lib/sync/sync-operation";

export const IMPORT_JOB_SOURCE = "github_import";
export const BATCH_SIZE = 3;
export const MAX_REPO_ATTEMPTS = 3;
const LEASE_MS = 120_000;
const STALE_AFTER_MS = 24 * 60 * 60_000;

export type ImportPlanItem = { id: number; fullName: string; url: string; private: boolean; via: "account" | "app"; installationId?: string };

export type ImportJobMeta = {
  plan: ImportPlanItem[];
  accessible: number;
  done: number[];
  failed: Array<{ id: number; repo: string; reason: string }>;
  retries: Record<string, number>;
  rateLimitHits?: number;
  notBefore?: number;
  leaseUntil?: number;
  leaseToken?: string;
  heartbeatAt?: number;
  cancelRequested?: boolean;
  outcome?: "completed" | "partial" | "failed" | "cancelled";
};

export type ImportJobView = {
  id: string;
  status: "queued" | "running" | "waiting" | "cancelling" | "completed" | "partial" | "failed" | "cancelled";
  total: number;
  done: number;
  failed: Array<{ repo: string; reason: string }>;
  waitingUntil: string | null;
};

const IN_FLIGHT = ["queued", "processing"] as const;
const meta = (job: SourceProcessingJob) => (job.metadata || {}) as ImportJobMeta;

export function viewOf(job: SourceProcessingJob, now = Date.now()): ImportJobView {
  const m = meta(job);
  const inFlight = (IN_FLIGHT as readonly string[]).includes(job.status);
  const status: ImportJobView["status"] = inFlight
    ? m.cancelRequested ? "cancelling" : m.notBefore && m.notBefore > now ? "waiting" : job.status === "queued" ? "queued" : "running"
    : m.outcome ?? (job.status === "cancelled" ? "cancelled" : job.status === "completed" ? "completed" : "failed");
  return {
    id: job.id,
    status,
    total: m.plan?.length ?? 0,
    done: m.done?.length ?? 0,
    failed: (m.failed ?? []).map(({ repo, reason }) => ({ repo, reason })),
    waitingUntil: inFlight && m.notBefore && m.notBefore > now ? new Date(m.notBefore).toISOString() : null,
  };
}

/** The student's newest import job, or null. */
export async function latestImportJob(personId: string): Promise<SourceProcessingJob | null> {
  const db = await getDb();
  const [job] = await db.select().from(sourceProcessingJobs)
    .where(and(eq(sourceProcessingJobs.personId, personId), eq(sourceProcessingJobs.sourceId, IMPORT_JOB_SOURCE)))
    .orderBy(desc(sourceProcessingJobs.createdAt)).limit(1);
  return job ?? null;
}

export const isInFlight = (job: SourceProcessingJob | null) => Boolean(job && (IN_FLIGHT as readonly string[]).includes(job.status));
export const leaseExpired = (job: SourceProcessingJob, now = Date.now()) => !meta(job).leaseUntil || meta(job).leaseUntil! < now;

/**
 * Creates the job, or returns the one already running for this student: a
 * double click, a second tab or a repeated request never starts a parallel import.
 */
export async function createImportJob(personId: string, plan: ImportPlanItem[], accessible: number): Promise<{ job: SourceProcessingJob; existing: boolean }> {
  const running = await latestImportJob(personId);
  if (running && isInFlight(running)) return { job: running, existing: true };
  const jobId = await SourceProcessingJobService.startJob({
    personId, sourceId: IMPORT_JOB_SOURCE, stage: "acquire", status: "queued",
    metadata: { plan, accessible, done: [], failed: [], retries: {} } satisfies ImportJobMeta,
  });
  return { job: (await SourceProcessingJobService.getJobForPerson(jobId, personId))!, existing: false };
}

async function patchJob(job: SourceProcessingJob, patch: Partial<ImportJobMeta>, opts: { token?: string; status?: string } = {}) {
  const db = await getDb();
  const rows = await db.update(sourceProcessingJobs)
    .set({ ...(opts.status ? { status: opts.status } : {}), metadata: sql`${sourceProcessingJobs.metadata} || ${JSON.stringify(patch)}::jsonb` })
    .where(and(
      eq(sourceProcessingJobs.id, job.id), eq(sourceProcessingJobs.personId, job.personId),
      inArray(sourceProcessingJobs.status, [...IN_FLIGHT]),
      ...(opts.token ? [sql`${sourceProcessingJobs.metadata}->>'leaseToken' = ${opts.token}`] : []),
    ))
    .returning();
  return rows[0] ?? null;
}

/** Compare-and-swap lease: exactly one caller gets to run the next batch. */
async function claim(job: SourceProcessingJob, now: number): Promise<{ job: SourceProcessingJob; token: string } | null> {
  const db = await getDb();
  const token = crypto.randomBytes(8).toString("hex");
  const rows = await db.update(sourceProcessingJobs)
    .set({ status: "processing", stage: "extract", metadata: sql`${sourceProcessingJobs.metadata} || ${JSON.stringify({ leaseUntil: now + LEASE_MS, leaseToken: token, heartbeatAt: now })}::jsonb` })
    .where(and(
      eq(sourceProcessingJobs.id, job.id), eq(sourceProcessingJobs.personId, job.personId),
      inArray(sourceProcessingJobs.status, [...IN_FLIGHT]),
      sql`coalesce((${sourceProcessingJobs.metadata}->>'leaseUntil')::bigint, 0) < ${now}`,
    ))
    .returning();
  return rows[0] ? { job: rows[0], token } : null;
}

const PERMANENT = /not.?found|no_longer_available|not accessible|permission|forbidden|revoked|not_authorized|unavailable|\b40[134]\b/i;
/** Plain reason codes for students; GitHub's raw error text (which can describe our configuration) is never shown. */
export function publicReason(raw: string): string {
  if (/^[a-z_]+$/.test(raw)) return raw;
  if (RATE_LIMIT.test(raw)) return "rate_limited";
  if (/not accessible|permission|forbidden|\b403\b/i.test(raw)) return "not_accessible";
  if (/not.?found|\b404\b/i.test(raw)) return "no_longer_available";
  if (/timed? ?out|timeout|aborted/i.test(raw)) return "github_timeout";
  if (/^missing$|graphql:|unreadable|malformed/i.test(raw)) return "content_unreadable";
  return "github_error";
}

/** The repository's contents couldn't be read at all, so only bare metadata was saved: not an import. */
const CONTENT_MISSING = /^missing$|repository_unavailable|not accessible|permission|graphql:/i;

/** Sorts one repository's outcome. Imported means persisted with readable content. */
function classify(item: ImportPlanItem, ok: Set<number>, failedByName: Map<string, string>, out: BatchOutcome) {
  const reason = failedByName.get(item.fullName);
  if (ok.has(item.id) && !(reason && CONTENT_MISSING.test(reason))) out.done.push(item.id);
  else if (reason) (PERMANENT.test(reason) ? out.failed : out.transient).push({ id: item.id, reason });
  else return false;
  return true;
}
const RATE_LIMIT = /rate.?limit|circuit|secondary rate|\b429\b/i;

type BatchOutcome = { done: number[]; failed: Array<{ id: number; reason: string }>; transient: Array<{ id: number; reason: string }>; rateLimited: boolean };

/** Public repositories through the student's signed-in account (existing import, scoped to the batch). */
async function runAccountBatch(personId: string, items: ImportPlanItem[], jobId: string): Promise<BatchOutcome> {
  const out: BatchOutcome = { done: [], failed: [], transient: [], rateLimited: false };
  const connection = await getExternalConnectionByProvider(personId, "github");
  const m = (connection?.metadata || {}) as Record<string, unknown>;
  let token: string | null = null;
  try {
    token = connection?.status === "connected" && typeof m.encryptedAccessToken === "string" ? decryptConnectionTokenWithMeta(m.encryptedAccessToken, personId).token : null;
  } catch { token = null; }
  if (!connection || !token) {
    for (const i of items) out.failed.push({ id: i.id, reason: "github_sign_in_required" });
    return out;
  }
  const { importGitHubRepositories } = await import("./github-sync-service");
  const correlationId = `ghjob_${jobId}`;
  const ctx = {
    operation: null as never, correlationId, log: logger.child({ correlationId, metadata: { jobId } }),
    outboundHeaders: {}, idempotencyKey: jobId, signal: AbortSignal.timeout(90_000),
  } satisfies SyncContext;
  try {
    const { result } = await importGitHubRepositories({
      personId, connectionId: connection.id, login: connection.externalUsername, token, metadata: m, profileUrl: connection.profileUrl,
      ctx, onlyRepoIds: new Set(items.map((i) => i.id)), deepExtraction: "await",
    });
    const r = (result || {}) as { importedRepoIds?: number[]; unchangedRepoIds?: number[]; failedRepos?: Array<{ repo: string; reason: string }> };
    const ok = new Set([...(r.importedRepoIds ?? []), ...(r.unchangedRepoIds ?? [])]);
    const failedByName = new Map((r.failedRepos ?? []).map((f) => [f.repo, f.reason]));
    for (const i of items) {
      if (!classify(i, ok, failedByName, out)) out.failed.push({ id: i.id, reason: "no_longer_available" }); // deleted, renamed away or made private since selection
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 160) : "import_failed";
    if (RATE_LIMIT.test(reason) || (error as { rateLimited?: boolean })?.rateLimited) out.rateLimited = true;
    else for (const i of items) (PERMANENT.test(reason) ? out.failed : out.transient).push({ id: i.id, reason });
  }
  return out;
}

/** Repositories granted through one GitHub App installation, with that installation's token only. */
async function runAppBatch(personId: string, installationId: string, items: ImportPlanItem[]): Promise<BatchOutcome> {
  const out: BatchOutcome = { done: [], failed: [], transient: [], rateLimited: false };
  const { syncGitHubAppInstallation } = await import("./github-app-sync-service");
  const r = await syncGitHubAppInstallation(personId, { onlyRepoIds: new Set(items.map((i) => i.id)), installationId });
  if (r.status === "RATE_LIMITED") { out.rateLimited = true; return out; }
  if (r.status === "REVOKED" || r.status === "NOT_AUTHORIZED") {
    for (const i of items) out.failed.push({ id: i.id, reason: r.status === "REVOKED" ? "access_revoked" : "installation_not_authorized" });
    return out;
  }
  const ok = new Set(r.importedRepositoryIds ?? []);
  const failedByName = new Map(r.failedRepositories.map((f) => [f.repo, f.reason]));
  for (const i of items) {
    if (classify(i, ok, failedByName, out)) continue;
    if (r.status === "FAILED") out.transient.push({ id: i.id, reason: r.error || "import_failed" });
    else out.failed.push({ id: i.id, reason: "no_longer_available" }); // removed from the installation since selection
  }
  return out;
}

export type ImportRecord = { status: "running" | "completed" | "partial" | "failed" | "cancelled"; at: string; accessible: number; selected: number; imported: number; failed: Array<{ repo: string; reason: string }>; jobId?: string };

async function finish(job: SourceProcessingJob, _token: string | null, cancelled = false) {
  const m = meta(job);
  const outcome: ImportJobMeta["outcome"] = cancelled ? "cancelled" : !m.done.length ? "failed" : m.failed.length ? "partial" : "completed";
  const settled = await SourceProcessingJobService.transition({
    jobId: job.id, personId: job.personId, from: [...IN_FLIGHT],
    to: outcome === "cancelled" ? "cancelled" : outcome === "failed" ? "failed" : "completed",
    stage: "persist",
    errorCode: outcome === "partial" ? "PARTIAL" : outcome === "failed" ? "IMPORT_FAILED" : null,
    metadata: { outcome, leaseUntil: 0 },
  });
  if (!settled) return null;
  const record: ImportRecord = {
    status: outcome, at: new Date().toISOString(), accessible: m.accessible, selected: m.plan.length, imported: m.done.length,
    failed: m.failed.map(({ repo, reason }) => ({ repo, reason })).slice(0, 50), jobId: job.id,
  };
  const connection = await getExternalConnectionByProvider(job.personId, "github");
  if (connection) {
    await saveExternalConnection({
      personId: job.personId, provider: "github", externalUsername: connection.externalUsername, profileUrl: connection.profileUrl,
      metadata: { ...((connection.metadata || {}) as Record<string, unknown>), githubUnifiedLastImport: record },
    });
  }
  return settled;
}

/**
 * Runs batches until the job is done or `budgetMs` is spent. Safe to call from
 * anywhere at any time: it does nothing unless it wins the lease.
 */
export async function advanceImportJob(personId: string, jobId: string, opts: { budgetMs?: number; now?: () => number } = {}): Promise<ImportJobView | null> {
  const clock = opts.now ?? Date.now;
  const started = clock();
  const budget = opts.budgetMs ?? 40_000;
  let job = await SourceProcessingJobService.getJobForPerson(jobId, personId);
  if (!job || job.sourceId !== IMPORT_JOB_SOURCE) return null;

  // At least one batch per call, however small the budget; more while time remains.
  let first = true;
  while (isInFlight(job) && (first || clock() - started < budget)) {
    first = false;
    const m = meta(job);
    if (m.notBefore && m.notBefore > clock()) break; // paused for a rate limit
    const lease = await claim(job, clock());
    if (!lease) break; // someone else holds it
    job = lease.job;
    const lm = meta(job);

    if (lm.cancelRequested) { job = (await finish(job, lease.token, true)) ?? job; break; }
    const settled = new Set([...lm.done, ...lm.failed.map((f) => f.id)]);
    const pending = lm.plan.filter((p) => !settled.has(p.id));
    if (!pending.length) { job = (await finish(job, lease.token)) ?? job; break; }

    const batch = pending.slice(0, BATCH_SIZE);
    const groups = new Map<string, ImportPlanItem[]>();
    for (const item of batch) {
      const key = item.via === "account" ? "account" : `app:${item.installationId}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const done = [...lm.done];
    const failed = [...lm.failed];
    const retries = { ...lm.retries };
    let rateLimited = false;
    for (const [key, items] of groups) {
      const r = key === "account" ? await runAccountBatch(personId, items, job.id) : await runAppBatch(personId, key.slice(4), items);
      const byId = new Map(items.map((i) => [i.id, i]));
      done.push(...r.done);
      for (const f of r.failed) failed.push({ id: f.id, repo: byId.get(f.id)!.fullName, reason: publicReason(f.reason) });
      for (const t of r.transient) {
        const n = (retries[t.id] ?? 0) + 1;
        retries[t.id] = n;
        if (n >= MAX_REPO_ATTEMPTS) failed.push({ id: t.id, repo: byId.get(t.id)!.fullName, reason: publicReason(t.reason) });
      }
      rateLimited ||= r.rateLimited;
    }
    const hits = rateLimited ? (lm.rateLimitHits ?? 0) + 1 : 0;
    const patch: Partial<ImportJobMeta> = {
      done: [...new Set(done)], failed, retries, heartbeatAt: clock(), leaseUntil: 0, rateLimitHits: hits,
      notBefore: rateLimited ? clock() + Math.min(15 * 60_000, 60_000 * 2 ** (hits - 1)) : 0,
    };
    job = (await patchJob(job, patch, { token: lease.token })) ?? (await SourceProcessingJobService.getJobForPerson(jobId, personId))!;
    if (rateLimited) break;
  }
  return job ? viewOf(job, clock()) : null;
}

/** Asks a running import to stop after its current batch; repositories already imported stay. */
export async function requestImportCancel(personId: string, jobId: string): Promise<ImportJobView | null> {
  const job = await SourceProcessingJobService.getJobForPerson(jobId, personId);
  if (!job || job.sourceId !== IMPORT_JOB_SOURCE || !isInFlight(job)) return job ? viewOf(job) : null;
  const flagged = await patchJob(job, { cancelRequested: true });
  if (flagged && leaseExpired(flagged)) {
    const lease = await claim(flagged, Date.now());
    if (lease) return viewOf((await finish(lease.job, lease.token, true)) ?? lease.job);
  }
  return viewOf(flagged ?? job);
}

/**
 * Cron: continue imports nobody is watching (student closed the tab), and close
 * ones abandoned for a day so a student is never stuck "Importing".
 */
export async function resumeStalledImports(opts: { limit?: number; budgetMs?: number } = {}) {
  const db = await getDb();
  const jobs = await db.select().from(sourceProcessingJobs)
    .where(and(eq(sourceProcessingJobs.sourceId, IMPORT_JOB_SOURCE), inArray(sourceProcessingJobs.status, [...IN_FLIGHT])))
    .orderBy(sourceProcessingJobs.createdAt).limit(opts.limit ?? 5);
  const out: Array<{ jobId: string; status: string }> = [];
  for (const job of jobs) {
    const m = meta(job);
    if (Date.now() - (m.heartbeatAt ?? job.startedAt.getTime()) > STALE_AFTER_MS) {
      const lease = await claim(job, Date.now());
      if (lease) {
        const failed = [...meta(lease.job).failed, ...meta(lease.job).plan.filter((p) => !meta(lease.job).done.includes(p.id) && !meta(lease.job).failed.some((f) => f.id === p.id)).map((p) => ({ id: p.id, repo: p.fullName, reason: "stalled" }))];
        const patched = await patchJob(lease.job, { failed }, { token: lease.token });
        const settled = patched ? await finish(patched, lease.token) : null;
        out.push({ jobId: job.id, status: settled?.status ?? "skipped" });
      }
      continue;
    }
    const view = await advanceImportJob(job.personId, job.id, { budgetMs: opts.budgetMs ?? 20_000 });
    out.push({ jobId: job.id, status: view?.status ?? "missing" });
  }
  return out;
}
