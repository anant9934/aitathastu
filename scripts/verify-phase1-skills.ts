/** Tasks 1.3.1 / 1.3.2: deterministic evidence-based confidence + the 7 explainability answers. */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";
import { scoreSkillConfidence, type ScoringObservation } from "../lib/domain/skill-confidence";

const o = (id: string, source: string, sourceType: string): ScoringObservation => ({ id, source, sourceType });
const none = { projects: [], personalContributionConfirmed: false };

describe("1.3.1 scoring tiers", () => {
  test("Tier 1: faculty verification or graded assessment = 1.0", () => {
    assert.deepEqual(scoreSkillConfidence([o("e1", "faculty_verified", "faculty_verification")], none)?.score, 1);
    const r = scoreSkillConfidence([o("e2", "assessment", "graded_assessment"), o("e3", "resume", "resume_mention")], none)!;
    assert.deepEqual([r.tier, r.label, r.score], [1, "Verified", 1]);
    assert.deepEqual(r.breakdown[0].evidenceIds, ["e2"]);
  });

  test("Tier 2: resume + GitHub corroborate (0.80); a third source adds 0.05; capped at 0.90", () => {
    assert.equal(scoreSkillConfidence([o("a", "resume", "resume_mention"), o("b", "github", "manifest_declared")], none)!.score, 0.8);
    assert.equal(scoreSkillConfidence([o("a", "resume", "resume_mention"), o("b", "github", "manifest_declared"), o("c", "kaggle", "project_applied")], none)!.score, 0.85);
    const many = scoreSkillConfidence(["resume", "github", "kaggle", "scholar", "leetcode"].map((s, i) => o(`x${i}`, s, s === "leetcode" ? "platform_badge" : "project_applied")), none)!;
    assert.equal(many.score, 0.9);
    assert.equal(many.tier, 2);
  });

  test("Tier 2: a verified platform badge alone (HackerRank Python stars)", () => {
    const r = scoreSkillConfidence([o("hr", "hackerrank", "platform_badge")], none)!;
    assert.deepEqual([r.tier, r.score, r.breakdown[0].factor], [2, 0.8, "Verified platform badge"]);
  });

  test("Tier 3: one GitHub manifest (0.60), more repos (+0.05 each, max 2), confirmed contribution (+0.05); capped 0.75", () => {
    assert.equal(scoreSkillConfidence([o("g", "github", "manifest_declared")], none)!.score, 0.6);
    const r = scoreSkillConfidence([o("g1", "github", "manifest_declared"), o("g2", "github", "manifest_declared"), o("g3", "github", "source_code")],
      { projects: [{ id: "p1", repositoryUrl: "https://github.com/a/1" }], personalContributionConfirmed: true })!;
    assert.deepEqual([r.tier, r.score], [3, 0.75]);
  });

  test("Tier 3, not 2: a CV's own project section does not corroborate the same CV", () => {
    const r = scoreSkillConfidence([o("cv", "resume", "resume_mention"), o("p", "project", "project_applied")], { projects: [{ id: "p1", repositoryUrl: null }], personalContributionConfirmed: false })!;
    assert.equal(r.tier, 3);
    assert.deepEqual(r.independentSources, ["resume"]);
  });

  test("Tier 4: CV skills list only 0.45; self-claim only 0.35; LinkedIn skills are self-claims", () => {
    assert.deepEqual([scoreSkillConfidence([o("cv", "resume", "resume_mention")], none)!.tier, scoreSkillConfidence([o("cv", "resume", "resume_mention")], none)!.score], [4, 0.45]);
    assert.equal(scoreSkillConfidence([o("s", "self_reported", "self_claim")], none)!.score, 0.35);
    assert.equal(scoreSkillConfidence([o("cv", "resume", "resume_mention"), o("li", "linkedin", "self_claim")], none)!.score, 0.5);
    assert.equal(scoreSkillConfidence([o("li", "linkedin", "self_claim"), o("s", "self_reported", "self_claim")], none)!.tier, 4, "LinkedIn + onboarding never corroborate");
  });

  test("no evidence, no score (never a placeholder number); deterministic", () => {
    assert.equal(scoreSkillConfidence([], none), null);
    const obs = [o("a", "resume", "resume_mention"), o("b", "github", "manifest_declared")];
    assert.deepEqual(scoreSkillConfidence(obs, none), scoreSkillConfidence(obs, none));
  });
});

