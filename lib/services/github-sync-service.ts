import crypto from "crypto";
import { encryptConnectionToken, decryptConnectionToken, decryptConnectionTokenWithMeta } from "../security/connection-token";
import { coreIngestionReady } from "../security/core-ingestion-gate";
import { mapRawRepoToProject } from "../connectors/github/client";
import { acquireGitHubViaGraphQL, GitHubGraphQLError } from "../connectors/github/graphql";
import { isServeFromCacheError } from "../connectors/rate-limiter";
import { saveProject } from "../repositories/project-repository";
import { writeEvidenceBatch } from "../repositories/evidence-repository";
import type { DiscoveredGitHubProject } from "../connectors/github/mapper";
import { runSyncOperation, SyncError, type RunSyncResult, type SyncContext, type SyncTrigger, type SyncWorkResult } from "../sync/sync-operation";
import type { SourceSyncState } from "../sync/state-machine";
import {
  saveExternalConnection,
  getExternalConnectionByProvider,
  disconnectConnection,
  createSyncRun,
  completeSyncRun,
  saveSourceSnapshot,
  getSourceSnapshots,
} from "../repositories/connection-repository";

export type GitHubSyncResult = {
  success: boolean;
  syncRunId?: string;
  /** sync_operations row (Task 1.9.x); absent when the sync never started. */
  operationId?: string;
  state?: SourceSyncState;
  deduplicated?: boolean;
  correlationId?: string;
  failedRepos?: { repo: string; reason: string }[];
  queries?: number;
  recordsFetched: number;
  recordsChanged: number;
  projects: DiscoveredGitHubProject[];
  error?: string;
};

export async function connectGitHubAccount(params: {
  personId: string;
  username: string;
  externalAccountId?: string;
  token: string;
  scopes?: string[];
}) {
  const cleanUsername = params.username.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "");

  const connection = await saveExternalConnection({
    personId: params.personId,
    provider: "github",
    externalUsername: cleanUsername,
    externalAccountId: params.externalAccountId,
    profileUrl: `https://github.com/${cleanUsername}`,
    displayName: cleanUsername,
    scopes: params.scopes || [],
    status: "connected",
    metadata: {
      connectedAt: new Date().toISOString(),
      encryptedAccessToken: encryptConnectionToken(params.token, params.personId),
    },
  });

  return connection;
}

