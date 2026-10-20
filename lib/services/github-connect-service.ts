/**
 * One GitHub connection for the student: account sign-in (OAuth, read:user)
 * plus any GitHub App installations (personal and organisation) that grant
 * repositories they chose on GitHub.
 *
 * Nothing here is a new integration. It lists what the existing access paths
 * can reach, merges them by GitHub's stable repository ID, keeps the student's
 * selection on the connection, and hands the import to a durable job
 * (github-import-job.ts) that runs the existing imports in small batches.
 * Private repositories are offered only when GitHub returned them for one of
 * the student's own, still-active installations.
 */
import { decryptConnectionTokenWithMeta } from "@/lib/security/connection-token";
import { createGitHubInstallationToken, isGitHubAppConfigured, isInstallationRevokedError, listGitHubInstallationRepositories, type InstallationRepository } from "@/lib/connectors/github/app-auth";
import { savedGitHubSelection } from "@/lib/connectors/github/selection";
import { activeInstallations, installationsOf, withInstallationRevoked } from "@/lib/connectors/github/installations";
import { getExternalConnectionByProvider, saveExternalConnection } from "@/lib/repositories/connection-repository";
import { getProjectsByPersonId } from "@/lib/repositories/project-repository";
import { createImportJob, isInFlight, latestImportJob, viewOf, type ImportJobView, type ImportPlanItem, type ImportRecord } from "./github-import-job";

export type GitHubConnectState =
  | "not_connected"
  | "awaiting_approval"
  | "selecting"
  | "importing"
  | "imported"
  | "partial"
  | "needs_attention"
  | "revoked";

export type GitHubRepoAccess = "public" | "app_installation";

export type GitHubRepoView = {
  id: number;
  fullName: string;
  name: string;
  url: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  pushedAt: string | null;
  owner: string;
  /** How we can read it: the public API, an App installation, or both. */
  access: GitHubRepoAccess[];
  /** Installations that grant it (empty for public-only access). */
  installationIds: string[];
  selected: boolean;
};

export type GitHubImportRecord = ImportRecord;

export type GitHubInstallationView = { id: string; accountLogin: string | null; accountType: "User" | "Organization" | null; repositorySelection: "all" | "selected" | null; revoked: boolean };

export type GitHubConnectOverview = {
  state: GitHubConnectState;
  configured: { signIn: boolean; app: boolean };
  account: { login: string | null; verified: boolean };
  installation: { installed: boolean; accountLogin: string | null; selection: "all" | "selected" | null; approvalPending: boolean; revoked: boolean };
  installations: GitHubInstallationView[];
  counts: { accessible: number; public: number; private: number; selected: number };
  lastImport: GitHubImportRecord | null;
  job: ImportJobView | null;
  repositories: GitHubRepoView[];
  /** Problems listing one access path; the others' repositories are still shown. */
  listErrors: Array<{ source: GitHubRepoAccess; reason: string; account?: string | null }>;
  /** Review candidates from the most recent import (projects the selected repositories produced). */
  candidates: { projects: Array<Record<string, unknown>>; skills: string[] } | null;
};

type Connection = NonNullable<Awaited<ReturnType<typeof getExternalConnectionByProvider>>>;

const meta = (c: Connection | null | undefined) => ((c?.metadata || {}) as Record<string, unknown>);

function oauthToken(connection: Connection, personId: string): string | null {
  const envelope = meta(connection).encryptedAccessToken;
  if (connection.status !== "connected" || typeof envelope !== "string") return null;
  try {
    return decryptConnectionTokenWithMeta(envelope, personId).token;
  } catch {
    return null;
  }
}

/** Public repositories owned by the login (never private: this endpoint cannot return them). */
async function listPublicRepositories(login: string, token: string | null): Promise<InstallationRepository[]> {
  const out: InstallationRepository[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed&per_page=100&page=${page}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "AI-Tathastu-App",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 403 || res.status === 429) throw new Error("rate_limited");
    if (res.status === 401) throw new Error("authorization_expired");
    if (res.status === 404) throw new Error("account_not_found");
    if (!res.ok) throw new Error(`github_${res.status}`);
    const batch = (await res.json()) as InstallationRepository[];
    out.push(...batch.filter((r) => !r.private));
    if (batch.length < 100) break;
  }
  return out;
}

