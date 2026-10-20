import assert from "node:assert/strict";
import { initialDraft, safeDraft } from "../lib/onboarding-v2";
import { candidateNames, normalizeImportCandidates } from "../lib/onboarding-import-candidates";
import { onboardingSteps, stepForScreen, TOTAL_ONBOARDING_STEPS } from "../lib/onboarding-step-registry";
import React from "react";
import { renderToString } from "react-dom/server";
import { SkillReview } from "../components/review/SkillReview";
import { SkillsStep } from "../components/onboarding/steps/SkillsStep";
import { EMPTY_ONBOARDING } from "../lib/client/onboarding/types";

const fresh = safeDraft({});
assert.equal(fresh.name, "");
assert.equal(fresh.institution, "");
assert.deepEqual(fresh.skills, []);
assert.deepEqual(fresh.projects, []);
assert.deepEqual(fresh.education, []);
assert.deepEqual(fresh.experiences, []);
assert.deepEqual(fresh.achievements, []);
assert.deepEqual(fresh.profiles, {});
assert.deepEqual(initialDraft.skills, []);
// Phase 3 (P4-13): one registry numbers every step for both the stepper and EORA.
assert.equal(TOTAL_ONBOARDING_STEPS, 11);
assert.deepEqual(onboardingSteps().map((s) => s.screen), [3, 3.2, 3.5, 5, 5.5, 7, 8, 4, 9, 10, 11]);
assert.equal(stepForScreen(2), null, "Welcome is an unnumbered prelude");
assert.equal(stepForScreen(3.2)?.number, 2);
assert.equal(stepForScreen(9)?.number, 9);
assert.equal(stepForScreen(6)?.step.id, "connect_sources", "drafts saved on the retired accounts screen resume on sources");
assert.deepEqual([stepForScreen(5.5)?.stageNumber, stepForScreen(5.5)?.stageTotal, stepForScreen(4)?.stage.id], [2, 4, "refine"]);

const names = candidateNames([
  { name: "Python", sourceReference: "https://example.test/project", confidence: 0.93 },
  "PyTorch",
  { sourceReference: "page-1", confidence: 0.9 },
  { name: "Python" },
  null,
]);
assert.deepEqual(names, ["Python", "PyTorch"]);
assert.equal(names.includes("[object Object]"), false);

const imported = normalizeImportCandidates({
  skills: [{ name: "Python", sourceReference: "https://example.test/repo", confidence: "high" }],
  experiences: [{ title: "Research Intern", company: "Example Lab", sourceReference: "https://example.test/about" }],
  educations: [{ school: "Example University", degree: "BSc", sourceReference: "https://example.test/education" }],
  achievements: [{ title: "Example Award", category: "award", sourceReference: "https://example.test/award" }],
});
assert.deepEqual(imported.skills, ["Python"]);
assert.equal(imported.experiences[0].role, "Research Intern");
assert.equal(imported.educations[0].institution, "Example University");
assert.equal(imported.achievements[0].source, "https://example.test/award");

const draft = safeDraft({
  skills: [{ name: "Python" }, "TypeScript"],
  techCandidates: [{ name: "Go", source: "github", provenance: "SOURCE_EXTRACTED" }],
  projects: [{ id: "p1", title: "Candidate", status: "candidate", technologies: [], sources: ["github"], contribution: [], contributionNote: "" }],
  achievements: [{ title: "Community badge", category: "other", status: "candidate" }],
  profiles: { github: "https://github.com/example", orcid: "https://orcid.org/0000-0000-0000-0000" },
});
assert.deepEqual(draft.skills, ["TypeScript"]);
assert.equal(draft.techCandidates?.[0].name, "Go");
assert.equal(draft.projects[0].status, "candidate");
assert.equal(draft.achievements?.[0].category, "other");
assert.equal(draft.profiles.orcid, "https://orcid.org/0000-0000-0000-0000");

const legacySkill = [{ name: "Python", sourceReference: "page-1", confidence: 0.93 }] as unknown as string[];
const reviewHtml = renderToString(React.createElement(SkillReview, {
  skills: candidateNames(legacySkill), candidates: [], onSkillsChange: () => {}, onCandidatesChange: () => {},
}));
const mapHtml = renderToString(React.createElement(SkillsStep, {
  data: { ...EMPTY_ONBOARDING, skills: legacySkill }, saving: false, guide: null, onBack: () => {}, onContinue: () => {},
}));
assert.match(reviewHtml, /Python/);
assert.match(mapHtml, /Python/);
assert.equal(reviewHtml.includes("[object Object]"), false);
assert.equal(mapHtml.includes("[object Object]"), false);

console.log("Onboarding boundary checks passed: blank draft, candidate mapping, pending state, legacy React skill rendering.");
