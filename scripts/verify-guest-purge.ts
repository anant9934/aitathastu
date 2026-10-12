/**
 * Verifies the stale-guest purge on an in-memory database:
 * only guests older than the TTL that never completed onboarding are deleted.
 *
 *   PGLITE_IN_MEMORY=true DATABASE_URL= node --import tsx scripts/verify-guest-purge.ts
 */
import { eq } from "drizzle-orm";
import { getDb, users, persons, onboardingDrafts, evidenceItems } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { GUEST_EMAIL_DOMAIN } from "../lib/auth/server-session";
import { purgeStaleGuests } from "../lib/services/guest-cleanup-service";

async function main() {
  if (process.env.DATABASE_URL) throw new Error("Refusing to run against DATABASE_URL; this test uses in-memory PGlite only.");
  const db = await getDb();
  const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const mk = (email: string) => createUser({ email, passwordHash: "x", displayName: "Student" });

  const staleGuest = await mk(`guest_stale@${GUEST_EMAIL_DOMAIN}`);
  const completedGuest = await mk(`guest_done@${GUEST_EMAIL_DOMAIN}`);
  const freshGuest = await mk(`guest_fresh@${GUEST_EMAIL_DOMAIN}`);
  const realUser = await mk("real.student@example.com");
  for (const u of [staleGuest, completedGuest, realUser]) {
    await db.update(users).set({ createdAt: old }).where(eq(users.id, u.userId));
  }
  await db.insert(onboardingDrafts).values({ personId: staleGuest.personId, draft: { version: 2, completed: false } });
  await db.insert(onboardingDrafts).values({ personId: completedGuest.personId, draft: { version: 2, completed: true } });
  // evidence_items has no FK in the runtime DDL, so this proves the explicit cleanup.
  await db.insert(evidenceItems).values({
    id: "ev_purge_test", personId: staleGuest.personId, category: "skill", subject: "Python", value: "Python",
    source: "resume", verificationStatus: "unverified", interpretation: "-", whyItMatters: "-",
  });

  const deleted = await purgeStaleGuests(7);
  const remaining = new Set((await db.select({ id: users.id }).from(users)).map((r) => r.id));

  const checks: Array<[string, boolean]> = [
    ["exactly one account purged", deleted === 1],
    ["stale unfinished guest deleted", !remaining.has(staleGuest.userId)],
    ["stale guest's draft cascaded away", (await db.select().from(onboardingDrafts).where(eq(onboardingDrafts.personId, staleGuest.personId))).length === 0],
    ["stale guest's person row deleted", (await db.select().from(persons).where(eq(persons.id, staleGuest.personId))).length === 0],
    ["stale guest's evidence deleted (table without FK cascade)", (await db.select().from(evidenceItems).where(eq(evidenceItems.personId, staleGuest.personId))).length === 0],
    ["guest who completed onboarding kept", remaining.has(completedGuest.userId)],
    ["guest younger than TTL kept", remaining.has(freshGuest.userId)],
    ["real (non-guest) account kept", remaining.has(realUser.userId)],
  ];
  let failed = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) failed++;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
