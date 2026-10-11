import assert from "node:assert/strict";
import { createInterface } from "node:readline";

async function readConnectionUrl(): Promise<string> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim()) return line.trim();
  }
  throw new Error("An isolated Neon branch URL must be supplied on stdin");
}

async function main() {
  const url = await readConnectionUrl();
  const parsed = new URL(url);
  const expectedHost = process.env.EXPECTED_PREVIEW_NEON_HOST;
  if (!expectedHost) throw new Error("Set EXPECTED_PREVIEW_NEON_HOST to the isolated branch host");
  assert.equal(parsed.protocol, "postgresql:");
  assert.equal(parsed.hostname, expectedHost);
  assert.equal(parsed.pathname, "/neondb");
  assert.equal(parsed.searchParams.get("sslmode"), "require");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  const rows = await sql`SELECT current_database() AS database_name, current_user AS role_name,
    to_regclass('public.organizations')::text AS organizations_table,
    to_regclass('public.onboarding_drafts')::text AS drafts_table,
    current_setting('search_path') AS search_path,
    EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public') AS public_schema_exists`;
  console.log(JSON.stringify({
    host: parsed.hostname,
    database: rows[0]?.database_name,
    role: rows[0]?.role_name,
    organizationsTable: rows[0]?.organizations_table,
    draftsTable: rows[0]?.drafts_table,
    searchPath: rows[0]?.search_path,
    publicSchemaExists: rows[0]?.public_schema_exists,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[redacted URL]") : "Neon check failed");
  process.exitCode = 1;
});
