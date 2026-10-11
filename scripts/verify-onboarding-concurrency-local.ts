import assert from "node:assert/strict";
import { request } from "@playwright/test";

async function main() {
  const baseURL = process.env.BASE_URL || "http://127.0.0.1:3101";
  const first = await request.newContext({ baseURL });
  const second = await request.newContext({ baseURL });
  try {
    assert.equal((await first.put("/api/onboarding-v2", { data: { version: 2, role: "student" } })).status(), 200);
    assert.equal((await second.put("/api/onboarding-v2", { data: { version: 2, role: "student" } })).status(), 200);
    const firstPerson = (await (await first.get("/api/auth/session")).json()).person.id;
    const secondPerson = (await (await second.get("/api/auth/session")).json()).person.id;
    assert.notEqual(firstPerson, secondPerson);

    for (let round = 0; round < 20; round++) {
      const name = `Synthetic Concurrent ${round}`;
      const goal = `Synthetic Goal ${round}`;
      const [nameWrite, goalWrite] = await Promise.all([
        first.put("/api/onboarding-v2", { data: { version: 2, name } }),
        first.put("/api/onboarding-v2", { data: { version: 2, goal } }),
      ]);
      assert.equal(nameWrite.status(), 200);
      assert.equal(goalWrite.status(), 200);
      const draft = (await (await first.get("/api/onboarding-v2")).json()).draft;
      assert.equal(draft.name, name, `Concurrent name lost in round ${round}`);
      assert.equal(draft.goal, goal, `Concurrent goal lost in round ${round}`);
      assert.equal((await (await first.get("/api/auth/session")).json()).person.id, firstPerson);
      assert.equal((await (await second.get("/api/auth/session")).json()).person.id, secondPerson);
    }
    const secondDraft = (await (await second.get("/api/onboarding-v2")).json()).draft;
    assert.equal(secondDraft.name, "");
    assert.equal(secondDraft.goal, "");
    console.log("Concurrent draft writes preserved both fields across 20 rounds and two student identities stayed isolated.");
  } finally {
    await first.dispose();
    await second.dispose();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
