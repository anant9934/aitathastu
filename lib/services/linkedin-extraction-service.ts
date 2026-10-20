/**
 * LinkedIn public-profile extraction as a durable job on source_processing_jobs,
 * driven like the GitHub import job: no always-on worker, but every step is
 * short, claimed with a lease, and its progress is persisted, so whoever comes
 * next (the request that started it via after(), the student's status poll, or
 * the retry cron) continues from where it stopped.
 *
 *   queued ──claim──▶ processing: start provider run → wait → fetch → normalize → persist
 *                         └──▶ completed (succeeded | partial) | failed | cancelled
 *
 * - Provider: Apify, with the operator-configured actor (APIFY_LINKEDIN_ACTOR_ID,
 *   input { profileUrls: [url] }), public profiles only, no cookies or logins.
 *   One provider run per attempt; its run id is stored, so a poll or a crash
 *   never starts a second paid run for the same attempt.
 * - Retries: transient provider failures (network, 429, 5xx, a failed or timed
 *   out run) retry up to MAX_ATTEMPTS with exponential backoff. Permanent ones
 *   (configuration, credentials, a private, missing or different profile) stop
 *   at once with a sanitized reason code.
 * - Persistence: linkedin_profiles (one row per student) and
 *   linkedin_profile_records (one row per record, keyed by deterministic
 *   record keys), both upserted, so a repeated run updates instead of
 *   duplicating. A failed refresh writes nothing to them; a record a later run
 *   no longer returns is only marked missingSince, never deleted. Only a
 *   successful extraction of a *different* profile (the student changed their
 *   URL) replaces the previous profile's records.
 * - Downstream: experience and education become onboarding-draft candidates
 *   (the student confirms them); records also become evidence rows with
 *   originSource "linkedin" and verificationStatus "imported". LinkedIn content
 *   is self-declared: skill intelligence scores LinkedIn skills as self-claims
 *   (lib/services/skill-intelligence-service.ts), and nothing here is marked verified.
 * - Firecrawl: only reads the title and description of up to two personal
 *   websites the profile itself lists, behind the shared SSRF gate. Never LinkedIn.
 *
 * Tokens are never logged, stored or returned; the job keeps only a short hash
 * to find which pooled token started a run.
 */
import crypto from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb, linkedinProfileRecords, linkedinProfiles, sourceProcessingJobs } from "@/lib/db";
import { KeyPool } from "@/lib/intelligence/providers/key-pool";
import { validateLinkedInUrl } from "@/lib/connectors/linkedin/client";
import { writeEvidenceBatch, type EvidenceInsertParams } from "@/lib/repositories/evidence-repository";
import { getExternalConnectionByProvider, saveExternalConnection } from "@/lib/repositories/connection-repository";
import { logger } from "@/lib/logger";
import {
  LINKEDIN_NORMALIZATION_VERSION, MalformedProviderOutputError, ProfileMismatchError, RECORD_KINDS,
  normalizeLinkedInProfile, type LinkedInRecordKind, type NormalizationResult, type NormalizedRecord,
} from "@/lib/linkedin/normalize";
import { SourceProcessingJobService, type SourceProcessingJob } from "./source-processing-job-service";

export const LINKEDIN_JOB_SOURCE = "linkedin_extract";
export const MAX_ATTEMPTS = 3;
const LEASE_MS = 90_000;
/** A provider run still going after this is aborted and counted as a failed attempt. */
const RUN_TIMEOUT_MS = 6 * 60_000;
const STALE_AFTER_MS = 2 * 60 * 60_000;
const BACKOFF_MS = [15_000, 60_000, 180_000];
/** A fresh successful extraction is not repeated sooner than this (each run is billed). */
export const REFRESH_COOLDOWN_MS = 60 * 60_000;
export const DAILY_JOB_LIMIT = 8;
const APIFY_TOKEN_ENV_VARS = ["APIFY_TOKEN", "APIFY_TOKENS", "APIFY_API_KEYS", "APIFY_API_KEY"];
const APIFY_API = "https://api.apify.com/v2";
const MAX_WEBSITES = 2;

// ─── Configuration ────────────────────────────────────────────────────────────

export type ExtractionConfig = { configured: boolean; actorId: string | null; reason: string };

/** Whether extraction can run, from variable presence only; no secret value leaves this function. */
export function getLinkedInExtractionConfig(env: NodeJS.ProcessEnv = process.env): ExtractionConfig {
  const actorId = env.APIFY_LINKEDIN_ACTOR_ID?.trim() || null;
  if (!actorId) return { configured: false, actorId: null, reason: "LinkedIn extraction is not configured on this server (APIFY_LINKEDIN_ACTOR_ID is not set)." };
  if (!/^[A-Za-z0-9._-]+[/~][A-Za-z0-9._-]+$|^[A-Za-z0-9]{10,}$/.test(actorId)) return { configured: false, actorId: null, reason: "APIFY_LINKEDIN_ACTOR_ID must be an Apify actor id or owner/name." };
  if (env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED?.trim().toLowerCase() !== "true") {
    return { configured: false, actorId, reason: "LinkedIn extraction is not enabled on this server (APIFY_LINKEDIN_TERMS_ACKNOWLEDGED must be true after the operator reviews the actor's terms)." };
  }
  if (!new KeyPool(APIFY_TOKEN_ENV_VARS).hasKeys()) return { configured: false, actorId, reason: "LinkedIn extraction is not configured on this server (no Apify token)." };
  return { configured: true, actorId, reason: "ready" };
}

