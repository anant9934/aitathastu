import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";

async function main() {
  const baseURL = process.env.BASE_URL || "http://127.0.0.1:3102";
  const first = await request.newContext({ baseURL });
  const second = await request.newContext({ baseURL });
  const suffix = randomUUID();
  const email = `p01-first-${suffix}@example.test`;
  const password = "P01SyntheticPassword123!";
  try {
    const firstWrite = await first.put("/api/onboarding-v2", { data: {
      version: 2, role: "student", name: "P01 First Student", email, password,
      goal: "First student's private goal", discoveredResumeProfiles: { github: "https://github.com/firstsynthetic" },
    } });
    assert.equal(firstWrite.status(), 200);
    const secondWrite = await second.put("/api/onboarding-v2", { data: {
      version: 2, role: "student", name: "P01 Second Student", goal: "Second student's private goal",
    } });
    assert.equal(secondWrite.status(), 200);
    const firstPerson = (await (await first.get("/api/auth/session")).json()).person.id;
    const secondPerson = (await (await second.get("/api/auth/session")).json()).person.id;
    assert.notEqual(firstPerson, secondPerson);
    assert.equal((await (await second.get("/api/onboarding-v2")).json()).draft.discoveredResumeProfiles?.github, undefined);

    assert.equal((await first.post("/api/auth/sign-out")).status(), 200);
    assert.equal((await (await first.get("/api/auth/session")).json()).authenticated, false);
    const signIn = await first.post("/api/auth/sign-in", { data: { email, password } });
    assert.equal(signIn.status(), 200);
    assert.equal((await (await first.get("/api/auth/session")).json()).person.id, firstPerson);
    const restored = (await (await first.get("/api/onboarding-v2")).json()).draft;
    assert.equal(restored.goal, "First student's private goal");
    assert.equal(restored.discoveredResumeProfiles.github, "https://github.com/firstsynthetic");
    assert.equal((await (await second.get("/api/onboarding-v2")).json()).draft.goal, "Second student's private goal");
    console.log("Neon re-login passed: two owners isolated; logout invalidated session; sign-in restored the same person, draft, and discovered link.");
  } finally {
    await first.dispose();
    await second.dispose();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
