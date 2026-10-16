/**
 * Project Evidence Ledger contracts (Tasks 2.5.1-2.5.5, 2.2.4). No live LLM
 * or network: the AI router and the demo-site fetcher are injected fakes.
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-phase2-ledger.ts
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";

before(async () => { await setupTestDatabase(); });
after(async () => { const { closeDbForTesting } = await import("../lib/db"); await closeDbForTesting(); });

async function seedLedger(personId: string) {
  const { saveProject } = await import("../lib/repositories/project-repository");
  const gh = await saveProject(personId, {
    title: "rag-notes", summary: "GitHub repository candidate", description: "Retrieval over lecture notes", technologies: ["Python", "FAISS"],
    sources: ["github"], repositoryUrl: "https://github.com/asha/rag-notes", status: "candidate",
    metadata: { stars: 12, forks: 3, isFork: false, languages: ["Python", "Jupyter Notebook"] },
  });
  const cv = await saveProject(personId, { title: "Kannada OCR", summary: "OCR for Kannada script", technologies: ["PyTorch"], sources: ["resume"], status: "confirmed" });
  const kg = await saveProject(personId, { title: "Titanic EDA", summary: "Kaggle notebook", sources: ["kaggle"], demoUrl: "https://www.kaggle.com/code/asha/titanic-eda", status: "candidate" });
  return { gh, cv, kg };
}

describe("2.5.1 ledger", () => {
  test("shows every source, confirmed projects start in the portfolio, candidates do not", async () => {
    const { getLedger, addManualProject } = await import("../lib/services/project-ledger-service");
    const personId = await createTestPerson("p2-ledger");
    await seedLedger(personId);
    await addManualProject(personId, { title: "Campus Bus Tracker", technologies: ["React"] });
    const ledger = await getLedger(personId);
    assert.deepEqual(ledger.counts.bySource, { github: 1, resume: 1, kaggle: 1, manual: 1 });
    const byTitle = Object.fromEntries(ledger.projects.map((p) => [p.title, p]));
    assert.equal(byTitle["Kannada OCR"].portfolioIncluded, true);
    assert.equal(byTitle["Campus Bus Tracker"].portfolioIncluded, true);
    assert.equal(byTitle["rag-notes"].portfolioIncluded, false);
    assert.equal(byTitle["rag-notes"].metadata.stars, 12);
    assert.equal(ledger.counts.included, 2);
  });

  test("never shows another student's projects (Kaggle leak regression)", async () => {
    const { getLedger } = await import("../lib/services/project-ledger-service");
    const owner = await createTestPerson("p2-ledger-owner");
    const other = await createTestPerson("p2-ledger-other");
    await seedLedger(owner);
    const ledger = await getLedger(other);
    assert.equal(ledger.projects.length, 0);
    assert.equal(ledger.publications.length, 0);
  });
});

describe("2.2.4 in-place edits survive re-imports", () => {
  test("edited summary, title and technologies are not overwritten by the next GitHub sync", async () => {
    const { updateLedgerProject, getLedger } = await import("../lib/services/project-ledger-service");
    const { saveProject } = await import("../lib/repositories/project-repository");
    const personId = await createTestPerson("p2-ledger-edit");
    const { gh } = await seedLedger(personId);
    await updateLedgerProject(personId, gh.id, { summary: "My own words.", technologies: ["Python", "LangChain"], portfolioIncluded: true });
    // GitHub re-syncs the same repository with its own text and topics, and new star counts.
    await saveProject(personId, {
      title: "rag-notes", summary: "GitHub repository candidate", description: "Retrieval over lecture notes", technologies: ["Python", "FAISS", "NumPy"],
      sources: ["github"], repositoryUrl: "https://github.com/asha/rag-notes", status: "candidate", metadata: { stars: 15, forks: 3 },
    });
    const p = (await getLedger(personId)).projects.find((x) => x.id === gh.id)!;
    assert.equal(p.summary, "My own words.");
    assert.deepEqual(p.technologies, ["Python", "LangChain"]);
    assert.equal(p.metadata.stars, 15, "import-owned stats still refresh");
    assert.deepEqual(p.metadata.editedFields?.sort(), ["summary", "technologies"]);
    assert.equal(p.portfolioIncluded, true);
  });

  test("archive hides a project from the ledger; a blank name is refused", async () => {
    const { updateLedgerProject, getLedger, LedgerError } = await import("../lib/services/project-ledger-service");
    const personId = await createTestPerson("p2-ledger-archive");
    const { kg } = await seedLedger(personId);
    await updateLedgerProject(personId, kg.id, { status: "archived" });
    assert.ok(!(await getLedger(personId)).projects.some((p) => p.id === kg.id));
    await assert.rejects(updateLedgerProject(personId, kg.id, { title: "  " }), LedgerError);
  });
});

describe("2.5.4 chosen chips and export", () => {
  test("only the chips the student picked appear on the exported card, and only included projects export", async () => {
    const { updateLedgerProject, exportPortfolio } = await import("../lib/services/project-ledger-service");
    const personId = await createTestPerson("p2-ledger-chips");
    const { gh } = await seedLedger(personId);
    await updateLedgerProject(personId, gh.id, { portfolioIncluded: true, role: "Sole developer", highlight: ["stars", "role"] });
    const pack = await exportPortfolio(personId);
    const rag = pack.projects.find((p) => p.title === "rag-notes")!;
    assert.deepEqual(rag.highlights, ["12 stars", "Sole developer"]);
    assert.deepEqual(pack.projects.map((p) => p.title).sort(), ["Kannada OCR", "rag-notes"]);
  });
});

describe("2.5.2 on-demand AI descriptions", () => {
  const fakeRouter = (calls: { n: number }, outcome: "ok" | "provider" | "quota") => ({
    completeStructured: async () => {
      calls.n++;
      if (outcome === "provider") throw Object.assign(new Error("Every AI provider failed"), { code: "provider" });
      if (outcome === "quota") throw Object.assign(new Error("You've reached today's limit of 50 AI requests; it resets at 00:00 UTC."), { code: "quota" });
      return { data: { problem: "Students lose track of lecture notes across courses.", architecture: "A Python service embeds notes with FAISS and answers questions over them.", impact: "Lets a student ask questions across a semester of notes." }, provider: "groq", model: "fake-model", attempts: [], latencyMs: 5 };
    },
  }) as never;

  test("refuses unselected projects, writes a 3-part summary once, and reuses it within the cooldown", async () => {
    const { enhanceProject, updateLedgerProject, LedgerError } = await import("../lib/services/project-ledger-service");
    const personId = await createTestPerson("p2-ledger-ai");
    const { gh } = await seedLedger(personId);
    const calls = { n: 0 };
    await assert.rejects(enhanceProject(personId, gh.id, { router: fakeRouter(calls, "ok") }), (e: unknown) => e instanceof LedgerError && e.status === 409);
    assert.equal(calls.n, 0, "no tokens spent on an unselected project");
    await updateLedgerProject(personId, gh.id, { portfolioIncluded: true });
    const first = await enhanceProject(personId, gh.id, { router: fakeRouter(calls, "ok") });
    assert.equal(first.reused, false);
    assert.match(first.project.summary, /^Students lose track.*FAISS.*semester of notes\.$/);
    assert.equal(first.project.metadata.aiSummary?.provider, "groq");
    const again = await enhanceProject(personId, gh.id, { router: fakeRouter(calls, "ok") });
    assert.equal(again.reused, true);
    assert.equal(calls.n, 1, "repeat click inside the cooldown spends nothing");
  });

  test("provider outage and quota leave the project unchanged with a plain message", async () => {
    const { enhanceProject, updateLedgerProject, getLedger } = await import("../lib/services/project-ledger-service");
    const personId = await createTestPerson("p2-ledger-ai-down");
    const { cv } = await seedLedger(personId);
    await updateLedgerProject(personId, cv.id, { portfolioIncluded: true });
    await assert.rejects(enhanceProject(personId, cv.id, { router: fakeRouter({ n: 0 }, "provider") }), (e: { status?: number; message?: string }) => e.status === 503 && /unchanged/.test(e.message ?? ""));
    await assert.rejects(enhanceProject(personId, cv.id, { router: fakeRouter({ n: 0 }, "quota") }), (e: { status?: number }) => e.status === 429);
    const p = (await getLedger(personId)).projects.find((x) => x.id === cv.id)!;
    assert.equal(p.summary, "OCR for Kannada script");
    assert.equal(p.metadata.aiSummary, undefined);
  });
});

describe("2.5.3 previews", () => {
  test("og:image becomes the hero; everything else falls back to the banner with a reason", async () => {
    const { refreshProjectPreview, updateLedgerProject } = await import("../lib/services/project-ledger-service");
    const personId = await createTestPerson("p2-ledger-preview");
    const { gh, kg, cv } = await seedLedger(personId);
    const page = (html: string) => async (url: string) => ({ url, html });
    const img = await refreshProjectPreview(personId, kg.id, { fetchHtml: page('<meta property="og:image" content="/cover.png">') });
    assert.deepEqual([img.metadata.preview?.kind, (img.metadata.preview as { imageUrl?: string }).imageUrl], ["image", "https://www.kaggle.com/cover.png"]);
    const noImg = await refreshProjectPreview(personId, kg.id, { fetchHtml: page('<meta property="og:image" content="http://insecure.example/x.png">') });
    assert.deepEqual(noImg.metadata.preview, { kind: "banner", reason: "no_image_found", checkedAt: noImg.metadata.preview!.checkedAt });
    const failed = await refreshProjectPreview(personId, kg.id, { fetchHtml: async () => { throw new Error("timeout"); } });
    assert.equal((failed.metadata.preview as { reason?: string }).reason, "fetch_failed");
    const none = await refreshProjectPreview(personId, cv.id);
    assert.equal((none.metadata.preview as { reason?: string }).reason, "no_demo_url");
    await updateLedgerProject(personId, gh.id, { demoUrl: "https://localhost/admin" });
    const blocked = await refreshProjectPreview(personId, gh.id, { fetchHtml: async () => { throw new Error("must not be called"); } });
    assert.equal((blocked.metadata.preview as { reason?: string }).reason, "blocked_url");
  });
});

describe("2.5.5 publications", () => {
  test("verified-ID papers show structured fields; students without an ID see none; manual citations are editable, imported ones are not", async () => {
    const { getLedger, saveManualPublication, setPublicationIncluded, LedgerError } = await import("../lib/services/project-ledger-service");
    const { saveSourceSnapshot, saveExternalConnection } = await import("../lib/repositories/connection-repository");
    const { writeEvidenceBatch } = await import("../lib/repositories/evidence-repository");
    const personId = await createTestPerson("p2-ledger-pubs");
    const noId = await createTestPerson("p2-ledger-noid");
    const paper = { title: "Low-resource OCR for Kannada", year: 2025, venue: "ICDAR Workshops", doi: "10.1000/xyz123", url: "https://doi.org/10.1000/xyz123", citationCount: 4, coAuthors: ["R. Rao"], sourceId: "w1" };
    await saveExternalConnection({ personId, provider: "scholar", externalUsername: "0000-0002-1825-0097", profileUrl: "https://orcid.org/0000-0002-1825-0097", metadata: { idKind: "orcid" } } as never);
    await saveSourceSnapshot(personId, "scholar", "orcid:0000-0002-1825-0097", { papers: [paper] }, "c1");
    await writeEvidenceBatch(personId, [{
      category: "publication", subject: paper.title, value: "ICDAR Workshops, 2025", source: "imported", verificationStatus: "imported",
      sourceReference: paper.url, importKey: "scholar_doi_10_1000_xyz123", originSource: "scholar",
      interpretation: "x", whyItMatters: "x",
    }] as never);
    const ledger = await getLedger(personId);
    assert.equal(ledger.hasResearchId, true);
    assert.deepEqual(ledger.publications.map((p) => [p.title, p.year, p.venue, p.citationCount, p.doi, p.coAuthors.join()]),
      [["Low-resource OCR for Kannada", 2025, "ICDAR Workshops", 4, "10.1000/xyz123", "R. Rao"]]);
    const empty = await getLedger(noId);
    assert.deepEqual([empty.hasResearchId, empty.publications.length], [false, 0]);

    const manual = await saveManualPublication(personId, { title: "Notes on BERT fine-tuning", venue: "Blog", year: 2024 });
    const edited = await saveManualPublication(personId, { id: manual.id, title: "Notes on fine-tuning BERT", venue: "Personal blog", year: 2024 });
    assert.equal(edited.subject, "Notes on fine-tuning BERT");
    const imported = ledger.publications[0];
    await assert.rejects(saveManualPublication(personId, { id: imported.id, title: "Hijacked" }), (e: unknown) => e instanceof LedgerError && e.status === 403);
    await setPublicationIncluded(personId, imported.id, true);
    const after = await getLedger(personId);
    assert.equal(after.publications.find((p) => p.id === imported.id)?.portfolioIncluded, true);
    assert.equal(after.publications.find((p) => p.id === imported.id)?.title, "Low-resource OCR for Kannada");
  });
});
