/**
 * Task 1.7.2 contract tests: connector circuit breaker, rate windows, TTL
 * policy. External APIs are stubbed (zero real calls). The Redis case uses
 * the local Upstash REST emulator on :18079 (see scripts/verify-phase1-llm.ts).
 */
import { test, describe, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

(process.env as Record<string, string>).NODE_ENV = "test";
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

let rl: typeof import("../lib/connectors/rate-limiter");
let leetcode: typeof import("../lib/connectors/leetcode/client");
let coding: typeof import("../lib/connectors/coding-platforms/client");
let policy: typeof import("../lib/sync/policy");
before(async () => {
  rl = await import("../lib/connectors/rate-limiter");
  leetcode = await import("../lib/connectors/leetcode/client");
  coding = await import("../lib/connectors/coding-platforms/client");
  policy = await import("../lib/sync/policy");
});

const realFetch = globalThis.fetch;
let sent: { url: string; headers: Headers }[] = [];
function stub(respond: (n: number) => Response | Promise<Response>) {
  let n = 0;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes("127.0.0.1:18079")) return realFetch(url, init); // local Redis emulator
    sent.push({ url: String(url), headers: new Headers(init?.headers) });
    return respond(++n);
  }) as typeof fetch;
}
const lcOk = () => Response.json({ data: { matchedUser: { username: "asha", submitStats: { acSubmissionNum: [{ difficulty: "All", count: 210 }] }, profile: { ranking: 12345 } } } });

describe("1.7.2 connector circuit breaker", () => {
  beforeEach(() => { sent = []; rl.resetConnectorStateForTesting(); });
  afterEach(() => { globalThis.fetch = realFetch; });

  test("3 consecutive LeetCode 429s trip the breaker; the 4th call sends nothing and asks for cached data", async () => {
    stub(() => new Response("slow down", { status: 429 }));
    for (let i = 0; i < 3; i++) assert.equal((await leetcode.fetchLeetCodeProfileStats("asha")).acquisitionStatus, "RATE_LIMITED");
    assert.equal(sent.length, 3);
    const fourth = await leetcode.fetchLeetCodeProfileStats("asha");
    assert.equal(fourth.acquisitionStatus, "RATE_LIMITED");
    assert.match(fourth.error!, /cooling down/);
    assert.equal(sent.length, 3, "no network call while the circuit is open");
    const until = await rl.circuitOpenUntil("leetcode");
    assert.ok(until - Date.now() > 4.9 * 60_000 && until - Date.now() <= 5 * 60_000, "open for 5 minutes");
  });

  test("timeouts count toward the breaker like 429s", async () => {
    stub(() => { const e = new Error("timeout"); e.name = "TimeoutError"; throw e; });
    for (let i = 0; i < 3; i++) await leetcode.fetchLeetCodeProfileStats("asha");
    assert.ok(await rl.circuitOpenUntil("leetcode"));
  });

  test("a success resets the consecutive-failure count", async () => {
    stub((n) => (n === 3 ? lcOk() : new Response("", { status: 429 })));
    for (let i = 0; i < 5; i++) await leetcode.fetchLeetCodeProfileStats("asha"); // F F S F F
    assert.equal(await rl.circuitOpenUntil("leetcode"), 0);
  });

  test("Retry-After opens the circuit immediately for at least that long", async () => {
    stub(() => new Response("", { status: 429, headers: { "Retry-After": "900" } }));
    await coding.fetchHackerRankProfile("asha_rao");
    const until = await rl.circuitOpenUntil("hackerrank");
    assert.ok(until - Date.now() > 14 * 60_000, "15 min from Retry-After beats the 5 min default");
  });

  test("GitHub X-RateLimit-Reset is parsed", () => {
    const now = 1_700_000_000_000;
    const h = new Headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(now / 1000 + 600) });
    assert.equal(rl.retryAfterFromHeaders(h, now), 600_000);
  });

  test("local rate window: the 31st HackerRank request in a minute is refused without sending", async () => {
    stub(() => Response.json({ models: [] }));
    for (let i = 0; i < 30; i++) await rl.connectorFetch("hackerrank", "https://www.hackerrank.com/rest/hackers/x/badges");
    await assert.rejects(rl.connectorFetch("hackerrank", "https://www.hackerrank.com/rest/hackers/x/badges"), rl.ConnectorRateLimitedError);
    assert.equal(sent.length, 30);
  });

  test("X-Correlation-ID is forwarded only where the target accepts it", async () => {
    stub(() => Response.json({}));
    await rl.connectorFetch("github", "https://api.github.com/user", { correlationId: "sync_abc" });
    await rl.connectorFetch("leetcode", "https://leetcode.com/graphql", { correlationId: "sync_abc" });
    assert.equal(sent[0].headers.get("x-correlation-id"), "sync_abc");
    assert.equal(sent[1].headers.get("x-correlation-id"), null);
  });

  test("breaker state lives in Redis, so every instance sees it", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:18079";
    process.env.UPSTASH_REDIS_REST_TOKEN = "phase1token";
    const { redisPipeline } = await import("../lib/cache/redis");
    try {
      await redisPipeline([["DEL", "cb:kaggle:failures", "cb:kaggle:open_until"]]);
      stub(() => new Response("", { status: 429 }));
      for (let i = 0; i < 3; i++) await rl.connectorFetch("kaggle", "https://www.kaggle.com/api/v1/datasets/list");
      rl.resetConnectorStateForTesting(); // drop any in-process state: what remains is Redis
      assert.ok(await rl.circuitOpenUntil("kaggle"));
      const [raw] = await redisPipeline([["GET", "cb:kaggle:open_until"]]);
      assert.ok(Number(raw) > Date.now());
    } finally {
      await redisPipeline([["DEL", "cb:kaggle:failures", "cb:kaggle:open_until"]]).catch(() => null);
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    }
  });
});

