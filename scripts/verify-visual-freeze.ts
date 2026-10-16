import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUTPUT_DIR = "/Users/quantum/.gemini/antigravity-ide/brain/87d4e048-155c-4560-9d37-977250ecd68e/screenshots/phase_ux_nav_1";

async function captureVisualBaseline() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  try {
    // 1. Desktop Dark
    const ctxDark = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const pageDark = await ctxDark.newPage();
    await pageDark.goto(BASE_URL, { waitUntil: "networkidle" });
    await pageDark.waitForTimeout(1000);

    await pageDark.screenshot({ path: path.join(OUTPUT_DIR, "desktop_dark.png"), fullPage: false });
    const heroDark = pageDark.locator(".hero");
    await heroDark.screenshot({ path: path.join(OUTPUT_DIR, "hero_dark.png") });
    const navDark = pageDark.locator("header.nav");
    await navDark.screenshot({ path: path.join(OUTPUT_DIR, "nav_dark.png") });
    const eoraDark = pageDark.locator("#eoraOrb");
    await eoraDark.screenshot({ path: path.join(OUTPUT_DIR, "eora_dark.png") });
    await ctxDark.close();

    // 2. Mobile Dark
    const ctxMobDark = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const pageMobDark = await ctxMobDark.newPage();
    await pageMobDark.goto(BASE_URL, { waitUntil: "networkidle" });
    await pageMobDark.waitForTimeout(1000);
    await pageMobDark.screenshot({ path: path.join(OUTPUT_DIR, "mobile_dark.png"), fullPage: false });
    await ctxMobDark.close();

    // 3. Desktop Light
    const ctxLight = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const pageLight = await ctxLight.newPage();
    await pageLight.goto(BASE_URL, { waitUntil: "networkidle" });
    await pageLight.waitForTimeout(500);
    const lightRadio = pageLight.getByRole("radio", { name: "Light theme" }).first();
    await lightRadio.click();
    await pageLight.waitForTimeout(1000);

    await pageLight.screenshot({ path: path.join(OUTPUT_DIR, "desktop_light.png"), fullPage: false });
    const heroLight = pageLight.locator(".hero");
    await heroLight.screenshot({ path: path.join(OUTPUT_DIR, "hero_light.png") });
    const navLight = pageLight.locator("header.nav");
    await navLight.screenshot({ path: path.join(OUTPUT_DIR, "nav_light.png") });
    await ctxLight.close();

    // 4. Mobile Light
    const ctxMobLight = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const pageMobLight = await ctxMobLight.newPage();
    await pageMobLight.goto(BASE_URL, { waitUntil: "networkidle" });
    await pageMobLight.waitForTimeout(500);
    const burger = pageMobLight.locator("button.burger");
    await burger.click();
    await pageMobLight.waitForTimeout(500);
    const lightMobRadio = pageMobLight.locator("#mobileMenu").getByRole("radio", { name: "Light theme" }).first();
    await lightMobRadio.click();
    await pageMobLight.waitForTimeout(1000);
    await burger.click();
    await pageMobLight.waitForTimeout(500);
    await pageMobLight.screenshot({ path: path.join(OUTPUT_DIR, "mobile_light.png"), fullPage: false });
    await ctxMobLight.close();

    console.log("✅ All visual freeze screenshots captured successfully in:", OUTPUT_DIR);
  } finally {
    await browser.close();
  }
}

captureVisualBaseline().catch(console.error);
