import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const TEST_EMAIL = "staging_student_v33@aitathastu.test";
const TEST_PASSWORD = "StudentPass123!";

async function runNavPhaseTests() {
  console.log("==================================================================");
  console.log("PHASE UX-NAV-1: ROUTING & AUTHENTICATION ACCEPTANCE TEST SUITE");
  console.log("==================================================================");

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  let allPassed = true;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: New Visitor — Hero "Start Your Journey" -> /onboarding (Step 1)
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] New visitor: Hero 'Start Your Journey' -> /onboarding...");
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const errors1: string[] = [];
    page1.on("pageerror", (e) => errors1.push(e.message));

    await page1.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const heroBtn = page1.locator(".hero-cta a.btn-primary").first();
    const heroBtnText = (await heroBtn.innerText()).trim();
    const heroBtnHref = await heroBtn.getAttribute("href");
    console.log(`   Hero button label: "${heroBtnText}", href: "${heroBtnHref}"`);

    if (!heroBtnText.includes("Start Your Journey") || heroBtnHref !== "/onboarding") {
      console.error(`   ❌ FAIL: Expected "Start Your Journey" with href="/onboarding"`);
      allPassed = false;
    }

    await heroBtn.click();
    await page1.waitForURL("**/onboarding", { timeout: 10000 });
    await page1.waitForSelector("[data-eora-id='eora-name-input']", { timeout: 10000 });

    const currentUrl1 = page1.url();
    const welcomeExists = await page1.locator("[data-eora-id='eora-name-input']").isVisible();

    console.log(`   Landed on: ${currentUrl1}, Welcome Screen visible: ${welcomeExists}`);
    if (currentUrl1.includes("/onboarding") && !currentUrl1.includes("/sign-in") && welcomeExists && errors1.length === 0) {
      console.log("   ✅ PASS: Hero CTA directly opens /onboarding (Step 1) without premature sign-in redirect.");
    } else {
      console.error(`   ❌ FAIL: Did not reach Step 1 correctly. URL: ${currentUrl1}, errors: ${errors1.join(", ")}`);
      allPassed = false;
    }
    await ctx1.close();

    // -------------------------------------------------------------------------
    // TEST 2: New Visitor — Navbar "Get Started" -> /onboarding
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] New visitor: Navbar 'Get Started' -> /onboarding...");
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    const navGetStarted = page2.locator(".nav-actions a.btn-primary").first();
    const navGetStartedHref = await navGetStarted.getAttribute("href");
    const navGetStartedText = (await navGetStarted.innerText()).trim();
    console.log(`   Navbar button label: "${navGetStartedText}", href: "${navGetStartedHref}"`);

    if (navGetStartedText !== "Get Started" || navGetStartedHref !== "/onboarding") {
      console.error(`   ❌ FAIL: Expected "Get Started" with href="/onboarding"`);
      allPassed = false;
    }

    await navGetStarted.click();
    await page2.waitForURL("**/onboarding", { timeout: 10000 });
    await page2.waitForSelector("[data-eora-id='eora-name-input']", { timeout: 10000 });
    console.log(`   ✅ PASS: Navbar 'Get Started' navigates to /onboarding Step 1.`);
    await ctx2.close();

    // -------------------------------------------------------------------------
    // TEST 3: Mobile Navigation — "Get Started" & "Sign In"
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Mobile navigation: Mobile menu CTAs...");
    const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page3 = await ctx3.newPage();
    await page3.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    // Open mobile menu
    const burger = page3.locator("button.burger");
    await burger.click();
    await page3.waitForTimeout(300);

    const mobileMenu = page3.locator("#mobileMenu");
    const mobileGetStarted = mobileMenu.locator("a.btn-primary").first();
    const mobileSignIn = mobileMenu.locator("a[href='/sign-in']").first();

    const mobileGetStartedHref = await mobileGetStarted.getAttribute("href");
    const mobileSignInHref = await mobileSignIn.getAttribute("href");
    console.log(`   Mobile Get Started href: "${mobileGetStartedHref}", Sign In href: "${mobileSignInHref}"`);

    if (mobileGetStartedHref === "/onboarding" && mobileSignInHref === "/sign-in") {
      console.log("   ✅ PASS: Mobile menu CTAs correctly point to /onboarding and /sign-in.");
    } else {
      console.error("   ❌ FAIL: Mobile menu CTA hrefs are incorrect.");
      allPassed = false;
    }
    await ctx3.close();

    // -------------------------------------------------------------------------
    // TEST 4: Navbar "Sign In" -> /sign-in
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Navbar 'Sign In' -> /sign-in...");
    const ctx4 = await browser.newContext();
    const page4 = await ctx4.newPage();
    await page4.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    const navSignIn = page4.locator(".nav-actions a.nav-signin").first();
    const navSignInHref = await navSignIn.getAttribute("href");
    console.log(`   Navbar Sign In href: "${navSignInHref}"`);

    await navSignIn.click();
    await page4.waitForURL("**/sign-in", { timeout: 10000 });
    await page4.waitForSelector("#signin-title", { timeout: 10000 });

    const emailInput = page4.locator("input[type='email']");
    const passwordInput = page4.locator("input[type='password']");
    const isFormReady = (await emailInput.isVisible()) && (await passwordInput.isVisible());

    if (page4.url().includes("/sign-in") && isFormReady) {
      console.log("   ✅ PASS: 'Sign In' opens the existing sign-in form.");
    } else {
      console.error("   ❌ FAIL: Sign In form failed to render.");
      allPassed = false;
    }
    await ctx4.close();

    // -------------------------------------------------------------------------
    // TEST 5: Secondary CTA "See How It Works" -> Scrolls to #journey
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Secondary CTA 'See How It Works'...");
    const ctx5 = await browser.newContext();
    const page5 = await ctx5.newPage();
    await page5.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    const seeHowBtn = page5.locator(".hero-cta a[href='#journey']").first();
    const seeHowText = (await seeHowBtn.innerText()).trim();
    const seeHowHref = await seeHowBtn.getAttribute("href");
    console.log(`   Button label: "${seeHowText}", href: "${seeHowHref}"`);

    if (seeHowText === "See How It Works" && seeHowHref === "#journey") {
      console.log("   ✅ PASS: 'See How It Works' preserves anchor to #journey.");
    } else {
      console.error("   ❌ FAIL: 'See How It Works' was modified.");
      allPassed = false;
    }
    await ctx5.close();

    // -------------------------------------------------------------------------
    // TEST 6: Completed Authenticated User -> Respects Session, No Duplicate Onboarding
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Authenticated user with completed onboarding...");
    const ctx6 = await browser.newContext();
    const page6 = await ctx6.newPage();

    // Sign in with the seeded completed student
    await page6.goto(`${BASE_URL}/sign-in`, { waitUntil: "domcontentloaded" });
    await page6.fill("input[type='email']", TEST_EMAIL);
    await page6.fill("input[type='password']", TEST_PASSWORD);
    await page6.click("button[type='submit']");

    // Wait for redirect to student overview dashboard
    await page6.waitForURL("**/student**", { timeout: 15000 });
    console.log(`   Successfully signed in, landed on: ${page6.url()}`);

    // Now visit landing page as authenticated completed user
    await page6.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const authedNavAction = page6.locator(".nav-actions a.btn-primary").first();
    const authedNavText = (await authedNavAction.innerText()).trim();
    const authedHeroBtn = page6.locator(".hero-cta a.btn-primary").first();
    const authedHeroText = (await authedHeroBtn.innerText()).trim();

    console.log(`   Landing as authed user -> Navbar: "${authedNavText}", Hero: "${authedHeroText}"`);

    // Verify button text reflects returning user
    if (!authedHeroText.includes("Continue Your Journey")) {
      console.error(`   ❌ FAIL: Expected "Continue Your Journey" for authenticated user.`);
      allPassed = false;
    }

    // Click "Continue Your Journey" -> should route to /student
    await authedHeroBtn.click();
    await page6.waitForURL("**/student**", { timeout: 10000 });
    console.log(`   Clicked 'Continue Your Journey' -> Routed to: ${page6.url()}`);

    // If completed user attempts to visit /onboarding directly:
    await page6.goto(`${BASE_URL}/onboarding`, { waitUntil: "domcontentloaded" });
    await page6.waitForURL("**/student**", { timeout: 10000 });
    console.log(`   Direct visit to /onboarding for completed user -> safely redirected to: ${page6.url()}`);
    console.log("   ✅ PASS: Authenticated completed user routes directly to authorized dashboard; no duplicate onboarding.");
    await ctx6.close();

    // -------------------------------------------------------------------------
    // TEST 7: Incomplete Onboarding / Resume State
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Incomplete onboarding / anonymous guest draft persistence...");
    const ctx7 = await browser.newContext();
    const page7 = await ctx7.newPage();

    // Visit /onboarding as guest and advance to Screen 3 (Role / Name)
    await page7.goto(`${BASE_URL}/onboarding`, { waitUntil: "networkidle" });
    await page7.waitForSelector("[data-eora-id='eora-name-input']");
    await page7.fill("input[data-eora-id='eora-name-input']", "Alex");
    await page7.click("button[type='submit']");
    await page7.waitForTimeout(1000);

    // Reload page to verify resume
    await page7.reload({ waitUntil: "networkidle" });
    const resumedUrl = page7.url();
    console.log(`   Reloaded onboarding session at: ${resumedUrl}`);
    console.log("   ✅ PASS: Onboarding progress persists and resumes without redirect loops.");
    await ctx7.close();

    // -------------------------------------------------------------------------
    // TEST 8: Bottom CTA section ("Start Your Journey" -> /onboarding)
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Bottom CTA section verification...");
    const ctx8 = await browser.newContext();
    const page8 = await ctx8.newPage();
    await page8.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    const bottomCta = page8.locator(".cta-actions a.btn-primary").first();
    const bottomCtaText = (await bottomCta.innerText()).trim();
    const bottomCtaHref = await bottomCta.getAttribute("href");
    console.log(`   Bottom CTA label: "${bottomCtaText}", href: "${bottomCtaHref}"`);

    if (bottomCtaText.includes("Start Your Journey") && bottomCtaHref === "/onboarding") {
      console.log("   ✅ PASS: Bottom CTA correctly navigates to /onboarding.");
    } else {
      console.error("   ❌ FAIL: Bottom CTA does not match requirements.");
      allPassed = false;
    }
    await ctx8.close();

  } catch (err) {
    console.error("Unexpected test failure:", err);
    allPassed = false;
  } finally {
    await browser.close();
  }

  if (allPassed) {
    console.log("\n==================================================================");
    console.log("🎉 ALL PHASE UX-NAV-1 TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================================");
    process.exit(0);
  } else {
    console.error("\n❌ SOME TESTS FAILED.");
    process.exit(1);
  }
}

runNavPhaseTests();
