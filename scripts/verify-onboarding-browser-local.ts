import assert from "node:assert/strict";
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
    await page.goto(`${base}/onboarding`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    assert.equal(await page.locator("input").first().inputValue(), "", "Fresh guest name should be blank");

    const screenIndexes = [3, 3.2, 3.5, 5, 4, 6, 7, 8, 9, 10, 11];
    for (const index of screenIndexes) {
      await page.goto(`${base}/screens?screen=${index}&gallery=false`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(250);
      assert.ok((await page.locator("body").innerText()).trim().length > 100, `Screen ${index} did not render`);
      assert.equal(errors.length, 0, `Screen ${index} raised an uncaught error: ${errors.join("; ")}`);
    }

    await page.goto(`${base}/screens?screen=4&gallery=false`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const values = await page.locator("input").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    assert.equal(values.some((value) => /Rahul Sharma|Lovely Professional University|Unknown University/.test(value)), false);
    assert.equal(values.some((value) => value.includes("@onboarding.aitathastu.internal")), false);

    await page.goto(`${base}/screens?screen=6&gallery=false`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    assert.match(await page.locator("body").innerText(), /Linked Profiles \(0\)/);
    assert.equal(errors.length, 0, `Uncaught browser errors: ${errors.join("; ")}`);

    const draftSave = await page.request.put(`${base}/api/onboarding-v2`, {
      data: { version: 2, role: "student", discoveredResumeProfiles: {
        github: "https://github.com/alexexample",
        linkedin: "https://linkedin.com/in/alexexample",
      } },
    });
    assert.equal(draftSave.status(), 200);
    await page.goto(`${base}/screens?screen=6&gallery=false`, { waitUntil: "domcontentloaded" });
    await page.getByText("Found in your resume").first().waitFor({ timeout: 10_000 });
    assert.equal(await page.getByText("Found in your resume").count(), 2);
    assert.match(await page.locator("body").innerText(), /Linked Profiles \(0\)/);
    await page.getByRole("button", { name: "Review Profile" }).first().click();
    assert.equal(await page.locator('input[type="text"]').last().inputValue(), "https://github.com/alexexample");
    const candidateSave = await page.request.put(`${base}/api/onboarding-v2`, {
      data: { version: 2, role: "student", techCandidates: [{ name: "Go", source: "github", provenance: "SOURCE_EXTRACTED" }] },
    });
    assert.equal(candidateSave.status(), 200);
    assert.equal((await candidateSave.json()).draft.techCandidates[0].name, "Go");
    await page.goto(`${base}/screens?screen=8&gallery=false`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Skills", exact: true }).click();
    await page.getByText("Suggested from github").waitFor();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.waitForTimeout(300);
    const afterConfirmation = await (await page.request.get(`${base}/api/onboarding-v2`)).json();
    assert.ok(afterConfirmation.draft.skills.includes("Go"), "Confirmed imported skill should persist");
    assert.equal(errors.length, 0, `Uncaught browser errors: ${errors.join("; ")}`);
    console.log("Local browser checks passed: fresh fields blank, onboarding screens render, CV links require review, imported skill requires confirmation.");

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
    try {
      const mobile = await mobileContext.newPage();
      const mobileErrors: string[] = [];
      mobile.on("pageerror", (error) => mobileErrors.push(error.message));
      for (const index of [5, 6, 8, 9, 10]) {
        await mobile.goto(`${base}/screens?screen=${index}&gallery=false`, { waitUntil: "domcontentloaded" });
        await mobile.waitForTimeout(250);
        assert.ok((await mobile.locator("body").innerText()).trim().length > 100, `Mobile screen ${index} did not render`);
      }
      assert.equal(mobileErrors.length, 0, `Mobile uncaught errors: ${mobileErrors.join("; ")}`);
      console.log("Mobile 390px onboarding screens 5, 6, 8, 9, and 10 rendered without uncaught errors.");
    } finally {
      await mobileContext.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
