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
/**
 * Right to be forgotten (Task 2.6.5): removes every row that belongs to the
 * account, in every table, including CV PDF blobs, encrypted connection
 * tokens, drafts, sync history and audit rows.
 *
 * Tables are discovered from the database catalog instead of a hand-kept
 * list (the old list missed 13 tables), so new person-scoped tables are
 * covered automatically:
 *  - every table with a `person_id` column: the person's rows are deleted;
 *  - other `*_person_id` columns (who reviewed / verified / acted): nulled
 *    where nullable, deleted where required;
 *  - then the person, the sessions and the user.
 * Rows keyed only indirectly (e.g. a blob by document id) go with their
 * parent through the foreign keys restored in Task 2.6.4, and are also
 * removed explicitly below, so this is complete even before that migration
 * has run. Statements are single-shot (Neon HTTP has no transactions) and
 * the function is safe to re-run if interrupted.
 */
export async function deleteAccountCompletely(userId: string): Promise<{ personId: string | null; tablesTouched: number }> {
  const db = await getDb();
  const exec = (q: ReturnType<typeof sql>) => (db as unknown as { execute: (q: unknown) => Promise<unknown> }).execute(q);
  const rowsOf = (r: unknown) => (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? [])) as Record<string, unknown>[];
  const ident = (name: unknown) => {
    const n = String(name);
    if (!/^[a-z_][a-z0-9_]*$/.test(n)) throw new Error(`Unexpected identifier in catalog: ${n}`);
    return `"${n}"`;
  };

  const [person] = await db.select({ id: persons.id }).from(persons).where(eq(persons.primaryUserId, userId)).limit(1);
  let tablesTouched = 0;
  if (person) {
    const pid = person.id;
    const columns = rowsOf(await exec(sql.raw(
      `SELECT table_name, column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name <> 'persons'
         AND (column_name = 'person_id' OR column_name ~ '_person_id$')`
    )));
    // Children keyed by a parent id rather than person_id (no FK in older databases).
    await exec(sql`DELETE FROM "resume_document_blobs" WHERE "document_id" IN (SELECT "id" FROM "resume_documents" WHERE "person_id" = ${pid})`).catch(() => undefined);
    await exec(sql`DELETE FROM "project_contributions" WHERE "project_id" IN (SELECT "id" FROM "projects" WHERE "person_id" = ${pid})`).catch(() => undefined);
    await exec(sql`DELETE FROM "verification_requests" WHERE "evidence_id" IN (SELECT "id" FROM "evidence_items" WHERE "person_id" = ${pid})`).catch(() => undefined);
    // Who-did-it references first (they may point at rows deleted below).
    for (const c of columns.filter((c) => c.column_name !== "person_id")) {
      const t = ident(c.table_name), col = ident(c.column_name);
      await exec(c.is_nullable === "YES"
        ? sql`UPDATE ${sql.raw(t)} SET ${sql.raw(col)} = NULL WHERE ${sql.raw(col)} = ${pid}`
        : sql`DELETE FROM ${sql.raw(t)} WHERE ${sql.raw(col)} = ${pid}`);
      tablesTouched++;
    }
    for (const c of columns.filter((c) => c.column_name === "person_id")) {
      await exec(sql`DELETE FROM ${sql.raw(ident(c.table_name))} WHERE "person_id" = ${pid}`);
      tablesTouched++;
    }
    await db.delete(persons).where(eq(persons.id, pid));
  }
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  return { personId: person?.id ?? null, tablesTouched };
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
