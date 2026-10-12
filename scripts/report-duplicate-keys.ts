/**
 * Lists rows that block the dedupe unique indexes from being created
 * (see the guarded DO blocks at the end of lib/db/migration-sql.ts).
 * Read-only: it never deletes anything. Resolve the listed rows, then re-run
 * `npm run db:migrate` to create the indexes.
 *
 *   node --env-file=.env --import tsx scripts/report-duplicate-keys.ts
 */
import { sql } from "drizzle-orm";
import { getDb } from "../lib/db";

async function main() {
  const db = await getDb();
  const rows = (r: unknown) => ((r as { rows?: unknown[] }).rows ?? (r as unknown[]));
  const evidence = rows(await db.execute(sql`
    SELECT person_id, import_key, count(*)::int AS n, array_agg(id ORDER BY updated_at DESC) AS ids
    FROM evidence_items WHERE import_key IS NOT NULL
    GROUP BY person_id, import_key HAVING count(*) > 1 ORDER BY n DESC LIMIT 200`));
  const projects = rows(await db.execute(sql`
    SELECT person_id, normalized_title, count(*)::int AS n, array_agg(id ORDER BY updated_at DESC) AS ids
    FROM projects WHERE normalized_title IS NOT NULL
    GROUP BY person_id, normalized_title HAVING count(*) > 1 ORDER BY n DESC LIMIT 200`));
  const indexes = rows(await db.execute(sql`
    SELECT indexname FROM pg_indexes WHERE indexname IN ('uq_evidence_person_import_key', 'uq_projects_person_normalized_title')`));

  console.log("Existing dedupe indexes:", indexes.map((i) => (i as { indexname: string }).indexname));
  console.log(`evidence_items duplicate (person_id, import_key) groups: ${evidence.length}`);
  for (const r of evidence) console.log("  ", JSON.stringify(r));
  console.log(`projects duplicate (person_id, normalized_title) groups: ${projects.length}`);
  for (const r of projects) console.log("  ", JSON.stringify(r));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
