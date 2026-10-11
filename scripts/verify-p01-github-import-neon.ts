import assert from "node:assert/strict";
import { request } from "@playwright/test";

async function main() {
  const username = process.env.AUTHORIZED_GITHUB_TEST_USERNAME;
  if (!username) throw new Error("Set AUTHORIZED_GITHUB_TEST_USERNAME to the authorized public account");
  const baseURL = process.env.BASE_URL || "http://127.0.0.1:3102";
  const first = await request.newContext({ baseURL });
  const second = await request.newContext({ baseURL });
  try {
    assert.equal((await first.put("/api/onboarding-v2", { data: { version: 2, role: "student" } })).status(), 200);
    assert.equal((await second.put("/api/onboarding-v2", { data: { version: 2, role: "student" } })).status(), 200);
    const firstPerson = (await (await first.get("/api/auth/session")).json()).person.id;
    const secondPerson = (await (await second.get("/api/auth/session")).json()).person.id;
    assert.notEqual(firstPerson, secondPerson);

    const before = await first.get("/api/student/projects");
    assert.equal(before.status(), 200);
    assert.equal((await before.json()).projects.length, 0);

    const imported = await first.post("/api/student/footprints/sync", { data: {
      provider: "github", identifier: username, consent: true,
    }, timeout: 60_000 });
    const data = await imported.json();
    assert.equal(imported.status(), 200, `GitHub import HTTP ${imported.status()}: ${data.error || "unknown"}`);
    assert.equal(data.success, true);
    assert.equal(data.acquisitionStatus, "OFFICIAL_PUBLIC_API");
    assert.ok(data.candidates.projects.length > 0);
    assert.ok(data.candidates.projects.every((project: { url?: string }) => project.url?.startsWith(`https://github.com/${username}/`)));
    assert.equal((await (await first.get("/api/student/projects")).json()).projects.length, 0, "Unconfirmed GitHub projects were persisted");
    assert.equal((await (await second.get("/api/student/projects")).json()).projects.length, 0, "GitHub projects leaked to second student");
    console.log(JSON.stringify({
      importedCandidateProjects: data.candidates.projects.length,
      importedCandidateSkills: data.candidates.skills.length,
      firstPerson: Boolean(firstPerson),
      secondPersonIsolated: true,
      canonicalProjectsBeforeReview: 0,
    }));
  } finally {
    await first.dispose();
    await second.dispose();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
