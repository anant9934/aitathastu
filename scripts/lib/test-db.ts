/**
 * Points the app's getDb() at a disposable local Postgres for backend tests.
 * Refuses anything that looks like a hosted database: the repo's .env targets
 * the production Neon branch, and tests must never write there.
 *
 *   docker run -d --name tathastu-phase1-pg -e POSTGRES_PASSWORD=phase1 \
 *     -e POSTGRES_DB=tathastu_test -p 54399:5432 postgres:16-alpine
 *   TEST_DATABASE_URL=postgres://postgres:phase1@127.0.0.1:54399/tathastu_test
 */
import crypto from "crypto";

export const DEFAULT_TEST_DATABASE_URL = "postgres://postgres:phase1@127.0.0.1:54399/tathastu_test";

export async function setupTestDatabase() {
  const url = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`Refusing to run backend tests against non-local database host "${host}".`);
  }
  process.env.DATABASE_URL = url;
  process.env.DATABASE_MODE = "postgres";
  process.env.DATABASE_TRANSPORT = "tcp";
  process.env.DATABASE_AUTO_MIGRATE = "true";
  (process.env as Record<string, string>).NODE_ENV = "test";

  const { getDb, resetDbForTesting } = await import("../../lib/db");
  const { MIGRATION_SQL_STATEMENTS } = await import("../../lib/db/migration-sql");
  resetDbForTesting();
  const db = await getDb();
  // getDb() only migrates an uninitialised database; replay every idempotent
  // statement so columns added since the container was created exist too.
  const { sql } = await import("drizzle-orm");
  // postgres-js prints "already exists, skipping" NOTICEs via console.log.
  const log = console.log;
  console.log = (...args: unknown[]) => { if ((args[0] as { severity?: string })?.severity !== "NOTICE") log(...args); };
  try {
    for (const stmt of MIGRATION_SQL_STATEMENTS) await (db as { execute: (q: unknown) => Promise<unknown> }).execute(sql.raw(stmt));
  } finally {
    console.log = log;
  }
  return db;
}

export async function createTestPerson(label = "phase1") {
  const { createUser } = await import("../../lib/repositories/user-repository");
  const tag = crypto.randomBytes(5).toString("hex");
  const created = await createUser({ email: `${label}-${tag}@test.invalid`, passwordHash: "x", displayName: `Test ${tag}` });
  return created.personId;
}
