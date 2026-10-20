"use client";

/**
 * The one GitHub source: a single "Connect GitHub & Import Repositories"
 * button, then the repositories GitHub actually lets this student share,
 * public and private, to choose from and import. Every status shown comes from
 * the server: the overview (GET /api/student/connections/github/repositories)
 * and, while an import runs, its durable job (GET .../import-jobs/:id).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowClockwise, ArrowSquareOut, GithubLogo, LockKey, Spinner } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { normalizeImportCandidates } from "@/lib/onboarding-import-candidates";
import type { DiscoveredCandidates } from "@/lib/client/onboarding/use-footprint-connectors";
import type { GitHubConnectOverview, GitHubConnectState, GitHubImportStart, GitHubInstallationView, GitHubRepoView } from "@/lib/services/github-connect-service";
import type { ImportJobView } from "@/lib/services/github-import-job";
import { Button, buttonClass } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { TextField } from "@/components/ui/Field";
import { StatusChip, Tag, type Tone } from "@/components/ui/StatusChip";
import { leaveAfter } from "./leave-after";

const STATE_VIEW: Record<GitHubConnectState | "connecting", { label: string; tone: Tone }> = {
  not_connected: { label: "Not connected", tone: "neutral" },
  connecting: { label: "Connecting…", tone: "busy" },
  awaiting_approval: { label: "Approval pending", tone: "warning" },
  selecting: { label: "Choose repositories", tone: "signal" },
  importing: { label: "Importing", tone: "busy" },
  imported: { label: "Imported", tone: "verified" },
  partial: { label: "Partly imported", tone: "warning" },
  needs_attention: { label: "Needs attention", tone: "danger" },
  revoked: { label: "Access revoked", tone: "danger" },
};

const LIST_ERRORS: Record<string, string> = {
  rate_limited: "GitHub's rate limit was reached, so some repositories may be missing. Try again in a few minutes.",
  authorization_expired: "Your GitHub sign-in expired. Connect GitHub again to see your repositories.",
  account_not_found: "GitHub couldn't find this account.",
  revoked: "The GitHub App was removed or suspended on GitHub, so private repositories can't be read.",
  list_failed: "GitHub didn't return the repository list. Try again.",
};

export function GitHubConnectCard({ returnTo, beforeLeave, cvLogin, authorizationFailed, onCandidates, onProfileLinked, onPublicOnly }: {
  returnTo: "/onboarding" | "/student/connections";
  beforeLeave?: () => Promise<unknown>;
  /** GitHub username found in the CV, to compare with the signed-in account. */
  cvLogin?: string | null;
  /** GitHub refused or the student cancelled authorization: offer the public-only fallback. */
  authorizationFailed?: boolean;
  onCandidates?: (c: DiscoveredCandidates, provider: string) => void;
  onProfileLinked?: (profileUrl: string) => void;
  /** Public-only import by username, through the existing footprint import. */
  onPublicOnly?: (username: string) => Promise<boolean>;
}) {
  const [overview, setOverview] = useState<GitHubConnectOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState<ImportJobView | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const appliedJobRef = useRef<string | null>(null);
  // Parents re-create this callback on every render; reading it through a ref keeps `load` stable,
  // so a parent re-render never re-lists GitHub or resets the student's checkboxes.
  const onCandidatesRef = useRef(onCandidates);
  onCandidatesRef.current = onCandidates;
  const [leaving, setLeaving] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(Boolean(authorizationFailed));
  const [fallbackName, setFallbackName] = useState(cvLogin ?? "");
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [fallbackDone, setFallbackDone] = useState(false);

  const load = useCallback(async () => {
    const res = await requestJson<GitHubConnectOverview>("/api/student/connections/github/repositories", { cache: "no-store" });
    if (!res.ok) { setLoadError(describeError(res.error)); return null; }
    setLoadError(null);
    setOverview(res.data);
    setSelected(new Set(res.data.repositories.filter((r) => r.selected).map((r) => r.id)));
    setJob(res.data.job);
    // Review suggestions from a finished import reach the draft once per job.
    const finished = res.data.job && !JOB_ACTIVE.has(res.data.job.status) ? res.data.job.id : null;
    if (finished && appliedJobRef.current !== finished && res.data.candidates?.projects.length) {
      appliedJobRef.current = finished;
      onCandidatesRef.current?.(normalizeImportCandidates(res.data.candidates), "github");
    }
    return res.data;
  }, []);

  useEffect(() => { void load(); }, [load]);

  // While an import runs, poll its job (database only; it also resumes a stalled job). Reload the overview when it ends.
  const jobActive = Boolean(job && JOB_ACTIVE.has(job.status));
  useEffect(() => {
    if (!job || !jobActive) return;
    const t = setTimeout(async () => {
      const res = await requestJson<ImportJobView>(`/api/student/connections/github/import-jobs/${encodeURIComponent(job.id)}`, { cache: "no-store" });
      if (!res.ok) return setImportError(describeError(res.error));
      if (JOB_ACTIVE.has(res.data.status)) setJob(res.data);
      else await load();
    }, 3000);
    return () => clearTimeout(t);
  }, [job, jobActive, load]);

  const login = overview?.account.login ?? null;
  useEffect(() => {
    if (login && overview?.account.verified) onProfileLinked?.(`https://github.com/${login}`);
  }, [login, overview?.account.verified, onProfileLinked]);

  const repos = useMemo(() => overview?.repositories ?? [], [overview]);
  const chosen = useMemo(() => repos.filter((r) => selected.has(r.id)), [repos, selected]);
  const state: GitHubConnectState | "connecting" = leaving ? "connecting" : jobActive || starting ? "importing" : overview?.state ?? "not_connected";
  const view = STATE_VIEW[state];

  const connectHref = `/api/auth/github/connect?returnTo=${encodeURIComponent(returnTo)}`;
  const appHref = `/api/auth/github/app-start?returnTo=${encodeURIComponent(returnTo)}`;
  const leave = (e: React.MouseEvent<HTMLAnchorElement>) => { setLeaving(true); leaveAfter(beforeLeave)(e); };
  const canSignIn = overview ? overview.configured.signIn || overview.configured.app : true;

  const runImport = async (ids: number[]) => {
    setStarting(true);
    setImportError(null);
    const res = await requestJson<GitHubImportStart>("/api/student/connections/github/repositories", { method: "POST", json: { repositoryIds: ids } });
    setStarting(false);
    if (!res.ok) { setImportError(describeError(res.error)); return; }
    setJob(res.data.job);
  };

  const cancelImport = async () => {
    if (!job) return;
    const res = await requestJson<ImportJobView>(`/api/student/connections/github/import-jobs/${encodeURIComponent(job.id)}`, { method: "DELETE" });
    if (!res.ok) { setImportError(describeError(res.error)); return; }
    if (JOB_ACTIVE.has(res.data.status)) setJob(res.data); else await load();
  };

  const retryFailed = () => {
    const failedList = overview?.lastImport?.failed ?? [];
    const names = new Set(failedList.map((f) => f.repo));
    // Repositories GitHub couldn't confirm at the time are reported as "repository #<id>".
    const unlisted = failedList.map((f) => Number(f.repo.match(/^repository #(\d+)$/)?.[1])).filter((n) => Number.isInteger(n) && n > 0);
    const ids = [...new Set([...repos.filter((r) => names.has(r.fullName)).map((r) => r.id), ...unlisted])];
    if (ids.length) void runImport(ids);
  };

  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setAll = (on: boolean) => setSelected(on ? new Set(repos.map((r) => r.id)) : new Set());

  const mismatch = cvLogin && login && overview?.account.verified && cvLogin.toLowerCase() !== login.toLowerCase();
  const record = jobActive ? null : overview?.lastImport ?? null;
  const importing = jobActive || starting;
  const showList = overview && (overview.account.verified || overview.installation.installed) && state !== "revoked";

  return (
    <section data-testid="card-github" aria-labelledby="github-card-title" className="rounded-card border border-border-medium bg-bg-elevated p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <GithubLogo size={22} aria-hidden="true" className="text-text-primary" />
        <h4 id="github-card-title" className="font-display text-base font-semibold text-text-primary">GitHub</h4>
        <span role="status"><StatusChip tone={view.tone}>{view.label}</StatusChip></span>
      </div>

      {loadError && <Banner kind="danger" className="mt-3" action={<Button size="sm" variant="secondary" onClick={() => void load()}>Try again</Button>}>{loadError}</Banner>}

      {(!overview || overview.state === "not_connected" || overview.state === "revoked") && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="max-w-[62ch] text-sm text-text-muted">
            {overview?.state === "revoked"
              ? "GitHub access was removed or suspended on GitHub. Everything already imported stays on your profile. Connect again to choose repositories."
              : "Connect your GitHub account to discover your public repositories and securely select private repositories to include in your skill profile."}
          </p>
          {cvLogin && overview?.state !== "revoked" && <p className="text-sm text-text-muted">Your CV links <span className="font-mono text-text-primary">github.com/{cvLogin}</span>. Sign in with that account.</p>}
          {canSignIn ? (
            <a className={buttonClass("primary", "md", "self-start")} href={connectHref} onClick={leave} aria-busy={leaving || undefined}>
              <GithubLogo size={18} aria-hidden="true" /> {overview?.state === "revoked" ? "Connect GitHub again" : "Connect GitHub & Import Repositories"}
            </a>
          ) : (
            <Banner kind="warning" title="GitHub sign-in isn't available on this server">You can still import public repositories by username below.</Banner>
          )}
          <details className="text-sm text-text-muted">
            <summary className="cursor-pointer font-medium text-text-primary">What GitHub will ask you</summary>
            <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
              <li>Sign in to GitHub and allow AI Tathastu to read your public profile. This confirms the account is yours. We never see your password.</li>
              <li>Choose which repositories, including private ones, the AI Tathastu GitHub App may read. Access is read-only (repository metadata and contents), and you can change or remove it in GitHub settings at any time.</li>
              <li>Come back here and pick the repositories to include. Nothing is imported until you do.</li>
            </ol>
          </details>
        </div>
      )}

      {overview?.state === "awaiting_approval" && (
        <Banner kind="warning" className="mt-3" title="Approval pending"
          action={<Button size="sm" variant="secondary" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={() => void load()}>Check again</Button>}>
          GitHub sent your request to the organization&apos;s owner. Private repositories appear here once they approve. Your public repositories can be imported now.
        </Banner>
      )}

      {overview && showList && (
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm">
            {login && (
              <p className="text-text-muted">
                {overview.account.verified ? "Signed in as " : "Linked account "}<span className="font-mono text-text-primary">@{login}</span>
              </p>
            )}
            {mismatch && <p className="text-warning">Your CV links github.com/{cvLogin}, but you signed in as @{login}. Only repositories this account can access are listed.</p>}
            <PrivateAccessLine overview={overview} appHref={appHref} onLeave={leave} />
          </div>

          {overview.listErrors.map((e) => (
            <Banner key={e.source} kind={e.reason === "revoked" ? "danger" : "warning"}>{LIST_ERRORS[e.reason] ?? LIST_ERRORS.list_failed}</Banner>
          ))}

          {repos.length === 0 ? (
            <p className="text-sm text-text-muted">GitHub returned no repositories for this account{overview.installation.installed ? " or installation" : ""}.</p>
          ) : (
            <fieldset className="flex flex-col gap-2" disabled={importing}>
              <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-text-muted">
                  <span className="font-mono text-text-primary tabular">{overview.counts.accessible}</span> accessible
                  {" · "}<span className="font-mono tabular">{overview.counts.public}</span> public
                  {" · "}<span className="font-mono tabular">{overview.counts.private}</span> private
                  {" · "}<span className="font-mono text-text-primary tabular">{chosen.length}</span> selected
                </span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setAll(true)}>Select all</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAll(false)}>Clear</Button>
                </span>
              </legend>
              <ul className="max-h-80 divide-y divide-border-medium overflow-y-auto rounded-md border border-border-medium">
                {repos.map((r) => <RepoRow key={r.id} repo={r} checked={selected.has(r.id)} onToggle={() => toggle(r.id)} />)}
              </ul>
            </fieldset>
          )}

          {importError && <Banner kind="danger" title="The import didn't start">{importError}</Banner>}

          {importing && <ImportProgress job={job} onCancel={job && job.status !== "cancelling" ? () => void cancelImport() : undefined} />}

          {record && !importing && record.status !== "running" && (
            <ImportSummary record={record} onRetry={record.failed.length ? retryFailed : undefined} />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={!chosen.length || importing} loading={importing} loadingLabel="Importing…" onClick={() => void runImport(chosen.map((r) => r.id))}>
              {record && record.status !== "running" ? `Import ${chosen.length} selected again` : `Import ${chosen.length} selected ${chosen.length === 1 ? "repository" : "repositories"}`}
            </Button>
            <span className="text-xs text-text-muted">Imported repositories become suggestions you review. Re-importing never duplicates them.</span>
          </div>
        </div>
      )}

      {(fallbackOpen || (overview && !canSignIn)) && onPublicOnly && !overview?.account.verified && (
        <div className="mt-4 rounded-md border border-border-medium bg-bg-surface/50 p-3.5">
          <p className="text-sm font-medium text-text-primary">Public repositories only</p>
          <p className="mt-1 text-sm text-text-muted">
            If GitHub won&apos;t let your account authorize apps, you can import public repositories by username. Private repositories are not connected this way, and the account isn&apos;t verified as yours.
          </p>
          {fallbackDone ? (
            <p role="status" className="mt-2 text-sm text-text-muted">Public repositories requested. Anything found waits for your review.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <TextField label="GitHub username" value={fallbackName} onChange={(e) => setFallbackName(e.target.value)} placeholder="e.g. octocat" />
              <Button variant="secondary" disabled={!fallbackName.trim()} loading={fallbackBusy} loadingLabel="Reading…"
                onClick={async () => { setFallbackBusy(true); const ok = await onPublicOnly(fallbackName.trim()); setFallbackBusy(false); if (ok) { setFallbackDone(true); void load(); } }}>
                Import public repositories only
              </Button>
            </div>
          )}
        </div>
      )}
      {!fallbackOpen && onPublicOnly && overview && !overview.account.verified && overview.state !== "revoked" && (
        <button type="button" className="mt-3 text-sm text-text-muted underline underline-offset-2 hover:text-text-primary" onClick={() => setFallbackOpen(true)}>
          Can&apos;t authorize GitHub? Import public repositories only
        </button>
      )}
    </section>
  );
}

const JOB_ACTIVE = new Set<ImportJobView["status"]>(["queued", "running", "waiting", "cancelling"]);

function ImportProgress({ job, onCancel }: { job: ImportJobView | null; onCancel?: () => void }) {
  const total = job?.total ?? 0;
  const settled = (job?.done ?? 0) + (job?.failed.length ?? 0);
  return (
    <div role="status" className="flex flex-col gap-2 rounded-md border border-border-medium bg-bg-surface/50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-text-primary">
          <Spinner size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          {!job || job.status === "queued" ? "Import queued…" : job.status === "cancelling" ? "Stopping after the current repositories…" : `Imported ${job.done} of ${total}${job.failed.length ? ` · ${job.failed.length} failed` : ""}`}
        </span>
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Stop import</Button>}
      </div>
      {total > 0 && (
        <div role="progressbar" aria-label="Import progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={settled} className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
          <div className="h-full rounded-full bg-accent-warm transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.round((settled / total) * 100)}%` }} />
        </div>
      )}
      {job?.status === "waiting" && job.waitingUntil && (
        <p className="text-text-muted">GitHub asked us to slow down. The import continues automatically after {new Date(job.waitingUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</p>
      )}
      <p className="text-xs text-text-muted">You can leave this page; the import keeps its progress and picks up where it stopped.</p>
    </div>
  );
}

const ownerLabel = (i: GitHubInstallationView) => `${i.accountLogin ?? "GitHub account"} (${i.accountType === "Organization" ? "organisation" : "personal"})`;

function PrivateAccessLine({ overview, appHref, onLeave }: { overview: GitHubConnectOverview; appHref: string; onLeave: (e: React.MouseEvent<HTMLAnchorElement>) => void }) {
  const { installation, configured, counts } = overview;
  const active = overview.installations.filter((i) => !i.revoked);
  const removed = overview.installations.filter((i) => i.revoked);
  if (active.length) {
    return (
      <div className="flex flex-col gap-1 text-text-muted">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <LockKey size={15} aria-hidden="true" />
          Private access granted on GitHub for {active.map((i, n) => <React.Fragment key={i.id}>{n > 0 && " · "}<span className="text-text-primary">{ownerLabel(i)}</span></React.Fragment>)}: {counts.private} private {counts.private === 1 ? "repository" : "repositories"}.
        </p>
        {removed.length > 0 && <p className="text-warning">Access through {removed.map(ownerLabel).join(", ")} was removed on GitHub.</p>}
        <a className="inline-flex w-fit items-center gap-1 text-text-warm underline underline-offset-2" href={appHref} onClick={onLeave}>
          Add another account or organisation, or change repositories, on GitHub <ArrowSquareOut size={13} aria-hidden="true" />
        </a>
      </div>
    );
  }
  if (removed.length) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-warning">
        Private access through {removed.map(ownerLabel).join(", ")} was removed on GitHub.
        <a className="inline-flex items-center gap-1 text-text-warm underline underline-offset-2" href={appHref} onClick={onLeave}>
          Share private repositories again <ArrowSquareOut size={13} aria-hidden="true" />
        </a>
      </p>
    );
  }
  if (installation.approvalPending) return null;
  if (!configured.app) return <p className="text-text-muted">Private repositories aren&apos;t available on this server; public repositories still work.</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-text-muted">
      <LockKey size={15} aria-hidden="true" />
      No private repositories shared yet.
      <a className="inline-flex items-center gap-1 text-text-warm underline underline-offset-2" href={appHref} onClick={onLeave}>
        Choose private repositories on GitHub <ArrowSquareOut size={13} aria-hidden="true" />
      </a>
    </p>
  );
}

