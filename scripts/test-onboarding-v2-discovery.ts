import puppeteer from "puppeteer-core";
import { initialDraft, STORAGE_KEY } from "../lib/onboarding-v2";
async function main() {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  const base = "http://localhost:3002";
  const heading = async (text: string) => page.waitForFunction((expected: string) => document.querySelector("#ob2-heading")?.textContent?.includes(expected), {}, text);
  const click = async (text: string) => { const found = await page.evaluate((expected: string) => { const button = [...document.querySelectorAll<HTMLButtonElement>(".ob2-card button")].find(b => b.textContent?.trim().startsWith(expected)); button?.click(); return Boolean(button); }, text); if (!found) throw new Error(`Missing button: ${text}`); };
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.evaluate((key, value) => localStorage.setItem(key, value), STORAGE_KEY, JSON.stringify({ ...initialDraft, name: "Casey", degree: "B.Tech", specialization: "Computer Science", year: "3rd Year", stage: "resume" }));
    await page.goto(`${base}/onboarding`, { waitUntil: "domcontentloaded" });
    await heading("Let's make this easier");
    const input = await page.$('input[type="file"]'); if (!input) throw new Error("Missing resume input");
    await input.uploadFile("public/sample-resumes/priya-verma-resume.docx");
    await page.waitForFunction(() => document.querySelector(".ob2-review")?.textContent?.includes("Suggestions"), { timeout: 20000 });
    await click("Continue");
    await heading("Where do you build");
    await page.type("#ob2-linkedin", "https://example.com/wrong");
    await click("Continue");
    await page.waitForSelector(".ob2-error");
    await page.$eval("#ob2-linkedin", input => { (input as HTMLInputElement).value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.click("#ob2-linkedin", { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.type("#ob2-linkedin", "https://www.linkedin.com/in/casey-example");
    await click("Continue");
    await heading("organizing what you shared"); await click("Continue");
    await heading("what I know so far"); await click("Looks good");
    await heading("Have you worked with Python"); await click("YES"); await click("Continue");
    await heading("Which of these"); await click("Pandas"); await click("Continue");
    await heading("Have you completed");
    await page.type('input[aria-label="Certification name"]', "Cloud Fundamentals");
    await page.click('button[aria-label="Add certification"]');
    await click("Continue");
    await heading("what have you built");
    await page.type('input[aria-label="Project title"]', "Useful Model"); await page.click('button[aria-label="Add project"]');
    await click("This is my project"); await click("Continue");
    await heading("What did you personally"); await click("Testing"); await page.type(".ob2-contributions textarea", "I tested the model"); await click("Continue");
    await heading("What would you like to achieve"); await click("ML Engineer"); await click("See my starting picture");
    await heading("first Tathastu picture");
    const text = await page.$eval(".ob2-reveal", el => el.textContent || "");
    if (!text.includes("LinkedIn") || !text.includes("1 self-reported")) throw new Error("Reveal did not include confirmed sources and project");
    console.log("Discovery branch passed: DOCX extraction, invalid profile fallback, Python yes, skill confirmation, certification, project and personal contribution, goal reveal.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exit(1); });
