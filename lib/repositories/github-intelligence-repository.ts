/**
 * AI TATHASTU — GITHUB INTELLIGENCE DATA PERSISTENCE REPOSITORY
 *
 * Implements full lifecycle CRUD, idempotent upserts, candidate boundary isolation,
 * snapshot versioning, and analytics queries for all 11 GitHub intelligence tables.
 */

import crypto from "crypto";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  getDb,
  githubProfiles,
  githubProfileSnapshots,
  githubRepositories,
  githubRepositorySnapshots,
  githubCommits,
  githubPullRequests,
  githubIssues,
  githubReleases,
  githubTechnologies,
  githubResumeMatches,
  githubSyncRuns,
} from "@/lib/db";
import type {
  GitHubEnrichedProfile,
  RepositoryDeepDetails,
  ExtractedCommit,
  ExtractedPullRequest,
  ExtractedIssue,
  ExtractedRelease,
} from "@/lib/connectors/github/deep-collector";

export interface SaveProfileParams {
  personId: string;
  profile: GitHubEnrichedProfile;
}

export interface SaveRepoParams {
  personId: string;
  deep: RepositoryDeepDetails;
}

export interface SaveResumeMatchParams {
  personId: string;
  repositoryId: string;
  resumeProjectId?: string;
  resumeProjectTitle: string;
  matchScore: number;
  matchReasons: string[];
  matchedTechnologies: string[];
}

export interface CreateSyncRunParams {
  personId: string;
  username: string;
  trigger: "user_refresh" | "onboarding" | "scheduled" | "api";
}

export interface UpdateSyncRunParams {
  runId: string;
  status: "queued" | "running" | "completed" | "partial" | "failed";
  discoveredReposCount?: number;
  processedReposCount?: number;
  skippedReposCount?: number;
  failedReposCount?: number;
  totalCommitsFetched?: number;
  totalPrsFetched?: number;
  totalIssuesFetched?: number;
  rateLimitRemaining?: number;
  rateLimitResetAt?: Date;
  failedResources?: Array<{ resource: string; error: string; timestamp?: string }>;
  apiCoverage?: Record<string, unknown>;
  checkpoints?: Record<string, unknown>;
  errorMessage?: string;
}

// ============================================================================
// 1. GITHUB PROFILES & SNAPSHOTS
// ============================================================================

