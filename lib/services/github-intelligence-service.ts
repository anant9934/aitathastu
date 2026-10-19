/**
 * AI TATHASTU — COMPLETE GITHUB INTELLIGENCE & DATA PERSISTENCE SERVICE
 *
 * Orchestrates:
 * 1. Comprehensive profile acquisition, normalization, and relational persistence.
 * 2. Uncapped repository discovery across all public repos.
 * 3. Deep repository content extraction:
 *    - Language byte breakdowns, branches, tags, releases
 *    - Pull requests, code reviews, issues
 *    - Commits, SHA deduplication, candidate vs external attribution
 *    - 30/90/365-day timelines and monthly activity analytics
 *    - Manifests, container configs, CI/CD workflows, file trees
 *    - Deterministic technology findings and AI/ML domain classification
 * 4. Resume-to-GitHub project and skill matching with confidence scoring.
 * 5. Historical snapshot tracking and delta detection.
 * 6. Rate-limit backoff, bounded concurrency, and error resiliency.
 * 7. Candidate isolation and Zero Phone Privacy Guarantee enforcement.
 */

import crypto from "crypto";
import {
  fetchEnrichedUserProfile,
  fetchAllPublicRepositories,
  fetchRepositoryDeepDetails,
  mapWithConcurrency,
  cleanUsername,
  type GitHubEnrichedProfile,
  type RawDiscoveredRepo,
  type RepositoryDeepDetails,
} from "@/lib/connectors/github/deep-collector";
import {
  upsertGitHubProfile,
  createGitHubProfileSnapshot,
  upsertGitHubRepository,
  upsertGitHubCommits,
  upsertGitHubPullRequests,
  upsertGitHubIssues,
  upsertGitHubReleases,
  upsertGitHubTechnologies,
  upsertGitHubResumeMatch,
  createGitHubSyncRun,
  updateGitHubSyncRun,
  getActiveGitHubSyncRun,
  getGitHubIntelligenceByPerson,
  getRepositoryFullDetails,
} from "@/lib/repositories/github-intelligence-repository";
import { getDb, projects, resumeDocuments } from "@/lib/db";
import { eq } from "drizzle-orm";
import { normalizeProjectTitle, baseProjectTitle, slugify } from "@/lib/text/normalize";
import { saveProject } from "@/lib/repositories/project-repository";
import { writeEvidenceBatch } from "@/lib/repositories/evidence-repository";
import { saveExternalConnection, getExternalConnectionByProvider } from "@/lib/repositories/connection-repository";
import { decryptConnectionTokenWithMeta } from "@/lib/security/connection-token";

const CONCURRENCY_LIMIT = 3;

export interface ExtractionProgress {
  discoveredCount: number;
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  totalCommits: number;
  totalPrs: number;
  totalIssues: number;
  totalReleases: number;
}

export interface GitHubExtractionResult {
  success: boolean;
  runId: string;
  username: string;
  profile: GitHubEnrichedProfile | null;
  repositoriesCount: number;
  processedReposCount: number;
  failedReposCount: number;
  totalCommitsFetched: number;
  totalPrsFetched: number;
  totalIssuesFetched: number;
  totalReleasesFetched: number;
  rateLimitRemaining?: number;
  rateLimitResetAt?: number;
  failedResources: Array<{ resource: string; error: string; timestamp?: string }>;
  isComplete: boolean;
  error?: string;
}

const normalizeRepoUrl = (url: string) =>
  url.trim().toLowerCase().replace(/\.git$/, "").replace(/\/+$/, "");

function buildBasicDeepDetails(repo: RawDiscoveredRepo): RepositoryDeepDetails {
  return {
    repo,
    languages: repo.primary_language ? { [repo.primary_language]: 100 } : {},
    branches: [repo.default_branch],
    tags: [],
    releases: [],
    pullRequests: [],
    issues: [],
    commits: [],
    workflows: [],
    fileStructure: [],
    manifests: {},
    readmeContent: null,
    technologyFindings: [],
    aiMlCategories: [],
    projectClassification: repo.is_fork ? "fork" : repo.is_archived ? "archived" : "original",
    checksum: crypto.createHash("sha256").update(`${repo.full_name}:${repo.pushed_at}`).digest("hex"),
    firstCommitAt: null,
    lastPushAt: repo.pushed_at,
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
  };
}

