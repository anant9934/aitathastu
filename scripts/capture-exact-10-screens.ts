import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUTPUT_DIR = path.join(process.cwd(), "screenshots", "exact-10-screens");

interface ScreenTarget {
  name: string;
  url: string;
  viewport?: { width: number; height: number };
}

const targets: ScreenTarget[] = [
  { name: "01-landing.png", url: "http://localhost:3000/" },
  { name: "02-eora-welcome.png", url: "http://localhost:3000/screens?screen=2" },
  { name: "03-choose-role.png", url: "http://localhost:3000/screens?screen=3" },
  { name: "04-basic-details.png", url: "http://localhost:3000/screens?screen=4" },
  { name: "05-resume-upload.png", url: "http://localhost:3000/screens?screen=5" },
  { name: "06-digital-footprints.png", url: "http://localhost:3000/screens?screen=6" },
  { name: "07-ai-analysis.png", url: "http://localhost:3000/screens?screen=7" },
  { name: "08-profile-insights.png", url: "http://localhost:3000/screens?screen=8" },
  { name: "09-skills-map.png", url: "http://localhost:3000/screens?screen=9" },
  { name: "10-projects-discovery.png", url: "http://localhost:3000/screens?screen=10" },
  { name: "11-finalize-profile.png", url: "http://localhost:3000/screens?screen=11" },
];

const mobileTargets: ScreenTarget[] = [
  { name: "mobile-01-landing.png", url: "http://localhost:3000/" },
  { name: "mobile-02-eora-welcome.png", url: "http://localhost:3000/screens?screen=2" },
  { name: "mobile-03-choose-role.png", url: "http://localhost:3000/screens?screen=3" },
  { name: "mobile-07-ai-analysis.png", url: "http://localhost:3000/screens?screen=7" },
  { name: "mobile-08-profile-insights.png", url: "http://localhost:3000/screens?screen=8" },
];

async function captureAllScreens() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Launching Chrome executable from:", CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();

  // Desktop captures (1440x900, scale factor 2 for crystal-clear retina fidelity)
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  for (const target of targets) {
    console.log(`Capturing Desktop: ${target.name} from ${target.url}...`);
    await page.goto(target.url, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, target.name),
      fullPage: false,
    });
  }

  // Mobile captures (390x844, scale factor 2)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });

  for (const target of mobileTargets) {
    console.log(`Capturing Mobile: ${target.name} from ${target.url}...`);
    await page.goto(target.url, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, target.name),
      fullPage: false,
    });
  }

  await browser.close();
  console.log("All screenshots successfully captured in:", OUTPUT_DIR);
}

captureAllScreens().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
