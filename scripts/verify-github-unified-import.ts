/**
 * Unified GitHub import through the real services, the real durable job and a
 * disposable LOCAL database (PGlite; scripts/lib/test-db.ts refuses hosted
 * hosts). GitHub is a fake fetch: no network, no real tokens, no real accounts.
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-github-unified-import.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";
import { GITHUB_MANIFESTS } from "../lib/connectors/github/graphql";

const OAUTH = "oauth-test-token";
const fake = {
  gone: new Set<string>(),               // installation IDs deleted on GitHub
  unreadable: new Set<string>(),         // repositories whose content query fails
  rateLimited: false,                    // App token creation rate-limited
  removedFromInstall: new Set<number>(), // repositories un-shared on GitHub after selection
  deepReads: [] as string[],             // every repository whose content was read
};

const restRepo = (id: number, owner: string, name: string, over: Record<string, unknown> = {}) => ({
  id, name, full_name: `${owner}/${name}`, private: false, description: `${name}`, html_url: `https://github.com/${owner}/${name}`,
  homepage: null, language: "TypeScript", stargazers_count: 1, forks_count: 0, fork: false, archived: false, default_branch: "main",
  created_at: "2025-01-01T00:00:00Z", updated_at: "2025-02-01T00:00:00Z", pushed_at: "2025-02-01T00:00:00Z",
  owner: { login: owner, id: 1 }, topics: [], ...over,
});
const PUBLIC = [restRepo(1, "asha", "r1"), restRepo(2, "asha", "r2", { fork: true }), restRepo(3, "asha", "r3"), restRepo(4, "asha", "empty")];
const INSTALLS: Record<string, ReturnType<typeof restRepo>[]> = {
  "42": [restRepo(9, "asha", "secret", { private: true }), PUBLIC[2]],
  "77": [restRepo(50, "acme", "infra", { private: true })],
  "88": Array.from({ length: 130 }, (_, i) => restRepo(1000 + i, "big", `repo${i}`, { private: true })),
};
const tokenFor = (id: string) => `inst-${id}`;

const pkgIndex = GITHUB_MANIFESTS.indexOf("package.json");
const deepNode = () => ({
  languages: { edges: [{ size: 900, node: { name: "TypeScript" } }] },
  readme: { text: "# Demo", isBinary: false, byteSize: 6 },
  [`m${pkgIndex}`]: { text: JSON.stringify({ dependencies: { react: "^18.3.1" } }), isBinary: false, byteSize: 40 },
  defaultBranchRef: { target: { all: { totalCount: 10 }, mine: { totalCount: 6, nodes: [{ committedDate: "2025-02-01T00:00:00Z" }] } } },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const realFetch = globalThis.fetch;

async function fakeGitHub(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (!url.startsWith("https://api.github.com")) return realFetch(input, init);
  const auth = new Headers(init?.headers).get("authorization") ?? "";
  const tokenMatch = url.match(/installations\/(\d+)\/access_tokens/);
  if (tokenMatch) {
    if (fake.gone.has(tokenMatch[1])) return json({ message: "Not Found" }, 404);
    if (fake.rateLimited) return json({ message: "API rate limit exceeded" }, 403);
    return json({ token: tokenFor(tokenMatch[1]), expires_at: "2099-01-01T00:00:00Z" }, 201);
  }
  if (url.includes("/installation/repositories")) {
    const id = Object.keys(INSTALLS).find((k) => auth.includes(tokenFor(k)));
    assert.ok(id, "installation repositories are listed only with an installation token");
    const page = Number(new URL(url).searchParams.get("page") || 1);
    const all = INSTALLS[id!].filter((r) => !fake.removedFromInstall.has(r.id));
    return json({ total_count: all.length, repositories: all.slice((page - 1) * 100, page * 100) });
  }
  if (url.includes("/users/asha/repos")) return json(PUBLIC);
  if (url.endsWith("/graphql")) {
    const query = String(JSON.parse(String(init?.body)).query);
    if (query.includes("user(login:") && query.includes("{ id }")) return json({ data: { user: { id: "U_asha" } } });
    if (query.includes("repositories(first:")) {
      assert.ok(auth.includes(OAUTH), "public listing uses the student's account token");
      return json({ data: { rateLimit: { remaining: 4999 }, user: {
        databaseId: 1, login: "asha", name: "Asha", bio: null, websiteUrl: null, location: null, company: null, url: "https://github.com/asha", avatarUrl: null, createdAt: "2020-01-01T00:00:00Z",
        followers: { totalCount: 0 }, following: { totalCount: 0 },
        repositories: { totalCount: PUBLIC.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes: PUBLIC.map((r) => ({
          databaseId: r.id, name: r.name, nameWithOwner: r.full_name, description: r.description, url: r.html_url, homepageUrl: null,
          stargazerCount: 1, forkCount: 0, isFork: r.fork, isPrivate: false, isArchived: false, isTemplate: false, isEmpty: r.name === "empty", diskUsage: r.name === "empty" ? 0 : 10,
          pushedAt: r.pushed_at, createdAt: r.created_at, updatedAt: r.updated_at, defaultBranchRef: r.name === "empty" ? null : { name: "main" }, primaryLanguage: r.name === "empty" ? null : { name: "TypeScript" },
          licenseInfo: null, repositoryTopics: { nodes: [] },
        })) },
      } } });
    }
    const repos = [...query.matchAll(/(r\d+):\s*repository\(owner:\s*"([^"]+)",\s*name:\s*"([^"]+)"\)/g)].map((m) => ({ alias: m[1], full: `${m[2]}/${m[3]}` }));
    for (const r of repos) {
      fake.deepReads.push(r.full);
      const owning = Object.keys(INSTALLS).find((k) => INSTALLS[k].some((x) => x.full_name === r.full && x.private));
      if (owning) assert.ok(auth.includes(tokenFor(owning)), `${r.full} is read only with its own installation's token`);
    }
    const data: Record<string, unknown> = { rateLimit: { remaining: 4999 } };
    const errors: unknown[] = [];
    for (const r of repos) {
      if (fake.unreadable.has(r.full)) { data[r.alias] = null; errors.push({ message: "Resource not accessible by integration", path: [r.alias] }); }
      else data[r.alias] = deepNode();
    }
    return json({ data, ...(errors.length ? { errors } : {}) });
  }
  return json({ message: "Not Found" }, 404);
}

before(async () => {
  await setupTestDatabase();
  process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.GITHUB_APP_ID = "123456";
  process.env.GITHUB_APP_SLUG = "tathastu-test";
  process.env.GITHUB_APP_PRIVATE_KEY = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
  globalThis.fetch = fakeGitHub as typeof fetch;
});
after(async () => {
  globalThis.fetch = realFetch;
  const { closeDbForTesting } = await import("../lib/db");
  await closeDbForTesting();
});

type Install = { id: string; login: string; type: "User" | "Organization" };
async function student(label: string, installs: Install[] = [{ id: "42", login: "asha", type: "User" }], signedIn = true) {
  const { connectGitHubAccount } = await import("../lib/services/github-sync-service");
  const { saveExternalConnection, getExternalConnectionByProvider } = await import("../lib/repositories/connection-repository");
  const { withInstallation } = await import("../lib/connectors/github/installations");
  const personId = await createTestPerson(label);
  if (signedIn) await connectGitHubAccount({ personId, username: "asha", externalAccountId: "1", token: OAUTH, scopes: ["read:user"] });
  else await saveExternalConnection({ personId, provider: "github", externalUsername: "asha", profileUrl: "https://github.com/asha", status: "connected", metadata: {} });
  let m = ((await getExternalConnectionByProvider(personId, "github"))!.metadata || {}) as Record<string, unknown>;
  for (const i of installs) m = { ...m, ...withInstallation(m, { id: i.id, accountLogin: i.login, accountId: i.id, accountType: i.type, repositorySelection: "selected" }) };
  await saveExternalConnection({ personId, provider: "github", externalUsername: "asha", profileUrl: "https://github.com/asha", metadata: m });
  return personId;
}

async function runToEnd(personId: string, jobId: string, maxSteps = 50) {
  const { advanceImportJob } = await import("../lib/services/github-import-job");
  let view = await advanceImportJob(personId, jobId, { budgetMs: 60_000 });
  for (let i = 0; i < maxSteps && view && ["queued", "running"].includes(view.status); i++) view = await advanceImportJob(personId, jobId, { budgetMs: 60_000 });
  return view;
}

async function start(personId: string, ids: number[]) {
  const { startGitHubImport } = await import("../lib/services/github-connect-service");
  const r = await startGitHubImport(personId, ids);
  if ("error" in r) throw new Error(`start failed: ${r.error}`);
  return r;
}

test("sign-in alone imports nothing; public, personal and organisation access merge by repository ID", async () => {
  const { getGitHubConnectOverview } = await import("../lib/services/github-connect-service");
  const { getProjectsByPersonId } = await import("../lib/repositories/project-repository");
  const personId = await student("gh-list", [{ id: "42", login: "asha", type: "User" }, { id: "77", login: "acme", type: "Organization" }]);
  const o = await getGitHubConnectOverview(personId);
  assert.equal(o.state, "selecting");
  assert.deepEqual(o.repositories.map((r) => r.id).sort((a, b) => a - b), [1, 2, 3, 4, 9, 50], "r3 appears once although two paths list it");
  assert.deepEqual([o.counts.public, o.counts.private], [4, 2]);
  assert.deepEqual(o.installations.map((i) => `${i.accountLogin}:${i.accountType}`).sort(), ["acme:Organization", "asha:User"], "personal and organisation installations coexist");
  assert.equal((await getProjectsByPersonId(personId)).length, 0);
});

test("a queued job imports only the selection, each private repo with its own installation's token; progress survives a refresh", async () => {
  const { getGitHubConnectOverview } = await import("../lib/services/github-connect-service");
  const { getProjectsByPersonId } = await import("../lib/repositories/project-repository");
  const { getEvidenceByPersonId } = await import("../lib/repositories/evidence-repository");
  const personId = await student("gh-job", [{ id: "42", login: "asha", type: "User" }, { id: "77", login: "acme", type: "Organization" }]);
  fake.deepReads = [];

  const started = await start(personId, [1, 9, 50, 777]);
  assert.equal(started.job.status, "queued", "the request returns at once with a queued job");
  assert.equal(started.job.total, 3, "777 isn't accessible to this student, so it is never queued");
  assert.equal((await getGitHubConnectOverview(personId)).state, "importing", "a refresh during the import shows it in progress");

  const done = await runToEnd(personId, started.jobId);
  assert.equal(done!.status, "completed");
  assert.equal(done!.done, 3);
  const urls = (await getProjectsByPersonId(personId)).map((p) => p.repositoryUrl).sort();
  assert.deepEqual(urls, ["https://github.com/acme/infra", "https://github.com/asha/r1", "https://github.com/asha/secret"]);
  assert.ok(!fake.deepReads.some((r) => ["asha/r2", "asha/r3", "asha/empty"].includes(r)), "unselected repositories are never read");

  const o = await getGitHubConnectOverview(personId);
  assert.equal(o.state, "imported");
  assert.equal(o.lastImport?.imported, 3);
  assert.ok(o.candidates?.projects.some((p) => p.url === "https://github.com/acme/infra"), "the organisation repository becomes a review candidate");

  const evidence = (await getEvidenceByPersonId(personId)).length;
  await runToEnd(personId, (await start(personId, [1, 9, 50])).jobId);
  assert.equal((await getProjectsByPersonId(personId)).length, 3, "re-import does not duplicate projects");
  assert.equal((await getEvidenceByPersonId(personId)).length, evidence, "re-import does not duplicate evidence");
});

test("a second request while one runs returns the same job; never a parallel import", async () => {
  const personId = await student("gh-dup");
  const a = await start(personId, [1, 9]);
  const b = await start(personId, [1, 3, 9]);
  assert.equal(b.jobId, a.jobId);
  assert.equal(b.existing, true);
  await runToEnd(personId, a.jobId);
});

test("130 granted repositories page correctly; a large selection runs in bounded batches", async () => {
  const { getGitHubConnectOverview } = await import("../lib/services/github-connect-service");
  const { advanceImportJob, BATCH_SIZE } = await import("../lib/services/github-import-job");
  const personId = await student("gh-big", [{ id: "88", login: "asha", type: "User" }], false);
  const o = await getGitHubConnectOverview(personId);
  assert.equal(o.counts.private, 130, "both pages of the installation's repositories are listed");
  const ids = o.repositories.slice(0, 8).map((r) => r.id);
  const job = await start(personId, ids);
  const step = await advanceImportJob(personId, job.jobId, { budgetMs: 1 });
  assert.equal(step!.done, BATCH_SIZE, `one step processes one bounded batch: ${JSON.stringify(step)}`);
  const end = await runToEnd(personId, job.jobId);
  assert.equal(end!.done, 8);
});

test("a crashed step resumes from saved progress without repeating finished repositories", async () => {
  const { advanceImportJob } = await import("../lib/services/github-import-job");
  const { getDb, sourceProcessingJobs } = await import("../lib/db");
  const { eq, sql } = await import("drizzle-orm");
  const personId = await student("gh-crash", [{ id: "88", login: "asha", type: "User" }], false);
  const job = await start(personId, [1000, 1001, 1002, 1003, 1004, 1005]);
  await advanceImportJob(personId, job.jobId, { budgetMs: 1 });
  // A worker claimed the next batch and died: the lease is held but no progress was written.
  const db = await getDb();
  await db.update(sourceProcessingJobs).set({ metadata: sql`${sourceProcessingJobs.metadata} || ${JSON.stringify({ leaseUntil: Date.now() + 60_000, leaseToken: "dead" })}::jsonb` }).where(eq(sourceProcessingJobs.id, job.jobId));
  const blocked = await advanceImportJob(personId, job.jobId, { budgetMs: 60_000 });
  assert.equal(blocked!.done, 3, "nobody runs a batch while another holds the lease");
  fake.deepReads = [];
  const later = Date.now() + 61_000;
  const resumed = await advanceImportJob(personId, job.jobId, { budgetMs: 60_000, now: () => later });
  assert.equal(resumed!.status, "completed");
  assert.equal(resumed!.done, 6);
  assert.ok(!fake.deepReads.some((r) => ["big/repo0", "big/repo1", "big/repo2"].includes(r)), "finished repositories are not read again");
});

test("one unreadable repository: partial import, then retrying just that one completes it", async () => {
  const { getGitHubConnectOverview } = await import("../lib/services/github-connect-service");
  const personId = await student("gh-partial");
  fake.unreadable.add("asha/secret");
  try {
    const first = await runToEnd(personId, (await start(personId, [1, 9])).jobId);
    assert.equal(first!.status, "partial");
    assert.deepEqual(first!.failed.map((f) => f.repo), ["asha/secret"]);
    assert.equal((await getGitHubConnectOverview(personId)).state, "partial");
  } finally {
    fake.unreadable.delete("asha/secret");
  }
  const retry = await runToEnd(personId, (await start(personId, [9])).jobId);
  assert.equal(retry!.status, "completed");
});

test("a GitHub rate limit pauses the job until the backoff passes; nothing is reported done early", async () => {
  const { advanceImportJob } = await import("../lib/services/github-import-job");
  const personId = await student("gh-rate");
  const job = await start(personId, [9]);
  fake.rateLimited = true;
  let view;
  try {
    view = await advanceImportJob(personId, job.jobId, { budgetMs: 60_000 });
    assert.equal(view!.status, "waiting");
    assert.equal(view!.done, 0);
    assert.ok(view!.waitingUntil);
  } finally {
    fake.rateLimited = false;
  }
  view = await advanceImportJob(personId, job.jobId, { budgetMs: 60_000 });
  assert.equal(view!.status, "waiting", "the pause is respected even once GitHub recovers");
  const later = Date.parse(view!.waitingUntil!) + 1000;
  view = await advanceImportJob(personId, job.jobId, { budgetMs: 60_000, now: () => later });
  assert.equal(view!.status, "completed");
});

test("a repository un-shared after selection fails with a clear reason; the rest import", async () => {
  const personId = await student("gh-removed");
  const job = await start(personId, [1, 9]);
  fake.removedFromInstall.add(9);
  try {
    const end = await runToEnd(personId, job.jobId);
    assert.equal(end!.status, "partial");
    assert.deepEqual(end!.failed, [{ repo: "asha/secret", reason: "no_longer_available" }]);
  } finally {
    fake.removedFromInstall.delete(9);
  }
});

test("an empty repository imports without failing the job", async () => {
  const personId = await student("gh-empty");
  const done = await runToEnd(personId, (await start(personId, [4])).jobId);
  assert.equal(done!.status, "completed");
});

test("stopping an import ends it after the current batch; imported work stays", async () => {
  const { requestImportCancel, advanceImportJob } = await import("../lib/services/github-import-job");
  const { getProjectsByPersonId } = await import("../lib/repositories/project-repository");
  const personId = await student("gh-cancel", [{ id: "88", login: "asha", type: "User" }], false);
  const job = await start(personId, [1000, 1001, 1002, 1003, 1004, 1005]);
  await advanceImportJob(personId, job.jobId, { budgetMs: 1 });
  const cancelled = await requestImportCancel(personId, job.jobId);
  assert.equal(cancelled!.status, "cancelled");
  assert.equal(cancelled!.done, 3);
  assert.equal((await getProjectsByPersonId(personId)).length, 3, "repositories imported before the stop are kept");
});

test("a removed organisation installation is revoked on its own; personal access keeps working", async () => {
  const { getGitHubConnectOverview } = await import("../lib/services/github-connect-service");
  const { getProjectsByPersonId } = await import("../lib/repositories/project-repository");
  const personId = await student("gh-revoke", [{ id: "42", login: "asha", type: "User" }, { id: "77", login: "acme", type: "Organization" }]);
  await runToEnd(personId, (await start(personId, [9, 50])).jobId);
  fake.gone.add("77");
  try {
    const o = await getGitHubConnectOverview(personId);
    assert.notEqual(o.state, "revoked", "public and personal access still work");
    assert.equal(o.installations.find((i) => i.id === "77")!.revoked, true);
    assert.ok(!o.repositories.some((r) => r.id === 50), "the organisation's repository is no longer offered");
    assert.ok(o.repositories.some((r) => r.id === 9));
    assert.equal((await getProjectsByPersonId(personId)).length, 2, "nothing already imported is deleted");
    assert.equal((await getGitHubConnectOverview(personId)).installations.find((i) => i.id === "77")!.revoked, true, "still revoked after a refresh");
    fake.gone.add("42");
    const appOnly = await student("gh-revoke-all", [{ id: "42", login: "asha", type: "User" }], false);
    assert.equal((await getGitHubConnectOverview(appOnly)).state, "revoked", "no sign-in and every installation gone: access revoked");
  } finally {
    fake.gone.clear();
  }
});

test("another student can't see, import, advance or stop this student's GitHub work", async () => {
  const { getGitHubConnectOverview, startGitHubImport } = await import("../lib/services/github-connect-service");
  const { advanceImportJob, requestImportCancel } = await import("../lib/services/github-import-job");
  const owner = await student("gh-owner");
  const job = await start(owner, [1]);
  const other = await createTestPerson("gh-other");
  assert.equal((await getGitHubConnectOverview(other)).state, "not_connected");
  const r = await startGitHubImport(other, [1, 9]);
  assert.ok("error" in r && r.status === 409);
  assert.equal(await advanceImportJob(other, job.jobId), null);
  assert.equal(await requestImportCancel(other, job.jobId), null);
  await runToEnd(owner, job.jobId);
});

test("a job silent for a day is closed by the cron, never left 'Importing'", async () => {
  const { resumeStalledImports } = await import("../lib/services/github-import-job");
  const { getDb, sourceProcessingJobs } = await import("../lib/db");
  const { eq, sql } = await import("drizzle-orm");
  const personId = await student("gh-stale");
  const job = await start(personId, [1]);
  const db = await getDb();
  await db.update(sourceProcessingJobs).set({ metadata: sql`${sourceProcessingJobs.metadata} || ${JSON.stringify({ heartbeatAt: Date.now() - 25 * 60 * 60_000 })}::jsonb` }).where(eq(sourceProcessingJobs.id, job.jobId));
  const out = await resumeStalledImports({ limit: 50 });
  const mine = out.find((o) => o.jobId === job.jobId);
  assert.ok(mine && mine.status === "failed", JSON.stringify(mine));
});

test("the daily stuck-job sweep leaves a long healthy import alone", async () => {
  const { SourceProcessingJobService } = await import("../lib/services/source-processing-job-service");
  const { getDb, sourceProcessingJobs } = await import("../lib/db");
  const { eq } = await import("drizzle-orm");
  const personId = await student("gh-long");
  const job = await start(personId, [1]);
  const db = await getDb();
  await db.update(sourceProcessingJobs).set({ startedAt: new Date(Date.now() - 60 * 60_000) }).where(eq(sourceProcessingJobs.id, job.jobId));
  await SourceProcessingJobService.recoverStuckJobs(15);
  assert.equal((await SourceProcessingJobService.getJobForPerson(job.jobId, personId))!.status, "queued");
  await runToEnd(personId, job.jobId);
});

test("private commit evidence counts only commits GitHub links to the student", async () => {
  const { getProjectsByPersonId } = await import("../lib/repositories/project-repository");
  const personId = await student("gh-commits");
  await runToEnd(personId, (await start(personId, [9])).jobId);
  const [secret] = await getProjectsByPersonId(personId);
  assert.deepEqual((secret.metadata as Record<string, unknown>).commitEvidence, { total: 10, authored: 6, latestAuthoredAt: "2025-02-01T00:00:00Z", authorship: "github_author_filter" });
});
