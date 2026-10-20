/**
 * Browser walk-through of the redesigned onboarding.
 *
 *   npm run e2e:onboarding            (E2E_MOBILE=1 for a 390 px phone)
 *
 * The script starts its OWN dev server and never uses one that is already
 * running, because the database a server writes to is decided by that
 * server's environment, not by this script. Isolation, all non-empty so .env
 * can never refill them (Next only fills variables that are undefined):
 *   - DATABASE_MODE=pglite + PGLITE_IN_MEMORY: getDb's Postgres/Neon branch is
 *     unreachable in this mode; every run gets a fresh in-memory database.
 *   - DATABASE_URL / DATABASE_URL_UNPOOLED set to a non-postgres sentinel.
 *   - Upstash pointed at a closed local port: the limiter falls back to memory.
 * Stop any other `next dev` in this folder first; both would share .next.
 */
import { chromium, request as pwRequest, type Page } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ISOLATED_ENV } from "./e2e-isolation";


async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function startIsolatedServer(): Promise<{ base: string; proc: ChildProcess }> {
  if (process.env.E2E_BASE_URL) throw new Error("E2E_BASE_URL is not supported: this script only drives a server it started with an isolated database.");
  const port = await freePort();
  const proc = spawn(process.execPath, [path.join("node_modules", ".bin", "next"), "dev", "-p", String(port)], {
    env: { ...process.env, ...ISOLATED_ENV },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const log = fs.createWriteStream(path.join(OUT, "server.log"));
  proc.stdout?.pipe(log);
  proc.stderr?.pipe(log);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dev server did not start in 120 s")), 120_000);
    proc.stdout?.on("data", (d: Buffer) => { if (/Ready in/.test(d.toString())) { clearTimeout(timer); resolve(); } });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`dev server exited (${code})`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  await fetch(`${base}/onboarding`); // compile once before timing anything
  return { base, proc };
}

let BASE = "";
const OUT = process.env.E2E_OUT || path.join(os.tmpdir(), "aitathastu-e2e");
const VIEWPORT = process.env.E2E_MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 900 };
fs.mkdirSync(OUT, { recursive: true });

const results: Array<{ check: string; ok: boolean; detail: string }> = [];
const record = (check: string, ok: boolean, detail = "") => {
  results.push({ check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${check}${detail ? `  — ${detail}` : ""}`);
};

async function describe(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const h1 = (await page.locator("h1").first().textContent().catch(() => ""))?.trim();
  const progress = (await page.locator('nav[aria-label="Onboarding progress"] p.sr-only').textContent().catch(() => ""))?.trim();
  await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true });
  console.log(`\n[${label}] h1="${h1}" progress="${progress}"`);
  return { h1: h1 || "", progress: progress || "" };
}

const h1Text = async (page: Page) => ((await page.locator("h1").first().textContent().catch(() => "")) || "").trim();

/** Clicks the step's primary action and waits until the next step's heading is on screen. */
async function next(page: Page, name: RegExp = /^(Continue|Skip for now|Looks right|Review what we found)/) {
  const before = await h1Text(page);
  await page.getByRole("button", { name }).last().click();
  try {
    await page.waitForFunction((prev) => {
      const h = document.querySelector("h1")?.textContent?.trim();
      return Boolean(h) && h !== prev;
    }, before, { timeout: 30_000 });
  } catch (e) {
    await page.screenshot({ path: path.join(OUT, "stuck.png"), fullPage: true });
    const alerts = await page.locator('[role="alert"], [role="status"], .text-danger').allTextContents();
    console.log(`STUCK on "${before}": ${JSON.stringify(alerts)}`);
    throw e;
  }
}

async function main() {
  const server = await startIsolatedServer();
  BASE = server.base;
  const stop = () => { try { process.kill(-server.proc.pid!, "SIGTERM"); } catch { /* already gone */ } };
  process.on("exit", stop);
  console.log(`Isolated server on ${BASE} (DATABASE_MODE=pglite, in-memory)`);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: "reduce" });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  let expect409 = false;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (expect409 && /status of 409/.test(m.text())) return; // the deliberately refused email below
    consoleErrors.push(m.text());
  });

  await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  await describe(page, "01-welcome");
  await page.getByLabel("What should I call you?").fill("Asha Test");
  await next(page, /continue|let's|start|begin/i);

  let s = await describe(page, "02-role");
  record("Role is step 1 of 11 in stage 1 of 4", /Stage 1 of 4.*Step 1 of 11/.test(s.progress), s.progress);
  await page.getByRole("radio").first().check().catch(async () => page.getByRole("radio").first().click());
  await next(page);

  s = await describe(page, "03-direction");
  record("Direction is step 2", /Step 2 of 11/.test(s.progress), s.progress);
  await page.getByText("Machine Learning Engineer", { exact: true }).first().click();
  await next(page);

  s = await describe(page, "04-priorities");
  record("Priorities is step 3", /Step 3 of 11/.test(s.progress), s.progress);
  await page.getByText("Learn AI & ML", { exact: true }).click();
  await next(page);

  s = await describe(page, "05-cv");
  record("CV is step 4 in stage 2", /Stage 2 of 4.*Step 4 of 11/.test(s.progress), s.progress);

  const SKIP_CV = Boolean(process.env.E2E_SKIP_CV);
  if (SKIP_CV) {
    await next(page, /^Continue without a CV/);
    record("CV can be skipped", true);
  } else {
    // CV: consent to processing only (AI analysis stays off), upload a text PDF, wait for the async job.
    await page.getByText("I allow AI Tathastu to upload, store and process my CV", { exact: false }).click();
    await page.locator('input[type="file"]').first().setInputFiles(path.join("scripts", "fixtures", process.env.E2E_CV || "dfi21_rich_profile.pdf"));
    const t0 = Date.now();
    await page.getByText(/Extracted suggestions from/i).first().waitFor({ timeout: 120_000 });
    record("CV extraction reaches review", true, `${Math.round((Date.now() - t0) / 1000)} s`);
    await describe(page, "06-cv-review");
    await page.getByRole("button", { name: /^Select all/ }).click();
    await page.getByRole("button", { name: "Confirm & save suggestions" }).click();
    await page.waitForTimeout(2500);
    await describe(page, "06b-cv-saved");
    fs.writeFileSync(path.join(OUT, "buttons-cv-saved.txt"), (await page.getByRole("button").allTextContents()).join("\n") + "\n---ALERTS\n" + (await page.locator('[role=alert],[role=status]').allTextContents()).join("\n"));
    await next(page, /^(Save & Continue|Continue)$/);
  }

  // ── Sources (merged step) ──
  s = await describe(page, "07-sources");
  record("Sources is step 5 in stage 2", /Stage 2 of 4.*Step 5 of 11, Connect your sources/.test(s.progress), s.progress);
  for (const group of ["Development", "Problem solving", "Data and AI", "Community and writing", "Research"]) {
    record(`Group "${group}" shown`, await page.getByRole("heading", { name: group, exact: true }).isVisible());
  }
  record("LinkedIn appears once (dedicated card, no duplicate row)", (await page.getByText("LinkedIn", { exact: true }).count()) >= 1 && (await page.locator('li:has-text("LinkedIn") >> text=How it connects').count()) === 0);
  record("No 'Imported' chip before any import", (await page.getByText("Imported", { exact: true }).count()) === 0);

  const found = page.getByRole("region", { name: "Found in your CV" }).or(page.locator('section[aria-labelledby="found-title"]'));
  const foundCount = await found.locator("li").count();
  console.log(`  CV-found links: ${foundCount}`);
  if (foundCount > 0) {
    const firstName = ((await found.locator("li").first().locator("p").first().textContent()) || "").replace("Not confirmed", "").trim();
    await found.locator("li").first().getByRole("button", { name: "Not mine" }).click();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("h1").first().waitFor();
    const stillThere = await page.locator('section[aria-labelledby="found-title"] li', { hasText: firstName }).count();
    record("Dismissed CV link stays dismissed after reload", stillThere === 0, firstName);
    s = await describe(page, "08-sources-after-reload");
    record("Reload resumes on Sources", /Step 5 of 11/.test(s.progress), s.progress);
  }

  // GitHub drawer explains access levels; sign-in returns to onboarding.
  await page.locator("li", { hasText: "GitHub" }).filter({ has: page.getByRole("button", { name: /Connect|Manage|Retry/ }) }).first().getByRole("button", { name: /Connect|Manage|Retry/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer.waitFor();
  record("GitHub drawer explains three access levels", await drawer.getByText("Three levels of GitHub access").isVisible());
  const signIn = drawer.getByRole("link", { name: /Sign in with GitHub/ });
  record("GitHub sign-in returns to onboarding", ((await signIn.getAttribute("href")) || "").includes("returnTo=%2Fonboarding"), (await signIn.getAttribute("href")) || "");
  await page.screenshot({ path: path.join(OUT, "09-github-drawer.png") });

  // Real import of GitHub's public demo account.
  await drawer.getByRole("textbox").fill("octocat");
  await drawer.getByRole("button", { name: /Import public data|Refresh/ }).click();
  const outcome = await Promise.race([
    drawer.getByText(/Done\. Closing|Last import|Partly imported/).first().waitFor({ timeout: 90_000 }).then(() => "settled"),
    drawer.getByText("That didn't work").waitFor({ timeout: 90_000 }).then(() => "error"),
  ]).catch(() => "timeout");
  await page.screenshot({ path: path.join(OUT, "10-github-import.png") });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(1500);
  const ghRow = page.locator("li", { hasText: "GitHub" }).first();
  const chip = ((await ghRow.textContent()) || "").match(/Imported|Partly imported|Linked|Found, not verified|Connected|Import failed/)?.[0] ?? "none";
  record("GitHub import settles with a status from the server result", outcome !== "timeout", `outcome=${outcome}, chip=${chip}`);

  // Simulated return from a cancelled GitHub sign-in.
  await page.goto(`${BASE}/onboarding?error=github_cancelled`, { waitUntil: "networkidle" });
  await page.getByText("GitHub sign-in was cancelled").waitFor({ timeout: 20_000 });
  s = await describe(page, "11-github-cancelled");
  record("Cancelled GitHub returns to Sources with an explanation", /Step 5 of 11/.test(s.progress) && !page.url().includes("error="), page.url());

  // Reduced motion: the animated primary button must not keep moving.
  const anim = await page.locator(".btn-primary").last().evaluate((el) => getComputedStyle(el).animationDuration);
  record("Reduced motion turns off the primary button shimmer", parseFloat(anim) < 0.01, `animation-duration=${anim}`);

  // Keyboard only: reach a source's Connect button, open its drawer, close with Escape, focus returns.
  const portfolioConnect = page.locator("li", { hasText: "Portfolio or website" }).getByRole("button", { name: "Connect" });
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await portfolioConnect.evaluate((el) => el === document.activeElement).catch(() => false);
  }
  record("Keyboard reaches a source's Connect button", reached);
  if (reached) {
    await page.keyboard.press("Enter");
    const dlg = page.getByRole("dialog");
    await dlg.waitFor({ timeout: 10_000 });
    const focusInside = await page.waitForFunction(() => Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement)), null, { timeout: 2000 }).then(() => true).catch(() => false);
    await page.keyboard.press("Escape");
    await dlg.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});
    const focusBack = await portfolioConnect.evaluate((el) => el === document.activeElement).catch(() => false);
    record("Drawer takes focus and Escape returns it to the trigger", focusInside && focusBack, `inside=${focusInside} back=${focusBack}`);
  }

  await next(page, /^(Continue|Skip for now)/);
  s = await describe(page, "12-import");
  record("Import is step 6", /Step 6 of 11/.test(s.progress), s.progress);

  await page.locator("h1", { hasText: /Review|profile/i }).first().waitFor({ timeout: 30_000 }).catch(() => {});
  if (!/Step 6 of 11/.test((await describe(page, "13-after-import")).progress)) {
    s = await describe(page, "13-review");
    record("Import moves on to Review (step 7)", /Step 7 of 11/.test(s.progress), s.progress);
    await page.getByRole("button", { name: /^Back$/ }).last().click();
    await page.getByRole("heading", { name: "Importing what we found" }).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(8000);
    s = await describe(page, "14-back-to-import");
    record("Back from Review stays on Import (no auto-bounce)", /Step 6 of 11/.test(s.progress), s.progress);
    await next(page, /^Review what we found/);
  } else {
    await next(page, /^Review what we found/);
  }

  s = await describe(page, "15-review");
  const inline = async (label: string, value: string) => {
    const add = page.getByRole("button", { name: `Add ${label}`, exact: true });
    if (!(await add.isVisible().catch(() => false))) return;
    await add.click();
    await page.getByLabel(label, { exact: false }).first().fill(value);
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await page.waitForTimeout(400);
  };
  const tab = async (name: string) => {
    const mobileTab = page.getByRole("tab", { name: new RegExp(`^${name}`) });
    if (await mobileTab.first().isVisible().catch(() => false)) return mobileTab.first().click();
    return page.locator('nav[aria-label="Review sections"]').getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
  };
  await inline("College, university or employer", "Test Institute of Technology");
  await inline("Degree", "B.Tech");
  await inline("Where you are now", "3rd year");
  await tab("Education");
  const acceptEdu = page.getByRole("button", { name: /^Accept$/ }).first();
  if (await acceptEdu.isVisible().catch(() => false)) await acceptEdu.click();
  await page.screenshot({ path: path.join(OUT, "15b-review-education.png"), fullPage: true });
  if (!SKIP_CV) record("Review entries name their source", (await page.getByText(/^From /).count()) > 0);
  record("Accepted entries read 'Accepted by you', never 'Verified'", (await page.getByText("Verified", { exact: true }).count()) === 0);
  if (SKIP_CV) {
    await page.getByRole("button", { name: /^Add (an )?education/i }).first().click();
    await page.getByLabel("Institution", { exact: false }).first().fill("Test Institute of Technology");
    await page.getByRole("button", { name: /^Save/ }).first().click();
    await page.waitForTimeout(400);
  }
  await tab("Experience");
  const fresher = page.getByRole("button", { name: /don.t have work experience yet/ });
  if (await fresher.isVisible().catch(() => false)) await fresher.click();
  else { const a = page.getByRole("button", { name: /^Accept$/ }).first(); if (await a.isVisible().catch(() => false)) await a.click(); }
  await tab("Skills");
  const acceptSkill = page.getByRole("button", { name: /^Accept / }).first();
  if (await acceptSkill.isVisible().catch(() => false)) await acceptSkill.click();
  else {
    await page.getByLabel("Add a skill").fill("Python");
    await page.getByRole("button", { name: "Add", exact: true }).click();
  }
  await page.waitForTimeout(1000);
  await next(page, /^Looks right/);

  s = await describe(page, "16-after-review");
  if (/Step 8 of 11/.test(s.progress)) {
    record("Guest sees Details as the account step (step 8, Refine)", /Stage 3 of 4/.test(s.progress) && /Create your account/.test(s.h1), s.h1);
    const fill = async (label: string, value: string) => {
      const f = page.getByLabel(label, { exact: false }).first();
      if (await f.isVisible().catch(() => false) && !(await f.inputValue().catch(() => "x"))) await f.fill(value);
    };
    await fill("College, university or employer", "Test Institute of Technology");
    await fill("Degree", "B.Tech");
    await fill("Create a password", "e2e-password-123");

    // An email that already belongs to someone else: the save is refused, the student is offered sign-in,
    // and the refused credentials must not poison later saves (Back saves the position without them).
    const taken = `taken+${Date.now()}@example.test`;
    const other = await pwRequest.newContext({ baseURL: BASE });
    await other.put("/api/onboarding-v2", { data: { version: 2 } });
    const upgraded = await other.put("/api/onboarding-v2", { data: { version: 2, email: taken, password: "other-pass-123", name: "Other Student" } });
    await other.dispose();
    if (upgraded.ok()) {
      expect409 = true;
      await page.getByLabel("Email", { exact: false }).first().fill(taken);
      await page.getByRole("button", { name: /^Continue/ }).last().click();
      const signIn = page.getByRole("link", { name: "Sign in instead" });
      await signIn.waitFor({ timeout: 20_000 }).catch(() => {});
      record("Taken email: save refused with a 'Sign in instead' action", await signIn.isVisible(), (await signIn.getAttribute("href").catch(() => "")) || "");
      await page.getByRole("button", { name: /^Back$/ }).last().click();
      await page.getByRole("heading", { name: /what we found/i }).waitFor({ timeout: 20_000 });
      await page.waitForTimeout(2500);
      const poisoned = await page.getByText("Your last change wasn't saved").isVisible().catch(() => false);
      record("Later saves still work after a refused email", !poisoned && (await page.getByText("Saved", { exact: true }).first().isVisible().catch(() => false)));
      await next(page, /^Looks right/);
    } else {
      record("Could set up a taken email for the conflict check", false, String(upgraded.status()));
    }
    await page.getByLabel("Email", { exact: false }).first().fill(`e2e+${Date.now()}@example.test`);
    await fill("Create a password", "e2e-password-123");
    await next(page);
    s = await describe(page, "17-skills");
  } else {
    record("Details is never skipped for a guest", false, s.progress);
  }
  // Skills (9) and Projects (10) are skipped when the CV covered them; follow whatever the rules show.
  for (let i = 0; i < 3 && !/Step 11 of 11/.test(s.progress); i++) {
    record(`Refine step shown: ${s.h1}`, /Stage 3 of 4.*Step (9|10) of 11/.test(s.progress), s.progress);
    await next(page, /^Continue/);
    s = await describe(page, `18-refine-${i}`);
  }
  record("Finish is step 11 in stage 4", /Stage 4 of 4.*Step 11 of 11/.test(s.progress), s.progress);
  const finishBtn = page.getByRole("button", { name: /Open my workspace/ });
  await finishBtn.click();
  await page.waitForURL(/\/student/, { timeout: 90_000 }).catch(() => {});
  record("Finishing completes on the server and opens the workspace", /\/student/.test(page.url()), page.url());
  const draft = await page.evaluate(async () => (await fetch("/api/onboarding-v2", { cache: "no-store" })).json());
  record("Server draft is marked completed", Boolean(draft?.draft?.completed), JSON.stringify({ completed: draft?.draft?.completed }));
  const session = await page.evaluate(async () => (await fetch("/api/auth/session", { cache: "no-store" })).json());
  const email: string = session?.user?.email || "";
  record("Guest was upgraded to a real account", Boolean(email) && !email.endsWith("@onboarding.aitathastu.internal"), email.replace(/^[^@]+/, "***"));
  await page.screenshot({ path: path.join(OUT, "20-workspace.png") });
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, consoleErrors }, null, 2));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed ? `${failed} CHECK(S) FAILED` : "ALL CHECKS PASSED"} (${results.length - failed}/${results.length}); console errors: ${consoleErrors.length}`);
  stop();
  process.exitCode = failed || consoleErrors.length ? 1 : 0;
  await browser.close();
}

main().catch((e) => { console.error(e); process.exitCode = 1; process.exit(); });
