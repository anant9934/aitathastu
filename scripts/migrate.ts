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

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  // vercel.json runs this before every build. Only production deploys migrate:
  // preview builds may share the production DATABASE_URL and must not change it.
  if (process.env.VERCEL === "1") {
    if (process.env.VERCEL_ENV !== "production") {
      console.log(`Skipping migration on Vercel ${process.env.VERCEL_ENV ?? "unknown"} build.`);
      process.exit(0);
    }
    if (!databaseUrl?.startsWith("postgres")) {
      console.error("Production build has no PostgreSQL DATABASE_URL; refusing to deploy without a migrated database.");
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

