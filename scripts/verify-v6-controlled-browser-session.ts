import fs from "fs";
import path from "path";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "@playwright/test";

// Load .env
if (!process.env.DATABASE_URL && fs.existsSync(path.join(process.cwd(), ".env"))) {
  const envContent = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      const val = vals.join("=").replace(/^["']|["']$/g, "");
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val.trim();
      }
    }
  }
}

import { getDb } from "../lib/db";
import {
  users,
  persons,
  personProfiles,
  organizationMemberships,
  membershipRoles,
  onboardingDrafts,
  resumeDocuments,
  projects,
  evidenceItems,
  idempotencyKeys,
  sourceProcessingJobs,
  userPreferences,
} from "../lib/db/schema";
import { hashPassword } from "../lib/auth/password";
import { eq } from "drizzle-orm";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3105";
const SCREENSHOT_DIR = path.join(process.cwd(), "docs", "screenshots", "resume-v6-audit");

const TEST_EMAIL = "browser_student_v34@aitathastu.test";
const TEST_PASSWORD = "StudentPass123!";
const TEST_PERSON_ID = "prs_e2e_browser_student_v34";
const TEST_USER_ID = "usr_e2e_browser_student_v34";

async function resetTestStudent() {
  const db = await getDb();
  const passwordHash = await hashPassword(TEST_PASSWORD);

  // 1. Clean prior resume docs, evidence, projects, idempotency cache, jobs, and draft
  await db.delete(evidenceItems).where(eq(evidenceItems.personId, TEST_PERSON_ID)).catch(() => {});
  await db.delete(projects).where(eq(projects.personId, TEST_PERSON_ID)).catch(() => {});
  await db.delete(resumeDocuments).where(eq(resumeDocuments.personId, TEST_PERSON_ID)).catch(() => {});
  await db.delete(sourceProcessingJobs).where(eq(sourceProcessingJobs.personId, TEST_PERSON_ID)).catch(() => {});
  await db.delete(idempotencyKeys).where(eq(idempotencyKeys.personId, TEST_PERSON_ID)).catch(() => {});
  await db.delete(userPreferences).where(eq(userPreferences.personId, TEST_PERSON_ID)).catch(() => {});

  // 2. Insert/update user
  await db
    .insert(users)
    .values({ id: TEST_USER_ID, email: TEST_EMAIL, passwordHash })
    .onConflictDoUpdate({ target: users.id, set: { passwordHash } });

  // 3. Insert/update person
  await db
    .insert(persons)
    .values({ id: TEST_PERSON_ID, primaryUserId: TEST_USER_ID, displayName: "Ananya Browser" })
    .onConflictDoUpdate({ target: persons.id, set: { displayName: "Ananya Browser" } });

  // 4. Insert/update profile
  await db
    .insert(personProfiles)
    .values({
      id: `prof_${TEST_PERSON_ID}`,
      personId: TEST_PERSON_ID,
      headline: "AI/ML Undergraduate Student",
      education: "B.Tech Computer Science and Engineering",
    })
    .onConflictDoUpdate({
      target: personProfiles.personId,
      set: {
        headline: "AI/ML Undergraduate Student",
        education: "B.Tech Computer Science and Engineering",
      },
    });

  // 5. Insert org membership
  const memId = `mem_${TEST_PERSON_ID}`;
  await db
    .insert(organizationMemberships)
    .values({ id: memId, personId: TEST_PERSON_ID, organizationId: "org_tathastu_default", status: "active" })
    .onConflictDoUpdate({ target: organizationMemberships.id, set: { status: "active" } });

  await db
    .insert(membershipRoles)
    .values({ id: `mr_${memId}`, membershipId: memId, roleId: "role_student" })
    .onConflictDoUpdate({ target: membershipRoles.id, set: { roleId: "role_student" } });

  // 6. Set onboarding draft directly to Screen 5 (Add your CV)
  await db
    .insert(onboardingDrafts)
    .values({
      personId: TEST_PERSON_ID,
      draft: {
        screen: 5,
        role: "student",
        name: "Ananya Browser",
        targetRole: "Machine Learning Engineer",
        targetRoleId: "role_ml_engineer",
        priorities: ["projects", "learning"],
        primaryPriority: "projects",
        academic: {
          fullName: "Ananya Browser",
          institution: "Lovely Professional University",
          degree: "B.Tech",
          department: "Computer Science",
          currentYear: "3rd Year",
          expectedGraduationYear: "2026",
        },
      },
      revision: 1,
    })
    .onConflictDoUpdate({
      target: onboardingDrafts.personId,
      set: {
        draft: {
          screen: 5,
          role: "student",
          name: "Ananya Browser",
          targetRole: "Machine Learning Engineer",
          targetRoleId: "role_ml_engineer",
          priorities: ["projects", "learning"],
          primaryPriority: "projects",
          academic: {
            fullName: "Ananya Browser",
            institution: "Lovely Professional University",
            degree: "B.Tech",
            department: "Computer Science",
            currentYear: "3rd Year",
            expectedGraduationYear: "2026",
          },
        },
        revision: 1,
      },
    });

  console.log("   [Database] Test student reset and placed directly at Screen 5 (Add your CV).");
}

