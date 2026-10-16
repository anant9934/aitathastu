/**
 * Browser check for Task 2.1.5: per-source show / accept-all / remove /
 * exclude-forks on Screen 8, driven through the real UI, with the draft read
 * back from the DB and a late re-sync afterwards. Needs the test-database dev
 * server described in scripts/visual-phase2-progress.ts.
 *
 *   node --import tsx scripts/visual-phase2-sources.ts <outDir>
 */
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

const PROJECTS = [
  { id: "gh_rag", title: "rag-notes", sources: ["resume", "github"], status: "candidate", contribution: [], contributionNote: "", technologies: ["Python"] },
  { id: "gh_bot", title: "chess-bot", sources: ["github"], status: "candidate", contribution: [], contributionNote: "", technologies: ["Rust"], stars: 3 },
  { id: "gh_fork", title: "transformers", sources: ["github"], status: "candidate", contribution: [], contributionNote: "", technologies: ["Python"], isFork: true },
];
const EXPS = [
  { company: "Globex", role: "Data Intern", status: "candidate", source: "linkedin" },
  { company: "IIT Delhi", role: "Teaching Assistant", status: "candidate", source: "resume" },
];
const EDU = [{ institution: "IIT Delhi", degree: "B.Tech", status: "candidate", source: "resume" }];
const CANDS = [{ name: "PyTorch", source: "github" }, { name: "Excel", source: "linkedin" }];

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
      const email = `p2-src-${name}-${Date.now()}@test.invalid`;
      const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Asha Rao" });
      await writeOnboardingDraft(personId, { name: "Asha Rao", role: "student", targetRole: "Machine Learning Engineer", currentScreen: 8, institution: "IIT Delhi", degree: "B.Tech" });
      await mutateOnboardingDraft(personId, { projects: PROJECTS, experiences: EXPS, education: EDU, techCandidates: CANDS }, { origin: "system" });

      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
      if (!res.ok()) throw new Error(`sign-in ${res.status()}`);
      await page.goto(`${BASE}/onboarding`);
      const bar = page.getByRole("region", { name: "Review by source" });
      await bar.waitFor({ timeout: 60_000 });
      const tab = (label: string) => page.getByRole("button", { name: new RegExp(`^${label}`) }).first().click();
      const status = () => bar.getByRole("status").innerText();
      const settle = () => page.waitForTimeout(900);
      const r: Record<string, unknown> = { pageErrors: errors };

      r.chips = (await bar.getByRole("group").innerText()).replace(/\s+/g, " ");

      // Filter to GitHub: projects shows only GitHub's; experience shows the empty-for-source line.
      await bar.getByRole("button", { name: /^GitHub/ }).click();
      await tab("Projects");
      r.githubProjectsShown = (await page.locator(".rel-title").allInnerTexts());
      await tab("Experience");
      r.experienceUnderGithub = await page.getByText("Nothing from GitHub in this section.").isVisible();
      if (name === "1280") await page.screenshot({ path: path.join(out, `p2-sources-github-${name}.png`) });

      // Exclude forks, undo, exclude again.
      await bar.getByRole("button", { name: /Exclude forks/ }).click();
      r.afterExclude = await status();
      await bar.getByRole("button", { name: "Undo" }).click();
      await tab("Projects");
      r.forkBackAfterUndo = (await page.locator(".rel-title").allInnerTexts()).includes("transformers");
      await bar.getByRole("button", { name: /Exclude forks/ }).click();
      await settle();

      // Remove GitHub's items: the CV-shared project must stay.
      await bar.getByRole("button", { name: /Remove GitHub/ }).click();
      r.afterRemoveGithub = await status();
      await settle();

      // LinkedIn: remove; CV: accept all.
      await bar.getByRole("button", { name: /^LinkedIn/ }).click();
      await bar.getByRole("button", { name: /Remove LinkedIn/ }).click();
      r.afterRemoveLinkedin = await status();
      await bar.getByRole("button", { name: /^CV/ }).click();
      await bar.getByRole("button", { name: /Accept all from CV/ }).click();
      r.afterAcceptCv = await status();
      await settle();
      await page.screenshot({ path: path.join(out, `p2-sources-cv-${name}.png`) });
      r.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

      const saved = (await readOnboardingDraft(personId))!;
      r.saved = {
        projects: saved.projects.map((p) => `${p.title}:${p.status}:${p.sources.join("+")}`),
        experiences: saved.experiences?.map((e) => `${e.company}:${e.status}`),
        education: saved.education?.map((e) => `${e.institution}:${e.status}`),
        techCandidates: saved.techCandidates?.map((c) => `${c.name}:${c.status ?? "candidate"}`),
      };

      // Late re-sync of every source: removed items stay removed.
      await mutateOnboardingDraft(personId, { projects: PROJECTS, experiences: EXPS, techCandidates: CANDS }, { origin: "system" });
      const after = (await readOnboardingDraft(personId))!;
      r.afterResync = {
        projects: after.projects.map((p) => `${p.title}:${p.status}`),
        experiences: after.experiences?.map((e) => `${e.company}:${e.status}`),
        techCandidates: after.techCandidates?.map((c) => `${c.name}:${c.status ?? "candidate"}`),
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