describe("settled refresh TTLs", () => {
  const H = 3_600_000;
  test("scheduled refresh waits for the TTL per source", () => {
    const now = Date.now();
    const ago = (ms: number) => new Date(now - ms);
    assert.equal(policy.isSyncDue("github", ago(5 * H), "scheduler", now), false);
    assert.equal(policy.isSyncDue("github", ago(6 * H), "scheduler", now), true);
    assert.equal(policy.isSyncDue("leetcode", ago(23 * H), "scheduler", now), false);
    assert.equal(policy.isSyncDue("hackerrank", ago(24 * H), "scheduler", now), true);
    assert.equal(policy.isSyncDue("kaggle", ago(24 * H), "scheduler", now), true);
    assert.equal(policy.isSyncDue("scholar", ago(6 * 24 * H), "scheduler", now), false);
    assert.equal(policy.isSyncDue("scholar", ago(7 * 24 * H), "scheduler", now), true);
  });
  test("Sync Now bypasses the TTL except for LinkedIn's 14-day cooldown", () => {
    const now = Date.now();
    assert.equal(policy.isSyncDue("github", new Date(now - 60_000), "user", now), true);
    assert.equal(policy.isSyncDue("linkedin", new Date(now - 13 * 24 * H), "user", now), false);
    assert.equal(policy.isSyncDue("linkedin", new Date(now - 14 * 24 * H), "user", now), true);
  });
});

describe("1.5.4 OAuth origin (BUG #3)", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/api/auth/github/start", { headers });
  const withEnv = async (env: Record<string, string | undefined>, fn: () => void | Promise<void>) => {
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    Object.assign(process.env, env);
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
    try { await fn(); } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
  };
  test("dev on localhost uses the request host even when APP_BASE_URL points at production", async () => {
    const { getCanonicalOrigin } = await import("../lib/auth/origin");
    await withEnv({ NODE_ENV: "development", APP_BASE_URL: "https://tathastuai.vercel.app" }, () => {
      assert.equal(getCanonicalOrigin(req({ host: "localhost:3000" })), "http://localhost:3000");
      assert.equal(getCanonicalOrigin(req({ host: "127.0.0.1:3101" })), "http://127.0.0.1:3101");
      assert.equal(getCanonicalOrigin(req({ host: "evil.example", "x-forwarded-host": "localhost:3000" })), "http://localhost:3000");
      assert.equal(getCanonicalOrigin(req({ host: "evil.example" })), "https://tathastuai.vercel.app", "non-loopback host never trusted");
    });
  });
  test("production ignores request headers entirely", async () => {
    const { getCanonicalOrigin } = await import("../lib/auth/origin");
    await withEnv({ NODE_ENV: "production", APP_BASE_URL: "https://tathastuai.vercel.app" }, () => {
      assert.equal(getCanonicalOrigin(req({ host: "localhost:3000", "x-forwarded-host": "localhost:3000" })), "https://tathastuai.vercel.app");
    });
  });
});

