import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

async function main() {
  const base = process.env.V4_BASE_URL || "http://127.0.0.1:3000";
  const output = path.join(process.cwd(), "docs/screenshots/adaptive-v4/after");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--no-sandbox"] });
  try {
    for (const role of ["student", "faculty"] as const) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(`${base}/onboarding`);
      await page.locator("#student-name-input").fill(`Mobile ${role}`);
      await page.getByRole("button", { name: "Submit name and continue" }).click();
      await page.addStyleTag({ content: '[data-eora-id="eora-floating-companion"]{display:none!important}' });
      await page.getByRole("button", { name: role === "faculty" ? /I'm Faculty/ : /I'm a Student/ }).click({ force: true });
      await page.screenshot({ path: path.join(output, `mobile-${role}-role-selection.png`), fullPage: true, animations: "disabled" });
      await page.getByRole("button", { name: "Next", exact: true }).last().click({ force: true });
      if (role === "student") await page.getByRole("button", { name: "Continue", exact: true }).last().click({ force: true });
      for (const choice of role === "faculty" ? [/Assessments & Evaluation/, /Teaching & Learning/, /Student Mentorship/] : [/Internships & Jobs/, /Learn AI & ML/, /People & Mentors/]) await page.getByRole("button", { name: choice }).click({ force: true });
      await page.screenshot({ path: path.join(output, `mobile-${role}-ranked-purposes.png`), fullPage: true, animations: "disabled" });
      console.log(`Captured real mobile ${role} role and purpose screens`);
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