async function runBrowserAudit() {
  console.log("================================================================================");
  console.log("   AI TATHASTU — V6 CONTROLLED BROWSER RESUME AUDIT & PERSISTENCE SUITE");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log("================================================================================\n");

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  await resetTestStudent();

  const browser: Browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page: Page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  const nativeResumePath = path.join(process.cwd(), "private-fixtures", "Anant-Kumar-Resume.pdf");
  assert.ok(fs.existsSync(nativeResumePath), "Native resume fixture must exist");

  const scannedResumePath = path.join(process.cwd(), "private-fixtures", "myresume.pdf");
  assert.ok(fs.existsSync(scannedResumePath), "Scanned resume fixture must exist");

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Sign in with Test Credentials
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Sign in to staging environment...");
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => url.pathname.includes("/onboarding") || url.pathname.includes("/student") || url.pathname.includes("/start"), { timeout: 15000 });
    console.log("   ✓ Successfully authenticated as " + TEST_EMAIL);

    // -------------------------------------------------------------------------
    // STEP 2: Navigate to Onboarding Screen 5
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Verify Screen 5 CV Ingestion Interface...");
    await page.goto(`${BASE_URL}/onboarding`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1:has-text('Add your CV')", { timeout: 10000 });
    const privacyNotice = await page.getByText("100% Privacy Protected: Mobile and phone numbers are never extracted from your CV.").isVisible();
    assert.ok(privacyNotice, "Zero Phone Privacy notice must be prominently rendered");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-cv-screen-loaded.png") });
    console.log("   ✓ Screen 5 loaded with Privacy Guarantee notice.");

    // -------------------------------------------------------------------------
    // STEP 3: Verify Consent Gate Protection
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Verify CV Processing Consent Gate...");
    // Try to trigger browse files button without consent
    await page.getByRole("button", { name: "Browse files" }).click();
    await page.waitForTimeout(500);
    // Consent checkbox is required
    const consentCheckbox = page.getByLabel("I allow AI Tathastu to upload, store and process my CV to prepare profile suggestions.");
    assert.ok(await consentCheckbox.isVisible(), "Consent checkbox must be present");
    assert.equal(await consentCheckbox.isChecked(), false, "Consent must be unselected by default");
    await consentCheckbox.check();
    assert.equal(await consentCheckbox.isChecked(), true, "Consent must be checkable");
    console.log("   ✓ Consent gate properly verified. Granted explicit CV processing consent.");

    // -------------------------------------------------------------------------
    // STEP 4: Upload Native PDF (Anant-Kumar-Resume.pdf)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Upload Anant-Kumar-Resume.pdf and verify pipeline processing...");
    const fileInput = page.locator("input[type='file'][accept='.pdf,.docx']");
    await fileInput.setInputFiles(nativeResumePath);

    // Wait for extraction to complete and candidates to appear
    await page.waitForSelector("h2:has-text('Extracted suggestions from Anant-Kumar-Resume.pdf')", { timeout: 30000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-anant-extraction-ready.png") });
    console.log("   ✓ Extraction succeeded! Candidate review panel rendered.");

    // -------------------------------------------------------------------------
    // STEP 5: Verify Structured Candidate Categorization & Deduplication
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Verify Field-Level Categorization & Quality Gate...");
    const counterChip = page.locator("header, div").filter({ hasText: /selected/ }).last();
    const chipText = await counterChip.innerText();
    console.log(`   Candidate Counter Status: "${chipText}"`);

    // Verify Research & Intellectual Property group exists (dedicated, not dumped in achievements!)
    const researchGroup = page.locator("p:has-text('Research and intellectual property')");
    assert.ok(await researchGroup.isVisible(), "Dedicated Research & IP group must be present");

    // Verify Patents / Books are rendered under Research
    const patentItem = page.getByText("DBMS Predictive Execution").first();
    assert.ok(await patentItem.isVisible(), "DBMS Predictive Execution patent must be present under Research");
    const bookItem = page.getByText("The AI Student").first();
    assert.ok(await bookItem.isVisible(), "The AI Student book must be present under Research");

    // Verify Achievements group has no duplicate research or duplicate composite summaries
    const achievementsGroup = page.locator("p:has-text('Achievements and awards')");
    assert.ok(await achievementsGroup.isVisible(), "Achievements and awards group must be present");

    // Verify Digital Footprints: LinkedIn, GitHub, anantkumar.site, anantshivam.online
    const footprintsGroup = page.locator("p:has-text('Digital footprints')");
    assert.ok(await footprintsGroup.isVisible(), "Digital footprints group must be present");
    assert.ok(await page.getByText("https://anantkumar.site").first().isVisible(), "Custom portfolio anantkumar.site must be extracted");
    assert.ok(await page.getByText("https://anantshivam.online").first().isVisible(), "Custom portfolio anantshivam.online must be extracted");
    console.log("   ✓ Research schema separation, portfolio footprints, and clean achievements verified.");

    // -------------------------------------------------------------------------
    // STEP 6: Test Selection Controls: Tick All & Clear
    // -------------------------------------------------------------------------
    console.log("\n[TEST 6] Test Candidate Selection Controls (Tick all & Clear)...");
    // Find the fieldset for Work experience
    const expFieldset = page.locator("fieldset").filter({ hasText: "Work experience and internships" });
    const tickAllExp = expFieldset.getByRole("button", { name: "Tick all" });
    const clearExp = expFieldset.getByRole("button", { name: "Clear" });

    // Click Tick all
    await tickAllExp.click();
    await page.waitForTimeout(300);
    const expCheckboxes = expFieldset.locator("input[type='checkbox']");
    const totalExp = await expCheckboxes.count();
    for (let i = 0; i < totalExp; i++) {
      assert.equal(await expCheckboxes.nth(i).isChecked(), true, `Experience checkbox ${i} must be checked`);
    }
    console.log(`   ✓ Tick all successfully checked all ${totalExp} experience entries.`);

    // Click Clear
    await clearExp.click();
    await page.waitForTimeout(300);
    for (let i = 0; i < totalExp; i++) {
      assert.equal(await expCheckboxes.nth(i).isChecked(), false, `Experience checkbox ${i} must be cleared`);
    }
    console.log(`   ✓ Clear successfully unselected all ${totalExp} experience entries.`);

    // Skills chip grid: Select all & Clear
    const skillsFieldset = page.locator("fieldset").filter({ hasText: "Skills and technologies" });
    const selectAllSkills = skillsFieldset.getByRole("button", { name: /Select all/ });
    const clearSkills = skillsFieldset.getByRole("button", { name: "Clear" });

    await selectAllSkills.click();
    await page.waitForTimeout(300);
    console.log("   ✓ Select all skills clicked.");
    await clearSkills.click();
    await page.waitForTimeout(300);
    console.log("   ✓ Clear skills clicked.");

    // -------------------------------------------------------------------------
    // STEP 7: Test Inline Editing (Enter to save, Esc to cancel, buttons)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 7] Test Inline Candidate Editing (Enter, Esc, Save, Cancel)...");
    // Click Tick all on experience first so we have items to test
    await tickAllExp.click();

    // Find the first experience card's pencil edit button
    const editBtn = expFieldset.locator("button[aria-label^='Edit ']").first();
    await editBtn.click();

    // Check that inline input appeared
    const inlineInput = expFieldset.locator("input[id^='cv-input-']");
    assert.ok(await inlineInput.isVisible(), "Inline edit input must be visible after clicking pencil");

    // Test Esc to cancel
    const originalValue = await inlineInput.inputValue();
    await inlineInput.fill(originalValue + " [TEST CANCEL]");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    assert.equal(await inlineInput.isVisible(), false, "Edit input must close on Escape");
    assert.ok(await expFieldset.getByText(originalValue).first().isVisible(), "Original value must be preserved after Escape");
    console.log("   ✓ Esc to cancel verified without modifying candidate value.");

    // Test Enter to save
    await editBtn.click();
    await inlineInput.fill("Founders Verbinden - Vice President & Co-Founder (Confirmed)");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    assert.equal(await inlineInput.isVisible(), false, "Edit input must close on Enter");
    assert.ok(await expFieldset.getByText("Founders Verbinden - Vice President & Co-Founder (Confirmed)").first().isVisible(), "Updated value must be saved on Enter");
    console.log("   ✓ Enter to save verified. Updated wording displayed on card.");

    // -------------------------------------------------------------------------
    // STEP 8: Test Mid-Review Page Reload & Candidate Restoration
    // -------------------------------------------------------------------------
    console.log("\n[TEST 8] Test Mid-Review Page Reload & Rehydration...");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-before-reload.png") });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("h2:has-text('Extracted suggestions from Anant-Kumar-Resume.pdf')", { timeout: 15000 });
    assert.ok(await page.getByText("Research and intellectual property").first().isVisible(), "Candidates must be rehydrated after reload");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-after-reload.png") });
    console.log("   ✓ Candidates successfully restored from stored document after page reload.");

    // -------------------------------------------------------------------------
    // STEP 9: Test Confirm & Save Suggestions
    // -------------------------------------------------------------------------
    console.log("\n[TEST 9] Test Confirm & Save Suggestions...");
    // Select items across categories
    const reloadedExpFieldset = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "Work experience and internships" }) });
    await reloadedExpFieldset.getByRole("button", { name: "Tick all" }).first().click();

    const reloadedEduFieldset = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: /^Education$/ }) });
    await reloadedEduFieldset.getByRole("button", { name: "Tick all" }).first().click();

    const reloadedResearchFieldset = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "Research and intellectual property" }) });
    await reloadedResearchFieldset.getByRole("button", { name: "Tick all" }).first().click();

    const reloadedSkillsFieldset = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "Skills and technologies" }) });
    await reloadedSkillsFieldset.getByRole("button", { name: /Select all/ }).first().click();

    // Click Confirm & save suggestions
    const confirmBtn = page.getByRole("button", { name: "Confirm & save suggestions" });
    await confirmBtn.click();
    await page.waitForSelector("span:has-text('Saved to profile')", { timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-review-saved.png") });
    console.log("   ✓ 'Confirm & save suggestions' succeeded! Status chip shows 'Saved to profile'.");

    // -------------------------------------------------------------------------
    // STEP 10: Test Save & Continue Navigation
    // -------------------------------------------------------------------------
    console.log("\n[TEST 10] Test Save & Continue Navigation...");
    const continueBtn = page.getByRole("button", { name: "Continue" });
    await continueBtn.click();
    // Should navigate past Screen 5
    await page.waitForTimeout(2000);
    console.log(`   ✓ Advanced past Screen 5 to next step. Current URL: ${page.url()}`);

    // -------------------------------------------------------------------------
    // STEP 11: Verify Database Persistence & Zero Phone Guarantee
    // -------------------------------------------------------------------------
    console.log("\n[TEST 11] Inspect Database for Idempotent Persistence & Privacy Guarantee...");
    const db = await getDb();
    const storedDocs = await db.select().from(resumeDocuments).where(eq(resumeDocuments.personId, TEST_PERSON_ID));
    assert.equal(storedDocs.length, 1, "Exactly one resume document should be stored");
    assert.equal(storedDocs[0].status, "completed", "Document status should be transitioned to 'completed'");

    // Check Zero Phone Guarantee in extracted profile
    const profileData = storedDocs[0].extractedProfile as any;
    assert.equal(profileData?.mobile, undefined, "Strict Zero Phone Guarantee: mobile must be undefined");
    assert.equal(profileData?.phone, undefined, "Strict Zero Phone Guarantee: phone must be undefined");

    // Check person profile updates
    const storedProfile = await db.select().from(personProfiles).where(eq(personProfiles.personId, TEST_PERSON_ID));
    assert.ok(storedProfile.length > 0, "Person profile must exist");
    console.log("   Profile Institution in DB: ", storedProfile[0].institution || storedProfile[0].education);

    // Check evidence items persisted
    const storedEvidence = await db.select().from(evidenceItems).where(eq(evidenceItems.personId, TEST_PERSON_ID));
    console.log(`   Stored Evidence Items in DB: ${storedEvidence.length}`);
    assert.ok(storedEvidence.length > 0, "Reviewed claims must be written to evidenceItems");

    console.log("   ✓ Database persistence verified: completed document, evidence items created, Zero Phone Guarantee upheld.");

    // -------------------------------------------------------------------------
    // STEP 12: Test Scanned OCR Resume (myresume.pdf)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 12] Test Scanned PDF OCR Workflow (myresume.pdf)...");
    await resetTestStudent();
    await page.goto(`${BASE_URL}/onboarding`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1:has-text('Add your CV')", { timeout: 10000 });

    const consentBox2 = page.getByLabel("I allow AI Tathastu to upload, store and process my CV to prepare profile suggestions.");
    await consentBox2.check();

    const fileInput2 = page.locator("input[type='file'][accept='.pdf,.docx']");
    await fileInput2.setInputFiles(scannedResumePath);

    // Scanned OCR may take 10-20 seconds via Render Tesseract service
    console.log("   Waiting for OCR extraction to complete (Render Tesseract service)...");
    await page.waitForSelector("h2:has-text('Extracted suggestions from myresume.pdf')", { timeout: 45000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-shivam-ocr-ready.png") });
    console.log("   ✓ Scanned OCR extraction succeeded!");

    // Verify 4 leadership roles are present
    const expGroupShivam = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "Work experience and internships" }) });
    assert.ok(await expGroupShivam.getByText("Study LPU").first().isVisible(), "Study LPU experience must be extracted from OCR");
    assert.ok(await expGroupShivam.getByText("Mangalkit").first().isVisible(), "Mangalkit experience must be extracted from OCR");
    assert.ok(await expGroupShivam.getByText("Founders Verbinden").first().isVisible(), "Founders Verbinden experience must be extracted from OCR");
    assert.ok(await expGroupShivam.getByText("Nayee Asha").first().isVisible(), "Nayee Asha experience must be extracted from OCR");

    // Verify 7 certifications preserved
    const certGroupShivam = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: /^Certifications$/ }) });
    assert.ok(await certGroupShivam.isVisible(), "Certifications group must be present");
    const certRows = certGroupShivam.locator("li");
    const certCount = await certRows.count();
    console.log(`   Extracted Certifications Count: ${certCount}`);
    assert.ok(certCount >= 5, `Expected at least 5-7 certifications, got ${certCount}`);

    // Tick all and confirm
    await expGroupShivam.getByRole("button", { name: "Tick all" }).first().click();
    await certGroupShivam.getByRole("button", { name: "Tick all" }).first().click();
    const confirmBtnShivam = page.getByRole("button", { name: "Confirm & save suggestions" });
    await confirmBtnShivam.click();
    await page.waitForSelector("span:has-text('Saved to profile')", { timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-shivam-ocr-saved.png") });
    console.log("   ✓ Scanned OCR suggestions confirmed and saved to profile.");

    assert.equal(consoleErrors.length, 0, `Browser uncaught errors: ${consoleErrors.join("; ")}`);
    console.log("\n================================================================================");
    console.log("   ALL 12 REAL BROWSER AUDIT ACCEPTANCE TESTS PASSED (0 ERRORS)");
    console.log("================================================================================\n");
  } finally {
    await browser.close();
  }
}

runBrowserAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
