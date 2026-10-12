import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = process.env.V53_BASE_URL || "http://127.0.0.1:3101";
const output = join(process.cwd(), "docs/screenshots/v53/authenticated-after");
mkdirSync(output, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const results: { role: string; route: string; width: number; status: number | null; overflow: number; heading: string; errors: string[] }[] = [];
  try {
    for (const role of ["student", "faculty"] as const) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      const account = await context.request.post(`${base}/api/auth/sign-up`, { data: { email: `v53-${role}-${randomUUID()}@example.test`, password: "SafePreviewPass123!", displayName: `V53 ${role}` } });
      if (!account.ok()) throw new Error(`Could not create isolated ${role} account: ${account.status()} ${await account.text()}`);
      const onboard = await context.request.post(`${base}/api/onboarding-v2`, { data: role === "student"
        ? { role, name: "V53 Student", targetRole: "Machine Learning Engineer", goal: "Get an ML internship", institution: "Preview University", degree: "B.Tech", specialization: "Computer Science", year: "3rd Year", priorities: ["jobs", "learning", "projects"], primaryPriority: "jobs" }
        : { role, name: "V53 Faculty", institution: "Preview University", specialization: "Computer Science", priorities: ["assessments", "teaching", "research"], primaryPriority: "assessments" } });
      if (!onboard.ok()) throw new Error(`Could not complete isolated ${role} onboarding: ${onboard.status()} ${await onboard.text()}`);
      const routes = role === "student" ? ["/student", "/student/journey", "/student/roadmap", "/student/skills", "/student/projects", "/student/profile", "/student/connections", "/student/assessments", "/student/interviews", "/verification"] : ["/faculty", "/faculty/verification"];
      for (const route of routes) {
        for (const width of [320, 390, 768, 1024, 1440]) {
          const page = await context.newPage();
          await page.setViewportSize({ width, height: 900 });
          const errors: string[] = [];
          page.on("pageerror", error => errors.push(error.stack || error.message));
          const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(route === "/student" || route === "/faculty" ? 900 : 500);
          await page.addStyleTag({ content: "nextjs-portal { display:none !important; }" });
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          const heading = (await page.locator("h1").first().textContent({ timeout: 1000 }).catch(() => ""))?.trim() || "";
          await page.screenshot({ path: join(output, `${role}-${route.replaceAll("/", "-").replace(/^-/, "")}-${width}.png`), fullPage: false, animations: "disabled" });
          results.push({ role, route, width, status: response?.status() ?? null, overflow, heading, errors });
          await page.close();
        }
      }
      await context.close();
    }
    writeFileSync(join(output, "results.json"), JSON.stringify(results, null, 2));
    const failures = results.filter(row => row.status !== 200 || row.overflow > 1 || row.errors.length);
    console.log(JSON.stringify({ captured: results.length, failures }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
