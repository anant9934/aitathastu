import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

async function main() {
  const base = process.env.BASE_URL || "http://127.0.0.1:3101";
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${base}/screens?screen=5&gallery=false`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    await page.getByLabel(/I agree to have this resume parsed/).check();
    await page.locator('input[type="file"]').setInputFiles("/private/tmp/aitathastu-audit-fixtures/synthetic_native_cv.pdf");
    await page.getByText("Review suggested claims").waitFor({ timeout: 15_000 });
    const claims = page.locator('input[aria-label^="Select "]');
    assert.ok(await claims.count() > 0);
    assert.equal(await claims.evaluateAll((inputs) => inputs.filter((input) => (input as HTMLInputElement).checked).length), 0);
    await page.locator('input[aria-label^="Select skill "]').first().check();
    await page.getByRole("button", { name: "Save selected claims" }).click();
    await page.getByText("Review saved").waitFor();
    await page.locator("#eora-onboarding-next-btn").click();
    await page.locator("#field-institution").waitFor();
    assert.equal(await page.locator("#field-institution").inputValue(), "", "Unselected CV education must not fill the institution field");
    assert.equal(await page.locator("#field-degree").inputValue(), "", "Unselected CV education must not fill the degree field");
    await page.locator("#field-fullname").fill("Synthetic CV Student");
    await page.locator("#field-email").fill(`synthetic-cv-${randomUUID()}@example.test`);
    await page.locator("#field-password").fill("SyntheticPassword123!");
    await page.locator("#field-degree").fill("BSc Computer Science");
    await page.locator("#field-institution").fill("Example Institute");
    await page.locator("#eora-onboarding-next-btn").click();
    await page.getByText("Linked Profiles (0)").waitFor();
    assert.equal(await page.getByText("Found in your resume").count(), 2);
    assert.equal(errors.length, 0, `Uncaught browser errors: ${errors.join("; ")}`);
    console.log("CV UI path passed: consent, unchecked candidates, selected claim save, unselected academic exclusion, and two unlinked CV profile suggestions.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
