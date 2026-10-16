/**
 * Optional LinkedIn import (Tasks 1.6.1, 1.6.7, 1.6.8). Nothing in onboarding,
 * scoring or any feature depends on it; skipping is always free.
 *
 * Flow (spans several requests, so it drives the sync state machine directly):
 *   connect  -> op queued -> running, worker session started
 *   advance  -> (poll) running -> awaiting_user on an OTP challenge
 *   otp      -> awaiting_user -> running, code relayed (60 s window)
 *   advance  -> running -> succeeded (profile persisted) | dead_letter
 *   skip     -> awaiting_user/queued -> skipped_optional, worker session cancelled
 *   disconnect -> stored password + cookies erased, worker sessions purged
 *
 * Account protection: maxAttempts = 1 (no automatic retry ever), at most one
 * login attempt per 24 h, at most one import per 14 days; CAPTCHA, account
 * hold and wrong password dead-letter immediately.
 */
import { decryptConnectionToken, encryptConnectionToken } from "@/lib/security/connection-token";
import { disconnectConnection, getExternalConnectionByProvider, removeConnectionMetadataKeys, saveExternalConnection } from "@/lib/repositories/connection-repository";
import { writeEvidenceBatch } from "@/lib/repositories/evidence-repository";
import { LinkedInWorker, LinkedInWorkerError, type LinkedInProfile } from "@/lib/connectors/linkedin/worker-client";
import { SOURCE_SYNC_POLICY } from "@/lib/sync/policy";
import {
  claimSyncOperation, completeSyncOperation, failSyncOperation, latestSyncOperations, startSyncOperation,
  setOperationResult, SyncError, transitionOperation, type SyncOperationRow,
} from "@/lib/sync/sync-operation";
import { logger } from "@/lib/logger";

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE = new Set(["queued", "running", "awaiting_user"]);
/** Login + 60 s code window + scrape fit well inside this; past it the import is treated as lost. */
const MAX_IMPORT_MS = 5 * 60 * 1000;

export class LinkedInPolicyError extends Error {
  constructor(message: string, readonly retryAt?: Date) {
    super(message);
  }
}

async function latest(personId: string) {
  return (await latestSyncOperations(personId)).find((op) => op.source === "linkedin") ?? null;
}
const sessionOf = (op: SyncOperationRow) => (op.result as { workerSessionId?: string } | null)?.workerSessionId;

export type LinkedInStatus = {
  state: string;
  operationId?: string;
  challengeSecondsLeft?: number | null;
  error?: string | null;
};
const view = (op: SyncOperationRow | null, extra: Partial<LinkedInStatus> = {}): LinkedInStatus =>
  op ? { state: op.state, operationId: op.id, error: op.lastError, ...extra } : { state: "not_started", ...extra };

/** Enforces 1 login attempt / 24 h and the 14-day import cooldown before anything is sent. */
export async function assertLinkedInAllowed(personId: string, now = Date.now()) {
  const ops = (await latestSyncOperations(personId)).filter((op) => op.source === "linkedin");
  const op = ops[0];
  if (!op) return;
  if (ACTIVE.has(op.state)) throw new LinkedInPolicyError("A LinkedIn import is already in progress.");
  const lastAttempt = op.startedAt?.getTime();
  if (lastAttempt && now - lastAttempt < DAY) {
    throw new LinkedInPolicyError("To keep your LinkedIn account safe we sign in at most once a day. Try again tomorrow.", new Date(lastAttempt + DAY));
  }
  const lastImport = op.state === "succeeded" ? op.finishedAt?.getTime() : undefined;
  if (lastImport && now - lastImport < SOURCE_SYNC_POLICY.linkedin.ttlMs) {
    throw new LinkedInPolicyError("Your LinkedIn data was imported recently. It can be refreshed every 14 days.", new Date(lastImport + SOURCE_SYNC_POLICY.linkedin.ttlMs));
  }
}

export async function connectLinkedIn(personId: string, email: string, password: string, requestId?: string): Promise<LinkedInStatus> {
  await assertLinkedInAllowed(personId);
  const prior = await getExternalConnectionByProvider(personId, "linkedin");
  // AES-256-GCM, AAD bound to personId; the plaintext never reaches the DB or a log.
  await saveExternalConnection({
    personId, provider: "linkedin", externalUsername: email.trim().toLowerCase(),
    profileUrl: prior?.profileUrl || "https://www.linkedin.com/",
    status: "detected",
    metadata: { ...((prior?.metadata as Record<string, unknown>) || {}), encryptedPassword: encryptConnectionToken(password, personId), sessionCookies: null },
  });
  const { operation } = await startSyncOperation({ personId, source: "linkedin", trigger: "user", requestId });
  if (operation.state !== "queued") return view(operation);
  const running = await claimSyncOperation(operation);
  if (!running) return view(await latest(personId));
  try {
    const session = await LinkedInWorker.start(personId, email, password, running.correlationId);
    const withSession = await setOperationResult(running, { workerSessionId: session.session_id });
    logger.info("linkedin.session.started", { correlationId: running.correlationId, metadata: { operationId: running.id } });
    return view(withSession);
  } catch (error) {
    const failed = await failSyncOperation(running, new SyncError(error instanceof Error ? error.message : "LinkedIn worker unavailable", "linkedin_worker_unavailable", false));
    return view(failed);
  }
}

