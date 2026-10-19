import { createGitHubInstallationToken } from "@/lib/connectors/github/app-auth";
import { acquireSelectedInstallationRepositories } from "@/lib/connectors/github/app-installation-acquisition";
import { mapRawRepoToProject } from "@/lib/connectors/github/client";
import {
  getExternalConnectionByProvider,
  saveExternalConnection,
  createSyncRun,
  completeSyncRun,
  saveSourceSnapshot,
} from "@/lib/repositories/connection-repository";
import { saveProject } from "@/lib/repositories/project-repository";
import { writeEvidenceBatch } from "@/lib/repositories/evidence-repository";
import {
  upsertGitHubRepository,
  upsertGitHubTechnologies,
  createGitHubSyncRun,
  updateGitHubSyncRun,
} from "@/lib/repositories/github-intelligence-repository";
import type { RepositoryDeepDetails } from "@/lib/connectors/github/deep-collector";

export type GitHubAppSyncStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "RATE_LIMITED"
  | "FAILED"
  | "NOT_AUTHORIZED";

export interface GitHubAppSyncSummary {
  success: boolean;
  status: GitHubAppSyncStatus;
  syncRunId?: string;
  totalRepositories: number;
  publicRepositoryCount: number;
  privateRepositoryCount: number;
  processedRepositoryCount: number;
  failedRepositories: Array<{ repo: string; reason: string }>;
  recordsCreatedOrUpdated: number;
  queriesExecuted: number;
  rateLimit?: {
    limit?: number;
    remaining?: number;
    resetAt?: string;
  };
  startedAt: string;
  completedAt: string;
  error?: string;
}

export type GitHubAppSyncResult = GitHubAppSyncSummary;

/**
 * Syncs repositories explicitly selected in the student's GitHub App install.
 * The short-lived installation token is created for this run and is never
 * persisted. Existing OAuth credentials/metadata are preserved.
 * Persists to both Core V4 tables and GitHub Intelligence relational tables.
 */
