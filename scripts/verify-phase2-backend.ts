/**
 * Phase 2 backend contracts (Tasks 2.6.x): audit logging, auth gating,
 * referential cleanup, account deletion.
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-phase2-backend.ts
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";

let db: Awaited<ReturnType<typeof setupTestDatabase>>;
before(async () => { db = await setupTestDatabase(); });
after(async () => { const { closeDbForTesting } = await import("../lib/db"); await closeDbForTesting(); });

describe("2.6.2 audit logs are awaited", () => {
  test("20 concurrent completions leave 20 ai_audit_logs rows as soon as they resolve", async () => {
    const saved = { audit: process.env.AI_AUDIT_IN_TESTS, live: process.env.CORE_DISABLE_LIVE_LLM };
    process.env.AI_AUDIT_IN_TESTS = "true";
    process.env.CORE_DISABLE_LIVE_LLM = "true"; // deterministic fallback: no external LLM calls
    try {
      const { IntelligenceRouter } = await import("../lib/intelligence/router");
      const { aiAuditLogs } = await import("../lib/db");
      const personId = await createTestPerson("p2-audit");
      const router = new IntelligenceRouter();
      await Promise.all(Array.from({ length: 20 }, () =>
        router.complete({ task: "eora_explanation", systemPrompt: "s", userPrompt: "u", personId } as never)));
      // No sleep: if logging were detached, rows could still be in flight here.
      const rows = await db.select().from(aiAuditLogs).where(eq(aiAuditLogs.personId, personId));
      assert.equal(rows.length, 20);
      assert.ok(rows.every((r) => r.status === "fallback"));
    } finally {
      process.env.AI_AUDIT_IN_TESTS = saved.audit;
      process.env.CORE_DISABLE_LIVE_LLM = saved.live;
    }
  });
});

/** Every row, in any table, with a text column equal to one of the ids. */
async function rowsMentioning(ids: string[]) {
  const { sql } = await import("drizzle-orm");
  const exec = (q: unknown) => (db as unknown as { execute: (q: unknown) => Promise<unknown> }).execute(q);
  const rowsOf = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as Record<string, unknown>[];
  const cols = rowsOf(await exec(sql.raw(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('text', 'character varying')`)));
  const hits: Record<string, number> = {};
  const list = ids.map((i) => `'${i.replace(/'/g, "''")}'`).join(", ");
  for (const c of cols) {
    const [{ n }] = rowsOf(await exec(sql.raw(`SELECT count(*)::int AS n FROM "${c.table_name}" WHERE "${c.column_name}" IN (${list})`))) as { n: number }[];
    if (n) hits[`${c.table_name}.${c.column_name}`] = n;
  }
  return hits;
}

describe("2.6.5 account deletion", () => {
  test("deleting an account leaves zero rows that mention the person or user, in every table", async () => {
    const { createUser } = await import("../lib/repositories/user-repository");
    const { completeOnboarding, mutateOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
    const { deleteAccountCompletely } = await import("../lib/services/guest-cleanup-service");
    const t = await import("../lib/db");
    const crypto = await import("crypto");
    const { userId, personId } = await createUser({ email: `p2-delete-${Date.now()}@test.invalid`, passwordHash: "x", displayName: "Delete Me" });
    await mutateOnboardingDraft(personId, { techCandidates: [{ name: "PyTorch", source: "github" }] }, { origin: "system" });
    await completeOnboarding(personId, {
      role: "student", name: "Delete Me", targetRole: "ML Engineer", institution: "IIT Delhi", degree: "B.Tech", priorities: ["learning"], primaryPriority: "learning",
      skills: ["Python"], profiles: { github: "https://github.com/del" },
      projects: [{ id: "p_del", title: "del-proj", description: "x", technologies: ["Python"], sources: ["github"], status: "confirmed", contribution: ["did it"], contributionNote: "solo" }],
      experiences: [{ company: "Globex", role: "Intern", status: "confirmed" }],
    });
    // Data from other subsystems a real student accumulates.
    const { startSyncOperation } = await import("../lib/sync/sync-operation");
    await startSyncOperation({ personId, source: "github", trigger: "user" });
    await db.insert(t.sourceProcessingJobs).values({ id: crypto.randomUUID(), personId, sourceId: "resume", stage: "extract", status: "running", metadata: {} });
    await db.insert(t.idempotencyKeys).values({ key: `del_${personId}`, personId, scope: "cv_upload" });
    await db.insert(t.aiAuditLogs).values({ id: `audit_del_${personId}`, personId, task: "x", provider: "p", model: "m", promptVersion: "v1", latencyMs: 1, status: "success", fallbackUsed: false });
    const { saveExternalConnection } = await import("../lib/repositories/connection-repository");
    await saveExternalConnection({ personId, provider: "linkedin", externalId: "li-del", metadata: { encryptedPassword: "v1.secret" } } as never).catch(() => undefined);

    const before = await rowsMentioning([personId, userId]);
    assert.ok(Object.keys(before).length >= 10, `seed should touch many tables: ${JSON.stringify(before)}`);
    await deleteAccountCompletely(userId);
    const after = await rowsMentioning([personId, userId]);
    assert.deepEqual(after, {}, `left behind: ${JSON.stringify(after)} (before: ${Object.keys(before).length} columns)`);
  });
});