/** Poll: reflects the worker's state into the sync operation and persists a finished import. */
export async function advanceLinkedIn(personId: string): Promise<LinkedInStatus> {
  const op = await latest(personId);
  if (!op || !ACTIVE.has(op.state) || !sessionOf(op)) return view(op);
  let session;
  try {
    session = await LinkedInWorker.status(personId, sessionOf(op)!);
  } catch (error) {
    if (error instanceof LinkedInWorkerError && error.status === 404) {
      // The worker restarted and lost the session (Render free tier sleeps).
      return view(await failFromWaiting(op, new SyncError("The LinkedIn session was interrupted. You can try again tomorrow.", "linkedin_session_lost", false)));
    }
    // Transient (worker busy / network): keep polling, but never forever.
    if (op.startedAt && Date.now() - op.startedAt.getTime() > MAX_IMPORT_MS) {
      return view(await failFromWaiting(op, new SyncError("The LinkedIn import stopped responding. You can try again tomorrow.", "linkedin_session_lost", false)));
    }
    return view(op);
  }
  switch (session.state) {
    case "starting": case "verifying": case "scraping":
      return view(op);
    case "challenge_required": {
      // Right after a relay the worker still reports the challenge until it
      // picks the code up (<= 0.5 s): don't re-enter awaiting_user for it.
      const relayed = Boolean((op.result as { otpRelayedAt?: number } | null)?.otpRelayedAt);
      const waiting = op.state === "running" && !relayed ? await transitionOperation(op, "awaiting_user", "worker") : op;
      return view(waiting, { challengeSecondsLeft: session.challenge_seconds_left });
    }
    case "succeeded": {
      if (op.state !== "running") return view(op);
      const summary = await persistLinkedInProfile(personId, session.profile!);
      return view(await completeSyncOperation(op, "succeeded", { workerSessionId: sessionOf(op), ...summary }));
    }
    case "cancelled":
      return view(op.state === "awaiting_user" ? await transitionOperation(op, "skipped_optional", "user", { finishedAt: new Date() }) : op);
    case "timed_out":
      return view(await failFromWaiting(op, new SyncError(session.error || "No verification code was entered in time.", "linkedin_otp_timeout", false), true));
    case "bad_credentials":
      await forgetStoredPassword(personId); // a wrong password must not be kept
      return view(await failFromWaiting(op, new SyncError(session.error || "LinkedIn rejected the credentials.", "linkedin_bad_credentials", false)));
    default: // captcha, restricted, failed: never retried automatically
      return view(await failFromWaiting(op, new SyncError(session.error || "LinkedIn import failed.", `linkedin_${session.state}`, false)));
  }
}

/** awaiting_user cannot go straight to dead_letter; pass through timed_out first. */
async function failFromWaiting(op: SyncOperationRow, error: SyncError, timedOut = false) {
  const from = op.state === "awaiting_user" ? await transitionOperation(op, "timed_out", "worker") : op;
  return failSyncOperation(from, error, { timedOut });
}

export async function relayLinkedInOtp(personId: string, code: string): Promise<LinkedInStatus> {
  if (!/^\d{4,8}$/.test(code)) throw new LinkedInPolicyError("Enter the numeric code LinkedIn sent you.");
  const op = await latest(personId);
  if (!op || op.state !== "awaiting_user" || !sessionOf(op)) throw new LinkedInPolicyError("There's no verification waiting for a code.");
  try {
    await LinkedInWorker.relayOtp(personId, sessionOf(op)!, code);
  } catch (error) {
    if (error instanceof LinkedInWorkerError && error.status === 409) {
      return view(await failFromWaiting(op, new SyncError("The 60-second verification window closed.", "linkedin_otp_timeout", false), true));
    }
    throw error;
  }
  const marked = await setOperationResult(op, { otpRelayedAt: Date.now() });
  return view(await transitionOperation(marked, "running", "user"));
}

