/**
 * Purges abandoned guest accounts.
 *
 * A guest is a user on GUEST_EMAIL_DOMAIN (see lib/auth/server-session.ts).
 * One is "stale" when it was created more than `ttlDays` ago and never
 * finished onboarding (no draft, or a draft without completed=true).
 */

import { and, eq, like, lt, sql } from "drizzle-orm";
import {
  getDb,
  users,
  persons,
  sessions,
  onboardingDrafts,
  actionStates,
  evidenceItems,
  goals,
  journeyEvents,
  personProfiles,
  organizationMemberships,
  userPreferences,
  integrationIdentityLinks,
  integrationEvents,
  assessmentAttempts,
  interviewSessions,
  aiAuditLogs,
} from "@/lib/db";
import { GUEST_EMAIL_DOMAIN } from "@/lib/auth/server-session";

export const DEFAULT_GUEST_TTL_DAYS = 7;

export async function findStaleGuestUserIds(ttlDays = DEFAULT_GUEST_TTL_DAYS, limit = 500): Promise<string[]> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .leftJoin(persons, eq(persons.primaryUserId, users.id))
    .leftJoin(onboardingDrafts, eq(onboardingDrafts.personId, persons.id))
    .where(
      and(
        like(users.email, `%@${GUEST_EMAIL_DOMAIN}`),
        lt(users.createdAt, cutoff),
        sql`coalesce((${onboardingDrafts.draft} ->> 'completed')::boolean, false) = false`
      )
    )
    .limit(limit);
  return rows.map((r) => r.id);
}

/**
 * Deletes a user, their person and everything the person owns.
 *
 * Several tables created by lib/db/migration-sql.ts (the DDL that actually
 * runs) have no foreign key to persons/users even though schema.ts declares
 * one, so ON DELETE CASCADE cannot be relied on. Those tables are cleared
 * explicitly. Tables that do declare a cascading FK go with the person row.
 */
export async function deleteAccountCompletely(userId: string): Promise<void> {
  const db = await getDb();
  const [person] = await db.select({ id: persons.id }).from(persons).where(eq(persons.primaryUserId, userId)).limit(1);
  if (person) {
    const pid = person.id;
    await db.delete(actionStates).where(eq(actionStates.personId, pid));
    await db.delete(evidenceItems).where(eq(evidenceItems.personId, pid));
    await db.delete(goals).where(eq(goals.personId, pid));
    await db.delete(journeyEvents).where(eq(journeyEvents.personId, pid));
    await db.delete(personProfiles).where(eq(personProfiles.personId, pid));
    await db.delete(organizationMemberships).where(eq(organizationMemberships.personId, pid));
    await db.delete(userPreferences).where(eq(userPreferences.personId, pid));
    await db.delete(integrationIdentityLinks).where(eq(integrationIdentityLinks.personId, pid));
    await db.delete(integrationEvents).where(eq(integrationEvents.personId, pid));
    await db.delete(assessmentAttempts).where(eq(assessmentAttempts.personId, pid));
    await db.delete(interviewSessions).where(eq(interviewSessions.personId, pid));
    await db.delete(aiAuditLogs).where(eq(aiAuditLogs.personId, pid));
    await db.delete(persons).where(eq(persons.id, pid));
  }
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

export async function purgeStaleGuests(ttlDays = DEFAULT_GUEST_TTL_DAYS): Promise<number> {
  let total = 0;
  for (;;) {
    const ids = await findStaleGuestUserIds(ttlDays, 200);
    if (ids.length === 0) return total;
    for (const id of ids) await deleteAccountCompletely(id);
    total += ids.length;
  }
}
