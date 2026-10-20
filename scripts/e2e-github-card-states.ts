/**
 * Browser checks for every state of the GitHub card, on the app's own isolated
 * dev server (in-memory database). The card's one data source,
 * /api/student/connections/github/repositories, is answered by the test, so
 * no GitHub account, token or network call is involved.
 *
 *   node --import tsx scripts/e2e-github-card-states.ts   (E2E_MOBILE=1 / E2E_TABLET=1)
 */
import { chromium, type Page, type Route } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startIsolatedServer } from "./e2e-isolation";
import type { GitHubConnectOverview } from "../lib/services/github-connect-service";

const OUT = process.env.E2E_OUT || path.join(os.tmpdir(), "aitathastu-e2e-github");
const VIEWPORT = process.env.E2E_MOBILE ? { width: 390, height: 844 } : process.env.E2E_TABLET ? { width: 820, height: 1180 } : { width: 1280, height: 900 };
fs.mkdirSync(OUT, { recursive: true });

const results: Array<{ check: string; ok: boolean; detail: string }> = [];
const record = (check: string, ok: boolean, detail = "") => {
  results.push({ check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${check}${detail ? `  — ${detail}` : ""}`);
};

const repo = (id: number, name: string, isPrivate: boolean, selected: boolean, access: Array<"public" | "app_installation">) => ({
  id, fullName: `asha/${name}`, name, url: `https://github.com/asha/${name}`, description: `${name} description`, private: isPrivate,
  fork: false, archived: false, language: "TypeScript", pushedAt: "2025-02-01T00:00:00Z", owner: "asha", access, selected,
});

function overview(state: GitHubConnectOverview["state"], extra: Partial<GitHubConnectOverview> = {}): GitHubConnectOverview {
  const repositories = state === "revoked" || state === "not_connected" ? [] : [
    repo(1, "chatdocs", false, true, ["public"]),
    repo(2, "notes", false, false, ["public"]),
    { ...repo(9, "secret-ml", true, true, ["app_installation"]), installationIds: ["42"] },
    { ...repo(50, "infra", true, false, ["app_installation"]), fullName: "acme/infra", owner: "acme", installationIds: ["77"] },
  ].map((r) => ({ installationIds: [] as string[], ...r }));
  const granted = !["awaiting_approval", "revoked", "not_connected"].includes(state);
  return {
    state,
    configured: { signIn: true, app: true },
    account: { login: state === "not_connected" ? null : "asha", verified: state !== "not_connected" && state !== "revoked" },
    installation: { installed: state !== "awaiting_approval" && state !== "revoked" && state !== "not_connected", accountLogin: "asha", selection: "selected", approvalPending: state === "awaiting_approval", revoked: state === "revoked" },
    counts: { accessible: repositories.length, public: repositories.filter((r) => !r.private).length, private: repositories.filter((r) => r.private).length, selected: repositories.filter((r) => r.selected).length },
    installations: granted
      ? [{ id: "42", accountLogin: "asha", accountType: "User", repositorySelection: "selected", revoked: false }, { id: "77", accountLogin: "acme", accountType: "Organization", repositorySelection: "selected", revoked: false }]
      : state === "revoked" ? [{ id: "42", accountLogin: "asha", accountType: "User", repositorySelection: "selected", revoked: true }] : [],
    lastImport: null,
    job: null,
    candidates: null,
    repositories,
    listErrors: [],
    ...extra,
  } as GitHubConnectOverview;
}

async function walkToSources(page: Page, base: string) {
  await page.goto(`${base}/onboarding`, { waitUntil: "networkidle" });
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
}

async function main() {
  const server = await startIsolatedServer(OUT);
  const stop = () => { try { process.kill(-server.proc.pid!, "SIGTERM"); } catch { /* gone */ } };
  process.on("exit", stop);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: VIEWPORT, reducedMotion: "reduce" })).newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !/status of (207|502)/.test(m.text())) consoleErrors.push(m.text()); });

  await walkToSources(page, server.base);
  record("Reached Sources", (await page.locator("h1").first().textContent())?.includes("Connect the sources") ?? false);

  let current = overview("selecting");
  const posts: number[][] = [];
  let deletes = 0;
  // The job state the fake server reports on every poll, until the test moves it on.
  let jobNow: Record<string, unknown> = {};
  let afterJob: GitHubConnectOverview | null = null;
  const job = (over: Record<string, unknown>) => ({ id: "job_1", status: "running", total: 3, done: 0, failed: [], waitingUntil: null, ...over });
  await page.route("**/api/student/connections/github/repositories", async (route: Route) => {
    if (route.request().method() === "POST") {
      posts.push((route.request().postDataJSON() as { repositoryIds: number[] }).repositoryIds);
      return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ jobId: "job_1", job: job({ status: "queued", total: posts.at(-1)!.length }), existing: false, unconfirmed: [] }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });
  await page.route("**/api/student/connections/github/import-jobs/**", async (route: Route) => {
    if (route.request().method() === "DELETE") {
      deletes++;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(job({ status: "cancelling", done: 1 })) });
    }
    if (!["queued", "running", "waiting", "cancelling"].includes(String(jobNow.status)) && afterJob) current = afterJob;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(jobNow) });
  });
  const card = page.locator('section[aria-labelledby="github-card-title"]');
  const show = async (o: GitHubConnectOverview, label: string) => {
    current = o;
    await page.reload({ waitUntil: "networkidle" });
    await card.waitFor();
    await card.screenshot({ path: path.join(OUT, `${label}.png`) });
  };

  // Choosing repositories.
  await show(overview("selecting"), "selecting");
  record("Selecting: status reads 'Choose repositories'", await card.getByText("Choose repositories", { exact: true }).isVisible());
  record("Selecting: signed-in account shown", await card.getByText("@asha").isVisible());
  record("Selecting: personal and organisation access both shown", await card.getByText("asha (personal)").isVisible() && await card.getByText("acme (organisation)").isVisible());
  record("Selecting: public and private repositories labelled", (await card.getByText("Private", { exact: true }).count()) === 2 && (await card.getByText("Public", { exact: true }).count()) === 2);
  record("Selecting: the saved selection is preselected", await card.getByLabel(/asha\/chatdocs/).isChecked() && !(await card.getByLabel(/asha\/notes/).isChecked()));
  record("No 'Imported' before anything was imported", (await card.getByText("Imported", { exact: true }).count()) === 0);

  // A parent re-render (e.g. an autosave) must not re-list GitHub or reset checkboxes.
  let overviewLoads = 0;
  page.on("request", (r) => { if (r.method() === "GET" && r.url().endsWith("/api/student/connections/github/repositories")) overviewLoads++; });
  await card.getByLabel(/asha\/notes/).check();
  await page.getByRole("button", { name: /What linking, signing in/ }).or(page.getByText("What linking, signing in and importing mean")).first().click();
  await page.waitForTimeout(1500);
  record("Parent re-renders don't reload the repository list or reset choices", overviewLoads === 0 && await card.getByLabel(/asha\/notes/).isChecked(), `loads=${overviewLoads}`);
  await card.getByLabel(/asha\/notes/).uncheck();

  // Keyboard: reach a checkbox and toggle it with Space.
  await card.getByLabel(/asha\/notes/).focus();
  await page.keyboard.press("Space");
  record("Keyboard toggles a repository", await card.getByLabel(/asha\/notes/).isChecked());
  await page.keyboard.press("Space");

  // Import: queued at once, real progress while it runs, a rate-limit pause, then the persisted result.
  afterJob = overview("partial", { lastImport: { status: "partial", at: "2025-02-02T00:00:00Z", accessible: 4, selected: 2, imported: 1, failed: [{ repo: "asha/secret-ml", reason: "resource_not_accessible" }], jobId: "job_1" } as never });
  jobNow = job({ total: 2, done: 0, status: "queued" });
  await card.getByRole("button", { name: /^Import 2 selected repositories/ }).click();
  record("Import sends exactly the selected IDs", JSON.stringify([...posts[0]].sort()) === JSON.stringify([1, 9]), JSON.stringify(posts[0]));
  await card.getByText(/Import queued/).waitFor({ timeout: 5_000 });
  record("Queued import shows at once", true);
  jobNow = job({ total: 2, done: 1 });
  await card.getByText("Imported 1 of 2").waitFor({ timeout: 10_000 });
  record("Progress shows real counts and a progress bar", await card.getByRole("progressbar", { name: "Import progress" }).isVisible());
  record("Students are told they can leave", await card.getByText(/You can leave this page/).isVisible());
  jobNow = job({ total: 2, done: 1, status: "waiting", waitingUntil: new Date(Date.now() + 5 * 60_000).toISOString() });
  await card.getByText(/GitHub asked us to slow down/).waitFor({ timeout: 10_000 });
  record("A rate-limit pause is explained, not shown as failure", (await card.getByText("Needs attention", { exact: true }).count()) === 0);
  await card.screenshot({ path: path.join(OUT, "importing.png") });
  jobNow = job({ total: 2, done: 1, failed: [{ repo: "asha/secret-ml", reason: "resource_not_accessible" }], status: "partial" });
  await card.getByText("Partly imported", { exact: true }).first().waitFor({ timeout: 15_000 });
  record("Finished import shows persisted counts", /1\s*of\s*2\s*selected imported[\s\S]*1\s*failed/.test((await card.textContent()) ?? ""));
  record("Failed repository is named with its reason", await card.getByText(/resource not accessible/).isVisible());
  await card.screenshot({ path: path.join(OUT, "partial.png") });

  afterJob = null;
  jobNow = job({ total: 1, done: 0, status: "queued" });
  setTimeout(() => { jobNow = job({ total: 1, done: 1, status: "completed" }); }, 4000);
  afterJob = overview("imported", { lastImport: { status: "completed", at: "2025-02-02T00:01:00Z", accessible: 4, selected: 2, imported: 2, failed: [], jobId: "job_2" } as never });
  await card.getByRole("button", { name: "Retry failed" }).click();
  await card.getByText("Imported", { exact: true }).waitFor({ timeout: 15_000 });
  record("Retry sends only the failed repository", JSON.stringify(posts[1]) === "[9]", JSON.stringify(posts[1]));

  // Stopping an import.
  await show(overview("selecting"), "selecting-again");
  afterJob = null;
  jobNow = job({ total: 2, done: 0 });
  await card.getByRole("button", { name: /^Import 2 selected/ }).click();
  await card.getByRole("button", { name: "Stop import" }).click();
  await card.getByText(/Stopping after the current repositories/).waitFor({ timeout: 10_000 });
  record("Stop import asks the server to cancel and says what happens", deletes === 1);
  jobNow = job({ total: 2, done: 1, status: "cancelled" });
  afterJob = overview("partial", { lastImport: { status: "cancelled", at: "2025-02-02T00:02:00Z", accessible: 4, selected: 2, imported: 1, failed: [], jobId: "job_3" } as never });
  await card.getByText("Import stopped").waitFor({ timeout: 15_000 });
  record("A stopped import keeps and reports what was imported", /1\s*of\s*2\s*selected imported/.test((await card.textContent()) ?? ""));

  // Organization approval pending.
  await show(overview("awaiting_approval"), "awaiting-approval");
  record("Approval pending: status and explanation", await card.getByText("Approval pending").first().isVisible() && await card.getByText(/organization.s owner/).isVisible());
  record("Approval pending: no private access claimed", (await card.getByText(/Private access granted/).count()) === 0);

  // Revoked.
  await show(overview("revoked"), "revoked");
  record("Revoked: status, reassurance and reconnect", await card.getByText("Access revoked", { exact: true }).isVisible() && await card.getByText(/Everything already imported stays/).isVisible() && await card.getByRole("link", { name: "Connect GitHub again" }).isVisible());
  record("Revoked: no repository list offered", (await card.locator('input[type="checkbox"]').count()) === 0);

  // One organisation installation removed while the personal one still works.
  await show(overview("selecting", { installations: [{ id: "42", accountLogin: "asha", accountType: "User", repositorySelection: "selected", revoked: false }, { id: "77", accountLogin: "acme", accountType: "Organization", repositorySelection: "selected", revoked: true }] }), "org-removed");
  record("A removed organisation is named; personal access still listed", await card.getByText(/Access through acme \(organisation\) was removed on GitHub/).isVisible() && await card.getByText("asha (personal)").isVisible());

  // Imported and needs attention.
  await show(overview("imported", { lastImport: { status: "completed", at: "2025-02-02T00:00:00Z", accessible: 3, selected: 2, imported: 2, failed: [] } as never }), "imported");
  record("Imported: only after a recorded import, with counts", await card.getByText("Imported", { exact: true }).isVisible() && /2\s*of\s*2\s*selected imported/.test((await card.textContent()) ?? ""));
  await show(overview("needs_attention", { lastImport: { status: "failed", at: "2025-02-02T00:00:00Z", accessible: 3, selected: 2, imported: 0, failed: [{ repo: "asha/chatdocs", reason: "rate_limited" }] } as never, listErrors: [{ source: "public", reason: "rate_limited" }] }), "needs-attention");
  record("Needs attention: status, rate-limit explanation and retry", await card.getByText("Needs attention", { exact: true }).isVisible() && await card.getByText(/rate limit/i).first().isVisible() && await card.getByRole("button", { name: "Retry failed" }).isVisible());

  // Layout: nothing wider than the viewport.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record("No horizontal scrolling", overflow <= 1, `overflow=${overflow}px`);

  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, consoleErrors }, null, 2));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed ? `${failed} CHECK(S) FAILED` : "ALL CHECKS PASSED"} (${results.length - failed}/${results.length}); console errors: ${consoleErrors.length}`);
  await browser.close();
  stop();
  process.exitCode = failed || consoleErrors.length ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; process.exit(); });
