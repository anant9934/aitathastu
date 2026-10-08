import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { initialDraft, STORAGE_KEY, type OnboardingDraft, type StageId } from "../lib/onboarding-v2";
const base = "http://localhost:3002";
const out = path.resolve("screenshots/onboarding-v2");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const states: { file: string; stage: StageId; viewport?: { width: number; height: number }; changes?: Partial<OnboardingDraft> }[] = [
  { file: "02-name.png", stage: "name" },
  { file: "03-welcome.png", stage: "welcome" },
  { file: "03-role.png", stage: "role" },
  { file: "03-academic.png", stage: "academic" },
  { file: "04-resume.png", stage: "resume" },
  { file: "05-footprints.png", stage: "footprints" },
  { file: "05-insights.png", stage: "insights" },
  { file: "06-python.png", stage: "python" },
  { file: "07-technologies.png", stage: "technologies", changes: { python: "yes", skills: ["Python", "NumPy"] } },
  { file: "08-projects.png", stage: "projects", changes: { projects: [{ id: "example", title: "Smart Proctoring System", technologies: ["Python", "OpenCV"], sources: ["Resume", "Public GitHub"], status: "suggested", contribution: [], contributionNote: "" }] } },
  { file: "09-goal.png", stage: "goal" },
  { file: "10-reveal.png", stage: "reveal", changes: { goal: "ML Engineer", skills: ["Python", "NumPy"], projects: [{ id: "example", title: "Smart Proctoring System", technologies: ["Python"], sources: ["Resume"], status: "confirmed", contribution: ["Testing"], contributionNote: "" }] } },
  { file: "11-mobile-390.png", stage: "footprints", viewport: { width: 390, height: 844 } },
  { file: "12-mobile-320.png", stage: "name", viewport: { width: 320, height: 640 } },
];
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector(".hero-eora");
    await page.evaluate(async () => { const image = document.querySelector<HTMLImageElement>(".hero-eora"); if (image) await image.decode(); });
    await new Promise(resolve => setTimeout(resolve, 750));
    await page.screenshot({ path: path.join(out, "01-landing-desktop.png"), fullPage: true });
    for (const state of states) {
      await page.setViewport(state.viewport || { width: 1280, height: 900 });
      const draft = { ...initialDraft, name: "Alex", degree: "B.Tech", specialization: "Computer Science", year: "3rd Year", resume: "skipped" as const, ...state.changes, stage: state.stage };
      await page.goto(base, { waitUntil: "domcontentloaded" });
      await page.evaluate((key, value) => localStorage.setItem(key, value), STORAGE_KEY, JSON.stringify(draft));
      await page.goto(`${base}/onboarding`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".ob2-card", { timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 850));
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.screenshot({ path: path.join(out, state.file) });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw new Error(`${state.file} has horizontal overflow`);
    }
    console.log(`Captured ${states.length + 1} screenshots in ${out}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exit(1); });
