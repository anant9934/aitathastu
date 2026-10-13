/**
 * GitHub OAuth post-connect sync, offline: GitHub's API is stubbed with real
 * per-request latency, the DB is in-memory PGlite.
 *
 *   DATABASE_URL= PGLITE_IN_MEMORY=true node --import tsx scripts/verify-github-oauth-sync.ts
 *
 * Covers: the callback awaits the sync before responding (no detached
 * promise), the sync persists projects and a completed sync_runs row, and a
 * 6-repo sync fits comfortably inside a serverless request.
 */
import fs from "node:fs";

process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY ||= "test-only-token-encryption-key-0123456789";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail !== undefined ? `  ${JSON.stringify(detail).slice(0, 300)}` : ""}`);
  if (!ok) failures++;
};

const LATENCY_MS = 200; // realistic serverless (us-east) -> api.github.com round-trip
const REPO_COUNT = 12;
const repos = Array.from({ length: REPO_COUNT }, (_, i) => ({
  id: i, name: `repo-${i}`, full_name: `octo/repo-${i}`, html_url: `https://github.com/octo/repo-${i}`,
  description: "demo", fork: false, private: false, language: "TypeScript", topics: [], stargazers_count: 0,
  forks_count: 0, pushed_at: new Date(Date.now() - i * 1000).toISOString(), default_branch: "main",
}));

let calls = 0;
let inFlight = 0;
let maxInFlight = 0;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  calls++;
  inFlight++;
  maxInFlight = Math.max(maxInFlight, inFlight);
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  inFlight--;
  if (url.endsWith("/users/octo")) return json({ id: 1, login: "octo", html_url: "https://github.com/octo", public_repos: REPO_COUNT, created_at: "2020-01-01T00:00:00Z" });
  if (/\/users\/octo\/repos\?/.test(url)) return json(/page=1\b/.test(url) ? repos : []);
  if (url.endsWith("/languages")) return json({ TypeScript: 100 });
  if (url.endsWith("/readme")) return new Response("# Demo\nA demo project.", { status: 200 });
  if (url.endsWith("/contents/package.json")) return new Response(JSON.stringify({ dependencies: { react: "18", next: "15" } }), { status: 200 });
  return new Response("not found", { status: 404 });
}) as typeof fetch;

async function main() {
  if (process.env.DATABASE_URL) throw new Error("Refusing to run with DATABASE_URL set; in-memory only.");

  // 1. Static: the callback must await the sync before building its response.
  const callback = fs.readFileSync("app/api/auth/github/callback/route.ts", "utf-8");
  check("callback has no fire-and-forget sync", !/void\s+syncGitHubConnection/.test(callback) && !/syncGitHubConnection\([^)]*\)\s*\.catch/.test(callback));
  const awaitAt = callback.indexOf("await syncGitHubConnection(");
  const redirectAt = callback.indexOf("success=github_connected");
  check("callback awaits the sync before the success redirect", awaitAt > 0 && awaitAt < redirectAt, { awaitAt, redirectAt });

  // 2. Behavioural: the exact calls the callback makes, in order, with latency.
  const { createUser } = await import("../lib/repositories/user-repository");
  const { connectGitHubAccount, syncGitHubConnection } = await import("../lib/services/github-sync-service");
  const { getProjectsByPersonId } = await import("../lib/repositories/project-repository");
  const { getDb, syncRuns } = await import("../lib/db");
  const { eq } = await import("drizzle-orm");

  const user = await createUser({ email: "gh.oauth@example.test", passwordHash: "x", displayName: "GH" });
  await connectGitHubAccount({ personId: user.personId, username: "octo", externalAccountId: "1", token: "gho_test_token", scopes: ["read:user"] });

  calls = 0;
  const started = Date.now();
  const result = await syncGitHubConnection(user.personId, "gho_test_token");
  const elapsed = Date.now() - started;
  const serialEstimate = calls * LATENCY_MS;
  console.log(`      sync: ${elapsed} ms, ${calls} GitHub calls, max ${maxInFlight} in flight (serial would be ~${serialEstimate} ms)`);

  check("sync succeeds", result.success === true, result.error);
  // Serverless synchronous function limit is typically 10-15 s; the callback also
  // spends ~2 round-trips on token exchange + /user before this.
  check(`6-repo sync completes well inside 10 s at ${LATENCY_MS} ms/request`, elapsed < 5000, elapsed);
  check("concurrency stays bounded (<= 10 requests in flight)", maxInFlight <= 10, maxInFlight);

  const projects = await getProjectsByPersonId(user.personId);
  check("projects persisted after the awaited sync returns", projects.length > 0, projects.length);

  const db = await getDb();
  const runs = await db.select().from(syncRuns).where(eq(syncRuns.personId, user.personId));
  check("sync_runs row recorded as completed (not left running)", runs.length === 1 && runs[0].status !== "running" && runs[0].status !== "failed", runs.map((r) => r.status));

  console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
