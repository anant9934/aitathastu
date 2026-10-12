import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

async function main() {
  const base = "http://127.0.0.1:3002";
  const output = path.join(process.cwd(), "docs/screenshots/adaptive-v4/before");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--no-sandbox"] });
  const shot = async (page: any, name: string) => { await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: !name.startsWith("mobile-"), animations: "disabled" }); console.log(`Captured baseline ${name}`); };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.goto(`${base}/screens?screen=3&gallery=true`);
    await page.addStyleTag({ content: '[data-eora-id="eora-floating-companion"]{display:none!important}' });
    await shot(page, "role-selection-before");
    await page.setViewportSize({ width: 390, height: 844 }); await shot(page, "mobile-role-selection-before"); await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: /I'm Faculty/ }).click({ force: true });
    await shot(page, "faculty-coming-soon-before");
    await page.getByRole("button", { name: /I'm a Student/ }).click({ force: true });
    await page.getByRole("button", { name: "Next", exact: true }).last().click({ force: true });
    await page.getByRole("button", { name: "Continue", exact: true }).last().click({ force: true });
    await page.getByRole("button", { name: /Internships & Jobs/ }).click({ force: true });
    await page.getByRole("button", { name: /Learn AI & ML/ }).click({ force: true });
    await page.getByRole("button", { name: /People & Mentors/ }).click({ force: true });
    await shot(page, "student-purposes-before");
    await page.setViewportSize({ width: 390, height: 844 }); await shot(page, "mobile-student-purposes-before"); await page.setViewportSize({ width: 1440, height: 1000 });
    const signup = await context.request.post(`${base}/api/auth/sign-up`, { data: { email: `v4-before-${randomUUID()}@example.test`, password: "SafePreviewPass123!", displayName: "Baseline Student" } });
    if (!signup.ok()) throw new Error(`Baseline signup ${signup.status()} ${await signup.text()}`);
    const dashboard = await context.newPage(); await dashboard.goto(`${base}/student`); await dashboard.getByText(/Loading your personal workspace/).waitFor({ state: "hidden" });
    await dashboard.addStyleTag({ content: '[data-eora-id="eora-floating-companion"]{display:none!important}' });
    await shot(dashboard, "student-dashboard-before");
    await dashboard.setViewportSize({ width: 390, height: 844 }); await shot(dashboard, "mobile-student-dashboard-before");
    await context.close();
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
