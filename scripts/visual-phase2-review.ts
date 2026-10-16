/**
 * Browser check for Task 2.1.4: field-level inline review on Screen 8.
 * Seeds a student on Screen 8 with entries from CV, LinkedIn and GitHub,
 * drives every action through the real UI, reads the draft back from the
 * DB, then simulates a late scraper re-sending the originals and reloads.
 * Needs the test-database dev server described in scripts/visual-phase2-progress.ts.
 *
 *   node --import tsx scripts/visual-phase2-review.ts <outDir>
 */
import path from "path";
import { chromium, type Page } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

const EDU = { institution: "IIT D", degree: "B.Tech", fieldOfStudy: "Computer Science", graduationYear: "2027", status: "candidate", source: "resume" };
const EXP = { company: "Globex", role: "Data Intern", startDate: "2025-05", endDate: "2025-07", status: "candidate", source: "linkedin" };
const PROJ = { id: "gh_rag", title: "rag-notes", description: "Retrieval over lecture notes", technologies: ["Python", "FAISS"], sources: ["github"], status: "candidate", contribution: [], contributionNote: "", url: "https://github.com/asha/rag-notes" };
const CANDS = [{ name: "torch", source: "github" }, { name: "jquery", source: "github" }, { name: "Docker", source: "github" }];

