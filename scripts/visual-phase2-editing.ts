/**
 * Tasks 2.2.2 and 2.2.3 in the browser: edit graduation year on /student/profile
 * (DB row + version row + card updates) and add / hide / remove a skill on
 * /student/skills (evidence row + count updates). Needs the test-database dev
 * server (scripts/visual-phase2-progress.ts).
 *
 *   node --import tsx scripts/visual-phase2-editing.ts <outDir>
 */
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

async function main() {
  const { useTestDatabase } = await import("./lib/test-db");
  await useTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
  const { getDb, personProfiles, personProfileVersions, evidenceItems } = await import("../lib/db");
  const { and, eq } = await import("drizzle-orm");

  const email = `p2-edit-${Date.now()}@test.invalid`;
  const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Kavya Raman" });
  await completeOnboarding(personId, {
    role: "student", name: "Kavya Raman", targetRole: "Machine Learning Engineer", institution: "IIT Madras", degree: "B.Tech",
    priorities: ["learning"], primaryPriority: "learning", skills: ["Python", "PyTorch"], projects: [],
  });
  const db = await getDb();
  const browser = await chromium.launch();
  const result: Record<string, unknown> = {};

  for (const width of [1280, 375]) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
    const r: Record<string, unknown> = {};

    // Profile
    await page.goto(`${BASE}/student/profile`);
    await page.getByRole("button", { name: "Edit details" }).click({ timeout: 120_000 });
    if (width === 1280) {
      await page.getByLabel("Graduation year").fill("20x7");
      await page.getByRole("button", { name: "Save details" }).click();
      r.badYearError = await page.locator("#pd-error").innerText({ timeout: 15_000 });
      await page.getByLabel("Graduation year").fill("2027");
      await page.getByLabel("Headline").fill("ML student building speech tools");
      await page.getByLabel("Placement status").selectOption("actively_applying");
    } else {
      await page.getByLabel("Graduation year").fill("2028");
    }
    await page.getByRole("button", { name: "Save details" }).click();
    await page.getByText("Profile saved.", { exact: false }).waitFor();
    r.cardYear = await page.getByTestId("pd-expectedGraduationYear").innerText();
    await page.screenshot({ path: path.join(out, `p2-profile-${width}.png`), fullPage: true });
    const [row] = await db.select().from(personProfiles).where(eq(personProfiles.personId, personId));
    const versions = await db.select().from(personProfileVersions).where(and(eq(personProfileVersions.personId, personId), eq(personProfileVersions.changeType, "profile_edited")));
    r.db = { expectedGraduationYear: row.expectedGraduationYear, headline: row.headline, placementStatus: row.placementStatus, profileEditedVersions: versions.length };
    await page.reload();
    await page.getByTestId("pd-expectedGraduationYear").waitFor();
    r.yearAfterReload = await page.getByTestId("pd-expectedGraduationYear").innerText();

    // Skills (once, at 1280); 375 only checks layout.
    await page.goto(`${BASE}/student/skills`);
    await page.getByTestId("skill-editor").waitFor({ timeout: 120_000 });
    if (width === 1280) {
      const count = async () => page.locator("[data-skill]").count();
      r.cardsBefore = await count();
      await page.getByLabel("Skill", { exact: true }).fill("FastAPI");
      await page.getByLabel("Your level", { exact: true }).selectOption("intermediate");
      await page.getByRole("button", { name: "Add skill" }).click();
      await page.getByText("FastAPI added", { exact: false }).waitFor();
      await page.locator('[data-skill="FastAPI"]').waitFor();
      r.cardsAfterAdd = await count();
      const ev = await db.select().from(evidenceItems).where(and(eq(evidenceItems.personId, personId), eq(evidenceItems.subject, "FastAPI")));
      r.fastapiEvidence = ev.map((e) => [e.source, e.value]);
      await page.getByRole("button", { name: "Hide PyTorch" }).click();
      await page.getByText("PyTorch hidden", { exact: false }).waitFor();
      r.cardsAfterHide = await count();
      await page.screenshot({ path: path.join(out, `p2-skills-${width}.png`), fullPage: true });
      await page.getByRole("button", { name: "Show PyTorch" }).click();
      await page.getByText("PyTorch is shown again", { exact: false }).waitFor();
      r.cardsAfterShow = await count();
      await page.getByRole("button", { name: "Remove FastAPI" }).click();
      await page.getByText("FastAPI removed", { exact: false }).waitFor();
      r.cardsAfterRemove = await count();
    } else {
      await page.screenshot({ path: path.join(out, `p2-skills-${width}.png`), fullPage: true });
    }
    r.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    r.pageErrors = errors;
    result[width] = r;
    await page.close();
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  const { closeDbForTesting } = await import("../lib/db");
  await closeDbForTesting();
}
main().catch((e) => { console.error(e); process.exit(1); });
