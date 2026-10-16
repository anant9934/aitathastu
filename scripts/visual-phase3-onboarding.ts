/**
 * Phase 3 onboarding in the browser: walks the whole flow as a new visitor at
 * 1280 and 375 px in dark and light, capturing every step. Per screen it
 * records horizontal overflow, page errors, whether Geist actually loaded
 * (P4-15), and whether the EORA guide sits inside the page flow (P4-13).
 * Needs the test server: sh scripts/ops/start-test-server.sh 3100
 *
 *   node --import tsx scripts/visual-phase3-onboarding.ts <outDir>
 */
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import { chromium, type Page } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || "scratch/phase3/onboarding";
fs.mkdirSync(out, { recursive: true });

type Check = { step: string; overflow: number; fonts: string[]; stepLabel: string | null; guideInFlow: boolean | null; errors: string[] };

async function inspect(page: Page, step: string, errors: string[]): Promise<Check> {
  await page.waitForTimeout(250);
  return page.evaluate(async ({ step, errors }) => {
    await document.fonts.ready;
    const fonts = [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")))];
    const label = document.querySelector('nav[aria-label="Onboarding progress"] p span')?.textContent ?? null;
    const guide = document.querySelector('aside[aria-label="EORA, your guide"]');
    // In flow = not fixed/absolute, and it does not overlap the h1.
    let guideInFlow: boolean | null = null;
    if (guide) {
      const pos = getComputedStyle(guide).position;
      const h1 = document.querySelector("h1")?.getBoundingClientRect();
      const g = guide.getBoundingClientRect();
      const overlaps = h1 ? !(g.bottom <= h1.top || g.top >= h1.bottom || g.right <= h1.left || g.left >= h1.right) : false;
      guideInFlow = pos !== "fixed" && pos !== "absolute" && !overlaps;
    }
    return { step, overflow: document.documentElement.scrollWidth - window.innerWidth, fonts, stepLabel: label, guideInFlow, errors: [...errors] };
  }, { step, errors });
}

async function walk(page: Page, tag: string, results: Check[], errors: string[]) {
  const shot = async (step: string) => {
    results.push(await inspect(page, step, errors));
    errors.length = 0;
    await page.screenshot({ path: path.join(out, `${tag}-${step}.png`), fullPage: true });
  };
  const next = async (name: RegExp = /^(Continue|Let's start|Skip for now|Looks right|Review what we found|Continue without a CV)/) => {
    await page.getByRole("button", { name }).last().click();
  };

  await page.goto(`${BASE}/onboarding`);
  await page.getByLabel("What should I call you?").waitFor({ timeout: 90_000 });
  await shot("02-welcome");
  // Empty name is rejected in place.
  await page.getByRole("button", { name: /Let's start/ }).click();
  await page.getByText("Tell me what to call you").waitFor();
  await page.getByLabel("What should I call you?").fill("Kavya");
  await page.getByRole("button", { name: /Let's start/ }).click();

  await page.getByRole("heading", { name: "Which best describes you?" }).waitFor({ timeout: 30_000 });
  await shot("03-role");
  await next();

  await page.getByRole("heading", { name: /Where are you heading/ }).waitFor();
  await page.getByRole("radio", { name: /Machine Learning Engineer/ }).click();
  await shot("04-direction");
  await next();

  await page.getByRole("heading", { name: /What do you want from AI Tathastu/ }).waitFor();
  await page.getByRole("button", { name: "Build Projects" }).click();
  await page.getByRole("button", { name: "Learn AI & ML" }).click();
  await shot("05-priorities");
  await next();

  await page.getByRole("heading", { name: "Add your CV" }).waitFor();
  await page.waitForTimeout(800);
  await shot("06-cv");
  await page.getByRole("button", { name: /Continue without a CV/ }).last().click();

  await page.getByRole("heading", { name: /A few details about you/ }).waitFor();
  await next();
  await page.locator('[aria-invalid="true"]').first().waitFor();
  await shot("07-details-errors");
  const email = `p3-${tag}-${Date.now()}@test.invalid`;
  await page.getByLabel("Full name").fill("Kavya Raman");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Create a password").fill("visual-check-pw");
  await page.getByLabel("College, university or employer").fill("IIT Madras");
  await page.getByLabel("Degree").fill("B.Tech");
  await page.getByLabel("Where you are now").selectOption("3rd year");
  await next();

  await page.getByRole("heading", { name: /Connect the accounts/ }).waitFor({ timeout: 30_000 });
  await shot("08-accounts");
  await page.getByRole("button", { name: "Connect" }).nth(1).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(300);
  const drawer = await page.evaluate(() => {
    const d = document.querySelector('[data-overlay="drawer"]') as HTMLElement | null;
    const r = d?.getBoundingClientRect();
    return { portalledToBody: d?.parentElement === document.body, top: r?.top, height: r?.height, vh: window.innerHeight, focusInside: Boolean(d?.contains(document.activeElement)) };
  });
  results.push({ step: "08b-connector-drawer", overflow: 0, fonts: [], stepLabel: JSON.stringify(drawer), guideInFlow: null, errors: [] });
  await page.screenshot({ path: path.join(out, `${tag}-08b-connector-drawer.png`) });
  await page.keyboard.press("Escape");
  await next();

  await page.getByRole("heading", { name: "Importing what we found" }).waitFor();
  await shot("09-import");
  await page.getByRole("heading", { name: /Here's what we found/ }).waitFor({ timeout: 30_000 });
  await shot("10-review");
  // P4-16: changing the institution in the profile changes the header line too.
  await page.getByRole("button", { name: /Edit College, university or employer/ }).click();
  await page.getByLabel(/College, university or employer/).fill("Indian Institute of Technology Madras");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText(/B\.Tech · Indian Institute of Technology Madras/).waitFor();
  await page.getByRole("button", { name: /^Skills/ }).first().click().catch(() => page.getByRole("tab", { name: /Skills/ }).click());
  await page.getByLabel("Add a skill").fill("PyTorch");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: /^Experience/ }).first().click().catch(() => page.getByRole("tab", { name: /Experience/ }).click());
  await page.getByRole("button", { name: /I don't have work experience yet/ }).click();
  await shot("10b-review-filled");
  await next(/Looks right/);

  await page.getByRole("heading", { name: /Your skills, and what backs them/ }).waitFor({ timeout: 30_000 });
  await shot("11-skills");
  await next();
  await page.getByRole("heading", { name: "Confirm your projects" }).waitFor();
  await shot("12-projects");
  await next();
  await page.getByRole("heading", { name: /Ready to build your workspace/ }).waitFor();
  await shot("13-finish");
  return email;
}

async function main() {
  const browser = await chromium.launch();
  const all: Record<string, Check[]> = {};
  for (const theme of ["dark", "light"] as const) {
    for (const width of [1280, 375]) {
      const tag = `${theme}-${width}`;
      // Each run creates a guest session; clear the LOCAL emulator's rate-limit counters so runs don't trip the per-network limit.
      try { execSync("docker exec tathastu-phase1-redis redis-cli FLUSHALL", { stdio: "ignore" }); } catch { /* emulator not running */ }
      const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 860 } });
      await context.addInitScript((t) => { try { localStorage.setItem("tathastu-theme", t); } catch { /* ignore */ } }, theme);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const results: Check[] = [];
      try {
        await walk(page, tag, results, errors);
      } catch (e) {
        results.push({ step: "FAILED", overflow: -1, fonts: [], stepLabel: e instanceof Error ? e.message.split("\n")[0] : String(e), guideInFlow: null, errors: [...errors] });
        await page.screenshot({ path: path.join(out, `${tag}-FAILED.png`), fullPage: true });
      }
      all[tag] = results;
      await context.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(all, null, 2));
  console.log(JSON.stringify(all, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
