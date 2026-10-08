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
  console.log("Applying database migrations and seeding defaults...");
  const databaseUrl = process.env.DATABASE_URL;

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
  }

  await getDb();
  console.log("✓ Database successfully initialized and migrated.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

