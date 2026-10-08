import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUTPUT_DIR = path.join(process.cwd(), "screenshots");

async function runQA() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Launching Chrome at:", CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();

  // 1. Landing — Top Viewport (1440x900)
  console.log("Capturing 1. Landing — Top Viewport...");
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "1-landing-top-viewport.png") });

  // 2. Landing — Full Page Scroll
  console.log("Capturing 2. Landing — Full Page...");
  await page.screenshot({ path: path.join(OUTPUT_DIR, "2-landing-full-page.png"), fullPage: true });

  // 3. Onboarding — Welcome (Screen 2 / Onboarding)
  console.log("Capturing 3. Onboarding — Welcome...");
  await page.goto("http://localhost:3000/screens?screen=2", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "3-onboarding-welcome.png") });

  // 4. Onboarding — Profile Review (Screen 8)
  console.log("Capturing 4. Onboarding — Profile Review...");
  await page.goto("http://localhost:3000/screens?screen=8", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "4-onboarding-review.png") });

  // 5. Dashboard — Top Viewport (Screen 12)
  console.log("Capturing 5. Dashboard — Top Viewport...");
  await page.goto("http://localhost:3000/screens?screen=12", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "5-dashboard-top-viewport.png") });

  // 6. Dashboard — Full Page Long Scroll
  console.log("Capturing 6. Dashboard — Full Page...");
  await page.screenshot({ path: path.join(OUTPUT_DIR, "6-dashboard-full-page.png"), fullPage: true });

  // 7. Dashboard — Middle Sections (Scroll to #growth)
  console.log("Capturing 7. Dashboard — Middle Sections...");
  await page.goto("http://localhost:3000/screens?screen=12#growth", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "7-dashboard-middle-sections.png") });

  // 8. Dashboard — Final Actions (Scroll to #actions)
  console.log("Capturing 8. Dashboard — Final Actions...");
  await page.goto("http://localhost:3000/screens?screen=12#actions", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "8-dashboard-final-actions.png") });

  // 9. Mobile Landing (390x844)
  console.log("Capturing 9. Mobile Landing...");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "9-mobile-landing.png") });

  // 10. Mobile Dashboard (390x844)
  console.log("Capturing 10. Mobile Dashboard...");
  await page.goto("http://localhost:3000/screens?screen=12", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "10-mobile-dashboard.png") });

  await browser.close();
  console.log("All 10 QA screenshots captured successfully in:", OUTPUT_DIR);
}

runQA().catch((err) => {
  console.error("QA automation failed:", err);
  process.exit(1);
});
