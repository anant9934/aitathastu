/**
 * Phase 3 workspace pages in the browser: signs in a seeded student and visits
 * each route at 1280 and 375 px in dark and light. Per page: horizontal
 * overflow, page errors, console errors, loaded fonts, and the theme at the
 * moment <body> is created (a stored Light choice must already be applied:
 * no flash). Needs the test server (sh scripts/ops/start-test-server.sh 3100).
 *
 *   node --import tsx scripts/visual-phase3-workspace.ts <outDir> <seed:rich|empty> <route> [route…]
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { chromium } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const [out = "scratch/phase3/workspace", seed = "rich", ...routes] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

async function main() {
  const fixture = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", path.join(__dirname, "lib", "seed-phase3-student.ts"), seed], { encoding: "utf8" }).trim().split("\n").pop()!);
  const browser = await chromium.launch();
  const results: Record<string, unknown>[] = [];
  for (const theme of ["dark", "light"] as const) {
    for (const width of [1280, 375]) {
      const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 860 } });
      await context.addInitScript((t) => {
        try { localStorage.setItem("tathastu-theme", t); } catch { /* ignore */ }
        // Record the theme the moment <body> exists, before first paint.
        const w = window as unknown as { __themeAtBody?: string };
        const obs = new MutationObserver(() => {
          if (document.body && !w.__themeAtBody) { w.__themeAtBody = document.documentElement.dataset.theme ?? "unset"; obs.disconnect(); }
        });
        obs.observe(document, { childList: true, subtree: true });
      }, theme);
      const page = await context.newPage();
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      page.on("console", (m) => { if (m.type() === "error" && !/Download the React DevTools|favicon/.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
      const res = await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email: fixture.email, password: fixture.password }, headers: { Origin: BASE } });
      if (!res.ok()) throw new Error(`sign-in failed: ${res.status()}`);
      for (const route of routes) {
        pageErrors.length = 0; consoleErrors.length = 0;
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 180_000 });
        await page.waitForTimeout(600);
        const info = await page.evaluate(async () => {
          await document.fonts.ready;
          const w = window as unknown as { __themeAtBody?: string };
          return {
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            themeAtBody: w.__themeAtBody,
            themeNow: document.documentElement.dataset.theme,
            fonts: [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")))].join("|"),
            h1: document.querySelector("h1")?.textContent ?? null,
            busy: Boolean(document.querySelector('[aria-busy="true"]')),
          };
        });
        const name = `${theme}-${width}-${route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"}`;
        await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
        results.push({ name, ...info, pageErrors: [...pageErrors], consoleErrors: [...consoleErrors] });
      }
      await context.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ fixture, results }, null, 2));
  for (const r of results) console.log(JSON.stringify(r));
}

main().catch((e) => { console.error(e); process.exit(1); });