export async function disconnectGitHubAccount(personId: string) {
  const connection = await getExternalConnectionByProvider(personId, "github");
  const encrypted = (connection?.metadata as Record<string, unknown> | null)?.encryptedAccessToken;
  let providerRevoked = false;
  if (typeof encrypted === "string" && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    try {
      const token = decryptConnectionToken(encrypted, personId);
      const credential = Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString("base64");
      const response = await fetch(`https://api.github.com/applications/${encodeURIComponent(process.env.GITHUB_CLIENT_ID)}/token`, {
        method: "DELETE",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Basic ${credential}`,
          "Content-Type": "application/json",
          "User-Agent": "AI-Tathastu-App",
        },
        body: JSON.stringify({ access_token: token }),
        signal: AbortSignal.timeout(8_000),
      });
      providerRevoked = response.status === 204;
    } catch {
      // Local access is still removed; the student must revoke the grant in GitHub settings.
    }
  }
  await disconnectConnection(personId, "github");
  return {
    success: true,
    providerRevoked,
    message: providerRevoked
      ? "GitHub access revoked and local connection disconnected."
      : "Local GitHub access removed. Revoke this app in GitHub settings to ensure provider access is removed.",
  };
}

export type GitHubWork = (ctx: SyncContext) => Promise<SyncWorkResult>;

/** "Sync Now" / OAuth callback / webhook: start (or join) an operation and run it. */
export async function syncGitHubConnection(
  personId: string,
  token?: string,
  opts: { trigger?: SyncTrigger; requestId?: string } = {}
): Promise<GitHubSyncResult> {
  const prepared = await prepareGitHubSync(personId, token);
  if (typeof prepared !== "function") return prepared;
  const run = await runSyncOperation({ personId, source: "github", trigger: opts.trigger ?? "user", requestId: opts.requestId }, prepared);
  return toGitHubSyncResult(run);
}

/**
 * Resolves the connection and token. Returns the work to run, or a result
 * explaining why there is nothing to run. Used by syncGitHubConnection and by
 * the retry runner (lib/sync/runners.ts), which executes an existing operation.
 */
export async function prepareGitHubSync(personId: string, token?: string): Promise<GitHubSyncResult | GitHubWork> {
  if (!coreIngestionReady()) return { success: false, recordsFetched: 0, recordsChanged: 0, projects: [], error: "GitHub synchronization is unavailable until credential rotation is complete." };
  const connection = await getExternalConnectionByProvider(personId, "github");
  if (!connection) {
    return {
      success: false,
      recordsFetched: 0,
      recordsChanged: 0,
      projects: [],
      error: "GitHub connection not found for this student.",
    };
  }

  if (connection.status === "disconnected") {
    return {
      success: false,
      recordsFetched: 0,
      recordsChanged: 0,
      projects: [],
      error: "GitHub connection is disconnected. Reconnect to resume synchronization.",
    };
  }

  const metadata = (connection.metadata || {}) as Record<string, unknown>;
  let storedToken: string | undefined;
  if (typeof metadata.encryptedAccessToken === "string") {
    try {
      const decrypted = decryptConnectionTokenWithMeta(metadata.encryptedAccessToken, personId);
      storedToken = decrypted.token;
      if (decrypted.keyUsed === "previous") {
        // Transparently re-encrypt with current primary key
        const reencrypted = encryptConnectionToken(decrypted.token, personId);
        await saveExternalConnection({
          personId,
          provider: "github",
          externalUsername: connection.externalUsername,
          profileUrl: connection.profileUrl,
          displayName: connection.displayName || undefined,
          scopes: Array.isArray(connection.scopes) ? (connection.scopes as string[]) : undefined,
          metadata: { ...metadata, encryptedAccessToken: reencrypted },
        }).catch(() => {});
      }
    } catch {
      return {
        success: false,
        recordsFetched: 0,
        recordsChanged: 0,
        projects: [],
        error: "GitHub authorization has expired or was encrypted with a rotated key. Please reconnect GitHub.",
      };
    }
  }
  const authorizedToken = token || storedToken;
  if (!authorizedToken) {
    return { success: false, recordsFetched: 0, recordsChanged: 0, projects: [], error: "Reconnect GitHub to authorize repository sync." };
  }

  return (ctx) => importGitHubRepositories({ personId, connectionId: connection.id, login: connection.externalUsername, token: authorizedToken, metadata, profileUrl: connection.profileUrl, ctx });
}

export function toGitHubSyncResult(run: RunSyncResult): GitHubSyncResult {
  const op = run.operation;
  const result = (op.result || {}) as Partial<GitHubImportSummary>;
  const settled = op.state === "succeeded" || op.state === "partial";
  const inFlight = run.deduplicated && (op.state === "queued" || op.state === "running");
  return {
    success: settled || inFlight,
    syncRunId: result.syncRunId,
    operationId: op.id,
    state: op.state as SourceSyncState,
    deduplicated: run.deduplicated,
    correlationId: op.correlationId,
    recordsFetched: result.recordsFetched ?? 0,
    recordsChanged: result.recordsChanged ?? 0,
    failedRepos: result.failedRepos ?? [],
    queries: result.queries,
    projects: [],
    error: settled || inFlight ? undefined : op.lastError ?? undefined,
  };
}

export type GitHubImportSummary = {
  syncRunId: string;
  recordsFetched: number;
  recordsChanged: number;
  unchanged: number;
  failedRepos: { repo: string; reason: string }[];
  queries: number;
};

/**
 * One GitHub import attempt (run by the sync framework). Unchanged repos
 * (same pushedAt as their last snapshot) are not re-parsed or re-written
 * (1.5.2). A failure inside one repo is recorded and the rest continue; the
 * attempt is then `partial` (1.5.3). Every write is keyed (repo URL,
 * evidence import key), so a replay upserts instead of duplicating (1.9.1).
 */
export async function importGitHubRepositories(params: {
  personId: string;
  connectionId: string;
  login: string;
  token: string;
  metadata: Record<string, unknown>;
  profileUrl: string;
  ctx: SyncContext;
}): Promise<SyncWorkResult> {
  const { personId, ctx } = params;
  const syncRun = await createSyncRun(params.connectionId, personId, "github");
  try {
    const snapshots = await getSourceSnapshots(personId, "github", { limit: 500 });
    const previousPushedAt = new Map<string, string>();
    for (const snap of snapshots) {
      const data = snap.snapshotData as { fullName?: string; pushedAt?: string };
      if (data?.fullName && data.pushedAt && !previousPushedAt.has(data.fullName)) previousPushedAt.set(data.fullName, data.pushedAt);
    }
    const acq = await acquireGitHubViaGraphQL({ login: params.login, token: params.token, previousPushedAt, correlationId: ctx.correlationId });
    ctx.log.info("github.acquired", { metadata: { repos: acq.repos.length, deep: acq.deep.size, unchanged: acq.unchanged.length, queries: acq.queries, rateLimitRemaining: acq.rateLimitRemaining } });

    const unchanged = new Set(acq.unchanged.filter((name) => previousPushedAt.has(name)));
    const failedRepos: { repo: string; reason: string }[] = [];
    let recordsChanged = 0;
    for (const repo of acq.repos) {
      if (unchanged.has(repo.full_name)) continue;
      if (ctx.signal.aborted) throw new SyncError("GitHub import ran out of time.", "timeout");
      const deep = acq.deep.get(repo.full_name);
      if (deep?.failure) failedRepos.push({ repo: repo.full_name, reason: deep.failure });
      try {
        const project = mapRawRepoToProject(repo, deep, params.login);
        await saveSourceSnapshot(personId, "github", project.repositoryUrl, {
          fullName: repo.full_name, pushedAt: repo.pushed_at, title: project.title, description: project.description,
          technologies: project.technologies, stars: project.stars, forks: project.forks, isFork: project.isFork,
          isArchived: project.isArchived, isTemplate: project.isTemplate, isEmpty: project.isEmpty,
          projectClassification: project.projectClassification, license: project.license,
          detectedManifests: project.detectedManifests, checksum: project.checksum,
          correlationId: ctx.correlationId, syncedAt: new Date().toISOString(),
        }, project.checksum);
        await saveProject(personId, {
          title: project.title,
          summary: project.description || "GitHub repository candidate",
          description: project.description || "",
          technologies: project.technologies || [],
          sources: ["github"],
          repositoryUrl: project.repositoryUrl,
          demoUrl: project.homepageUrl || undefined,
          status: "candidate",
          aiDetails: { categories: project.aiMlCategories || [], observedFiles: project.observedFiles || [], primaryLanguage: project.primaryLanguage || null },
          // Ledger chips the student can choose to show (Task 2.5.4).
          metadata: {
            stars: project.stars,
            forks: project.forks,
            isFork: project.isFork,
            languages: project.languages,
            externalRepoId: project.externalRepoId,
            projectClassification: project.projectClassification,
            isArchived: project.isArchived,
            isTemplate: project.isTemplate,
            isEmpty: project.isEmpty,
            license: project.license || undefined,
            analysisStage: project.analysisStage,
          },
        });
        await writeEvidenceBatch(personId, project.technologyFindings.map((finding) => ({
          category: "skill" as const,
          subject: finding.name,
          value: finding.name,
          source: "imported" as const,
          verificationStatus: "unverified" as const,
          sourceReference: finding.sourceFile ? `${project.repositoryUrl}#${finding.sourceFile}` : project.repositoryUrl,
          interpretation: `Observed in ${project.title} (${finding.provenance.toLowerCase().replace(/_/g, " ")}${finding.sourceFile ? ` in ${finding.sourceFile}` : ""}). Evidence confidence: ${finding.confidence}. Personal proficiency requires review.`,
          whyItMatters: "Repository technology metadata can point to a skill for student review.",
          importKey: `github_skill_${project.id}_${finding.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        })));
        recordsChanged++;
      } catch (error) {
        failedRepos.push({ repo: repo.full_name, reason: `persist:${error instanceof Error ? error.message.slice(0, 120) : "error"}` });
        ctx.log.warn("github.repo.failed", { error: error instanceof Error ? error.message : String(error), metadata: { repo: repo.full_name } });
      }
    }

    await saveExternalConnection({
      personId, provider: "github", externalUsername: params.login, profileUrl: params.profileUrl, status: "connected",
      metadata: { ...params.metadata, lastSyncedAt: new Date().toISOString(), repositoryCount: acq.repos.length, recordsChanged },
    });
    const summary: GitHubImportSummary = {
      syncRunId: syncRun.id, recordsFetched: acq.repos.length, recordsChanged, unchanged: unchanged.size, failedRepos, queries: acq.queries,
    };
    await completeSyncRun(syncRun.id, {
      status: failedRepos.length ? "partial" : "completed",
      recordsFetched: acq.repos.length,
      recordsChanged,
      ...(failedRepos.length ? { errorCode: "PARTIAL", errorSummary: failedRepos.map((f) => `${f.repo}: ${f.reason}`).join("; ").slice(0, 500) } : {}),
    });
    return { outcome: failedRepos.length ? "partial" : "succeeded", result: summary };
  } catch (error) {
    await completeSyncRun(syncRun.id, {
      status: "failed", recordsFetched: 0, recordsChanged: 0,
      errorCode: error instanceof GitHubGraphQLError ? `GRAPHQL_${error.status ?? "ERROR"}` : "EXCEPTION",
      errorSummary: error instanceof Error ? error.message.slice(0, 500) : String(error),
    });
    throw toSyncError(error);
  }
}

/** Auth / not-found never fix themselves: dead-letter at once. Rate limits and outages retry. */
function toSyncError(error: unknown): unknown {
  if (error instanceof SyncError) return error;
  if (error instanceof GitHubGraphQLError) {
    if (error.status === 401) return new SyncError(error.message, "github_auth", false);
    if (error.status === 404) return new SyncError(error.message, "github_not_found", false);
    if (error.rateLimited) return new SyncError(error.message, "github_rate_limited", true);
    return new SyncError(error.message, `github_http_${error.status ?? "error"}`, true);
  }
  if (isServeFromCacheError(error)) return new SyncError((error as Error).message, "github_circuit_open", true);
  return error;
}


export function verifyGitHubWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const expectedSignature = parts[1];
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");

  const digestBuf = Buffer.from(digest);
  const expectedBuf = Buffer.from(expectedSignature);

  if (digestBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuf, expectedBuf);
}
