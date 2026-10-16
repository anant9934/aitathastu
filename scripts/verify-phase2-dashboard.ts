/**
 * Priority-shaped dashboard contracts (Tasks 2.3.1, 2.3.2, 2.2.1).
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-phase2-dashboard.ts
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { useTestDatabase, createTestPerson } from "./lib/test-db";
import { composeDashboardLayout, type DashboardLayoutInput } from "../lib/domain/dashboard-layout";

before(async () => { await useTestDatabase(); });
after(async () => { const { closeDbForTesting } = await import("../lib/db"); await closeDbForTesting(); });

const base: DashboardLayoutInput = {
  primary: "learning", secondary: [], targetRole: "ML Engineer", readiness: null,
  skillGaps: ["MLOps", "Docker"], learning: [{ title: "Finish the PyTorch basics module" }], publications: 0,
  projects: [{ id: "p1", title: "rag-notes", portfolioIncluded: true, updatedAt: "2026-10-01T00:00:00Z", sources: ["github"] }],
  footprints: {
    github: { connected: true, state: "succeeded", found: "6 repositories read" },
    leetcode: { connected: true, state: "succeeded", found: "312 problems solved" },
    scholar: { connected: true, state: "succeeded", found: "2 papers found" },
    linkedin: { connected: true, state: "succeeded", found: "2 roles, 1 school" },
  },
};

describe("2.3.1 layouts genuinely reshape by #1 priority", () => {
  test("jobs, projects and learning get different hero widgets, CTAs and section sets", () => {
    const jobs = composeDashboardLayout({ ...base, primary: "jobs" });
    const projects = composeDashboardLayout({ ...base, primary: "projects" });
    const learning = composeDashboardLayout({ ...base, primary: "learning" });
    assert.deepEqual([jobs.hero.kind, projects.hero.kind, learning.hero.kind], ["readiness", "project_workbench", "learning_path"]);
    assert.deepEqual([jobs.hero.cta.label, projects.hero.cta.label, learning.hero.cta.label], ["Build my application pack", "Open my project ledger", "Open my learning roadmap"]);
    assert.deepEqual(jobs.sections.map((s) => s.id), ["skill_gaps", "portfolio", "footprint", "opportunities", "journey"]);
    assert.deepEqual(projects.sections.map((s) => s.id), ["portfolio", "footprint", "skill_gaps", "roadmap"]);
    assert.deepEqual(learning.sections.map((s) => s.id), ["roadmap", "practice", "skill_gaps", "portfolio"]);
    const sets = [jobs, projects, learning].map((l) => l.sections.map((s) => s.id).join());
    assert.equal(new Set(sets).size, 3, "three distinct structures, not one reordered list");
  });
  test("jobs hero states honestly when there is no verified readiness score", () => {
    const jobs = composeDashboardLayout({ ...base, primary: "jobs" });
    assert.equal(jobs.hero.kind === "readiness" && jobs.hero.readiness, null);
    assert.match((jobs.hero as { note: string }).note, /Not enough verified evidence/);
  });
});

describe("2.3.2 footprint weighted by priorities", () => {
  test("research puts Scholar first, learning puts practice sites first, collaboration puts LinkedIn first; each card says why", () => {
    const research = composeDashboardLayout({ ...base, primary: "research_events" }).footprint;
    const learning = composeDashboardLayout({ ...base, primary: "learning" }).footprint;
    const collab = composeDashboardLayout({ ...base, primary: "collaboration" }).footprint;
    assert.equal(research[0].source, "scholar");
    assert.equal(research[0].headline, "2 papers found");
    assert.equal(learning[0].source, "leetcode");
    assert.equal(collab[0].source, "linkedin");
    assert.match(research[0].reason, /^Ranked for research/);
  });
  test("secondary priorities break ties", () => {
    const a = composeDashboardLayout({ ...base, primary: "projects", secondary: ["research_events"] }).footprint.map((c) => c.source);
    const b = composeDashboardLayout({ ...base, primary: "projects", secondary: ["learning"] }).footprint.map((c) => c.source);
    assert.ok(a.indexOf("scholar") < a.indexOf("leetcode"), a.join());
    assert.ok(b.indexOf("leetcode") < b.indexOf("scholar"), b.join());
  });
});

describe("dashboard service wiring", () => {
  test("a real student's composition carries the layout for their saved priority", async () => {
    const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
    const { getStudentDashboardComposition } = await import("../lib/services/dashboard-service");
    const personId = await createTestPerson("p2-dash");
    await completeOnboarding(personId, {
      role: "student", name: "Dash", targetRole: "ML Engineer", institution: "IIT Delhi", degree: "B.Tech",
      priorities: ["projects", "learning"], primaryPriority: "projects", skills: ["Python"],
      projects: [{ id: "p1", title: "rag-notes", description: "x", technologies: ["Python"], sources: ["github"], status: "confirmed", contribution: [], contributionNote: "" }],
    });
    const model = await getStudentDashboardComposition(personId);
    assert.equal(model.layout?.archetype, "projects");
    assert.equal(model.layout?.hero.kind, "project_workbench");
    assert.deepEqual((model.layout?.hero as { projects: { title: string; inPortfolio: boolean }[] }).projects, [{ id: (model.layout?.hero as { projects: { id: string }[] }).projects[0].id, title: "rag-notes", inPortfolio: true }]);
  });
});
