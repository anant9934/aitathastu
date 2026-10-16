/**
 * Browser check for Task 2.1.6: the LinkedIn consent + OTP UI on onboarding
 * Screen 6. LinkedIn itself is never contacted: every /api/student/linkedin*
 * call from the page is answered by a Playwright route mock, so no
 * credentials leave the machine. One real API call checks the server-side
 * consent gate (rejected before any worker is involved).
 *
 *   node --import tsx scripts/visual-phase2-linkedin.ts <outDir>
 */
import path from "path";
import { chromium, type Page, type Route } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

type State = { state: string; challengeSecondsLeft?: number; error?: string };

async function mockLinkedIn(page: Page, script: { afterConnect: State; afterOtp?: State }) {
  let current: State = { state: "not_started" };
  const posted: Record<string, unknown>[] = [];
  await page.route("**/api/student/linkedin**", async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith("/skip")) current = { state: "skipped_optional" };
    else if (url.endsWith("/otp")) current = script.afterOtp ?? { state: "running" };
    else if (method === "POST") { posted.push(JSON.parse(route.request().postData() || "{}")); current = script.afterConnect; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });
  return posted;
}

async function main() {
  const { setupTestDatabase } = await import("./lib/test-db");
  await setupTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { writeOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
  const seed = async (tag: string) => {
    const email = `p2-li-${tag}-${Date.now()}@test.invalid`;
    const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Asha Rao" });
    await writeOnboardingDraft(personId, { name: "Asha Rao", role: "student", targetRole: "Machine Learning Engineer", currentScreen: 6, institution: "IIT Delhi", degree: "B.Tech", priorities: ["learning"], primaryPriority: "learning" });
    return email;
  };
  const results: Record<string, unknown> = {};
  const browser = await chromium.launch();
  try {
    for (const [name, viewport] of [["1280", { width: 1280, height: 900 }], ["375", { width: 375, height: 812 }]] as const) {
      const r: Record<string, unknown> = {};
      // Flow 1: consent gate, OTP challenge, code accepted.
      {
        const email = await seed(`otp-${name}`);
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
        await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
        // Server-side gate, real API, no worker involved.
        const noConsent = await page.request.post(`${BASE}/api/student/linkedin`, { data: { email: "a@b.co", password: "x", consent: false } });
        r.serverRejectsWithoutConsent = { status: noConsent.status(), error: (await noConsent.json()).error };
        const posted = await mockLinkedIn(page, { afterConnect: { state: "awaiting_user", challengeSecondsLeft: 60 }, afterOtp: { state: "succeeded" } });
        await page.goto(`${BASE}/onboarding`);
        const card = page.getByRole("region", { name: "LinkedIn" });
        await card.waitFor({ timeout: 60_000 });
        await card.scrollIntoViewIfNeeded();
        r.framing = await card.getByText("Recommended, not required").isVisible();
        await card.getByRole("button", { name: "Connect LinkedIn" }).click();
        r.fieldsDisabledBeforeConsent = await page.getByLabel("LinkedIn email").isDisabled() && await page.getByLabel("LinkedIn password").isDisabled();
        r.connectDisabledBeforeConsent = await card.getByRole("button", { name: "Connect", exact: true }).isDisabled();
        r.aesDisclosure = await card.getByText(/AES-256-GCM and never stored in plain text/).isVisible();
        if (name === "1280") await card.screenshot({ path: path.join(out, `p2-linkedin-consent-${name}.png`) });
        await card.getByRole("checkbox").check();
        r.fieldsEnabledAfterConsent = await page.getByLabel("LinkedIn email").isEnabled();
        await page.getByLabel("LinkedIn email").fill("asha@example.com");
        await page.getByLabel("LinkedIn password").fill("not-a-real-password");
        r.passwordMasked = (await page.getByLabel("LinkedIn password").getAttribute("type")) === "password";
        await card.getByRole("button", { name: "Show password" }).click();
        r.passwordRevealToggle = (await page.getByLabel("LinkedIn password").getAttribute("type")) === "text";
        await card.getByRole("button", { name: "Connect", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor({ timeout: 10_000 });
        r.otpModal = { visible: true, text: (await dialog.innerText()).replace(/\s+/g, " ").slice(0, 160) };
        await page.screenshot({ path: path.join(out, `p2-linkedin-otp-${name}.png`) });
        await dialog.getByRole("textbox").fill("123456");
        await dialog.getByRole("button", { name: /submit|continue|verify/i }).first().click();
        await card.getByText("Imported. Your LinkedIn roles and schools").waitFor({ timeout: 10_000 });
        r.afterCodeAccepted = "Imported";
        r.postedConsentFlag = posted[0]?.consent;
        r.pageErrors = errors;
        r.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        await context.close();
      }
      // Flow 2: slow worker, then a failure, then Skip; onboarding still continues.
      {
        const email = await seed(`fail-${name}`);
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
        let mode: State = { state: "running" };
        await page.route("**/api/student/linkedin**", async (route) => {
          if (route.request().url().endsWith("/skip")) mode = { state: "skipped_optional" };
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mode) });
        });
        await page.goto(`${BASE}/onboarding`);
        const card = page.getByRole("region", { name: "LinkedIn" });
        await card.waitFor({ timeout: 60_000 });
        await page.waitForTimeout(11_500);
        r.slowMessage = await card.getByText(/may be waking up, which can take up to a minute/).isVisible();
        r.cancelOffered = await card.getByRole("button", { name: "Cancel and skip LinkedIn" }).isVisible();
        mode = { state: "dead_letter", error: "LinkedIn didn't accept that email and password." };
        await card.getByText(/didn't accept that email and password\. Your password was not kept\./).waitFor({ timeout: 10_000 });
        r.failureMessage = true;
        r.tryAgainOffered = await card.getByRole("button", { name: "Try again" }).isVisible();
        await page.screenshot({ path: path.join(out, `p2-linkedin-failed-${name}.png`) });
        await card.getByRole("button", { name: /^Skip/ }).click();
        await card.getByText("Skipped. You can connect LinkedIn any time").waitFor();
        r.skipped = true;
        // The onboarding footer's own button ("Skip / Continue" with no other account connected), not EORA's bubble.
        await page.getByRole("button", { name: /^(Skip \/ )?Continue$/ }).click();
        await page.getByRole("heading", { name: "Importing what we found" }).waitFor({ timeout: 15_000 });
        r.advancedPastScreen6AfterSkip = true;
        await context.close();
      }
      results[name] = r;
    }
  } finally {
    await browser.close();
    const { closeDbForTesting } = await import("../lib/db");
    await closeDbForTesting();
  }
  console.log(JSON.stringify(results, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
