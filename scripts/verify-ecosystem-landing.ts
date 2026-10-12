import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const base = process.env.LANDING_BASE_URL || "http://127.0.0.1:3100";
const output = join(process.cwd(), "docs/screenshots/ecosystem-landing");
mkdirSync(output, { recursive: true });

async function main() {
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const errors: string[] = [];
try {
  for (const width of [1440, 1280, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    page.on("pageerror", error => errors.push(`${width}: ${error.stack || error.message}`));
    await page.goto(base, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { display:none !important; }" });
    for (const section of await page.locator(".reveal").all()) {
      await section.scrollIntoViewIfNeeded();
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    if (width === 1440) await page.locator("#chatLog .msg:not(:has(.typing))").nth(6).waitFor({ timeout: 20000 });
    await page.screenshot({ path: join(output, `${width}.png`), fullPage: true, animations: "disabled" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 1) errors.push(`${width}: horizontal overflow ${overflow}px`);
    const title = await page.locator(".hero h1").innerText();
    if (!title.includes("You imagine.") || !title.includes("happen.")) errors.push(`${width}: wrong hero copy`);
    if (width === 1440) {
      await page.getByRole("button", { name: "What is AI Tathastu?" }).click({ force: true });
      if (!(await page.locator("#eoraBubble").innerText()).includes("connected home")) errors.push("EORA chip failed");
      await page.locator("#eoraCore").focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Collaborate", exact: true }).click();
      if (!(await page.locator("#dashTitle").innerText()).includes("Find people")) errors.push("Dashboard tab failed");
      await page.getByRole("button", { name: /What exactly is AI Tathastu/ }).click();
      if (await page.getByRole("button", { name: /What exactly is AI Tathastu/ }).getAttribute("aria-expanded") !== "true") errors.push("FAQ failed");
      await page.locator(".sg-node").first().focus();
      if (!(await page.locator(".sg-edge.hot").count())) errors.push("Graph focus failed");
      const primary = await page.locator(".hero-cta .btn-primary").getAttribute("href");
      if (primary !== "/sign-up") errors.push("Primary CTA destination failed");
      const brokenAnchors = await page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>(".ecosystem-landing a[href^='#']")]
        .map(link => link.getAttribute("href") || "")
        .filter(href => href === "#" || !document.querySelector(href)));
      if (brokenAnchors.length) errors.push(`Broken section anchors: ${brokenAnchors.join(", ")}`);
      for (const route of ["/sign-in", "/sign-up"]) {
        const response = await page.request.get(`${base}${route}`);
        if (!response.ok()) errors.push(`${route} returned ${response.status()}`);
      }
      const backToTopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await backToTopPage.goto(base, { waitUntil: "networkidle" });
      await backToTopPage.evaluate(() => window.scrollTo(0, 1200));
      await backToTopPage.waitForFunction(() => Math.abs(window.scrollY - 1200) < 10, undefined, { timeout: 3000 });
      await backToTopPage.locator("#fab").click();
      await backToTopPage.waitForFunction(() => window.scrollY <= 10, undefined, { timeout: 3000 }).catch(() => {});
      if (await backToTopPage.evaluate(() => window.scrollY) > 10) errors.push("Back-to-top failed");
      await backToTopPage.close();
    }
    if (width === 390) {
      await page.locator("#burger").click();
      if (await page.locator("#burger").getAttribute("aria-expanded") !== "true") errors.push("Mobile menu failed");
      await page.locator("#mobileMenu a[href='#ecosystem']").click();
      if (await page.locator("#burger").getAttribute("aria-expanded") !== "false") errors.push("Mobile menu did not close");
    }
    console.log(`${width}px: captured, overflow=${overflow}px`);
    await page.close();
  }
  const reduced = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  await reduced.goto(base, { waitUntil: "networkidle" });
  if (!(await reduced.locator(".hero h1").isVisible())) errors.push("Reduced-motion hero hidden");
  await reduced.close();
} finally {
  await browser.close();
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Landing page browser checks passed.");
}
}

void main();
