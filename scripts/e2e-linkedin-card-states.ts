/**
 * Browser checks for the LinkedIn card on onboarding's Sources step, on the
 * app's own isolated dev server (in-memory database). Extraction is switched
 * off for this server, so the real API can only answer "not configured"; the
 * other states come from a route mock of /api/student/linkedin/extract. No
 * LinkedIn page, Apify run or token is involved.
 *
 *   node --import tsx scripts/e2e-linkedin-card-states.ts   (E2E_MOBILE=1 for phone width)
 */
import { chromium, type Route } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startIsolatedServer } from "./e2e-isolation";

const OUT = process.env.E2E_OUT || path.join(os.tmpdir(), "aitathastu-e2e-linkedin");
const VIEWPORT = process.env.E2E_MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 900 };
fs.mkdirSync(OUT, { recursive: true });

const results: Array<{ check: string; ok: boolean; detail: string }> = [];
const record = (check: string, ok: boolean, detail = "") => {
  results.push({ check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${check}${detail ? `  — ${detail}` : ""}`);
};

const URL_ = "https://www.linkedin.com/in/asha-rao";
const zero = { experience: 0, education: 0, skill: 0, language: 0, certification: 0, course: 0, project: 0, publication: 0, volunteering: 0, honor: 0, link: 0 };
const job = (over: Record<string, unknown>) => ({
  id: "job_1", state: "running", trigger: "initial", step: "extracting", attempt: 1, maxAttempts: 3, retryAt: null, profileUrl: URL_,
  startedAt: new Date().toISOString(), finishedAt: null, errorCode: null, message: null, counts: {}, unavailableSections: [], ...over,
});
const saved = {
  profile: { fullName: "Asha Rao", headline: "ML engineer", location: "Pune", about: "Builds retrieval systems." },
  counts: { ...zero, experience: 2, education: 1, skill: 3, certification: 1, link: 1 },
  records: [
    { kind: "experience", data: { title: "ML Intern", company: "DeepAI Labs", startDate: "2024-01", endDate: "2024-06" }, missing: false },
    { kind: "experience", data: { title: "Engineer", company: "Acme", startDate: "2024-07", current: true }, missing: false },
    { kind: "education", data: { institution: "IIT Bombay", degree: "B.Tech", fieldOfStudy: "Computer Science", endDate: "2024" }, missing: false },
    { kind: "skill", data: { name: "Python" }, missing: false },
    { kind: "skill", data: { name: "PyTorch" }, missing: false },
    { kind: "skill", data: { name: "SQL" }, missing: false },
    { kind: "certification", data: { name: "AWS Cloud Practitioner", issuer: "Amazon Web Services" }, missing: false },
    { kind: "link", data: { url: "https://asha.dev", website: { title: "Asha Rao — Portfolio" } }, missing: false },
    { kind: "experience", data: { title: "Tutor", company: "Old Co" }, missing: true },
  ],
  lastSuccessfulAt: "2026-10-19T10:00:00.000Z",
};
const snapshot = (over: Record<string, unknown>) => ({ configured: true, state: "not_connected", profileUrl: null, lastSuccessfulAt: null, job: null, profile: null, counts: null, records: [], ...over });

async function main() {
  // Extraction off for this server whatever .env says: no provider call is possible.
  Object.assign(process.env, { APIFY_LINKEDIN_ACTOR_ID: "e2e-disabled", APIFY_LINKEDIN_TERMS_ACKNOWLEDGED: "false", APIFY_TOKEN: "e2e-disabled", FIRECRAWL_API_KEY: "e2e-disabled" });
  const server = await startIsolatedServer(OUT);
  const stop = () => { try { process.kill(-server.proc.pid!, "SIGTERM"); } catch { /* gone */ } };
  process.on("exit", stop);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: "reduce" });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !/status of (4\d\d|5\d\d)/.test(m.text())) consoleErrors.push(m.text()); });

  // A signed-out request is refused before anything else.
  const anon = await fetch(`${server.base}/api/student/linkedin/extract`, { method: "POST", headers: { "Content-Type": "application/json", Origin: server.base }, body: JSON.stringify({ profileUrl: URL_ }) });
  record("Signed-out POST is 401", anon.status === 401, String(anon.status));
  const anonGet = await fetch(`${server.base}/api/student/linkedin/extract`);
  record("Signed-out GET is 401", anonGet.status === 401, String(anonGet.status));
  const oldImport = await fetch(`${server.base}/api/student/linkedin/import`, { method: "POST" });
  record("The export upload endpoint no longer exists", oldImport.status === 404 || oldImport.status === 405, String(oldImport.status));

  // Onboarding until Sources (creates a guest session).
  await page.goto(`${server.base}/onboarding`, { waitUntil: "networkidle" });
  const advance = async (name: RegExp) => {
    const before = (await page.locator("h1").first().textContent())?.trim();
    await page.getByRole("button", { name }).last().click();
    await page.waitForFunction((prev) => document.querySelector("h1")?.textContent?.trim() !== prev, before, { timeout: 30_000 });
  };
  await page.getByLabel("What should I call you?").fill("Asha Test");
  await advance(/continue|let's|start|begin/i);
  await page.getByRole("radio").first().click();
  await advance(/^Continue/);
  await page.getByText("Machine Learning Engineer", { exact: true }).first().click();
  await advance(/^Continue/);
  await page.getByText("Learn AI & ML", { exact: true }).click();
  await advance(/^Continue/);
  await advance(/^Continue without a CV/);
  const card = page.locator('section[aria-labelledby="li-title"]');
  await card.waitFor({ timeout: 30_000 });

  // Real server: not configured.
  await card.getByText(/isn't available on this server/).waitFor({ timeout: 15_000 });
  record("Not configured: explained, link can still be saved", await card.getByRole("button", { name: "Save profile link" }).isVisible());
  record("Not configured: no extract button offered", (await card.getByRole("button", { name: /Extract LinkedIn Profile/ }).count()) === 0);
  record("No file upload anywhere on the card", (await card.locator('input[type="file"]').count()) === 0 && (await card.getByText(/upload|\.zip|\.csv/i).count()) === 0);
  record("LinkedIn appears once on Sources (no duplicate row)", (await page.getByRole("heading", { name: "LinkedIn", exact: true }).count()) === 1);
  const real = await page.request.post(`${server.base}/api/student/linkedin/extract`, { data: { profileUrl: URL_ }, headers: { Origin: server.base } });
  record("Signed-in POST without configuration is 503, not a fake success", real.status() === 503 && (await real.json()).code === "not_configured", String(real.status()));
  await card.screenshot({ path: path.join(OUT, "not-configured.png") });

  // Mocked states from here on.
  let current: Record<string, unknown> = snapshot({});
  const posts: Array<Record<string, unknown>> = [];
  let deletes = 0;
  let afterPost: Record<string, unknown> | null = null;
  const queue: Array<Record<string, unknown>> = [];
  await page.route("**/api/student/linkedin/extract", async (route: Route) => {
    const method = route.request().method();
    if (method === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push(body);
      if (body.profileUrl === "https://example.com/not-linkedin") return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "That isn't a LinkedIn profile URL. Use the form linkedin.com/in/your-name.", code: "invalid_url" }) });
      if (afterPost) current = afterPost;
      return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ job: (current as { job: unknown }).job, existing: false }) });
    }
    if (method === "DELETE") { deletes++; current = snapshot({ state: "cancelled", profileUrl: URL_, job: job({ state: "cancelled", step: "done" }) }); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ job: (current as { job: unknown }).job }) }); }
    if (queue.length) current = queue.shift()!;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });
  const show = async (s: Record<string, unknown>, label: string) => {
    current = s;
    await page.reload({ waitUntil: "networkidle" });
    await card.waitFor();
    await page.waitForTimeout(300);
    await card.screenshot({ path: path.join(OUT, `${label}.png`) });
  };

  // Ready: one primary action.
  await show(snapshot({}), "ready");
  const extractBtn = card.getByRole("button", { name: "Extract LinkedIn Profile" });
  record("Ready: URL field and a single Extract LinkedIn Profile button", await card.getByLabel("LinkedIn profile URL").isVisible() && (await extractBtn.count()) === 1);
  record("Ready: exactly one action button", (await card.getByRole("button").count()) === 1, String(await card.getByRole("button").count()));

  // Validation from the server is shown on the field.
  await card.getByLabel("LinkedIn profile URL").fill("https://example.com/not-linkedin");
  await extractBtn.click();
  await card.getByText(/isn't a LinkedIn profile URL/).waitFor({ timeout: 5_000 });
  record("Invalid URL: the field shows the server's reason", true);

  // Start → queued → running → succeeded, by polling.
  await card.getByLabel("LinkedIn profile URL").fill(URL_);
  afterPost = snapshot({ state: "queued", profileUrl: URL_, job: job({ state: "queued", step: "waiting" }) });
  queue.push(
    snapshot({ state: "running", profileUrl: URL_, job: job({ step: "extracting" }) }),
    snapshot({ state: "running", profileUrl: URL_, job: job({ step: "saving" }) }),
    snapshot({ state: "succeeded", profileUrl: URL_, job: job({ state: "succeeded", step: "done", counts: saved.counts }), ...saved }),
  );
  await extractBtn.click();
  record("Start sends the URL with action start", posts.at(-1)?.action === "start" && posts.at(-1)?.profileUrl === URL_, JSON.stringify(posts.at(-1)));
  await card.getByText(/Waiting to start|Reading your public profile/).waitFor({ timeout: 5_000 });
  record("Running: progress is shown and the field is locked", await card.getByLabel("LinkedIn profile URL").isDisabled() && await card.getByRole("button", { name: "Cancel" }).isVisible());
  await card.screenshot({ path: path.join(OUT, "running.png") });
  await card.getByText("Extracted", { exact: true }).waitFor({ timeout: 30_000 });
  record("Succeeded: status, timestamp and section counts", await card.getByText(/Last extracted/).isVisible() && /Experience\s*2/.test((await card.textContent()) ?? "") && /Skills\s*3/.test((await card.textContent()) ?? ""));
  record("Succeeded: the action becomes Refresh profile (no duplicate buttons)", await card.getByRole("button", { name: "Refresh profile" }).isVisible() && (await card.getByRole("button", { name: /Extract LinkedIn Profile/ }).count()) === 0);
  await card.getByRole("button", { name: "Show saved details" }).click();
  record("Saved details list records, mark ones no longer on the profile", await card.getByText("ML Intern · DeepAI Labs").isVisible() && await card.getByText("(no longer on your profile)").isVisible() && await card.getByText(/Asha Rao — Portfolio/).isVisible());
  await card.screenshot({ path: path.join(OUT, "succeeded.png") });

  // Refresh sends action refresh.
  afterPost = snapshot({ state: "running", profileUrl: URL_, job: job({ trigger: "refresh" }), ...saved });
  queue.push(snapshot({ state: "succeeded", profileUrl: URL_, job: job({ state: "succeeded", step: "done", trigger: "refresh" }), ...saved }));
  await card.getByRole("button", { name: "Refresh profile" }).click();
  record("Refresh sends action refresh", posts.at(-1)?.action === "refresh", JSON.stringify(posts.at(-1)));
  await card.getByRole("button", { name: "Refresh profile" }).waitFor({ timeout: 30_000 });

  // A failed refresh keeps the earlier profile and says so; retry is offered.
  await show(snapshot({ state: "failed", profileUrl: URL_, job: job({ state: "failed", step: "done", errorCode: "provider_unavailable", message: "The extraction service didn't respond after several attempts. Try again in a few minutes." }), ...saved }), "failed-refresh");
  record("Failed refresh: reason shown, earlier data kept", await card.getByText(/didn't respond after several attempts/).isVisible() && await card.getByText(/previously extracted profile is unchanged/).isVisible() && /Experience\s*2/.test((await card.textContent()) ?? ""));

  // A first extraction that failed: Retry extraction.
  await show(snapshot({ state: "failed", profileUrl: URL_, job: job({ state: "failed", step: "done", errorCode: "profile_unavailable", message: "LinkedIn didn't return this profile. Check that the URL is right and the profile is public." }) }), "failed");
  record("Failed: Retry extraction is the one action", await card.getByRole("button", { name: "Retry extraction" }).isVisible() && (await card.getByRole("button").count()) === 1);
  afterPost = snapshot({ state: "running", profileUrl: URL_, job: job({ trigger: "retry" }) });
  await card.getByRole("button", { name: "Retry extraction" }).click();
  record("Retry sends action retry", posts.at(-1)?.action === "retry", JSON.stringify(posts.at(-1)));

  // Backoff between attempts is explained.
  await show(snapshot({ state: "running", profileUrl: URL_, job: job({ attempt: 2, retryAt: new Date(Date.now() + 60_000).toISOString(), message: "The extraction service was busy; retrying automatically." }) }), "retrying");
  record("Retrying: automatic retry and attempt shown", await card.getByText(/retrying automatically/).isVisible() && await card.getByText(/attempt 2 of 3/).isVisible());
  await card.getByRole("button", { name: "Cancel" }).click();
  await card.getByText("Cancelled", { exact: true }).waitFor({ timeout: 10_000 });
  record("Cancel asks the server once", deletes === 1);

  // Partial.
  await show(snapshot({ state: "partial", profileUrl: URL_, job: job({ state: "partial", step: "done", unavailableSections: ["skill", "language"] }), ...saved, counts: { ...saved.counts, skill: 0 } }), "partial");
  record("Partial: explained, unavailable sections labelled", await card.getByText(/Some sections weren.t available/).isVisible() && /Skills\s*· not available/.test((await card.textContent()) ?? ""));

  // No horizontal scroll at this viewport.
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
