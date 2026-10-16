/**
 * Task 3.5.1: the one SkillsMap component in its three new placements, at
 * 1280 and 375 px in dark and light. Needs the test server
 * (sh scripts/ops/start-test-server.sh 3100).
 *
 *  - Landing (demo): renders, no horizontal overflow, hover dims unrelated
 *    nodes, no tab stops, and NOT ONE /api/ request is made by the page.
 *  - Dashboard (compact): renders the seeded student's real skills, links to
 *    the full map, and picks up a skill added through the API on refocus.
 *  - Skills page (full): unchanged controls still present.
 *  - Onboarding skills review (full, in-progress data): walks a no-CV signup,
 *    adds one skill with no evidence, mocks a GitHub import still running, and
 *    checks the map draws a zero-evidence node, gaps and the progress note.
 *
 *   node --import tsx scripts/visual-phase3-skills-map.ts <outDir>
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { chromium, type Page } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || "scratch/phase3/skills-map";
fs.mkdirSync(out, { recursive: true });
type Row = Record<string, unknown>;
const results: Row[] = [];
const fail: string[] = [];
const expect = (ok: unknown, msg: string) => { if (!ok) fail.push(msg); };

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const mapInfo = (page: Page, mode: string) => page.evaluate((mode) => {
  const m = document.querySelector(`[data-testid="skills-map"][data-mode="${mode}"]`) as HTMLElement | null;
  if (!m) return null;
  const r = m.getBoundingClientRect();
  return {
    width: Math.round(r.width), height: Math.round(r.height),
    skills: m.querySelectorAll('.sim-node[data-node^="skill_"]').length,
    evidence: m.querySelectorAll('.sim-node[data-node^="ev_"]').length,
    gaps: m.querySelectorAll('.sim-node[data-status="gap"]').length,
    claimed: m.querySelectorAll('.sim-node[data-status="claimed"]').length,
    tabStops: m.querySelectorAll('.sim-node[tabindex]').length,
    hasSearch: Boolean(m.querySelector('input[type="search"]')),
    fullLink: (m.querySelector('[data-testid="view-full-map"]') as HTMLAnchorElement | null)?.getAttribute("href") ?? null,
    fullLinkText: m.querySelector('[data-testid="view-full-map"]')?.textContent ?? null,
    note: m.querySelector('[data-testid="map-progress-note"]')?.textContent ?? null,
    svgLabel: m.querySelector("svg[role]")?.getAttribute("aria-label") ?? null,
  };
}, mode);

async function context(browser: Awaited<ReturnType<typeof chromium.launch>>, theme: string, width: number) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 860 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem("tathastu-theme", t); } catch { /* ignore */ } }, theme);
  return ctx;
}

