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
  const finalResponses: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().endsWith("/api/onboarding-v2") && response.request().method() === "POST") {
      finalResponses.push(`POST ${response.status()}`);
    }
  });
  page.on("dialog", async (dialog) => { errors.push(`Dialog: ${dialog.message()}`); await dialog.accept(); });
  const next = async () => page.locator("#eora-onboarding-next-btn").click();
  try {
    await page.goto(`${base}/onboarding`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await page.getByText("What best describes you?").waitFor();
    await next();
    await page.getByText("Step 2 · Your AI/ML Direction").waitFor();
    await next();
    await page.getByText("Step 3 · What Brings You to AI Tathastu?").waitFor();
    await next();
    await page.getByText("Step 4 of 10").first().waitFor();
    await page.getByRole("button", { name: /Skip for now/ }).first().click();
    await page.locator("#field-fullname").fill("Synthetic Student");
    await page.locator("#field-email").fill(`synthetic-${randomUUID()}@example.test`);
    await page.locator("#field-password").fill("SyntheticPassword123!");
    await page.locator("#field-degree").fill("BSc Computer Science");
    await page.locator("#field-institution").fill("Example Institute");
    await next();
    await page.getByText("Linked Profiles (0)").waitFor();
    await next();
    await page.getByRole("button", { name: "View Profile Insights" }).click();
    await page.getByText("Step 8 · Profile & Skills Review").waitFor();
    await next();
    await page.getByText("Your Skills & Evidence Network").waitFor();
    await next();
    await page.getByText("Your Project Evidence Ledger").waitFor();
    await next();
    await page.getByRole("button", { name: "Launch My Workspace" }).click();
    try {
      await page.waitForURL(`${base}/student`, { timeout: 15_000 });
    } catch (error) {
      throw new Error(`Launch did not reach student: url=${page.url()}, responses=${finalResponses.join(",")}, browser=${errors.join(";")}, body=${(await page.locator("body").innerText()).slice(0, 600)}`, { cause: error });
    }
    assert.equal(errors.length, 0, `Uncaught browser errors: ${errors.join("; ")}`);
    const person360 = await page.request.get(`${base}/api/student/person-360`);
    assert.equal(person360.status(), 200);
    const body = await person360.json();
    assert.match(JSON.stringify(body), /Example Institute/);
    console.log("Sequential local onboarding passed: manual path through ten numbered steps, completion redirect, and Person 360 institution.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
