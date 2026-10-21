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

  const status = (await review.textContent()) ?? "";
  record("Nothing is pre-selected", /\b0 of \d+ selected/.test(status), status.match(/\d+ of \d+ selected/)?.[0] ?? "");
  const kappa = review.locator("li", { hasText: "Kappa Systems" }).first();
  record("Impossible dates are flagged on the record", await kappa.getByText("Needs a fix").isVisible() && await kappa.getByText("End date is before the start date").isVisible());
  record("Records cite the page they came from", await kappa.getByText("Page 1").isVisible());
  const certs = review.locator("li", { hasText: "Google Cloud Associate Cloud Engineer" });
  record("A duplicated certificate is offered once", (await certs.count()) === 1, String(await certs.count()));
  const pythonChips = review.getByRole("button", { name: /^Python$/ });
  record("A repeated skill is offered once", (await pythonChips.count()) <= 1, String(await pythonChips.count()));
  const groupTitles = await review.locator("fieldset legend").allTextContents();
  record("Personal details are grouped as Identity, Contact and Location", ["Identity", "Contact", "Location"].every((t) => groupTitles.includes(t)), groupTitles.join(", "));
  record("Clean records carry no warning", !(await review.locator("li", { hasText: "UST Global" }).first().getByText("Needs a fix").count()));

  // Bulk selection never ticks a record that needs a fix.
  const expGroup = review.locator("fieldset", { has: page.locator("li", { hasText: "Kappa Systems" }) });
  await expGroup.getByRole("button", { name: /^Tick all/ }).click();
  const ust = review.locator("li", { hasText: "UST Global" }).first();
  record("Tick all skips records that need a fix", !(await kappa.getByRole("checkbox").isChecked()) && await ust.getByRole("checkbox").isChecked());
  await expGroup.getByRole("button", { name: /^Clear/ }).click();

  // Correct one record, tick two, save.
  await kappa.getByRole("checkbox").check();
  await kappa.getByRole("button", { name: /^Edit / }).click();
  const input = kappa.locator("input[id^='cv-input-']");
  await input.fill("Software Engineer · Kappa Systems · Jun 2021 – Jan 2022");
  await input.press("Enter");
  record("An edited record drops the extractor's stale warning", await kappa.getByText("Edited by you").isVisible() && !(await kappa.getByText("Needs a fix").count()));
  await review.locator("li", { hasText: "UST Global" }).first().getByRole("checkbox").check();
  await page.getByRole("button", { name: /Save & Continue/ }).click();
  await page.waitForFunction(() => document.body.textContent?.includes("Saved to profile") || document.querySelector("h1")?.textContent?.includes("account"), null, { timeout: 30_000 }).catch(() => undefined);
  const body = applyBodies[0] as { decisions?: Array<{ candidateId: string; state: string; correctedValue?: string }> } | undefined;
  const corrected = body?.decisions?.find((d) => d.correctedValue);
  record("Save sends a decision for every record, with the correction", Boolean(body?.decisions?.length && corrected?.state === "confirmed" && /Jun 2021/.test(corrected.correctedValue ?? "")), JSON.stringify(corrected ?? null));
  record("Personal-detail decisions are saved with the review", Boolean(body?.decisions?.some((d) => /^profile_/.test(d.candidateId))), JSON.stringify(body?.decisions?.filter((d) => /^profile_/.test(d.candidateId)).map((d) => d.candidateId) ?? []));
  record("Unticked records are sent as rejected", Boolean(body?.decisions?.some((d) => d.state === "rejected")));

  // Reload: the saved decisions, not the raw extraction, come back.
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "networkidle" });
  for (let i = 0; i < 4 && !(await review.isVisible()); i++) {
    const back = page.getByRole("button", { name: /^Back/i }).first();
    if (!(await back.count())) break;
    await back.click();
    await page.waitForTimeout(1500);
  }
  await review.waitFor({ timeout: 30_000 }).catch(() => undefined);
  const kappaAfter = review.locator("li", { hasText: "Kappa Systems" }).first();
  const reloaded = await review.isVisible();
  record("After a reload the review shows the saved decisions", reloaded && await kappaAfter.getByRole("checkbox").isChecked() && /Jun 2021/.test((await kappaAfter.textContent()) ?? ""), reloaded ? ((await kappaAfter.textContent()) ?? "").slice(0, 120) : "review not visible after reload");
  record("A restored correction is labelled as saved with the student's edit", reloaded && await kappaAfter.getByText("Saved with your edit").isVisible());
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