/** "Skip / I'll do this later" and the modal's Cancel: free, no penalty, nothing kept running. */
export async function skipLinkedIn(personId: string): Promise<LinkedInStatus> {
  const op = await latest(personId);
  if (op && sessionOf(op) && ACTIVE.has(op.state)) await LinkedInWorker.cancel(personId, sessionOf(op)!).catch(() => null);
  if (op && (op.state === "awaiting_user" || op.state === "queued")) {
    return view(await transitionOperation(op, "skipped_optional", "user", { finishedAt: new Date() }));
  }
  if (!op) {
    // Record the choice so the status aggregate shows "skipped", not "pending".
    const { operation } = await startSyncOperation({ personId, source: "linkedin", trigger: "user", requestId: "skip" });
    if (operation.state === "queued") return view(await transitionOperation(operation, "skipped_optional", "user", { finishedAt: new Date() }));
    return view(operation);
  }
  return view(op);
}

async function forgetStoredPassword(personId: string) {
  await removeConnectionMetadataKeys(personId, "linkedin", ["encryptedPassword", "sessionCookies"]);
}

/** Disconnect (1.6.7): erase the stored password and cookies, end every worker session, mark disconnected. */
export async function disconnectLinkedIn(personId: string) {
  await skipLinkedIn(personId).catch(() => null);
  await LinkedInWorker.invalidateAll(personId).catch((error) => logger.warn("linkedin.invalidate_failed", { error: error instanceof Error ? error.message : String(error) }));
  await forgetStoredPassword(personId);
  await disconnectConnection(personId, "linkedin");
}

/** For a scheduled 14-day refresh with the stored credentials (no OTP possible unattended: it would time out safely). */
export async function storedLinkedInPassword(personId: string): Promise<string | null> {
  const conn = await getExternalConnectionByProvider(personId, "linkedin");
  const enc = (conn?.metadata as Record<string, unknown> | undefined)?.encryptedPassword;
  return typeof enc === "string" ? decryptConnectionToken(enc, personId) : null;
}

async function persistLinkedInProfile(personId: string, p: LinkedInProfile) {
  const { writeOnboardingDraft } = await import("@/lib/services/onboarding-v2-service");
  const { CrossSourceFusionService } = await import("@/lib/services/cross-source-fusion-service");
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60);
  await writeEvidenceBatch(personId, [
    ...p.experiences.filter((e) => e.company).map((e) => ({
      category: "experience" as const, subject: `${e.title} at ${e.company}`, value: [e.from_date, e.to_date].filter(Boolean).join(" - ") || e.title,
      source: "imported" as const, verificationStatus: "imported" as const, originSource: "linkedin", sourceReference: p.profile_url,
      importKey: `linkedin_exp_${slug(e.company)}_${slug(e.title)}`, interpretation: e.description || `${e.title} at ${e.company}, from LinkedIn.`,
      whyItMatters: "Work history from your own LinkedIn profile.",
    })),
    ...p.educations.filter((e) => e.institution).map((e) => ({
      category: "education" as const, subject: e.institution, value: e.degree || "Education",
      source: "imported" as const, verificationStatus: "imported" as const, originSource: "linkedin", sourceReference: p.profile_url,
      importKey: `linkedin_edu_${slug(e.institution)}`, interpretation: `${e.degree || "Studied"} at ${e.institution}${e.to_date ? ` (${e.to_date})` : ""}, from LinkedIn.`,
      whyItMatters: "Education from your own LinkedIn profile.",
    })),
  ]);
  // Candidates only; never overwrites what the student typed (system merge, Task 1.2.4).
  await writeOnboardingDraft(personId, {
    profiles: { linkedin: p.profile_url },
    experiences: p.experiences.filter((e) => e.company).map((e) => ({ company: e.company, role: e.title, startDate: e.from_date || undefined, endDate: e.to_date || undefined, status: "candidate", source: "linkedin" })),
    education: p.educations.filter((e) => e.institution).map((e) => ({ institution: e.institution, degree: e.degree || undefined, startDate: e.from_date || undefined, endDate: e.to_date || undefined, status: "candidate", source: "linkedin" })),
  }, { origin: "system" });
  // Precedence (1.2.1): the resume outranks LinkedIn; disagreements are logged, not applied.
  const { readOnboardingDraft } = await import("@/lib/services/onboarding-v2-service");
  const draft = await readOnboardingDraft(personId);
  if (p.educations[0]?.institution) {
    await CrossSourceFusionService.resolveProfileField(personId, "education.institution", [
      { source: "linkedin", value: p.educations[0].institution },
      { source: draft?.resumeDocumentId ? "resume" : "manual", value: draft?.institution },
    ]);
  }
  return { experiences: p.experiences.length, educations: p.educations.length, profileUrl: p.profile_url };
}