// ─── Job state ────────────────────────────────────────────────────────────────

export type ExtractionTrigger = "initial" | "refresh" | "retry";
export type ErrorCode =
  | "invalid_url" | "not_configured" | "profile_unavailable" | "profile_mismatch" | "provider_auth" | "provider_quota"
  | "provider_misconfigured" | "provider_unavailable" | "provider_timeout" | "provider_output_invalid" | "stalled" | "internal";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  invalid_url: "That isn't a LinkedIn profile URL. Use the form linkedin.com/in/your-name.",
  not_configured: "LinkedIn extraction isn't available on this server yet.",
  profile_unavailable: "LinkedIn didn't return this profile. Check that the URL is right and the profile is public.",
  profile_mismatch: "The profile returned didn't match the URL you entered, so nothing was saved. Check the URL.",
  provider_auth: "The extraction service rejected our credentials. This is on our side; try again later.",
  provider_quota: "The extraction service is out of capacity right now. Try again later.",
  provider_misconfigured: "The extraction service isn't set up correctly. This is on our side; try again later.",
  provider_unavailable: "The extraction service didn't respond after several attempts. Try again in a few minutes.",
  provider_timeout: "The extraction took too long and was stopped. Try again in a few minutes.",
  provider_output_invalid: "The extraction service returned data we couldn't read, so nothing was saved.",
  stalled: "The extraction stopped responding and was closed. Try again.",
  internal: "Something went wrong while saving your profile. Try again.",
};
const PERMANENT: ErrorCode[] = ["invalid_url", "not_configured", "profile_unavailable", "profile_mismatch", "provider_auth", "provider_quota", "provider_misconfigured", "provider_output_invalid"];

export type LinkedInJobMeta = {
  profileUrl: string;
  username: string;
  actorId: string;
  trigger: ExtractionTrigger;
  attempts: number;
  runId?: string | null;
  datasetId?: string | null;
  runStartedAt?: number | null;
  tokenRef?: string | null;
  notBefore?: number;
  leaseUntil?: number;
  leaseToken?: string;
  heartbeatAt?: number;
  cancelRequested?: boolean;
  lastTransientError?: ErrorCode;
  outcome?: "succeeded" | "partial" | "failed" | "cancelled";
  errorCode?: ErrorCode;
  counts?: Partial<Record<LinkedInRecordKind, number>>;
  unavailableSections?: LinkedInRecordKind[];
  rejected?: number;
  websitesEnriched?: number;
};

export type JobState = "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";
export type ExtractionJobView = {
  id: string;
  state: JobState;
  trigger: ExtractionTrigger;
  step: "waiting" | "starting" | "extracting" | "saving" | "done";
  attempt: number;
  maxAttempts: number;
  retryAt: string | null;
  profileUrl: string;
  startedAt: string;
  finishedAt: string | null;
  errorCode: ErrorCode | null;
  message: string | null;
  counts: Partial<Record<LinkedInRecordKind, number>>;
  unavailableSections: LinkedInRecordKind[];
};

const IN_FLIGHT = ["queued", "processing"] as const;
const meta = (job: SourceProcessingJob) => (job.metadata || {}) as LinkedInJobMeta;
export const isInFlight = (job: SourceProcessingJob | null): job is SourceProcessingJob => Boolean(job && (IN_FLIGHT as readonly string[]).includes(job.status));
export const leaseExpired = (job: SourceProcessingJob, now = Date.now()) => !meta(job).leaseUntil || meta(job).leaseUntil! < now;

export function viewOf(job: SourceProcessingJob, now = Date.now()): ExtractionJobView {
  const m = meta(job);
  const inFlight = (IN_FLIGHT as readonly string[]).includes(job.status);
  const state: JobState = inFlight
    ? job.status === "queued" && !m.attempts && !m.runId ? "queued" : "running"
    : m.outcome ?? (job.status === "cancelled" ? "cancelled" : job.status === "completed" ? "succeeded" : "failed");
  const waiting = inFlight && m.notBefore && m.notBefore > now;
  return {
    id: job.id,
    state,
    trigger: m.trigger ?? "initial",
    step: !inFlight ? "done" : waiting || state === "queued" ? "waiting" : job.stage === "persist" || job.stage === "normalize" ? "saving" : m.runId ? "extracting" : "starting",
    attempt: Math.max(1, Math.min(MAX_ATTEMPTS, (m.attempts ?? 0) + (inFlight ? 1 : 0))),
    maxAttempts: MAX_ATTEMPTS,
    retryAt: waiting ? new Date(m.notBefore!).toISOString() : null,
    profileUrl: m.profileUrl,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.completedAt ? job.completedAt.toISOString() : null,
    errorCode: (m.errorCode as ErrorCode) ?? null,
    message: m.errorCode ? ERROR_MESSAGES[m.errorCode] : waiting && m.lastTransientError ? "The extraction service was busy; retrying automatically." : null,
    counts: m.counts ?? {},
    unavailableSections: m.unavailableSections ?? [],
  };
}

export async function latestExtractionJob(personId: string): Promise<SourceProcessingJob | null> {
  const db = await getDb();
  const [job] = await db.select().from(sourceProcessingJobs)
    .where(and(eq(sourceProcessingJobs.personId, personId), eq(sourceProcessingJobs.sourceId, LINKEDIN_JOB_SOURCE)))
    .orderBy(desc(sourceProcessingJobs.createdAt)).limit(1);
  return job ?? null;
}

