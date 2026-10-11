import assert from "node:assert/strict";
import { initialDraft, safeDraft } from "../lib/onboarding-v2";
import { candidateNames, normalizeImportCandidates } from "../lib/onboarding-import-candidates";
import { getScreenIndexByStepNumber, getStepByScreenIndex, TOTAL_ONBOARDING_STEPS } from "../lib/onboarding-step-registry";
import React from "react";
import { renderToString } from "react-dom/server";
import { Screen8ProfileInsights } from "../components/exact-screens/Screen8ProfileInsights";
import { Screen9SkillsMap } from "../components/exact-screens/Screen9SkillsMap";

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
assert.equal(TOTAL_ONBOARDING_STEPS, 10);
assert.deepEqual(Array.from({ length: 10 }, (_, index) => getScreenIndexByStepNumber(index + 1)), [3, 3.2, 3.5, 5, 4, 6, 7, 8, 10, 11]);
assert.equal(getStepByScreenIndex(9), undefined, "Skills map remains an unnumbered view");

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
const reviewHtml = renderToString(React.createElement(Screen8ProfileInsights, {
  skills: legacySkill, onNext: () => {}, onBack: () => {},
}));
const mapHtml = renderToString(React.createElement(Screen9SkillsMap, {
  skills: legacySkill, onNext: () => {}, onBack: () => {},
}));
assert.match(reviewHtml, /Python/);
assert.match(mapHtml, /Python/);
assert.equal(reviewHtml.includes("[object Object]"), false);
assert.equal(mapHtml.includes("[object Object]"), false);

console.log("Onboarding boundary checks passed: blank draft, candidate mapping, pending state, legacy React skill rendering.");
