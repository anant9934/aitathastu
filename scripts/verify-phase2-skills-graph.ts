/**
 * Skills Intelligence Map layout (Task 2.4.1): no label or node collisions at
 * any size, honest statuses, and claims never drawn as evidence.
 *
 *   node --import tsx --test scripts/verify-phase2-skills-graph.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutSkillsGraph, footprint, overlaps, statusOf, neighbours, type GraphSkillInput } from "../lib/domain/skills-graph-layout";

const CATS = ["AI & ML", "GenAI", "Data", "Backend", "Languages", "Cloud", "Tools", "Other"];
const SOURCES = ["github", "resume", "leetcode", "kaggle", "assessment", "self_reported"];
function skills(n: number): GraphSkillInput[] {
  return Array.from({ length: n }, (_, i) => ({
    name: i % 7 === 0 ? `Very Long Skill Name Number ${i} With Extra Words` : `Skill ${i}`,
    category: CATS[i % CATS.length],
    level: ["Claimed", "Exposure recorded", "Demonstrated", "Assessed", "Verified"][i % 5],
    isGoalPrerequisite: i % 4 === 0,
    observations: SOURCES.slice(0, (i % SOURCES.length) + 1).map((source) => ({ source })),
    projects: i % 3 === 0 ? [{ id: `p${i % 5}`, title: `Project ${i % 5}` }] : [],
  }));
}

function collisions(n: number, gaps = 3) {
  const layout = layoutSkillsGraph({ goal: "Machine Learning Engineer", skills: skills(n), gaps: Array.from({ length: gaps }, (_, i) => ({ name: `Gap ${i}`, category: "AI & ML" })) });
  const bad: string[] = [];
  for (let i = 0; i < layout.nodes.length; i++)
    for (let j = i + 1; j < layout.nodes.length; j++)
      if (overlaps(footprint(layout.nodes[i]), footprint(layout.nodes[j]), 0)) bad.push(`${layout.nodes[i].label} × ${layout.nodes[j].label}`);
  for (const c of layout.clusters) for (const n of layout.nodes) if (overlaps(c.box, footprint(n), 0)) bad.push(`cluster ${c.label} × ${n.label}`);
  return { layout, bad };
}

for (const n of [0, 1, 6, 20, 45, 60]) {
  test(`no label or node collisions with ${n} skills`, () => {
    const { layout, bad } = collisions(n);
    assert.deepEqual(bad, []);
    assert.ok(layout.nodes.some((x) => x.kind === "goal"));
    for (const node of layout.nodes) assert.ok(node.label.length <= 30, node.label);
  });
}

test("statuses: faculty verified, corroborated by two sources, evidenced by one, claimed by CV or self only, gap when required and absent", () => {
  const base = { category: "AI & ML", isGoalPrerequisite: false, projects: [] };
  assert.equal(statusOf({ ...base, name: "a", level: "Verified", observations: [] }), "verified");
  assert.equal(statusOf({ ...base, name: "b", level: "Exposure recorded", observations: [{ source: "github" }, { source: "kaggle" }] }), "corroborated");
  assert.equal(statusOf({ ...base, name: "c", level: "Exposure recorded", observations: [{ source: "github" }] }), "evidenced");
  assert.equal(statusOf({ ...base, name: "d", level: "Claimed", observations: [{ source: "resume" }, { source: "self_reported" }] }), "claimed");
  const layout = layoutSkillsGraph({ goal: "ML Engineer", skills: [], gaps: [{ name: "Docker", category: "Tools" }] });
  assert.equal(layout.nodes.find((x) => x.fullLabel === "Docker")?.status, "gap");
});

test("a self-claim is never an evidence node; shared sources are one node linked to every skill they back", () => {
  const layout = layoutSkillsGraph({
    goal: "ML Engineer", gaps: [],
    skills: [
      { name: "Python", category: "Languages", level: "Exposure recorded", isGoalPrerequisite: true, observations: [{ source: "github" }, { source: "self_reported" }], projects: [] },
      { name: "PyTorch", category: "AI & ML", level: "Exposure recorded", isGoalPrerequisite: false, observations: [{ source: "github" }], projects: [{ id: "x", title: "rag-notes" }] },
    ],
  });
  const ev = layout.nodes.filter((x) => x.kind === "evidence").map((x) => x.fullLabel).sort();
  assert.deepEqual(ev, ["GitHub", "rag-notes"]);
  assert.deepEqual([...neighbours(layout, "ev_github")].sort(), ["ev_github", "skill_python", "skill_pytorch"]);
});