export class ExtractionRequestError extends Error {
  constructor(public code: "invalid_url" | "not_configured" | "cooldown" | "daily_limit", message: string, public status: number, public retryAfterSeconds?: number) {
    super(message);
  }
}

/**
 * Starts an extraction, or returns the one already running for this student:
 * a double click, a second tab or a repeated request never starts a parallel
 * job (and so never a second paid provider run).
 */
export async function requestExtraction(personId: string, rawUrl: string, trigger: ExtractionTrigger, opts: { now?: number } = {}): Promise<{ job: SourceProcessingJob; existing: boolean }> {
  const now = opts.now ?? Date.now();
  const cfg = getLinkedInExtractionConfig();
  if (!cfg.configured || !cfg.actorId) throw new ExtractionRequestError("not_configured", ERROR_MESSAGES.not_configured, 503);
  const ref = validateLinkedInUrl(rawUrl);
  if (!ref.valid) throw new ExtractionRequestError("invalid_url", ERROR_MESSAGES.invalid_url, 400);

  const latest = await latestExtractionJob(personId);
  if (isInFlight(latest)) return { job: latest, existing: true };

  const db = await getDb();
  const [profile] = await db.select().from(linkedinProfiles).where(eq(linkedinProfiles.personId, personId)).limit(1);
  const sameProfile = profile?.publicIdentifier?.toLowerCase() === ref.username.toLowerCase();
  if (sameProfile && profile?.lastSuccessfulAt && now - profile.lastSuccessfulAt.getTime() < REFRESH_COOLDOWN_MS) {
    const wait = Math.ceil((REFRESH_COOLDOWN_MS - (now - profile.lastSuccessfulAt.getTime())) / 1000);
    throw new ExtractionRequestError("cooldown", `Your profile was extracted moments ago. You can refresh it again in ${Math.ceil(wait / 60)} minutes.`, 429, wait);
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(sourceProcessingJobs).where(and(
    eq(sourceProcessingJobs.personId, personId), eq(sourceProcessingJobs.sourceId, LINKEDIN_JOB_SOURCE),
    gte(sourceProcessingJobs.createdAt, new Date(now - 24 * 60 * 60_000)),
  ));
  if (n >= DAILY_JOB_LIMIT) throw new ExtractionRequestError("daily_limit", "You've reached today's limit for LinkedIn extractions. Try again tomorrow.", 429, 3600);

  let jobId: string;
  try {
    jobId = await SourceProcessingJobService.startJob({
      personId, sourceId: LINKEDIN_JOB_SOURCE, stage: "acquire", status: "queued", modelVersion: LINKEDIN_NORMALIZATION_VERSION,
      metadata: { profileUrl: ref.normalizedUrl, username: ref.username, actorId: cfg.actorId, trigger, attempts: 0 } satisfies LinkedInJobMeta,
    });
  } catch (error) {
    // Another request started one between our check and insert; the unique in-flight index let only one through.
    const running = await latestExtractionJob(personId);
    if (isUniqueViolation(error) && isInFlight(running)) return { job: running, existing: true };
    throw error;
  }

  const connection = await getExternalConnectionByProvider(personId, "linkedin").catch(() => null);
  await saveExternalConnection({
    personId, provider: "linkedin", externalUsername: ref.username, profileUrl: ref.normalizedUrl,
    status: connection?.status === "connected" && sameProfile ? "connected" : "syncing",
    metadata: { extractionStatus: "queued", extractionJobId: jobId },
  });
  return { job: (await SourceProcessingJobService.getJobForPerson(jobId, personId))!, existing: false };
}

function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error, i = 0; e && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    if ((e as { code?: string }).code === "23505" || /uq_linkedin_extract_inflight|duplicate key/i.test(String((e as Error).message))) return true;
  }
  return false;
}

async function patchJob(job: SourceProcessingJob, patch: Partial<LinkedInJobMeta>, opts: { token?: string; stage?: SourceProcessingJob["stage"] } = {}) {
  const db = await getDb();
  const rows = await db.update(sourceProcessingJobs)
    .set({ ...(opts.stage ? { stage: opts.stage } : {}), metadata: sql`coalesce(${sourceProcessingJobs.metadata}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb` })
    .where(and(
      eq(sourceProcessingJobs.id, job.id), eq(sourceProcessingJobs.personId, job.personId), inArray(sourceProcessingJobs.status, [...IN_FLIGHT]),
      ...(opts.token ? [sql`${sourceProcessingJobs.metadata}->>'leaseToken' = ${opts.token}`] : []),
    ))
    .returning();
  return rows[0] ?? null;
}

/** Compare-and-swap lease: exactly one caller runs the next step. */
async function claim(job: SourceProcessingJob, now: number) {
  const db = await getDb();
  const token = crypto.randomBytes(8).toString("hex");
  const rows = await db.update(sourceProcessingJobs)
    .set({ status: "processing", metadata: sql`coalesce(${sourceProcessingJobs.metadata}, '{}'::jsonb) || ${JSON.stringify({ leaseUntil: now + LEASE_MS, leaseToken: token, heartbeatAt: now })}::jsonb` })
    .where(and(
      eq(sourceProcessingJobs.id, job.id), eq(sourceProcessingJobs.personId, job.personId), inArray(sourceProcessingJobs.status, [...IN_FLIGHT]),
      sql`coalesce((${sourceProcessingJobs.metadata}->>'leaseUntil')::bigint, 0) < ${now}`,
    ))
    .returning();
  return rows[0] ? { job: rows[0], token } : null;
}

