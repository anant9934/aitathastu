/** Run only against an isolated local server with DATABASE_MODE=pglite and PGLITE_IN_MEMORY=true. */
import assert from "node:assert/strict";

const base = process.env.V56_TEST_BASE_URL || "http://localhost:3101";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  throw new Error("The onboarding API test only accepts a local HTTP server.");
}

type ApiResult = { status: number; body: Record<string, any>; cookie: string | null };
async function call(path: string, method = "GET", payload?: unknown, cookie?: string): Promise<ApiResult> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(payload ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: payload ? JSON.stringify(payload) : undefined,
    redirect: "manual",
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, cookie: response.headers.get("set-cookie")?.split(";")[0] || null };
}

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `LocalOnly-${suffix}!`;
  const emailA = `v56-a-${suffix}@example.test`;
  const emailB = `v56-b-${suffix}@example.test`;
  const createdA = await call("/api/auth/sign-up", "POST", { displayName: "Student A", email: emailA, password });
  assert.equal(createdA.status, 200, "student A signup");
  assert.ok(createdA.cookie, "student A session cookie");
  const cookieA = createdA.cookie!;
  const prematureWorkspace = await fetch(`${base}/student`, { headers: { cookie: cookieA }, redirect: "manual" });
  assert.equal(prematureWorkspace.status, 307, "incomplete student cannot enter workspace directly");
  assert.match(prematureWorkspace.headers.get("location") || "", /\/onboarding$/, "incomplete student is sent to onboarding");

  const duplicate = await call("/api/auth/sign-up", "POST", { displayName: "Duplicate", email: emailA, password });
  assert.equal(duplicate.status, 409, "duplicate account rejected");

  const saved = await call("/api/onboarding-v2", "PUT", {
    role: "student", name: "Student A", currentScreen: 5,
    targetRole: "AI Engineer", goal: "Build a strong AI/ML project",
    priorities: ["projects", "learning"], primaryPriority: "projects",
  }, cookieA);
  assert.equal(saved.status, 200, `draft save: ${JSON.stringify(saved.body)}`);
  const restored = await call("/api/onboarding-v2", "GET", undefined, cookieA);
  assert.equal(restored.body.draft?.currentScreen, 5, "partial step persisted");
  assert.deepEqual(restored.body.draft?.priorities, ["projects", "learning"], "purpose ranking persisted");

  const createdB = await call("/api/auth/sign-up", "POST", { displayName: "Student B", email: emailB, password });
  assert.equal(createdB.status, 200, "student B signup");
  assert.ok(createdB.cookie, "student B session cookie");
  const otherDraft = await call("/api/onboarding-v2", "GET", undefined, createdB.cookie!);
  assert.equal(otherDraft.body.draft, null, "student B cannot read A's draft");

  const finished = await call("/api/onboarding-v2", "POST", {
    role: "student", name: "Student A", targetRole: "AI Engineer",
    goal: "Build a strong AI/ML project", priorities: ["projects", "learning"],
    primaryPriority: "projects", skills: [], resumeReviewed: [], projects: [],
  }, cookieA);
  assert.equal(finished.status, 200, `onboarding completion: ${JSON.stringify(finished.body)}`);
  assert.equal(finished.body.draft?.completed, true, "completion persisted");

  const signedOut = await call("/api/auth/sign-out", "POST", undefined, cookieA);
  assert.equal(signedOut.status, 200, "logout");
  const signedIn = await call("/api/auth/sign-in", "POST", { email: emailA, password });
  assert.equal(signedIn.status, 200, "returning login");
  assert.ok(signedIn.cookie, "restored session cookie");
  const afterLogin = await call("/api/onboarding-v2", "GET", undefined, signedIn.cookie!);
  assert.equal(afterLogin.body.draft?.completed, true, "completed state after login");
  const restoredWorkspace = await fetch(`${base}/student`, { headers: { cookie: signedIn.cookie! }, redirect: "manual" });
  assert.equal(restoredWorkspace.status, 200, "completed student can enter workspace directly");
  const dashboard = await call("/api/student/dashboard", "GET", undefined, signedIn.cookie!);
  assert.equal(dashboard.status, 200, "student dashboard after re-login");
  assert.equal(dashboard.body.primaryInterest, "projects", "dashboard uses saved primary purpose");
  const person360 = await call("/api/student/person-360", "GET", undefined, signedIn.cookie!);
  assert.equal(person360.status, 200, "Person 360 after re-login");
  assert.equal(person360.body.person?.id, createdA.body.person?.id, "Person 360 retains account ownership");
  console.log("V5.6 isolated onboarding API: signup, direct route guard, duplicate rejection, draft restore, priority order, account isolation, completion, logout, re-login, dashboard personalization, and Person 360 passed");
}

main().catch(error => { console.error("V5.6 isolated onboarding API: FAILED", error); process.exitCode = 1; });
