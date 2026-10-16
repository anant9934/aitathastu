/**
 * Browser checks for Tasks 2.1.8 (BUG #1: EORA's speech-cloud Next on Screen 2)
 * and 2.1.9 (BUG #2: graduation year lost when a draft is restored on
 * Screen 4). Needs the test-database dev server described in
 * scripts/visual-phase2-progress.ts.
 *
 *   node --import tsx scripts/visual-phase2-onboarding-bugs.ts <outDir>
 */
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

async function main() {
  const { useTestDatabase } = await import("./lib/test-db");
  await useTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { writeOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
  const results: Record<string, unknown> = {};
  const browser = await chromium.launch();
  try {
    for (const [name, viewport] of [["1280", { width: 1280, height: 900 }], ["375", { width: 375, height: 812 }]] as const) {
      const r: Record<string, unknown> = {};

      // 2.1.8: a brand-new visitor (guest session) on Screen 2.
      {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(`${BASE}/onboarding`);
        const nameInput = page.locator("#student-name-input");
        await nameInput.waitFor({ timeout: 90_000 });
        const bubbleNext = page.locator(".eora-cloud-primary-next-btn");
        // On phones EORA starts collapsed to its avatar; tapping it opens the speech cloud.
        // Desktop: EORA's tour cloud is open and its Next must validate + advance.
        // Phones: the tour cloud is collapsed (the avatar opens the help/chat panel instead),
        // so the screen's own submit arrow is the path; it runs the same validated submit.
        const opened = await bubbleNext.waitFor({ timeout: 6_000 }).then(() => true, () => false);
        const advance = opened ? bubbleNext : page.getByRole("button", { name: "Submit name and continue" });
        r.advancePath = opened ? "EORA speech-cloud Next" : "screen submit (tour cloud collapsed on phones)";
        // Empty name: EORA's Next must not advance.
        await nameInput.fill("");
        await advance.click();
        await page.waitForTimeout(800);
        r.emptyNameStaysOnScreen2 = await nameInput.isVisible();
        r.emptyNameError = await page.locator("#student-name-error").innerText().catch(() => null);
        await nameInput.fill("Asha");
        if (name === "1280") await page.screenshot({ path: path.join(out, `p2-bug1-screen2-${name}.png`) });
        await advance.click();
        await page.getByText(/Student|Faculty/).first().waitFor({ timeout: 15_000 });
        r.eoraNextAdvancedToScreen3 = (await page.locator("h1").first().innerText()).slice(0, 80);
        r.pageErrors = errors;
        await context.close();
      }

      // 2.1.9: restored drafts on Screen 4.
      for (const [label, draft] of [
        ["3rd Year + 2027, no degree", { year: "3rd Year", expectedGraduationYear: 2027, institution: "IIT Delhi" }],
        ["year field holds 2027", { year: "2027" }],
      ] as const) {
        const email = `p2-bug2-${name}-${Date.now()}@test.invalid`;
        const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Asha Rao" });
        await writeOnboardingDraft(personId, { name: "Asha Rao", role: "student", currentScreen: 4, ...draft });
        const stored = await readOnboardingDraft(personId);
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
        await page.goto(`${BASE}/onboarding`);
        const grad = page.locator("#field-gradyear");
        await grad.waitFor({ timeout: 60_000 });
        r[`screen4: ${label}`] = {
          storedDraft: { year: stored?.year, expectedGraduationYear: stored?.expectedGraduationYear },
          gradYearField: await grad.inputValue(),
          institutionField: await page.locator("#field-institution").inputValue().catch(() => null),
        };
        if (label.startsWith("3rd")) await page.screenshot({ path: path.join(out, `p2-bug2-screen4-${name}.png`) });
        r.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        await context.close();
      }
      results[name] = r;
    }
  } finally {
    await browser.close();
    const { closeDbForTesting } = await import("../lib/db");
    await closeDbForTesting();
  }
  console.log(JSON.stringify(results, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
