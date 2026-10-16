/**
 * Browser check for Task 2.1.1: Screen 3b (AI/ML direction) asks only for the
 * target role, and Continue goes straight to purpose ranking. Needs the
 * test-database dev server described in scripts/visual-phase2-progress.ts.
 *
 *   node --import tsx scripts/visual-phase2-direction.ts <outDir>
 */
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

async function seed() {
  const { useTestDatabase } = await import("./lib/test-db");
  await useTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { writeOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
  const email = `p2-dir-${Date.now()}@test.invalid`;
  const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Asha Rao" });
  // A draft saved before 2.1.1, still carrying the removed fields.
  await writeOnboardingDraft(personId, { name: "Asha Rao", role: "student", currentScreen: 3.2, goal: "Get an AI/ML internship", targetTimeline: "Within 6 months" });
  return { email, personId, readOnboardingDraft };
}

async function main() {
  const { email, personId, readOnboardingDraft } = await seed();
  const browser = await chromium.launch();
  const results: Record<string, unknown> = {};
  try {
    for (const [name, viewport] of [["1280", { width: 1280, height: 900 }], ["375", { width: 375, height: 812 }]] as const) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
      if (!res.ok()) throw new Error(`sign-in ${res.status()}`);
      await page.goto(`${BASE}/onboarding`);
      await page.getByRole("heading", { name: /Where do you want to go in AI/ }).waitFor({ timeout: 60_000 });
      await page.screenshot({ path: path.join(out, `p2-direction-${name}.png`), fullPage: true });
      const text = await page.locator("main").innerText();
      results[name] = {
        asksBigGoal: /first big goal/i.test(text),
        asksTimeline: /when would you like/i.test(text),
        horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
        pageErrors: errors,
      };
      if (name === "375") {
        await page.getByText("Machine Learning Engineer", { exact: true }).first().click();
        await page.getByRole("button", { name: "Continue" }).click();
        await page.waitForTimeout(1500);
        const draft = (await readOnboardingDraft(personId)) as Record<string, unknown>;
        results.afterContinue = {
          nextScreenText: (await page.locator("h1").first().innerText()).slice(0, 80),
          savedTargetRole: draft.targetRole,
          savedGoal: draft.goal ?? null,
          savedTimeline: draft.targetTimeline ?? null,
        };
      }
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
