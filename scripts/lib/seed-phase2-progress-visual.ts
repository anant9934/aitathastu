/**
 * Local-only fixture for visually checking the onboarding progress screen
 * (Tasks 2.1.3, 2.1.10). Creates a student parked on Screen 7 with a CV
 * still reading, GitHub importing, LinkedIn waiting on a code, Kaggle dead-
 * lettered and LeetCode done. `settle <personId>` then finishes CV + GitHub
 * so the screen's own move to review can be watched.
 *
 *   node --import tsx scripts/lib/seed-phase2-progress-visual.ts
 *   node --import tsx scripts/lib/seed-phase2-progress-visual.ts settle <personId>
 *   node --import tsx scripts/lib/seed-phase2-progress-visual.ts slow   (GitHub never settles)
 */
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { useTestDatabase } from "./test-db";

async function seed(slow = false) {
  const db = await useTestDatabase();
  const { syncOperations, sourceProcessingJobs } = await import("../../lib/db");
  const { createUser } = await import("../../lib/repositories/user-repository");
  const { hashPassword } = await import("../../lib/auth/password");
  const { writeOnboardingDraft } = await import("../../lib/services/onboarding-v2-service");
  const email = `p2-visual-${Date.now()}@test.invalid`;
  const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Asha Rao" });
  await writeOnboardingDraft(personId, { name: "Asha Rao", role: "student", currentScreen: 7 });
  const now = Date.now();
  const op = (source: string, state: string, extra: Record<string, unknown> = {}) => ({
    id: `syncop_p2_${source}_${now}`, personId, source, idempotencyKey: `p2_${source}_${now}`, correlationId: `sync_p2_${source}`,
    trigger: "user", state, attempts: 1, maxAttempts: 3, createdAt: new Date(now), updatedAt: new Date(now), ...extra,
  });
  await db.insert(syncOperations).values([
    op("github", "running", { startedAt: new Date(now) }),
    // "slow": no LinkedIn code pending, so only the 8 s guard can move the screen on.
    ...(slow ? [] : [op("linkedin", "awaiting_user", { startedAt: new Date(now) })]),
    op("kaggle", "dead_letter", { lastErrorCode: "timeout", lastError: "Kaggle API timeout", finishedAt: new Date(now) }),
    op("leetcode", "succeeded", { finishedAt: new Date(now), result: { totalSolved: 312, badges: 3 } }),
  ]);
  await db.insert(sourceProcessingJobs).values({ id: crypto.randomUUID(), personId, sourceId: "resume", stage: "extract", status: "running", metadata: {} });
  console.log(JSON.stringify({ email, password: "visual-check-pw", personId }));
}

async function settle(personId: string) {
  const db = await useTestDatabase();
  const { syncOperations, sourceProcessingJobs } = await import("../../lib/db");
  await db.update(sourceProcessingJobs).set({ status: "review_ready", stage: "review", metadata: { candidates: 14 }, completedAt: new Date() })
    .where(and(eq(sourceProcessingJobs.personId, personId), eq(sourceProcessingJobs.sourceId, "resume")));
  await db.update(syncOperations).set({ state: "succeeded", finishedAt: new Date(), result: { recordsFetched: 6 } })
    .where(and(eq(syncOperations.personId, personId), eq(syncOperations.source, "github")));
  // LinkedIn skipped so nothing holds the screen on a verification code.
  await db.update(syncOperations).set({ state: "skipped_optional", finishedAt: new Date() })
    .where(and(eq(syncOperations.personId, personId), eq(syncOperations.source, "linkedin")));
  console.log("settled");
}

(async () => {
  const [cmd, id] = process.argv.slice(2);
  if (cmd === "settle" && id) await settle(id); else await seed(cmd === "slow");
  const { closeDbForTesting } = await import("../../lib/db");
  await closeDbForTesting();
})();
