import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

async function runRegressionTests() {
  console.log("=== THEME REGRESSION TEST SUITE ===");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  let allPassed = true;

  try {
    // 1. Clean browser profile starts in DARK MODE
    console.log("\n[Test 1] Clean browser profile default theme...");
    const ctx1 = await browser.newContext(); // fresh profile, no storage
    const page1 = await ctx1.newPage();
    const errors1: string[] = [];
    page1.on("pageerror", (e) => errors1.push(e.message));

    await page1.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const themeDefault = await page1.evaluate(() => document.documentElement.dataset.theme);
    const htmlThemeAttr = await page1.evaluate(() => document.documentElement.getAttribute("data-theme"));
    const stored1 = await page1.evaluate(() => localStorage.getItem("tathastu-theme"));

    console.log(`   Initial dataset.theme: "${themeDefault}", html data-theme: "${htmlThemeAttr}", stored: ${stored1}`);
    if (themeDefault === "dark" && errors1.length === 0) {
      console.log("   ✅ PASS: Clean browser profile defaults to DARK mode.");
    } else {
      console.error(`   ❌ FAIL: Expected "dark", got "${themeDefault}". Errors: ${errors1.join(", ")}`);
      allPassed = false;
    }
    await ctx1.close();

    // 2. System light-mode preference does NOT override dark default
    console.log("\n[Test 2] System prefers-color-scheme: light does not override dark default...");
    const ctx2 = await browser.newContext({ colorScheme: "light" });
    const page2 = await ctx2.newPage();
    await page2.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const themeWithLightSystem = await page2.evaluate(() => document.documentElement.dataset.theme);
    console.log(`   dataset.theme with system light: "${themeWithLightSystem}"`);
    if (themeWithLightSystem === "dark") {
      console.log("   ✅ PASS: System light preference does NOT override dark default.");
    } else {
      console.error(`   ❌ FAIL: Expected "dark", got "${themeWithLightSystem}"`);
      allPassed = false;
    }
    await ctx2.close();

    // 3. Manual theme toggle to Light works and sets localStorage
    console.log("\n[Test 3] Manual theme switching to Light...");
    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();
    await page3.goto(BASE_URL, { waitUntil: "networkidle" });

    const lightRadio = page3.getByRole("radio", { name: "Light theme" }).first();
    await lightRadio.click();
    await page3.waitForTimeout(300);

    const themeAfterSwitch = await page3.evaluate(() => document.documentElement.dataset.theme);
    const storedAfterSwitch = await page3.evaluate(() => localStorage.getItem("tathastu-theme"));
    console.log(`   After toggle: theme="${themeAfterSwitch}", stored="${storedAfterSwitch}"`);

    if (themeAfterSwitch === "light" && storedAfterSwitch === "light") {
      console.log("   ✅ PASS: Manual toggle switches to Light and updates localStorage.");
    } else {
      console.error(`   ❌ FAIL: Expected "light", got theme="${themeAfterSwitch}", stored="${storedAfterSwitch}"`);
      allPassed = false;
    }

    // 4. Saved light preference survives page reload without flash
    console.log("\n[Test 4] Saved light preference persists across page reload...");
    await page3.reload({ waitUntil: "networkidle" });
    const themeAfterReload = await page3.evaluate(() => document.documentElement.dataset.theme);
    console.log(`   After reload: theme="${themeAfterReload}"`);

    if (themeAfterReload === "light") {
      console.log("   ✅ PASS: Light mode persists across page reload.");
    } else {
      console.error(`   ❌ FAIL: Expected "light", got "${themeAfterReload}"`);
      allPassed = false;
    }

    // 5. Switching back to Dark works and persists
    console.log("\n[Test 5] Manual switch back to Dark mode...");
    const darkRadio = page3.locator(".nav-actions button[aria-label='Dark theme']").first();
    await darkRadio.click();
    await page3.waitForTimeout(500);

    const themeAfterBackToDark = await page3.evaluate(() => document.documentElement.dataset.theme);
    const storedAfterBackToDark = await page3.evaluate(() => localStorage.getItem("tathastu-theme"));
    console.log(`   After toggle back: theme="${themeAfterBackToDark}", stored="${storedAfterBackToDark}"`);

    if (themeAfterBackToDark === "dark" && storedAfterBackToDark === "dark") {
      console.log("   ✅ PASS: Switch back to Dark mode succeeds and persists.");
    } else {
      console.error(`   ❌ FAIL: Expected "dark", got "${themeAfterBackToDark}"`);
      allPassed = false;
    }

    await page3.reload({ waitUntil: "networkidle" });
    const themeAfterDarkReload = await page3.evaluate(() => document.documentElement.dataset.theme);
    if (themeAfterDarkReload === "dark") {
      console.log("   ✅ PASS: Dark mode persists across reload.");
    } else {
      console.error(`   ❌ FAIL: Expected "dark", got "${themeAfterDarkReload}"`);
      allPassed = false;
    }
    await ctx3.close();

    // 6. Check console errors and hydration mismatches
    console.log("\n[Test 6] Console error and hydration mismatch verification...");
    const ctx4 = await browser.newContext();
    const page4 = await ctx4.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page4.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page4.on("pageerror", (err) => pageErrors.push(err.message));

    await page4.goto(BASE_URL, { waitUntil: "networkidle" });
    const hydrationErrors = consoleErrors.filter((e) => e.toLowerCase().includes("hydration"));
    console.log(`   Console errors: ${consoleErrors.length}, Hydration errors: ${hydrationErrors.length}, Page errors: ${pageErrors.length}`);
    if (hydrationErrors.length === 0 && pageErrors.length === 0) {
      console.log("   ✅ PASS: No hydration mismatches or unhandled page errors.");
    } else {
      console.error(`   ❌ Hydration/Page errors found:`, { hydrationErrors, pageErrors });
      allPassed = false;
    }
    await ctx4.close();
  } finally {
    await browser.close();
  }

  if (allPassed) {
    console.log("\n🎉 ALL THEME REGRESSION TESTS PASSED!");
  } else {
    console.error("\n❌ SOME TESTS FAILED.");
    process.exit(1);
  }
}

runRegressionTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
