/**
 * Task 2.6.5 over HTTP: POST /api/student/account/delete on the test-database
 * dev server (see scripts/visual-phase2-progress.ts), then a full-database
 * scan for anything that still mentions the person or user.
 *
 *   node --import tsx scripts/verify-phase2-account-delete-http.ts
 */
import { request } from "playwright";
import { sql } from "drizzle-orm";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";

async function main() {
  const { setupTestDatabase } = await import("./lib/test-db");
  const db = await setupTestDatabase(); // replays migrations: restores every FK
  const exec = (q: unknown) => (db as unknown as { execute: (q: unknown) => Promise<unknown> }).execute(q);
  const rowsOf = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as Record<string, unknown>[];
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");

  const email = `p2-delhttp-${Date.now()}@test.invalid`;
  const { userId, personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Delete Via HTTP" });
  await completeOnboarding(personId, { role: "student", name: "Delete Via HTTP", targetRole: "ML Engineer", institution: "IIT Delhi", degree: "B.Tech", priorities: ["learning"], primaryPriority: "learning", skills: ["Python"] });

  const anon = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const signedOut = (await anon.post("/api/student/account/delete", { data: { confirm: "delete my account" } })).status();
  const api = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  await api.post("/api/auth/sign-in", { data: { email, password: "visual-check-pw" } });
  const wrong = await api.post("/api/student/account/delete", { data: { confirm: "yes" } });
  const ok = await api.post("/api/student/account/delete", { data: { confirm: "Delete my account" } });
  const setCookie = ok.headers()["set-cookie"] ?? "";
  const afterwards = (await api.get("/api/student/dashboard")).status();

  const cols = rowsOf(await exec(sql.raw(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('text', 'character varying')`)));
  const left: Record<string, number> = {};
  for (const c of cols) {
    const [{ n }] = rowsOf(await exec(sql.raw(`SELECT count(*)::int AS n FROM "${c.table_name}" WHERE "${c.column_name}" IN ('${personId}', '${userId}')`))) as { n: number }[];
    if (n) left[`${c.table_name}.${c.column_name}`] = n;
  }
  const tables = rowsOf(await exec(sql.raw(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`)))[0].n;
  console.log(JSON.stringify({
    signedOutStatus: signedOut,
    wrongConfirmation: { status: wrong.status(), error: (await wrong.json()).error },
    confirmed: { status: ok.status(), body: await ok.json(), clearsSessionCookie: /tathastu_session=;|tathastu_session=[^;]*;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(setCookie) },
    oldSessionAfterDelete: afterwards,
    tablesScanned: tables, columnsScanned: cols.length, rowsLeft: left,
  }, null, 2));
  await anon.dispose(); await api.dispose();
  const { closeDbForTesting } = await import("../lib/db");
  await closeDbForTesting();
}
main().catch((e) => { console.error(e); process.exit(1); });
