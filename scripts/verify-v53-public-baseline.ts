import { chromium, request } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = process.env.V53_BASE_URL || "http://127.0.0.1:3100";
const output = join(process.cwd(), "docs/screenshots/v53/public-baseline");
mkdirSync(output, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const results: { route: string; width: number; status: number | null; overflow: number; heading: string; errors: string[] }[] = [];
  try {
    for (const route of ["/", "/sign-in", "/sign-up", "/onboarding", "/student", "/faculty"]) {
      for (const width of [320, 390, 768, 1024, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.stack || error.message));
        const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(600);
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        const heading = (await page.locator("h1").first().textContent({ timeout: 1000 }).catch(() => ""))?.trim() || "";
        await page.screenshot({ path: join(output, `${route === "/" ? "home" : route.slice(1)}-${width}.png`), fullPage: false, animations: "disabled" });
        results.push({ route, width, status: response?.status() ?? null, overflow, heading, errors });
        await page.close();
      }
    }
    const api = await request.newContext({ baseURL: base });
    const signup = await api.post("/api/auth/sign-up", { data: { email: "invalid", password: "", displayName: "" } });
    const signin = await api.post("/api/auth/sign-in", { data: { email: "", password: "" } });
    const session = await api.get("/api/auth/session");
    writeFileSync(join(output, "results.json"), JSON.stringify({ results, authValidation: { signup: signup.status(), signin: signin.status(), session: session.status() } }, null, 2));
    console.log(JSON.stringify({ results, authValidation: { signup: signup.status(), signin: signin.status(), session: session.status() } }, null, 2));
    await api.dispose();
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
