/**
 * Task 2.2.5 in the browser: all sources listed as optional, handle edit with
 * validation, Sync now running in the background with progress (one real
 * LeetCode lookup for a handle that does not exist, so no real person's data),
 * and Disconnect purging stored credentials. Needs the :3100 test server.
 *
 *   node --import tsx scripts/visual-phase2-connections.ts <outDir>
 */
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const out = process.argv[2] || ".";

async function main() {
  const { useTestDatabase } = await import("./lib/test-db");
  await useTestDatabase();
  const { createUser } = await import("../lib/repositories/user-repository");
  const { hashPassword } = await import("../lib/auth/password");
  const { saveExternalConnection, getExternalConnectionByProvider } = await import("../lib/repositories/connection-repository");
  const { latestSyncOperations } = await import("../lib/sync/sync-operation");
  const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");

  const email = `p2-conn-${Date.now()}@test.invalid`;
  const { personId } = await createUser({ email, passwordHash: await hashPassword("visual-check-pw"), displayName: "Kavya Raman" });
  await completeOnboarding(personId, { role: "student", name: "Kavya Raman", targetRole: "Machine Learning Engineer", priorities: ["learning"], primaryPriority: "learning", skills: ["Python"], projects: [] });
  await saveExternalConnection({ personId, provider: "kaggle", externalUsername: "kavya-test", profileUrl: "https://www.kaggle.com/kavya-test", status: "connected", metadata: { encryptedApiKey: "enc:placeholder" } });

  const browser = await chromium.launch();
  const result: Record<string, unknown> = {};
  for (const width of [1280, 375]) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password: "visual-check-pw" } });
    await page.goto(`${BASE}/student/connections`);
    const mgr = page.getByTestId("connection-manager");
    await mgr.locator("li[data-source]").first().waitFor({ timeout: 120_000 });
    const r: Record<string, unknown> = {};
    r.sources = await mgr.locator("li[data-source]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-source")}:${e.getAttribute("data-badge")}`));
    r.optionalNotice = await mgr.getByText("Every platform here is optional.").isVisible();

    if (width === 1280) {
      const lc = mgr.locator('li[data-source="leetcode"]');
      await lc.getByRole("button", { name: "Add username" }).click();
      await lc.getByLabel("LeetCode username").fill("kavya r!");
      await lc.getByRole("button", { name: "Save" }).click();
      r.badHandleError = await lc.getByRole("alert").innerText();
      await lc.getByLabel("LeetCode username").fill("tathastu-no-such-user-zz9");
      await lc.getByRole("button", { name: "Save" }).click();
      await lc.getByText("LeetCode saved.", { exact: false }).waitFor();
      r.afterSaveBadge = await lc.getAttribute("data-badge");
      await mgr.screenshot({ path: path.join(out, `p2-connections-before-sync-${width}.png`) });

      // Sync now: returns at once, the row shows progress, then settles.
      const t0 = Date.now();
      await lc.getByRole("button", { name: "Sync now" }).click();
      const seen = new Set<string>();
      while (Date.now() - t0 < 90_000) {
        const b = await lc.getAttribute("data-badge");
        if (b) seen.add(b);
        if (seen.has("syncing") && b !== "syncing") break;
        await page.waitForTimeout(300);
      }
      r.syncBadgesSeen = [...seen];
      r.syncSettledMs = Date.now() - t0;
      await lc.getByText("Syncing LeetCode…").waitFor({ state: "detached", timeout: 20_000 });
      r.outcomeNotice = await lc.locator("p[id^=n-]").innerText();
      r.afterSyncRowText = (await lc.innerText()).replace(/\s+/g, " ").slice(0, 300);
      const op = (await latestSyncOperations(personId)).find((o) => o.source === "leetcode");
      r.dbSyncOperation = op ? { state: op.state, attempts: op.attempts, lastErrorCode: op.lastErrorCode } : null;

      // Disconnect Kaggle with confirm.
      const kg = mgr.locator('li[data-source="kaggle"]');
      await kg.getByRole("button", { name: "Disconnect" }).click();
      r.confirmText = await kg.getByRole("group").innerText();
      await kg.getByRole("button", { name: "Disconnect Kaggle" }).click();
      await kg.getByText("Kaggle disconnected.", { exact: false }).waitFor();
      r.kaggleBadge = await kg.getAttribute("data-badge");
      const kconn = await getExternalConnectionByProvider(personId, "kaggle");
      r.kaggleDb = { status: kconn?.status, metadata: kconn?.metadata };
    }
    await mgr.screenshot({ path: path.join(out, `p2-connections-${width}.png`) });
    r.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    r.pageErrors = errors;
    result[width] = r;
    await page.close();
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  const { closeDbForTesting } = await import("../lib/db");
  await closeDbForTesting();
}
main().catch((e) => { console.error(e); process.exit(1); });
