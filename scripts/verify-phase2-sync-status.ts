/**
 * Phase 2 contract: one status endpoint drives every progress UI (Tasks 2.1.3,
 * 2.1.10). The CV's source_processing_jobs row is folded into the sync-status
 * shape, and every source carries a plain "what we found" line.
 *
 *   node --import tsx --test scripts/verify-phase2-sync-status.ts
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";

let db: Awaited<ReturnType<typeof setupTestDatabase>>;
before(async () => { db = await setupTestDatabase(); });
after(async () => { const { closeDbForTesting } = await import("../lib/db"); await closeDbForTesting(); });

async function addResumeJob(personId: string, status: string, stage: string, metadata: Record<string, unknown> = {}) {
  const { sourceProcessingJobs } = await import("../lib/db");
  const id = crypto.randomUUID();
  await db.insert(sourceProcessingJobs).values({ id, personId, sourceId: "resume", stage, status, metadata });
  return id;
}

describe("2.1.10 sync-status aggregation includes the CV", () => {
  test("no CV job: resume is not_started", async () => {
    const { getSyncStatus } = await import("../lib/sync/runners");
    const personId = await createTestPerson("p2-none");
    const status = await getSyncStatus(personId);
    assert.equal(status.sources.find((s) => s.source === "resume")?.state, "not_started");
    assert.equal(status.aggregate.status, "not_started");
  });

  test("a running CV job shows as running with its stage, and keeps onboarding in progress", async () => {
    const { getSyncStatus } = await import("../lib/sync/runners");
    const personId = await createTestPerson("p2-run");
    await addResumeJob(personId, "running", "awaiting_extractor");
    const status = await getSyncStatus(personId);
    const resume = status.sources.find((s) => s.source === "resume") as { state: string; stage?: string; reason?: string | null };
    assert.equal(resume.state, "running");
    assert.equal(resume.stage, "awaiting_extractor");
    assert.match(resume.reason ?? "", /waking up/);
    assert.equal(status.aggregate.status, "in_progress");
    assert.equal(status.aggregate.canProceed, true);
  });

  test("a finished CV job is succeeded with a found count; failures are plain-language and not retryable", async () => {
    const { getSyncStatus } = await import("../lib/sync/runners");
    const { sourceProcessingJobs } = await import("../lib/db");
    const personId = await createTestPerson("p2-done");
    const jobId = await addResumeJob(personId, "review_ready", "review", { candidates: 14 });
    let resume = (await getSyncStatus(personId)).sources.find((s) => s.source === "resume") as { state: string; found?: string | null; canRetry: boolean };
    assert.equal(resume.state, "succeeded");
    assert.equal(resume.found, "14 items found");

    await db.update(sourceProcessingJobs).set({ status: "failed", errorMessage: "ocr crashed" }).where(eq(sourceProcessingJobs.id, jobId));
    const status = await getSyncStatus(personId);
    resume = status.sources.find((s) => s.source === "resume") as typeof resume & { reason?: string };
    assert.equal(resume.state, "failed");
    assert.equal(resume.canRetry, false);
    assert.doesNotMatch((resume as { reason?: string }).reason ?? "", /ocr crashed/);
    assert.equal(status.aggregate.status, "completed_with_issues");
  });

  test("another person's CV job never appears", async () => {
    const { getSyncStatus } = await import("../lib/sync/runners");
    const owner = await createTestPerson("p2-owner");
    const other = await createTestPerson("p2-other");
    await addResumeJob(owner, "running", "extract");
    assert.equal((await getSyncStatus(other)).sources.find((s) => s.source === "resume")?.state, "not_started");
  });
});

describe("2.1.10 found lines", () => {
  test("each source summarises its own result fields", async () => {
    const { describeFound } = await import("../lib/sync/runners");
    assert.equal(describeFound("github", { recordsFetched: 6 }), "6 repositories read");
    assert.equal(describeFound("github", { recordsFetched: 1 }), "1 repository read");
    assert.equal(describeFound("scholar", { papers: 3 }), "3 papers found");
    assert.equal(describeFound("kaggle", { datasets: 2, notebooks: 1 }), "2 datasets, 1 notebook");
    assert.equal(describeFound("leetcode", { totalSolved: 312 }), "312 problems solved");
    assert.equal(describeFound("hackerrank", { badges: 4 }), "4 badges");
    assert.equal(describeFound("linkedin", { experiences: 2, educations: 1 }), "2 roles, 1 school");
    assert.equal(describeFound("leetcode", { servedFromCache: true }), "Showing your last saved import");
    assert.equal(describeFound("github", {}), null);
  });
});
