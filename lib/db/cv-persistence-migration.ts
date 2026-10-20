import { CV_PERSISTENCE_MIGRATIONS } from "./migration-sql";

export type RawQuery = (statement: string) => Promise<Array<Record<string, unknown>>>;

/** True for statements that change or remove existing rows (as opposed to adding schema). */
export function isDataChanging(statement: string): boolean {
  const s = statement.replace(/\s+/g, " ").trim();
  if (/^(DELETE|UPDATE|INSERT|TRUNCATE|DROP)\b/i.test(s)) return true;
  if (/\bDROP (TABLE|COLUMN|INDEX|CONSTRAINT)\b/i.test(s)) return true;
  return /^DO \$\$/i.test(s) && /\b(DELETE FROM|UPDATE "|TRUNCATE)\b/i.test(s);
}

export type CvSchemaStatus = { runs: boolean; records: boolean; identityIndex: boolean; foreignKeys: number; ok: boolean };

export async function verifyCvPersistenceSchema(query: RawQuery): Promise<CvSchemaStatus> {
  const [row] = await query(`SELECT
    to_regclass('public.resume_extraction_runs') IS NOT NULL AS runs,
    to_regclass('public.resume_extracted_records') IS NOT NULL AS records,
    to_regclass('public.uq_resume_records_identity') IS NOT NULL AS identity_index,
    (SELECT count(*)::int FROM pg_constraint WHERE contype = 'f' AND conrelid IN (
      SELECT oid FROM pg_class WHERE relname IN ('resume_extraction_runs', 'resume_extracted_records')
    )) AS foreign_keys`);
  const status = {
    runs: row?.runs === true,
    records: row?.records === true,
    identityIndex: row?.identity_index === true,
    foreignKeys: Number(row?.foreign_keys ?? 0),
  };
  return { ...status, ok: status.runs && status.records && status.identityIndex && status.foreignKeys >= 4 };
}

/**
 * Creates the CV persistence tables and indexes if missing. Every statement is
 * CREATE ... IF NOT EXISTS; anything else is refused before running.
 */
export async function applyCvPersistenceMigration(query: RawQuery): Promise<CvSchemaStatus> {
  const unsafe = CV_PERSISTENCE_MIGRATIONS.filter((s) => isDataChanging(s) || !/^\s*CREATE (UNIQUE )?(TABLE|INDEX) IF NOT EXISTS/i.test(s));
  if (unsafe.length) throw new Error(`CV migration contains ${unsafe.length} non-additive statement(s); refusing to run.`);
  for (const statement of CV_PERSISTENCE_MIGRATIONS) await query(statement);
  return verifyCvPersistenceSchema(query);
}
