// Logical backup of the public schema over Neon HTTP (used when TCP 5432 is unreachable).
// Writes one JSON file: per-table column defs, constraints, indexes and every row.
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";

const out = process.argv[2];
if (!out) throw new Error("usage: backup-neon-http.mjs <out.json>");
const sql = neon(process.env.DATABASE_URL);
const tables = (await sql`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`).map((r) => r.table_name);
const backup = { takenAt: new Date().toISOString(), version: (await sql`select version()`)[0].version, tables: {} };
for (const t of tables) {
  const columns = await sql`select column_name, data_type, udt_name, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name=${t} order by ordinal_position`;
  const constraints = await sql`select conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid = ${"public." + t}::regclass`;
  const indexes = await sql`select indexname, indexdef from pg_indexes where schemaname='public' and tablename=${t}`;
  const rows = await sql.query(`select * from "${t}"`);
  const [{ n }] = await sql.query(`select count(*)::int n from "${t}"`);
  if (n !== rows.length) throw new Error(`${t}: fetched ${rows.length} rows but table has ${n}`);
  backup.tables[t] = { columns, constraints, indexes, rowCount: rows.length, rows };
}
writeFileSync(out, JSON.stringify(backup));
console.log(JSON.stringify({ tables: tables.length, rows: Object.values(backup.tables).reduce((a, t) => a + t.rowCount, 0), counts: Object.fromEntries(Object.entries(backup.tables).map(([k, v]) => [k, v.rowCount])) }));
