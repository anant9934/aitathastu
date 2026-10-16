/**
 * Data adapters for the one SkillsMap component (Task 3.5.1): the skills API
 * (skills page, dashboard embed), the in-progress onboarding draft (skills
 * review), and the fixed example on the public landing.
 */
import type { MapSkill } from "@/components/skills/SkillsMap";
import type { DrawerGap } from "@/components/skills/SkillDetailPanel";
import type { OnboardingData } from "@/lib/client/onboarding/types";
import { skillEvidence } from "@/lib/client/onboarding/skill-evidence";

export type IntelligenceSkill = {
  name: string; category: string; level: string; isGoalPrerequisite: boolean; observations: { source: string }[];
  dimensions?: { demonstratedApplication?: { projects?: { id: string; title: string }[] } };
  sevenQuestions?: MapSkill["sevenQuestions"] & { whatIsTheVerificationStatus?: { status?: "Pending" | "Corroborated" | "Verified" } };
};

export const toMapSkill = (s: IntelligenceSkill): MapSkill => ({
  name: s.name, category: s.category, level: s.level, isGoalPrerequisite: s.isGoalPrerequisite,
  verificationStatus: s.sevenQuestions?.whatIsTheVerificationStatus?.status as MapSkill["verificationStatus"],
  observations: s.observations ?? [], projects: s.dimensions?.demonstratedApplication?.projects ?? [], sevenQuestions: s.sevenQuestions,
});

export const requiredGaps = (missing: { name: string; relevance: string; suggestedTask: string }[] | undefined): DrawerGap[] =>
  (missing ?? []).filter((g) => g.relevance === "required_core").map((g) => ({ name: g.name, suggestedTask: g.suggestedTask }));

const lc = (s: string) => s.trim().toLowerCase();

/**
 * Onboarding: only skills the person has confirmed go on the map (nothing
 * reaches the profile until it is accepted). Evidence is whatever has arrived
 * so far, so a skill with nothing yet is drawn as "claimed", and a core skill
 * for the role with no confirmed match is a gap. Skills a source found but the
 * person hasn't reviewed are counted separately, not drawn.
 */
export function onboardingMap(data: OnboardingData, skills: string[], corePrerequisites: string[]) {
  const core = new Set(corePrerequisites.map(lc));
  const have = new Set(skills.map(lc));
  const mapSkills: MapSkill[] = skillEvidence(data, skills).map((e) => {
    const category = data.techCandidates.find((c) => lc(c.name) === lc(e.skill))?.category ?? "";
    return {
      name: e.skill,
      category,
      level: "Claimed",
      isGoalPrerequisite: core.has(lc(e.skill)),
      observations: e.items.filter((i) => i.kind !== "project").map((i) => ({ source: i.kind === "cv" ? "resume" : i.source })),
      projects: e.items.filter((i) => i.kind === "project").map((i) => ({ id: lc(i.title).replace(/[^a-z0-9]+/g, "_"), title: i.title })),
      sevenQuestions: {
        whereWasItObserved: { sources: Array.from(new Set(e.items.map((i) => (i.kind === "project" ? `Project: ${i.title}` : i.title)))) },
        whatEvidenceIsMissing: e.items.length ? undefined : { missingPoints: ["Nothing backs this yet. A project that uses it, or a connected account that shows it, will."] },
      },
    };
  });
  const gaps: DrawerGap[] = corePrerequisites.filter((p) => !have.has(lc(p))).map((p) => ({ name: p, suggestedTask: `Add a project that uses ${p}, or confirm it if a source found it.` }));
  const unreviewed = Array.from(new Set(data.techCandidates.filter((c) => c.status === "candidate" && !have.has(lc(c.name))).map((c) => c.name)));
  return { skills: mapSkills, gaps, unreviewed };
}

/** Fixed example for the public landing. Illustrative only; never a real person's data. */
export const LANDING_EXAMPLE: { goal: string; skills: MapSkill[]; gaps: DrawerGap[] } = {
  goal: "Machine Learning Engineer",
  skills: [
    { name: "Python", category: "Languages", level: "Verified", isGoalPrerequisite: true, observations: [{ source: "github" }, { source: "resume" }, { source: "faculty_verified" }], projects: [{ id: "x1", title: "Crop yield model" }] },
    { name: "Machine Learning", category: "AI & ML", level: "Assessed", isGoalPrerequisite: true, observations: [{ source: "github" }, { source: "kaggle" }], projects: [{ id: "x1", title: "Crop yield model" }] },
    { name: "Data Structures", category: "Languages", level: "Demonstrated", isGoalPrerequisite: true, observations: [{ source: "leetcode" }], projects: [] },
    { name: "Deep Learning", category: "AI & ML", level: "Demonstrated", isGoalPrerequisite: false, observations: [{ source: "github" }, { source: "scholar" }], projects: [{ id: "x2", title: "Leaf disease CNN" }] },
    { name: "PyTorch", category: "AI & ML", level: "Demonstrated", isGoalPrerequisite: false, observations: [{ source: "github" }], projects: [{ id: "x2", title: "Leaf disease CNN" }] },
    { name: "Research", category: "Data", level: "Demonstrated", isGoalPrerequisite: false, observations: [{ source: "scholar" }], projects: [] },
    { name: "SQL", category: "Backend", level: "Claimed", isGoalPrerequisite: false, observations: [{ source: "resume" }], projects: [] },
    { name: "Docker", category: "Cloud", level: "Claimed", isGoalPrerequisite: false, observations: [{ source: "self_reported" }], projects: [] },
  ],
  gaps: [{ name: "MLOps", suggestedTask: "" }],
};