async function main() {
  const fixture = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", path.join(__dirname, "lib", "seed-phase3-student.ts"), "rich"], { encoding: "utf8" }).trim().split("\n").pop()!);
  const browser = await chromium.launch();
  for (const theme of ["dark", "light"] as const) {
    for (const width of [1280, 375]) {
      const tag = `${theme}-${width}`;
      const errors: string[] = [];

      // Landing demo: static, no API traffic.
      {
        const ctx = await context(browser, theme, width);
        const page = await ctx.newPage();
        page.on("pageerror", (e) => errors.push(`landing: ${e.message}`));
        const api: string[] = [];
        page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url()); });
        await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 180_000 });
        const map = page.locator('[data-testid="skills-map"][data-mode="demo"]');
        await map.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        const info = await mapInfo(page, "demo");
        let hoverDimmed = 0;
        if (width === 1280) {
          await map.locator('.sim-node[data-node="skill_python"]').hover();
          await page.waitForTimeout(250);
          hoverDimmed = await page.evaluate(() => document.querySelectorAll('[data-mode="demo"] .sim-node[opacity="0.22"]').length);
        }
        await map.screenshot({ path: path.join(out, `${tag}-landing-map.png`) });
        await page.screenshot({ path: path.join(out, `${tag}-landing-full.png`), fullPage: true });
        const ov = await overflow(page);
        results.push({ tag, place: "landing", overflow: ov, apiRequests: api, hoverDimmed, ...info });
        expect(info && info.skills === 9, `${tag} landing: expected 9 skill nodes (8 + 1 gap), got ${info?.skills}`);
        expect(info?.tabStops === 0, `${tag} landing: demo nodes must not be tab stops`);
        expect(api.length === 0, `${tag} landing: demo made API requests ${api.join(", ")}`);
        expect(ov <= 0, `${tag} landing: overflow ${ov}`);
        if (width === 1280) expect(hoverDimmed > 0, `${tag} landing: hover did not dim unrelated nodes`);
        await ctx.close();
      }

      // Dashboard compact + skills page full.
      {
        const ctx = await context(browser, theme, width);
        const page = await ctx.newPage();
        page.on("pageerror", (e) => errors.push(`dashboard: ${e.message}`));
        const res = await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email: fixture.email, password: fixture.password }, headers: { Origin: BASE } });
        if (!res.ok()) throw new Error(`sign-in failed: ${res.status()}`);
        await page.goto(`${BASE}/student`, { waitUntil: "networkidle", timeout: 180_000 });
        const map = page.locator('[data-testid="skills-map"][data-mode="compact"]');
        await map.waitFor({ timeout: 60_000 });
        await map.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        const before = await mapInfo(page, "compact");
        // Selecting a skill shows what backs it, in place.
        await map.locator('.sim-node[data-node="skill_pytorch"]').click();
        const selection = await page.locator('[data-testid="compact-selection"]').textContent().catch(() => null);
        await map.screenshot({ path: path.join(out, `${tag}-dashboard-map.png`) });
        await page.screenshot({ path: path.join(out, `${tag}-dashboard-full.png`), fullPage: true });
        const ov = await overflow(page);

        // Live: add a skill through the API, refocus the tab, the map must change without a reload.
        let liveAdded: unknown = null, liveRemoved: unknown = null;
        if (theme === "dark" && width === 1280) {
          const name = `Rust ${Date.now() % 10000}`;
          const add = await page.request.post(`${BASE}/api/student/skills`, { data: { name }, headers: { Origin: BASE } });
          await page.evaluate(() => window.dispatchEvent(new Event("focus")));
          await page.waitForTimeout(2500);
          const after = await mapInfo(page, "compact");
          liveAdded = { status: add.status(), before: before?.svgLabel, beforeLink: before?.fullLinkText, after: after?.svgLabel, afterLink: after?.fullLinkText };
          expect(add.ok(), `live: POST skill failed ${add.status()}`);
          expect(after && (after.svgLabel !== before?.svgLabel || after.fullLinkText !== before?.fullLinkText), `live: compact map did not change after adding a skill (${JSON.stringify(liveAdded)})`);
          const del = await page.request.delete(`${BASE}/api/student/skills?name=${encodeURIComponent(name)}`, { headers: { Origin: BASE } });
          await page.evaluate(() => window.dispatchEvent(new Event("focus")));
          await page.waitForTimeout(2500);
          const restored = await mapInfo(page, "compact");
          liveRemoved = { status: del.status(), label: restored?.svgLabel, link: restored?.fullLinkText };
          expect(restored?.svgLabel === before?.svgLabel && restored?.fullLinkText === before?.fullLinkText, `live: map did not return to original after delete (${JSON.stringify(liveRemoved)})`);
        }
        results.push({ tag, place: "dashboard", overflow: ov, selection, liveAdded, liveRemoved, ...before });
        expect(before && before.skills > 0 && before.skills <= 13, `${tag} dashboard: compact skill count ${before?.skills}`);
        expect(before?.fullLink === "/student/skills", `${tag} dashboard: View full map link missing`);
        expect(!before?.hasSearch, `${tag} dashboard: compact should not have search`);
        expect(selection && /PyTorch/.test(selection), `${tag} dashboard: selection line missing`);
        expect(ov <= 0, `${tag} dashboard: overflow ${ov}`);

        await page.goto(`${BASE}/student/skills`, { waitUntil: "networkidle", timeout: 180_000 });
        await page.locator('[data-testid="skills-map"][data-mode="full"]').waitFor({ timeout: 60_000 });
        const fullInfo = await mapInfo(page, "full");
        const zoomButtons = await page.getByRole("button", { name: /Zoom in|Zoom out|Reset view/ }).count();
        results.push({ tag, place: "skills-page", overflow: await overflow(page), zoomButtons, ...fullInfo });
        expect(fullInfo?.hasSearch && zoomButtons === 3, `${tag} skills page: full controls missing`);
        await ctx.close();
      }

      // Onboarding skills review with in-progress data.
      {
        const ctx = await context(browser, theme, width);
        const page = await ctx.newPage();
        page.on("pageerror", (e) => errors.push(`onboarding: ${e.message}`));
        // A GitHub import still running while the person reviews skills.
        await page.route("**/api/student/processing-jobs*", (route) => route.request().method() === "GET"
          ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, jobs: [{ sourceId: "github", status: "running" }] }) })
          : route.continue());
        await walkToSkills(page, tag);
        const map = page.locator('[data-testid="skills-map"][data-mode="full"]');
        await map.waitFor({ timeout: 30_000 });
        await map.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        const info = await mapInfo(page, "full");
        // Keyboard: a node is reachable and opens the detail panel.
        await map.locator('.sim-node[data-node="skill_pytorch"]').focus();
        await page.keyboard.press("Enter");
        const panel = await page.getByText(/Nothing backs this yet|your word|Claimed/i).first().isVisible().catch(() => false);
        await map.screenshot({ path: path.join(out, `${tag}-onboarding-map.png`) });
        await page.screenshot({ path: path.join(out, `${tag}-onboarding-full.png`), fullPage: true });
        const ov = await overflow(page);
        results.push({ tag, place: "onboarding", overflow: ov, panelOpened: panel, ...info });
        expect(info && info.skills >= 1 && info.claimed >= 1, `${tag} onboarding: zero-evidence skill not drawn`);
        expect(info && info.gaps >= 1, `${tag} onboarding: role gaps not drawn`);
        expect(info?.evidence === 0, `${tag} onboarding: expected no evidence nodes yet, got ${info?.evidence}`);
        expect(info?.hasSearch && info.tabStops > 0, `${tag} onboarding: full controls missing`);
        expect(info?.note && /Still importing from GitHub/.test(info.note), `${tag} onboarding: importing note missing (${info?.note})`);
        expect(ov <= 0, `${tag} onboarding: overflow ${ov}`);
        await ctx.close();
      }
      expect(errors.length === 0, `${tag} page errors: ${errors.join(" | ")}`);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ results, fail }, null, 2));
  console.log(JSON.stringify(results, null, 1));
  console.log(fail.length ? `FAILURES (${fail.length}):\n- ${fail.join("\n- ")}` : "ALL CHECKS PASSED");
  process.exit(fail.length ? 1 : 0);
}

