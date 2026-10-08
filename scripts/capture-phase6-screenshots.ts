import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const ARTIFACT_DIR = "/Users/quantumanant/.gemini/antigravity-ide/brain/5bcffd22-0fcd-4885-9239-3ac751bc0293/screenshots_phase6";
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

  console.log("Signing in as Arjun Verma (arjun.student@example.com)...");
  await signIn("arjun.student@example.com", "StudentPass123!");

  // 1. Student Assessments page (1280px)
  console.log("Capturing 1. Student Assessments page...");
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/student/assessments`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".ws-content-card", { timeout: 8000 });
  const path1 = path.join(ARTIFACT_DIR, "screenshot_1_student_assessments_desktop.png");
  await page.screenshot({ path: path1 });
  console.log("✓ Saved:", path1);

  // 2. ERIS assessment details
  console.log("Capturing 2. ERIS assessment details...");
  const assessmentCard = await page.$(".ws-content-card");
  if (assessmentCard) {
    const path2 = path.join(ARTIFACT_DIR, "screenshot_2_eris_assessment_details.png");
    await assessmentCard.screenshot({ path: path2 });
    console.log("✓ Saved:", path2);
  }

  // 3. Evidence created from ERIS (Student Profile / Person 360)
  console.log("Capturing 3. Evidence created from ERIS on Profile...");
  await page.goto(`${BASE_URL}/student/profile`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".ws-content-card", { timeout: 8000 });
  const path3 = path.join(ARTIFACT_DIR, "screenshot_3_evidence_created_from_eris.png");
  await page.screenshot({ path: path3 });
  console.log("✓ Saved:", path3);

  // 4. Student Interviews page (1280px)
  console.log("Capturing 4. Student Interviews page...");
  await page.goto(`${BASE_URL}/student/interviews`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".ws-content-card", { timeout: 8000 });
  const path4 = path.join(ARTIFACT_DIR, "screenshot_4_student_interviews_desktop.png");
  await page.screenshot({ path: path4 });
  console.log("✓ Saved:", path4);

  // 5. AI Interview detail
  console.log("Capturing 5. AI Interview detail card...");
  const interviewCard = await page.$(".ws-content-card");
  if (interviewCard) {
    const path5 = path.join(ARTIFACT_DIR, "screenshot_5_ai_interview_detail.png");
    await interviewCard.screenshot({ path: path5 });
    console.log("✓ Saved:", path5);
  }

  // 6. Updated Student Home
  console.log("Capturing 6. Updated Student Home...");
  await page.goto(`${BASE_URL}/student`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".student-home-container, .workspace-hero-banner", { timeout: 8000 });
  const path6 = path.join(ARTIFACT_DIR, "screenshot_6_updated_student_home.png");
  await page.screenshot({ path: path6 });
  console.log("✓ Saved:", path6);

  // 7. Updated readiness explanation
  console.log("Capturing 7. Updated readiness explanation...");
  // Find readiness breakdown card on student home
  const path7 = path.join(ARTIFACT_DIR, "screenshot_7_updated_readiness_explanation.png");
  const readinessElement = await page.$(".ws-panel-readiness, .ws-hero-card, .ws-content-card");
  if (readinessElement) {
    await readinessElement.screenshot({ path: path7 });
  } else {
    await page.screenshot({ path: path7 });
  }
  console.log("✓ Saved:", path7);

  // 8. 390px Student Assessments
  console.log("Capturing 8. 390px Student Assessments...");
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(`${BASE_URL}/student/assessments`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".ws-content-card", { timeout: 8000 });
  const path8 = path.join(ARTIFACT_DIR, "screenshot_8_student_assessments_390px.png");
  await page.screenshot({ path: path8 });
  console.log("✓ Saved:", path8);

  // 9. 320px Student Home
  console.log("Capturing 9. 320px Student Home...");
  await page.setViewport({ width: 320, height: 700, isMobile: true });
  await page.goto(`${BASE_URL}/student`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".student-home-container, .workspace-hero-banner", { timeout: 8000 });
  const path9 = path.join(ARTIFACT_DIR, "screenshot_9_student_home_320px.png");
  await page.screenshot({ path: path9 });
  console.log("✓ Saved:", path9);

  await browser.close();
  console.log("All 9 Phase 6 screenshots successfully captured!");
}

main().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
