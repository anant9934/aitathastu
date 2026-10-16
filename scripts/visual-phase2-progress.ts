/**
 * Browser check for the onboarding progress screen (Tasks 2.1.3, 2.1.10).
 * Needs a dev server on the test database (see scripts/lib/test-db.ts):
 *
 *   NEXT_DIST_DIR=.next-test DATABASE_URL=<local test db> DATABASE_MODE=postgres \
 *     DATABASE_TRANSPORT=tcp npx next dev -p 3100
 *   node --import tsx scripts/visual-phase2-progress.ts <outDir>
 *
 * Seeds a student on Screen 7 with mixed source states, captures 1280 and
 * 375 px, then settles CV + GitHub in the DB and asserts the screen moves to
 * review on its own and shows the per-source summary there.
 */
import { execFileSync } from "child_process";
import path from "path";
import { chromium, type Page } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";
const seedScript = path.join(__dirname, "lib", "seed-phase2-progress-visual.ts");
const runSeed = (...args: string[]) =>
  execFileSync(process.execPath, ["--import", "tsx", seedScript, ...args], { encoding: "utf8" }).trim().split("\n").pop()!;

async function signIn(page: Page, email: string, password: string) {
  const res = await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password } });
  if (!res.ok()) throw new Error(`sign-in failed: ${res.status()}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results: Record<string, unknown> = {};
  try {
    for (const [name, viewport] of [["1280", { width: 1280, height: 860 }], ["375", { width: 375, height: 812 }]] as const) {
      const fixture = JSON.parse(runSeed());
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await signIn(page, fixture.email, fixture.password);
      await page.goto(`${BASE}/onboarding`);
      await page.getByRole("heading", { name: "Importing what we found" }).waitFor({ timeout: 60_000 });
      await page.getByText("Needs your code").waitFor();
      await page.screenshot({ path: path.join(out, `p2-progress-${name}.png`), fullPage: true });

      const rows = await page.locator(".spb-row").allInnerTexts();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      // A LinkedIn code is pending, so the 8 s guard must NOT move on.
      await page.waitForTimeout(9_000);
      const heldForOtp = await page.getByRole("heading", { name: "Importing what we found" }).isVisible();

      // Settle CV + GitHub (and skip LinkedIn) in the DB: the next poll moves to review.
      const settledAt = Date.now();
      runSeed("settle", fixture.personId);
      await page.getByLabel("Import status by source").waitFor({ timeout: 15_000 });
      const advanceMs = Date.now() - settledAt;
      await page.getByText("14 items found").waitFor();
      await page.screenshot({ path: path.join(out, `p2-review-summary-${name}.png`) });
      const summary = await page.getByLabel("Import status by source").innerText();

      results[name] = { rows, horizontalOverflow: overflow, heldForOtp, advanceMsAfterSettle: advanceMs, summary, pageErrors: errors };
      await context.close();
    }
    // Timeout guard: GitHub stays "running" and nothing waits on the student.
    {
      const fixture = JSON.parse(runSeed("slow"));
      const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      const page = await context.newPage();
      await signIn(page, fixture.email, fixture.password);
      await page.goto(`${BASE}/onboarding`);
      await page.getByRole("heading", { name: "Importing what we found" }).waitFor({ timeout: 60_000 });
      const shownAt = Date.now();
      await page.getByLabel("Import status by source").waitFor({ timeout: 20_000 });
      const advanceMs = Date.now() - shownAt;
      // The banner polls on mount; wait for its first answer before reading it.
      await page.getByLabel("Import status by source").getByText("GitHub").waitFor();
      const summary = await page.getByLabel("Import status by source").innerText();
      results.timeoutGuard = { advanceMsAfterShown: advanceMs, githubStillImporting: /GitHub\s+Importing/.test(summary) };
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
