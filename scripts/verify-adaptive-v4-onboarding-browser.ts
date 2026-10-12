import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

async function main() {
  const base = process.env.V4_BASE_URL || "http://127.0.0.1:3000";
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${base}/onboarding`);
    await page.addStyleTag({ content: '[data-eora-id="eora-floating-companion"]{display:none!important}' });
    await page.locator("#student-name-input").fill("Faculty Browser Test");
    await page.getByRole("button", { name: "Submit name and continue" }).click();
    await page.getByRole("button", { name: /I'm Faculty/ }).click();
    await page.getByRole("button", { name: "Next", exact: true }).last().click();
    await page.getByRole("button", { name: /Assessments & Evaluation/ }).click();
    await page.getByRole("button", { name: /Research & Publications/ }).click();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.getByRole("heading", { name: "Tell us about your academic role" }).waitFor();
    await page.getByLabel("Institution", { exact: true }).fill("Preview University");
    await page.getByLabel("Department or discipline").fill("Computer Science");
    await page.getByLabel("Work email").fill(`v4-faculty-flow-${randomUUID()}@example.test`);
    await page.getByLabel("Create password").fill("SafePreviewPass123!");
    await page.getByRole("button", { name: "Create faculty workspace" }).click();
    await page.waitForURL("**/faculty");
    await page.getByText("FACULTY WORKSPACE", { exact: true }).waitFor();
    await page.getByText("Institution approval pending", { exact: true }).waitFor();
    const queue = await context.request.get(`${base}/api/verification/requests`);
    assert.equal(queue.status(), 403);
    console.log("Faculty click-through onboarding, pending workspace, and denied verification passed.");
    await context.close();
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
