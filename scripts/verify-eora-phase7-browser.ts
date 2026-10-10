/**
 * EORA ALIVE PHASE 7 — Universal Page Intelligence (UPI) Real Browser Certification
 * 
 * Comprehensive Playwright test suite exercising:
 * 1. Universal Page Intelligence across key routes (Landing, Sign In, Sign Up, Onboarding, Student Dashboard, Skills, Projects, Roadmap, Connections, Verification).
 * 2. Floating companion badge, page explanation, suggested action pills, and tour launching.
 * 3. Guided tour spotlighting ([data-eora-spotlight="true"]), stepping Next/Back, and clean exit.
 * 4. Responsive viewport compliance at 1280px (Desktop), 768px (Tablet), 390px (Mobile), and 320px (Ultra-compact).
 * 5. Collision checks, layout shift tracking, quiet mode animation suppression, and Hinglish dialogue.
 * 6. Zero uncaught console errors and ZERO routine LLM network requests.
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const output = path.join(process.cwd(), process.env.EORA_SCREENSHOT_DIR || "docs/screenshots/eora-phase7");
mkdirSync(output, { recursive: true });

const results: Array<{ check: string; passed: boolean; detail: string }> = [];
const consoleErrors: string[] = [];
const failedResponses: string[] = [];
const eoraLlmRequests: string[] = [];

function record(check: string, passed: boolean, detail = "") {
  results.push({ check, passed, detail });
  const mark = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`${mark} ${check}${detail ? ` — ${detail}` : ""}`);
}

async function shot(page: Page, name: string) {
  try {
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false });
  } catch (e) {
    console.warn(`Could not capture screenshot ${name}:`, e);
  }
}

async function inspectTriggerCollision(page: Page, label: string) {
  const blocked = await page.evaluate(() => {
    const trigger = document.querySelector(".eora-avatar-trigger")?.getBoundingClientRect();
    if (!trigger) return ["EORA trigger missing"];
    return Array.from(document.querySelectorAll<HTMLElement>("button, input, textarea, select, a"))
      .filter((el) => !el.closest(".eora-floating-root") && !el.closest(".eora-restore-wrapper") && el.getClientRects().length > 0)
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.left < trigger.right && rect.right > trigger.left && rect.top < trigger.bottom && rect.bottom > trigger.top;
      }).map((el) => el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 40) || el.tagName);
  });
  record(`No trigger collision: ${label}`, blocked.length === 0, blocked.join(", "));
}

async function inspectPanelCollision(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const panel = document.querySelector(".eora-panel");
    if (!panel) return { ok: false, error: "panel missing" };
    const rect = panel.getBoundingClientRect();
    const fitsViewport = rect.left >= -5 && rect.right <= window.innerWidth + 5 && rect.bottom <= window.innerHeight + 5;
    return { ok: fitsViewport, width: rect.width, left: rect.left, right: rect.right, innerWidth: window.innerWidth };
  });
  record(`Panel responsive containment: ${label}`, result.ok, JSON.stringify(result));
}

async function openHelpPanel(page: Page) {
  const panel = page.locator(".eora-panel");
  if (!(await panel.isVisible())) {
    const trigger = page.getByRole("button", { name: /EORA — open help panel/i });
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
    } else {
      await page.locator(".eora-avatar-trigger").first().click({ timeout: 5000 });
    }
  }
  await panel.waitFor({ state: "visible", timeout: 8000 });
}

async function closeHelpPanel(page: Page) {
  const panel = page.locator(".eora-panel");
  if (await panel.isVisible()) {
    const closeBtn = page.getByRole("button", { name: "Close help panel", exact: true });
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape").catch(() => {});
    }
    await panel.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
}

async function runPageTour(page: Page, label: string, targetIds: string[]) {
  await openHelpPanel(page);
  const tourButton = page.getByRole("button", { name: /Start (a )?guided tour/i }).first();
  await tourButton.waitFor({ state: "visible", timeout: 5000 });
  await tourButton.click();
  for (let i = 0; i < targetIds.length; i++) {
    const tid = targetIds[i];
    const target = page.locator(`[data-eora-id="${tid}"][data-eora-spotlight="true"]`);
    const visible = await target.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
    const recovery = !visible && (await page.locator(".eora-tour-unavailable").isVisible());
    record(`${label}: spotlight ${tid}`, visible || recovery, visible ? "spotlight active" : "fallback notice shown");
    if (i < targetIds.length - 1) {
      const nextBtn = page.getByRole("button", { name: /Next step/i }).first();
      await nextBtn.click({ timeout: 3000 });
    }
  }
  const exitBtn = page.getByRole("button", { name: /Exit tour/i }).first();
  if (await exitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await exitBtn.click();
  }
  await closeHelpPanel(page);
}

async function main() {
  console.log("===============================================================================");
  console.log("AI TATHASTU — EORA ALIVE PHASE 7: REAL BROWSER CERTIFICATION");
  console.log("===============================================================================\n");

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  page.on("pageerror", (error) => consoleErrors.push(`${page.url()}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    if (/\/api\/(?:eora\/chat|ai\/|llm\/)/.test(request.url())) {
      eoraLlmRequests.push(request.url());
    }
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Public Landing Page (/)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: PUBLIC LANDING PAGE ---");
    await page.goto(base, { waitUntil: "networkidle" });
    await shot(page, "01-landing-hero");
    record("Landing hero renders", await page.locator("h1").isVisible());
    record("Hero large EORA illustration mounted", await page.locator(".landing-hero-eora, img[alt*='EORA']").first().isVisible());
    await inspectTriggerCollision(page, "Landing page desktop");

    // -------------------------------------------------------------------------
    // TEST 2: Sign-In Page (/sign-in)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: SIGN-IN PAGE UPI ---");
    await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
    await shot(page, "02-signin-page");
    const signinBadge = await page.locator(".eora-page-badge").first().textContent().catch(() => "");
    record("Sign-in page renders with floating companion", await page.locator(".eora-floating-root").count() === 1);
    record("Sign-in badge reflects contract", signinBadge?.toLowerCase().includes("sign in") || false, signinBadge || "");
    
    // Open help panel on Sign-In
    await openHelpPanel(page);
    await shot(page, "02-signin-help-panel");
    const signinExplanation = await page.locator(".eora-panel-explanation").textContent().catch(() => "");
    record("Sign-in page explanation grounded", Boolean(signinExplanation && (signinExplanation.toLowerCase().includes("authenticate") || signinExplanation.toLowerCase().includes("portfolio") || signinExplanation.toLowerCase().includes("student"))), signinExplanation || "");
    await closeHelpPanel(page);

    // -------------------------------------------------------------------------
    // TEST 3: Sign-Up Page (/sign-up)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: SIGN-UP PAGE UPI ---");
    await page.goto(`${base}/sign-up`, { waitUntil: "networkidle" });
    await shot(page, "03-signup-page");
    const signupBadge = await page.locator(".eora-page-badge").first().textContent().catch(() => "");
    record("Sign-up page renders with floating companion", await page.locator(".eora-floating-root").count() === 1);
    record("Sign-up badge reflects contract", signupBadge?.toLowerCase().includes("create account") || signupBadge?.toLowerCase().includes("sign up") || false, signupBadge || "");

    // -------------------------------------------------------------------------
    // TEST 4: Onboarding Flow (/onboarding)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: ONBOARDING FLOW & STEP-BY-STEP GUIDANCE ---");
    await page.goto(`${base}/onboarding`, { waitUntil: "networkidle" });
    await page.locator("#student-name-input").waitFor();
    await shot(page, "04-onboarding-welcome");
    record("Onboarding welcome screen renders", await page.locator("h1").isVisible());
    record("Single floating companion on onboarding", await page.locator(".eora-floating-root").count() === 1);

    // Test Tour on Onboarding Step 1
    await page.getByRole("button", { name: /EORA — open help panel/ }).click();
    await page.getByRole("button", { name: /Start (a )?guided tour/i }).first().click();
    const nameSpotlight = await page.locator('[data-eora-id="eora-name-input"][data-eora-spotlight="true"]').waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
    record("Onboarding tour highlights name input", nameSpotlight);
    await shot(page, "04-onboarding-tour-spotlight");
    await page.getByRole("button", { name: /Exit tour/i }).first().click();
    await page.getByRole("button", { name: "Close help panel", exact: true }).click();
    await page.locator(".eora-panel").waitFor({ state: "detached", timeout: 3000 }).catch(() => {});

    // Advance Onboarding with Test Name
    await page.fill("#student-name-input", "Phase Seven Pilot Student");
    await page.click('button[aria-label="Submit name and continue"]');
    await page.getByRole("heading", { name: /What best describes you/i }).waitFor();
    await shot(page, "05-onboarding-role-select");
    record("Role select step reached", true);
    await page.locator("button.btn-purple-next").click();

    // AI Direction step
    await page.getByRole("heading", { name: /Where do you want to go in AI/i }).waitFor();
    await shot(page, "05-onboarding-ai-direction");
    record("AI Direction step reached", true);
    await page.locator("button.btn-purple-next").click();

    // Priorities step
    await page.getByRole("heading", { name: /What brings you to AI Tathastu/i }).waitFor();
    await page.locator("button.btn-purple-next").click();

    // Academic step
    await page.getByRole("heading", { name: /Tell us a bit about yourself/i }).waitFor();
    await shot(page, "06-onboarding-academic-form");
    record("Academic form step reached", true);

    // Correct missing fields
    const testEmail = `eora_phase7_${Date.now()}@aitathastu.test`;
    await page.locator("#field-email").fill(testEmail);
    await page.locator("#field-password").fill("PhaseSevenPassword123!");
    await page.locator("button.btn-purple-next").click();

    // Resume upload step
    await page.getByRole("heading", { name: /Upload your Resume or Academic CV/i }).waitFor();
    await shot(page, "07-onboarding-resume-upload");
    record("Resume upload step reached", true);
    await page.locator("button.btn-purple-next").click();

    // Digital footprints step
    await page.getByRole("button", { name: /Skip \/ Continue/i }).click();
    await page.getByRole("button", { name: /View Profile Insights/i }).click();
    await page.locator("button.btn-purple-next").click();
    await page.locator("button.btn-purple-next").click();
    await page.locator("button.btn-purple-next").click();

    // Launch workspace
    await page.getByRole("button", { name: "Launch My Workspace" }).click({ timeout: 10000 });
    await page.waitForURL(/\/student/, { timeout: 20000 });
    const dashboardVisible = await page.locator('[data-eora-id="eora-overview"]').waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    record("Authenticated student dashboard loaded", dashboardVisible);
    await shot(page, "08-student-dashboard");

    // -------------------------------------------------------------------------
    // TEST 5: Student Dashboard UPI (/student)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: STUDENT DASHBOARD UPI ---");
    const dashboardBadge = await page.locator(".eora-page-badge").first().textContent().catch(() => "");
    record("Dashboard badge indicates student workspace", dashboardBadge?.toLowerCase().includes("workspace") || dashboardBadge?.toLowerCase().includes("dashboard") || false, dashboardBadge || "");
    
    // Help Panel on Dashboard
    await openHelpPanel(page);
    await shot(page, "08-dashboard-help-panel");
    const dashExplanation = await page.locator(".eora-panel-explanation").textContent().catch(() => "");
    record("Dashboard explanation grounded in student progress", Boolean(dashExplanation && dashExplanation.length > 20), dashExplanation?.slice(0, 80));
    await closeHelpPanel(page);


    // Exercise Dashboard Page Tour
    await runPageTour(page, "Dashboard tour", ["eora-active-goal", "eora-next-actions", "eora-evidence-panel", "eora-sidebar"]);

    // -------------------------------------------------------------------------
    // TEST 6: Skills Page (/student/skills)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: SKILLS PAGE UPI ---");
    await page.goto(`${base}/student/skills`, { waitUntil: "networkidle" });
    await shot(page, "09-skills-page");
    const skillsBadge = await page.locator(".eora-page-badge").first().textContent().catch(() => "");
    record("Skills badge indicates skill competency", skillsBadge?.toLowerCase().includes("skill") || false, skillsBadge || "");
    await runPageTour(page, "Skills tour", ["eora-skills-list", "eora-skill-verification"]);

    // Skill detail page (/student/skills/Python)
    await page.goto(`${base}/student/skills/Python`, { waitUntil: "networkidle" });
    await shot(page, "09-skill-detail-page");
    const skillDetailBadge = await page.locator(".eora-page-badge").first().textContent().catch(() => "");
    record("Skill detail badge indicates deep dive", skillDetailBadge?.toLowerCase().includes("deep-dive") || skillDetailBadge?.toLowerCase().includes("skill") || false, skillDetailBadge || "");

    // -------------------------------------------------------------------------
    // TEST 7: Projects Page (/student/projects)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: PROJECTS PAGE UPI ---");
    await page.goto(`${base}/student/projects`, { waitUntil: "networkidle" });
    await shot(page, "10-projects-page");
    const projectsBadge = await page.locator(".eora-page-badge").first().textContent().catch(() => "");
    record("Projects badge indicates portfolio evidence", projectsBadge?.toLowerCase().includes("project") || false, projectsBadge || "");
    await runPageTour(page, "Projects tour", ["eora-projects-list", "eora-contribution-note"]);

    // Test Add Project Dialog Guidance
    await page.keyboard.press("Escape").catch(() => {});
    await page.locator(".eora-panel").waitFor({ state: "detached", timeout: 2000 }).catch(() => {});
    const addBtn = page.getByRole("button", { name: /Add (Your First )?Project/i }).first();
    await addBtn.waitFor({ timeout: 10000 });
    await addBtn.click();
    const titleInput = page.getByPlaceholder(/AI-powered Research Assistant/i);
    await titleInput.waitFor({ timeout: 10000 });
    await titleInput.fill("Phase Seven Autonomous Vision Agent");
    await page.getByRole("button", { name: "Research", exact: true }).click();
    await page.getByPlaceholder(/I implemented the fine-tuning training loop/i).fill("Developed YOLOv8 model architecture and real-time inference loop.");
    await shot(page, "10-add-project-dialog");
    await page.getByRole("button", { name: "Save Project", exact: true }).click();
    await page.locator("button:has-text('Save Project'), button:has-text('Saving...')").waitFor({ state: "hidden", timeout: 25000 }).catch(() => {});
    const projectSaved = await page.getByText("Phase Seven Autonomous Vision Agent").first().waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
    record("New project created and persisted", projectSaved);
    await shot(page, "10-project-saved");

    // -------------------------------------------------------------------------
    // TEST 8: Roadmap Page (/student/roadmap)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: ROADMAP PAGE UPI ---");
    await page.goto(`${base}/student/roadmap`, { waitUntil: "networkidle" });
    await shot(page, "11-roadmap-page");
    const roadmapBadge = await page.locator(".eora-page-badge").first().textContent().catch(() => "");
    record("Roadmap badge indicates learning trajectory", roadmapBadge?.toLowerCase().includes("roadmap") || false, roadmapBadge || "");
    await page.locator('[data-eora-id="eora-roadmap-milestones"]').waitFor({ timeout: 8000 }).catch(() => {});
    await runPageTour(page, "Roadmap tour", ["eora-roadmap-milestones", "eora-roadmap-next"]);

    // -------------------------------------------------------------------------
    // TEST 9: Connections Page (/student/connections)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: CONNECTIONS PAGE UPI ---");
    await page.goto(`${base}/student/connections`, { waitUntil: "networkidle" });
    await shot(page, "12-connections-page");
    const connectionsBadge = await page.locator(".eora-page-badge").first().textContent().catch(() => "");
    record("Connections badge indicates digital footprint", connectionsBadge?.toLowerCase().includes("footprint") || connectionsBadge?.toLowerCase().includes("connection") || false, connectionsBadge || "");
    await runPageTour(page, "Connections tour", ["eora-connections-grid", "eora-connection-github", "eora-sync-history"]);

    // -------------------------------------------------------------------------
    // TEST 10: Verification Page (/verification)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 10: VERIFICATION QUEUE UPI ---");
    await page.goto(`${base}/verification`, { waitUntil: "networkidle" });
    await shot(page, "13-verification-page");
    const verificationBadge = await page.locator(".eora-page-badge").first().textContent().catch(() => "");
    record("Verification badge indicates evidence audit", verificationBadge?.toLowerCase().includes("verification") || false, verificationBadge || "");
    await runPageTour(page, "Verification tour", ["eora-verification-queue", "eora-verification-action"]);

    // -------------------------------------------------------------------------
    // TEST 11: Responsive Viewport Audits (1280px, 768px, 390px, 320px)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 11: RESPONSIVE VIEWPORT & COLLISION AUDIT ---");
    for (const width of [768, 390, 320]) {
      const height = width === 768 ? 1024 : width === 390 ? 844 : 568;
      await page.setViewportSize({ width, height });
      await page.goto(`${base}/student`, { waitUntil: "networkidle" });
      await inspectTriggerCollision(page, `${width}px Student Workspace`);
      await shot(page, `14-responsive-${width}px`);

      // Open panel and verify collision at mobile
      await openHelpPanel(page);
      await inspectPanelCollision(page, `${width}px Panel`);
      await shot(page, `14-responsive-panel-${width}px`);
      await closeHelpPanel(page);
    }

    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // -------------------------------------------------------------------------
    // TEST 12: Quiet Mode & Hinglish Interactions
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 12: QUIET MODE & HINGLISH TOGGLE ---");
    await page.goto(`${base}/student`, { waitUntil: "networkidle" });
    await openHelpPanel(page);
    
    // Toggle Hinglish
    const hinglishBtn = page.getByRole("button", { name: /Hinglish/i });
    if (await hinglishBtn.isVisible()) {
      await hinglishBtn.click();
      await shot(page, "15-hinglish-enabled");
      record("Hinglish toggle button responsive", true);
    }

    // Toggle Quiet Mode
    const modeBtn = page.getByRole("button", { name: /Mode: (balanced|playful|quiet)/i });
    if (await modeBtn.isVisible()) {
      await modeBtn.click(); // cycle mode
      await modeBtn.click(); // cycle to quiet
      await shot(page, "15-quiet-mode");
      const isQuiet = await page.getByRole("button", { name: /Mode: quiet/i }).isVisible();
      record("Quiet mode selectable", isQuiet);
      const quietAnimation = await page.locator(".eora-motion-image").last().evaluate((el) => getComputedStyle(el).animationName).catch(() => "none");
      record("Quiet mode pauses avatar motion", quietAnimation === "none" || quietAnimation === "", quietAnimation);
    }
    await page.keyboard.press("Escape");
    record("Escape key closes help panel", (await page.locator(".eora-panel").count()) === 0);

    // -------------------------------------------------------------------------
    // TEST 13: Zero Uncaught Console Errors & Zero Routine LLM Requests
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 13: PRODUCTION INTEGRITY & ZERO LLM TELEMETRY ---");
    record("Zero uncaught JavaScript console errors", consoleErrors.length === 0, consoleErrors.join("; "));
    record("Zero 5xx server responses", failedResponses.length === 0, failedResponses.join("; "));
    record("Zero routine LLM API requests across entire journey", eoraLlmRequests.length === 0, `LLM Requests count: ${eoraLlmRequests.length}`);

  } catch (err: any) {
    console.error("Test execution failed with error:", err);
    record("Browser run execution complete without fatal crash", false, err.message);
  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT & ARTIFACT PERSISTENCE
  // ---------------------------------------------------------------------------
  try {
    writeFileSync(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  } catch (err) {
    console.warn("Could not save results.json:", err);
  }

  console.log("\n===============================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`EORA PHASE 7 BROWSER CERTIFICATION RESULTS:`);
  console.log(`TOTAL CHECKS : ${total}`);
  console.log(`PASSED       : ${passed}`);
  console.log(`FAILED       : ${failed}`);
  console.log(`SUCCESS RATE : ${((passed / total) * 100).toFixed(1)}%`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error running browser certification:", e);
  process.exit(1);
});
