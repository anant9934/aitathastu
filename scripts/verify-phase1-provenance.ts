/** Tasks 1.2.1-1.2.3: source precedence, per-source provenance, cross-source project merge (local Postgres). */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { and, eq, isNull, or } from "drizzle-orm";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";
import { resolveField } from "../lib/domain/source-precedence";

let db: Awaited<ReturnType<typeof setupTestDatabase>>;
let schema: typeof import("../lib/db");
let ev: typeof import("../lib/repositories/evidence-repository");
let pr: typeof import("../lib/repositories/project-repository");
let fusion: typeof import("../lib/services/cross-source-fusion-service");

before(async () => {
  db = await setupTestDatabase();
  schema = await import("../lib/db");
  ev = await import("../lib/repositories/evidence-repository");
  pr = await import("../lib/repositories/project-repository");
  fusion = await import("../lib/services/cross-source-fusion-service");
});
after(async () => { await schema.closeDbForTesting(); });

describe("1.2.1 source precedence", () => {
  test("resume > github > other_external > manual; recency breaks ties", () => {
    const at = (d: string) => new Date(d);
    assert.equal(resolveField([{ source: "manual", value: "2026" }, { source: "linkedin", value: "2025" }, { source: "github", value: "2024" }, { source: "resume", value: "2025" }]).source, "resume");
    assert.equal(resolveField([{ source: "linkedin", value: "IIT" }, { source: "github", value: "IITD" }]).source, "github");
    assert.equal(resolveField([{ source: "kaggle", value: "A", observedAt: at("2026-01-01") }, { source: "linkedin", value: "B", observedAt: at("2026-05-01") }]).value, "B");
    assert.equal(resolveField([{ source: "resume", value: "" }, { source: "manual", value: "X" }]).value, "X", "empty values never win");
  });

  test("conflicting graduation years and institutions: resume wins, every other value is logged in source_conflicts", async () => {
    const personId = await createTestPerson("prec");
    const year = await fusion.CrossSourceFusionService.resolveProfileField(personId, "education.graduationYear", [
      { source: "github", value: "2024" }, { source: "linkedin", value: "2026" }, { source: "resume", value: "2025" },
    ]);
    assert.deepEqual([year.value, year.source], ["2025", "resume"]);
    const inst = await fusion.CrossSourceFusionService.resolveProfileField(personId, "education.institution", [
      { source: "linkedin", value: "IIT Delhi" }, { source: "resume", value: "Indian Institute of Technology Delhi" }, { source: "github", value: "iit delhi" },
    ]);
    assert.equal(inst.source, "resume");
    // Replaying the same resolution (sync retry) must not duplicate conflicts.
    await fusion.CrossSourceFusionService.resolveProfileField(personId, "education.graduationYear", [
      { source: "github", value: "2024" }, { source: "linkedin", value: "2026" }, { source: "resume", value: "2025" },
    ]);
    const rows = await db.select().from(schema.sourceConflicts).where(eq(schema.sourceConflicts.personId, personId));
    const years = rows.filter((r) => r.field === "education.graduationYear").map((r) => `${r.sourceA}:${r.valueA} vs ${r.sourceB}:${r.valueB}`).sort();
    assert.deepEqual(years, ["resume:2025 vs github:2024", "resume:2025 vs linkedin:2026"]);
    const insts = rows.filter((r) => r.field === "education.institution");
    assert.equal(insts.length, 1, "'IIT Delhi' and 'iit delhi' are one disagreeing value, not two");
  });
});

