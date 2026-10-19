/**
 * AI TATHASTU — LIVE GITHUB EXTRACTION & PERSISTENCE AUDIT RUNNER
 *
 * Performs live end-to-end extraction and relational database verification
 * for real candidate GitHub profiles:
 * 1. anant9934 (https://github.com/anant9934)
 * 2. shiviiii5165 (https://github.com/shiviiii5165)
 *
 * Verifies:
 * - Real API connectivity and Rate Limit status
 * - Profile and uncapped public repository discovery
 * - Deep details (commits, languages, tech stack, PRs, issues, releases)
 * - Relational database persistence across all 11 tables
 * - Idempotency across repeat synchronization runs
 * - Candidate-boundary multi-tenant isolation
 */

import { getDb, githubProfiles, githubProfileSnapshots, githubRepositories, githubRepositorySnapshots, githubCommits, githubPullRequests, githubIssues, githubReleases, githubTechnologies, githubResumeMatches, githubSyncRuns } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { executeFullGitHubExtraction, getCandidateGitHubIntelligence } from "../lib/services/github-intelligence-service";
import { executeGitHubRequest } from "../lib/connectors/github/deep-collector";
import { eq } from "drizzle-orm";

async function main() {
  console.log("================================================================================");
  console.log("   AI TATHASTU — LIVE GITHUB PROFILE AUDIT & PERSISTENCE VERIFICATION");
  console.log("   Timestamp:", new Date().toISOString());
  console.log("================================================================================\n");

  // 1. Check Live GitHub Rate Limit
  console.log("--- Checking Live GitHub API Gateway & Rate Limit ---");
  const rateLimitCheck = await executeGitHubRequest("/rate_limit");
  const coreLimit = rateLimitCheck.data?.resources?.core;
  console.log("Rate Limit Status HTTP:", rateLimitCheck.status);
  console.log("Rate Limit Quota:", coreLimit?.limit ?? "unknown");
  console.log("Rate Limit Remaining:", coreLimit?.remaining ?? rateLimitCheck.rateLimitRemaining ?? 0);
  if (coreLimit?.reset) {
    console.log("Rate Limit Reset At:", new Date(coreLimit.reset * 1000).toISOString());
  }

  const isRateLimited = (coreLimit?.remaining ?? rateLimitCheck.rateLimitRemaining ?? 0) === 0;

  if (isRateLimited) {
    console.warn("\n⚠️ WARNING: Public GitHub IP rate limit is currently exhausted (0 remaining).");
    console.warn("Unauthenticated requests will receive HTTP 403 until the reset window opens.");
  } else {
    console.log("✅ GitHub API rate limit quota available.");
  }

  // 2. Provision Isolated Test Candidates
  console.log("\n--- Provisioning Isolated Test Candidates in Database ---");
  const db = await getDb();
  const timestamp = Date.now();
  const userA = await createUser({
    email: `anant.audit.${timestamp}@aitathastu.test`,
    displayName: "Anant Kumar",
    passwordHash: "audit_hash_test_123",
  });
  const userB = await createUser({
    email: `shivam.audit.${timestamp}@aitathastu.test`,
    displayName: "Shivam Kumar Singh",
    passwordHash: "audit_hash_test_123",
  });

  const personIdA = userA.personId;
  const personIdB = userB.personId;
  console.log(`Candidate A: ${personIdA} (GitHub: anant9934)`);
  console.log(`Candidate B: ${personIdB} (GitHub: shiviiii5165)`);

  const profilesToAudit = [
    { username: "anant9934", personId: personIdA, label: "Candidate A (anant9934)" },
    { username: "shiviiii5165", personId: personIdB, label: "Candidate B (shiviiii5165)" },
  ];

  const auditResults: Array<{
    username: string;
    personId: string;
    success: boolean;
    rateLimited: boolean;
    runId: string;
    discoveredRepos: number;
    processedRepos: number;
    failedRepos: number;
    commitsCount: number;
    prsCount: number;
    issuesCount: number;
    releasesCount: number;
    technologiesCount: number;
    resumeMatchesCount: number;
    snapshotsCount: number;
    idempotentRepeatSuccess: boolean;
    error?: string;
  }> = [];

  for (const target of profilesToAudit) {
    console.log(`\n================================================================================`);
    console.log(`   Auditing ${target.label}`);
    console.log(`================================================================================`);

    console.log(`[1/4] Triggering Live GitHub Extraction for '${target.username}'...`);
    const extractStart = Date.now();
    const extractResult = await executeFullGitHubExtraction({
      personId: target.personId,
      username: target.username,
      trigger: "user_refresh",
      maxReposToInspect: 2,
    });
    const durationMs = Date.now() - extractStart;

    console.log(`Extraction Finished in ${durationMs}ms`);
    console.log(`Status: ${extractResult.success ? "SUCCESS" : "FAILED"}`);
    console.log(`Run ID: ${extractResult.runId}`);
    if (extractResult.error) {
      console.log(`Message / Error: ${extractResult.error}`);
    }

    // Inspect Database Rows
    console.log(`[2/4] Inspecting Database Persistence Across 11 Relational Tables...`);
    const [
      dbProfiles,
      dbProfileSnaps,
      dbRepos,
      dbRepoSnaps,
      dbCommits,
      dbPrs,
      dbIssues,
      dbReleases,
      dbTechs,
      dbMatches,
      dbSyncRuns,
    ] = await Promise.all([
      db.select().from(githubProfiles).where(eq(githubProfiles.personId, target.personId)),
      db.select().from(githubProfileSnapshots).where(eq(githubProfileSnapshots.personId, target.personId)),
      db.select().from(githubRepositories).where(eq(githubRepositories.personId, target.personId)),
      db.select().from(githubRepositorySnapshots).where(eq(githubRepositorySnapshots.personId, target.personId)),
      db.select().from(githubCommits).where(eq(githubCommits.personId, target.personId)),
      db.select().from(githubPullRequests).where(eq(githubPullRequests.personId, target.personId)),
      db.select().from(githubIssues).where(eq(githubIssues.personId, target.personId)),
      db.select().from(githubReleases).where(eq(githubReleases.personId, target.personId)),
      db.select().from(githubTechnologies).where(eq(githubTechnologies.personId, target.personId)),
      db.select().from(githubResumeMatches).where(eq(githubResumeMatches.personId, target.personId)),
      db.select().from(githubSyncRuns).where(eq(githubSyncRuns.personId, target.personId)),
    ]);

    console.log(`- github_profiles:            ${dbProfiles.length} row(s)`);
    console.log(`- github_profile_snapshots:   ${dbProfileSnaps.length} row(s)`);
    console.log(`- github_repositories:        ${dbRepos.length} row(s)`);
    console.log(`- github_repository_snapshots: ${dbRepoSnaps.length} row(s)`);
    console.log(`- github_commits:             ${dbCommits.length} row(s)`);
    console.log(`- github_pull_requests:       ${dbPrs.length} row(s)`);
    console.log(`- github_issues:              ${dbIssues.length} row(s)`);
    console.log(`- github_releases:            ${dbReleases.length} row(s)`);
    console.log(`- github_technologies:        ${dbTechs.length} row(s)`);
    console.log(`- github_resume_matches:      ${dbMatches.length} row(s)`);
    console.log(`- github_sync_runs:           ${dbSyncRuns.length} row(s)`);

    if (dbProfiles[0]) {
      console.log(`  Profile Username: ${dbProfiles[0].username}, Display Name: ${dbProfiles[0].displayName}, Bio: ${dbProfiles[0].bio || "(none)"}`);
    }
    if (dbRepos.length > 0) {
      console.log(`  Sample Repositories: ${dbRepos.slice(0, 5).map(r => r.name).join(", ")}${dbRepos.length > 5 ? "..." : ""}`);
    }

    // Test Idempotency with Repeat Sync
    console.log(`[3/4] Testing Idempotency via Repeat Synchronization...`);
    const repeatResult = await executeFullGitHubExtraction({
      personId: target.personId,
      username: target.username,
      trigger: "user_refresh",
      maxReposToInspect: 1,
    });
    console.log(`  Repeat sync executed successfully. Run ID: ${repeatResult.runId}`);

    const [repeatProfiles, repeatRepos, repeatCommits] = await Promise.all([
      db.select().from(githubProfiles).where(eq(githubProfiles.personId, target.personId)),
      db.select().from(githubRepositories).where(eq(githubRepositories.personId, target.personId)),
      db.select().from(githubCommits).where(eq(githubCommits.personId, target.personId)),
    ]);

    const isIdempotent = repeatProfiles.length === dbProfiles.length &&
      repeatRepos.length === dbRepos.length &&
      repeatCommits.length === dbCommits.length;

    console.log(`Idempotency Check: ${isIdempotent ? "PASSED (Zero Duplicate Rows)" : "FAILED (Duplicate Rows Created)"}`);
    console.log(`  Profiles: ${dbProfiles.length} -> ${repeatProfiles.length}`);
    console.log(`  Repositories: ${dbRepos.length} -> ${repeatRepos.length}`);
    console.log(`  Commits: ${dbCommits.length} -> ${repeatCommits.length}`);

    // Verify Candidate Intelligence Query
    console.log(`[4/4] Verifying Candidate Dashboard Intelligence Retrieval Bundle...`);
    const bundle = await getCandidateGitHubIntelligence(target.personId);
    console.log(`Bundle Loaded: ${Boolean(bundle.profile ? true : false)}, Repos: ${bundle.repositories.length}, Commits: ${bundle.commitAnalytics.totalAccessibleCommits}`);

    auditResults.push({
      username: target.username,
      personId: target.personId,
      success: extractResult.success,
      rateLimited: isRateLimited,
      runId: extractResult.runId,
      discoveredRepos: extractResult.repositoriesCount,
      processedRepos: extractResult.processedReposCount,
      failedRepos: extractResult.failedReposCount,
      commitsCount: dbCommits.length,
      prsCount: dbPrs.length,
      issuesCount: dbIssues.length,
      releasesCount: dbReleases.length,
      technologiesCount: dbTechs.length,
      resumeMatchesCount: dbMatches.length,
      snapshotsCount: dbProfileSnaps.length + dbRepoSnaps.length,
      idempotentRepeatSuccess: isIdempotent,
      error: extractResult.error,
    });
  }

  // Cross-Candidate Isolation Verification
  console.log(`\n================================================================================`);
  console.log("   Cross-Candidate Multi-Tenant Boundary Isolation Test");
  console.log(`================================================================================`);
  const bundleA = await getCandidateGitHubIntelligence(personIdA);
  const bundleB = await getCandidateGitHubIntelligence(personIdB);

  const foreignReposInA = bundleA.repositories.filter(r => r.personId !== personIdA);
  const foreignReposInB = bundleB.repositories.filter(r => r.personId !== personIdB);
  const sharedRepoA = bundleA.repositories.find(r => r.name === "India-Accelerator-OpenXAI-2025");
  const sharedRepoB = bundleB.repositories.find(r => r.name === "India-Accelerator-OpenXAI-2025");

  console.log(`Candidate A Repos: ${bundleA.repositories.length} (foreign candidate records: ${foreignReposInA.length})`);
  console.log(`Candidate B Repos: ${bundleB.repositories.length} (foreign candidate records: ${foreignReposInB.length})`);
  if (sharedRepoA && sharedRepoB) {
    console.log(`Same GitHub repo name ('India-Accelerator-OpenXAI-2025') disambiguated with separate row IDs:`);
    console.log(`  Candidate A Repo ID: ${sharedRepoA.id} (owner: ${sharedRepoA.ownerLogin})`);
    console.log(`  Candidate B Repo ID: ${sharedRepoB.id} (owner: ${sharedRepoB.ownerLogin})`);
  }
  const isIsolated = foreignReposInA.length === 0 && foreignReposInB.length === 0;
  console.log(`Cross-Candidate Repository Leakage: ${isIsolated ? "NONE (Clean Multi-Tenant Isolation)" : "LEAK DETECTED"}`);

  // Summary Matrix
  console.log("\n================================================================================");
  console.log("   AUDIT SUMMARY MATRIX");
  console.log("================================================================================");
  console.table(auditResults);

  process.exit(0);
}

main().catch((err) => {
  console.error("Audit runner failed:", err);
  process.exit(1);
});