async function main() {
  const { useTestDatabase } = await import("./lib/test-db");
  await useTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { writeOnboardingDraft, mutateOnboardingDraft, readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");

  const results: Record<string, unknown> = {};
  const browser = await chromium.launch();
  try {
    for (const [name, viewport] of [["1280", { width: 1280, height: 900 }], ["375", { width: 375, height: 812 }]] as const) {
      const email = `p2-review-${name}-${Date.now()}@test.invalid`;
      const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Asha Rao" });
      await writeOnboardingDraft(personId, {
        name: "Asha Rao", role: "student", targetRole: "Machine Learning Engineer", currentScreen: 8, institution: "IIT D", degree: "B.Tech",
        skills: ["Python"], profiles: { github: "https://github.com/asha", linkedin: "https://www.linkedin.com/in/asha-rao" },
        discoveredResumeProfiles: { github: "https://github.com/asha" },
      });
      await mutateOnboardingDraft(personId, { education: [EDU], experiences: [EXP], projects: [PROJ], techCandidates: CANDS }, { origin: "system" });

      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
      if (!res.ok()) throw new Error(`sign-in ${res.status()}`);
      await page.goto(`${BASE}/onboarding`);
      await page.getByRole("button", { name: /^Education/ }).first().waitFor({ timeout: 60_000 });
      const settle = () => page.waitForTimeout(900);
      const tab = async (label: string) => { await page.getByRole("button", { name: new RegExp(`^${label}`) }).first().click(); };
      const r: Record<string, unknown> = { pageErrors: errors };

      // Personal: validation error, then a valid edit.
      await page.getByRole("button", { name: "Edit Graduation year" }).click();
      await page.getByLabel("Graduation year").fill("27");
      await page.getByRole("button", { name: "Save" }).click();
      r.gradYearError = await page.getByRole("alert").filter({ hasText: "four-digit" }).isVisible();
      await page.getByLabel("Graduation year").fill("2027");
      await page.getByRole("button", { name: "Save" }).click();
      await settle();

      // Education: edit the institution in place.
      await tab("Education");
      await page.getByRole("button", { name: /^Edit B\.Tech in Computer Science/ }).click();
      if (name === "1280") await page.screenshot({ path: path.join(out, `p2-review-edit-${name}.png`) });
      await page.getByLabel("Institution").fill("IIT Delhi");
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByRole("button", { name: /^Accept/ }).first().click();
      await settle();
      // Programmatic scrolls (Playwright reaching a field) can shift an overflow-hidden wrapper; record it, then reset for the capture.
      r.wrapperScrollLeftBeforeCapture = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll("*")].map((el) => el.scrollLeft)));
      await page.evaluate(() => document.querySelectorAll("*").forEach((el) => { if (el.scrollLeft) el.scrollLeft = 0; }));
      await page.getByRole("button", { name: /^Edit B\.Tech in Computer Science/ }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `p2-review-education-${name}.png`), fullPage: false });

      // Experience: reject, undo, reject again.
      await tab("Experience");
      await page.getByRole("button", { name: "Reject Data Intern" }).click();
      r.undoShown = await page.getByText(/Rejected .Data Intern./).isVisible();
      await page.getByRole("button", { name: "Undo" }).click();
      r.undoRestored = await page.getByRole("button", { name: "Reject Data Intern" }).isVisible();
      await page.getByRole("button", { name: "Reject Data Intern" }).click();
      await settle();

      // Projects: add one by hand; required-field validation first.
      await tab("Projects");
      await page.getByRole("button", { name: "Add project" }).click();
      await page.getByRole("button", { name: "Save" }).click();
      r.projectRequiredError = await page.getByRole("alert").filter({ hasText: "project name" }).isVisible();
      await page.getByLabel("Project name").fill("Kannada OCR");
      await page.getByLabel("Tech stack").fill("PyTorch, OpenCV");
      await page.getByRole("button", { name: "Save" }).click();
      await settle();

      // Skills: rename a suggestion, reject one, accept one.
      await tab("Skills");
      await page.getByRole("button", { name: "Rename torch" }).click();
      await page.getByLabel("Skill name").fill("PyTorch");
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByRole("button", { name: "Reject jquery" }).click();
      await page.getByRole("button", { name: "Accept Docker" }).click();
      await settle();

      // Links: wrong site is caught, then fixed; LinkedIn removed.
      await tab("Links");
      await page.getByRole("button", { name: "Edit GitHub link" }).click();
      await page.getByLabel("GitHub link").fill("https://gitlab.com/asha");
      await page.getByRole("button", { name: "Save" }).click();
      r.wrongSiteError = await page.getByRole("alert").filter({ hasText: "isn't a GitHub address" }).isVisible();
      await page.getByLabel("GitHub link").fill("github.com/asha-rao");
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByRole("button", { name: "Remove LinkedIn link" }).click();
      await settle();
      await page.screenshot({ path: path.join(out, `p2-review-links-${name}.png`) });
      r.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

      const saved = (await readOnboardingDraft(personId))!;
      r.savedAfterEdits = {
        expectedGraduationYear: saved.expectedGraduationYear,
        education: saved.education?.map((e) => ({ institution: e.institution, status: e.status, originKey: e.originKey, editedFields: e.editedFields })),
        experiences: saved.experiences?.map((e) => ({ role: e.role, status: e.status })),
        projects: saved.projects.map((p) => ({ title: p.title, status: p.status, sources: p.sources })),
        skills: saved.skills,
        techCandidates: saved.techCandidates?.map((c) => `${c.name}:${c.status ?? "candidate"}`),
        profiles: saved.profiles,
      };

      // A late scraper re-sends the originals; nothing the student changed may come back.
      await mutateOnboardingDraft(personId, { education: [EDU], experiences: [EXP], techCandidates: CANDS }, { origin: "system" });
      await page.reload();
      await page.getByRole("button", { name: /^Education/ }).first().waitFor({ timeout: 60_000 });
      await tab("Education");
      const eduText = await page.locator(".rel-list").first().innerText();
      await tab("Experience");
      const expVisible = await page.getByRole("button", { name: "Reject Data Intern" }).count();
      await tab("Skills");
      const skillsText = await page.locator(".rsk").innerText();
      r.afterLateScraper = {
        educationShowsOriginal: /\bIIT D\b(?! *elhi)/.test(eduText.replace("IIT Delhi", "")),
        educationShowsEdit: eduText.includes("IIT Delhi"),
        rejectedExperienceVisible: expVisible > 0,
        jquerySuggestedAgain: /jquery/i.test(skillsText),
        torchSuggestedAgain: /\btorch\b/.test(skillsText),
      };
      results[name] = r;
      await context.close();
    }
  } finally {
    await browser.close();
    const { closeDbForTesting } = await import("../lib/db");
    await closeDbForTesting();
  }
  console.log(JSON.stringify(results, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