export type InstallationRepos = { installationId: string; repos: InstallationRepository[] };

/** Merges every access path by GitHub's stable repository ID. */
export function mergeRepositories(publicRepos: InstallationRepository[], appGroups: InstallationRepos[], selection: Set<number> | null): GitHubRepoView[] {
  const byId = new Map<number, GitHubRepoView>();
  const add = (r: InstallationRepository, access: GitHubRepoAccess, installationId?: string) => {
    const existing = byId.get(r.id);
    if (existing) {
      if (!existing.access.includes(access)) existing.access.push(access);
      if (installationId && !existing.installationIds.includes(installationId)) existing.installationIds.push(installationId);
      return;
    }
    byId.set(r.id, {
      id: r.id, fullName: r.full_name, name: r.name, url: r.html_url, description: r.description,
      private: Boolean(r.private), fork: Boolean(r.fork), archived: Boolean(r.archived), language: r.language,
      pushedAt: r.pushed_at, owner: r.owner?.login ?? r.full_name.split("/")[0],
      access: [access], installationIds: installationId ? [installationId] : [],
      // Default: the student's own non-fork work. Repositories granted through the App were chosen on GitHub already.
      selected: selection ? selection.has(r.id) : access === "app_installation" || !r.fork,
    });
  };
  for (const r of publicRepos) add(r, "public");
  for (const g of appGroups) for (const r of g.repos) add(r, "app_installation", g.installationId);
  return [...byId.values()].sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""));
}

export function deriveGitHubState(params: {
  connection: Connection | null | undefined;
  verified: boolean;
  jobInFlight: boolean;
  accountRevoked?: boolean;
}): GitHubConnectState {
  const { connection, verified } = params;
  const m = meta(connection);
  if (!connection || connection.status === "disconnected") return "not_connected";
  const all = installationsOf(m);
  const active = all.filter((i) => !i.revokedAt);
  // Revoked: every route GitHub gave us is gone (sign-in token rejected, and no installation left).
  if (connection.status === "revoked" || ((params.accountRevoked || !verified) && all.length > 0 && active.length === 0)) return "revoked";
  if (params.accountRevoked && !active.length) return "revoked";
  if (!verified && !active.length) return m.githubAppApprovalPendingAt ? "awaiting_approval" : "not_connected";
  if (params.jobInFlight) return "importing";
  const last = m.githubUnifiedLastImport as ImportRecord | undefined;
  if (m.githubAppApprovalPendingAt && !active.some((i) => i.accountType === "Organization") && !last) return "awaiting_approval";
  if (!last || last.status === "running") return "selecting";
  if (last.status === "completed") return "imported";
  if (last.status === "partial") return "partial";
  if (last.status === "cancelled") return last.imported > 0 ? "partial" : "selecting";
  return "needs_attention";
}

async function collect(personId: string, connection: Connection | null) {
  const listErrors: GitHubConnectOverview["listErrors"] = [];
  let publicRepos: InstallationRepository[] = [];
  const appGroups: InstallationRepos[] = [];
  const token = connection ? oauthToken(connection, personId) : null;
  let accountRevoked = false;

  if (connection && connection.status !== "disconnected" && token) {
    try {
      publicRepos = await listPublicRepositories(connection.externalUsername, token);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "list_failed";
      accountRevoked = reason === "authorization_expired";
      listErrors.push({ source: "public", reason });
    }
  }
  let m = meta(connection);
  let revokedChanged = false;
  if (isGitHubAppConfigured()) {
    for (const inst of activeInstallations(m)) {
      try {
        appGroups.push({ installationId: inst.id, repos: await listGitHubInstallationRepositories(await createGitHubInstallationToken(inst.id)) });
      } catch (error) {
        const revoked = isInstallationRevokedError(error);
        if (revoked) { m = { ...m, ...withInstallationRevoked(m, inst.id) }; revokedChanged = true; }
        listErrors.push({ source: "app_installation", account: inst.accountLogin, reason: revoked ? "revoked" : /rate limit/i.test(String(error)) ? "rate_limited" : "list_failed" });
      }
    }
  }
  if (revokedChanged && connection) {
    await saveExternalConnection({ personId, provider: "github", externalUsername: connection.externalUsername, profileUrl: connection.profileUrl, metadata: m });
  }
  return { publicRepos, appGroups, token, accountRevoked, listErrors, metadata: m };
}

