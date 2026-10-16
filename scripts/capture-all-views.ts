import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/Users/quantum/.gemini/antigravity-ide/brain/87d4e048-155c-4560-9d37-977250ecd68e";

const VIEWPORTS = [
  { width: 320, height: 800, name: "320" },
  { width: 390, height: 844, name: "390" },
  { width: 768, height: 1024, name: "768" },
  { width: 1440, height: 900, name: "1440" },
];

async function captureMode(mode: "baseline_dark" | "before_light" | "after_dark" | "after_light") {
  const isLight = mode.includes("light");
  const theme = isLight ? "light" : "dark";
  const outDir = join(ARTIFACT_DIR, "screenshots", mode);
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });

      // Set theme in localStorage before page load
      await context.addInitScript((t) => {
        try {
          localStorage.setItem("tathastu-theme", t);
        } catch {}
      }, theme);

      const page = await context.newPage();

      // 1. Landing Page
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      // Main Hero
      const heroEl = page.locator(".hero");
      if (await heroEl.count() > 0) {
        await heroEl.first().screenshot({ path: join(outDir, `01_hero_${vp.name}.png`) });
      }

      // Solution Band ("One ambition. A journey built around you.")
      const solutionEl = page.locator(".solution-band");
      if (await solutionEl.count() > 0) {
        await solutionEl.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await solutionEl.first().screenshot({ path: join(outDir, `02_solution_band_${vp.name}.png`) });
      }

      // Journey Section ("Every possibility begins with a first step.")
      const journeyEl = page.locator(".section--journey");
      if (await journeyEl.count() > 0) {
        await journeyEl.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await journeyEl.first().screenshot({ path: join(outDir, `03_journey_${vp.name}.png`) });
      }

      // Skill Graph Section ("See how your skills connect.")
      const graphEl = page.locator(".section--graph").first();
      if (await graphEl.count() > 0) {
        await graphEl.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        await graphEl.screenshot({ path: join(outDir, `04_skill_graph_${vp.name}.png`) });
      }

      // Landing Dashboard Preview
      const dashPreview = page.locator(".dash-shell, .dash-preview, #dashTitle").first();
      if (await dashPreview.count() > 0) {
        const parentSection = page.locator("section:has(#dashTitle)").first();
        if (await parentSection.count() > 0) {
          await parentSection.scrollIntoViewIfNeeded();
          await page.waitForTimeout(400);
          await parentSection.screenshot({ path: join(outDir, `05_dash_landing_${vp.name}.png`) });
        }
      }

      // 2. Representative Form: Sign In
      await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(outDir, `06_form_signin_${vp.name}.png`), fullPage: false });

      // 3. Representative Form: Sign Up
      await page.goto(`${BASE_URL}/sign-up`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(outDir, `07_form_signup_${vp.name}.png`), fullPage: false });

      // 4. Representative Dashboard: /student (authenticated)
      try {
        await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
        await page.fill('input[type="email"], input[name="email"]', "staging_student_v33@aitathastu.test");
        await page.fill('input[type="password"], input[name="password"]', "StudentPass123!");
        await page.click('button[type="submit"]');
        await page.waitForURL("**/student**", { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1000);
        if (page.url().includes("/student")) {
          await page.screenshot({ path: join(outDir, `08_dashboard_student_${vp.name}.png`), fullPage: false });
        }
      } catch (err) {
        console.warn(`Could not capture /student at ${vp.name}:`, (err as Error).message);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const targetMode = process.argv[2] as "baseline_dark" | "before_light" | "after_dark" | "after_light" | "both_initial";
  if (targetMode === "both_initial") {
    console.log("Capturing baseline_dark...");
    await captureMode("baseline_dark");
    console.log("Capturing before_light...");
    await captureMode("before_light");
  } else if (targetMode) {
    console.log(`Capturing ${targetMode}...`);
    await captureMode(targetMode);
  } else {
    console.log("Capturing both_initial...");
    await captureMode("baseline_dark");
    await captureMode("before_light");
  }
  console.log("Screenshots captured successfully.");
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
