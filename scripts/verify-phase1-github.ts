/**
 * Tasks 1.5.1-1.5.3 + 1.9.1/1.9.2 on a real scraper: GitHub sync through the
 * sync framework, against local Postgres, with api.github.com stubbed.
 */
import { test, describe, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

let db: Awaited<ReturnType<typeof setupTestDatabase>>;
let schema: typeof import("../lib/db");
let gh: typeof import("../lib/services/github-sync-service");
let conn: typeof import("../lib/repositories/connection-repository");
let rl: typeof import("../lib/connectors/rate-limiter");

before(async () => {
  db = await setupTestDatabase();
  schema = await import("../lib/db");
  gh = await import("../lib/services/github-sync-service");
  conn = await import("../lib/repositories/connection-repository");
  rl = await import("../lib/connectors/rate-limiter");
});
after(async () => { await schema.closeDbForTesting(); });

type RepoSpec = { name: string; pushedAt: string; packageJson?: string | null; binaryPackage?: boolean };
const repoNode = (r: RepoSpec, i: number) => ({
  databaseId: 1000 + i, name: r.name, nameWithOwner: `asha/${r.name}`, description: `${r.name} project`, url: `https://github.com/asha/${r.name}`,
  homepageUrl: null, stargazerCount: i, forkCount: 0, isFork: false, isPrivate: false, isArchived: false, pushedAt: r.pushedAt,
  createdAt: "2024-01-01T00:00:00Z", updatedAt: r.pushedAt, defaultBranchRef: { name: "main" }, primaryLanguage: { name: "TypeScript" },
  repositoryTopics: { nodes: [{ topic: { name: "ml" } }] },
});
const user = (repos: RepoSpec[]) => ({
  databaseId: 42, login: "asha", name: "Asha", bio: null, websiteUrl: null, location: null, company: null, url: "https://github.com/asha",
  avatarUrl: "", createdAt: "2020-01-01T00:00:00Z", followers: { totalCount: 1 }, following: { totalCount: 1 },
  repositories: { totalCount: repos.length, nodes: repos.map(repoNode) },
});

const realFetch = globalThis.fetch;
let graphqlCalls: { query: string; headers: Headers }[] = [];
function stubGitHub(repos: RepoSpec[], opts: { status?: number; headers?: Record<string, string>; aliasError?: number } = {}) {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    assert.equal(String(url), "https://api.github.com/graphql", "only the GraphQL endpoint may be called");
    const body = JSON.parse(String(init?.body));
    graphqlCalls.push({ query: body.query, headers: new Headers(init?.headers) });
    if (opts.status) return new Response("{}", { status: opts.status, headers: opts.headers });
    if (body.query.includes("user(login")) return Response.json({ data: { rateLimit: { remaining: 4999 }, user: user(repos) } });
    // Deep query: answer each aliased repository block.
    const data: Record<string, unknown> = { rateLimit: { remaining: 4998 } };
    const errors: unknown[] = [];
    for (const m of body.query.matchAll(/(r\d+): repository\(owner: "asha", name: "([^"]+)"\)/g)) {
      const [alias, name] = [m[1], m[2]];
      const spec = repos.find((r) => r.name === name)!;
      if (opts.aliasError !== undefined && alias === `r${opts.aliasError}`) { data[alias] = null; errors.push({ path: [alias], message: "Something went wrong" }); continue; }
      data[alias] = {
        languages: { edges: [{ size: 900, node: { name: "TypeScript" } }, { size: 100, node: { name: "Python" } }] },
        readme: { text: `# ${name}\nBuilt with React`, isBinary: false, byteSize: 20 },
        m0: spec.binaryPackage ? { text: null, isBinary: true, byteSize: 9 } : spec.packageJson === null ? null : { text: spec.packageJson ?? JSON.stringify({ dependencies: { react: "18", next: "15" } }), isBinary: false, byteSize: 50 },
        m1: name.endsWith("0") ? { text: "torch==2.3\nnumpy", isBinary: false, byteSize: 20 } : null,
        m2: null, m3: null, m4: null, m5: null, m6: null, m7: null,
      };
    }
    return Response.json({ data, errors: errors.length ? errors : undefined });
  }) as typeof fetch;
}
const repos20 = Array.from({ length: 20 }, (_, i): RepoSpec => ({ name: `repo${i}`, pushedAt: "2026-10-01T00:00:00Z" }));

