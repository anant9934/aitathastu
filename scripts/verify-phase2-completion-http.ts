/**
 * Task 2.1.7 done criteria over HTTP: repeated POST /api/onboarding-v2 returns
 * 200 every time and leaves identical row counts. Needs the test-database dev
 * server described in scripts/visual-phase2-progress.ts.
 *
 *   node --import tsx scripts/verify-phase2-completion-http.ts
 */
import { request } from "playwright";
import { eq } from "drizzle-orm";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const BODY = {
  version: 2, role: "student", name: "HTTP Repeat", targetRole: "Machine Learning Engineer", institution: "IIT Delhi", degree: "B.Tech",
  priorities: ["learning"], primaryPriority: "learning", skills: ["Python"],
  projects: [{ id: "p1", title: "rag-notes", description: "RAG", technologies: ["Python"], sources: ["github"], status: "confirmed", contribution: [], contributionNote: "" }],
  experiences: [{ company: "Globex", role: "Data Intern", status: "confirmed" }],
  education: [{ institution: "IIT Delhi", degree: "B.Tech", status: "confirmed" }],
};

async function main() {
  const { useTestDatabase } = await import("./lib/test-db");
  const db = await useTestDatabase();
  const t = await import("../lib/db");
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const counts = async (personId: string) => {
    const n = async (table: { personId: unknown }) => (await db.select().from(table as never).where(eq((table as { personId: never }).personId, personId))).length;
    return { evidence: await n(t.evidenceItems), projects: await n(t.projects), journey: await n(t.journeyEvents), goals: await n(t.goals), preferences: await n(t.userPreferences) };
  };
  const out: Record<string, unknown> = {};
  for (const mode of ["sequential", "concurrent"] as const) {
    const email = `p2-http-${mode}-${Date.now()}@test.invalid`;
    const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "HTTP Repeat" });
    const api = await request.newContext({ baseURL: BASE });
    await api.post("/api/auth/sign-in", { data: { email, password: "visual-check-pw" } });
    const statuses: number[] = [];
    const snapshots: unknown[] = [];
    if (mode === "sequential") {
      for (let i = 0; i < 3; i++) { statuses.push((await api.post("/api/onboarding-v2", { data: BODY })).status()); snapshots.push(await counts(personId)); }
    } else {
      statuses.push(...(await Promise.all(Array.from({ length: 3 }, () => api.post("/api/onboarding-v2", { data: BODY })))).map((r) => r.status()));
      snapshots.push(await counts(personId));
    }
    out[mode] = { statuses, snapshots, identical: snapshots.every((s) => JSON.stringify(s) === JSON.stringify(snapshots[0])) };
    await api.dispose();
  }
  console.log(JSON.stringify(out, null, 2));
  await t.closeDbForTesting();
}
main().catch((e) => { console.error(e); process.exit(1); });
