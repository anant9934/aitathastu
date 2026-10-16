/**
 * Task 2.1.2 end-to-end: upload a complete CV on onboarding Screen 5, accept
 * what was found, and check the onboarding draft is pre-filled. One real CV
 * extraction (structuring may use one LLM call). Needs the test-database dev
 * server (scripts/visual-phase2-progress.ts).
 *
 *   node --import tsx scripts/visual-phase2-cv-prefill.ts <outDir>
 */
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

async function main() {
  const { setupTestDatabase } = await import("./lib/test-db");
  await setupTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { writeOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
  const email = `p2-cv-${Date.now()}@test.invalid`;
  const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Kavya Raman" });
  await writeOnboardingDraft(personId, { role: "student", targetRole: "Machine Learning Engineer", priorities: ["jobs"], primaryPriority: "jobs", currentScreen: 5 });

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
  await page.goto(`${BASE}/onboarding`);
  const file = page.locator('input[type="file"]');
  await file.waitFor({ state: "attached", timeout: 90_000 });
  // Consent to CV processing is required before any upload (shown as an inline error otherwise).
  await page.getByRole("checkbox", { name: /agree to have this resume parsed/i }).check();
  const started = Date.now();
  await file.setInputFiles(path.join("scripts", "fixtures", "complete_student_cv.pdf"));
  const save = page.getByRole("button", { name: /Save accepted details/ });
  await save.waitFor({ timeout: 180_000 });
  const extractMs = Date.now() - started;
  await page.screenshot({ path: path.join(out, "p2-cv-review-1280.png"), fullPage: true });
  for (const btn of await page.getByRole("button", { name: /^Accept all/ }).all()) {
    if (await btn.isVisible() && await btn.isEnabled()) await btn.click();
  }
  await save.click();
  await page.waitForTimeout(3000);
  const d = (await readOnboardingDraft(personId))!;
  console.log(JSON.stringify({
    extractMs,
    pageErrors: errors,
    draft: {
      name: d.name, institution: d.institution, degree: d.degree, expectedGraduationYear: d.expectedGraduationYear,
      github: d.profiles.github ?? null, linkedin: d.profiles.linkedin ?? null,
      skills: d.skills, projects: d.projects.map((p) => `${p.title} (${p.status})`),
      education: (d.education ?? []).map((e) => `${e.institution} | ${e.degree ?? ""} | ${e.status}`),
      experiences: (d.experiences ?? []).map((e) => `${e.role} @ ${e.company} (${e.status})`),
      screenAfterSave: d.currentScreen,
    },
  }, null, 2));
  await browser.close();
  const { closeDbForTesting } = await import("../lib/db");
  await closeDbForTesting();
}
main().catch((e) => { console.error(e); process.exit(1); });
