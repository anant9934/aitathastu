/**
 * Task 2.6.1 over HTTP: cached reads hit after the first request, are fast,
 * and are dropped by a write. Needs the test dev server on :3100 started with
 * UPSTASH_REDIS_REST_URL pointing at the local emulator (127.0.0.1:18079).
 *
 *   node --import tsx scripts/verify-phase2-cache-http.ts
 */
const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";

async function main() {
  const { setupTestDatabase } = await import("./lib/test-db");
  await setupTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
  const email = `p2-cache-${Date.now()}@test.invalid`;
  const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Cache Check" });
  await completeOnboarding(personId, { role: "student", name: "Cache Check", targetRole: "Machine Learning Engineer", priorities: ["learning"], primaryPriority: "learning", skills: ["Python"], projects: [] });

  const signIn = await fetch(`${BASE}/api/auth/sign-in`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "visual-check-pw" }) });
  const cookie = (signIn.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const get = async (path: string) => {
    const t = performance.now();
    const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
    await res.arrayBuffer();
    return { ms: Math.round(performance.now() - t), cache: res.headers.get("x-cache"), status: res.status };
  };
  const out: Record<string, unknown> = {};
  for (const path of ["/api/student/dashboard", "/api/student/skills", "/api/student/person-360"]) {
    await get(path); // warm route compilation in dev
    await fetch(`${BASE}/api/student/skills`, { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ name: `Warm${path.length}` }) }); // invalidate
    const miss = await get(path);
    const hits = [];
    for (let i = 0; i < 5; i++) hits.push(await get(path));
    out[path] = { miss, hitsMs: hits.map((h) => h.ms), hitHeaders: [...new Set(hits.map((h) => h.cache))], medianHitMs: [...hits.map((h) => h.ms)].sort((a, b) => a - b)[2] };
  }
  // A profile edit drops the dashboard entry.
  await get("/api/student/dashboard");
  const patch = await fetch(`${BASE}/api/student/person-360`, { method: "PATCH", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ headline: "Cache test headline" }) });
  out.afterProfileEdit = { patchStatus: patch.status, dashboard: await get("/api/student/dashboard"), person360: await get("/api/student/person-360") };
  console.log(JSON.stringify(out, null, 2));
  const { closeDbForTesting } = await import("../lib/db");
  await closeDbForTesting();
}
main().catch((e) => { console.error(e); process.exit(1); });
