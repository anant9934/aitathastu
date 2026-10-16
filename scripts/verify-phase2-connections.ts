/**
 * Connections management (Task 2.2.5): badges, handle validation, record
 * counts, and disconnect purging stored credentials. No network.
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-phase2-connections.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTestDatabase, createTestPerson } from "./lib/test-db";

before(async () => { await useTestDatabase(); });
after(async () => { const { closeDbForTesting } = await import("../lib/db"); await closeDbForTesting(); });

test("badges: not connected, disconnected, syncing, needs re-auth, reference only, connected", async () => {
  const { badgeFor } = await import("../lib/services/connection-manager-service");
  assert.equal(badgeFor(null, null), "not_connected");
  assert.equal(badgeFor({ status: "disconnected" }, { state: "running" }), "disconnected");
  assert.equal(badgeFor({ status: "connected" }, { state: "running" }), "syncing");
  assert.equal(badgeFor({ status: "connected" }, { state: "queued" }), "syncing");
  assert.equal(badgeFor({ status: "connected" }, { state: "dead_letter", action: "reconnect" }), "needs_reauth");
  assert.equal(badgeFor({ status: "connected" }, { state: "dead_letter", action: "retry" }), "connected");
  assert.equal(badgeFor({ status: "reference_only" }, { state: "succeeded" }), "reference_only");
  assert.equal(badgeFor({ status: "detected" }, null), "connected");
});

test("every managed platform is listed, with records imported per source", async () => {
  const { listManagedConnections, updateHandle } = await import("../lib/services/connection-manager-service");
  const { createEvidenceRecord } = await import("../lib/repositories/evidence-repository");
  const personId = await createTestPerson("p2-conn");
  await updateHandle(personId, "leetcode", "https://leetcode.com/u/kavya_r/");
  for (const s of ["Python", "SQL"]) await createEvidenceRecord(personId, { category: "skill", subject: s, value: s, source: "imported", verificationStatus: "imported", originSource: "leetcode", interpretation: "x", whyItMatters: "y", importKey: `lc_${s}` });
  const rows = await listManagedConnections(personId);
  assert.deepEqual(rows.map((r) => r.source), ["github", "linkedin", "leetcode", "hackerrank", "kaggle", "scholar"]);
  const lc = rows.find((r) => r.source === "leetcode")!;
  assert.deepEqual([lc.badge, lc.handle, lc.recordsImported, lc.canSync, lc.canDisconnect], ["connected", "kavya_r", 2, true, true]);
  assert.equal(rows.find((r) => r.source === "kaggle")!.badge, "not_connected");
  assert.equal(rows.find((r) => r.source === "linkedin")!.canSync, false, "LinkedIn imports once; no Sync now");
});

test("handles are validated: pasted URLs, wrong hosts, bad characters, ORCID checksum", async () => {
  const { updateHandle, ConnectionManagerError } = await import("../lib/services/connection-manager-service");
  const personId = await createTestPerson("p2-conn-b");
  assert.deepEqual(await updateHandle(personId, "hackerrank", "@kavya_r"), { source: "hackerrank", handle: "kavya_r" });
  await assert.rejects(updateHandle(personId, "kaggle", "https://evil.example/kavya"), ConnectionManagerError);
  await assert.rejects(updateHandle(personId, "kaggle", "kavya r!"), ConnectionManagerError);
  await assert.rejects(updateHandle(personId, "github", "kavya"), /signing in with GitHub/);
  await assert.rejects(updateHandle(personId, "scholar", "0000-0002-1825-0098"), ConnectionManagerError, "bad ORCID checksum rejected");
  assert.deepEqual(await updateHandle(personId, "scholar", "https://orcid.org/0000-0002-1825-0097"), { source: "scholar", handle: "0000-0002-1825-0097" });
});

test("disconnect purges stored credentials and stops sync; imported records stay", async () => {
  const { disconnectManaged, listManagedConnections, assertSyncable } = await import("../lib/services/connection-manager-service");
  const { saveExternalConnection, getExternalConnectionByProvider } = await import("../lib/repositories/connection-repository");
  const { createEvidenceRecord } = await import("../lib/repositories/evidence-repository");
  const personId = await createTestPerson("p2-conn-c");
  await saveExternalConnection({ personId, provider: "kaggle", externalUsername: "kavya", profileUrl: "https://www.kaggle.com/kavya", status: "connected", metadata: { encryptedApiKey: "enc:secret" } });
  await createEvidenceRecord(personId, { category: "skill", subject: "Pandas", value: "x", source: "imported", verificationStatus: "imported", originSource: "kaggle", interpretation: "x", whyItMatters: "y", importKey: "kg_pandas" });
  await disconnectManaged(personId, "kaggle");
  const conn = await getExternalConnectionByProvider(personId, "kaggle");
  assert.equal(conn?.status, "disconnected");
  assert.deepEqual(conn?.metadata, {}, "encrypted API key purged");
  const row = (await listManagedConnections(personId)).find((r) => r.source === "kaggle")!;
  assert.deepEqual([row.badge, row.handle, row.canSync, row.recordsImported], ["disconnected", null, false, 1]);
  await assert.rejects(assertSyncable(personId, "kaggle"), /Connect Kaggle first/);
});
