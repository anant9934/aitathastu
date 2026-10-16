/**
 * Task 2.4.1 in the browser: the skills map renders with no overlapping
 * labels (measured from the real SVG text boxes), clicking a node lights its
 * edges and opens the seven-questions panel, search + Enter selects, zoom and
 * keyboard work. Needs the test-database dev server on :3100.
 *
 *   node --import tsx scripts/visual-phase2-skills-graph.ts <outDir>
 */
import path from "path";
import { chromium, type Page } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

async function labelOverlaps(page: Page) {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll("[data-testid=skills-map] .sim-stage text")].map((t) => ({ t: t.textContent, r: (t as SVGGraphicsElement).getBoundingClientRect() }));
    const bad: string[] = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) bad.push(`${boxes[i].t} × ${boxes[j].t}`);
    }
    return { labels: boxes.length, overlaps: bad };
  });
}

async function main() {
  const { useTestDatabase } = await import("./lib/test-db");
  await useTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
  const { createEvidenceRecord } = await import("../lib/repositories/evidence-repository");

  const email = `p2-graph-${Date.now()}@test.invalid`;
  const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Kavya Raman" });
  await completeOnboarding(personId, {
    role: "student", name: "Kavya Raman", targetRole: "Machine Learning Engineer", institution: "IIT Madras", degree: "B.Tech",
    priorities: ["learning"], primaryPriority: "learning",
    skills: ["Python", "PyTorch", "TensorFlow", "scikit-learn", "SQL", "Docker", "FastAPI", "Git", "Pandas", "NumPy", "OpenCV", "Kubernetes"],
    projects: [
      { id: "p1", title: "Crop Disease Detector", description: "CNN on leaf images", technologies: ["PyTorch", "OpenCV", "FastAPI"], sources: ["github"], status: "confirmed", contribution: [], contributionNote: "" },
      { id: "p2", title: "Lecture Notes Q&A", description: "RAG over notes", technologies: ["Python", "LangChain"], sources: ["resume"], status: "confirmed", contribution: [], contributionNote: "" },
    ],
  });
  for (const [subject, origin] of [["Python", "github"], ["PyTorch", "github"], ["Docker", "github"], ["SQL", "hackerrank"], ["Python", "leetcode"], ["Pandas", "kaggle"]] as const) {
    await createEvidenceRecord(personId, { category: "skill", subject, value: `${subject} seen on ${origin}`, source: "imported", verificationStatus: "imported", originSource: origin, interpretation: `Observed on ${origin}`, whyItMatters: "x", importKey: `vis_${origin}_${subject}` });
  }

  const browser = await chromium.launch();
  const result: Record<string, unknown> = {};
  for (const width of [1280, 375]) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
    await page.goto(`${BASE}/student/skills`);
    const map = page.getByTestId("skills-map");
    await map.waitFor({ timeout: 120_000 });
    await map.scrollIntoViewIfNeeded();
    const r: Record<string, unknown> = {};
    r.nodes = await page.locator("[data-testid=skills-map] .sim-node").count();
    r.statuses = await page.locator("[data-testid=skills-map] .sim-node[data-status]").evaluateAll((els) => els.reduce<Record<string, number>>((a, e) => { const s = e.getAttribute("data-status")!; a[s] = (a[s] ?? 0) + 1; return a; }, {}));
    r.labelCheck = await labelOverlaps(page);
    await map.screenshot({ path: path.join(out, `p2-graph-${width}.png`) });

    // Click a skill node → edges light up, drawer opens with seven questions.
    await page.locator('[data-node="skill_pytorch"]').click();
    await page.getByTestId("skill-drawer").waitFor();
    r.drawerTitle = await page.locator("#drawer-title").innerText();
    r.drawerStatus = await page.getByTestId("drawer-status").innerText();
    r.questions = await page.getByTestId("skill-drawer").locator("ol > li h3").allInnerTexts();
    r.litEdges = await page.locator("[data-testid=skills-map] line[data-lit=true]").count();
    await map.screenshot({ path: path.join(out, `p2-graph-selected-${width}.png`) });
    await page.getByRole("button", { name: "Close details" }).click();

    if (width === 1280) {
      // Search + Enter selects the first match.
      await page.getByPlaceholder("Find a skill or source").fill("hacker");
      r.searchStatus = await page.getByText(/match/).first().innerText();
      await page.getByPlaceholder("Find a skill or source").press("Enter");
      await page.getByTestId("skill-drawer").waitFor();
      r.searchSelected = await page.locator("#drawer-title").innerText();
      await page.getByPlaceholder("Find a skill or source").fill("");
      // Zoom changes the stage transform; labels still do not collide after zoom.
      const before = await page.locator(".sim-stage").getAttribute("style");
      await page.getByRole("button", { name: "Zoom in" }).click();
      await page.waitForTimeout(400);
      r.zoomChanged = before !== (await page.locator(".sim-stage").getAttribute("style"));
      r.labelCheckZoomed = await labelOverlaps(page);
      await page.getByRole("button", { name: "Reset view" }).click();
      // Keyboard: focus the goal node and open it with Enter.
      await page.locator('[data-node="goal"]').focus();
      await page.keyboard.press("Enter");
      r.keyboardOpened = await page.locator("#drawer-title").innerText();
      // List view.
      await page.getByText("Read the map as a list").click();
      r.listRows = await page.locator("[data-testid=skills-map] tbody tr").count();
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