async function personWithGitHub() {
  const personId = await createTestPerson("github");
  await conn.saveExternalConnection({ personId, provider: "github", externalUsername: "asha", profileUrl: "https://github.com/asha", status: "connected", metadata: {} });
  return personId;
}
const quiet = () => { const saved = { log: console.log, warn: console.warn }; console.log = () => {}; console.warn = () => {}; return () => Object.assign(console, saved); };

describe("GitHub sync on the sync framework", () => {
  beforeEach(() => { graphqlCalls = []; rl.resetConnectorStateForTesting(); });
  afterEach(() => { globalThis.fetch = realFetch; });

  test("1.5.1 20 repos in at most 2 GraphQL queries; projects, snapshots and evidence persisted", async () => {
    const personId = await personWithGitHub();
    stubGitHub(repos20);
    const restore = quiet();
    const started = Date.now();
    const res = await gh.syncGitHubConnection(personId, "tok", { requestId: "first" }).finally(restore);
    const ms = Date.now() - started;
    assert.equal(res.state, "succeeded", res.error);
    assert.equal(graphqlCalls.length, 2);
    assert.equal(res.queries, 2);
    assert.equal(res.recordsFetched, 20);
    assert.equal(res.recordsChanged, 20);
    assert.ok(ms < 3000, `took ${ms} ms`);
    const projects = await db.select().from(schema.projects).where(eq(schema.projects.personId, personId));
    assert.equal(projects.length, 20);
    const snaps = await db.select().from(schema.sourceSnapshots).where(eq(schema.sourceSnapshots.personId, personId));
    assert.equal(snaps.length, 20);
    const evidence = await db.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.personId, personId));
    assert.ok(evidence.some((e) => e.subject === "React") && evidence.some((e) => e.subject === "PyTorch"), evidence.map((e) => e.subject).join(","));
  });

  test("1.5.2 a second sync with nothing pushed: 1 query, recordsChanged 0, no row rewritten", async () => {
    const personId = await personWithGitHub();
    stubGitHub(repos20);
    const restore = quiet();
    try {
      await gh.syncGitHubConnection(personId, "tok", { requestId: "a" });
      const before = await db.select().from(schema.projects).where(eq(schema.projects.personId, personId));
      graphqlCalls = [];
      const res = await gh.syncGitHubConnection(personId, "tok", { requestId: "b" });
      assert.equal(res.state, "succeeded");
      assert.equal(graphqlCalls.length, 1, "unchanged repos skip the deep query");
      assert.equal(res.recordsChanged, 0);
      const after = await db.select().from(schema.projects).where(eq(schema.projects.personId, personId));
      assert.deepEqual(after.map((p) => p.updatedAt.getTime()).sort(), before.map((p) => p.updatedAt.getTime()).sort());
      // Push one repo: only it is deep-inspected and rewritten.
      graphqlCalls = [];
      const pushed = repos20.map((r, i) => (i === 3 ? { ...r, pushedAt: "2026-10-12T00:00:00Z" } : r));
      stubGitHub(pushed);
      const third = await gh.syncGitHubConnection(personId, "tok", { requestId: "c" });
      assert.equal(third.recordsChanged, 1);
      assert.equal(graphqlCalls.length, 2);
      assert.equal((graphqlCalls[1].query.match(/: repository\(/g) || []).length, 1);
    } finally {
      restore();
    }
  });

  test("1.5.3 binary manifest + a failed alias -> partial; every other repo still imported", async () => {
    const personId = await personWithGitHub();
    const repos = repos20.slice(0, 5).map((r, i) => (i === 1 ? { ...r, binaryPackage: true } : i === 2 ? { ...r, packageJson: "{not json" } : r));
    stubGitHub(repos, { aliasError: 4 });
    const restore = quiet();
    const res = await gh.syncGitHubConnection(personId, "tok", { requestId: "partial" }).finally(restore);
    assert.equal(res.state, "partial");
    assert.deepEqual(res.failedRepos!.map((f) => f.repo).sort(), ["asha/repo1", "asha/repo2", "asha/repo4"]);
    assert.match(res.failedRepos!.find((f) => f.repo === "asha/repo1")!.reason, /unreadable:package.json/);
    assert.match(res.failedRepos!.find((f) => f.repo === "asha/repo2")!.reason, /malformed:package.json/);
    const projects = await db.select().from(schema.projects).where(eq(schema.projects.personId, personId));
    assert.equal(projects.length, 5, "all 5 repos persisted (failed ones with shallow data)");
    const [run] = await db.select().from(schema.syncRuns).where(eq(schema.syncRuns.personId, personId));
    assert.equal(run.status, "partial");
  });

  test("1.9.1 the same Sync Now fired twice concurrently imports once", async () => {
    const personId = await personWithGitHub();
    stubGitHub(repos20.slice(0, 6));
    const restore = quiet();
    const [a, b] = await Promise.all([
      gh.syncGitHubConnection(personId, "tok", { requestId: "dbl" }),
      gh.syncGitHubConnection(personId, "tok", { requestId: "dbl" }),
    ]).finally(restore);
    assert.equal(a.operationId, b.operationId);
    assert.deepEqual([a.deduplicated, b.deduplicated].sort(), [false, true]);
    assert.equal(graphqlCalls.length, 2, "one acquisition, not two");
    const ops = await db.select().from(schema.syncOperations).where(and(eq(schema.syncOperations.personId, personId), eq(schema.syncOperations.source, "github")));
    assert.equal(ops.length, 1);
    const projects = await db.select().from(schema.projects).where(eq(schema.projects.personId, personId));
    assert.equal(projects.length, 6);
  });

  test("1.9.2 the operation's correlation ID is on the GitHub request, the snapshot rows and the log lines", async () => {
    const personId = await personWithGitHub();
    stubGitHub(repos20.slice(0, 2));
    const lines: string[] = [];
    const saved = { log: console.log, warn: console.warn };
    console.log = (l: unknown) => { lines.push(String(l)); };
    console.warn = (l: unknown) => { lines.push(String(l)); };
    const res = await gh.syncGitHubConnection(personId, "tok", { requestId: "corr" }).finally(() => Object.assign(console, saved));
    const corr = res.correlationId!;
    assert.ok(graphqlCalls.every((c) => c.headers.get("x-correlation-id") === corr));
    const snaps = await db.select().from(schema.sourceSnapshots).where(eq(schema.sourceSnapshots.personId, personId));
    assert.ok(snaps.every((s) => (s.snapshotData as { correlationId?: string }).correlationId === corr));
    const json = lines.filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
    assert.ok(json.some((j) => j.event === "github.acquired"));
    assert.ok(json.every((j) => j.correlationId === corr));
  });

  test("1.9.4 a revoked token dead-letters at once (no retries burn the rate limit)", async () => {
    const personId = await personWithGitHub();
    stubGitHub([], { status: 401 });
    const restore = quiet();
    const res = await gh.syncGitHubConnection(personId, "tok", { requestId: "revoked" }).finally(restore);
    assert.equal(res.state, "dead_letter");
    assert.equal(res.success, false);
    assert.match(res.error!, /Reconnect GitHub/);
  });

  test("1.5.3/1.7.2 GitHub rate limit: retryable failure, breaker open until X-RateLimit-Reset", async () => {
    const personId = await personWithGitHub();
    const reset = Math.floor(Date.now() / 1000) + 1800;
    stubGitHub([], { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) } });
    const restore = quiet();
    const res = await gh.syncGitHubConnection(personId, "tok", { requestId: "rl" }).finally(restore);
    assert.equal(res.state, "failed");
    const until = await rl.circuitOpenUntil("github");
    assert.ok(until >= reset * 1000 - 1000, "open until GitHub's reset time");
  });

  test("1.9.4 status API data: dead letter explained in plain words; manual retry recovers it", async () => {
    const runners = await import("../lib/sync/runners");
    const personId = await personWithGitHub();
    // Store an encrypted token so the retry runner (which has no token argument) can run.
    process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY ||= "test-encryption-key-test-encryption-key-0123456789";
    const { encryptConnectionToken } = await import("../lib/security/connection-token");
    await conn.saveExternalConnection({ personId, provider: "github", externalUsername: "asha", profileUrl: "https://github.com/asha", status: "connected", metadata: { encryptedAccessToken: encryptConnectionToken("tok", personId) } });
    stubGitHub([], { status: 404 });
    const restore = quiet();
    try {
      await gh.syncGitHubConnection(personId, undefined, { requestId: "nf" });
      const status = await runners.getSyncStatus(personId);
      const github = status.sources.find((x) => x.source === "github")! as ReturnType<typeof runners.describeOperation>;
      assert.equal(github.state, "dead_letter");
      assert.equal(github.canRetry, true);
      assert.equal(github.reason, "We couldn't find that GitHub account.");
      assert.equal(status.aggregate.status, "completed_with_issues");
      assert.equal(status.sources.find((x) => x.source === "linkedin")!.state, "not_started");
      stubGitHub(repos20.slice(0, 3));
      const { operation } = await runners.retryLatestForUser(personId, "github");
      assert.equal(operation.state, "succeeded");
      assert.equal(operation.attempts, 1, "fresh attempt budget after a dead letter");
      await assert.rejects(runners.retryLatestForUser(personId, "github"), runners.RetryNotAllowedError, "nothing to retry once it succeeded");
    } finally {
      restore();
    }
  });

  test("1.9.4 retry cron: waits for the backoff, then re-runs; never touches dead letters", async () => {
    const runners = await import("../lib/sync/runners");
    const personId = await personWithGitHub();
    process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY ||= "test-encryption-key-test-encryption-key-0123456789";
    const { encryptConnectionToken } = await import("../lib/security/connection-token");
    await conn.saveExternalConnection({ personId, provider: "github", externalUsername: "asha", profileUrl: "https://github.com/asha", status: "connected", metadata: { encryptedAccessToken: encryptConnectionToken("tok", personId) } });
    stubGitHub([], { status: 502 });
    const restore = quiet();
    try {
      const first = await gh.syncGitHubConnection(personId, undefined, { requestId: "502" });
      assert.equal(first.state, "failed");
      const [op] = await db.select().from(schema.syncOperations).where(eq(schema.syncOperations.id, first.operationId!));
      const early = await runners.runDueRetries({ now: op.nextAttemptAt!.getTime() - 1000 });
      assert.ok(!early.outcomes.some((o) => o.operationId === op.id), "not due yet");
      rl.resetConnectorStateForTesting();
      stubGitHub(repos20.slice(0, 2));
      const due = await runners.runDueRetries({ now: op.nextAttemptAt!.getTime() + 1000, limit: 50 });
      assert.deepEqual(due.outcomes.find((o) => o.operationId === op.id), { operationId: op.id, source: "github", state: "succeeded" });
      const dead = await db.select().from(schema.syncOperations).where(eq(schema.syncOperations.state, "dead_letter"));
      const sweep = await runners.runDueRetries({ now: Date.now() + 1e10, limit: 500 });
      assert.ok(dead.every((d) => !sweep.outcomes.some((o) => o.operationId === d.id)), "dead letters are never auto-retried");
    } finally {
      restore();
    }
  });
});