describe("1.3.1 / 1.3.2 through getSkillsIntelligence (local Postgres)", () => {
  let schema: typeof import("../lib/db");
  before(async () => { await setupTestDatabase(); schema = await import("../lib/db"); });
  after(async () => { await schema.closeDbForTesting(); });

  test("scores come from real evidence; platform scores are not graded assessments; every skill answers all 7 questions with ids", async () => {
    const personId = await createTestPerson("skills");
    const { writeEvidenceBatch } = await import("../lib/repositories/evidence-repository");
    const { saveProject } = await import("../lib/repositories/project-repository");
    const base = { interpretation: "x", whyItMatters: "y" };
    await writeEvidenceBatch(personId, [
      { ...base, category: "skill", subject: "React", value: "React", source: "imported", verificationStatus: "unverified", importKey: "github_skill_gh_1_react", sourceReference: "https://github.com/a/app#package.json" },
      { ...base, category: "skill", subject: "React", value: "React", source: "resume_extracted", verificationStatus: "unverified", importKey: "resume:doc:skill:React" },
      { ...base, category: "skill", subject: "Python", value: "4 stars", source: "imported", verificationStatus: "imported", importKey: "hackerrank_badge_python", originSource: "hackerrank" },
      { ...base, category: "assessment", subject: "LeetCode Contest Rating", value: "1687", source: "imported", verificationStatus: "imported", importKey: "leetcode_contest_rating", originSource: "leetcode" },
      { ...base, category: "skill", subject: "Docker", value: "Docker", source: "resume_extracted", verificationStatus: "unverified", importKey: "resume:doc:skill:Docker" },
    ]);
    const proj = await saveProject(personId, { title: "Web App", sources: ["github"], repositoryUrl: "https://github.com/a/app", technologies: ["React"], status: "confirmed" });
    const { SkillIntelligenceService } = await import("../lib/services/skill-intelligence-service");
    const restore = console.log; console.log = () => {};
    const intel = await SkillIntelligenceService.getSkillsIntelligence(personId).finally(() => { console.log = restore; });
    const by = Object.fromEntries(intel.skills.map((s) => [s.name, s]));
    assert.ok(by.React && by.Python && by.Docker, `skills: ${Object.keys(by).join(", ")}`);
    assert.deepEqual([by.React.confidence?.tier, by.React.confidence?.score], [2, 0.8], "resume + GitHub");
    assert.deepEqual([by.Python.confidence?.tier, by.Python.confidence?.label], [2, "Corroborated"], "HackerRank badge");
    assert.deepEqual([by.Docker.confidence?.tier, by.Docker.confidence?.score], [4, 0.45], "CV list only");
    const contest = intel.skills.find((s) => /contest/i.test(s.name));
    assert.ok(!contest || contest.confidence?.tier !== 1, "a LeetCode contest rating is not a Tier-1 graded assessment");

    for (const s of intel.skills) {
      const q = s.sevenQuestions;
      assert.ok(q.whatIsThisSkill.definition, `${s.name}: definition`);
      assert.ok(q.whereWasItObserved.observations.every((x) => x.evidenceId), `${s.name}: observations carry evidence ids`);
      assert.ok(["Pending", "Corroborated", "Verified"].includes(q.whatIsTheVerificationStatus.status));
      assert.ok(q.howDoesItRelateToGoal.relevance && q.howDoesItRelateToGoal.explanation);
      assert.ok(Array.isArray(q.whatAreDemonstratedProjects.projectIds));
      assert.ok(Array.isArray(q.whatAreDemonstratedCodeArtifacts.files));
      assert.match(q.whatShouldStudentLearnOrProveNext.href, /^\/student\/roadmap#skill-/);
    }
    assert.deepEqual(by.React.sevenQuestions.whatAreDemonstratedProjects.projectIds, [proj.id], "linked by projects.id");
    assert.deepEqual(by.React.sevenQuestions.whatAreDemonstratedCodeArtifacts.files, ["https://github.com/a/app#package.json"]);
    assert.equal(by.React.sevenQuestions.whatIsTheVerificationStatus.status, "Corroborated");
    assert.ok(by.React.sevenQuestions.whatIsTheVerificationStatus.evidenceIds.length >= 2);
  });
});
