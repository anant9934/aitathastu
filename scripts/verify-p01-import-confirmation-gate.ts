import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getDb, evidenceItems, projects, sourceSnapshots } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { DigitalSourceImportOrchestrator } from "../lib/services/digital-source-import-orchestrator";

async function main() {
  const user = await createUser({
    email: `candidate-gate-${Date.now()}@example.test`,
    passwordHash: "synthetic-test-only",
    displayName: "Fictional Student",
  });
  const db = await getDb();
  const countCanonical = async () => ({
    evidence: (await db.select().from(evidenceItems).where(eq(evidenceItems.personId, user.personId))).length,
    projects: (await db.select().from(projects).where(eq(projects.personId, user.personId))).length,
  });
  const baseline = await countCanonical();

  const reference = await DigitalSourceImportOrchestrator.startImport({
    personId: user.personId,
    provider: "linkedin",
    identifier: "https://www.linkedin.com/in/fictional-student",
    consent: true,
  });
  assert.equal(reference.acquisitionMode, "MANUAL_PROFILE_REFERENCE");
  assert.equal(reference.recordsCreated, 0);
  assert.equal(reference.candidateCount, 0);
  assert.deepEqual(await countCanonical(), baseline, "A profile URL must not create evidence");

  const exportData = JSON.stringify({
    positions: [{ title: "Research Intern", companyName: "Fictional Lab" }],
    education: [{ schoolName: "Fictional University", degreeName: "BSc" }],
    skills: [{ name: "Python" }],
    projects: [{ title: "Synthetic Project", url: "https://example.test/project" }],
    certifications: [{ name: "Fictional Certificate" }],
  });
  const imported = await DigitalSourceImportOrchestrator.startImport({
    personId: user.personId,
    provider: "linkedin",
    exportFilename: "fictional-export.json",
    exportContent: exportData,
    consent: true,
  });
  assert.equal(imported.acquisitionMode, "AUTHORIZED_USER_EXPORT");
  assert.equal(imported.candidateCount, 5);
  assert.equal(imported.recordsCreated, 0);
  assert.equal(imported.evidenceCount, 0);
  assert.deepEqual(await countCanonical(), baseline, "Unconfirmed import candidates must not create canonical rows");
  const snapshots = await db.select().from(sourceSnapshots).where(eq(sourceSnapshots.personId, user.personId));
  assert.equal(snapshots.length, 2, "Reference and export snapshots remain person-owned");
  console.log("Import confirmation gate passed: URL and five export candidates produced no canonical evidence or projects.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