/**
 * Executes a full or incremental extraction run for a candidate's GitHub account.
 */
export async function executeFullGitHubExtraction(params: {
  personId: string;
  username: string;
  token?: string;
  trigger?: "user_refresh" | "onboarding" | "scheduled" | "api";
  forceDeepScan?: boolean;
  maxReposToInspect?: number;
}): Promise<GitHubExtractionResult> {
  const { personId, trigger = "user_refresh", forceDeepScan: _forceDeepScan = false, maxReposToInspect } = params;
  const username = cleanUsername(params.username);

  if (!username) {
    throw new Error("Valid GitHub username is required.");
  }

  // Prevent duplicate concurrent sync operations for the same candidate
  const activeRun = await getActiveGitHubSyncRun(personId);
  if (activeRun) {
    return {
      success: true,
      runId: activeRun.id,
      username,
      profile: null,
      repositoriesCount: activeRun.discoveredReposCount,
      processedReposCount: activeRun.processedReposCount,
      failedReposCount: activeRun.failedReposCount,
      totalCommitsFetched: activeRun.totalCommitsFetched,
      totalPrsFetched: activeRun.totalPrsFetched,
      totalIssuesFetched: activeRun.totalIssuesFetched,
      totalReleasesFetched: 0,
      isComplete: false,
      failedResources: [],
      error: "A synchronization run is already actively running for this student.",
    };
  }

  // Resolve authorization token: explicit parameter -> stored encrypted OAuth token -> environment token
  let token = params.token;
  if (!token) {
    try {
      const conn = await getExternalConnectionByProvider(personId, "github");
      const metadata = conn?.metadata as Record<string, unknown> | null;
      if (typeof metadata?.encryptedAccessToken === "string") {
        const decrypted = decryptConnectionTokenWithMeta(metadata.encryptedAccessToken, personId);
        token = decrypted.token;
      }
    } catch {
      // Fallback
    }
  }
  if (!token) {
    token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  }

  // 1. Initialize Sync Run Row
  const runId = await createGitHubSyncRun({
    personId,
    username,
    trigger,
  });

  const failedResources: Array<{ resource: string; error: string; timestamp: string }> = [];

  try {
    // 2. Fetch Enriched Profile
    const profileRes = await fetchEnrichedUserProfile(username, token);
    if (!profileRes.success || !profileRes.profile) {
      const errMsg = profileRes.error || `Could not fetch profile for '${username}'.`;
      await updateGitHubSyncRun({
        runId,
        status: "failed",
        errorMessage: errMsg,
        rateLimitRemaining: profileRes.rateLimitRemaining,
        rateLimitResetAt: profileRes.rateLimitResetAt ? new Date(profileRes.rateLimitResetAt) : undefined,
      });
      return {
        success: false,
        runId,
        username,
        profile: null,
        repositoriesCount: 0,
        processedReposCount: 0,
        failedReposCount: 0,
        totalCommitsFetched: 0,
        totalPrsFetched: 0,
        totalIssuesFetched: 0,
        totalReleasesFetched: 0,
        rateLimitRemaining: profileRes.rateLimitRemaining,
        rateLimitResetAt: profileRes.rateLimitResetAt,
        failedResources: [{ resource: `profile:${username}`, error: errMsg, timestamp: new Date().toISOString() }],
        isComplete: false,
        error: errMsg,
      };
    }

    const profile = profileRes.profile;

    // Persist Profile
    const profileDbId = await upsertGitHubProfile({ personId, profile });

    // Also update existing external_connections table so candidate connection status is in sync
    await saveExternalConnection({
      personId,
      provider: "github",
      externalAccountId: String(profile.id),
      externalUsername: profile.login,
      displayName: profile.name || profile.login,
      profileUrl: profile.html_url,
      status: "connected",
      metadata: {
        lastSyncedAt: new Date().toISOString(),
        publicRepos: profile.public_repos,
        followers: profile.followers,
      },
    }).catch(() => {});

    // 3. Enumerate Every Discoverable Public Repository
    const reposRes = await fetchAllPublicRepositories(username, {
      token,
      maxRepos: Math.max(500, profile.public_repos + 50),
    });

    if (!reposRes.success) {
      const errMsg = reposRes.error || "Could not list repositories from GitHub.";
      failedResources.push({ resource: `repos:${username}`, error: errMsg, timestamp: new Date().toISOString() });
    }

    const allRepos = reposRes.repos;

    // 4. Deep Inspection with Bounded Concurrency
    let processedReposCount = 0;
    let failedReposCount = 0;
    let totalCommitsFetched = 0;
    let totalPrsFetched = 0;
    let totalIssuesFetched = 0;
    let totalReleasesFetched = 0;
    let totalStars = 0;

    const reposToDeepScan = maxReposToInspect ? allRepos.slice(0, maxReposToInspect) : allRepos;
    const remainingRepos = maxReposToInspect ? allRepos.slice(maxReposToInspect) : [];

    const deepResults = await mapWithConcurrency<RawDiscoveredRepo, RepositoryDeepDetails | null>(
      reposToDeepScan,
      CONCURRENCY_LIMIT,
      async (repo) => {
        try {
          const deep = await fetchRepositoryDeepDetails(
            repo,
            { login: profile.login, name: profile.name, email: profile.email },
            token
          );

          if (deep.failureReasons.length > 0) {
            for (const r of deep.failureReasons) {
              failedResources.push({
                resource: `repo:${repo.full_name}:${r}`,
                error: r,
                timestamp: new Date().toISOString(),
              });
            }
          }

          // A. Persist Repository Metadata & Checksum Snapshot
          const repoRowId = await upsertGitHubRepository({ personId, deep });

          // B. Persist Commits
          await upsertGitHubCommits(personId, repoRowId, deep.commits);
          totalCommitsFetched += deep.commits.length;

          // C. Persist Pull Requests
          await upsertGitHubPullRequests(personId, repoRowId, deep.pullRequests);
          totalPrsFetched += deep.pullRequests.length;

          // D. Persist Issues
          await upsertGitHubIssues(personId, repoRowId, deep.issues);
          totalIssuesFetched += deep.issues.length;

          // E. Persist Releases
          await upsertGitHubReleases(personId, repoRowId, deep.releases);
          totalReleasesFetched += deep.releases.length;

          // F. Persist Detected Technologies
          await upsertGitHubTechnologies(
            personId,
            repoRowId,
            deep.technologyFindings.map((t) => ({
              name: t.name,
              category: t.category,
              provenance: t.provenance,
              sourceFile: t.sourceFile,
              confidence: t.confidence,
            }))
          );

          // G. Bridge into Projects & Evidence Items (Platform Compatibility)
          await saveProject(personId, {
            title: repo.name,
            summary: repo.description || "Public GitHub repository",
            description: repo.description || "",
            technologies: deep.technologyFindings.map((t) => t.name),
            sources: ["github"],
            repositoryUrl: repo.html_url,
            demoUrl: repo.homepage || undefined,
            status: "candidate",
            aiDetails: {
              categories: deep.aiMlCategories || [],
              observedFiles: deep.fileStructure.map((f) => f.path).slice(0, 50),
              primaryLanguage: repo.primary_language,
            },
            metadata: {
              stars: repo.stars,
              forks: repo.forks,
              isFork: repo.is_fork,
              languages: Object.keys(deep.languages),
              externalRepoId: repo.id,
              projectClassification: deep.projectClassification,
              isArchived: repo.is_archived,
              isTemplate: repo.is_template,
              isEmpty: repo.is_empty,
              license: repo.license || undefined,
            },
          }).catch(() => {});

          await writeEvidenceBatch(
            personId,
            deep.technologyFindings.map((f) => ({
              category: "skill" as const,
              subject: f.name,
              value: f.name,
              source: "imported" as const,
              verificationStatus: "unverified" as const,
              sourceReference: f.sourceFile ? `${repo.html_url}#${f.sourceFile}` : repo.html_url,
              interpretation: `Observed in GitHub repository '${repo.name}' (${f.provenance.toLowerCase().replace(/_/g, " ")}${f.sourceFile ? ` in ${f.sourceFile}` : ""}). Evidence confidence: ${f.confidence}. Personal proficiency requires review.`,
              whyItMatters: "Repository technology metadata points to skill evidence for student review.",
              importKey: `github_skill_${repo.id}_${slugify(f.name)}`,
            }))
          ).catch(() => {});

          totalStars += repo.stars;
          processedReposCount++;
          return deep;
        } catch (repoErr) {
          failedReposCount++;
          const msg = repoErr instanceof Error ? repoErr.message : String(repoErr);
          failedResources.push({
            resource: `repo:${repo.full_name}`,
            error: msg,
            timestamp: new Date().toISOString(),
          });
          return null;
        }
      }
    );

    // Persist all remaining discovered repositories to record complete inventory
    for (const repo of remainingRepos) {
      try {
        const basic = buildBasicDeepDetails(repo);
        await upsertGitHubRepository({ personId, deep: basic });
        totalStars += repo.stars;
        processedReposCount++;
      } catch {
        failedReposCount++;
      }
    }

    // 5. Capture Profile Snapshot with Total Aggregated Metrics
    await createGitHubProfileSnapshot(personId, profileDbId, profile, {
      totalStars,
      totalCommits: totalCommitsFetched,
    });

    // 6. Resume-to-GitHub Project and Skill Matching
    await reconcileResumeMatches(personId, allRepos, deepResults.filter(Boolean) as RepositoryDeepDetails[]);

    // 7. Complete Sync Run
    const isPartial = failedResources.length > 0 || failedReposCount > 0;
    await updateGitHubSyncRun({
      runId,
      status: isPartial ? "partial" : "completed",
      discoveredReposCount: allRepos.length,
      processedReposCount,
      failedReposCount,
      totalCommitsFetched,
      totalPrsFetched,
      totalIssuesFetched,
      rateLimitRemaining: reposRes.rateLimitRemaining,
      rateLimitResetAt: reposRes.rateLimitResetAt ? new Date(reposRes.rateLimitResetAt) : undefined,
      failedResources,
      apiCoverage: {
        profileAcquired: true,
        repositoriesEnumerated: allRepos.length,
        deepProcessed: processedReposCount,
        commitsIndexed: totalCommitsFetched,
        prsIndexed: totalPrsFetched,
        issuesIndexed: totalIssuesFetched,
        releasesIndexed: totalReleasesFetched,
        completedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      runId,
      username,
      profile,
      repositoriesCount: allRepos.length,
      processedReposCount,
      failedReposCount,
      totalCommitsFetched,
      totalPrsFetched,
      totalIssuesFetched,
      totalReleasesFetched,
      rateLimitRemaining: reposRes.rateLimitRemaining,
      rateLimitResetAt: reposRes.rateLimitResetAt,
      failedResources,
      isComplete: !isPartial,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateGitHubSyncRun({
      runId,
      status: "failed",
      errorMessage: errorMsg,
      failedResources: [{ resource: `fatal:${username}`, error: errorMsg, timestamp: new Date().toISOString() }],
    });

    return {
      success: false,
      runId,
      username,
      profile: null,
      repositoriesCount: 0,
      processedReposCount: 0,
      failedReposCount: 0,
      totalCommitsFetched: 0,
      totalPrsFetched: 0,
      totalIssuesFetched: 0,
      totalReleasesFetched: 0,
      failedResources: [{ resource: `fatal:${username}`, error: errorMsg, timestamp: new Date().toISOString() }],
      isComplete: false,
      error: errorMsg,
    };
  }
}

/**
 * Reconciles candidate resume projects with discovered GitHub repositories.
 * Matches on:
 * 1. Exact Repository URL (1.0 confidence)
 * 2. Normalized Title Equality (0.95 confidence)
 * 3. Base Title Equality (0.85 confidence)
 * 4. Slug / Substring containment + Tech overlap (0.70 - 0.90 confidence)
 */
async function reconcileResumeMatches(
  personId: string,
  repos: RawDiscoveredRepo[],
  deepRepos: RepositoryDeepDetails[]
) {
  const db = await getDb();

  // Load candidate projects from `projects` table (filtered by source resume or manual)
  const candidateProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.personId, personId));

  // Also inspect uploaded resume documents if available
  const resumeDocs = await db
    .select()
    .from(resumeDocuments)
    .where(eq(resumeDocuments.personId, personId));

  const resumeProjectItems: Array<{ id?: string; title: string; repoUrl?: string | null; technologies: string[] }> = [];

  for (const p of candidateProjects) {
    const isFromResumeOrManual =
      Array.isArray(p.sources) && (p.sources.includes("resume") || p.sources.includes("manual"));
    if (isFromResumeOrManual || !Array.isArray(p.sources) || p.sources.length === 0) {
      resumeProjectItems.push({
        id: p.id,
        title: p.title,
        repoUrl: p.repositoryUrl,
        technologies: (p.technologies || []) as string[],
      });
    }
  }

  for (const doc of resumeDocs) {
    const profile = doc.extractedProfile as { projects?: Array<{ title?: string; technologies?: string[] }> } | null;
    if (Array.isArray(profile?.projects)) {
      for (const rp of profile.projects) {
        if (rp.title && !resumeProjectItems.some((item) => item.title.toLowerCase() === rp.title?.toLowerCase())) {
          resumeProjectItems.push({
            title: rp.title,
            technologies: rp.technologies || [],
          });
        }
      }
    }
  }

  if (resumeProjectItems.length === 0 || repos.length === 0) return;

  const repoLookup = new Map<number, RepositoryDeepDetails>();
  for (const d of deepRepos) {
    repoLookup.set(d.repo.id, d);
  }

  for (const rp of resumeProjectItems) {
    const normResumeTitle = normalizeProjectTitle(rp.title);
    const baseResumeTitle = baseProjectTitle(rp.title);
    const resumeSlug = slugify(rp.title);
    const resumeRepoUrl = rp.repoUrl ? normalizeRepoUrl(rp.repoUrl) : null;
    const resumeTechLower = new Set(rp.technologies.map((t) => t.toLowerCase()));

    for (const repo of repos) {
      const repoRowId = `ghr_${personId}_${repo.id}`;
      const normRepoTitle = normalizeProjectTitle(repo.name);
      const baseRepoTitle = baseProjectTitle(repo.name);
      const repoSlug = slugify(repo.name);
      const canonicalRepoUrl = normalizeRepoUrl(repo.html_url);

      let matchScore = 0;
      const matchReasons: string[] = [];
      const matchedTechnologies: string[] = [];

      // Tech overlap check
      const deep = repoLookup.get(repo.id);
      if (deep) {
        for (const finding of deep.technologyFindings) {
          if (resumeTechLower.has(finding.name.toLowerCase())) {
            matchedTechnologies.push(finding.name);
          }
        }
      }

      // Check 1: Exact Repository URL Match
      if (resumeRepoUrl && (resumeRepoUrl === canonicalRepoUrl || canonicalRepoUrl.includes(resumeRepoUrl))) {
        matchScore = 1.0;
        matchReasons.push("Exact repository URL match");
      }
      // Check 2: Normalized Title Equality
      else if (normResumeTitle && normRepoTitle && normResumeTitle === normRepoTitle) {
        matchScore = 0.95;
        matchReasons.push("Identical normalized title");
      }
      // Check 3: Base Title Equality
      else if (baseResumeTitle && baseRepoTitle && baseResumeTitle === baseRepoTitle) {
        matchScore = 0.85;
        matchReasons.push("Matching base project title");
      }
      // Check 4: Slug containment
      else if (
        resumeSlug.length >= 4 &&
        repoSlug.length >= 4 &&
        (repoSlug.includes(resumeSlug) || resumeSlug.includes(repoSlug))
      ) {
        matchScore = 0.75;
        matchReasons.push("Title slug containment");
      }

      // Boost for Tech Stack Overlap
      if (matchedTechnologies.length > 0) {
        matchScore = Math.min(1.0, matchScore + 0.15);
        matchReasons.push(`Tech stack overlap: ${matchedTechnologies.slice(0, 3).join(", ")}`);
      }

      if (matchScore >= 0.70) {
        await upsertGitHubResumeMatch({
          personId,
          repositoryId: repoRowId,
          resumeProjectId: rp.id,
          resumeProjectTitle: rp.title,
          matchScore,
          matchReasons,
          matchedTechnologies,
        }).catch(() => {});
      }
    }
  }
}

/**
 * Retrieves the complete stored candidate intelligence bundle.
 */
export async function getCandidateGitHubIntelligence(personId: string) {
  return getGitHubIntelligenceByPerson(personId);
}

/**
 * Retrieves deep inspection details for a single candidate repository.
 */
export async function getCandidateRepositoryDetails(personId: string, repositoryId: string) {
  return getRepositoryFullDetails(personId, repositoryId);
}
