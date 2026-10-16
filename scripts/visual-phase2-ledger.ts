/**
 * Browser check for the Project Evidence Ledger (Tasks 2.5.x, 2.2.4).
 * Needs the test-database dev server (scripts/visual-phase2-progress.ts).
 * Makes ONE real LLM call (Enhance with AI at 1280 px); everything else is local.
 *
 *   node --import tsx scripts/visual-phase2-ledger.ts <outDir>
 */
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

async function main() {
  const { setupTestDatabase } = await import("./lib/test-db");
  await setupTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
  const { saveProject } = await import("../lib/repositories/project-repository");
  const { saveSourceSnapshot, saveExternalConnection } = await import("../lib/repositories/connection-repository");
  const { writeEvidenceBatch } = await import("../lib/repositories/evidence-repository");
  const { getLedger } = await import("../lib/services/project-ledger-service");

  const results: Record<string, unknown> = {};
  const browser = await chromium.launch();
  try {
    for (const [name, viewport] of [["1280", { width: 1280, height: 900 }], ["375", { width: 375, height: 812 }]] as const) {
      const email = `p2-ledger-${name}-${Date.now()}@test.invalid`;
      const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Asha Rao" });
      await completeOnboarding(personId, { role: "student", name: "Asha Rao", targetRole: "Machine Learning Engineer", institution: "IIT Delhi", degree: "B.Tech", priorities: ["projects"], primaryPriority: "projects" });
      await saveProject(personId, { title: "rag-notes", summary: "GitHub repository candidate", description: "Retrieval-augmented Q&A over lecture notes", technologies: ["Python", "FAISS", "LangChain"], sources: ["github"], repositoryUrl: "https://github.com/asha/rag-notes", status: "candidate", metadata: { stars: 12, forks: 3, languages: ["Python"] } });
      await saveProject(personId, { title: "Kannada OCR", summary: "OCR for Kannada script using a CRNN", technologies: ["PyTorch", "OpenCV"], sources: ["resume"], status: "confirmed" });
      await saveProject(personId, { title: "Titanic EDA", summary: "Kaggle notebook", sources: ["kaggle"], status: "candidate" });
      await saveProject(personId, { title: "old-dotfiles", summary: "Shell configs", technologies: ["Shell"], sources: ["github"], status: "candidate", metadata: { isFork: true } });
      await saveExternalConnection({ personId, provider: "scholar", externalUsername: "0000-0002-1825-0097", profileUrl: "https://orcid.org/0000-0002-1825-0097", metadata: { idKind: "orcid" } } as never);
      await saveSourceSnapshot(personId, "scholar", "orcid:0000-0002-1825-0097", { papers: [{ title: "Low-resource OCR for Kannada", year: 2025, venue: "ICDAR Workshops", doi: "10.1000/xyz123", url: "https://doi.org/10.1000/xyz123", citationCount: 4, coAuthors: ["R. Rao"], sourceId: "w1" }] }, "c1");
      await writeEvidenceBatch(personId, [{ category: "publication", subject: "Low-resource OCR for Kannada", value: "ICDAR Workshops, 2025", source: "imported", verificationStatus: "imported", sourceReference: "https://doi.org/10.1000/xyz123", importKey: "scholar_doi_10_1000_xyz123", originSource: "scholar", interpretation: "x", whyItMatters: "x" }] as never);

      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
      await page.goto(`${BASE}/student/projects`);
      await page.getByRole("heading", { name: "Project Evidence Ledger" }).waitFor({ timeout: 90_000 });
      const r: Record<string, unknown> = { pageErrors: errors };
      const settle = () => page.waitForTimeout(700);
      const card = (title: string) => page.locator("li.pl-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

      r.header = (await page.locator(".pl-sub").innerText()).replace(/\s+/g, " ");
      r.sourceChips = (await page.getByRole("group", { name: "Filter by source" }).innerText()).replace(/\s+/g, " ");
      await page.screenshot({ path: path.join(out, `p2-ledger-${name}.png`), fullPage: name === "1280" });

      // Filter + search.
      await page.getByRole("button", { name: /^GitHub/ }).click();
      r.githubFilter = await page.locator("li.pl-card h2").allInnerTexts();
      await page.getByRole("button", { name: /^All/ }).click();
      await page.getByPlaceholder("Search name or technology").fill("torch");
      r.searchTorch = await page.locator("li.pl-card h2").allInnerTexts();
      await page.getByPlaceholder("Search name or technology").fill("");

      // Include rag-notes, edit it, choose chips.
      await card("rag-notes").getByRole("switch").click();
      await settle();
      await card("rag-notes").getByRole("button", { name: "Edit rag-notes" }).click();
      await card("rag-notes").getByLabel("Description").fill("Ask questions across a semester of lecture notes.");
      await card("rag-notes").getByRole("button", { name: "Save" }).click();
      await settle();
      await card("rag-notes").getByRole("button", { name: "Card chips" }).click();
      await card("rag-notes").getByLabel(/^Stars/).check();
      await card("rag-notes").getByLabel("My role on this project").fill("Sole developer");
      await card("rag-notes").getByRole("checkbox", { name: /^Show my role/ }).check();
      await card("rag-notes").getByRole("button", { name: "Save chips" }).click();
      await settle();
      r.ragCardHighlights = await card("rag-notes").locator(".pl-highlights").innerText().catch(() => null);

      // AI: disabled when not included; one real call at 1280.
      r.aiDisabledOnUnselected = await card("Titanic EDA").getByRole("button", { name: "Enhance with AI" }).isDisabled();
      if (name === "1280") {
        await card("Kannada OCR").getByRole("button", { name: "Enhance with AI" }).click();
        await card("Kannada OCR").locator(".pl-status").waitFor({ timeout: 60_000 });
        r.aiResult = { status: await card("Kannada OCR").locator(".pl-status").innerText(), summary: (await card("Kannada OCR").locator(".pl-summary").innerText()).slice(0, 300) };
      }

      // Add a project; archive the fork.
      await page.getByRole("button", { name: "Add project" }).click();
      await page.getByRole("button", { name: "Add to ledger" }).click();
      r.addRequiresName = await page.getByText("A project needs a name.").isVisible();
      await page.getByLabel(/^Name/).first().fill("Campus Bus Tracker");
      await page.getByLabel("Technologies (comma separated)").first().fill("React, Firebase");
      await page.getByRole("button", { name: "Add to ledger" }).click();
      await card("Campus Bus Tracker").waitFor();
      await card("old-dotfiles").getByRole("button", { name: "Archive old-dotfiles" }).click();
      await card("old-dotfiles").waitFor({ state: "detached" });

      // Publications.
      await page.getByRole("tab", { name: /Research/ }).click();
      r.publication = (await page.locator(".pl-pub").first().innerText()).replace(/\s+/g, " ").slice(0, 200);
      await page.locator(".pl-pub").first().getByRole("switch").click();
      await settle();
      await page.screenshot({ path: path.join(out, `p2-ledger-pubs-${name}.png`) });
      r.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

      const ledger = await getLedger(personId);
      r.db = {
        projects: ledger.projects.map((p) => `${p.title}|in:${p.portfolioIncluded}|edited:${(p.metadata.editedFields ?? []).join("+")}|chips:${p.highlights.map((h) => h.label).join("+")}`),
        publicationIncluded: ledger.publications[0]?.portfolioIncluded,
      };
      const pack = await (await page.request.get(`${BASE}/api/student/projects/export`)).json();
      r.exportPack = { projects: pack.projects.map((p: { title: string; highlights: string[] }) => `${p.title} [${p.highlights.join(", ")}]`), publications: pack.publications.map((p: { title: string }) => p.title) };
      results[name] = r;
      await context.close();
    }
  } finally {
    await browser.close();
    const { closeDbForTesting } = await import("../lib/db");
    await closeDbForTesting();
  }
  console.log(JSON.stringify(results, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
