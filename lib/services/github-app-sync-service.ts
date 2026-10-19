import { createGitHubInstallationToken } from "@/lib/connectors/github/app-auth";
import { acquireSelectedInstallationRepositories } from "@/lib/connectors/github/app-installation-acquisition";
import { mapRawRepoToProject } from "@/lib/connectors/github/client";
import { getExternalConnectionByProvider, saveExternalConnection, createSyncRun, completeSyncRun, saveSourceSnapshot } from "@/lib/repositories/connection-repository";
import { saveProject } from "@/lib/repositories/project-repository";
import { writeEvidenceBatch } from "@/lib/repositories/evidence-repository";

export type GitHubAppSyncResult = {
  success: boolean;
  repositoryCount: number;
  recordsChanged: number;
  failedRepos: { repo: string; reason: string }[];
  queries: number;
  error?: string;
};

/**
 * Syncs repositories explicitly selected in the student's GitHub App install.
 * The short-lived installation token is created for this run and is never
 * persisted. Existing OAuth credentials/metadata are preserved.
 */
export async function syncGitHubAppInstallation(personId: string): Promise<GitHubAppSyncResult> {
  const connection = await getExternalConnectionByProvider(personId, "github");
  const metadata = (connection?.metadata || {}) as Record<string, unknown>;
  const installationId = metadata.githubAppInstallationId;

  if (!connection || connection.status === "disconnected") {
    return { success: false, repositoryCount: 0, recordsChanged: 0, failedRepos: [], queries: 0, error: "Connect your GitHub account first." };
  }
  if (typeof installationId !== "string" || !/^\d+$/.test(installationId)) {
    return { success: false, repositoryCount: 0, recordsChanged: 0, failedRepos: [], queries: 0, error: "Private repository access is not installed. Choose 'Authorize private repositories' and select repositories in GitHub." };
  }

  let syncRun: Awaited<ReturnType<typeof createSyncRun>> | undefined;
  try {
    const token = await createGitHubInstallationToken(installationId);
    const acquisition = await acquireSelectedInstallationRepositories(token);
    syncRun = await createSyncRun(connection.id, personId, "github");
    const failedRepos = [...acquisition.failedRepos];
    let recordsChanged = 0;

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
        if (!failedRepos.some((item) => item.repo === repo.full_name)) {
          failedRepos.push({ repo: repo.full_name, reason: `persist:${error instanceof Error ? error.message.slice(0, 120) : "error"}` });
        }
      }
    }

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
        githubAppLastSyncedAt: new Date().toISOString(),
        githubAppRepositoryCount: acquisition.repos.length,
        githubAppPrivateRepositoryCount: acquisition.repos.filter((repo) => repo.private).length,
        githubAppRecordsChanged: recordsChanged,
      },
    });

    await completeSyncRun(syncRun.id, {
      status: failedRepos.length ? "partial" : "completed",
      recordsFetched: acquisition.repos.length,
      recordsChanged,
      ...(failedRepos.length ? { errorCode: "PARTIAL", errorSummary: failedRepos.map((item) => `${item.repo}: ${item.reason}`).join("; ").slice(0, 500) } : {}),
    });

    return { success: failedRepos.length === 0, repositoryCount: acquisition.repos.length, recordsChanged, failedRepos, queries: acquisition.queries };
  } catch (error) {
    if (syncRun) {
      await completeSyncRun(syncRun.id, {
        status: "failed",
        recordsFetched: 0,
        recordsChanged: 0,
        errorCode: "GITHUB_APP_SYNC_FAILED",
        errorSummary: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      }).catch(() => {});
    }
    return { success: false, repositoryCount: 0, recordsChanged: 0, failedRepos: [], queries: 0, error: error instanceof Error ? error.message.slice(0, 220) : "GitHub App sync failed." };
  }
}
