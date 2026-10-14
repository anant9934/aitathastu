/**
 * Task 1.9.5 — stress test for the onboarding draft concurrency fix (Task 1.2.4).
 *
 * Each run creates a fresh person, then inside one ~2 s window fires at once:
 *  - resume extraction completing: system draft write + 3 projects + 6 evidence rows
 *  - GitHub import completing, delivered TWICE (a retry): system draft writes +
 *    4 projects (one overlapping a resume project) + 6 evidence rows (one shared key)
 *  - the user autosaving 10 form edits at random offsets, the last of which
 *    replaces `skills` from a revision read before any scraper landed
 * and asserts afterwards that every expected field and row is present exactly
 * once, and that no write threw (no unique-constraint violation, no CAS give-up).
 *
 *   npm run test:draft-concurrency -- --runs=20
 */
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { useTestDatabase, createTestPerson } from "./lib/test-db";

const runsArg = process.argv.find((a) => a.startsWith("--runs="));
const RUNS = runsArg ? Number(runsArg.split("=")[1]) : 20;
const WINDOW_MS = 2000;
const jitter = () => new Promise((r) => setTimeout(r, Math.random() * WINDOW_MS));

async function main() {
  const db = await useTestDatabase();
  const { onboardingDrafts, projects, evidenceItems } = await import("../lib/db");
  const { writeOnboardingDraft, readOnboardingDraft, readOnboardingDraftRevision } = await import("../lib/services/onboarding-v2-service");
  const { saveProject } = await import("../lib/repositories/project-repository");
  const { writeEvidenceBatch } = await import("../lib/repositories/evidence-repository");

  const evidence = (prefix: string, keys: string[]) =>
    keys.map((k) => ({
      category: "skill" as const, subject: k, value: k, source: "imported" as const,
      verificationStatus: "imported" as const, sourceReference: `${prefix}:${k}`,
      interpretation: `${k} observed`, whyItMatters: "test", importKey: `key_${k}`,
    }));

  let failures = 0;
  for (let run = 1; run <= RUNS; run++) {
    const personId = await createTestPerson("stress");
    // The client loads the (empty) draft first: this is its stale base revision.
    await writeOnboardingDraft(personId, { role: "student", name: "" }, { origin: "user" });
    const staleRevision = await readOnboardingDraftRevision(personId);
    const errors: unknown[] = [];
    const guard = (p: Promise<unknown>) => p.catch((e) => { errors.push(e); });

    const resume = async () => {
      await jitter();
      await Promise.all([
        writeOnboardingDraft(personId, {
          name: "Resume Name",
          education: [{ institution: "IIT Delhi", degree: "B.Tech", source: "resume" }, { institution: "DPS", degree: "XII", source: "resume" }],
          experiences: [{ company: "Acme", role: "Intern", source: "resume" }, { company: "Globex", role: "TA", source: "resume" }],
          techCandidates: ["Python", "PyTorch", "SQL", "Docker", "React"].map((name) => ({ name, source: "resume" })),
        }, { origin: "system" }),
        ...["Pathified (AI Career App)", "Face Recognition", "Chess Engine"].map((title) => saveProject(personId, { title, sources: ["resume"], status: "candidate" })),
        writeEvidenceBatch(personId, evidence("resume", ["python", "pytorch", "sql", "docker", "react", "shared"])),
      ]);
    };
    const github = async () => {
      await jitter();
      await Promise.all([
        writeOnboardingDraft(personId, {
          projects: ["gh-pathified", "gh-tracker", "gh-blog", "gh-cli"].map((id) => ({ id, title: id, sources: ["github"] })),
          techCandidates: ["Python", "TypeScript", "Go", "Rust"].map((name) => ({ name, source: "github" })),
          profiles: { github: "https://github.com/scraped" },
        }, { origin: "system" }),
        ...["Pathified", "Tracker", "Blog", "CLI Tool"].map((title) => saveProject(personId, { title, sources: ["github"], repositoryUrl: `https://github.com/x/${title.toLowerCase().replace(/\s/g, "-")}`, status: "candidate" })),
        writeEvidenceBatch(personId, evidence("github", ["typescript", "go", "rust", "git", "ci", "shared"])),
      ]);
    };
    const user = async () => {
      const edits: Record<string, unknown>[] = [
        { institution: "IIT D" }, { degree: "B.Tech CSE" }, { goal: "ML Engineer" }, { targetRole: "MLE" },
        { year: "3rd" }, { semester: "6" }, { profiles: { linkedin: "https://linkedin.com/in/me" } },
        { institution: "IIT Delhi" }, { name: "Typed Name" },
      ];
      await Promise.all(edits.map(async (edit) => { await jitter(); await writeOnboardingDraft(personId, edit, { origin: "user" }); }));
      // Final autosave at the end of the window, from the stale revision.
      await writeOnboardingDraft(personId, { skills: ["Python", "Statistics"] }, { origin: "user", baseRevision: staleRevision });
    };

    const started = Date.now();
    await Promise.all([guard(resume()), guard(github()), guard(github()), guard(user())]);
    const elapsed = Date.now() - started;

    try {
      assert.deepEqual(errors, [], `writes threw: ${errors.map(String).join("; ")}`);
      const draft = (await readOnboardingDraft(personId))!;
      assert.equal(draft.name, "Typed Name", "user's name must win over the resume fill");
      assert.equal(draft.institution, "IIT Delhi");
      assert.equal(draft.degree, "B.Tech CSE");
      assert.equal(draft.goal, "ML Engineer");
      assert.equal(draft.targetRole, "MLE");
      assert.equal(draft.year, "3rd");
      assert.equal(draft.semester, "6");
      assert.equal(draft.profiles.linkedin, "https://linkedin.com/in/me");
      assert.equal(draft.profiles.github, "https://github.com/scraped");
      assert.deepEqual(draft.skills, ["Python", "Statistics"]);
      assert.deepEqual((draft.education || []).map((e) => e.institution).sort(), ["DPS", "IIT Delhi"]);
      assert.deepEqual((draft.experiences || []).map((e) => e.company).sort(), ["Acme", "Globex"]);
      assert.deepEqual((draft.techCandidates || []).map((t) => t.name.toLowerCase()).sort(),
        ["docker", "go", "python", "pytorch", "react", "rust", "sql", "typescript"]);
      assert.deepEqual(draft.projects.map((p) => p.id).sort(), ["gh-blog", "gh-cli", "gh-pathified", "gh-tracker"]);

      const projectRows = await db.select().from(projects).where(eq(projects.personId, personId));
      // "Pathified" (github) merges into "Pathified (AI Career App)" (resume): 6 rows.
      assert.equal(projectRows.length, 6, `projects: ${projectRows.map((p) => p.title).join(", ")}`);
      const pathified = projectRows.find((p) => p.normalizedTitle === "pathified");
      assert.ok(pathified, "merged Pathified row exists");
      assert.deepEqual([...(pathified!.sources as string[])].sort(), ["github", "resume"]);

      const evidenceRows = await db.select().from(evidenceItems).where(eq(evidenceItems.personId, personId));
      assert.equal(evidenceRows.length, 11, "11 distinct import keys, each exactly once");
      const [row] = await db.select().from(onboardingDrafts).where(and(eq(onboardingDrafts.personId, personId)));
      console.log(`run ${String(run).padStart(2)}/${RUNS} PASS  ${elapsed}ms  draftRevision=${row.revision}  projects=${projectRows.length}  evidence=${evidenceRows.length}`);
    } catch (error) {
      failures++;
      console.log(`run ${String(run).padStart(2)}/${RUNS} FAIL  ${(error as Error).message}`);
    }
  }
  console.log(`\n${RUNS - failures}/${RUNS} runs clean (zero data loss, zero constraint violations).`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
