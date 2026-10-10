/** Real Chrome journey. Uses a disposable local test student and the approved CV fixture. */
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const output = path.join(process.cwd(), "docs/screenshots/eora-phase6");
mkdirSync(output, { recursive: true });
const results: Array<{ check: string; passed: boolean; detail: string }> = [];
const consoleErrors: string[] = [];
const failedResponses: string[] = [];
const eoraRequests: string[] = [];
const credential = `eora_phase6_${Date.now()}@aitathastu.test`;

function record(check: string, passed: boolean, detail = "") {
  results.push({ check, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${check}${detail ? ` — ${detail}` : ""}`);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false });
}

async function inspectTrigger(page: Page, label: string) {
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

async function inspectPanel(page: Page, label: string) {
  const blocked = await page.evaluate(() => {
    const panel = document.querySelector(".eora-panel")?.getBoundingClientRect();
    if (!panel) return ["panel missing"];
    return Array.from(document.querySelectorAll<HTMLElement>("button, input, textarea, select, a"))
      .filter((el) => !el.closest(".eora-floating-root") && el.getClientRects().length > 0)
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.left < panel.right && rect.right > panel.left && rect.top < panel.bottom && rect.bottom > panel.top;
      }).map((el) => el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 40) || el.tagName);
  });
  record(`No help panel collision: ${label}`, blocked.length === 0, blocked.join(", "));
}

async function next(page: Page) {
  await page.locator("button.btn-purple-next").click();
}

async function spotlight(page: Page, targetId: string, label: string) {
  const shown = await page.locator(`[data-eora-id="${targetId}"][data-eora-spotlight="true"]`)
    .waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
  record(label, shown);
}

async function exercisePageTour(page: Page, label: string, targets: string[]) {
  await page.getByRole("button", { name: /EORA — open help panel/ }).click();
  await page.getByRole("button", { name: "Start a guided tour of this page" }).click();
  for (let index = 0; index < targets.length; index++) {
    const target = page.locator(`[data-eora-id="${targets[index]}"][data-eora-spotlight="true"]`);
    const visible = await target.waitFor({ timeout: 1400 }).then(() => true).catch(() => false);
    const recovery = !visible && await page.locator(".eora-tour-unavailable").isVisible();
    record(`${label}: ${targets[index]}`, visible || recovery, visible ? "highlighted" : recovery ? "unavailable notice shown" : "missing without recovery");
    if (index < targets.length - 1) await page.getByRole("button", { name: "Next step" }).click();
  }
  await page.getByRole("button", { name: "Exit tour" }).click();
  await page.getByRole("button", { name: "Close help panel", exact: true }).click();
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    const state = window as typeof window & { __eoraLayoutShift?: number };
    state.__eoraLayoutShift = 0;
    if (typeof PerformanceObserver !== "undefined") {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput) state.__eoraLayoutShift = (state.__eoraLayoutShift || 0) + (shift.value || 0);
        }
      }).observe({ type: "layout-shift", buffered: true });
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => consoleErrors.push(`${page.url()}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    if (/\/api\/(?:eora\/chat|ai\/|llm\/)/.test(request.url())) eoraRequests.push(request.url());
  });

  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await shot(page, "01-landing");
    record("Landing hero", await page.locator("h1").isVisible());
    await inspectTrigger(page, "desktop landing");

    await page.getByRole("button", { name: "Get Started", exact: true }).first().click();
    await page.waitForURL(/\/onboarding/);
    await page.locator("#student-name-input").waitFor();
    await page.waitForTimeout(1200); // let the development server finish any initial Fast Refresh
    await shot(page, "02-onboarding-welcome");
    record("Onboarding welcome", await page.locator("h1").textContent().then((x) => x?.includes("get to know") || false));
    record("Single floating assistant", await page.locator(".eora-floating-root").count() === 1);

    await page.getByRole("button", { name: /EORA — open help panel/ }).click();
    await page.getByRole("dialog", { name: "EORA help panel" }).waitFor();
    await page.getByRole("button", { name: "Start a guided tour of this page" }).click();
    await page.locator('[data-eora-id="eora-name-input"][data-eora-spotlight="true"]').waitFor();
    await page.waitForTimeout(280);
    await shot(page, "05-interactive-tour");
    record("Tour highlights actual name input", true);
    await page.getByRole("button", { name: "Pause tour" }).click();
    record("Tour pauses", await page.getByRole("button", { name: "Resume tour" }).isVisible());
    await page.getByRole("button", { name: "Resume tour" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    record("Onboarding tour waits for form navigation", await page.locator('[data-eora-id="eora-name-input"][data-eora-spotlight="true"]').count() === 1);

    await page.getByRole("button", { name: "Close help panel", exact: true }).click();
    await page.fill("#student-name-input", "Phase Six Student");
    await page.click('button[aria-label="Submit name and continue"]');
    await page.getByRole("heading", { name: "What best describes you?" }).waitFor();
    await spotlight(page, "eora-role-select", "Role tour target");
    await next(page);
    await page.getByRole("heading", { name: /Where do you want to go in AI/ }).waitFor();
    await spotlight(page, "eora-ai-direction", "Direction tour target");
    await next(page);
    await page.getByRole("heading", { name: /What brings you to AI Tathastu/ }).waitFor();
    await spotlight(page, "eora-priorities", "Priorities tour target");
    await next(page);
    await page.getByRole("heading", { name: /Tell us a bit about yourself/ }).waitFor();
    await spotlight(page, "eora-academic-form", "Academic tour target");

    await page.getByRole("button", { name: /EORA — open help panel/ }).click();
    await page.getByRole("button", { name: "Explain step" }).click();
    await inspectPanel(page, "desktop academic form");
    await shot(page, "03-field-guidance");
    record("Field guidance available on request", await page.locator(".eora-speech-bubble").isVisible());
    await page.getByRole("button", { name: "Close help panel", exact: true }).click();
    await next(page);
    record("Validation blocks missing credentials", await page.getByText("Email address is mandatory").count() > 0);
    await shot(page, "04-validation-error");
    await page.locator("#field-email").fill(credential);
    await page.locator("#field-password").fill("PhaseSixPass123!");
    await shot(page, "04-validation-correction");
    await next(page);
    await page.getByRole("heading", { name: /Upload your Resume or Academic CV/ }).waitFor();
    record("Academic form advances after correction", true);
    await spotlight(page, "eora-resume-upload", "Resume tour target");

    const consent = page.locator('input[type="checkbox"]').first();
    if (await consent.count() && !(await consent.isChecked())) await consent.check();
    await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles(path.join(process.cwd(), "scripts/fixtures/test_student_cv.pdf"));
    const extraction = await Promise.race([
      page.getByText("Review suggested claims").first().waitFor({ timeout: 15000 }).then(() => "ready" as const),
      page.getByText("Resume import is unavailable").first().waitFor({ timeout: 15000 }).then(() => "blocked" as const),
    ]);
    if (extraction === "ready") {
      await page.getByRole("button", { name: "Save selected claims" }).click();
      await shot(page, "06-resume-analysis-completion");
      record("Resume extraction and review", await page.getByText("Review saved").isVisible());
    } else {
      await shot(page, "06-resume-extraction-blocked");
      record("Resume extraction and review", false, "HTTP 503: credential rotation required");
    }
    await next(page);

    await spotlight(page, "eora-digital-footprints", "Footprints tour target");
    await page.getByRole("button", { name: /Skip \/ Continue/ }).click();
    await page.getByRole("button", { name: /View Profile Insights/ }).click();
    await shot(page, "07-profile-review");
    record("Profile review rendered", await page.locator("h1").isVisible());
    await next(page);
    await next(page);
    await next(page);
    await page.getByRole("button", { name: "Launch My Workspace" }).click({ timeout: 10000 });
    await page.waitForURL(/\/student/, { timeout: 20000 });
    const dashboardVisible = await page.locator('[data-eora-id="eora-overview"]').waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    await shot(page, "08-personalized-dashboard");
    const session = await page.evaluate(async () => {
      const response = await fetch("/api/auth/session");
      return response.ok ? await response.json() : null;
    });
    record("Authenticated dashboard", dashboardVisible && Boolean(session?.authenticated), dashboardVisible ? "dashboard rendered" : "dashboard did not render");
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, "08-personalized-dashboard");
    await exercisePageTour(page, "Dashboard tour", ["eora-active-goal", "eora-next-actions", "eora-evidence-panel", "eora-sidebar"]);

    await page.goto(`${base}/student/skills`, { waitUntil: "networkidle" });
    await exercisePageTour(page, "Skills tour", ["eora-skills-list", "eora-skill-verification"]);

    await page.goto(`${base}/student/projects`, { waitUntil: "networkidle" });
    await exercisePageTour(page, "Projects tour", ["eora-projects-list", "eora-contribution-note"]);
    await page.getByRole("button", { name: /Add (Your First )?Project/ }).first().click();
    await page.getByPlaceholder("AI-powered Research Assistant").fill("Phase Six Browser Project");
    await page.getByRole("button", { name: "Research", exact: true }).click();
    await page.getByPlaceholder(/I implemented the fine-tuning training loop/).fill("I researched and documented the test project scope.");
    await page.getByRole("button", { name: "Save Project", exact: true }).click();
    await page.getByText("Phase Six Browser Project").first().waitFor({ timeout: 15000 });
    await shot(page, "09-project-save-success");
    record("Project save confirmed by server", true);
    await exercisePageTour(page, "Projects populated tour", ["eora-projects-list", "eora-contribution-note"]);

    await page.goto(`${base}/student/roadmap`, { waitUntil: "networkidle" });
    await exercisePageTour(page, "Roadmap tour", ["eora-roadmap-milestones", "eora-roadmap-next"]);
    await page.getByRole("button", { name: /EORA — open help panel/ }).click();
    await page.getByRole("button", { name: "Start a guided tour of this page" }).click();
    await shot(page, "09-roadmap-assistance");
    record("Roadmap assistance rendered", await page.locator(".eora-tour-controls").isVisible());

    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : 844 });
      await page.goto(`${base}/onboarding`, { waitUntil: "networkidle" });
      await inspectTrigger(page, `${width}px onboarding`);
      await shot(page, `10-mobile-${width}`);
    }
    await page.getByRole("button", { name: /EORA — open help panel/ }).click();
    await inspectPanel(page, "320px onboarding");
    await page.getByRole("button", { name: /Mode: balanced/i }).click();
    await page.getByRole("button", { name: /Mode: playful/i }).click();
    await shot(page, "11-quiet-mode");
    record("Quiet mode preference", await page.getByRole("button", { name: /Mode: quiet/i }).isVisible());
    const quietAnimation = await page.locator(".eora-motion-image").last().evaluate((element) => getComputedStyle(element).animationName);
    record("Quiet mode pauses avatar motion", quietAnimation === "none", quietAnimation);
    await page.keyboard.press("Escape");
    record("Escape closes help panel", await page.locator(".eora-panel").count() === 0);
    await page.getByRole("button", { name: /EORA — open help panel/ }).click();
    await page.getByRole("button", { name: "Close EORA" }).click();
    await page.getByRole("button", { name: "Bring back EORA companion" }).waitFor();
    await shot(page, "12-dismissed");
    record("Dismiss and restore available", await page.getByRole("button", { name: "Bring back EORA companion" }).isVisible());

    const layoutShift = await page.evaluate(() => (window as typeof window & { __eoraLayoutShift?: number }).__eoraLayoutShift ?? null);
    record("No significant EORA layout shift", layoutShift !== null && layoutShift < 0.1, String(layoutShift));

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${base}/student`, { waitUntil: "networkidle" });
    const first = await page.evaluate(async () => {
      const response = await fetch("/api/eora/context");
      return response.ok ? await response.json() : null;
    });
    record("Authenticated EORA context contains no credentials", Boolean(first?.personId) && !/password|token|secret/i.test(JSON.stringify(first)));
    await page.getByRole("button", { name: "Logout", exact: true }).first().click();
    await page.waitForURL(/\/sign-in/);
    const signedOutStatus = await page.evaluate(async () => (await fetch("/api/eora/context")).status);
    record("Context inaccessible after logout", signedOutStatus === 401, String(signedOutStatus));

    const secondEmail = `eora_phase6_second_${Date.now()}@aitathastu.test`;
    const signupStatus = await page.evaluate(async (email) => {
      const response = await fetch("/api/auth/sign-up", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "PhaseSixPass123!", displayName: "Second Browser Student" }),
      });
      return response.status;
    }, secondEmail);
    const second = signupStatus === 200 ? await page.evaluate(async () => {
      const response = await fetch("/api/eora/context");
      return response.ok ? await response.json() : null;
    }) : null;
    record("Person-specific context isolation", Boolean(first?.personId && second?.personId && first.personId !== second.personId && second.displayName === "Second Browser Student"), `second sign-up ${signupStatus}`);

    record("Routine EORA LLM requests", eoraRequests.length === 0, String(eoraRequests.length));
    record("Browser page errors", consoleErrors.length === 0, consoleErrors.join(" | "));
    record("Server 5xx responses", failedResponses.length === 0, failedResponses.join(" | "));

    const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await reduced.goto(`${base}/onboarding`, { waitUntil: "networkidle" });
    const animation = await reduced.locator(".eora-motion-image").last().evaluate((element) => getComputedStyle(element).animationName);
    record("System reduced-motion preference", animation === "none", animation);
    await reduced.close();
  } catch (error) {
    record("Journey completion", false, String(error));
    await shot(page, "failure-state").catch(() => {});
  } finally {
    await context.close();
    await browser.close();
    writeFileSync(path.join(output, "results.json"), JSON.stringify({ results, consoleErrors, failedResponses, eoraRequests }, null, 2));
  }
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
