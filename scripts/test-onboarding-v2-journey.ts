import puppeteer from "puppeteer-core";
async function main() {
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const base = "http://localhost:3002";
async function heading(value: string) { await page.waitForFunction((text: string) => document.querySelector("#ob2-heading")?.textContent?.includes(text), {}, value); }
async function click(label: string) { const found = await page.evaluate((text: string) => { const button = [...document.querySelectorAll<HTMLButtonElement>(".ob2-card button")].find(b => b.textContent?.trim().startsWith(text)); button?.click(); return Boolean(button); }, label); if (!found) throw new Error(`Missing button: ${label}`); }
try {
  await page.goto(`${base}/onboarding`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await heading("Hi, I'm EORA");
  await page.type("#ob2-name", "Alex Browser Test");
  await page.click('button[aria-label="Continue"]');
  await heading("Hi, Alex Browser Test");
  await click("Let's begin");
  await heading("What best describes you");
  await click("Continue");
  await heading("What are you studying");
  await page.type('input[list="ob2-degrees"]', "B.Tech");
  await page.type('input[list="ob2-specializations"]', "Computer Science");
  await page.select("select", "3rd Year");
  await click("Continue");
  await heading("Let's make this easier");
  const invalid = await page.evaluate(async () => { const form = new FormData(); form.set("resume", new File(["not a PDF"], "invalid.pdf", { type: "application/pdf" })); return (await fetch("/api/resume/extract", { method: "POST", body: form })).status; });
  if (invalid !== 415) throw new Error(`Invalid resume accepted: ${invalid}`);
  await click("Continue without a resume");
  await heading("Where do you build");
  await click("Continue");
  await heading("organizing what you shared");
  await click("Continue");
  await heading("what I know so far");
  await click("Looks good");
  await heading("Have you worked with Python");
  await click("NOT YET");
  await click("Continue");
  await heading("Which of these");
  await click("Continue");
  await heading("Have you completed");
  await click("Continue");
  await heading("what have you built");
  await click("No projects yet");
  await heading("What did you personally");
  await click("Continue");
  await heading("What would you like to achieve");
  await page.type(".ob2-goal-label textarea", "Data Scientist");
  await click("See my starting picture");
  await heading("first Tathastu picture");
  await page.reload({ waitUntil: "domcontentloaded" });
  await heading("first Tathastu picture");
  const email = `onboarding-browser-${Date.now()}@example.com`;
  await page.type('.ob2-account input[type="email"]', email);
  await page.type('.ob2-account input[type="password"]', "BrowserTestPass123!");
  await click("Create account and enter");
  await page.waitForFunction(() => location.pathname === "/student", { timeout: 20000 });
  const person = await page.evaluate(async () => { const response = await fetch("/api/student/person-360"); return response.json(); });
  if (person.activeGoal?.title !== "Data Scientist" || person.person?.displayName !== "Alex Browser Test") throw new Error("Workspace did not receive onboarding goal and name");
  if (!person.evidence?.some((e: { category: string; subject: string; verificationStatus: string }) => e.category === "education" && e.verificationStatus === "self_reported")) throw new Error("Academic context was not imported as self-reported evidence");
  await new Promise(resolve => setTimeout(resolve, 650));
  await page.screenshot({ path: "screenshots/onboarding-v2/13-student-home.png" });
  console.log("Browser journey passed: skip resume, invalid resume rejection, skip GitHub, no Python, no projects, custom goal, refresh resume, account creation, Student Home and Person 360 persistence.");
} finally { await browser.close(); }

}
main().catch(error => { console.error(error); process.exit(1); });
