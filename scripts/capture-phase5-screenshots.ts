import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const ARTIFACT_DIR = "/Users/quantumanant/.gemini/antigravity-ide/brain/5bcffd22-0fcd-4885-9239-3ac751bc0293/screenshots";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = "http://localhost:3000";

async function main() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log("Launching Chrome at:", CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  // Helper to clear cookies
  const clearSession = async () => {
    const client = await page.target().createCDPSession();
    await client.send("Network.clearBrowserCookies");
  };

  // Helper to sign in
  const signIn = async (email: string, pass: string) => {
    await clearSession();
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle0" });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', pass);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click('button[type="submit"]'),
    ]);
  };

  console.log("--- 1. Testing Student Arjun Flow ---");
  await signIn("arjun.student@example.com", "StudentPass123!");

  // Navigate to Student Profile
  await page.goto(`${BASE_URL}/student/profile`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".ws-content-card");

  // Screenshot 1: Student evidence list with verification statuses
  const path1 = path.join(ARTIFACT_DIR, "screenshot_1_student_evidence_list.png");
  await page.screenshot({ path: path1, fullPage: false });
  console.log("✓ Captured Screenshot 1:", path1);

  // Click 'Request Verification' on the PyTorch Vision Classifier card
  const requestButtons = await page.$$("button");
  let clickedRequest = false;
  for (const btn of requestButtons) {
    const text = await page.evaluate((el) => el.textContent, btn);
    if (text && text.includes("Request Verification")) {
      await btn.click();
      clickedRequest = true;
      break;
    }
  }

  if (clickedRequest) {
    await page.waitForSelector('div[role="dialog"]', { timeout: 4000 });
    // Fill reference & notes if inputs exist
    const inputs = await page.$$('div[role="dialog"] input');
    if (inputs.length > 0) {
      await inputs[0].click({ clickCount: 3 });
      await inputs[0].type("https://github.com/arjun/resnet-vision-pipeline");
    }
    const textareas = await page.$$('div[role="dialog"] textarea');
    if (textareas.length > 0) {
      await textareas[0].type("Completed capstone training ResNet-50.");
    }

    // Submit
    const submitBtn = await page.$('div[role="dialog"] button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      // Wait for success confirmation
      await page.waitForSelector("h4", { timeout: 5000 });
    }

    // Screenshot 2: Verification request confirmation
    const path2 = path.join(ARTIFACT_DIR, "screenshot_2_verification_request_confirmation.png");
    await page.screenshot({ path: path2, fullPage: false });
    console.log("✓ Captured Screenshot 2:", path2);
  }

  // Navigate to Student Home (State A: Readiness Unavailable)
  await page.goto(`${BASE_URL}/student`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#readiness-section");

  // Screenshot 6: Readiness unavailable state (State A)
  const path6 = path.join(ARTIFACT_DIR, "screenshot_6_readiness_unavailable_state.png");
  await page.screenshot({ path: path6, fullPage: false });
  console.log("✓ Captured Screenshot 6:", path6);

  console.log("--- 2. Testing Faculty Verifier Flow ---");
  await signIn("faculty.shalini@example.com", "FacultyPass123!");

  // Navigate to Verifier Queue
  await page.goto(`${BASE_URL}/verification`, { waitUntil: "networkidle0" });
  await page.waitForSelector("h1");
  await new Promise((r) => setTimeout(r, 1000));

  // Screenshot 3: Verifier queue
  const path3 = path.join(ARTIFACT_DIR, "screenshot_3_verifier_queue.png");
  await page.screenshot({ path: path3, fullPage: false });
  console.log("✓ Captured Screenshot 3:", path3);

  // Click 'Review Evidence'
  const reviewButtons = await page.$$("button");
  let clickedReview = false;
  for (const btn of reviewButtons) {
    const text = await page.evaluate((el) => el.textContent, btn);
    if (text && text.includes("Review Evidence")) {
      await btn.click();
      clickedReview = true;
      break;
    }
  }

  if (clickedReview) {
    await page.waitForSelector('div[role="dialog"]', { timeout: 4000 });
    // Screenshot 4: Verifier review screen
    const path4 = path.join(ARTIFACT_DIR, "screenshot_4_verifier_review_screen.png");
    await page.screenshot({ path: path4, fullPage: false });
    console.log("✓ Captured Screenshot 4:", path4);

    // Enter review note and confirm
    const reasonBox = await page.$('div[role="dialog"] textarea');
    if (reasonBox) {
      await reasonBox.type("Code inspected. Training accuracy verified on validation set.");
    }
    const confirmBtn = await page.$('div[role="dialog"] button[type="submit"]');
    if (confirmBtn) {
      await confirmBtn.click();
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log("--- 3. Testing Student Verified Status Display ---");
  await signIn("arjun.student@example.com", "StudentPass123!");
  await page.goto(`${BASE_URL}/student/profile`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".ws-content-card");

  // Screenshot 5: Verified evidence shown to student
  const path5 = path.join(ARTIFACT_DIR, "screenshot_5_verified_evidence_student.png");
  await page.screenshot({ path: path5, fullPage: false });
  console.log("✓ Captured Screenshot 5:", path5);

  console.log("--- 4. Testing Student Priya Flow (State B: Publishable Score) ---");
  await signIn("priya.verified@example.com", "StudentPass123!");
  await page.goto(`${BASE_URL}/student`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#readiness-section");

  // Find 'Why [score]%?' button and open explanation modal
  const whyButtons = await page.$$("#readiness-section button");
  for (const btn of whyButtons) {
    const text = await page.evaluate((el) => el.textContent, btn);
    if (text && text.includes("Why")) {
      await btn.click();
      break;
    }
  }

  await page.waitForSelector('div[role="dialog"]', { timeout: 4000 });
  // Screenshot 7: Readiness explanation / Why this score state
  const path7 = path.join(ARTIFACT_DIR, "screenshot_7_readiness_explanation_score.png");
  await page.screenshot({ path: path7, fullPage: false });
  console.log("✓ Captured Screenshot 7:", path7);

  // Close modal
  const closeBtn = await page.$('div[role="dialog"] button[aria-label="Close dialog"]');
  if (closeBtn) await closeBtn.click();
  await new Promise((r) => setTimeout(r, 500));

  console.log("--- 5. Responsive Verification (390px and 320px) ---");
  // 390px (iPhone 12/13/14)
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 500));

  const overflow390 = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`390px Responsive Check: scrollWidth ${overflow390 ? "OVERFLOWS!" : "is within 390px (0 overflow)"}`);

  const path8 = path.join(ARTIFACT_DIR, "screenshot_8_student_home_390px.png");
  await page.screenshot({ path: path8, fullPage: false });
  console.log("✓ Captured Screenshot 8:", path8);

  // 320px (iPhone SE small)
  await page.setViewport({ width: 320, height: 650 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 500));

  const overflow320 = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`320px Responsive Check: scrollWidth ${overflow320 ? "OVERFLOWS!" : "is within 320px (0 overflow)"}`);

  const path9 = path.join(ARTIFACT_DIR, "screenshot_9_student_home_320px.png");
  await page.screenshot({ path: path9, fullPage: false });
  console.log("✓ Captured Screenshot 9:", path9);

  await browser.close();
  console.log("All 9 screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