// ─── Apify ────────────────────────────────────────────────────────────────────

class ProviderError extends Error {
  constructor(public code: ErrorCode) { super(code); }
}
type ApifyRun = { id?: string; status?: string; defaultDatasetId?: string };

const tokenRef = (token: string) => crypto.createHash("sha256").update(token).digest("hex").slice(0, 12);
function apifyTokens(): string[] {
  const pool = new KeyPool(APIFY_TOKEN_ENV_VARS);
  return Array.from({ length: pool.size() }, () => pool.getNextKey()!).filter(Boolean);
}
/** The pooled token with this hash; a run can only be read with the token of the account that started it. */
const tokenFor = (ref: string | null | undefined) => apifyTokens().find((t) => tokenRef(t) === ref) ?? null;

function httpError(status: number): ProviderError {
  if (status === 401 || status === 403) return new ProviderError("provider_auth");
  if (status === 402) return new ProviderError("provider_quota");
  if (status === 404 || status === 400) return new ProviderError("provider_misconfigured");
  return new ProviderError("provider_unavailable"); // 408, 429, 5xx
}

async function apify<T>(token: string, path: string, init: RequestInit & { timeoutMs: number }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${APIFY_API}${path}`, {
      ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(init.timeoutMs), cache: "no-store",
    });
  } catch (error) {
    throw new ProviderError(error instanceof Error && /timeout|abort/i.test(error.name + error.message) ? "provider_timeout" : "provider_unavailable");
  }
  if (!res.ok) throw httpError(res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ProviderError("provider_output_invalid");
  }
}

const actorPath = (actorId: string) => encodeURIComponent(actorId.replace("/", "~"));
const startRun = (token: string, actorId: string, profileUrl: string, waitSecs: number) =>
  apify<{ data?: ApifyRun }>(token, `/acts/${actorPath(actorId)}/runs?waitForFinish=${waitSecs}`, { method: "POST", body: JSON.stringify({ profileUrls: [profileUrl] }), timeoutMs: (waitSecs + 10) * 1000 });
const getRun = (token: string, runId: string, waitSecs: number) =>
  apify<{ data?: ApifyRun }>(token, `/actor-runs/${encodeURIComponent(runId)}?waitForFinish=${waitSecs}`, { method: "GET", timeoutMs: (waitSecs + 10) * 1000 });
const getItems = (token: string, datasetId: string) =>
  apify<unknown[]>(token, `/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=1&format=json`, { method: "GET", timeoutMs: 15_000 });
async function abortRun(token: string, runId: string) {
  await apify(token, `/actor-runs/${encodeURIComponent(runId)}/abort`, { method: "POST", timeoutMs: 8_000 }).catch(() => null);
}

const RUNNING = new Set(["READY", "RUNNING", "ABORTING", "TIMING-OUT"]);

// ─── The step ─────────────────────────────────────────────────────────────────

/**
 * Advances the job until it settles or `budgetMs` is spent. Safe to call from
 * anywhere at any time: it does nothing unless it wins the lease.
 */
export async function advanceExtractionJob(personId: string, jobId: string, opts: { budgetMs?: number; now?: () => number } = {}): Promise<ExtractionJobView | null> {
  const clock = opts.now ?? Date.now;
  const deadline = clock() + (opts.budgetMs ?? 45_000);
  let job = await SourceProcessingJobService.getJobForPerson(jobId, personId);
  if (!job || job.sourceId !== LINKEDIN_JOB_SOURCE) return null;

  // A bounded number of steps per call: each provider wait normally takes seconds, but never spin.
  for (let steps = 0; isInFlight(job) && steps < 12; steps++) {
    const m = meta(job);
    if (m.notBefore && m.notBefore > clock()) break; // backing off
    const lease = await claim(job, clock());
    if (!lease) break; // someone else holds it
    job = lease.job;
    const lm = meta(job);
    try {
      if (lm.cancelRequested) {
        const token = tokenFor(lm.tokenRef);
        if (token && lm.runId) await abortRun(token, lm.runId);
        job = (await settle(job, { outcome: "cancelled" })) ?? job;
        break;
      }
      const next = await step(job, lease.token, clock, deadline);
      job = next ?? (await SourceProcessingJobService.getJobForPerson(jobId, personId))!;
    } catch (error) {
      job = (await onError(job, lease.token, error, clock)) ?? (await SourceProcessingJobService.getJobForPerson(jobId, personId))!;
    }
    // Another provider wait needs real time left; otherwise the next poll or the cron continues.
    if (clock() >= deadline - 20_000) break;
  }
  return job ? viewOf(job, clock()) : null;
}

async function step(job: SourceProcessingJob, lease: string, clock: () => number, deadline: number): Promise<SourceProcessingJob | null> {
  const m = meta(job);
  const cfg = getLinkedInExtractionConfig();
  if (!cfg.configured) throw new ProviderError("not_configured");
  const waitSecs = Math.max(0, Math.min(25, Math.floor((deadline - clock()) / 1000) - 15));

  if (!m.runId) {
    const tokens = apifyTokens();
    const token = tokens[(m.attempts ?? 0) % tokens.length];
    const { data } = await startRun(token, m.actorId, m.profileUrl, waitSecs);
    if (!data?.id) throw new ProviderError("provider_output_invalid");
    logger.info("linkedin_extract.run_started", { status: data.status ?? "unknown", metadata: { jobId: job.id, attempt: (m.attempts ?? 0) + 1 } });
    const patched = await patchJob(job, { runId: data.id, datasetId: data.defaultDatasetId ?? null, runStartedAt: clock(), tokenRef: tokenRef(token), leaseUntil: clock() + LEASE_MS }, { token: lease, stage: "extract" });
    if (!patched) return null;
    return data.status === "SUCCEEDED" ? collect(patched, lease, token, data, clock) : afterPoll(patched, lease, token, data, clock);
  }

  const token = tokenFor(m.tokenRef);
  if (!token) throw new ProviderError("provider_auth"); // the token that started the run was removed from the pool
  const { data } = await getRun(token, m.runId, waitSecs);
  if (data?.status === "SUCCEEDED") return collect(job, lease, token, data, clock);
  return afterPoll(job, lease, token, data ?? {}, clock);
}

/** Run not finished yet, or finished without success. */
async function afterPoll(job: SourceProcessingJob, lease: string, token: string, run: ApifyRun, clock: () => number) {
  const m = meta(job);
  if (RUNNING.has(run.status ?? "")) {
    if (m.runStartedAt && clock() - m.runStartedAt > RUN_TIMEOUT_MS) {
      await abortRun(token, m.runId!);
      throw new ProviderError("provider_timeout");
    }
    return patchJob(job, { leaseUntil: 0, heartbeatAt: clock() }, { token: lease });
  }
  // FAILED, ABORTED, TIMED-OUT: the provider could not finish this attempt.
  throw new ProviderError(run.status === "TIMED-OUT" ? "provider_timeout" : "provider_unavailable");
}

async function collect(job: SourceProcessingJob, lease: string, token: string, run: ApifyRun, clock: () => number) {
  const m = meta(job);
  const datasetId = run.defaultDatasetId ?? m.datasetId;
  if (!datasetId) throw new ProviderError("provider_output_invalid");
  const items = await getItems(token, datasetId);
  if (!Array.isArray(items)) throw new ProviderError("provider_output_invalid");
  const item = items[0] as Record<string, unknown> | undefined;
  // An empty dataset, or an item that only reports an error, means the profile wasn't readable publicly.
  if (!item || (typeof item.error === "string" && !item.fullName && !item.firstName)) throw new ProviderError("profile_unavailable");

  let normalized: NormalizationResult;
  try {
    normalized = normalizeLinkedInProfile(item, m.profileUrl);
  } catch (error) {
    if (error instanceof ProfileMismatchError) throw new ProviderError("profile_mismatch");
    if (error instanceof MalformedProviderOutputError) throw new ProviderError("provider_output_invalid");
    throw error;
  }
  const p = normalized.profile;
  if (!p.fullName && !p.headline && !normalized.records.length) throw new ProviderError("profile_unavailable");

  const saving = await patchJob(job, { leaseUntil: clock() + LEASE_MS }, { token: lease, stage: "persist" });
  if (!saving) return null;
  const counts = await persistProfile(job.personId, job.id, m, normalized, clock);
  const websitesEnriched = await enrichWebsites(job.personId, normalized.records).catch(() => 0);
  // A dropped link (unsafe or malformed URL) is deliberate filtering, not missing profile content.
  const rejected = Object.entries(normalized.rejected).reduce((a, [kind, n]) => a + (kind === "link" ? 0 : n ?? 0), 0);
  const unavailableSections = RECORD_KINDS.filter((k) => !normalized.sectionsReturned.includes(k));
  const core: LinkedInRecordKind[] = ["experience", "education", "skill"];
  const outcome = rejected > 0 || core.some((k) => unavailableSections.includes(k)) ? "partial" : "succeeded";
  return settle(saving, { outcome, counts, unavailableSections, rejected, websitesEnriched });
}

async function onError(job: SourceProcessingJob, lease: string, error: unknown, clock: () => number) {
  const m = meta(job);
  const code: ErrorCode = error instanceof ProviderError ? error.code : "internal";
  if (!(error instanceof ProviderError)) {
    logger.error("linkedin_extract.step_failed", { status: "failed", error: error instanceof Error ? error.message.slice(0, 200) : "unknown", metadata: { jobId: job.id } });
  } else {
    logger.warn("linkedin_extract.provider_error", { status: code, metadata: { jobId: job.id, attempt: (m.attempts ?? 0) + 1 } });
  }
  const attempts = (m.attempts ?? 0) + 1;
  if (PERMANENT.includes(code) || attempts >= MAX_ATTEMPTS) return settle(job, { outcome: "failed", errorCode: code, attempts });
  // Transient: a fresh provider run after a backoff. The failed run's id is dropped, so it is never re-read.
  return patchJob(job, {
    attempts, runId: null, datasetId: null, runStartedAt: null, lastTransientError: code, leaseUntil: 0, heartbeatAt: clock(),
    notBefore: clock() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)],
  }, { token: lease, stage: "acquire" });
}

async function settle(job: SourceProcessingJob, result: Partial<LinkedInJobMeta> & { outcome: NonNullable<LinkedInJobMeta["outcome"]> }) {
  const status = result.outcome === "cancelled" ? "cancelled" : result.outcome === "failed" ? "failed" : "completed";
  const settled = await SourceProcessingJobService.transition({
    jobId: job.id, personId: job.personId, from: [...IN_FLIGHT], to: status,
    errorCode: result.errorCode ?? (result.outcome === "partial" ? "PARTIAL" : null),
    errorMessage: result.errorCode ? ERROR_MESSAGES[result.errorCode] : null,
    metadata: { ...result, leaseUntil: 0, notBefore: 0 },
  });
  if (!settled) return null;
  const m = meta(settled);
  const db = await getDb();
  const [profile] = await db.select().from(linkedinProfiles).where(eq(linkedinProfiles.personId, job.personId)).limit(1);
  const succeeded = result.outcome === "succeeded" || result.outcome === "partial";
  const at = new Date().toISOString();
  if (profile && !succeeded) {
    // The last good extraction stays; only its status note changes.
    await db.update(linkedinProfiles).set({ lastJobId: job.id, updatedAt: new Date() }).where(eq(linkedinProfiles.personId, job.personId));
  }
  const hadSuccess = Boolean(profile?.lastSuccessfulAt);
  const total = Object.values(m.counts ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  await saveExternalConnection({
    personId: job.personId, provider: "linkedin", externalUsername: m.username, profileUrl: m.profileUrl,
    status: succeeded || hadSuccess ? "connected" : result.outcome === "cancelled" ? "reference_only" : "needs_attention",
    metadata: {
      extractionStatus: result.outcome, extractionJobId: job.id, extractionProvider: "apify",
      ...(succeeded ? { lastExtractedAt: at, lastSyncedAt: at, extractionRecordCount: total } : {}),
      extractionError: result.errorCode ?? null,
    },
  }).catch((error) => logger.warn("linkedin_extract.connection_update_failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
  logger.info("linkedin_extract.settled", { status: result.outcome, metadata: { jobId: job.id, records: total, errorCode: result.errorCode ?? null } });
  return settled;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistProfile(personId: string, jobId: string, m: LinkedInJobMeta, n: NormalizationResult, clock: () => number) {
  const db = await getDb();
  const now = new Date(clock());
  const p = n.profile;
  const [existing] = await db.select().from(linkedinProfiles).where(eq(linkedinProfiles.personId, personId)).limit(1);

  // The student switched to a different profile: the previous person's records must not mix with this one's.
  if (existing?.publicIdentifier && p.publicIdentifier && existing.publicIdentifier.toLowerCase() !== p.publicIdentifier.toLowerCase()) {
    await db.delete(linkedinProfileRecords).where(eq(linkedinProfileRecords.personId, personId));
  }

  await db.insert(linkedinProfiles).values({
    id: `lip_${personId}`, personId, profileUrl: p.profileUrl, publicIdentifier: p.publicIdentifier, fullName: p.fullName, headline: p.headline,
    about: p.about, location: p.location, provider: "apify", providerActor: m.actorId, normalizationVersion: LINKEDIN_NORMALIZATION_VERSION,
    extractionStatus: "succeeded", lastJobId: jobId, lastSuccessfulJobId: jobId, lastSuccessfulAt: now, createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: linkedinProfiles.personId,
    set: {
      profileUrl: p.profileUrl, publicIdentifier: p.publicIdentifier,
      // A field this run did not return keeps its previous value.
      fullName: sql`coalesce(excluded.full_name, ${linkedinProfiles.fullName})`,
      headline: sql`coalesce(excluded.headline, ${linkedinProfiles.headline})`,
      about: sql`coalesce(excluded.about, ${linkedinProfiles.about})`,
      location: sql`coalesce(excluded.location, ${linkedinProfiles.location})`,
      provider: "apify", providerActor: m.actorId, normalizationVersion: LINKEDIN_NORMALIZATION_VERSION, extractionStatus: "succeeded",
      lastJobId: jobId, lastSuccessfulJobId: jobId, lastSuccessfulAt: now, updatedAt: now,
    },
  });

  if (n.records.length) {
    await db.insert(linkedinProfileRecords).values(n.records.map((r) => ({
      id: `lir_${crypto.createHash("sha256").update(`${personId}|${r.kind}|${r.key}`).digest("hex").slice(0, 24)}`,
      personId, kind: r.kind, recordKey: r.key, data: r.data, source: "linkedin", provider: "apify", sourceUrl: p.profileUrl,
      providerRecordId: r.providerRecordId ?? null, firstSeenAt: now, lastSeenAt: now, lastJobId: jobId, missingSince: null, createdAt: now, updatedAt: now,
    }))).onConflictDoUpdate({
      target: [linkedinProfileRecords.personId, linkedinProfileRecords.kind, linkedinProfileRecords.recordKey],
      set: {
        // Website details read by Firecrawl live under data.website and survive a re-extraction.
        data: sql`case when ${linkedinProfileRecords.data} ? 'website' then excluded.data || jsonb_build_object('website', ${linkedinProfileRecords.data}->'website') else excluded.data end`,
        sourceUrl: sql`excluded.source_url`, provider: "apify", lastSeenAt: now, lastJobId: jobId, missingSince: null, updatedAt: now,
      },
    });
  }
  // A section the provider returned that no longer lists a record: mark it, never delete it.
  if (n.sectionsReturned.length) {
    await db.update(linkedinProfileRecords).set({ missingSince: now, updatedAt: now }).where(and(
      eq(linkedinProfileRecords.personId, personId), inArray(linkedinProfileRecords.kind, n.sectionsReturned),
      ne(linkedinProfileRecords.lastJobId, jobId), isNull(linkedinProfileRecords.missingSince),
    ));
  }

  const counts: Partial<Record<LinkedInRecordKind, number>> = {};
  for (const r of n.records) counts[r.kind] = (counts[r.kind] ?? 0) + 1;

  await writeEvidenceBatch(personId, toEvidence(n.records, p.profileUrl));
  await writeDraftCandidates(personId, n.records, p.profileUrl);
  return counts;
}

const keySlug = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 50);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const span = (d: Record<string, unknown>, a = "startDate", b = "endDate") =>
  [str(d[a]), d.current ? "present" : str(d[b])].filter(Boolean).join(" – ");

/**
 * Evidence rows for downstream intelligence. LinkedIn content is self-declared:
 * originSource "linkedin" makes skill intelligence score skills as self-claims,
 * and the reference is the repository's own `linkedin:<importKey>`, not an
 * external artifact URL.
 * Experience, education and certification keys match the earlier Apify import,
 * so rows it created are updated, not duplicated.
 */
export function toEvidence(records: NormalizedRecord[], profileUrl: string): EvidenceInsertParams[] {
  const base = { source: "imported" as const, verificationStatus: "imported" as const, originSource: "linkedin" };
  const out: EvidenceInsertParams[] = [];
  for (const { kind, data: d } of records) {
    const from = `from the public LinkedIn profile ${profileUrl}`;
    if (kind === "experience") {
      out.push({ ...base, category: "experience", subject: `${d.title} at ${d.company}`, value: span(d) || str(d.title),
        importKey: `linkedin_apify_exp_${keySlug(d.company)}_${keySlug(d.title)}`, interpretation: str(d.description) || `${d.title} at ${d.company}, ${from}.`, whyItMatters: "Work history the student lists on LinkedIn (self-declared)." });
    } else if (kind === "education") {
      out.push({ ...base, category: "education", subject: str(d.institution), value: [d.degree, d.fieldOfStudy].filter(Boolean).join(", ") || "Education",
        importKey: `linkedin_apify_edu_${keySlug(d.institution)}`, interpretation: `${[d.degree, d.fieldOfStudy].filter(Boolean).join(", ") || "Studied"} at ${d.institution}${d.endDate ? ` (${d.endDate})` : ""}, ${from}.`, whyItMatters: "Education the student lists on LinkedIn (self-declared)." });
    } else if (kind === "skill") {
      out.push({ ...base, category: "skill", subject: str(d.name), value: "Listed on LinkedIn",
        importKey: `linkedin_apify_skill_${keySlug(d.name)}`, interpretation: `${d.name}, listed as a skill ${from}.`, whyItMatters: "A skill the student claims on LinkedIn; it needs other evidence to count as demonstrated." });
    } else if (kind === "certification") {
      out.push({ ...base, category: "other", subject: str(d.name), value: d.issuer ? `Issued by ${d.issuer}` : "Certification",
        importKey: `linkedin_apify_cert_${keySlug(d.name)}`, interpretation: `${d.name}${d.issuer ? ` from ${d.issuer}` : ""}${d.issueDate ? ` (${d.issueDate})` : ""}, ${from}.`, whyItMatters: "A certification listed on LinkedIn; not verified with the issuer." });
    } else if (kind === "project" || kind === "publication" || kind === "honor" || kind === "volunteering") {
      const subject = str(d.title) || str(d.organization) || str(d.role);
      const label = { project: "Project", publication: "Publication", honor: "Honor or award", volunteering: "Volunteering" }[kind];
      out.push({ ...base, category: kind === "publication" ? "publication" : "other", subject, value: label,
        importKey: `linkedin_apify_${kind}_${keySlug(subject)}_${keySlug(d.issuer ?? d.role ?? d.publisher)}`,
        interpretation: `${[subject, str(d.description)].filter(Boolean).join(": ").slice(0, 600)} (${label.toLowerCase()} ${from}${d.url ? `; ${d.url}` : ""}).`,
        whyItMatters: `${label} the student lists on LinkedIn (self-declared).` });
    }
  }
  return out;
}

async function writeDraftCandidates(personId: string, records: NormalizedRecord[], profileUrl: string) {
  const experiences = records.filter((r) => r.kind === "experience").slice(0, 20).map(({ data: d }) => ({
    company: str(d.company), role: str(d.title), startDate: str(d.startDate) || undefined, endDate: d.current ? "Present" : str(d.endDate) || undefined,
    type: /intern/i.test(str(d.employmentType) + str(d.title)) ? "internship" : /freelance/i.test(str(d.employmentType)) ? "freelance" : undefined,
    status: "candidate", source: "linkedin",
  }));
  const education = records.filter((r) => r.kind === "education").slice(0, 10).map(({ data: d }) => ({
    institution: str(d.institution), degree: str(d.degree) || undefined, fieldOfStudy: str(d.fieldOfStudy) || undefined,
    startDate: str(d.startDate) || undefined, endDate: str(d.endDate) || undefined, status: "candidate", source: "linkedin",
  }));
  const { writeOnboardingDraft } = await import("@/lib/services/onboarding-v2-service");
  // A system write: it never overwrites what the student entered, and every entry stays a candidate until they confirm it.
  await writeOnboardingDraft(personId, { profiles: { linkedin: profileUrl }, ...(experiences.length ? { experiences } : {}), ...(education.length ? { education } : {}) }, { origin: "system" })
    .catch((error) => logger.warn("linkedin_extract.draft_failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
}

/**
 * Title and description of up to two personal websites the profile lists,
 * through Firecrawl's existing SSRF-gated client. Non-fatal and optional.
 */
async function enrichWebsites(personId: string, records: NormalizedRecord[]): Promise<number> {
  const { enrichWebsiteWithFirecrawl, getFirecrawlCapacity } = await import("@/lib/connectors/firecrawl/client");
  const { isSafePublicUrl } = await import("@/lib/connectors/portfolio/client");
  if (!getFirecrawlCapacity().configured) return 0;
  const sites = records.filter((r) => r.kind === "link").map((r) => ({ key: r.key, url: str(r.data.url) }))
    .filter(({ url }) => {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return isSafePublicUrl(url).safe && !/(^|\.)(linkedin\.com|lnkd\.in)$/.test(host);
      } catch { return false; }
    }).slice(0, MAX_WEBSITES);
  let enriched = 0;
  const db = await getDb();
  for (const site of sites) {
    const page = await enrichWebsiteWithFirecrawl(site.url).catch(() => null);
    if (!page?.enriched || (!page.title && !page.description)) continue;
    const website = { title: page.title, description: page.description, provider: "firecrawl", fetchedAt: page.extractedAt };
    await db.update(linkedinProfileRecords)
      .set({ data: sql`${linkedinProfileRecords.data} || jsonb_build_object('website', ${JSON.stringify(website)}::jsonb)`, updatedAt: new Date() })
      .where(and(eq(linkedinProfileRecords.personId, personId), eq(linkedinProfileRecords.kind, "link"), eq(linkedinProfileRecords.recordKey, site.key)));
    enriched++;
  }
  return enriched;
}

// ─── Reads, cancel, cron ──────────────────────────────────────────────────────

export type SavedRecord = { kind: LinkedInRecordKind; data: Record<string, unknown>; missing: boolean; lastSeenAt: string };

export async function readSavedProfile(personId: string) {
  const db = await getDb();
  const [profile] = await db.select().from(linkedinProfiles).where(eq(linkedinProfiles.personId, personId)).limit(1);
  if (!profile) return null;
  const rows = await db.select().from(linkedinProfileRecords).where(eq(linkedinProfileRecords.personId, personId))
    .orderBy(linkedinProfileRecords.kind, desc(linkedinProfileRecords.lastSeenAt), linkedinProfileRecords.recordKey);
  const counts = Object.fromEntries(RECORD_KINDS.map((k) => [k, 0])) as Record<LinkedInRecordKind, number>;
  const records: SavedRecord[] = rows.map((r) => {
    if (!r.missingSince) counts[r.kind as LinkedInRecordKind]++;
    return { kind: r.kind as LinkedInRecordKind, data: r.data as Record<string, unknown>, missing: Boolean(r.missingSince), lastSeenAt: r.lastSeenAt.toISOString() };
  });
  return {
    profile: {
      profileUrl: profile.profileUrl, publicIdentifier: profile.publicIdentifier, fullName: profile.fullName, headline: profile.headline,
      about: profile.about, location: profile.location, provider: profile.provider, lastSuccessfulAt: profile.lastSuccessfulAt?.toISOString() ?? null,
    },
    counts,
    records,
  };
}

/** Stops a running extraction; a profile saved earlier is untouched. */
export async function requestExtractionCancel(personId: string, jobId: string): Promise<ExtractionJobView | null> {
  const job = await SourceProcessingJobService.getJobForPerson(jobId, personId);
  if (!job || job.sourceId !== LINKEDIN_JOB_SOURCE) return null;
  if (!isInFlight(job)) return viewOf(job);
  const flagged = await patchJob(job, { cancelRequested: true });
  if (flagged && leaseExpired(flagged)) {
    const lease = await claim(flagged, Date.now());
    if (lease) {
      const token = tokenFor(meta(lease.job).tokenRef);
      if (token && meta(lease.job).runId) await abortRun(token, meta(lease.job).runId!);
      return viewOf((await settle(lease.job, { outcome: "cancelled" })) ?? lease.job);
    }
  }
  return viewOf(flagged ?? job);
}

/** Cron: continue extractions nobody is watching; close ones silent for hours. */
export async function resumeStalledExtractions(opts: { limit?: number; budgetMs?: number } = {}) {
  const db = await getDb();
  const jobs = await db.select().from(sourceProcessingJobs)
    .where(and(eq(sourceProcessingJobs.sourceId, LINKEDIN_JOB_SOURCE), inArray(sourceProcessingJobs.status, [...IN_FLIGHT])))
    .orderBy(sourceProcessingJobs.createdAt).limit(opts.limit ?? 5);
  const out: Array<{ jobId: string; state: string }> = [];
  for (const job of jobs) {
    if (Date.now() - (meta(job).heartbeatAt ?? job.startedAt.getTime()) > STALE_AFTER_MS) {
      const lease = await claim(job, Date.now());
      const settled = lease ? await settle(lease.job, { outcome: "failed", errorCode: "stalled" }) : null;
      out.push({ jobId: job.id, state: settled ? "failed" : "skipped" });
      continue;
    }
    const view = await advanceExtractionJob(job.personId, job.id, { budgetMs: opts.budgetMs ?? 20_000 });
    out.push({ jobId: job.id, state: view?.state ?? "missing" });
  }
  return out;
}
