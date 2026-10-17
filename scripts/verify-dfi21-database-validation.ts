/**
 * AI TATHASTU — PHASE DFI-2.1
 * SECTION 8: DATABASE VALIDATION SUITE
 *
 * Verifies data persistence, schema integrity, and learner isolation across:
 * 1. Live Neon PostgreSQL Serverless database (using non-destructive disposable learner records)
 * 2. Embedded PGlite engine (in-memory mode)
 *
 * Checks:
 * - external_connections persistence and columns
 * - source_snapshots persistence, JSONB integrity, and SHA-256 checksum
 * - evidence_items persistence, learner ownership, and unverified status rules
 * - Foreign key cascading and clean disposal
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  getDb,
  resetDbForTesting,
  closeDbForTesting,
  users,
  persons,
  externalConnections,
  sourceSnapshots,
  evidenceItems,
  onboardingDrafts,
} from "../lib/db";

interface TestReport {
  target: "Neon PostgreSQL" | "PGlite In-Memory";
  assertions: number;
  passed: number;
  failed: number;
  errors: string[];
}

async function validateDatabase(targetName: "Neon PostgreSQL" | "PGlite In-Memory"): Promise<TestReport> {
  const report: TestReport = {
    target: targetName,
    assertions: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  function assert(condition: boolean, desc: string) {
    report.assertions++;
    if (condition) {
      report.passed++;
      console.log(`  [PASS] [${targetName}] ${desc}`);
    } else {
      report.failed++;
      report.errors.push(desc);
      console.error(`  [FAIL] [${targetName}] ${desc}`);
    }
  }

  console.log(`\n================================================================================`);
  console.log(`   VALIDATING DATABASE ENGINE: ${targetName}`);
  console.log(`================================================================================`);

  const db = await getDb();
  const runId = crypto.randomBytes(4).toString("hex");
  const testUserId = `usr_dfi21_test_${runId}`;
  const testPersonId = `pers_dfi21_test_${runId}`;
  const testEmail = `dfi21_test_${runId}@tathastu.test`;
  const testConnId = `conn_dfi21_test_${runId}`;
  const testSnapId = `snap_dfi21_test_${runId}`;
  const testEvidId = `evid_dfi21_test_${runId}`;

  try {
    // 1. Create disposable user and person record
    await db.insert(users).values({
      id: testUserId,
      email: testEmail,
      passwordHash: "scrypt:dummy_test_hash",
    });

    await db.insert(persons).values({
      id: testPersonId,
      primaryUserId: testUserId,
      displayName: `DFI-2.1 Test Student ${runId}`,
    });

    const [pers] = await db.select().from(persons).where(eq(persons.id, testPersonId));
    assert(Boolean(pers && pers.id === testPersonId), `Created test person record: ${testPersonId}`);

    // 2. Persist external_connections row
    await db.insert(externalConnections).values({
      id: testConnId,
      personId: testPersonId,
      provider: "github",
      externalAccountId: "583231",
      externalUsername: "octocat",
      displayName: "The Octocat",
      profileUrl: "https://github.com/octocat",
      status: "connected",
      scopes: ["read:public_repo"],
      metadata: {
        publicRepos: 8,
        followers: 12000,
        verifiedSource: true,
      },
      lastSyncedAt: new Date(),
    });

    const [conn] = await db.select().from(externalConnections).where(eq(externalConnections.id, testConnId));
    assert(Boolean(conn), `Persisted external_connections row`);
    assert(conn?.personId === testPersonId, `Connection personId matches test learner`);
    assert(conn?.provider === "github", `Connection provider is 'github'`);
    assert(conn?.externalUsername === "octocat", `Connection username is 'octocat'`);
    assert(conn?.status === "connected", `Connection status is 'connected'`);
    assert((conn?.metadata as Record<string, unknown>)?.publicRepos === 8, `Connection metadata JSONB matches`);

    // 3. Persist source_snapshots row with real SHA-256 checksum
    const rawSnapshotPayload = {
      repos: [
        {
          name: "Spoon-Knife",
          full_name: "octocat/Spoon-Knife",
          description: "This repo is for spoon-knife experiments",
          stargazers_count: 12500,
          language: "C",
          html_url: "https://github.com/octocat/Spoon-Knife",
          topics: ["git", "tutorial"],
        },
      ],
      fetchedAt: new Date().toISOString(),
    };
    const payloadStr = JSON.stringify(rawSnapshotPayload);
    const expectedChecksum = crypto.createHash("sha256").update(payloadStr).digest("hex");

    await db.insert(sourceSnapshots).values({
      id: testSnapId,
      personId: testPersonId,
      source: "github",
      sourceReference: "https://github.com/octocat",
      snapshotData: rawSnapshotPayload,
      checksum: expectedChecksum,
    });

    const [snap] = await db.select().from(sourceSnapshots).where(eq(sourceSnapshots.id, testSnapId));
    assert(Boolean(snap), `Persisted source_snapshots row`);
    assert(snap?.personId === testPersonId, `Snapshot personId matches test learner`);
    assert(snap?.source === "github", `Snapshot source is 'github'`);
    assert(snap?.checksum === expectedChecksum, `Snapshot SHA-256 checksum matches exact hash of payload`);
    const snapData = snap?.snapshotData as { repos?: Array<{ name: string }> };
    assert(snapData?.repos?.[0]?.name === "Spoon-Knife", `Snapshot JSONB deserialized properly`);

    // 4. Persist evidence_items row linked to test learner
    await db.insert(evidenceItems).values({
      id: testEvidId,
      personId: testPersonId,
      category: "project",
      subject: "Spoon-Knife",
      value: "octocat/Spoon-Knife repository with 12500 stars",
      source: "github",
      verificationStatus: "unverified", // CRITICAL: Section 5 requirement
      sourceReference: "https://github.com/octocat/Spoon-Knife",
      interpretation: "Open-source GitHub repository contribution",
      whyItMatters: "Demonstrates practical version control and collaboration skills",
      importKey: `gh_octocat_spoonknife_${runId}`,
      originSource: "github",
      confidenceScore: 0.85,
      editable: true,
      portfolioIncluded: false,
    });

    const [evid] = await db.select().from(evidenceItems).where(eq(evidenceItems.id, testEvidId));
    assert(Boolean(evid), `Persisted evidence_items row`);
    assert(evid?.personId === testPersonId, `Evidence item personId matches test learner`);
    assert(evid?.verificationStatus === "unverified", `Evidence item correctly marked 'unverified' prior to review`);
    assert(evid?.originSource === "github", `Evidence originSource recorded as 'github'`);
    assert(evid?.confidenceScore === 0.85, `Evidence confidenceScore saved`);

    // 5. Test onboarding_drafts row persistence
    await db.insert(onboardingDrafts).values({
      personId: testPersonId,
      draft: {
        step: 5.5,
        profiles: {
          github: "octocat",
          devto: "ben",
        },
      },
      revision: 1,
      systemEntries: {},
    });

    const [draft] = await db.select().from(onboardingDrafts).where(eq(onboardingDrafts.personId, testPersonId));
    assert(Boolean(draft), `Persisted onboarding_drafts row`);
    assert(draft?.personId === testPersonId, `Draft personId matches test learner`);
    assert((draft?.draft as Record<string, unknown>)?.step === 5.5, `Draft JSONB step preserved`);

    // 6. Test Non-Destructive Cleanup & Cascade
    const { deleteAccountCompletely } = await import("../lib/services/guest-cleanup-service");
    await deleteAccountCompletely(testUserId);

    const [remPers] = await db.select().from(persons).where(eq(persons.id, testPersonId));
    const [remConn] = await db.select().from(externalConnections).where(eq(externalConnections.id, testConnId));
    const [remSnap] = await db.select().from(sourceSnapshots).where(eq(sourceSnapshots.id, testSnapId));
    const [remEvid] = await db.select().from(evidenceItems).where(eq(evidenceItems.id, testEvidId));
    const [remDraft] = await db.select().from(onboardingDrafts).where(eq(onboardingDrafts.personId, testPersonId));

    assert(!remPers, `Deleted person on user removal`);
    assert(!remConn, `Deleted external_connections on account removal`);
    assert(!remSnap, `Deleted source_snapshots on account removal`);
    assert(!remEvid, `Deleted evidence_items on account removal`);
    assert(!remDraft, `Deleted onboarding_draft on account removal`);
  } catch (err) {
    report.failed++;
    const errMsg = err instanceof Error ? err.message : String(err);
    report.errors.push(errMsg);
    console.error(`  [ERROR] [${targetName}] Exception:`, errMsg);
  }

  return report;
}

async function main() {
  console.log("================================================================================");
  console.log("   AI TATHASTU — PHASE DFI-2.1: SECTION 8 DATABASE VALIDATION");
  console.log("   Neon PostgreSQL Serverless & PGlite Embedded Isolation Verification");
  console.log("================================================================================");

  // 1. Neon PostgreSQL Serverless validation
  process.env.DATABASE_MODE = "postgres";
  const neonReport = await validateDatabase("Neon PostgreSQL");
  await closeDbForTesting();

  // 2. Embedded PGlite In-Memory validation
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.DATABASE_MODE = "pglite";
  process.env.PGLITE_IN_MEMORY = "true";
  resetDbForTesting();
  const pgliteReport = await validateDatabase("PGlite In-Memory");
  await closeDbForTesting();

  console.log("\n================================================================================");
  console.log("   DATABASE VALIDATION SUMMARY");
  console.log("================================================================================");
  console.log(`Neon PostgreSQL:   ${neonReport.passed}/${neonReport.assertions} PASSED (${neonReport.failed} failed)`);
  console.log(`PGlite In-Memory:  ${pgliteReport.passed}/${pgliteReport.assertions} PASSED (${pgliteReport.failed} failed)`);

  const totalPassed = neonReport.passed + pgliteReport.passed;
  const totalAssertions = neonReport.assertions + pgliteReport.assertions;
  const totalFailed = neonReport.failed + pgliteReport.failed;

  console.log(`Total:             ${totalPassed}/${totalAssertions} PASSED (100% target)`);
  console.log("================================================================================\n");

  if (totalFailed > 0) {
    console.error("FATAL: Database validation failed with errors:");
    if (neonReport.errors.length) console.error("Neon errors:", neonReport.errors);
    if (pgliteReport.errors.length) console.error("PGlite errors:", pgliteReport.errors);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
