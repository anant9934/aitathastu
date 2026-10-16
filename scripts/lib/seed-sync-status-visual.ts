/** Local-only fixture for visually checking the sync-status panel (Task 1.9.4). */
import { setupTestDatabase } from "./test-db";

async function main() {
  const db = await setupTestDatabase();
  const { syncOperations } = await import("../../lib/db");
  const { createUser } = await import("../../lib/repositories/user-repository");
  const { hashPassword } = await import("../../lib/auth/password");
  const email = `visual-${Date.now()}@test.invalid`;
  const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Asha Rao" });
  const now = Date.now();
  const op = (source: string, state: string, extra: Record<string, unknown>) => ({
    id: `syncop_visual_${source}_${now}`, personId, source, idempotencyKey: `visual_${source}_${now}`, correlationId: `sync_visual_${source}`,
    trigger: "user", state, attempts: 1, maxAttempts: 3, createdAt: new Date(now), updatedAt: new Date(now), ...extra,
  });
  await db.insert(syncOperations).values([
    op("github", "dead_letter", { lastErrorCode: "github_auth", lastError: "GitHub rejected the token (401).", finishedAt: new Date(now) }),
    op("scholar", "failed", { lastErrorCode: "unexpected_error", lastError: "Semantic Scholar 500", nextAttemptAt: new Date(now + 30 * 60_000) }),
    op("leetcode", "succeeded", { finishedAt: new Date(now - 3600_000), result: {} }),
  ]);
  console.log(JSON.stringify({ email, password: "visual-check-pw" }));
  const { closeDbForTesting } = await import("../../lib/db");
  await closeDbForTesting();
}
main();
