/**
 * Onboarding draft, connection and evidence ownership — against a disposable
 * LOCAL database only (scripts/lib/test-db.ts refuses hosted hosts and falls
 * back to in-memory PGlite).
 *
 *   node --import tsx --test scripts/verify-onboarding-ownership.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";

before(async () => { await setupTestDatabase(); });
after(async () => { const { closeDbForTesting } = await import("../lib/db"); await closeDbForTesting(); });

test("an empty string removes a saved link and a dismissed CV-found link from the draft", async () => {
  const { writeOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
  const personId = await createTestPerson("draft-links");
  await writeOnboardingDraft(personId, {
    profiles: { github: "https://github.com/octocat", kaggle: "https://www.kaggle.com/someone" },
    discoveredResumeProfiles: { orcid: "https://orcid.org/0000-0002-1825-0097", leetcode: "https://leetcode.com/u/someone" },
  });
  await writeOnboardingDraft(personId, {
    profiles: { github: "" },
    discoveredResumeProfiles: { orcid: "" },
    dismissedFootprintProviders: ["orcid"],
  });
  const d = (await readOnboardingDraft(personId)) as Record<string, any>;
  assert.equal(d.profiles.github, undefined, "removed link is gone after reload");
  assert.equal(d.profiles.kaggle, "https://www.kaggle.com/someone", "other links untouched");
  assert.equal(d.discoveredResumeProfiles.orcid, undefined, "dismissed CV link is gone after reload");
  assert.equal(d.discoveredResumeProfiles.leetcode, "https://leetcode.com/u/someone");
  assert.deepEqual(d.dismissedFootprintProviders, ["orcid"]);
});

test("a system (CV seed) write never deletes or overwrites what the student set", async () => {
  const { writeOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
  const personId = await createTestPerson("draft-system");
  await writeOnboardingDraft(personId, { discoveredResumeProfiles: { github: "https://github.com/edited" } });
  await writeOnboardingDraft(personId, { discoveredResumeProfiles: { github: "https://github.com/from-cv", kaggle: "" } }, { origin: "system" });
  const d = (await readOnboardingDraft(personId)) as Record<string, any>;
  assert.equal(d.discoveredResumeProfiles.github, "https://github.com/edited");
});

test("disconnecting keeps confirmed evidence; reconnecting reuses the same connection", async () => {
  const { saveExternalConnection, disconnectConnection, getExternalConnectionByProvider, getExternalConnections } = await import("../lib/repositories/connection-repository");
  const { createEvidenceRecord, getEvidenceByPersonId } = await import("../lib/repositories/evidence-repository");
  const personId = await createTestPerson("disconnect");
  await saveExternalConnection({ personId, provider: "kaggle", externalUsername: "someone", profileUrl: "https://www.kaggle.com/someone", status: "connected" });
  await createEvidenceRecord(personId, {
    category: "skill", subject: "Pandas", value: "Notebook evidence", source: "platform_imported" as never,
    verificationStatus: "self_reported" as never, interpretation: "test", whyItMatters: "test", importKey: "kaggle:pandas", originSource: "kaggle",
  });
  const before = (await getEvidenceByPersonId(personId)).length;

  await disconnectConnection(personId, "kaggle");
  assert.equal((await getExternalConnectionByProvider(personId, "kaggle"))?.status, "disconnected");
  assert.equal((await getEvidenceByPersonId(personId)).length, before, "no evidence deleted by disconnect");

  await saveExternalConnection({ personId, provider: "kaggle", externalUsername: "someone", profileUrl: "https://www.kaggle.com/someone", status: "connected" });
  const rows = (await getExternalConnections(personId)).filter((c) => c.provider === "kaggle");
  assert.equal(rows.length, 1, "reconnect does not duplicate the connection");
  assert.equal(rows[0].status, "connected");
});

test("one student's connections and draft are invisible to another", async () => {
  const { saveExternalConnection, getExternalConnections, disconnectConnection, getExternalConnectionByProvider } = await import("../lib/repositories/connection-repository");
  const { writeOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
  const a = await createTestPerson("iso-a");
  const b = await createTestPerson("iso-b");
  await saveExternalConnection({ personId: a, provider: "github", externalUsername: "alice", profileUrl: "https://github.com/alice", status: "connected" });
  await writeOnboardingDraft(a, { profiles: { github: "https://github.com/alice" } });

  assert.equal((await getExternalConnections(b)).length, 0);
  assert.deepEqual(((await readOnboardingDraft(b)) as Record<string, any> | null)?.profiles ?? {}, {});
  await disconnectConnection(b, "github");
  assert.equal((await getExternalConnectionByProvider(a, "github"))?.status, "connected", "B's disconnect cannot touch A's connection");
});
