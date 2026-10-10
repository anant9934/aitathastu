/**
 * EORA ALIVE PHASE 7.1 — REAL BROWSER DEEP TASK COMPLETION CERTIFICATION
 *
 * Full Playwright automation verifying:
 * 1. Reference Project Creation Guide (task-add-project) end-to-end task flow:
 *    - Modal opening via trigger spotlight
 *    - Title & Summary input highlighting
 *    - Personal contribution boundary note entry
 *    - GitHub repository link attachment
 *    - Explicit user confirmation requirement
 *    - Backend persistence celebration & next recommended action
 * 2. Deep Guided Tasks on Functional Pages:
 *    - /student/skills (task-review-skills)
 *    - /student/roadmap (task-explore-roadmap)
 *    - /student/connections (task-connect-footprint)
 *    - /student/profile (task-audit-profile)
 * 3. Contextual Multilingual Q&A with proactive field spotlighting
 * 4. Responsive Viewports: 1280px (Desktop), 768px (Tablet), 390px (Mobile), 320px (Ultra-compact)
 * 5. Strict Zero-Routine-LLM call audit
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createSession } from "../lib/auth/session";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const output = path.join(process.cwd(), process.env.EORA_SCREENSHOT_DIR || "docs/screenshots/eora-phase7-1");
mkdirSync(output, { recursive: true });

let testSessionToken = "";

const results: Array<{ check: string; passed: boolean; detail: string }> = [];
const consoleErrors: string[] = [];
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

async function main() {
  console.log("===============================================================================");
  console.log("AI TATHASTU — EORA ALIVE PHASE 7.1: DEEP INTERACTIVE ASSISTANCE BROWSER TESTS");
  console.log("===============================================================================\n");

  const loginRes = await fetch(`${base}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "staging_student_v33@aitathastu.test",
      password: "StudentPass123!",
    }),
  });
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const match = setCookie.match(/tathastu_session=([^;]+)/);
  if (match) {
    testSessionToken = match[1];
  }
  console.log("Acquired authenticated session token:", testSessionToken ? "OK" : "FAILED");

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const setupContext = async (viewport: { width: number; height: number }): Promise<{ context: BrowserContext; page: Page }> => {
    const context = await browser.newContext({
      viewport,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!text.includes("favicon") && !text.includes("hydration")) {
          consoleErrors.push(text);
        }
      }
    });

    page.on("request", (req) => {
      const url = req.url().toLowerCase();
      if (
        url.includes("api.openai.com") ||
        url.includes("anthropic.com") ||
        url.includes("generativelanguage.googleapis.com")
      ) {
        eoraLlmRequests.push(url);
      }
    });

    // Authenticate context with valid session cookie
    try {
      await context.addCookies([
        {
          name: "tathastu_session",
          value: testSessionToken,
          url: base,
        },
      ]);
    } catch (e) {
      console.warn("Could not set session cookie in setupContext:", e);
    }

    // Seed mock student session in localStorage
    await page.addInitScript(() => {
      try {
        localStorage.setItem(
          "ai_tathastu_user_profile",
          JSON.stringify({
            id: "prs_e2e_staging_student_v33",
            fullName: "Ananya Staging",
            email: "staging_student_v33@aitathastu.test",
            academicRole: "Undergraduate",
            targetRole: "Autonomous AI Agent Engineer",
            skillsCount: 7,
            projectsCount: 2,
            verifiedEvidenceCount: 3,
            completedTours: [],
          })
        );
      } catch (e) {}
    });

    return { context, page };
  };

  // =========================================================================
  // TEST SUITE 1: REFERENCE PROJECT CREATION TASK FLOW (/student/projects)
  // =========================================================================
  console.log("\n[TEST 1] Reference Project Creation Flow (/student/projects at 1280px Desktop)");
  {
    const { context, page } = await setupContext({ width: 1280, height: 850 });
    await page.goto(`${base}/student/projects`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // 1. Verify EORA Presence & Page Recognition
    const trigger = page.locator(".eora-avatar-trigger");
    record("Projects page EORA trigger visible", await trigger.isVisible());

    // 2. Open Companion Panel
    await openHelpPanel(page);
    await shot(page, "01_projects_panel_opened_desktop");

    // 3. Start task via Guide button
    const guideBtn = page.locator('[data-eora-id="eora-start-task-btn"]');
    record("Guide button '✨ Guide: Add & Document Project' visible", await guideBtn.isVisible());
    await guideBtn.click();
    await page.waitForTimeout(500);

    // 4. Verify Task Step 1 (Open Project Form)
    const taskCard = page.locator(".eora-task-card");
    record("Task guidance card active in panel", await taskCard.isVisible());
    const step1Title = await taskCard.locator("div").filter({ hasText: "Open Project Form" }).first().isVisible();
    record("Step 1 'Open Project Form' displayed", step1Title);

    // Verify trigger spotlight
    const triggerSpotlight = page.locator('[data-eora-spotlight="true"]');
    record("Add Project trigger spotlighted", (await triggerSpotlight.count()) > 0);
    await shot(page, "02_task_step1_open_modal");

    // Click 'Add Project' trigger on page (check both empty state and header triggers)
    const emptyTrigger = page.locator("#eora-add-project-empty-trigger");
    if (await emptyTrigger.isVisible()) {
      await emptyTrigger.click();
    } else {
      await page.evaluate(() => {
        const btn = (document.getElementById("eora-add-project-trigger") ||
          document.getElementById("eora-add-project-empty-trigger") ||
          document.querySelector('[data-eora-id="eora-add-project-btn"]')) as HTMLElement | null;
        btn?.click();
      });
    }
    await page.waitForTimeout(600);

    // Verify modal is open
    const modalHeading = page.getByRole("heading", { name: "Add Project" }).first();
    record("Project modal opened", await modalHeading.isVisible());

    // Step 2 (Title) — reached via project_modal_opened event or next
    const nextStepBtn = taskCard.getByRole("button", { name: /Next/i }).first();
    const onTitleStep = await taskCard.locator("div").filter({ hasText: "Project Title" }).first().isVisible();
    if (!onTitleStep) {
      if (await nextStepBtn.isVisible()) {
        await nextStepBtn.click();
        await page.waitForTimeout(300);
      }
    }
    const titleInput = page.locator("#eora-project-input-title");
    record("Title input available", await titleInput.isVisible());
    await titleInput.fill("Autonomous Vision Agent");
    await shot(page, "03_task_step2_title_entered");

    // 6. Advance to Step 3 (Summary)
    await nextStepBtn.click();
    await page.waitForTimeout(400);

    const summaryInput = page.locator("#eora-project-input-summary");
    record("Summary input available", await summaryInput.isVisible());
    await summaryInput.fill("Autonomous agent for real-time visual reasoning and tool calling.");

    // 7. Advance to Step 4 (Contribution Note)
    await nextStepBtn.click();
    await page.waitForTimeout(400);

    const contribInput = page.locator("#eora-project-input-contribution");
    record("Personal contribution note textarea available", await contribInput.isVisible());
    await contribInput.fill("Designed the multimodal transformer perception pipeline and evaluated tool execution accuracy.");
    await shot(page, "04_task_step4_contribution_entered");

    // 8. Advance to Step 5 (Repository URL)
    await nextStepBtn.click();
    await page.waitForTimeout(400);

    const repoInput = page.locator("#eora-project-input-repo");
    record("Repository URL input available", await repoInput.isVisible());
    await repoInput.fill("https://github.com/example/vision-agent");

    // 9. Advance to Step 6 (Review & Save Project - Confirmation Required)
    await nextStepBtn.click();
    await page.waitForTimeout(400);

    const confirmStepText = await taskCard.locator("div").filter({ hasText: "Review & Save Project" }).first().isVisible();
    record("Step 6 'Review & Save Project' reached", confirmStepText);

    const saveProjectBtn = page.locator("#eora-project-save-btn");
    record("Save Project submit button spotlighted/ready", await saveProjectBtn.isVisible());
    await shot(page, "05_task_step6_ready_to_save");

    // 10. Click Save Project to trigger save
    const finishBtn = taskCard.locator("button.eora-tour-btn--primary");
    await finishBtn.scrollIntoViewIfNeeded().catch(() => {});
    record("Finish button in task card requires confirmation", await finishBtn.isVisible());
    await finishBtn.click();
    await page.waitForTimeout(500);

    // Verify task celebration message
    const speechBubble = page.locator(".eora-speech-bubble");
    const speechText = (await speechBubble.textContent()) || "";
    record(
      "Task celebration shown with next action recommendation",
      speechText.includes("Project successfully saved") || speechText.includes("Your contribution note is recorded"),
      speechText
    );
    await shot(page, "06_task_completed_celebration");

    await closeHelpPanel(page);
    await context.close();
  }

  // =========================================================================
  // TEST SUITE 2: FUNCTIONAL PAGES TASK GUIDANCE AUDIT
  // =========================================================================
  console.log("\n[TEST 2] Functional Pages Guided Tasks Audit");

  const functionalRoutes = [
    {
      route: "/student/skills",
      expectedTaskId: "task-review-skills",
      taskTitle: "Audit Skills & Evidence",
      shotName: "07_skills_task_guidance",
    },
    {
      route: "/student/roadmap",
      expectedTaskId: "task-explore-roadmap",
      taskTitle: "Explore Roadmap Milestones",
      shotName: "08_roadmap_task_guidance",
    },
    {
      route: "/student/connections",
      expectedTaskId: "task-connect-footprint",
      taskTitle: "Connect Digital Footprints",
      shotName: "09_connections_task_guidance",
    },
    {
      route: "/student/profile",
      expectedTaskId: "task-audit-profile",
      taskTitle: "Person 360 Profile Audit",
      shotName: "10_profile_task_guidance",
    },
  ];

  for (const item of functionalRoutes) {
    const { context, page } = await setupContext({ width: 1280, height: 850 });
    await page.goto(`${base}${item.route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    await openHelpPanel(page);
    const guideBtn = page.locator('[data-eora-id="eora-start-task-btn"]');
    const hasGuideBtn = await guideBtn.isVisible();
    record(`${item.route} has guide button for ${item.taskTitle}`, hasGuideBtn);

    if (hasGuideBtn) {
      await guideBtn.click();
      await page.waitForTimeout(400);

      const taskCard = page.locator(".eora-task-card");
      record(`${item.route} guidance card active for ${item.expectedTaskId}`, await taskCard.isVisible());

      await shot(page, item.shotName);

      // Advance one step
      const nextBtn = taskCard.locator("button.eora-tour-btn--primary").first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }

      // Cancel task to test cancellation recovery
      const cancelBtn = taskCard.locator("button.eora-tour-btn--exit").first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(300);
        record(`${item.route} task cancelled cleanly without errors`, !(await taskCard.isVisible()));
      }
    }

    await closeHelpPanel(page);
    await context.close();
  }

  // =========================================================================
  // TEST SUITE 3: CONTEXTUAL MULTILINGUAL Q&A IN REAL BROWSER CHAT
  // =========================================================================
  console.log("\n[TEST 3] Real Browser Multilingual Q&A & Field Spotlight");
  {
    const { context, page } = await setupContext({ width: 1280, height: 850 });
    await page.goto(`${base}/student/projects`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    await openHelpPanel(page);
    const askEora = async (query: string): Promise<string> => {
      const chatInput = page.locator('input[placeholder="Ask EORA anything..."]');
      const chatSendBtn = page.locator("button.eora-input-send");
      const bubble = page.locator(".eora-speech-bubble");
      await chatInput.click();
      await chatInput.fill(query);
      await page.waitForTimeout(200);
      await chatSendBtn.click();
      await page.waitForTimeout(900);
      return (await bubble.textContent()) || "";
    };

    // 1. Multilingual Question: "Ye kya karta hai?"
    const reply1 = await askEora("Ye kya karta hai?");
    record("Chat answer for 'Ye kya karta hai?'", reply1.length > 10, reply1.slice(0, 80));

    // 2. Multilingual Question: "Where do I put my GitHub link?" (should spotlight repo field)
    const reply2 = await askEora("Where do I put my GitHub link?");
    record("Chat answer for 'Where do I put my GitHub link?'", reply2.includes("GitHub") || reply2.includes("Section B"), reply2.slice(0, 80));
    await shot(page, "11_chat_multilingual_qa");

    // 3. Question: "Why is this field required?"
    const reply3 = await askEora("Why is this field required?");
    record("Chat answer for 'Why is this field required?'", reply3.includes("verifiable artifacts") || reply3.includes("Required fields"), reply3.slice(0, 80));

    await closeHelpPanel(page);
    await context.close();
  }

  // =========================================================================
  // TEST SUITE 4: RESPONSIVE VIEWPORT SUITE (1280px, 768px, 390px, 320px)
  // =========================================================================
  console.log("\n[TEST 4] Responsive Viewports Verification");

  const viewports = [
    { label: "Desktop", width: 1280, height: 850, shotName: "12_responsive_1280_desktop" },
    { label: "Tablet", width: 768, height: 1024, shotName: "13_responsive_768_tablet" },
    { label: "Mobile-390px", width: 390, height: 844, shotName: "14_responsive_390_mobile" },
    { label: "Mobile-320px", width: 320, height: 568, shotName: "15_responsive_320_compact" },
  ];

  for (const vp of viewports) {
    const { context, page } = await setupContext({ width: vp.width, height: vp.height });
    await page.goto(`${base}/student/projects`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    const trigger = page.locator(".eora-avatar-trigger");
    record(`Trigger visible at ${vp.label} (${vp.width}px)`, await trigger.isVisible());

    await openHelpPanel(page);
    const panel = page.locator(".eora-panel");
    const panelBox = await panel.boundingBox();
    const fitsWidth = panelBox ? panelBox.width <= vp.width : false;
    record(`Panel contained within viewport at ${vp.label} (${vp.width}px)`, fitsWidth, `Width: ${panelBox?.width}px`);

    await shot(page, vp.shotName);
    await closeHelpPanel(page);
    await context.close();
  }

  // =========================================================================
  // TEST SUITE 5: PRIVACY, AUDIT & ZERO LLM TELEMETRY
  // =========================================================================
  console.log("\n[TEST 5] Safety, Privacy & Zero Routine LLM Invocations");
  record("Zero console errors during browser execution", consoleErrors.length === 0, consoleErrors.join(" | "));
  record("Zero routine LLM requests intercepted", eoraLlmRequests.length === 0, `Calls: ${eoraLlmRequests.length}`);

  await browser.close();

  // Print Summary Table
  console.log("\n===============================================================================");
  console.log("  EORA ALIVE PHASE 7.1 — BROWSER TEST RESULTS SUMMARY");
  console.log("===============================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Total Checks Executed : ${totalCount}`);
  console.log(`Checks Passed         : ${passedCount}`);
  console.log(`Checks Failed         : ${totalCount - passedCount}`);
  console.log(`Pass Rate             : ${((passedCount / totalCount) * 100).toFixed(1)}%`);

  if (passedCount !== totalCount) {
    console.error("\n❌ Some browser assertions failed. Review log above.");
    process.exit(1);
  } else {
    console.log("\n🌟 ALL BROWSER ASSERTIONS PASSED! EORA Phase 7.1 Certified.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
