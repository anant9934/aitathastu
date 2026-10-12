import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

const base = process.env.V53_BASE_URL || "http://127.0.0.1:3101";
const password = "SafePreviewPass123!";

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  try {
    const a = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const b = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const emailA = `v53-journey-a-${randomUUID()}@example.test`;
    const emailB = `v53-journey-b-${randomUUID()}@example.test`;
    for (const [context, email, name] of [[a, emailA, "Journey Alpha"], [b, emailB, "Journey Bravo"]] as const) {
      const signup = await context.request.post(`${base}/api/auth/sign-up`, { data: { email, password, displayName: name } });
      assert.equal(signup.status(), 200, await signup.text());
      assert.equal((await (await context.request.get(`${base}/api/auth/session`)).json()).authenticated, true);
    }
    const partial = await a.request.put(`${base}/api/onboarding-v2`, { data: { role: "student", name: "Journey Alpha", priorities: ["projects"], primaryPriority: "projects" } });
    assert.equal(partial.status(), 200, await partial.text());
    const recovered = await (await a.request.get(`${base}/api/onboarding-v2`)).json();
    assert.equal(recovered.draft.name, "Journey Alpha");
    const complete = async (context: typeof a, name: string, goal: string, priorities: string[]) => {
      const response = await context.request.post(`${base}/api/onboarding-v2`, { data: { role: "student", name, targetRole: "Machine Learning Engineer", goal, institution: "Preview University", degree: "B.Tech", specialization: "Computer Science", year: "3rd Year", priorities, primaryPriority: priorities[0] } });
      assert.equal(response.status(), 200, await response.text());
    };
    await complete(a, "Journey Alpha", "Build a project", ["projects", "learning"]);
    await complete(b, "Journey Bravo", "Learn AI", ["learning", "people"]);
    const saved = await a.request.patch(`${base}/api/workspace/preferences`, { data: { role: "student", purposes: ["projects", "jobs"], layout: { version: 1, pinned: ["projects"], hidden: ["opportunities"], order: ["projects", "opportunities"], density: "compact", sizes: { projects: "wide" } } } });
    assert.equal(saved.status(), 200, await saved.text());
    const beforeLogout = await (await a.request.get(`${base}/api/workspace/preferences`)).json();
    assert.deepEqual(beforeLogout.purposes, ["projects", "jobs"]);
    assert.deepEqual(beforeLogout.layout.hidden, ["opportunities"]);
    const sessionA = await (await a.request.get(`${base}/api/auth/session`)).json();
    const sessionB = await (await b.request.get(`${base}/api/auth/session`)).json();
    assert.notEqual(sessionA.person.id, sessionB.person.id);
    const prefsB = await (await b.request.get(`${base}/api/workspace/preferences`)).json();
    assert.deepEqual(prefsB.purposes, ["learning", "people"]);
    assert.equal(prefsB.layout.hidden.includes("opportunities"), false);
    const personA = await a.request.get(`${base}/api/student/person-360`);
    const personB = await b.request.get(`${base}/api/student/person-360`);
    assert.equal(personA.status(), 200, await personA.text());
    assert.equal(personB.status(), 200, await personB.text());
    assert.notEqual((await personA.text()), (await personB.text()));
    const signout = await a.request.post(`${base}/api/auth/sign-out`);
    assert.equal(signout.status(), 200, await signout.text());
    assert.equal((await (await a.request.get(`${base}/api/auth/session`)).json()).authenticated, false);
    const login = await a.request.post(`${base}/api/auth/sign-in`, { data: { email: emailA, password } });
    assert.equal(login.status(), 200, await login.text());
    const afterLogin = await (await a.request.get(`${base}/api/workspace/preferences`)).json();
    assert.deepEqual(afterLogin.purposes, ["projects", "jobs"]);
    assert.deepEqual(afterLogin.layout.hidden, ["opportunities"]);
    const page = await a.newPage();
    await page.goto(`${base}/student`);
    await page.getByText("YOUR STUDENT WORKSPACE", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "Build work that speaks for you." }).waitFor();
    console.log("Two-user signup, session, partial recovery, onboarding, layout persistence, account isolation, logout/re-login, and browser routing passed.");
    await a.close(); await b.close();
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