export async function upsertGitHubProfile(params: SaveProfileParams) {
  const db = await getDb();
  const { personId, profile } = params;
  const now = new Date();
  const profileId = `ghp_${personId}`;

  const existing = await db
    .select()
    .from(githubProfiles)
    .where(eq(githubProfiles.personId, personId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(githubProfiles)
      .set({
        githubUserId: profile.id,
        username: profile.login,
        displayName: profile.name,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        profileUrl: profile.html_url,
        email: profile.email,
        company: profile.company,
        location: profile.location,
        blog: profile.blog,
        twitterUsername: profile.twitter_username,
        publicRepos: profile.public_repos,
        publicGists: profile.public_gists,
        followers: profile.followers,
        following: profile.following,
        githubCreatedAt: profile.created_at ? new Date(profile.created_at) : undefined,
        githubUpdatedAt: profile.updated_at ? new Date(profile.updated_at) : undefined,
        profileReadme: profile.profile_readme,
        organizations: profile.organizations,
        activitySummary: profile.activity_summary,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(githubProfiles.id, existing[0].id));

    return existing[0].id;
  } else {
    await db.insert(githubProfiles).values({
      id: profileId,
      personId,
      githubUserId: profile.id,
      username: profile.login,
      displayName: profile.name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      profileUrl: profile.html_url,
      email: profile.email,
      company: profile.company,
      location: profile.location,
      blog: profile.blog,
      twitterUsername: profile.twitter_username,
      publicRepos: profile.public_repos,
      publicGists: profile.public_gists,
      followers: profile.followers,
      following: profile.following,
      githubCreatedAt: profile.created_at ? new Date(profile.created_at) : undefined,
      githubUpdatedAt: profile.updated_at ? new Date(profile.updated_at) : undefined,
      profileReadme: profile.profile_readme,
      organizations: profile.organizations,
      activitySummary: profile.activity_summary,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return profileId;
  }
}

export async function createGitHubProfileSnapshot(
  personId: string,
  profileId: string,
  profile: GitHubEnrichedProfile,
  aggregateMetrics: { totalStars: number; totalCommits: number }
) {
  const db = await getDb();
  const id = `ghps_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date();

  await db.insert(githubProfileSnapshots).values({
    id,
    personId,
    profileId,
    snapshotData: profile as any,
    metrics: {
      publicRepos: profile.public_repos,
      followers: profile.followers,
      following: profile.following,
      publicGists: profile.public_gists,
      totalStars: aggregateMetrics.totalStars,
      totalCommits: aggregateMetrics.totalCommits,
      capturedAt: now.toISOString(),
    },
    capturedAt: now,
  });

  return id;
}

// ============================================================================
// 2. GITHUB REPOSITORIES & REPOSITORY SNAPSHOTS
// ============================================================================

export async function upsertGitHubRepository(params: SaveRepoParams) {
  const db = await getDb();
  const { personId, deep } = params;
  const repo = deep.repo;
  const repoRowId = `ghr_${personId}_${repo.id}`;
  const now = new Date();

  const existing = await db
    .select()
    .from(githubRepositories)
    .where(
      and(
        eq(githubRepositories.personId, personId),
        eq(githubRepositories.githubRepoId, repo.id)
      )
    )
    .limit(1);

  const prev = existing[0];

  if (prev) {
    // Detect metric deltas for snapshot
    const starDelta = repo.stars - prev.stars;
    const forkDelta = repo.forks - prev.forks;
    const issueDelta = repo.open_issues - prev.openIssues;

    if (starDelta !== 0 || forkDelta !== 0 || issueDelta !== 0 || prev.checksum !== deep.checksum) {
      const snapId = `ghrs_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      await db.insert(githubRepositorySnapshots).values({
        id: snapId,
        personId,
        repositoryId: prev.id,
        stars: repo.stars,
        forks: repo.forks,
        openIssues: repo.open_issues,
        description: repo.description,
        defaultBranch: repo.default_branch,
        checksum: deep.checksum,
        diffSummary: {
          starDelta,
          forkDelta,
          issueDelta,
          previousChecksum: prev.checksum,
          newChecksum: deep.checksum,
          capturedAt: now.toISOString(),
        },
        capturedAt: now,
      });
    }

    await db
      .update(githubRepositories)
      .set({
        name: repo.name,
        fullName: repo.full_name,
        ownerLogin: repo.owner_login,
        description: repo.description,
        canonicalUrl: repo.html_url,
        homepage: repo.homepage,
        isPrivate: repo.is_private,
        isFork: repo.is_fork,
        isArchived: repo.is_archived,
        isTemplate: repo.is_template,
        isEmpty: repo.is_empty,
        defaultBranch: repo.default_branch,
        primaryLanguage: repo.primary_language,
        languages: deep.languages,
        stars: repo.stars,
        forks: repo.forks,
        watchers: repo.watchers,
        openIssues: repo.open_issues,
        diskUsageKb: repo.disk_usage_kb,
        license: repo.license,
        topics: repo.topics,
        parentRepo: repo.parent_repo || null,
        branches: deep.branches,
        tags: deep.tags,
        workflows: deep.workflows,
        fileStructure: deep.fileStructure,
        manifests: deep.manifests,
        readmeContent: deep.readmeContent,
        projectClassification: deep.projectClassification,
        aiMlCategories: deep.aiMlCategories,
        checksum: deep.checksum,
        firstCommitAt: deep.firstCommitAt ? new Date(deep.firstCommitAt) : undefined,
        lastPushAt: repo.pushed_at ? new Date(repo.pushed_at) : undefined,
        lastSyncedAt: now,
        availabilityStatus: repo.is_archived ? "archived" : "available",
        updatedAt: now,
      })
      .where(eq(githubRepositories.id, prev.id));

    return prev.id;
  } else {
    await db.insert(githubRepositories).values({
      id: repoRowId,
      personId,
      githubRepoId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      ownerLogin: repo.owner_login,
      description: repo.description,
      canonicalUrl: repo.html_url,
      homepage: repo.homepage,
      isPrivate: repo.is_private,
      isFork: repo.is_fork,
      isArchived: repo.is_archived,
      isTemplate: repo.is_template,
      isEmpty: repo.is_empty,
      defaultBranch: repo.default_branch,
      primaryLanguage: repo.primary_language,
      languages: deep.languages,
      stars: repo.stars,
      forks: repo.forks,
      watchers: repo.watchers,
      openIssues: repo.open_issues,
      diskUsageKb: repo.disk_usage_kb,
      license: repo.license,
      topics: repo.topics,
      parentRepo: repo.parent_repo || null,
      branches: deep.branches,
      tags: deep.tags,
      workflows: deep.workflows,
      fileStructure: deep.fileStructure,
      manifests: deep.manifests,
      readmeContent: deep.readmeContent,
      projectClassification: deep.projectClassification,
      aiMlCategories: deep.aiMlCategories,
      checksum: deep.checksum,
      firstCommitAt: deep.firstCommitAt ? new Date(deep.firstCommitAt) : undefined,
      lastPushAt: repo.pushed_at ? new Date(repo.pushed_at) : undefined,
      lastSyncedAt: now,
      availabilityStatus: repo.is_archived ? "archived" : "available",
      createdAt: now,
      updatedAt: now,
    });

    // Initial snapshot
    const snapId = `ghrs_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    await db.insert(githubRepositorySnapshots).values({
      id: snapId,
      personId,
      repositoryId: repoRowId,
      stars: repo.stars,
      forks: repo.forks,
      openIssues: repo.open_issues,
      description: repo.description,
      defaultBranch: repo.default_branch,
      checksum: deep.checksum,
      diffSummary: { initial: true, capturedAt: now.toISOString() },
      capturedAt: now,
    });

    return repoRowId;
  }
}

// ============================================================================
// 3. COMMITS PERSISTENCE & SHA DEDUPLICATION
// ============================================================================

export async function upsertGitHubCommits(
  personId: string,
  repositoryId: string,
  commits: ExtractedCommit[]
) {
  if (commits.length === 0) return 0;
  const db = await getDb();
  const now = new Date();

  // Find existing SHAs for this repository to deduplicate
  const shas = commits.map((c) => c.sha);
  const existingRows = await db
    .select({ sha: githubCommits.sha, id: githubCommits.id })
    .from(githubCommits)
    .where(
      and(
        eq(githubCommits.repositoryId, repositoryId),
        inArray(githubCommits.sha, shas)
      )
    );

  const existingShaSet = new Set(existingRows.map((r) => r.sha));
  let inserted = 0;

  for (const c of commits) {
    if (existingShaSet.has(c.sha)) {
      continue; // SHA is immutable in git
    }
    const commitId = `ghc_${repositoryId}_${c.sha}`;
    await db.insert(githubCommits).values({
      id: commitId,
      personId,
      repositoryId,
      sha: c.sha,
      message: c.message,
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      authorLogin: c.authorLogin,
      authorDate: new Date(c.authorDate),
      committerName: c.committerName,
      committerEmail: c.committerEmail,
      committerLogin: c.committerLogin,
      committerDate: new Date(c.committerDate),
      parents: c.parents,
      additions: c.additions,
      deletions: c.deletions,
      totalChanges: c.totalChanges,
      isAttributedToCandidate: c.isAttributedToCandidate,
      attributionMethod: c.attributionMethod,
      commitUrl: c.commitUrl,
      createdAt: now,
    });
    inserted++;
  }

  return inserted;
}

// ============================================================================
// 4. PULL REQUESTS PERSISTENCE
// ============================================================================

export async function upsertGitHubPullRequests(
  personId: string,
  repositoryId: string,
  prs: ExtractedPullRequest[]
) {
  if (prs.length === 0) return 0;
  const db = await getDb();
  const now = new Date();

  const numbers = prs.map((p) => p.number);
  const existingRows = await db
    .select({ number: githubPullRequests.number, id: githubPullRequests.id })
    .from(githubPullRequests)
    .where(
      and(
        eq(githubPullRequests.repositoryId, repositoryId),
        inArray(githubPullRequests.number, numbers)
      )
    );

  const existingMap = new Map(existingRows.map((r) => [r.number, r.id]));
  let upserted = 0;

  for (const pr of prs) {
    const existingId = existingMap.get(pr.number);
    if (existingId) {
      await db
        .update(githubPullRequests)
        .set({
          title: pr.title,
          state: pr.state,
          body: pr.body,
          htmlUrl: pr.htmlUrl,
          authorLogin: pr.authorLogin,
          isCandidateAuthor: pr.isCandidateAuthor,
          headRef: pr.headRef,
          baseRef: pr.baseRef,
          merged: pr.merged,
          mergedAt: pr.mergedAt ? new Date(pr.mergedAt) : null,
          mergedByLogin: pr.mergedByLogin,
          reviewCommentsCount: pr.reviewCommentsCount,
          commitsCount: pr.commitsCount,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changedFiles,
          labels: pr.labels,
          reviews: pr.reviews,
          updatedAtGitHub: new Date(pr.updatedAtGitHub),
          closedAtGitHub: pr.closedAtGitHub ? new Date(pr.closedAtGitHub) : null,
        })
        .where(eq(githubPullRequests.id, existingId));
    } else {
      const prId = `ghpr_${repositoryId}_${pr.number}`;
      await db.insert(githubPullRequests).values({
        id: prId,
        personId,
        repositoryId,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        body: pr.body,
        htmlUrl: pr.htmlUrl,
        authorLogin: pr.authorLogin,
        isCandidateAuthor: pr.isCandidateAuthor,
        headRef: pr.headRef,
        baseRef: pr.baseRef,
        merged: pr.merged,
        mergedAt: pr.mergedAt ? new Date(pr.mergedAt) : null,
        mergedByLogin: pr.mergedByLogin,
        reviewCommentsCount: pr.reviewCommentsCount,
        commitsCount: pr.commitsCount,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        labels: pr.labels,
        reviews: pr.reviews,
        createdAtGitHub: new Date(pr.createdAtGitHub),
        updatedAtGitHub: new Date(pr.updatedAtGitHub),
        closedAtGitHub: pr.closedAtGitHub ? new Date(pr.closedAtGitHub) : null,
        createdAt: now,
      });
    }
    upserted++;
  }

  return upserted;
}

// ============================================================================
// 5. ISSUES PERSISTENCE
// ============================================================================

export async function upsertGitHubIssues(
  personId: string,
  repositoryId: string,
  issues: ExtractedIssue[]
) {
  if (issues.length === 0) return 0;
  const db = await getDb();
  const now = new Date();

  const numbers = issues.map((i) => i.number);
  const existingRows = await db
    .select({ number: githubIssues.number, id: githubIssues.id })
    .from(githubIssues)
    .where(
      and(
        eq(githubIssues.repositoryId, repositoryId),
        inArray(githubIssues.number, numbers)
      )
    );

  const existingMap = new Map(existingRows.map((r) => [r.number, r.id]));
  let upserted = 0;

  for (const iss of issues) {
    const existingId = existingMap.get(iss.number);
    if (existingId) {
      await db
        .update(githubIssues)
        .set({
          title: iss.title,
          state: iss.state,
          body: iss.body,
          htmlUrl: iss.htmlUrl,
          authorLogin: iss.authorLogin,
          isCandidateAuthor: iss.isCandidateAuthor,
          commentsCount: iss.commentsCount,
          labels: iss.labels,
          assignees: iss.assignees,
          updatedAtGitHub: new Date(iss.updatedAtGitHub),
          closedAtGitHub: iss.closedAtGitHub ? new Date(iss.closedAtGitHub) : null,
        })
        .where(eq(githubIssues.id, existingId));
    } else {
      const issueId = `ghi_${repositoryId}_${iss.number}`;
      await db.insert(githubIssues).values({
        id: issueId,
        personId,
        repositoryId,
        number: iss.number,
        title: iss.title,
        state: iss.state,
        body: iss.body,
        htmlUrl: iss.htmlUrl,
        authorLogin: iss.authorLogin,
        isCandidateAuthor: iss.isCandidateAuthor,
        commentsCount: iss.commentsCount,
        labels: iss.labels,
        assignees: iss.assignees,
        createdAtGitHub: new Date(iss.createdAtGitHub),
        updatedAtGitHub: new Date(iss.updatedAtGitHub),
        closedAtGitHub: iss.closedAtGitHub ? new Date(iss.closedAtGitHub) : null,
        createdAt: now,
      });
    }
    upserted++;
  }

  return upserted;
}

// ============================================================================
// 6. RELEASES PERSISTENCE
// ============================================================================

export async function upsertGitHubReleases(
  personId: string,
  repositoryId: string,
  releases: ExtractedRelease[]
) {
  if (releases.length === 0) return 0;
  const db = await getDb();
  const now = new Date();

  const relIds = releases.map((r) => r.githubReleaseId);
  const existingRows = await db
    .select({ githubReleaseId: githubReleases.githubReleaseId, id: githubReleases.id })
    .from(githubReleases)
    .where(
      and(
        eq(githubReleases.repositoryId, repositoryId),
        inArray(githubReleases.githubReleaseId, relIds)
      )
    );

  const existingMap = new Map(existingRows.map((r) => [r.githubReleaseId, r.id]));
  let upserted = 0;

  for (const rel of releases) {
    const existingId = existingMap.get(rel.githubReleaseId);
    if (existingId) {
      await db
        .update(githubReleases)
        .set({
          tagName: rel.tagName,
          name: rel.name,
          body: rel.body,
          htmlUrl: rel.htmlUrl,
          isPrerelease: rel.isPrerelease,
          isDraft: rel.isDraft,
          publishedAt: rel.publishedAt ? new Date(rel.publishedAt) : null,
        })
        .where(eq(githubReleases.id, existingId));
    } else {
      const rowId = `ghrel_${repositoryId}_${rel.githubReleaseId}`;
      await db.insert(githubReleases).values({
        id: rowId,
        personId,
        repositoryId,
        githubReleaseId: rel.githubReleaseId,
        tagName: rel.tagName,
        name: rel.name,
        body: rel.body,
        htmlUrl: rel.htmlUrl,
        isPrerelease: rel.isPrerelease,
        isDraft: rel.isDraft,
        publishedAt: rel.publishedAt ? new Date(rel.publishedAt) : null,
        createdAt: now,
      });
    }
    upserted++;
  }

  return upserted;
}

// ============================================================================
// 7. TECHNOLOGIES PERSISTENCE
// ============================================================================

export async function upsertGitHubTechnologies(
  personId: string,
  repositoryId: string,
  techFindings: Array<{
    name: string;
    category: string;
    provenance: string;
    sourceFile?: string;
    version?: string;
    confidence: number;
  }>
) {
  if (techFindings.length === 0) return 0;
  const db = await getDb();
  const now = new Date();

  let upserted = 0;
  for (const t of techFindings) {
    const detectionMethod = t.provenance.toLowerCase();
    const existing = await db
      .select({ id: githubTechnologies.id })
      .from(githubTechnologies)
      .where(
        and(
          eq(githubTechnologies.repositoryId, repositoryId),
          eq(githubTechnologies.name, t.name),
          eq(githubTechnologies.detectionMethod, detectionMethod)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(githubTechnologies)
        .set({
          category: t.category.toLowerCase(),
          sourceFile: t.sourceFile,
          version: t.version,
          confidence: t.confidence,
          lastObservedAt: now,
        })
        .where(eq(githubTechnologies.id, existing[0].id));
    } else {
      const rowId = `ght_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      await db.insert(githubTechnologies).values({
        id: rowId,
        personId,
        repositoryId,
        name: t.name,
        category: t.category.toLowerCase(),
        detectionMethod,
        sourceFile: t.sourceFile,
        version: t.version,
        confidence: t.confidence,
        lastObservedAt: now,
        createdAt: now,
      });
    }
    upserted++;
  }

  return upserted;
}

// ============================================================================
// 8. RESUME-TO-GITHUB MATCHES
// ============================================================================

export async function upsertGitHubResumeMatch(params: SaveResumeMatchParams) {
  const db = await getDb();
  const now = new Date();

  const existing = await db
    .select({ id: githubResumeMatches.id })
    .from(githubResumeMatches)
    .where(
      and(
        eq(githubResumeMatches.personId, params.personId),
        eq(githubResumeMatches.repositoryId, params.repositoryId),
        eq(githubResumeMatches.resumeProjectTitle, params.resumeProjectTitle)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(githubResumeMatches)
      .set({
        matchScore: params.matchScore,
        matchReasons: params.matchReasons,
        matchedTechnologies: params.matchedTechnologies,
        resumeProjectId: params.resumeProjectId,
        updatedAt: now,
      })
      .where(eq(githubResumeMatches.id, existing[0].id));
    return existing[0].id;
  } else {
    const rowId = `ghrm_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    await db.insert(githubResumeMatches).values({
      id: rowId,
      personId: params.personId,
      repositoryId: params.repositoryId,
      resumeProjectId: params.resumeProjectId,
      resumeProjectTitle: params.resumeProjectTitle,
      matchScore: params.matchScore,
      matchReasons: params.matchReasons,
      matchedTechnologies: params.matchedTechnologies,
      createdAt: now,
      updatedAt: now,
    });
    return rowId;
  }
}

// ============================================================================
// 9. EXTRACTION RUNS & CHECKPOINTS
// ============================================================================

export async function createGitHubSyncRun(params: CreateSyncRunParams): Promise<string> {
  const db = await getDb();
  const runId = `ghsr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date();

  await db.insert(githubSyncRuns).values({
    id: runId,
    personId: params.personId,
    username: params.username,
    trigger: params.trigger,
    status: "running",
    startedAt: now,
    discoveredReposCount: 0,
    processedReposCount: 0,
    skippedReposCount: 0,
    failedReposCount: 0,
    totalCommitsFetched: 0,
    totalPrsFetched: 0,
    totalIssuesFetched: 0,
    failedResources: [],
    apiCoverage: { started: now.toISOString() },
    checkpoints: {},
    createdAt: now,
  });

  return runId;
}

export async function updateGitHubSyncRun(params: UpdateSyncRunParams): Promise<void> {
  const db = await getDb();
  const now = new Date();

  const updateFields: any = {
    status: params.status,
  };

  if (params.status === "completed" || params.status === "failed" || params.status === "partial") {
    updateFields.completedAt = now;
  }
  if (params.discoveredReposCount !== undefined) updateFields.discoveredReposCount = params.discoveredReposCount;
  if (params.processedReposCount !== undefined) updateFields.processedReposCount = params.processedReposCount;
  if (params.skippedReposCount !== undefined) updateFields.skippedReposCount = params.skippedReposCount;
  if (params.failedReposCount !== undefined) updateFields.failedReposCount = params.failedReposCount;
  if (params.totalCommitsFetched !== undefined) updateFields.totalCommitsFetched = params.totalCommitsFetched;
  if (params.totalPrsFetched !== undefined) updateFields.totalPrsFetched = params.totalPrsFetched;
  if (params.totalIssuesFetched !== undefined) updateFields.totalIssuesFetched = params.totalIssuesFetched;
  if (params.rateLimitRemaining !== undefined) updateFields.rateLimitRemaining = params.rateLimitRemaining;
  if (params.rateLimitResetAt !== undefined) updateFields.rateLimitResetAt = params.rateLimitResetAt;
  if (params.failedResources !== undefined) updateFields.failedResources = params.failedResources;
  if (params.apiCoverage !== undefined) updateFields.apiCoverage = params.apiCoverage;
  if (params.checkpoints !== undefined) updateFields.checkpoints = params.checkpoints;
  if (params.errorMessage !== undefined) updateFields.errorMessage = params.errorMessage;

  await db
    .update(githubSyncRuns)
    .set(updateFields)
    .where(eq(githubSyncRuns.id, params.runId));
}

export async function getActiveGitHubSyncRun(personId: string) {
  const db = await getDb();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const rows = await db
    .select()
    .from(githubSyncRuns)
    .where(
      and(
        eq(githubSyncRuns.personId, personId),
        eq(githubSyncRuns.status, "running")
      )
    )
    .orderBy(desc(githubSyncRuns.startedAt))
    .limit(1);

  if (rows.length > 0 && rows[0].startedAt && rows[0].startedAt > fiveMinutesAgo) {
    return rows[0];
  }
  return null;
}

// ============================================================================
// 10. COMPREHENSIVE INTELLIGENCE QUERIES (CANDIDATE BOUNDARY ENFORCED)
// ============================================================================

export async function getGitHubIntelligenceByPerson(personId: string) {
  const db = await getDb();

  const [
    profileRows,
    repos,
    recentRuns,
    profileSnapshots,
    commits,
    prs,
    issues,
    releases,
    technologies,
    resumeMatches,
  ] = await Promise.all([
    db.select().from(githubProfiles).where(eq(githubProfiles.personId, personId)).limit(1),
    db.select().from(githubRepositories).where(eq(githubRepositories.personId, personId)).orderBy(desc(githubRepositories.stars)),
    db.select().from(githubSyncRuns).where(eq(githubSyncRuns.personId, personId)).orderBy(desc(githubSyncRuns.startedAt)).limit(5),
    db.select().from(githubProfileSnapshots).where(eq(githubProfileSnapshots.personId, personId)).orderBy(desc(githubProfileSnapshots.capturedAt)).limit(10),
    db.select().from(githubCommits).where(eq(githubCommits.personId, personId)).orderBy(desc(githubCommits.authorDate)).limit(500),
    db.select().from(githubPullRequests).where(eq(githubPullRequests.personId, personId)).orderBy(desc(githubPullRequests.createdAtGitHub)).limit(100),
    db.select().from(githubIssues).where(eq(githubIssues.personId, personId)).orderBy(desc(githubIssues.createdAtGitHub)).limit(100),
    db.select().from(githubReleases).where(eq(githubReleases.personId, personId)).orderBy(desc(githubReleases.publishedAt)).limit(50),
    db.select().from(githubTechnologies).where(eq(githubTechnologies.personId, personId)),
    db.select().from(githubResumeMatches).where(eq(githubResumeMatches.personId, personId)),
  ]);

  const profile = profileRows[0] || null;

  // Aggregate commit metrics across all repositories
  const totalCommits = commits.length;
  let candidateAttributedCommits = 0;
  let commitsLast30Days = 0;
  let commitsLast90Days = 0;
  let commitsLast365Days = 0;
  const nowMs = Date.now();
  const ms30 = 30 * 86400000;
  const ms90 = 90 * 86400000;
  const ms365 = 365 * 86400000;

  for (const c of commits) {
    if (c.isAttributedToCandidate) candidateAttributedCommits++;
    const t = c.authorDate.getTime();
    if (nowMs - t <= ms30) commitsLast30Days++;
    if (nowMs - t <= ms90) commitsLast90Days++;
    if (nowMs - t <= ms365) commitsLast365Days++;
  }

  // Language aggregation across repos
  const languageTotals: Record<string, number> = {};
  for (const r of repos) {
    const langs = (r.languages || {}) as Record<string, number>;
    for (const [lang, bytes] of Object.entries(langs)) {
      languageTotals[lang] = (languageTotals[lang] || 0) + Number(bytes);
    }
  }

  return {
    profile,
    latestSyncRun: recentRuns[0] || null,
    recentSyncRuns: recentRuns,
    profileSnapshots,
    repositoriesCount: repos.length,
    repositories: repos,
    commitAnalytics: {
      totalAccessibleCommits: totalCommits,
      candidateAttributedCommits,
      externalContributorCommits: totalCommits - candidateAttributedCommits,
      commitsLast30Days,
      commitsLast90Days,
      commitsLast365Days,
    },
    languageTotals,
    pullRequests: prs,
    issues,
    releases,
    technologies,
    resumeMatches,
  };
}

export async function getRepositoryFullDetails(personId: string, repositoryId: string) {
  const db = await getDb();

  const repoRows = await db
    .select()
    .from(githubRepositories)
    .where(
      and(
        eq(githubRepositories.personId, personId),
        eq(githubRepositories.id, repositoryId)
      )
    )
    .limit(1);

  if (repoRows.length === 0) return null;
  const repo = repoRows[0];

  const [commits, prs, issues, releases, technologies, snapshots, resumeMatches] = await Promise.all([
    db.select().from(githubCommits).where(and(eq(githubCommits.personId, personId), eq(githubCommits.repositoryId, repositoryId))).orderBy(desc(githubCommits.authorDate)),
    db.select().from(githubPullRequests).where(and(eq(githubPullRequests.personId, personId), eq(githubPullRequests.repositoryId, repositoryId))).orderBy(desc(githubPullRequests.createdAtGitHub)),
    db.select().from(githubIssues).where(and(eq(githubIssues.personId, personId), eq(githubIssues.repositoryId, repositoryId))).orderBy(desc(githubIssues.createdAtGitHub)),
    db.select().from(githubReleases).where(and(eq(githubReleases.personId, personId), eq(githubReleases.repositoryId, repositoryId))).orderBy(desc(githubReleases.publishedAt)),
    db.select().from(githubTechnologies).where(and(eq(githubTechnologies.personId, personId), eq(githubTechnologies.repositoryId, repositoryId))),
    db.select().from(githubRepositorySnapshots).where(and(eq(githubRepositorySnapshots.personId, personId), eq(githubRepositorySnapshots.repositoryId, repositoryId))).orderBy(desc(githubRepositorySnapshots.capturedAt)),
    db.select().from(githubResumeMatches).where(and(eq(githubResumeMatches.personId, personId), eq(githubResumeMatches.repositoryId, repositoryId))),
  ]);

  return {
    repository: repo,
    commits,
    pullRequests: prs,
    issues,
    releases,
    technologies,
    snapshots,
    resumeMatches,
  };
}