describe("1.2.2 provenance on every row, per-source delete", () => {
  test("rows carry origin, reference and editability; deleting GitHub leaves resume and LeetCode untouched", async () => {
    const personId = await createTestPerson("prov");
    const base = { category: "skill" as const, interpretation: "x", whyItMatters: "y", verificationStatus: "unverified" as const };
    await ev.writeEvidenceBatch(personId, [
      { ...base, subject: "React", value: "React", source: "imported", importKey: "github_skill_gh_1_react", sourceReference: "https://github.com/a/b#package.json" },
      { ...base, subject: "Python", value: "Python", source: "resume_extracted", importKey: "resume:doc1:skill:Python" },
      { ...base, subject: "DSA", value: "DSA", source: "imported", importKey: "leetcode_badge_dsa", originSource: "leetcode", confidenceScore: 0.8 },
      { ...base, subject: "SQL", value: "SQL", source: "imported", importKey: "github_skill_gh_2_sql", verificationStatus: "verified" },
    ]);
    const rows = await db.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.personId, personId));
    assert.deepEqual(rows.map((r) => `${r.subject}:${r.originSource}`).sort(), ["DSA:leetcode", "Python:resume", "React:github", "SQL:github"]);
    assert.ok(rows.every((r) => r.source && r.sourceReference && r.importKey && r.observedAt), "no row without provenance");
    assert.equal(rows.find((r) => r.subject === "Python")!.sourceReference, "resume:resume:doc1:skill:Python");
    assert.equal(rows.find((r) => r.subject === "SQL")!.editable, false, "verified evidence is not editable");
    assert.equal(rows.find((r) => r.subject === "DSA")!.confidenceScore, 0.8);

    const removed = await ev.deleteEvidenceBySource(personId, "github");
    assert.equal(removed, 1, "only the editable GitHub row");
    const left = await db.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.personId, personId));
    assert.deepEqual(left.map((r) => r.subject).sort(), ["DSA", "Python", "SQL"]);
    assert.deepEqual(await ev.countEvidenceBySource(personId), { leetcode: 1, resume: 1, github: 1 });
  });

  test("removing a project source keeps multi-source projects, drops single-source ones", async () => {
    const personId = await createTestPerson("provproj");
    await pr.saveProject(personId, { title: "Pathified", sources: ["resume"], status: "candidate" });
    await pr.saveProject(personId, { title: "Pathified", sources: ["github"], repositoryUrl: "https://github.com/a/pathified", status: "candidate" });
    await pr.saveProject(personId, { title: "Dotfiles", sources: ["github"], status: "candidate" });
    await pr.saveProject(personId, { title: "Thesis Code", sources: ["github"], status: "confirmed" });
    const res = await pr.removeProjectSource(personId, "github");
    assert.deepEqual(res, { updated: 2, deleted: 1 });
    const rows = await db.select().from(schema.projects).where(eq(schema.projects.personId, personId));
    assert.deepEqual(rows.map((r) => `${r.title}:${(r.sources as string[]).join("+")}`).sort(), ["Pathified:resume", "Thesis Code:manual"]);
  });

  test("migration backfill: legacy rows without origin/reference get them", async () => {
    const personId = await createTestPerson("backfill");
    await db.insert(schema.evidenceItems).values({
      id: `ev_legacy_${personId}`, personId, category: "skill", subject: "Go", value: "Go", source: "imported",
      verificationStatus: "unverified", interpretation: "x", whyItMatters: "y", importKey: "github_skill_legacy_go",
    });
    await db.execute((await import("drizzle-orm")).sql`UPDATE evidence_items SET origin_source = NULL, source_reference = NULL WHERE id = ${`ev_legacy_${personId}`}`);
    // Replay MIGRATION_SQL_STATEMENTS on this connection, as `npm run db:migrate` would.
    const { MIGRATION_SQL_STATEMENTS } = await import("../lib/db/migration-sql");
    const { sql: raw } = await import("drizzle-orm");
    const quietLog = console.log; console.log = () => {};
    try { for (const stmt of MIGRATION_SQL_STATEMENTS) await db.execute(raw.raw(stmt)); } finally { console.log = quietLog; }
    const [row] = await db.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.id, `ev_legacy_${personId}`));
    assert.equal(row.originSource, "github");
    assert.equal(row.sourceReference, "github:github_skill_legacy_go");
    const missing = await db.select().from(schema.evidenceItems).where(or(isNull(schema.evidenceItems.originSource), isNull(schema.evidenceItems.sourceReference)));
    assert.equal(missing.length, 0, "no evidence row anywhere lacks origin or reference");
  });
});

describe("1.2.3 cross-source project merge", () => {
  test("GitHub 'Pathified' links onto the resume's 'Pathified (AI Career App)' without a constraint violation", async () => {
    const personId = await createTestPerson("merge");
    const resume = await pr.saveProject(personId, { title: "Pathified (AI Career App)", sources: ["resume"], technologies: ["Next.js"], status: "candidate" });
    const gh = await pr.saveProject(personId, { title: "Pathified", sources: ["github"], repositoryUrl: "https://github.com/asha/pathified", technologies: ["TypeScript"], status: "candidate" });
    assert.equal(gh.id, resume.id);
    const rows = await db.select().from(schema.projects).where(and(eq(schema.projects.personId, personId)));
    assert.equal(rows.length, 1);
    assert.deepEqual([...(rows[0].sources as string[])].sort(), ["github", "resume"]);
    assert.equal(rows[0].repositoryUrl, "https://github.com/asha/pathified");
    assert.deepEqual([...(rows[0].technologies as string[])].sort(), ["Next.js", "TypeScript"]);
  });

  test("matches on demo link; different projects with a shared word stay separate", async () => {
    const personId = await createTestPerson("merge2");
    const a = await pr.saveProject(personId, { title: "Career Compass", sources: ["resume"], demoUrl: "https://compass.app/", status: "candidate" });
    const b = await pr.saveProject(personId, { title: "compass-web", sources: ["github"], demoUrl: "https://compass.app", status: "candidate" });
    assert.equal(a.id, b.id, "same deployed demo is the same project");
    const c = await pr.saveProject(personId, { title: "Chat App", sources: ["resume"], status: "candidate" });
    const d = await pr.saveProject(personId, { title: "Chatbot", sources: ["github"], status: "candidate" });
    assert.notEqual(c.id, d.id);
  });
});