async function candidatesFor(personId: string, urls: Set<string>) {
  if (!urls.size) return null;
  const rows = await getProjectsByPersonId(personId, { limit: 500 }).catch(() => []);
  const projects = rows
    .filter((p) => p.repositoryUrl && urls.has(p.repositoryUrl.toLowerCase()))
    .map((p) => ({
      id: p.id, title: p.title, description: p.description || p.summary || "", technologies: p.technologies, url: p.repositoryUrl, source: "github",
      isFork: Boolean((p.metadata as Record<string, unknown> | null)?.isFork) || undefined,
    }));
  const skills = [...new Set(projects.flatMap((p) => (Array.isArray(p.technologies) ? (p.technologies as string[]) : [])))];
  return { projects, skills };
}

export async function getGitHubConnectOverview(personId: string): Promise<GitHubConnectOverview> {
  const connection = await getExternalConnectionByProvider(personId, "github");
  const { publicRepos, appGroups, token, accountRevoked, listErrors, metadata: m } = await collect(personId, connection);
  const selection = savedGitHubSelection(m);
  const repositories = mergeRepositories(publicRepos, appGroups, selection);
  const job = connection ? await latestImportJob(personId) : null;
  const jobInFlight = isInFlight(job);
  const all = installationsOf(m);
  const active = all.filter((i) => !i.revokedAt);
  const primary = active.find((i) => i.accountType === "User") ?? active[0] ?? null;
  const lastImport = (m.githubUnifiedLastImport as ImportRecord | undefined) ?? null;
  const importedUrls = lastImport && !jobInFlight
    ? new Set(((job && job.id === lastImport.jobId ? (job.metadata as { plan?: ImportPlanItem[]; done?: number[] }) : null)?.plan ?? [])
        .filter((p) => (job!.metadata as { done?: number[] }).done?.includes(p.id)).map((p) => p.url.toLowerCase()))
    : new Set<string>();

  return {
    state: deriveGitHubState({ connection: connection ? ({ ...connection, metadata: m } as Connection) : connection, verified: Boolean(token) && !accountRevoked, jobInFlight, accountRevoked }),
    configured: { signIn: Boolean(process.env.GITHUB_CLIENT_ID?.trim()), app: isGitHubAppConfigured() },
    account: { login: connection && connection.status !== "disconnected" ? connection.externalUsername : null, verified: Boolean(token) && !accountRevoked },
    installation: {
      installed: active.length > 0,
      accountLogin: primary?.accountLogin ?? null,
      selection: primary?.repositorySelection ?? null,
      approvalPending: Boolean(m.githubAppApprovalPendingAt) && !active.some((i) => i.accountType === "Organization"),
      revoked: all.length > 0 && active.length === 0,
    },
    installations: all.map((i) => ({ id: i.id, accountLogin: i.accountLogin, accountType: i.accountType, repositorySelection: i.repositorySelection, revoked: Boolean(i.revokedAt) })),
    counts: {
      accessible: repositories.length,
      public: repositories.filter((r) => !r.private).length,
      private: repositories.filter((r) => r.private).length,
      selected: repositories.filter((r) => r.selected).length,
    },
    lastImport,
    job: job && (jobInFlight || job.id === lastImport?.jobId) ? viewOf(job) : null,
    repositories,
    listErrors,
    candidates: await candidatesFor(personId, importedUrls),
  };
}

/**
 * Which requested repositories may be imported, and by which path. Anything GitHub
 * didn't list for this student is dropped, so a client can never widen access.
 * Public repositories use the signed-in account; private ones (and public ones
 * without a signed-in account) only an installation that granted them.
 */