/** Same path as visual-phase3-onboarding.ts, trimmed: no CV, add one skill by hand, land on the skills review. */
async function walkToSkills(page: Page, tag: string) {
  const next = async (name: RegExp = /^(Continue|Let's start|Skip for now|Looks right|Review what we found|Continue without a CV)/) => { await page.getByRole("button", { name }).last().click(); };
  await page.goto(`${BASE}/onboarding`);
  await page.getByLabel("What should I call you?").waitFor({ timeout: 90_000 });
  await page.getByLabel("What should I call you?").fill("Kavya");
  await page.getByRole("button", { name: /Let's start/ }).click();
  await page.getByRole("heading", { name: "Which best describes you?" }).waitFor({ timeout: 30_000 });
  await next();
  await page.getByRole("heading", { name: /Where are you heading/ }).waitFor();
  await page.getByRole("radio", { name: /Machine Learning Engineer/ }).click();
  await next();
  await page.getByRole("heading", { name: /What do you want from AI Tathastu/ }).waitFor();
  await page.getByRole("button", { name: "Build Projects" }).click();
  await next();
  await page.getByRole("heading", { name: "Add your CV" }).waitFor();
  await page.getByRole("button", { name: /Continue without a CV/ }).last().click();
  await page.getByRole("heading", { name: /A few details about you/ }).waitFor();
  await page.getByLabel("Full name").fill("Kavya Raman");
  await page.getByLabel("Email").fill(`p3-map-${tag}-${Date.now()}@test.invalid`);
  await page.getByLabel("Create a password").fill("visual-check-pw");
  await page.getByLabel("College, university or employer").fill("IIT Madras");
  await page.getByLabel("Degree").fill("B.Tech");
  await page.getByLabel("Where you are now").selectOption("3rd year");
  await next();
  await page.getByRole("heading", { name: /Connect the accounts/ }).waitFor({ timeout: 30_000 });
  await next();
  await page.getByRole("heading", { name: /Here's what we found/ }).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: /^Skills/ }).first().click().catch(() => page.getByRole("tab", { name: /Skills/ }).click());
  await page.getByLabel("Add a skill").fill("PyTorch");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: /^Experience/ }).first().click().catch(() => page.getByRole("tab", { name: /Experience/ }).click());
  await page.getByRole("button", { name: /I don't have work experience yet/ }).click();
  await next(/Looks right/);
  await page.getByRole("heading", { name: /Your skills, and what backs them/ }).waitFor({ timeout: 30_000 });
}

main().catch((e) => { console.error(e); process.exit(1); });
