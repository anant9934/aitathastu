/**
 * Task 2.6.5 evidence: account deletion must be complete on a database that
 * does NOT yet have the Task 2.6.4 foreign keys (production until
 * `npm run db:migrate` runs). Drops the 27 repaired constraints on the local
 * test DB, seeds two identical students, deletes one with the pre-Phase-2
 * code and one with the new code, and scans every text column for leftovers.
 * Re-running scripts/lib/test-db.ts (any test) restores the constraints.
 *
 *   node --import tsx scripts/verify-phase2-deletion-without-fks.ts
 */
import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { DEFAULT_TEST_DATABASE_URL } from "./lib/test-db";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
process.env.DATABASE_MODE = "postgres";
process.env.DATABASE_TRANSPORT = "tcp";
process.env.DATABASE_AUTO_MIGRATE = "false";
(process.env as Record<string, string>).NODE_ENV = "test";

async function main() {
  const t = await import("../lib/db");
  const db = await t.getDb();
  const exec = (q: unknown) => (db as unknown as { execute: (q: unknown) => Promise<unknown> }).execute(q);
  const rowsOf = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as Record<string, unknown>[];

  // Production today: none of the 27 repaired constraints exist.
  const fks = rowsOf(await exec(sql.raw(`SELECT conrelid::regclass::text AS t, conname FROM pg_constraint WHERE conname LIKE 'fk\\_%' AND contype = 'f'`)));
  for (const fk of fks) await exec(sql.raw(`ALTER TABLE ${fk.t} DROP CONSTRAINT "${fk.conname}"`));

  async function seed(tag: string) {
    const { createUser } = await import("../lib/repositories/user-repository");
    const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
    const { startSyncOperation } = await import("../lib/sync/sync-operation");
    const { userId, personId } = await createUser({ email: `p2-nofk-${tag}-${Date.now()}@test.invalid`, passwordHash: "x", displayName: "No FK" });
    await completeOnboarding(personId, {
      role: "student", name: "No FK", targetRole: "ML Engineer", institution: "IIT Delhi", degree: "B.Tech", priorities: ["learning"], primaryPriority: "learning",
      skills: ["Python"], profiles: { github: "https://github.com/nofk" },
      projects: [{ id: "p_nofk", title: "nofk-proj", description: "x", technologies: ["Python"], sources: ["github"], status: "confirmed", contribution: ["did it"], contributionNote: "solo" }],
    });
    await startSyncOperation({ personId, source: "github", trigger: "user" });
    await db.insert(t.sourceProcessingJobs).values({ id: crypto.randomUUID(), personId, sourceId: "resume", stage: "extract", status: "running", metadata: {} });
    await db.insert(t.idempotencyKeys).values({ key: `nofk_${personId}`, personId, scope: "cv_upload" });
    await db.insert(t.aiAuditLogs).values({ id: `audit_nofk_${personId}`, personId, task: "x", provider: "p", model: "m", promptVersion: "v1", latencyMs: 1, status: "success", fallbackUsed: false });
    return { userId, personId };
  }
  async function leftovers(ids: string[]) {
    const cols = rowsOf(await exec(sql.raw(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('text', 'character varying')`)));
    const list = ids.map((i) => `'${i}'`).join(", ");
    const hits: Record<string, number> = {};
    for (const c of cols) {
      const [{ n }] = rowsOf(await exec(sql.raw(`SELECT count(*)::int AS n FROM "${c.table_name}" WHERE "${c.column_name}" IN (${list})`))) as { n: number }[];
      if (n) hits[`${c.table_name}.${c.column_name}`] = n;
    }
    return hits;
  }

  // The deletion code as it was before Phase 2 (hand-kept list of 12 tables).
  async function oldDelete(userId: string) {
    const [person] = await db.select({ id: t.persons.id }).from(t.persons).where(eq(t.persons.primaryUserId, userId)).limit(1);
    if (person) {
      const pid = person.id;
      for (const table of [t.actionStates, t.evidenceItems, t.goals, t.journeyEvents, t.personProfiles, t.organizationMemberships, t.userPreferences, t.integrationIdentityLinks, t.integrationEvents, t.assessmentAttempts, t.interviewSessions, t.aiAuditLogs]) {
        await db.delete(table).where(eq((table as unknown as { personId: never }).personId, pid));
      }
      await db.delete(t.persons).where(eq(t.persons.id, pid));
    }
    await db.delete(t.sessions).where(eq(t.sessions.userId, userId));
    await db.delete(t.users).where(eq(t.users.id, userId));
  }

  const a = await seed("old");
  await oldDelete(a.userId);
  const oldLeft = await leftovers([a.personId, a.userId]);

  const { deleteAccountCompletely } = await import("../lib/services/guest-cleanup-service");
  const b = await seed("new");
  const summary = await deleteAccountCompletely(b.userId);
  const newLeft = await leftovers([b.personId, b.userId]);

  console.log(JSON.stringify({ droppedRepairConstraints: fks.length, oldCode: { tablesLeftBehind: Object.keys(oldLeft).length, rows: oldLeft }, newCode: { tablesTouched: summary.tablesTouched, leftBehind: newLeft } }, null, 2));
  await t.closeDbForTesting();
}
main().catch((e) => { console.error(e); process.exit(1); });
