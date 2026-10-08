import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { getEvidenceByPersonId } from "../lib/repositories/evidence-repository";
import { getActiveGoal } from "../lib/repositories/goal-repository";
import { resumeDiscovery } from "../lib/resume-suggestions";
import { initialDraft, nextStage, safeDraft, stageConfig, startingPicture, type OnboardingDraft } from "../lib/onboarding-v2";
import { completeOnboarding, readOnboardingDraft, writeOnboardingDraft } from "../lib/services/onboarding-v2-service";

describe("EORA onboarding 2.0", () => {
  let personId: string;
  before(async () => { process.env.PGLITE_IN_MEMORY = "true"; await getDb(); personId = (await createUser({ email: `onboarding_${Date.now()}@example.com`, passwordHash: "test-hash", displayName: "Starting Student" })).personId; });
  it("requires only name, academic context, and goal", () => {
    assert.equal(stageConfig.name.canContinue(initialDraft), false);
    assert.equal(stageConfig.academic.canContinue(initialDraft), false);
    assert.equal(nextStage("name"), "welcome");
    assert.equal(stageConfig.footprints.optional, true);
    assert.equal(startingPicture({ ...initialDraft, skills: ["Python"] }).selfReportedItems[0].verificationStatus, "self_reported");
  });
  it("sanitizes restored drafts", () => { const draft = safeDraft({ ...initialDraft, stage: "invalid", skills: ["Python", 42], profiles: { linkedin: "https://linkedin.com/in/test", unknown: "secret" } }); assert.equal(draft.stage, "name"); assert.deepEqual(draft.skills, ["Python"]); assert.equal((draft.profiles as Record<string, string>).unknown, undefined); });
  it("keeps unsupported roles out of the student workspace", async () => { assert.equal(stageConfig.role.canContinue({ ...initialDraft, role: "faculty" }), false); await assert.rejects(completeOnboarding(personId, { ...initialDraft, role: "faculty", name: "Alex", degree: "B.Tech", specialization: "Computer Science", year: "3rd Year", goal: "Research" }), /coming soon/); });
  it("extracts reviewable project and certification suggestions", () => { const found = resumeDiscovery("Projects\nSmart Proctoring System\nCertifications\nCloud Fundamentals\nSkills\nPython"); assert.deepEqual(found.projects, ["Smart Proctoring System"]); assert.deepEqual(found.certifications, ["Cloud Fundamentals"]); });
  it("saves and resumes an authenticated draft", async () => { const draft: OnboardingDraft = { ...initialDraft, name: "Alex", stage: "resume", degree: "B.Tech", specialization: "Computer Science", year: "3rd Year" }; await writeOnboardingDraft(personId, draft); assert.equal((await readOnboardingDraft(personId))?.stage, "resume"); });
  it("imports only confirmed claims as unverified or self-reported", async () => { const draft: OnboardingDraft = { ...initialDraft, stage: "reveal", name: "Alex", degree: "B.Tech", specialization: "Computer Science", year: "3rd Year", resume: "processed", resumeSuggestions: { education: "", skills: "Python, TensorFlow", experience: "Unconfirmed project" }, skills: ["Python"], certifications: ["Cloud course"], projects: [{ id: "confirmed", title: "Useful Model", technologies: ["Python"], sources: ["Public GitHub", "Resume"], status: "confirmed", contribution: ["Testing"], contributionNote: "I tested the model" }, { id: "suggested", title: "Not confirmed", technologies: [], sources: ["Resume"], status: "suggested", contribution: [], contributionNote: "" }], profiles: { github: "https://github.com/alex" }, goal: "ML Engineer" }; await completeOnboarding(personId, draft); const evidence = await getEvidenceByPersonId(personId); assert.ok(evidence.some(e => e.category === "skill" && e.subject === "Python" && e.verificationStatus === "self_reported")); assert.ok(!evidence.some(e => e.subject === "TensorFlow" || e.subject === "Not confirmed")); assert.ok(evidence.some(e => e.category === "project" && e.subject === "Useful Model" && e.verificationStatus === "self_reported")); assert.ok(evidence.some(e => e.category === "other" && e.subject.includes("Personal contribution") && e.value.includes("Testing") && e.verificationStatus === "self_reported")); assert.ok(evidence.every(e => e.verificationStatus !== "verified")); assert.equal((await getActiveGoal(personId))?.title, "ML Engineer"); assert.equal((await readOnboardingDraft(personId))?.completed, true); });
});
