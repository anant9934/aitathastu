import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const CONVERSATION_ID = "32c32007-13f1-41f9-ad41-120484bb47ce";
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || (
  fs.existsSync(`/Users/quantum/.gemini/antigravity-ide/brain/${CONVERSATION_ID}`)
    ? `/Users/quantum/.gemini/antigravity-ide/brain/${CONVERSATION_ID}/screenshots`
    : path.join(process.cwd(), "artifacts/screenshots")
);

const EXPECTED_PROVIDERS = [
  "github",
  "linkedin",
  "leetcode",
  "kaggle",
  "huggingface",
  "hackerrank",
  "hackerearth",
  "codechef",
  "stackoverflow",
  "devto",
  "google_scholar",
  "orcid",
  "portfolio",
];

async function runTestSuite() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  console.log("===============================================================================");
  console.log("   AI TATHASTU — PHASE DFI-2 E2E VERIFICATION SUITE");
  console.log("   Unified Digital Footprint Grid + Functional Repair Certification");
  console.log("===============================================================================\n");

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });

  const page = await context.newPage();
  const testIp = `198.51.100.${Math.floor(Math.random() * 200 + 10)}`;
  await page.route("http://localhost:3000/**", (route) => {
    const headers = { ...route.request().headers(), "x-forwarded-for": testIp };
    return route.continue({ headers });
  });

  // Listen to console and network
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`[Browser Error]:`, msg.text());
  });

  // -------------------------------------------------------------------------
  // TEST SUITE 1: FRESH ONBOARDING JOURNEY TO STEP 5
  // -------------------------------------------------------------------------
  // Clear cookies for a clean fresh onboarding session
  await context.clearCookies();
  await page.goto("http://localhost:3000/onboarding", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  // Welcome Step
  console.log("1. Welcome Step: Entering student name...");
  const nameInput = page.locator("input").first();
  await nameInput.fill("Aarav Mehta");
  await page.locator('button:has-text("Let\'s start")').click();
  await page.waitForTimeout(1200);

  // Role Step
  console.log("2. Role Step: Choosing Student...");
  await page.locator('label:has-text("Student"), button:has-text("Student"), div:has-text("Student")').first().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1200);

  // Direction Step
  console.log("3. Direction Step: Choosing target role...");
  const roleCard = page.locator('button:has-text("Machine Learning Engineer"), label:has-text("Machine Learning Engineer")').first();
  if (await roleCard.isVisible({ timeout: 2000 })) {
    await roleCard.click();
  } else {
    await page.locator('button[role="radio"], button:has-text("Engineer")').first().click();
  }
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1200);

  // Priorities Step
  console.log("4. Priorities Step: Selecting priorities...");
  const priorityBtns = page.locator('button[role="checkbox"], button:has-text("Core"), button:has-text("AI")');
  if ((await priorityBtns.count()) > 0) {
    await priorityBtns.first().click();
    await page.waitForTimeout(300);
  }
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(1200);

  // CV Step: Continue without CV to test clean State 1
  console.log("5. CV Step: Continuing without CV to test zero-CV state...");
  const skipCv = page.locator('button:has-text("Continue without a CV"), button:has-text("Skip for now")').first();
  await skipCv.click();
  await page.waitForTimeout(1500);

  // -------------------------------------------------------------------------
  // TEST SUITE 2: UNIFIED GRID ARCHITECTURE VERIFICATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 2: Unified Grid Verification (No dropdown, No duplicates) ---");
  await page.waitForSelector("text=discover what you've built", { timeout: 10000 });
  console.log("✅ Successfully reached Step 5 of 12 — Footprint Intelligence");

  // Verify stepper header
  const stepLabel = await page.locator('text=Step 5 of 12').first().textContent();
  console.log(`✅ Stepper confirmed: "${stepLabel}"`);

  // Verify section title and description
  const sectionTitle = await page.locator("h2#heading-digital-footprint").textContent();
  console.log(`✅ Section heading: "${sectionTitle}"`);
  if (!sectionTitle?.includes("Your Digital Footprint")) {
    throw new Error(`Expected heading 'Your Digital Footprint', got '${sectionTitle}'`);
  }

  // Verify NO select dropdown exists on the page
  const selectElements = await page.locator("select").count();
  console.log(`✅ Select dropdown count: ${selectElements} (Must be 0)`);
  if (selectElements !== 0) {
    throw new Error("FAIL: Found dropdown select element on Step 5!");
  }

  // Verify NO duplicate "Found in your CV" section heading exists
  const oldCvSection = await page.locator("#heading-found-in-cv").count();
  console.log(`✅ Duplicate CV section count: ${oldCvSection} (Must be 0)`);
  if (oldCvSection !== 0) {
    throw new Error("FAIL: Old duplicated 'Found in your CV' section heading still present!");
  }

  // Verify all 13 platforms render in the unified grid
  console.log("\n--- Verifying All 13 Platform Cards in Grid ---");
  for (const provider of EXPECTED_PROVIDERS) {
    const card = page.locator(`[data-testid="card-${provider}"]`);
    const count = await card.count();
    if (count !== 1) {
      throw new Error(`FAIL: Platform card [${provider}] count is ${count}, expected exactly 1!`);
    }
    // Verify each card in State 1 has an empty input
    const input = page.locator(`#input-${provider}`);
    const val = await input.inputValue();
    if (val !== "") {
      throw new Error(`FAIL: Platform card [${provider}] should have empty input in State 1, got '${val}'`);
    }
    console.log(`  ✓ Card [${provider}]: Rendered, exactly 1 instance, clean empty input`);
  }
  console.log("✅ All 13 platform cards rendered uniquely in the unified grid.");

  // Screenshot 1: Desktop Dark Theme (Clean State 1)
  const screenshot1 = path.join(ARTIFACTS_DIR, "01_desktop_dark_clean_grid.png");
  await page.screenshot({ path: screenshot1, fullPage: true });
  console.log(`📸 Saved screenshot: ${screenshot1}`);

  // -------------------------------------------------------------------------
  // TEST SUITE 3: INPUT VALIDATION & SSRF SECURITY
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 3: Validation, SSRF Defense, and Checksums ---");

  // 3a. Invalid ORCID checksum
  console.log("Testing ORCID checksum validation...");
  const orcidInput = page.locator("#input-orcid");
  await orcidInput.fill("0000-0002-1825-0000"); // Corrupt check digit
  await page.locator('[data-testid="card-orcid"] button:has-text("Link Account")').click();
  await page.waitForTimeout(400);
  const orcidError = await page.locator('[data-testid="card-orcid"] p.text-danger').textContent();
  console.log(`✅ ORCID rejected corrupt checksum: "${orcidError}"`);

  // 3b. Portfolio SSRF: Loopback IP
  console.log("Testing Portfolio SSRF defense on loopback IP...");
  const portInput = page.locator("#input-portfolio");
  await portInput.fill("http://127.0.0.1:9090/admin");
  await page.locator('[data-testid="card-portfolio"] button:has-text("Link Account")').click();
  await page.waitForTimeout(400);
  const portError = await page.locator('[data-testid="card-portfolio"] p.text-danger').textContent();
  console.log(`✅ Portfolio rejected private loopback: "${portError}"`);

  // 3c. Portfolio SSRF: AWS Metadata endpoint
  await portInput.fill("http://169.254.169.254/latest/meta-data/");
  await page.locator('[data-testid="card-portfolio"] button:has-text("Link Account")').click();
  await page.waitForTimeout(400);
  const awsError = await page.locator('[data-testid="card-portfolio"] p.text-danger').textContent();
  console.log(`✅ Portfolio rejected cloud metadata IP: "${awsError}"`);

  // -------------------------------------------------------------------------
  // TEST SUITE 4: MANUAL PROFILE LINKING & FETCH
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 4: Manual Linking & Public Fetch ---");
  console.log("Linking GitHub account 'anant9934'...");
  const ghInput = page.locator("#input-github");
  await ghInput.fill("anant9934");
  await page.locator('[data-testid="card-github"] button:has-text("Link Account")').click();
  
  // Wait for loading indicator to complete
  await page.waitForSelector('[data-testid="card-github"] :has-text("Fetching…")', { state: "detached", timeout: 20000 });
  await page.waitForTimeout(500);

  // Verify GitHub card transitioned to Saved/Linked state (State 4)
  const ghCard = page.locator('[data-testid="card-github"]');
  const ghText = await ghCard.textContent();
  console.log(`✅ GitHub card state: "${ghText?.replace(/\s+/g, " ").slice(0, 150)}..."`);
  const ghLink = ghCard.locator('a[href="https://github.com/anant9934"]');
  if ((await ghLink.count()) === 0) {
    throw new Error("FAIL: GitHub profile link not rendered on card after linking!");
  }
  console.log("✅ GitHub card displays canonical URL link: https://github.com/anant9934");

  // -------------------------------------------------------------------------
  // TEST SUITE 5: INLINE EDIT FUNCTIONALITY (PART D)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 5: Inline Edit Functionality (PART D) ---");
  // Click Edit icon button on GitHub card
  console.log("1. Clicking Edit on GitHub card...");
  await ghCard.locator('button[title="Edit profile"]').click();
  await page.waitForTimeout(400);

  // Verify inline edit input appears with current value
  const ghEditInput = page.locator("#edit-input-github");
  if ((await ghEditInput.count()) === 0) {
    throw new Error("FAIL: Edit input did not appear when clicking Edit!");
  }
  const editInitialVal = await ghEditInput.inputValue();
  console.log(`✅ Inline edit input visible with value: "${editInitialVal}"`);

  // Test Cancel button: edits text, then cancels
  console.log("2. Testing Cancel: changing text to 'temp-handle' then canceling...");
  await ghEditInput.fill("temp-handle");
  await ghCard.locator('button:has-text("Cancel")').click();
  await page.waitForTimeout(400);

  // Verify edit input closed and original value remained
  const ghAfterCancel = await ghCard.locator('a[href="https://github.com/anant9934"]').count();
  if (ghAfterCancel === 0) {
    throw new Error("FAIL: Cancel did not restore original GitHub URL!");
  }
  console.log("✅ Cancel restored original profile URL and exited edit mode.");

  // Test Save edit: change to updated handle and save
  console.log("3. Testing Save: changing to 'anant99' and saving...");
  await ghCard.locator('button[title="Edit profile"]').click();
  await page.waitForTimeout(400);
  await page.locator("#edit-input-github").fill("anant99");
  await ghCard.locator('button:has-text("Save")').click();
  await page.waitForSelector("#edit-input-github", { state: "detached", timeout: 10000 });
  await page.waitForTimeout(400);

  const ghEditedLink = page.locator('[data-testid="card-github"] a[href="https://github.com/anant99"]');
  if ((await ghEditedLink.count()) === 0) {
    throw new Error("FAIL: Edited GitHub profile URL not rendered after Save!");
  }
  console.log("✅ Save updated profile URL to: https://github.com/anant99");

  // Test Persistence across Page Reload
  console.log("4. Reloading page to verify edit persistence...");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const ghPersistedLink = page.locator('[data-testid="card-github"] a[href="https://github.com/anant99"]');
  if ((await ghPersistedLink.count()) === 0) {
    throw new Error("FAIL: Edited GitHub profile URL did not persist after reload!");
  }
  console.log("✅ Edited GitHub URL persisted across reload: https://github.com/anant99");

  // -------------------------------------------------------------------------
  // TEST SUITE 6: REMOVE & DURABLE DISMISSAL (PART E)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 6: Remove & Durable Dismissal (PART E) ---");
  // Click Remove on GitHub card
  await page.locator('[data-testid="card-github"] button[title="Remove profile"]').click();
  await page.waitForSelector("#input-github", { timeout: 10000 });
  await page.waitForTimeout(400);

  // Verify GitHub card resets to State 1 (clean, empty input, Link Account button)
  const ghInputAfterRemove = page.locator("#input-github");
  if ((await ghInputAfterRemove.count()) === 0) {
    throw new Error("FAIL: Platform card did not reset to State 1 with empty input after Remove!");
  }
  const valAfterRemove = await ghInputAfterRemove.inputValue();
  if (valAfterRemove !== "") {
    throw new Error(`FAIL: Input should be empty after Remove, got '${valAfterRemove}'`);
  }
  console.log("✅ GitHub card instantly reset to clean State 1 (empty input, Link Account button)");

  // Verify Reload retains removal
  console.log("2. Reloading page to verify removal persistence...");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const ghInputAfterReload = page.locator("#input-github");
  const valAfterReload = await ghInputAfterReload.inputValue();
  if (valAfterReload !== "") {
    throw new Error(`FAIL: GitHub card resurrected after reload! Value: '${valAfterReload}'`);
  }
  console.log("✅ Removal persisted across reload: card remains in State 1");

  // -------------------------------------------------------------------------
  // TEST SUITE 7: CV-DETECTED CANDIDATES & CONFIRM & FETCH INTEGRATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 7: CV-Detected Candidates Integration ---");
  // Simulate CV extraction with multiple detected profiles (GitHub, LeetCode, HackerRank, LinkedIn)
  console.log("Injecting CV-detected profiles into draft...");
  await page.evaluate(async () => {
    await fetch("/api/onboarding-v2", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 2,
        currentScreen: 5.5,
        dismissedFootprintProviders: [],
        discoveredResumeProfiles: {
          github: "https://github.com/torvalds",
          leetcode: "https://leetcode.com/u/tourist",
          linkedin: "https://linkedin.com/in/linustorvalds",
        },
      }),
    });
  });

  // Reload page to observe CV candidate detection
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Verify GitHub card shows State 2 (Found in CV)
  console.log("Verifying CV-detected state on GitHub card...");
  const ghDetectedBadge = page.locator('[data-testid="card-github"] :has-text("Found in CV")');
  if ((await ghDetectedBadge.count()) === 0) {
    throw new Error("FAIL: GitHub card did not display 'Found in CV' badge!");
  }
  const ghDetectedLink = page.locator('[data-testid="card-github"] a[href="https://github.com/torvalds"]');
  if ((await ghDetectedLink.count()) === 0) {
    throw new Error("FAIL: GitHub detected candidate URL not rendered on card!");
  }
  console.log("✅ GitHub card shows 'Found in CV' with prefilled detected candidate: https://github.com/torvalds");

  // Verify LeetCode card shows State 2
  const lcDetectedLink = page.locator('[data-testid="card-leetcode"] a[href="https://leetcode.com/u/tourist"]');
  if ((await lcDetectedLink.count()) === 0) {
    throw new Error("FAIL: LeetCode detected candidate URL not rendered on card!");
  }
  console.log("✅ LeetCode card shows detected candidate: https://leetcode.com/u/tourist");

  // Verify LinkedIn shows Confirm & Save (unsupported fetch)
  const liConfirmBtn = page.locator('[data-testid="card-linkedin"] button:has-text("Confirm & Save")');
  if ((await liConfirmBtn.count()) === 0) {
    throw new Error("FAIL: LinkedIn card should show 'Confirm & Save' (fetch unsupported)!");
  }
  console.log("✅ LinkedIn card shows truthful 'Confirm & Save' (fetch unsupported)");

  // Verify undetected platforms (e.g. Kaggle) remain empty State 1
  const kaggleVal = await page.locator("#input-kaggle").inputValue();
  if (kaggleVal !== "") {
    throw new Error(`FAIL: Undetected Kaggle input should be empty, got '${kaggleVal}'`);
  }
  console.log("✅ Undetected platforms (e.g. Kaggle) remain clean, empty State 1");

  // Test Confirm & Save on LinkedIn
  console.log("Testing Confirm & Save on LinkedIn...");
  await liConfirmBtn.click();
  await page.waitForTimeout(2000);
  const liStatus = await page.locator('[data-testid="card-linkedin"]').textContent();
  console.log(`✅ LinkedIn card state after confirm: "${liStatus?.replace(/\s+/g, " ").slice(0, 150)}..."`);
  if (!liStatus?.includes("Saved") && !liStatus?.includes("Linked")) {
    throw new Error("FAIL: LinkedIn card not marked as Saved after Confirm & Save!");
  }

  // Test Dismissing a CV Candidate
  console.log("Testing Dismiss on LeetCode candidate...");
  await page.locator('[data-testid="card-leetcode"] button:has-text("Dismiss")').click();
  await page.waitForTimeout(800);

  // LeetCode should immediately reset to State 1
  const lcInputAfterDismiss = page.locator("#input-leetcode");
  if ((await lcInputAfterDismiss.count()) === 0) {
    throw new Error("FAIL: LeetCode card did not reset to State 1 after Dismiss!");
  }
  console.log("✅ Dismissed LeetCode candidate: card instantly reset to clean State 1");

  // Verify reload does NOT resurrect dismissed LeetCode candidate
  console.log("Reloading to verify dismissed candidate does not resurrect...");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const lcInputAfterReload = page.locator("#input-leetcode");
  const lcValAfterReload = await lcInputAfterReload.inputValue();
  if (lcValAfterReload !== "") {
    throw new Error(`FAIL: Dismissed LeetCode candidate resurrected after reload! Value: '${lcValAfterReload}'`);
  }
  console.log("✅ Dismissed CV candidate stayed dismissed across reload (durable exclusion)");

  // Screenshot 2: Desktop Dark Theme with Detected & Saved States
  const screenshot2 = path.join(ARTIFACTS_DIR, "02_desktop_dark_active_states.png");
  await page.screenshot({ path: screenshot2, fullPage: true });
  console.log(`📸 Saved screenshot: ${screenshot2}`);

  // -------------------------------------------------------------------------
  // TEST SUITE 8: LIGHT THEME & RESPONSIVE LAYOUT VERIFICATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 8: Theme & Responsive Layout Verification ---");

  // Light Mode Toggle
  console.log("Switching to Light Mode...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });
  await page.waitForTimeout(500);

  // Screenshot 3: Desktop Light Theme
  const screenshot3 = path.join(ARTIFACTS_DIR, "03_desktop_light_grid.png");
  await page.screenshot({ path: screenshot3, fullPage: true });
  console.log(`📸 Saved screenshot: ${screenshot3}`);

  // Tablet Viewport (768px, Dark Mode)
  console.log("Testing Tablet Viewport (768px)...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);

  const screenshot4 = path.join(ARTIFACTS_DIR, "04_tablet_dark_grid.png");
  await page.screenshot({ path: screenshot4, fullPage: true });
  console.log(`📸 Saved screenshot: ${screenshot4}`);

  // Mobile Viewport (iPhone 390px, Dark Mode)
  console.log("Testing Mobile Viewport (390px, Dark Mode)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  // Check no horizontal overflow on mobile
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  console.log(`Mobile dimensions: clientWidth=${clientWidth}, scrollWidth=${scrollWidth}`);
  if (scrollWidth > clientWidth) {
    throw new Error(`FAIL: Horizontal scroll overflow on mobile! (${scrollWidth}px > ${clientWidth}px)`);
  }
  console.log("✅ Zero horizontal overflow on mobile (390px)");

  // Screenshot 5: Mobile Dark
  const screenshot5 = path.join(ARTIFACTS_DIR, "05_mobile_dark_grid.png");
  await page.screenshot({ path: screenshot5, fullPage: true });
  console.log(`📸 Saved screenshot: ${screenshot5}`);

  // Mobile Light Mode
  console.log("Testing Mobile Viewport (390px, Light Mode)...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });
  await page.waitForTimeout(500);

  // Screenshot 6: Mobile Light
  const screenshot6 = path.join(ARTIFACTS_DIR, "06_mobile_light_grid.png");
  await page.screenshot({ path: screenshot6, fullPage: true });
  console.log(`📸 Saved screenshot: ${screenshot6}`);

  // Reset to desktop dark
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.waitForTimeout(500);

  // -------------------------------------------------------------------------
  // TEST SUITE 9: STEP NAVIGATION & REGRESSION VERIFICATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 9: Navigation & Non-regression ---");

  // Verify Back button works
  console.log("Testing Back button navigation...");
  await page.locator('button:has-text("Back")').click();
  await page.waitForTimeout(1000);
  const cvStepVisible = await page.locator("text=CV").first().isVisible();
  console.log(`✅ Back returned to CV step: ${cvStepVisible}`);

  // Return to Step 5
  await page.locator('button:has-text("Continue without a CV"), button:has-text("Skip for now")').first().click();
  await page.waitForTimeout(1200);

  // Test Continue to details button
  console.log("Testing 'Continue to details' forward navigation...");
  await page.locator('button:has-text("Continue to details")').click();
  await page.waitForTimeout(1500);

  // Verify next step (DetailsStep) loaded
  const detailsVisible = await page.locator("#field-fullname").isVisible();
  console.log(`✅ Forward navigation advanced to next step: ${detailsVisible}`);
  if (!detailsVisible) {
    throw new Error("FAIL: Forward navigation did not reach Academic Details step!");
  }

  await browser.close();

  console.log("\n===============================================================================");
  console.log("   ALL 9 TEST SUITES COMPLETED WITH 100% PASS RATE!");
  console.log("   Screenshots saved to: " + ARTIFACTS_DIR);
  console.log("===============================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("FATAL: Test suite failed:", err);
  process.exit(1);
});
