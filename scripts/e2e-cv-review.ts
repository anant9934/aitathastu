/**
 * Browser check of the CV upload and review step on the app's own isolated dev
 * server (in-memory database). Only text-layer PDF fixtures are uploaded; the
 * OCR extractor URL points at a closed local port and live LLM calls are off,
 * so no document leaves this machine.
 *
 *   node --import tsx scripts/e2e-cv-review.ts   (E2E_MOBILE=1 for phone width)
 */
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startIsolatedServer } from "./e2e-isolation";

const OUT = process.env.E2E_OUT || path.join(os.tmpdir(), "aitathastu-e2e-cv");
const VIEWPORT = process.env.E2E_MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 900 };
const FIX = path.join(process.cwd(), "eval/cv/fixtures");
fs.mkdirSync(OUT, { recursive: true });

const results: Array<{ check: string; ok: boolean; detail: string }> = [];
const record = (check: string, ok: boolean, detail = "") => {
  results.push({ check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${check}${detail ? `  — ${detail}` : ""}`);
};

async function main() {
  Object.assign(process.env, { CORE_DISABLE_LIVE_LLM: "true", RESUME_EXTRACTOR_URL: "http://127.0.0.1:9", EXTRACTOR_API_TOKEN: "e2e-disabled" });
  const server = await startIsolatedServer(OUT);
  const stop = () => { try { process.kill(-server.proc.pid!, "SIGTERM"); } catch { /* gone */ } };
  process.on("exit", stop);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: "reduce" });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !/status of (4\d\d|5\d\d)/.test(m.text())) consoleErrors.push(m.text()); });
  const applyBodies: unknown[] = [];
  page.on("request", (r) => { if (/\/api\/resume\/[^/]+\/apply$/.test(r.url()) && r.method() === "POST") applyBodies.push(r.postDataJSON()); });

  await page.goto(`${server.base}/onboarding`, { waitUntil: "networkidle" });
  const advance = async (name: RegExp) => {
    const before = (await page.locator("h1").first().textContent())?.trim();
    await page.getByRole("button", { name }).last().click();
    await page.waitForFunction((prev) => document.querySelector("h1")?.textContent?.trim() !== prev, before, { timeout: 30_000 });
  };
  await page.getByLabel("What should I call you?").fill("Arjun Test");
  await advance(/continue|let's|start|begin/i);
  await page.getByRole("radio").first().click();
  await advance(/^Continue/);
  await page.getByText("Machine Learning Engineer", { exact: true }).first().click();
  await advance(/^Continue/);
  await page.getByText("Learn AI & ML", { exact: true }).click();
  await advance(/^Continue/);

  const fileInput = page.locator('input[type="file"]');
  record("CV step accepts PDF, DOCX, PNG, JPEG, TXT and RTF", (await fileInput.getAttribute("accept")) === ".pdf,.docx,.png,.jpg,.jpeg,.txt,.rtf");
  record("Phone copy matches the policy", await page.getByText(/only shown as an unticked suggestion/).isVisible());
  await page.getByText("I allow AI Tathastu to upload, store and process my CV", { exact: false }).click();

  // A CV with an impossible date range, a duplicate certificate and a repeated skill.
  await fileInput.setInputFiles(path.join(FIX, "arjun-duplicates--pdf-single.pdf"));
  const review = page.locator('section[aria-labelledby="cv-review-title"]');
  await review.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "review.png"), fullPage: true });

  const text = (await review.textContent()) ?? "";
  const headings = await review.locator("h3").allTextContents();
  const TEN = ["Identity & Personal Details", "Contact Information", "Location & Work Authorization", "Education", "Work Experience", "Skills & Technologies", "Projects", "Certifications, Awards & Achievements", "Publications, Research & Patents", "Online Presence & Other Details"];
  record("The review has the ten sections in order", JSON.stringify(headings) === JSON.stringify(TEN), headings.join(" | "));
  record("Fields the CV did not contain are shown, empty", await review.getByLabel("Pronouns").first().inputValue() === "" && await review.getByLabel(/^Nationality/).first().isVisible());
  record("Nothing is saved or pre-ticked before the student acts", /Not saved yet/.test(text) && (await review.locator('input[type="checkbox"]:checked').count()) === 0);
  const card = (title: string) => review.locator("li", { has: page.locator("p", { hasText: title }) }).first();
  const kappa = card("Kappa Systems");
  record("Impossible dates are flagged on the record", await kappa.getByText("Needs a fix").isVisible() && await kappa.getByText("End date is before the start date").isVisible());
  record("Records show where in the CV they were read", /page 1/i.test((await kappa.locator("summary").textContent()) ?? ""));
  record("Source, confidence, checks and verification are shown separately", /^Source,(Confidence,)?Checks,Verification$/.test((await kappa.locator("dt").allTextContents()).join()) && await kappa.getByText("Not verified yet").isVisible());
  const certs = review.locator("li", { has: page.locator("p", { hasText: "Google Cloud Associate Cloud Engineer" }) });
  record("A duplicated certificate is offered once", (await certs.count()) === 1, String(await certs.count()));
  const pythonChips = await review.locator("#cv-ws-skills input:not([type=checkbox])").evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).value === "Python").length);
  record("A repeated skill is offered once", pythonChips <= 1, String(pythonChips));
  const ust = card("UST Global");
  record("Clean records carry no warning", !(await ust.getByText("Needs a fix").count()));

  // Bulk selection never ticks a record that needs a fix.
  const expSection = review.locator("#cv-ws-experience");
  await expSection.getByRole("button", { name: /^Tick all/ }).click();
  record("Tick all skips records that need a fix", !(await kappa.getByRole("checkbox", { name: /^Save/ }).isChecked()) && await ust.getByRole("checkbox", { name: /^Save/ }).isChecked());
  await expSection.getByRole("button", { name: /^Clear/ }).click();

  // Saving without the mandatory fields is refused in the page, before any request.
  await page.getByRole("button", { name: /Save reviewed details/ }).click();
  await page.waitForTimeout(300);
  const footer = (await review.locator("[aria-live=polite]").last().textContent()) ?? "";
  record("Saving without the required fields shows what is missing", /need(s)? your attention before saving/.test(footer) && (await review.locator('[role="alert"]').count()) > 0, footer.slice(0, 160));
  record("No request is sent while required fields are missing", applyBodies.length === 0, String(applyBodies.length));
  record("The review stays open and editable", await review.getByLabel("Pronouns").first().isEditable());

  // Complete the required fields, correct one record, add one, save.
  const tick = async (label: RegExp) => { const box = review.getByRole("checkbox", { name: label }).first(); if (!(await box.isChecked())) await box.check(); };
  const nameInput = review.getByLabel(/^Full name/).first();
  if (!(await nameInput.inputValue())) await nameInput.fill("Arjun Test");
  await tick(/^Save Full name$/);
  const emailInput = review.getByLabel(/^Email/).first();
  if (!(await emailInput.inputValue())) await emailInput.fill("arjun.test@example.com");
  await tick(/^Save Email$/);
  await review.getByLabel(/^GitHub profile URL/).first().fill("https://github.com/arjun-test");
  const eduCards = review.locator("#cv-ws-education > div li");
  if (!(await eduCards.count())) await review.getByRole("button", { name: "Add education" }).click();
  const current = review.locator("#cv-ws-education li", { has: page.locator('input[type="radio"]:checked') }).first();
  await current.getByRole("checkbox", { name: /^Save/ }).check();
  for (const [label, value] of [[/^Qualification/, "B.Tech"], [/^College/, "Kerala Technological University"], [/^Specialization/, "Computer Science"], [/^Start year/, "2023"]] as const) {
    const field = current.getByLabel(label).first();
    if (!(await field.inputValue()).trim()) await field.fill(value);
  }
  await current.getByLabel(/^Education status/).selectOption("Pursuing");
  await current.getByLabel(/passing-out date/i).first().fill("May 2027");
  await kappa.getByRole("checkbox", { name: /^Save/ }).check();
  await kappa.getByLabel(/^End date/).fill("Jan 2022");
  await kappa.getByLabel(/^Start date/).fill("Jun 2021");
  record("An edited record drops the extractor's stale warning", !(await kappa.getByText("Needs a fix").count()) && /Edited by you/.test((await kappa.textContent()) ?? ""));
  await ust.getByRole("checkbox", { name: /^Save/ }).check();
  await review.getByRole("button", { name: "Add certification" }).click();
  const added = review.locator("#cv-ws-achievements li", { has: page.locator("p", { hasText: "New certification" }) }).first();
  await added.getByLabel(/^Name/).fill("AWS Cloud Practitioner");
  record("Unsaved changes are announced", await review.getByText("Unsaved changes").first().isVisible());
  await page.getByRole("button", { name: /Save & Continue/ }).click();
  await page.waitForFunction(() => document.body.textContent?.includes("Saved to profile") || document.querySelector("h1")?.textContent?.includes("account"), null, { timeout: 30_000 }).catch(() => undefined);
  type Body = { workspaceVersion?: number; decisions?: Array<{ candidateId: string; state: string; fields?: Record<string, string>; currentEducation?: boolean }>; additions?: Array<{ category: string; fields: Record<string, string> }> };
  const body = applyBodies[0] as Body | undefined;
  const edited = body?.decisions?.find((d) => d.fields?.startDate === "Jun 2021");
  record("Save sends the canonical workspace payload", body?.workspaceVersion === 1 && Boolean(edited?.state === "confirmed" && edited.fields?.endDate === "Jan 2022"), JSON.stringify(edited ?? null).slice(0, 160));
  record("Personal-detail decisions are saved with the review", Boolean(body?.decisions?.some((d) => /^profile_/.test(d.candidateId))));
  record("Unticked records are sent as rejected", Boolean(body?.decisions?.some((d) => d.state === "rejected")));
  record("Added records are sent as additions", Boolean(body?.additions?.some((a) => a.category === "certification" && a.fields.name === "AWS Cloud Practitioner")));
  record("The current education is marked", Boolean(body?.decisions?.some((d) => d.currentEducation) || (body as { additions?: Array<{ currentEducation?: boolean }> })?.additions?.some((a) => a.currentEducation)));

  // Reload: the saved review, not the raw extraction, comes back.
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "networkidle" });
  for (let i = 0; i < 4 && !(await review.isVisible()); i++) {
    const back = page.getByRole("button", { name: /^Back/i }).first();
    if (!(await back.count())) break;
    await back.click();
    await page.waitForTimeout(1500);
  }
  await review.waitFor({ timeout: 30_000 }).catch(() => undefined);
  const reloaded = await review.isVisible();
  const kappaAfter = card("Kappa Systems");
  record("After a reload the saved edits come back", reloaded && await kappaAfter.getByRole("checkbox", { name: /^Save/ }).isChecked() && (await kappaAfter.getByLabel(/^End date/).inputValue()) === "Jan 2022");
  record("After a reload the added record comes back as the student's own", reloaded && await review.locator("li", { has: page.locator("p", { hasText: "AWS Cloud Practitioner" }) }).getByText("Added by you").isVisible());
  record("A restored correction is labelled as confirmed with the student's edit", reloaded && await kappaAfter.getByText("Confirmed by you, with your edit").isVisible());
  await page.screenshot({ path: path.join(OUT, "after-reload.png"), fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record("No horizontal page scroll", overflow <= 1, `overflow=${overflow}px`);
  record("No console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  await browser.close();
  stop();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshots: ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
