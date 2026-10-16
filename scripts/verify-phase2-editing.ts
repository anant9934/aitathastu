/**
 * In-place editing contracts: profile (Task 2.2.2) and skills (Task 2.2.3).
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-phase2-editing.ts
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { and, eq, desc } from "drizzle-orm";
import { useTestDatabase, createTestPerson } from "./lib/test-db";

before(async () => { await useTestDatabase(); });
after(async () => { const { closeDbForTesting } = await import("../lib/db"); await closeDbForTesting(); });

describe("2.2.2 profile edits", () => {
  test("editing graduation year updates person_profiles and adds a version row", async () => {
    const { editProfileDetails } = await import("../lib/services/profile-edit-service");
    const { getDb, personProfiles, personProfileVersions } = await import("../lib/db");
    const personId = await createTestPerson("p2-prof");
    const first = await editProfileDetails(personId, { headline: "ML student", bio: "I build speech tools.", institution: "IIT Madras", expectedGraduationYear: "2027", placementStatus: "actively_applying" });
    assert.deepEqual(first.changed.sort(), ["bio", "expectedGraduationYear", "headline", "institution", "placementStatus"]);
    const second = await editProfileDetails(personId, { expectedGraduationYear: 2028 });
    assert.deepEqual(second.changed, ["expectedGraduationYear"]);
    assert.equal(second.version, (first.version ?? 0) + 1);
    const db = await getDb();
    const [row] = await db.select().from(personProfiles).where(eq(personProfiles.personId, personId));
    assert.equal(row.expectedGraduationYear, 2028);
    assert.equal(row.bio, "I build speech tools.");
    const [latest] = await db.select().from(personProfileVersions).where(eq(personProfileVersions.personId, personId)).orderBy(desc(personProfileVersions.versionNumber)).limit(1);
    assert.equal(latest.changeType, "profile_edited");
    assert.equal(latest.changeSummary, "Edited graduation year");
    assert.equal((latest.snapshot as { expectedGraduationYear: number }).expectedGraduationYear, 2028);
  });
  test("a save that changes nothing writes no version; bad values are rejected by field", async () => {
    const { editProfileDetails, ProfileEditError } = await import("../lib/services/profile-edit-service");
    const personId = await createTestPerson("p2-prof-b");
    await editProfileDetails(personId, { headline: "Same" });
    const again = await editProfileDetails(personId, { headline: "Same" });
    assert.equal(again.version, null);
    await assert.rejects(editProfileDetails(personId, { expectedGraduationYear: "20x7" }), (e: unknown) => e instanceof ProfileEditError && e.field === "expectedGraduationYear");
    await assert.rejects(editProfileDetails(personId, { placementStatus: "rockstar" }), (e: unknown) => e instanceof ProfileEditError && e.field === "placementStatus");
    await assert.rejects(editProfileDetails(personId, { bio: "x".repeat(601) }), (e: unknown) => e instanceof ProfileEditError && e.field === "bio");
  });
});

describe("2.2.3 skill edits", () => {
  test("adding FastAPI records student_reported evidence and raises the tracked count", async () => {
    const { addStudentSkill } = await import("../lib/services/skill-edit-service");
    const { SkillIntelligenceService } = await import("../lib/services/skill-intelligence-service");
    const { getDb, evidenceItems } = await import("../lib/db");
    const personId = await createTestPerson("p2-skill");
    const before = (await SkillIntelligenceService.getSkillsIntelligence(personId)).stats.trackedSkills;
    await addStudentSkill(personId, "FastAPI", "intermediate");
    const after = await SkillIntelligenceService.getSkillsIntelligence(personId);
    assert.equal(after.stats.trackedSkills, before + 1);
    const fastapi = after.skills.find((s) => s.canonicalName.toLowerCase() === "fastapi");
    assert.ok(fastapi, "FastAPI listed");
    assert.equal(fastapi.level, "Claimed", "a self-added skill is a claim, not proof");
    const db = await getDb();
    const rows = await db.select().from(evidenceItems).where(and(eq(evidenceItems.personId, personId), eq(evidenceItems.category, "skill")));
    assert.deepEqual(rows.map((r) => [r.subject, r.source, r.value]), [["FastAPI", "student_reported", "Self-assessed proficiency: intermediate"]]);
  });
  test("proficiency updates in place; hide drops the skill from counts without deleting evidence; remove deletes only the student's row", async () => {
    const { addStudentSkill, setSkillProficiency, setHidden, removeStudentSkill, listStudentSkills } = await import("../lib/services/skill-edit-service");
    const { SkillIntelligenceService } = await import("../lib/services/skill-intelligence-service");
    const { createEvidenceRecord } = await import("../lib/repositories/evidence-repository");
    const { getDb, evidenceItems } = await import("../lib/db");
    const personId = await createTestPerson("p2-skill-b");
    await createEvidenceRecord(personId, { category: "skill", subject: "Docker", value: "Dockerfile in repo", source: "imported", verificationStatus: "imported", originSource: "github", interpretation: "x", whyItMatters: "y", importKey: "gh_docker" });
    await addStudentSkill(personId, "FastAPI");
    await setSkillProficiency(personId, "FastAPI", "advanced");
    assert.deepEqual((await listStudentSkills(personId)).map((s) => [s.name, s.proficiency]), [["FastAPI", "advanced"]]);
    const tracked = async () => (await SkillIntelligenceService.getSkillsIntelligence(personId)).stats.trackedSkills;
    assert.equal(await tracked(), 2);
    await setHidden(personId, "Docker", true);
    assert.equal(await tracked(), 1);
    const db = await getDb();
    const docker = await db.select().from(evidenceItems).where(and(eq(evidenceItems.personId, personId), eq(evidenceItems.importKey, "gh_docker")));
    assert.equal(docker.length, 1, "imported evidence kept");
    await setHidden(personId, "Docker", false);
    assert.equal(await tracked(), 2);
    assert.deepEqual(await removeStudentSkill(personId, "Docker"), { removed: 0 }, "imported rows are not removable");
    assert.deepEqual(await removeStudentSkill(personId, "FastAPI"), { removed: 1 });
    assert.equal(await tracked(), 1);
  });
  test("names and proficiencies are validated", async () => {
    const { addStudentSkill, SkillEditError } = await import("../lib/services/skill-edit-service");
    const personId = await createTestPerson("p2-skill-c");
    for (const bad of ["", "   ", "!!!", "x".repeat(61)]) await assert.rejects(addStudentSkill(personId, bad), SkillEditError);
    await assert.rejects(addStudentSkill(personId, "Rust", "expert"), SkillEditError);
  });
});
