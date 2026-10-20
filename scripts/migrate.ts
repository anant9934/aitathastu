import fs from "fs";
import path from "path";

// Ensure .env is loaded if DATABASE_URL not yet in environment
if (!process.env.DATABASE_URL && fs.existsSync(path.join(process.cwd(), ".env"))) {
  const envContent = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      const val = vals.join("=").replace(/^["']|["']$/g, "");
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val.trim();
      }
    }
  }
}

import { getDb, seedDefaultEntities } from "../lib/db";
import { MIGRATION_SQL_STATEMENTS } from "../lib/db/migration-sql";
import { isDataChanging } from "../lib/db/cv-persistence-migration";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  // The full list also deletes orphan rows, removes duplicate journey events and
  // rewrites some columns. On anything but a local database that needs an
  // explicit go-ahead; the CV tables alone can be created with db:migrate:cv.
  if (databaseUrl?.startsWith("postgres")) {
    const host = new URL(databaseUrl).hostname;
    const local = ["127.0.0.1", "localhost", "::1"].includes(host);
    const changing = MIGRATION_SQL_STATEMENTS.filter(isDataChanging);
    if (!local && !process.argv.includes("--allow-data-changes")) {
      console.error(`Refusing to run on a non-local database: ${changing.length} of ${MIGRATION_SQL_STATEMENTS.length} statements change or delete existing rows:`);
      for (const s of changing) console.error(`  - ${s.replace(/\s+/g, " ").slice(0, 110)}`);
      console.error("Review them, then re-run with `npm run db:migrate -- --allow-data-changes`. For only the CV tables: `npm run db:migrate:cv -- --apply`.");
      process.exit(1);
    }
  }

  console.log("Applying database migrations and seeding defaults...");

  if (databaseUrl && databaseUrl.startsWith("postgres")) {
    const isNeon =
      databaseUrl.includes("neon.tech") ||
      process.env.DATABASE_TRANSPORT === "neon-http" ||
      process.env.DATABASE_TRANSPORT === "http";

    if (isNeon) {
      const { neon } = await import("@neondatabase/serverless");
      const { drizzle } = await import("drizzle-orm/neon-http");
      const schema = await import("../lib/db/schema");
      const sql = neon(databaseUrl);
      const db = drizzle(sql, { schema });

      console.log(`Executing ${MIGRATION_SQL_STATEMENTS.length} DDL migration statements on Neon...`);
      for (const stmt of MIGRATION_SQL_STATEMENTS) {
        await sql.query(stmt);
      }
      await seedDefaultEntities(db);
      console.log("✓ Database successfully initialized and migrated on Neon.");
      process.exit(0);
    }

    // getDb() only migrates an empty database, so apply every statement here.
    const { default: postgres } = await import("postgres");
    const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    console.log(`Executing ${MIGRATION_SQL_STATEMENTS.length} DDL migration statements on PostgreSQL...`);
    for (const stmt of MIGRATION_SQL_STATEMENTS) await client.unsafe(stmt);
    await client.end({ timeout: 5 });
    await seedDefaultEntities(await getDb());
    console.log("✓ Database successfully migrated.");
    process.exit(0);
  }

  await getDb();
  console.log("✓ Database successfully initialized and migrated.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

