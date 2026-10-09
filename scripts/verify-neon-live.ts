import { getDb } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Connecting using getDb() with DATABASE_URL...");
  try {
    const db = await getDb();
    const info = await db.execute(sql`SELECT current_database(), current_user, version();`);
    console.log("Connection SUCCESSFUL!");
    const rows = (info as unknown as { rows: Array<Record<string, unknown>> }).rows || info;
    const firstRow = (rows as Array<Record<string, unknown>>)[0];
    console.log("Current Database:", firstRow?.current_database);
    console.log("Current User:", firstRow?.current_user);
    console.log("PostgreSQL Version:", firstRow?.version);

    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    const tableRows = (tables as unknown as { rows: Array<Record<string, string>> }).rows || tables;
    const tableList = (tableRows as Array<Record<string, string>>).map((r) => r.table_name);
    console.log(`\nFound ${tableList.length} tables in live Neon database:`);
    console.log(tableList.join(", "));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Database connection failed:", message);
  }
}

main().catch(console.error);
