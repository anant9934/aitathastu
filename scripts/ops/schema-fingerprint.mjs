// Prints a normalized fingerprint of the public schema (columns, constraints, indexes) so two databases can be diffed.
import postgres from "postgres";
import { neon } from "@neondatabase/serverless";
const url = process.argv[2];
const q = url.includes("neon.tech") ? ((s) => neon(url).query(s)) : (() => { const c = postgres(url, { max: 1, onnotice: () => {} }); return async (s) => { const r = await c.unsafe(s); return r; }; })();
const cols = await q(`select table_name||'.'||column_name||' '||data_type||' '||is_nullable||' '||coalesce(column_default,'') x from information_schema.columns where table_schema='public' order by 1`);
const cons = await q(`select conrelid::regclass||' '||conname||' '||pg_get_constraintdef(oid) x from pg_constraint where connamespace='public'::regnamespace order by 1`);
const idx = await q(`select indexdef x from pg_indexes where schemaname='public' order by 1`);
console.log([...cols, ...cons, ...idx].map((r) => r.x).join("\n"));
process.exit(0);
