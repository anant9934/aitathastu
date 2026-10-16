/**
 * Tasks 2.2.1, 2.3.1, 2.3.2 in the browser: the /student dashboard hero and
 * footprint follow the #1 priority, and the "Your focus" editor changes the
 * target role and priority order in place (no page reload), persisted to the
 * database. Needs the test-database dev server (scripts/visual-phase2-progress.ts).
 *
 *   node --import tsx scripts/visual-phase2-dashboard.ts <outDir>
 */
import path from "path";
import { chromium, type Page } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

async function heroKind(page: Page) {
  return page.locator("[data-hero-kind]").getAttribute("data-hero-kind");
}

async function main() {
  const { useTestDatabase } = await import("./lib/test-db");
  await useTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
  const { getUserPreferences } = await import("../lib/repositories/person-repository");
  const { getDb } = await import("../lib/db");
  const { goals } = await import("../lib/db/schema");
  const { and, eq } = await import("drizzle-orm");

  const email = `p2-dash-${Date.now()}@test.invalid`;
  const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Kavya Raman" });
  await completeOnboarding(personId, {
    role: "student", name: "Kavya Raman", targetRole: "Machine Learning Engineer", institution: "IIT Madras", degree: "B.Tech",
    priorities: ["projects", "learning", "jobs"], primaryPriority: "projects", skills: ["Python", "PyTorch"],
    projects: [
      { id: "p1", title: "Crop Disease Detector", description: "CNN on leaf images", technologies: ["PyTorch"], sources: ["github"], status: "confirmed", contribution: [], contributionNote: "" },
      { id: "p2", title: "Lecture Notes Q&A", description: "RAG over notes", technologies: ["FAISS"], sources: ["resume"], status: "confirmed", contribution: [], contributionNote: "" },
    ],
  });

  const browser = await chromium.launch();
  const result: Record<string, unknown> = {};
  for (const width of [1280, 375]) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
    await page.goto(`${BASE}/student`);
    await page.locator("[data-hero-kind]").waitFor({ timeout: 120_000 });
    // A marker on window survives only if the page is never reloaded.
    await page.evaluate(() => { (window as unknown as { __noReload: boolean }).__noReload = true; });
    const r: Record<string, unknown> = { initialHero: await heroKind(page), footprintOrder: await page.locator("[data-source]").evaluateAll((els) => els.map((e) => e.getAttribute("data-source"))) };
    await page.screenshot({ path: path.join(out, `p2-dash-initial-${width}.png`), fullPage: true });

    if (width === 1280) {
      // learning (#2) up to #1
      await page.getByRole("button", { name: "Move Learn AI & ML up" }).click();
      await page.getByText(/Learn AI & ML now leads your dashboard/).waitFor({ timeout: 60_000 });
      await page.locator('[data-hero-kind="learning_path"]').waitFor({ timeout: 30_000 });
      r.afterLearningHero = await heroKind(page);
      r.afterLearningFootprint = await page.locator("[data-source]").evaluateAll((els) => els.map((e) => e.getAttribute("data-source")));
      await page.screenshot({ path: path.join(out, `p2-dash-learning-${width}.png`), fullPage: true });
      // jobs (#3) up twice to #1
      await page.getByRole("button", { name: "Move Internships & Jobs up" }).click();
      await page.getByText("Priorities saved.", { exact: false }).waitFor();
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
      await page.getByRole("button", { name: "Move Internships & Jobs up" }).click();
      await page.locator('[data-hero-kind="readiness"]').waitFor({ timeout: 30_000 });
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
      r.afterJobsHero = await heroKind(page);
      r.jobsHeroText = (await page.locator("[data-hero-kind]").innerText()).replace(/\s+/g, " ").slice(0, 240);
      // target role in place
      await page.getByLabel("Target role").selectOption({ label: "Generative AI Engineer" });
      await page.getByText("Target role saved.").waitFor({ timeout: 60_000 });
      r.heroTitleAfterRole = await page.locator("[data-hero-kind] h2").innerText();
      await page.screenshot({ path: path.join(out, `p2-dash-jobs-${width}.png`), fullPage: true });
      r.neverReloaded = await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload === true);
      const prefs = await getUserPreferences(personId);
      const db = await getDb();
      const active = await db.select({ title: goals.title }).from(goals).where(and(eq(goals.personId, personId), eq(goals.status, "active")));
      r.db = { primaryPriority: prefs?.primaryPriority, secondaryPriorities: prefs?.secondaryPriorities, targetRole: (prefs?.metadata as Record<string, unknown>)?.targetRole, activeGoals: active.map((g) => g.title) };
      // Failure path: a bad role rolls back.
      await page.route("**/api/workspace/preferences", (route) => route.request().method() === "PATCH" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Could not save." }) }) : route.continue());
      await page.getByLabel("Target role").selectOption({ index: 3 });
      await page.getByRole("alert").filter({ hasText: "previous choice is back" }).waitFor();
      r.rollbackSelected = await page.getByLabel("Target role").evaluate((el) => (el as HTMLSelectElement).selectedOptions[0].text);
    }
    r.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    r.pageErrors = errors;
    result[width] = r;
    await page.close();
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  const { closeDbForTesting } = await import("../lib/db");
  await closeDbForTesting();
}
main().catch((e) => { console.error(e); process.exit(1); });