export function planGitHubImport(accessible: GitHubRepoView[], requestedIds: number[], hasAccountToken: boolean): { chosen: number[]; plan: ImportPlanItem[] } {
  const allowed = new Map(accessible.map((r) => [r.id, r]));
  const chosen = [...new Set(requestedIds.map(Number))].filter((id) => allowed.has(id));
  const plan: ImportPlanItem[] = [];
  for (const id of chosen) {
    const r = allowed.get(id)!;
    const base = { id, fullName: r.fullName, url: r.url, private: r.private };
    if (hasAccountToken && !r.private && r.access.includes("public")) plan.push({ ...base, via: "account" });
    else if (r.installationIds.length) plan.push({ ...base, via: "app", installationId: r.installationIds[0] });
  }
  return { chosen: plan.map((p) => p.id), plan };
}

export type GitHubImportStart = { jobId: string; job: ImportJobView; existing: boolean; unconfirmed: number[] };

/**
 * Validates the selection against GitHub's current answer and queues a durable
 * import job. Repositories a failed listing couldn't confirm are never imported;
 * they are recorded as failed so the student knows to retry.
 */
export async function startGitHubImport(personId: string, requestedIds: number[]): Promise<GitHubImportStart | { error: string; status: number }> {
  const connection = await getExternalConnectionByProvider(personId, "github");
  if (!connection || connection.status === "disconnected") return { error: "Connect GitHub first.", status: 409 };
  const running = await latestImportJob(personId);
  if (running && isInFlight(running)) return { jobId: running.id, job: viewOf(running), existing: true, unconfirmed: [] };

  const { publicRepos, appGroups, token, accountRevoked, listErrors, metadata: m } = await collect(personId, connection);
  if ((!token || accountRevoked) && !appGroups.length) {
    return { error: listErrors.some((e) => e.reason === "revoked" || e.reason === "authorization_expired") ? "GitHub access was revoked. Connect GitHub again." : "Connect GitHub first.", status: 409 };
  }
  const accessible = mergeRepositories(publicRepos, appGroups, null);
  const { plan } = planGitHubImport(accessible, requestedIds, Boolean(token) && !accountRevoked);
  const saved = savedGitHubSelection(m);
  const unconfirmed = listErrors.length
    ? [...new Set(requestedIds.map(Number))].filter((id) => Number.isInteger(id) && id > 0 && !accessible.some((r) => r.id === id) && (saved?.has(id) ?? true))
    : [];
  if (!plan.length && !unconfirmed.length) return { error: "Choose at least one repository you can access.", status: 400 };

  const { job, existing } = await createImportJob(personId, plan, accessible.length);
  if (!existing && unconfirmed.length) {
    const reason = listErrors.find((e) => e.source === "app_installation")?.reason ?? listErrors[0]?.reason ?? "list_failed";
    const { getDb, sourceProcessingJobs } = await import("@/lib/db");
    const { eq, sql } = await import("drizzle-orm");
    const db = await getDb();
    const failed = unconfirmed.map((id) => ({ id, repo: `repository #${id}`, reason }));
    const extra = unconfirmed.map((id) => ({ id, fullName: `repository #${id}`, url: "", private: true, via: "app" as const }));
    await db.update(sourceProcessingJobs)
      .set({ metadata: sql`${sourceProcessingJobs.metadata} || ${JSON.stringify({ plan: [...plan, ...extra], failed })}::jsonb` })
      .where(eq(sourceProcessingJobs.id, job.id));
  }
  if (!existing) {
    const running: ImportRecord = { status: "running", at: new Date().toISOString(), accessible: accessible.length, selected: plan.length + unconfirmed.length, imported: 0, failed: [], jobId: job.id };
    await saveExternalConnection({
      personId, provider: "github", externalUsername: connection.externalUsername, profileUrl: connection.profileUrl,
      metadata: { ...m, githubSelectedRepoIds: [...plan.map((p) => p.id), ...unconfirmed], githubUnifiedLastImport: running },
    });
  }
  const { SourceProcessingJobService } = await import("./source-processing-job-service");
  const fresh = (await SourceProcessingJobService.getJobForPerson(job.id, personId)) ?? job;
  return { jobId: job.id, job: viewOf(fresh), existing, unconfirmed };
}