export async function syncGitHubAppInstallation(personId: string): Promise<GitHubAppSyncSummary> {
  const startedAt = new Date().toISOString();
  const connection = await getExternalConnectionByProvider(personId, "github");
  const metadata = (connection?.metadata || {}) as Record<string, unknown>;
  const installationId = metadata.githubAppInstallationId;

  if (!connection || connection.status === "disconnected") {
    return {
      success: false,
      status: "NOT_AUTHORIZED",
      totalRepositories: 0,
      publicRepositoryCount: 0,
      privateRepositoryCount: 0,
      processedRepositoryCount: 0,
      failedRepositories: [],
      recordsCreatedOrUpdated: 0,
      queriesExecuted: 0,
      startedAt,
      completedAt: new Date().toISOString(),
      error: "Connect your GitHub account first.",
    };
  }

  if (typeof installationId !== "string" || !/^\d+$/.test(installationId)) {
    return {
      success: false,
      status: "NOT_AUTHORIZED",
      totalRepositories: 0,
      publicRepositoryCount: 0,
      privateRepositoryCount: 0,
      processedRepositoryCount: 0,
      failedRepositories: [],
      recordsCreatedOrUpdated: 0,
      queriesExecuted: 0,
      startedAt,
      completedAt: new Date().toISOString(),
      error: "Private repository access is not installed. Choose 'Authorize selected repositories' and select repositories in GitHub.",
    };
  }

  let syncRun: Awaited<ReturnType<typeof createSyncRun>> | undefined;
  let ghSyncRunId: string | undefined;

  try {
    const token = await createGitHubInstallationToken(installationId);
    const acquisition = await acquireSelectedInstallationRepositories(token);

    syncRun = await createSyncRun(connection.id, personId, "github");
    try {
      ghSyncRunId = await createGitHubSyncRun({
        personId,
        username: connection.externalUsername,
        trigger: "user_refresh",
      });
    } catch {
      // Non-fatal if relational ledger already has an active run
    }

    const failedRepos = [...acquisition.failedRepos];
    let recordsChanged = 0;
    let processedCount = 0;

    const publicCount = acquisition.repos.filter((r) => !r.private).length;
    const privateCount = acquisition.repos.filter((r) => r.private).length;

    for (const repo of acquisition.repos) {
      const deep = acquisition.deep.get(repo.full_name);
      if (deep?.failure && !failedRepos.some((item) => item.repo === repo.full_name)) {
        failedRepos.push({ repo: repo.full_name, reason: deep.failure });
      }

      try {
        const project = mapRawRepoToProject({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          html_url: repo.html_url,
          homepage: repo.homepage,
          language: repo.language,
          topics: repo.topics || [],
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          fork: repo.fork,
          private: repo.private,
          archived: repo.archived,
          default_branch: repo.default_branch,
          created_at: repo.created_at,
          updated_at: repo.updated_at,
          pushed_at: repo.pushed_at || undefined,
          license: repo.license?.spdx_id || repo.license?.name || null,
        }, deep, connection.externalUsername);

        // 1. Core V4 Source Snapshot
        await saveSourceSnapshot(personId, "github", project.repositoryUrl, {
          fullName: repo.full_name,
          pushedAt: repo.pushed_at,
          title: project.title,
          description: project.description,
          technologies: project.technologies,
          stars: project.stars,
          forks: project.forks,
          isPrivate: repo.private,
          isFork: project.isFork,
          isArchived: project.isArchived,
          isTemplate: project.isTemplate,
          isEmpty: project.isEmpty,
          projectClassification: project.projectClassification,
          license: project.license,
          detectedManifests: project.detectedManifests,
          checksum: project.checksum,
          syncedAt: new Date().toISOString(),
          accessMethod: "github_app_installation",
        }, project.checksum);

        // 2. Core V4 Project Record
        await saveProject(personId, {
          title: project.title,
          summary: project.description || "GitHub repository candidate",
          description: project.description || "",
          technologies: project.technologies || [],
          sources: ["github"],
          repositoryUrl: project.repositoryUrl,
          demoUrl: project.homepageUrl || undefined,
          status: "candidate",
          aiDetails: {
            categories: project.aiMlCategories || [],
            observedFiles: project.observedFiles || [],
            primaryLanguage: project.primaryLanguage || null,
          },
          metadata: {
            stars: project.stars,
            forks: project.forks,
            isPrivate: repo.private,
            isFork: project.isFork,
            languages: project.languages,
            externalRepoId: project.externalRepoId,
            projectClassification: project.projectClassification,
            isArchived: project.isArchived,
            isTemplate: project.isTemplate,
            isEmpty: project.isEmpty,
            license: project.license || undefined,
            analysisStage: project.analysisStage,
            accessMethod: "github_app_installation",
          },
        });

        // 3. Evidence Items
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

        // 4. GitHub Intelligence 11 Relational Tables
        const deepDetails: RepositoryDeepDetails = {
          repo: {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            owner_login: repo.owner.login,
            description: repo.description,
            html_url: repo.html_url,
            homepage: repo.homepage,
            is_private: repo.private,
            is_fork: repo.fork,
            is_archived: repo.archived,
            is_template: false,
            is_empty: false,
            default_branch: repo.default_branch,
            primary_language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            watchers: repo.stargazers_count,
            open_issues: 0,
            disk_usage_kb: 0,
            license: repo.license?.spdx_id || repo.license?.name || null,
            topics: repo.topics || [],
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            pushed_at: repo.pushed_at || repo.updated_at,
          },
          languages: deep?.languages || (repo.language ? { [repo.language]: 100 } : {}),
          branches: [repo.default_branch],
          tags: [],
          releases: [],
          pullRequests: [],
          issues: [],
          commits: [],
          workflows: [],
          fileStructure: [],
          manifests: deep?.manifests || {},
          readmeContent: deep?.readme || null,
          technologyFindings: project.technologyFindings.map((f) => ({
            name: f.name,
            category: f.category,
            confidence: f.confidence,
            provenance: f.provenance as any,
            sourceFile: f.sourceFile,
          })),
          projectClassification: project.projectClassification as any,
          aiMlCategories: project.aiMlCategories as any,
          checksum: project.checksum,
          firstCommitAt: null,
          lastPushAt: repo.pushed_at || null,
          commitAnalytics: {
            totalAccessibleCommits: 0,
            candidateCommits: 0,
            otherContributorsCommits: 0,
            firstCommitDate: null,
            latestCommitDate: null,
            activityLast30Days: 0,
            activityLast90Days: 0,
            activityLast365Days: 0,
            uniqueShasCount: 0,
            monthlyBreakdown: {},
          },
          failureReasons: [],
          accessMethod: "github_app_installation",
        };

        const repoRowId = await upsertGitHubRepository({ personId, deep: deepDetails });
        await upsertGitHubTechnologies(
          personId,
          repoRowId,
          deepDetails.technologyFindings
        );

        recordsChanged++;
        processedCount++;
      } catch (error) {
        if (!failedRepos.some((item) => item.repo === repo.full_name)) {
          failedRepos.push({
            repo: repo.full_name,
            reason: `persist:${error instanceof Error ? error.message.slice(0, 120) : "error"}`,
          });
        }
      }
    }

    // Determine final sync status
    const isPartial = failedRepos.length > 0 && processedCount > 0;
    const isAllFailed = failedRepos.length > 0 && processedCount === 0 && acquisition.repos.length > 0;
    const finalStatus: GitHubAppSyncStatus = isAllFailed
      ? "FAILED"
      : isPartial
      ? "PARTIAL"
      : "COMPLETED";

    const completedAt = new Date().toISOString();

    await saveExternalConnection({
      personId,
      provider: "github",
      externalUsername: connection.externalUsername,
      externalAccountId: connection.externalAccountId || undefined,
      profileUrl: connection.profileUrl,
      displayName: connection.displayName || undefined,
      scopes: Array.isArray(connection.scopes) ? connection.scopes as string[] : [],
      status: "connected",
      metadata: {
        ...metadata,
        githubAppLastSyncedAt: completedAt,
        githubAppRepositoryCount: acquisition.repos.length,
        githubAppPrivateRepositoryCount: privateCount,
        githubAppPublicRepositoryCount: publicCount,
        githubAppRecordsChanged: recordsChanged,
        githubAppLastSyncStatus: finalStatus,
      },
    });

    await completeSyncRun(syncRun.id, {
      status: finalStatus === "COMPLETED" ? "completed" : finalStatus === "PARTIAL" ? "partial" : "failed",
      recordsFetched: acquisition.repos.length,
      recordsChanged,
      ...(failedRepos.length
        ? {
            errorCode: finalStatus,
            errorSummary: failedRepos.map((item) => `${item.repo}: ${item.reason}`).join("; ").slice(0, 500),
          }
        : {}),
    });

    if (ghSyncRunId) {
      await updateGitHubSyncRun({
        runId: ghSyncRunId,
        status: finalStatus === "COMPLETED" ? "completed" : finalStatus === "PARTIAL" ? "partial" : "failed",
        discoveredReposCount: acquisition.repos.length,
        processedReposCount: processedCount,
        failedReposCount: failedRepos.length,
        failedResources: failedRepos.map((f) => ({ resource: f.repo, error: f.reason, timestamp: completedAt })),
      }).catch(() => {});
    }

    return {
      success: finalStatus === "COMPLETED",
      status: finalStatus,
      syncRunId: syncRun.id,
      totalRepositories: acquisition.repos.length,
      publicRepositoryCount: publicCount,
      privateRepositoryCount: privateCount,
      processedRepositoryCount: processedCount,
      failedRepositories: failedRepos,
      recordsCreatedOrUpdated: recordsChanged,
      queriesExecuted: acquisition.queries,
      startedAt,
      completedAt,
      ...(failedRepos.length ? { error: `Partial sync: ${failedRepos.length} repository(s) failed.` } : {}),
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const errMsg = error instanceof Error ? error.message : "GitHub App sync failed.";
    const isRateLimit = /rate limit/i.test(errMsg);
    const finalStatus: GitHubAppSyncStatus = isRateLimit ? "RATE_LIMITED" : "FAILED";

    if (syncRun) {
      await completeSyncRun(syncRun.id, {
        status: "failed",
        recordsFetched: 0,
        recordsChanged: 0,
        errorCode: finalStatus,
        errorSummary: errMsg.slice(0, 500),
      }).catch(() => {});
    }

    if (ghSyncRunId) {
      await updateGitHubSyncRun({
        runId: ghSyncRunId,
        status: "failed",
        errorMessage: errMsg.slice(0, 500),
      }).catch(() => {});
    }

    return {
      success: false,
      status: finalStatus,
      totalRepositories: 0,
      publicRepositoryCount: 0,
      privateRepositoryCount: 0,
      processedRepositoryCount: 0,
      failedRepositories: [],
      recordsCreatedOrUpdated: 0,
      queriesExecuted: 0,
      startedAt,
      completedAt,
      error: errMsg.slice(0, 220),
    };
  }
}
