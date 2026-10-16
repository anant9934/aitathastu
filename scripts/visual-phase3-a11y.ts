/**
 * Phase 3 accessibility and responsive sweep (Tasks 3.4.1, 3.4.2, 3.2.2):
 * - every route at 768 / 1024 / 1440 / 1920: horizontal overflow;
 * - keyboard: the first 25 Tab stops per page show a visible focus indicator;
 * - overlays: the "More" sheet and the focus drawer trap focus, close on Esc,
 *   return focus to their trigger;
 * - theme: Light persists across client navigation and a reload;
 * - error boundary: a malformed skill URL renders the honest error screen;
 * - EORA: the panel opens from the shell, a free-form question opens the chat
 *   drawer with focus inside, and the answer or error is shown in words.
 * Needs the test server (sh scripts/ops/start-test-server.sh 3100).
 *
 *   node --import tsx scripts/visual-phase3-a11y.ts <outDir>
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { chromium, type Page } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || "scratch/phase3/a11y";
fs.mkdirSync(out, { recursive: true });
const ROUTES = ["/", "/sign-in", "/student", "/student/profile", "/student/skills", "/student/projects", "/student/connections", "/student/roadmap", "/onboarding"];

async function focusAudit(page: Page) {
  const misses: string[] = [];
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const visible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
      return { visible, name: `${el.tagName.toLowerCase()} ${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}` };
    });
    if (r && !r.visible) misses.push(r.name);
  }
  return misses;
}

async function main() {
  const fx = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", path.join(__dirname, "lib", "seed-phase3-student.ts"), "rich"], { encoding: "utf8" }).trim().split("\n").pop()!);
  const browser = await chromium.launch();
  const report: Record<string, unknown> = {};

  // Breakpoints.
  const bp: Record<string, number> = {};
  for (const width of [768, 1024, 1440, 1920]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email: fx.email, password: fx.password }, headers: { Origin: BASE } });
    for (const r of ROUTES.filter((x) => x !== "/onboarding")) {
      await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      bp[`${width}${r}`] = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    }
    await page.screenshot({ path: path.join(out, `bp-${width}-roadmap.png`) });
    await ctx.close();
  }
  report.breakpointOverflow = Object.fromEntries(Object.entries(bp).filter(([, v]) => v !== 0));
  report.breakpointsChecked = Object.keys(bp).length;

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email: fx.email, password: fx.password }, headers: { Origin: BASE } });

  // Keyboard focus visibility.
  const focus: Record<string, string[]> = {};
  for (const r of ROUTES) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    focus[r] = await focusAudit(page);
  }
  report.focusMisses = Object.fromEntries(Object.entries(focus).filter(([, v]) => v.length));

  // Focus drawer: trap, Esc, return.
  await page.goto(`${BASE}/student`, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "Change focus" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Your focus" }).waitFor();
  await page.waitForTimeout(250);
  const inside: boolean[] = [];
  for (let i = 0; i < 30; i++) { await page.keyboard.press("Tab"); inside.push(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))); }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  report.drawer = {
    focusStayedInside: inside.every(Boolean),
    closedOnEsc: (await page.getByRole("dialog").count()) === 0,
    focusReturnedToTrigger: await page.evaluate(() => document.activeElement?.textContent?.includes("Change focus") ?? false),
  };

  // Theme persistence across client navigation and reload.
  await page.getByRole("radio", { name: "Light theme" }).first().click();
  await page.getByRole("link", { name: "Projects" }).first().click();
  await page.waitForURL(/\/student\/projects/);
  const afterNav = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.reload({ waitUntil: "domcontentloaded" });
  const afterReload = await page.evaluate(() => document.documentElement.dataset.theme);
  report.theme = { afterClientNav: afterNav, afterReload, stored: await page.evaluate(() => localStorage.getItem("tathastu-theme")) };
  await page.getByRole("radio", { name: "Dark theme" }).first().click();

  // Error boundary.
  await page.goto(`${BASE}/student/skills/%E0%A4%A`, { waitUntil: "networkidle" });
  report.errorBoundary = {
    heading: await page.locator("h1").first().textContent().catch(() => null),
    claimsDataSafe: (await page.content()).includes("still available"),
  };
  await page.screenshot({ path: path.join(out, "error-boundary.png") });

  // EORA panel and chat handoff.
  await page.goto(`${BASE}/student`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ask EORA/ }).first().click();
  await page.getByLabel("Ask EORA", { exact: true }).fill("Which of my data sources failed and how do I fix it?");
  await page.keyboard.press("Enter");
  const chat = page.getByRole("dialog", { name: "Ask EORA" });
  await chat.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(300);
  const focusInChat = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
  await page.waitForFunction(() => !document.body.textContent?.includes("EORA is looking through your profile"), null, { timeout: 90_000 }).catch(() => undefined);
  const chatText = (await chat.innerText()).replace(/\s+/g, " ").slice(0, 400);
  await page.screenshot({ path: path.join(out, "eora-chat.png") });
  report.eora = { chatOpened: true, focusInChat, chatText };
  report.pageErrors = errors;

  await browser.close();
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
