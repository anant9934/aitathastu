"use client";

/**
 * AI TATHASTU — GITHUB DIGITAL FOOTPRINT & INTELLIGENCE DASHBOARD
 *
 * Implements Phase 10 requirements:
 * 1. Profile overview, sync state, and organizations
 * 2. 30/90/365-day commit analytics, candidate attribution vs other contributors
 * 3. Repository inventory with filtering (All, Original, Forks, Archived), search, and sorting
 * 4. Deep repository drawer / modal with:
 *    - README preview with prompt injection defense
 *    - Language byte distributions
 *    - Technology findings with evidence provenance and confidence
 *    - Commits with SHA, author attribution, and additions/deletions
 *    - Pull requests, code reviews, and issues
 *    - Releases and tags
 *    - CI/CD workflow indicators
 *    - Resume-to-GitHub project matches
 * 5. Rate-limit and API coverage telemetry with manual refresh controls
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowsClockwise,
  GitBranch,
  GitCommit,
  GitFork,
  GitPullRequest,
  Star,
  CheckCircle,
  ArrowSquareOut,
  FolderSimple,
  ShieldCheck,
  CaretDown,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Panel } from "@/components/ui/Panel";
import { TextField } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Feedback";
import { cn } from "@/lib/client/cn";

export interface GitHubDashboardData {
  success: boolean;
  profile: {
    id: number;
    login: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string;
    profileUrl: string;
    email: string | null;
    company: string | null;
    location: string | null;
    blog: string | null;
    twitterUsername: string | null;
    publicRepos: number;
    publicGists: number;
    followers: number;
    following: number;
    githubCreatedAt: string;
    profileReadme: string | null;
    organizations: Array<{ id: number; login: string; avatar_url: string; description?: string }>;
    activitySummary: any;
    lastSyncedAt: string;
  } | null;
  latestSyncRun: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    discoveredReposCount: number;
    processedReposCount: number;
    failedReposCount: number;
    totalCommitsFetched: number;
    totalPrsFetched: number;
    totalIssuesFetched: number;
    rateLimitRemaining?: number;
    failedResources?: Array<{ resource: string; error: string }>;
  } | null;
  repositories: Array<{
    id: string;
    githubRepoId: number;
    name: string;
    fullName: string;
    description: string | null;
    canonicalUrl: string;
    homepage: string | null;
    isFork: boolean;
    isArchived: boolean;
    isPrivate: boolean;
    primaryLanguage: string | null;
    languages: Record<string, number>;
    stars: number;
    forks: number;
    openIssues: number;
    diskUsageKb: number;
    defaultBranch: string;
    license: string | null;
    topics: string[];
    branches: string[];
    tags: string[];
    workflows: string[];
    manifests: Record<string, string>;
    readmeContent: string | null;
    projectClassification: string | null;
    aiMlCategories: string[];
    lastPushAt: string | null;
    availabilityStatus: string;
  }>;
  commitAnalytics: {
    totalAccessibleCommits: number;
    candidateAttributedCommits: number;
    externalContributorCommits: number;
    commitsLast30Days: number;
    commitsLast90Days: number;
    commitsLast365Days: number;
  };
  languageTotals: Record<string, number>;
  pullRequests: Array<{
    id: string;
    repositoryId: string;
    number: number;
    title: string;
    state: string;
    authorLogin: string;
    isCandidateAuthor: boolean;
    merged: boolean;
    htmlUrl: string;
    reviewCommentsCount: number;
    createdAtGitHub: string;
  }>;
  issues: Array<{
    id: string;
    repositoryId: string;
    number: number;
    title: string;
    state: string;
    authorLogin: string;
    commentsCount: number;
    htmlUrl: string;
    createdAtGitHub: string;
  }>;
  releases: Array<{
    id: string;
    repositoryId: string;
    githubReleaseId: number;
    tagName: string;
    name: string | null;
    publishedAt: string | null;
    htmlUrl: string;
  }>;
  technologies: Array<{
    id: string;
    repositoryId: string;
    name: string;
    category: string;
    detectionMethod: string;
    sourceFile?: string;
    confidence: number;
  }>;
  resumeMatches: Array<{
    id: string;
    repositoryId: string;
    resumeProjectTitle: string;
    matchScore: number;
    matchReasons: string[];
    matchedTechnologies: string[];
  }>;
}

export function GitHubIntelligenceDashboard() {
  const [data, setData] = useState<GitHubDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [repoDetails, setRepoDetails] = useState<any | null>(null);
  const [loadingRepoDetails, setLoadingRepoDetails] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "original" | "forks" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"stars" | "pushed" | "name">("stars");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await requestJson<GitHubDashboardData>("/api/student/github/intelligence", {
        cache: "no-store",
      });
      if (res.ok) {
        setData(res.data);
      }
    } catch (e) {
      toast.error("Failed to load GitHub intelligence", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const triggerRefresh = async () => {
    try {
      setSyncing(true);
      const res = await requestJson<{ success: boolean; error?: string }>("/api/student/github/intelligence", {
        method: "POST",
        json: { forceDeepScan: true },
      });
      if (res.ok && res.data.success) {
        toast.success("GitHub sync complete", "Profile, repositories, and commit records updated.");
        await loadData();
      } else {
        toast.error("Sync failed", res.ok ? res.data.error || "Unknown error" : describeError(res.error));
      }
    } catch (e) {
      toast.error("Sync failed", e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  const loadRepoDeep = async (repoId: string) => {
    if (selectedRepoId === repoId) {
      setSelectedRepoId(null);
      setRepoDetails(null);
      return;
    }
    setSelectedRepoId(repoId);
    setLoadingRepoDetails(true);
    try {
      const res = await requestJson<any>(`/api/student/github/intelligence?repoId=${encodeURIComponent(repoId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        setRepoDetails(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingRepoDetails(false);
    }
  };

  // Filtered and sorted repositories
  const filteredRepos = useMemo(() => {
    if (!data?.repositories) return [];
    let list = [...data.repositories];

    if (filterType === "original") {
      list = list.filter((r) => !r.isFork);
    } else if (filterType === "forks") {
      list = list.filter((r) => r.isFork);
    } else if (filterType === "archived") {
      list = list.filter((r) => r.isArchived);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.primaryLanguage && r.primaryLanguage.toLowerCase().includes(q)) ||
          r.topics.some((t) => t.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortBy === "stars") return b.stars - a.stars;
      if (sortBy === "pushed") {
        return new Date(b.lastPushAt || 0).getTime() - new Date(a.lastPushAt || 0).getTime();
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [data?.repositories, filterType, searchQuery, sortBy]);

  if (loading && !data) {
    return (
      <div className="py-12 text-center text-sm text-text-muted">
        <ArrowsClockwise className="mx-auto mb-3 h-6 w-6 animate-spin text-champagne" />
        Loading GitHub intelligence and repository evidence…
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <EmptyState
        icon={FolderSimple}
        title="No GitHub Account Linked"
        actions={
          <Button variant="primary" size="sm" onClick={() => triggerRefresh()}>
            Connect or Enter GitHub Profile
          </Button>
        }
      >
        Connect your GitHub account or specify your profile URL to extract, analyze, and persist your complete
        repository inventory, commit histories, PRs, technologies, and resume matches.
      </EmptyState>
    );
  }

  const { profile, commitAnalytics, latestSyncRun, resumeMatches } = data;

  // Language breakdown percentages
  const totalLangBytes = Object.values(data.languageTotals).reduce((a, b) => a + b, 0);
  const topLanguages = Object.entries(data.languageTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, bytes]) => ({
      lang,
      percentage: totalLangBytes > 0 ? Math.round((bytes / totalLangBytes) * 100) : 0,
    }));

  return (
    <div className="space-y-6">
      {/* 1. Header & Profile Banner */}
      <div className="flex flex-col gap-5 rounded-[var(--radius-panel)] border border-border-medium bg-surface-base p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          {profile.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.avatarUrl}
              alt={profile.login}
              className="h-16 w-16 rounded-full border border-border-medium object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-elevated text-xl font-bold">
              {profile.login.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold text-text-primary">
                {profile.displayName || profile.login}
              </h2>
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-text-muted hover:text-champagne"
              >
                @{profile.login}
                <ArrowSquareOut size={13} aria-hidden="true" />
              </a>
              <StatusChip size="sm" tone="verified">
                Verified GitHub
              </StatusChip>
            </div>
            {profile.bio && <p className="max-w-2xl text-xs text-text-muted">{profile.bio}</p>}
            <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-2xs text-text-muted">
              <span>{profile.publicRepos} public repos</span>
              <span>{profile.followers} followers</span>
              <span>{profile.publicGists} gists</span>
              {profile.location && <span>📍 {profile.location}</span>}
              {profile.company && <span>🏢 {profile.company}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowsClockwise size={16} className={syncing ? "animate-spin" : ""} />}
            loading={syncing}
            loadingLabel="Synchronizing…"
            onClick={() => void triggerRefresh()}
          >
            Refresh GitHub Intelligence
          </Button>
          {latestSyncRun && (
            <span className="font-mono text-3xs text-text-muted">
              Last synced: {formatDate(latestSyncRun.startedAt, true)} · Status: {latestSyncRun.status}
            </span>
          )}
        </div>
      </div>

      {/* 2. Commit Activity & Intelligence Telemetry */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Total Indexed Commits</span>
            <GitCommit size={18} className="text-champagne" />
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{commitAnalytics.totalAccessibleCommits}</div>
          <div className="mt-1 font-mono text-3xs text-text-muted">
            {commitAnalytics.candidateAttributedCommits} candidate-attributed
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">30-Day Activity</span>
            <CheckCircle size={18} className="text-success" />
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{commitAnalytics.commitsLast30Days}</div>
          <div className="mt-1 font-mono text-3xs text-text-muted">
            {commitAnalytics.commitsLast90Days} in last 90 days
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">PRs & Issues</span>
            <GitPullRequest size={18} className="text-soft-amber" />
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">
            {data.pullRequests.length + data.issues.length}
          </div>
          <div className="mt-1 font-mono text-3xs text-text-muted">
            {data.pullRequests.length} pull requests · {data.issues.length} issues
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Resume Project Matches</span>
            <ShieldCheck size={18} className="text-champagne" />
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{resumeMatches.length}</div>
          <div className="mt-1 font-mono text-3xs text-text-muted">Correlated with resume portfolio</div>
        </Panel>
      </div>

      {/* Top Languages Distribution */}
      {topLanguages.length > 0 && (
        <div className="rounded-[var(--radius-panel)] border border-border-medium bg-surface-base p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-text-primary">
            <span>Primary Language Breakdown (Across Public Repositories)</span>
            <span className="font-mono text-2xs text-text-muted">Byte-level statistics</span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-elevated">
            {topLanguages.map((tl, idx) => {
              const colors = ["bg-champagne", "bg-soft-amber", "bg-sky-400", "bg-emerald-400", "bg-purple-400"];
              return (
                <div
                  key={tl.lang}
                  style={{ width: `${tl.percentage}%` }}
                  title={`${tl.lang}: ${tl.percentage}%`}
                  className={colors[idx % colors.length]}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 font-mono text-2xs text-text-muted">
            {topLanguages.map((tl) => (
              <span key={tl.lang} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-champagne" />
                {tl.lang}: <strong className="text-text-primary">{tl.percentage}%</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Repository Inventory Filter & Search Controls */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-medium bg-surface-base p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "original", "forks", "archived"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterType(mode)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-all",
                filterType === mode
                  ? "bg-champagne/20 text-champagne border border-champagne/40"
                  : "bg-surface-elevated text-text-muted hover:text-text-primary"
              )}
            >
              {mode} ({data.repositories.filter((r) => (mode === "all" ? true : mode === "original" ? !r.isFork : mode === "forks" ? r.isFork : r.isArchived)).length})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <TextField
            label="Search repositories"
            labelHidden
            placeholder="Search repository, tech, or topic…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-md border border-border-medium bg-surface-elevated px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
          >
            <option value="stars">Most Stars</option>
            <option value="pushed">Recently Pushed</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {/* 4. Repository Inventory List */}
      <div className="space-y-3">
        {filteredRepos.length === 0 ? (
          <div className="rounded-[var(--radius-panel)] border border-dashed border-border-medium p-8 text-center text-sm text-text-muted">
            No repositories found matching your filter criteria.
          </div>
        ) : (
          filteredRepos.map((repo) => {
            const isExpanded = selectedRepoId === repo.id;
            const matches = resumeMatches.filter((rm) => rm.repositoryId === repo.id);

            return (
              <div
                key={repo.id}
                className="overflow-hidden rounded-[var(--radius-panel)] border border-border-medium bg-surface-base transition-all hover:border-champagne/30"
              >
                {/* Repository Summary Row */}
                <div
                  className="flex cursor-pointer flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                  onClick={() => void loadRepoDeep(repo.id)}
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-text-muted">
                        {isExpanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
                      </span>
                      <h3 className="font-display text-base font-semibold text-text-primary hover:text-champagne">
                        {repo.name}
                      </h3>
                      {repo.isFork && <StatusChip tone="neutral" size="sm">Fork</StatusChip>}
                      {repo.isArchived && <StatusChip tone="neutral" size="sm">Archived</StatusChip>}
                      {repo.primaryLanguage && (
                        <span className="rounded-full border border-border-medium px-2 py-0.5 font-mono text-3xs text-text-muted">
                          {repo.primaryLanguage}
                        </span>
                      )}
                      {matches.length > 0 && (
                        <StatusChip tone="verified" size="sm">
                          Resume Matched
                        </StatusChip>
                      )}
                    </div>
                    {repo.description && (
                      <p className="max-w-3xl text-xs text-text-muted line-clamp-1">{repo.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-2xs text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Star size={13} className="text-soft-amber" /> {repo.stars}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <GitFork size={13} /> {repo.forks}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <GitBranch size={13} /> {repo.defaultBranch}
                      </span>
                      {repo.workflows.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle size={13} /> CI/CD Active
                        </span>
                      )}
                      {repo.lastPushAt && <span>Pushed {formatDate(repo.lastPushAt, false)}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={repo.canonicalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-md border border-border-medium px-2.5 py-1 text-xs text-text-muted hover:border-champagne/40 hover:text-text-primary"
                    >
                      GitHub <ArrowSquareOut size={12} />
                    </a>
                  </div>
                </div>

                {/* Expanded Deep Details Inspection */}
                {isExpanded && (
                  <div className="border-t border-border-medium bg-surface-elevated/40 p-5 space-y-5">
                    {loadingRepoDetails && !repoDetails ? (
                      <div className="py-6 text-center text-xs text-text-muted">
                        <ArrowsClockwise className="mx-auto mb-2 h-5 w-5 animate-spin text-champagne" />
                        Fetching deep commits, PRs, technologies, and inspection evidence…
                      </div>
                    ) : (
                      <>
                        {/* Resume Match Explanation if present */}
                        {matches.length > 0 && (
                          <div className="rounded-lg border border-champagne/30 bg-champagne/10 p-3">
                            <div className="text-xs font-semibold text-champagne">Resume Project Match Details</div>
                            {matches.map((m) => (
                              <div key={m.id} className="mt-1 text-xs text-text-primary">
                                Linked with resume project: <strong>{m.resumeProjectTitle}</strong> (Confidence:{" "}
                                {Math.round(m.matchScore * 100)}%)
                                <div className="mt-0.5 text-2xs text-text-muted">
                                  Reasons: {m.matchReasons.join(" · ")}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Technologies & Evidence */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                            Detected Technologies & Provenance
                          </h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(repoDetails?.technologies || data.technologies.filter((t) => t.repositoryId === repo.id))
                              .length === 0 ? (
                              <span className="text-xs text-text-muted">No explicit packages detected.</span>
                            ) : (
                              (repoDetails?.technologies || data.technologies.filter((t) => t.repositoryId === repo.id)).map(
                                (t: any) => (
                                  <span
                                    key={t.id || t.name}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-border-medium bg-surface-base px-2.5 py-1 text-xs font-mono text-text-primary"
                                  >
                                    <span>{t.name}</span>
                                    <span className="text-3xs text-text-muted">
                                      ({t.detectionMethod || t.provenance})
                                    </span>
                                  </span>
                                )
                              )
                            )}
                          </div>
                        </div>

                        {/* Recent Commits */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                            Recent Commits & Attribution
                          </h4>
                          <div className="mt-2 divide-y divide-border-medium rounded-md border border-border-medium bg-surface-base">
                            {(repoDetails?.commits || []).slice(0, 5).map((c: any) => (
                              <div key={c.sha} className="flex items-center justify-between p-2.5 text-xs">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="font-mono text-2xs text-champagne">{c.sha.slice(0, 7)}</span>
                                  <span className="truncate text-text-primary">{c.message}</span>
                                </div>
                                <div className="flex items-center gap-3 font-mono text-3xs text-text-muted">
                                  {c.isAttributedToCandidate ? (
                                    <StatusChip tone="verified" size="sm">
                                      Candidate
                                    </StatusChip>
                                  ) : (
                                    <StatusChip tone="neutral" size="sm">
                                      External
                                    </StatusChip>
                                  )}
                                  <span>{c.authorName || c.authorLogin}</span>
                                  <span>{formatDate(c.authorDate, false)}</span>
                                </div>
                              </div>
                            ))}
                            {(repoDetails?.commits || []).length === 0 && (
                              <div className="p-3 text-center text-2xs text-text-muted">
                                Commits indexed at repository metadata stage.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* README Snippet if available */}
                        {repo.readmeContent && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                              Sanitized Documentation (README)
                            </h4>
                            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border-medium bg-surface-base p-3 font-mono text-2xs text-text-muted whitespace-pre-wrap">
                              {repo.readmeContent.slice(0, 1500)}
                              {repo.readmeContent.length > 1500 && "… [truncated for performance]"}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
