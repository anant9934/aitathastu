import fs from "fs";
import path from "path";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { seedDefaultEntities } from "./seed";
import { MIGRATION_SQL_STATEMENTS } from "./migration-sql";

export type TathastuDb =
  | PgliteDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

declare global {
  var __tathastu_db__: TathastuDb | undefined;
  var __tathastu_db_promise__: Promise<TathastuDb> | undefined;
}

export function resetDbForTesting(): void {
  globalThis.__tathastu_db__ = undefined;
  globalThis.__tathastu_db_promise__ = undefined;
}

export async function getDb(): Promise<TathastuDb> {
  if (globalThis.__tathastu_db__) return globalThis.__tathastu_db__;
  if (globalThis.__tathastu_db_promise__) return globalThis.__tathastu_db_promise__;

  globalThis.__tathastu_db_promise__ = (async () => {
    let databaseUrl = process.env.DATABASE_URL?.trim();
    if (databaseUrl && ((databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) || (databaseUrl.startsWith("'") && databaseUrl.endsWith("'")))) {
      databaseUrl = databaseUrl.slice(1, -1).trim();
    }
    const isProd = process.env.NODE_ENV === "production";
    const databaseMode = process.env.DATABASE_MODE || (isProd ? "postgres" : "auto");

    // 1. Production / Explicit PostgreSQL Mode Validation
    if (databaseMode === "postgres" || isProd) {
      if (!databaseUrl || !databaseUrl.startsWith("postgres")) {
        throw new Error(
          "Production database configuration error: Valid PostgreSQL DATABASE_URL is required when DATABASE_MODE=postgres or NODE_ENV=production. Embedded PGlite fallback is strictly prohibited in production."
        );
      }
    }

    // 2. Real PostgreSQL Mode (Neon Serverless HTTP or Standard TCP)
    if (databaseUrl && databaseUrl.startsWith("postgres") && databaseMode !== "pglite") {
      const isNeon =
        databaseUrl.includes("neon.tech") ||
        process.env.DATABASE_TRANSPORT === "neon-http" ||
        process.env.DATABASE_TRANSPORT === "http";

      if (isNeon) {
        // Neon Serverless HTTP Transport (Port 443 / Serverless Native)
        const { neon } = await import("@neondatabase/serverless");
        const { drizzle } = await import("drizzle-orm/neon-http");

        const sql = neon(databaseUrl);
        const db = drizzle(sql, { schema });

        try {
          const check = await sql`SELECT to_regclass('public.organizations') as reg`;
          const isInitialized = Boolean(check[0]?.reg);

          if (!isInitialized) {
            for (const stmt of MIGRATION_SQL_STATEMENTS) {
              await sql.query(stmt);
            }
            await seedDefaultEntities(db);
          }
        } catch (migErr) {
          console.error("[Tathastu DB] Migration error on Neon Serverless HTTP:", migErr);
          globalThis.__tathastu_db_promise__ = undefined;
          throw migErr;
        }

        globalThis.__tathastu_db__ = db;
        return db;
      } else {
        // Standard Direct TCP Transport via postgres-js
        const { default: postgres } = await import("postgres");
        const { drizzle } = await import("drizzle-orm/postgres-js");

        const client = postgres(databaseUrl, { max: 10, connect_timeout: 5 });
        const db = drizzle(client, { schema });

        try {
          const check = await client`SELECT to_regclass('public.organizations') as reg`;
          const isInitialized = Boolean(check[0]?.reg);

          if (!isInitialized) {
            for (const stmt of MIGRATION_SQL_STATEMENTS) {
              await client.unsafe(stmt);
            }
            await seedDefaultEntities(db);
          }
        } catch (migErr) {
          console.error("[Tathastu DB] Migration error on PostgreSQL TCP:", migErr);
          globalThis.__tathastu_db_promise__ = undefined;
          throw migErr;
        }

        globalThis.__tathastu_db__ = db;
        return db;
      }
    } else {
      // 3. Embedded Local PostgreSQL Engine via PGlite (Development, Test & Pilot Sandbox Only)
      if (isProd) {
        throw new Error("Embedded PGlite engine cannot be used in production.");
      }

      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");

      const isTest = process.env.NODE_ENV === "test";
      const isMemory = process.env.PGLITE_IN_MEMORY === "true";
      const dbPath = isTest || isMemory ? undefined : path.join(process.cwd(), ".pgdata");

      if (dbPath && fs.existsSync(dbPath)) {
        const pidFile = path.join(dbPath, "postmaster.pid");
        if (fs.existsSync(pidFile)) {
          try {
            fs.unlinkSync(pidFile);
          } catch {
            // ignore if already cleaned
          }
        }
      }

      const client = new PGlite(dbPath);
      const db = drizzle(client, { schema });

      try {
        const check = await client.query("SELECT to_regclass('public.organizations') as reg");
        const isInitialized = Boolean((check.rows[0] as Record<string, unknown> | undefined)?.reg);

        if (!isInitialized) {
          for (const stmt of MIGRATION_SQL_STATEMENTS) {
            await client.query(stmt);
          }
          await seedDefaultEntities(db);
        }
      } catch (migErr) {
        console.error("[Tathastu DB] Migration error on PGlite:", migErr);
        throw migErr;
      }

      globalThis.__tathastu_db__ = db;
      return db;
    }
  })().catch((err) => {
    globalThis.__tathastu_db_promise__ = undefined;
    throw err;
  });

  return globalThis.__tathastu_db_promise__;
}

export * from "./schema";
export { seedDefaultEntities };
