/**
 * Creates the CV persistence tables (resume_extraction_runs,
 * resume_extracted_records) and their indexes if they are missing. Additive
 * only: no row is changed or deleted. Unlike `npm run db:migrate`, it does not
 * read .env, so it only ever targets the DATABASE_URL it is given.
 *
 *   Vercel build (vercel.json):  runs only when VERCEL_ENV=production
 *   Manual:  DATABASE_URL='postgres://...' npm run db:migrate:cv -- --apply
 *   Without --apply (and outside a production build) it only describes itself.
 */
import { CV_PERSISTENCE_MIGRATIONS } from "../lib/db/migration-sql";
import { applyCvPersistenceMigration, type RawQuery } from "../lib/db/cv-persistence-migration";

const redact = (s: string) => s.replace(/postgres(ql)?:\/\/\S+/gi, "postgres://[redacted]");

async function main() {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv && vercelEnv !== "production") {
    console.log(`[db:migrate:cv] Skipped on Vercel ${vercelEnv} build: only production deploys change the production schema.`);
    return 0;
  }
  const apply = process.argv.includes("--apply") || vercelEnv === "production";
  if (!apply) {
    console.log(`[db:migrate:cv] Dry run: ${CV_PERSISTENCE_MIGRATIONS.length} additive statements (CREATE ... IF NOT EXISTS). Pass --apply to run them.`);
    return 0;
  }
  const url = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
  if (!url?.startsWith("postgres")) {
    console.error("[db:migrate:cv] No PostgreSQL DATABASE_URL is set; nothing was changed.");
    return 1;
  }
  const isNeon = new URL(url).hostname.endsWith("neon.tech") || ["neon-http", "http"].includes(process.env.DATABASE_TRANSPORT ?? "");
  let query: RawQuery;
  let close = async () => {};
  if (isNeon) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    query = async (s) => (await sql.query(s)) as Array<Record<string, unknown>>;
  } else {
    const { default: postgres } = await import("postgres");
    const client = postgres(url, { max: 1, onnotice: () => {} });
    query = async (s) => [...(await client.unsafe(s))] as Array<Record<string, unknown>>;
    close = () => client.end({ timeout: 5 });
  }
  try {
    const status = await applyCvPersistenceMigration(query);
    console.log(`[db:migrate:cv] ${JSON.stringify(status)}`);
    if (!status.ok) console.error("[db:migrate:cv] Schema check failed after migration.");
    return status.ok ? 0 : 1;
  } finally {
    await close();
  }
}

main().then((code) => process.exit(code), (err) => {
  const e = err as { code?: string; message?: string };
  console.error(`[db:migrate:cv] Failed${e.code ? ` (${e.code})` : ""}: ${redact(String(e.message ?? err)).slice(0, 300)}`);
  process.exit(1);
});
