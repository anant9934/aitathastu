/**
 * Phase 2 onboarding contracts (Task 2.1.1): the "big goal / timeline"
 * question is gone from the draft schema and from everything downstream.
 * Drafts saved before the change still load; their stale fields are dropped.
 *
 *   node --import tsx --test scripts/verify-phase2-onboarding.ts
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { useTestDatabase, createTestPerson } from "./lib/test-db";

const LEGACY = {
  role: "student", name: "Legacy Draft", targetRole: "ML Engineer", targetRoleId: "ml_engineer",
  goal: "Get an AI/ML internship", targetTimeline: "Within 6 months", customGoalText: "ship a RAG app",
  priorities: ["learning"], primaryPriority: "learning", resume: "skipped",
};

before(async () => { await useTestDatabase(); });
after(async () => { const { closeDbForTesting } = await import("../lib/db"); await closeDbForTesting(); });

describe("2.1.1 big goal / timeline removed", () => {
  test("the draft sanitizer drops goal, targetTimeline and customGoalText", async () => {
    const { safeDraft } = await import("../lib/onboarding-v2");
    const draft = safeDraft(LEGACY) as Record<string, unknown>;
    for (const key of ["goal", "targetTimeline", "customGoalText"]) assert.equal(key in draft, false, key);
    assert.equal(draft.targetRole, "ML Engineer");
  });

  test("a draft saved before the change still loads, without the removed fields", async () => {
    const { writeOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
    const personId = await createTestPerson("p2-legacy");
    await writeOnboardingDraft(personId, LEGACY);
    const draft = (await readOnboardingDraft(personId)) as Record<string, unknown>;
    assert.equal(draft.targetRole, "ML Engineer");
    for (const key of ["goal", "targetTimeline", "customGoalText"]) assert.equal(draft[key], undefined, key);
  });

  test("completion makes the target role the active goal and stores no goal/timeline evidence", async () => {
    const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
    const { getActiveGoal } = await import("../lib/repositories/goal-repository");
    const { evidenceItems, userPreferences, getDb } = await import("../lib/db");
    const personId = await createTestPerson("p2-complete");
    await completeOnboarding(personId, LEGACY);

    const goal = await getActiveGoal(personId);
    assert.equal(goal?.title, "Become an ML Engineer");
    assert.doesNotMatch(goal?.description ?? "", /Timeline|Within 6 months|internship/);

    const db = await getDb();
    const titles = (await db.select({ title: evidenceItems.subject }).from(evidenceItems).where(eq(evidenceItems.personId, personId))).map((r) => r.title);
    assert.ok(titles.includes("Target Role: ML Engineer"), titles.join(" | "));
    assert.ok(!titles.some((t) => /First Goal|Target Timeline/.test(t)), titles.join(" | "));

    const [prefs] = await db.select({ metadata: userPreferences.metadata }).from(userPreferences).where(eq(userPreferences.personId, personId));
    const meta = (prefs?.metadata ?? {}) as Record<string, unknown>;
    assert.equal(meta.targetRole, "ML Engineer");
    assert.equal("targetTimeline" in meta, false);
    assert.equal("customGoalText" in meta, false);
  });

  test("the dashboard reads the role-derived goal, with no timeline in its context", async () => {
    const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
    const { getStudentDashboardComposition } = await import("../lib/services/dashboard-service");
    const personId = await createTestPerson("p2-dash-goal");
    await completeOnboarding(personId, LEGACY);
    const serialized = JSON.stringify(await getStudentDashboardComposition(personId));
    assert.doesNotMatch(serialized, /Within 6 months|timelineBadge|targetTimeline/);
    assert.match(serialized, /Become an ML Engineer/);
  });
});

describe("2.1.1 role goal wording", () => {
  test("articles follow how the role is read aloud", async () => {
    const { roleGoalTitle } = await import("../lib/domain/role-goal");
    assert.equal(roleGoalTitle("ML Engineer"), "Become an ML Engineer");
    assert.equal(roleGoalTitle("NLP Engineer"), "Become an NLP Engineer");
    assert.equal(roleGoalTitle("AI Researcher"), "Become an AI Researcher");
    assert.equal(roleGoalTitle("Generative AI Engineer"), "Become a Generative AI Engineer");
    assert.equal(roleGoalTitle("Data Scientist"), "Become a Data Scientist");
    assert.equal(roleGoalTitle("Applied AI Researcher"), "Become an Applied AI Researcher");
  });
});

describe("2.1.4 review edits survive late scraper writes", () => {
  test("an edited entry is not re-added when a scraper re-sends the original", async () => {
    const { mutateOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
    const { editEntry, replaceEntry } = await import("../lib/review/entry-edits");
    const personId = await createTestPerson("p2-edit");
    const original = { institution: "IIT D", degree: "B.Tech", status: "candidate", source: "resume" };
    await mutateOnboardingDraft(personId, { education: [original] }, { origin: "system" });

    // The student fixes the institution name in the review screen.
    const before = (await readOnboardingDraft(personId))!.education as Record<string, unknown>[];
    const edited = editEntry("education", before[0], { institution: "IIT Delhi" });
    await mutateOnboardingDraft(personId, { education: replaceEntry("education", before, before[0], edited) }, { origin: "user" });

    // LinkedIn finishes later and sends the CV's spelling again.
    await mutateOnboardingDraft(personId, { education: [{ ...original, source: "linkedin" }] }, { origin: "system" });

    const after = (await readOnboardingDraft(personId))!.education!;
    assert.equal(after.length, 1, JSON.stringify(after));
    assert.equal(after[0].institution, "IIT Delhi");
    assert.equal(after[0].originKey, "iit d|b.tech");
    assert.deepEqual(after[0].editedFields, ["institution"]);
  });

  test("a rejected entry stays rejected when a scraper re-sends it", async () => {
    const { mutateOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
    const { rejectEntry, replaceEntry, visibleEntries } = await import("../lib/review/entry-edits");
    const personId = await createTestPerson("p2-reject");
    const job = { company: "Globex", role: "Intern", status: "candidate", source: "linkedin" };
    await mutateOnboardingDraft(personId, { experiences: [job] }, { origin: "system" });
    const before = (await readOnboardingDraft(personId))!.experiences as Record<string, unknown>[];
    await mutateOnboardingDraft(personId, { experiences: replaceEntry("experiences", before, before[0], rejectEntry("experiences", before[0])) }, { origin: "user" });

    await mutateOnboardingDraft(personId, { experiences: [job] }, { origin: "system" });
    const after = (await readOnboardingDraft(personId))!.experiences!;
    assert.equal(after.length, 1);
    assert.equal(after[0].status, "rejected");
    assert.equal(visibleEntries("experiences", after as Record<string, unknown>[]).length, 0);
  });

  test("renamed and rejected skill candidates are not re-imported", async () => {
    const { mutateOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
    const { editEntry, rejectEntry } = await import("../lib/review/entry-edits");
    const personId = await createTestPerson("p2-skill");
    const scraped = [{ name: "torch", source: "github" }, { name: "jquery", source: "github" }];
    await mutateOnboardingDraft(personId, { techCandidates: scraped }, { origin: "system" });
    const [torch, jq] = (await readOnboardingDraft(personId))!.techCandidates as Record<string, unknown>[];
    await mutateOnboardingDraft(personId, { techCandidates: [editEntry("techCandidates", torch, { name: "PyTorch" }), rejectEntry("techCandidates", jq)] }, { origin: "user" });
    await mutateOnboardingDraft(personId, { techCandidates: scraped }, { origin: "system" });
    const after = (await readOnboardingDraft(personId))!.techCandidates!;
    assert.deepEqual(after.map((c) => [c.name, c.status ?? "candidate"]), [["PyTorch", "candidate"], ["jquery", "rejected"]]);
  });

  test("completion writes edited values and never rejected entries", async () => {
    const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
    const { editEntry, rejectEntry } = await import("../lib/review/entry-edits");
    const { evidenceItems, getDb } = await import("../lib/db");
    const personId = await createTestPerson("p2-final");
    const kept = editEntry("experiences", { company: "Acme Corp", role: "ML Intern", status: "confirmed", source: "resume" }, { role: "Machine Learning Intern" });
    const dropped = rejectEntry("experiences", { company: "Initech", role: "Analyst", status: "confirmed", source: "linkedin" });
    await completeOnboarding(personId, { ...LEGACY, experiences: [kept, dropped] });
    const db = await getDb();
    const rows = await db.select({ subject: evidenceItems.subject, value: evidenceItems.value }).from(evidenceItems).where(eq(evidenceItems.personId, personId));
    const text = JSON.stringify(rows);
    assert.match(text, /Machine Learning Intern/);
    assert.doesNotMatch(text, /Initech/);
    assert.doesNotMatch(text, /"ML Intern"/);
  });
});

describe("2.1.4 link removal", () => {
  test("a link the student removed is cleared from the draft", async () => {
    const { writeOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
    const personId = await createTestPerson("p2-link");
    await writeOnboardingDraft(personId, { profiles: { github: "https://github.com/asha", linkedin: "https://www.linkedin.com/in/asha" } });
    await writeOnboardingDraft(personId, { profiles: { github: "https://github.com/asha-rao", linkedin: "" } });
    const draft = (await readOnboardingDraft(personId))!;
    assert.deepEqual(draft.profiles, { github: "https://github.com/asha-rao" });
  });
});

describe("2.1.5 per-source controls", () => {
  test("removing a source keeps entries another source backs and entries the student edited", async () => {
    const { removeSource, countBySource } = await import("../lib/review/source-actions");
    const projects = [
      { title: "rag-notes", sources: ["resume", "github"], status: "candidate" },
      { title: "dotfiles", sources: ["github"], status: "candidate" },
      { title: "chess-bot", sources: ["github"], status: "confirmed", editedFields: ["title"] },
      { title: "Kannada OCR", sources: ["manual"], status: "confirmed" },
    ];
    const { next, changed, keptShared, keptEdited } = removeSource("projects", projects, "github");
    assert.deepEqual([changed, keptShared, keptEdited], [1, 1, 1]);
    assert.deepEqual(next.map((p) => [p.title, p.status, p.sources.join("+")]), [
      ["rag-notes", "candidate", "resume"], ["dotfiles", "removed", "github"], ["chess-bot", "confirmed", "github"], ["Kannada OCR", "confirmed", "manual"],
    ]);
    assert.deepEqual(countBySource({ projects: next }), { resume: 1, github: 1, manual: 1 });
  });

  test("accept-all and remove touch only that source's entries", async () => {
    const { acceptAllFrom, removeSource } = await import("../lib/review/source-actions");
    const exps = [
      { company: "Globex", role: "Intern", source: "linkedin", status: "candidate" },
      { company: "Acme", role: "TA", source: "resume", status: "candidate" },
      { company: "Initech", role: "Analyst", source: "Digital Import", status: "candidate" },
    ];
    const accepted = acceptAllFrom("experiences", exps, "linkedin");
    assert.deepEqual(accepted.next.map((e) => e.status), ["confirmed", "candidate", "candidate"]);
    const removed = removeSource("experiences", exps, "resume");
    assert.deepEqual(removed.next.map((e) => e.status), ["candidate", "rejected", "candidate"]);
    assert.equal((removed.next[1] as { originKey?: string }).originKey, "acme|ta");
  });

  test("exclude forks rejects only unedited forks, and a later sync cannot bring them back", async () => {
    const { mutateOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
    const { excludeForks } = await import("../lib/review/source-actions");
    const personId = await createTestPerson("p2-forks");
    const repos = [
      { id: "gh_own", title: "own-model", sources: ["github"], status: "candidate", isFork: false, stars: 4 },
      { id: "gh_fork", title: "transformers", sources: ["github"], status: "candidate", isFork: true, stars: 0 },
    ];
    await mutateOnboardingDraft(personId, { projects: repos }, { origin: "system" });
    const draft = (await readOnboardingDraft(personId))!;
    assert.equal(draft.projects.find((p) => p.id === "gh_fork")?.isFork, true, "isFork must survive the draft sanitizer");
    const { next, changed } = excludeForks(draft.projects);
    assert.equal(changed, 1);
    await mutateOnboardingDraft(personId, { projects: next }, { origin: "user" });
    await mutateOnboardingDraft(personId, { projects: repos }, { origin: "system" });
    const after = (await readOnboardingDraft(personId))!.projects;
    assert.deepEqual(after.map((p) => [p.id, p.status]), [["gh_own", "candidate"], ["gh_fork", "removed"]]);
  });
});

describe("2.1.7 completion idempotency", () => {
  const FULL = {
    ...LEGACY, name: "Repeat Tester", institution: "IIT Delhi", degree: "B.Tech", year: "3rd Year",
    skills: ["Python", "PyTorch"],
    projects: [{ id: "p_rag", title: "rag-notes", description: "RAG over notes", technologies: ["Python"], sources: ["github"], status: "confirmed", contribution: ["Built retrieval"], contributionNote: "Solo", url: "https://github.com/x/rag-notes" }],
    experiences: [{ company: "Globex", role: "Data Intern", status: "confirmed", source: "linkedin" }],
    education: [{ institution: "IIT Delhi", degree: "B.Tech", status: "confirmed", source: "resume" }],
    achievements: [{ title: "Smart India Hackathon finalist", category: "hackathon", status: "confirmed" }],
    profiles: { github: "https://github.com/x" },
  };
  async function counts(personId: string) {
    const db = await (await import("../lib/db")).getDb();
    const t = await import("../lib/db");
    const n = async (table: { personId: unknown }) =>
      (await db.select().from(table as never).where(eq((table as { personId: never }).personId, personId))).length;
    return {
      evidence: await n(t.evidenceItems), projects: await n(t.projects), contributions: await n(t.projectContributions),
      journey: await n(t.journeyEvents), goals: await n(t.goals), preferences: await n(t.userPreferences), connections: await n(t.externalConnections),
    };
  }

  test("completing three times in a row leaves identical row counts", async () => {
    const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
    const personId = await createTestPerson("p2-repeat");
    await completeOnboarding(personId, FULL);
    const first = await counts(personId);
    await completeOnboarding(personId, FULL);
    await completeOnboarding(personId, FULL);
    assert.deepEqual(await counts(personId), first);
    assert.ok(first.evidence > 0 && first.projects === 1, JSON.stringify(first));
  });

  test("five concurrent completions (double-click, retries) leave the same rows as one", async () => {
    const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
    const single = await createTestPerson("p2-single");
    await completeOnboarding(single, FULL);
    const expected = await counts(single);
    const personId = await createTestPerson("p2-burst");
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => completeOnboarding(personId, FULL)));
    assert.deepEqual(outcomes.map((o) => o.status), Array(5).fill("fulfilled"), JSON.stringify(outcomes.filter((o) => o.status === "rejected").map((o) => String((o as PromiseRejectedResult).reason))));
    assert.deepEqual(await counts(personId), expected);
  });
});

describe("2.1.2 CV pre-fill dedupe", () => {
  test("accepting a CV project the import already wrote as a candidate keeps one entry", async () => {
    const { mutateOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
    const personId = await createTestPerson("p2-cv-dedupe");
    // Server-side CV ingestion writes candidates with its own ids...
    await mutateOnboardingDraft(personId, { projects: [{ id: "cv_extract_0", title: "Crop Disease Detector", sources: ["resume"], status: "candidate", technologies: [] }] }, { origin: "system" });
    // ...and the student's acceptance arrives from the client with a client id (stale baseRevision: it never saw the candidate).
    await mutateOnboardingDraft(personId, { projects: [{ id: "resume_doc123_0", title: "Crop  Disease Detector", sources: ["resume"], status: "confirmed", technologies: ["PyTorch"] }] }, { origin: "user", baseRevision: 0 });
    const projects = (await readOnboardingDraft(personId))!.projects;
    assert.deepEqual(projects.map((p) => [p.title, p.status]), [["Crop  Disease Detector", "confirmed"]]);
  });
});