function RepoRow({ repo, checked, onToggle }: { repo: GitHubRepoView; checked: boolean; onToggle: () => void }) {
  const id = `repo-${repo.id}`;
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <input id={id} type="checkbox" checked={checked} onChange={onToggle} className="mt-1 size-4 shrink-0 accent-[var(--accent-warm)]" />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-all font-medium text-text-primary">{repo.fullName}</span>
          <Tag>{repo.private ? "Private" : "Public"}</Tag>
          {repo.fork && <Tag>Fork</Tag>}
          {repo.archived && <Tag>Archived</Tag>}
        </span>
        {repo.description && <span className="mt-0.5 block text-sm text-text-muted">{repo.description}</span>}
        <span className="mt-0.5 block text-xs text-text-muted">
          {[repo.language, repo.pushedAt ? `updated ${new Date(repo.pushedAt).toLocaleDateString()}` : null].filter(Boolean).join(" · ")}
        </span>
      </label>
    </li>
  );
}

function ImportSummary({ record, onRetry }: { record: { status: string; accessible: number; selected: number; imported: number; failed: Array<{ repo: string; reason: string }> }; onRetry?: () => void }) {
  const kind = record.status === "completed" ? "success" : record.status === "partial" || record.status === "cancelled" ? "warning" : "danger";
  return (
    <Banner kind={kind} title={record.status === "completed" ? "Import finished" : record.status === "partial" ? "Partly imported" : record.status === "cancelled" ? "Import stopped" : "Nothing was imported"}
      action={onRetry ? <Button size="sm" variant="secondary" onClick={onRetry}>Retry failed</Button> : undefined}>
      <span className="font-mono tabular">{record.imported}</span> of <span className="font-mono tabular">{record.selected}</span> selected imported
      {" · "}<span className="font-mono tabular">{record.failed.length}</span> failed · {record.accessible} accessible.
      {record.failed.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs">
          {record.failed.slice(0, 8).map((f) => <li key={f.repo}><span className="font-mono">{f.repo}</span>: {f.reason.replace(/_/g, " ")}</li>)}
          {record.failed.length > 8 && <li>and {record.failed.length - 8} more</li>}
        </ul>
      )}
    </Banner>
  );
}
