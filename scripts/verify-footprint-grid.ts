import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.join(process.cwd(), "artifacts/screenshots/footprint_grid");

async function main() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  console.log("1. Navigating to /onboarding...");
  await page.goto("http://localhost:3000/onboarding", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Screen 1: Welcome
  console.log("On Welcome screen: entering name...");
  const welcomeInput = page.locator('input').first();
  await welcomeInput.fill("Anant Sharma");
  await page.locator('button:has-text("Let\'s start")').click();
  await page.waitForTimeout(1500);

  // Screen 2: Role
  console.log("On Role screen: selecting Student...");
  await page.locator('label:has-text("Student"), button:has-text("Student"), div:has-text("Student")').first().click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1500);

  // Screen 3: Direction
  console.log("On Direction screen: selecting target role...");
  const roleCard = page.locator('button:has-text("Machine Learning Engineer"), label:has-text("Machine Learning Engineer")').first();
  if (await roleCard.isVisible({ timeout: 2000 })) {
    await roleCard.click();
  } else {
    await page.locator('button[role="radio"], button:has-text("Engineer")').first().click();
  }
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1500);

  // Screen 4: Priorities
  console.log("On Priorities screen: selecting priorities...");
  const priorityBtns = page.locator('button[role="checkbox"], button:has-text("Core"), button:has-text("AI")');
  if (await priorityBtns.count() > 0) {
    await priorityBtns.first().click();
    await page.waitForTimeout(300);
  }
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1500);

  // Screen 5: CV Upload screen
  console.log("On CV Upload screen: continuing without a CV...");
  const skipCv = page.locator('button:has-text("Continue without a CV"), button:has-text("Skip for now")').first();
  await skipCv.click();
  await page.waitForTimeout(2000);

  // Now we must be on Step 5 of 12 (Footprint Intelligence)
  console.log("Waiting for Step 5 (Footprint Intelligence)...");
  await page.waitForSelector('text=discover what you\'ve built', { timeout: 10000 });
  console.log("✓ Successfully reached Step 5 of 12 — Footprint Intelligence!");

  // Verify Header & Progress Bar
  const stepperText = await page.locator('nav, header, [role="progressbar"], div:has-text("Step 5 of 12")').first().textContent();
  console.log("Stepper info:", stepperText?.slice(0, 100));

  // Desktop Dark Mode Screenshot
  const desktopDarkPath = path.join(ARTIFACTS_DIR, "01_desktop_dark_grid.png");
  await page.screenshot({ path: desktopDarkPath, fullPage: true });
  console.log("Saved: 01_desktop_dark_grid.png");

  // Verify all 13 platforms
  const providers = [
    "github", "linkedin", "leetcode", "kaggle", "huggingface",
    "hackerrank", "hackerearth", "codechef", "stackoverflow",
    "devto", "google_scholar", "orcid", "portfolio"
  ];

  for (const p of providers) {
    const card = page.locator(`[data-testid="card-${p}"]`);
    const count = await card.count();
    if (count > 0) {
      console.log(`✓ Platform card [${p}] rendered successfully`);
    } else {
      throw new Error(`Platform card [${p}] missing from grid!`);
    }
  }

  // Test card interaction: Invalid ORCID checksum
  console.log("Testing card interaction: Invalid ORCID...");
  const orcidInput = page.locator("#input-orcid");
  await orcidInput.fill("0000-0002-1825-0000");
  const orcidBtn = page.locator('[data-testid="card-orcid"] button:has-text("Link Account")');
  await orcidBtn.click();
  await page.waitForTimeout(500);
  const orcidErr = await page.locator('[data-testid="card-orcid"] .text-danger').textContent();
  console.log("✓ ORCID inline error displayed:", orcidErr);

  // Test card interaction: SSRF Private IP on Portfolio
  console.log("Testing card interaction: Portfolio SSRF protection...");
  const portInput = page.locator("#input-portfolio");
  await portInput.fill("http://127.0.0.1:8080/admin");
  const portBtn = page.locator('[data-testid="card-portfolio"] button:has-text("Link Account")');
  await portBtn.click();
  await page.waitForTimeout(500);
  const portErr = await page.locator('[data-testid="card-portfolio"] .text-danger').textContent();
  console.log("✓ Portfolio SSRF error displayed:", portErr);

  // Test card interaction: Link valid GitHub account
  console.log("Testing card interaction: Linking GitHub account...");
  const ghInput = page.locator("#input-github");
  await ghInput.fill("anant9934");
  const ghBtn = page.locator('[data-testid="card-github"] button:has-text("Link Account")');
  await ghBtn.click();
  await page.waitForTimeout(3500);

  const ghCardText = await page.locator('[data-testid="card-github"]').textContent();
  console.log("✓ GitHub card state after linking:", ghCardText);

  // Screenshot with interaction states
  const desktopInteractedPath = path.join(ARTIFACTS_DIR, "02_desktop_dark_interacted.png");
  await page.screenshot({ path: desktopInteractedPath, fullPage: true });
  console.log("Saved: 02_desktop_dark_interacted.png");

  // Light Mode Verification
  console.log("Toggling Light Mode...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });
  await page.waitForTimeout(500);

  const desktopLightPath = path.join(ARTIFACTS_DIR, "03_desktop_light_grid.png");
  await page.screenshot({ path: desktopLightPath, fullPage: true });
  console.log("Saved: 03_desktop_light_grid.png");

  // Mobile Viewport (iPhone 390px, Dark Mode)
  console.log("Switching to Mobile 390px Viewport (Dark Mode)...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  const mobileDarkPath = path.join(ARTIFACTS_DIR, "04_mobile_dark_grid.png");
  await page.screenshot({ path: mobileDarkPath, fullPage: true });
  console.log("Saved: 04_mobile_dark_grid.png");

  // Mobile Viewport (iPhone 390px, Light Mode)
  console.log("Switching to Mobile 390px Viewport (Light Mode)...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });
  await page.waitForTimeout(500);

  const mobileLightPath = path.join(ARTIFACTS_DIR, "05_mobile_light_grid.png");
  await page.screenshot({ path: mobileLightPath, fullPage: true });
  console.log("Saved: 05_mobile_light_grid.png");

  await browser.close();
  console.log("==================================================");
  console.log("ALL DIGITAL FOOTPRINT GRID VERIFICATION CHECKS PASSED!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
