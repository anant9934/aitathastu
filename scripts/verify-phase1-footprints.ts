/** Tasks 1.6.2-1.6.6: footprint sources on the sync framework (local Postgres, all providers stubbed). */
import { test, describe, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { useTestDatabase, createTestPerson } from "./lib/test-db";

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

let db: Awaited<ReturnType<typeof useTestDatabase>>;
let schema: typeof import("../lib/db");
let fp: typeof import("../lib/sync/footprint-sync");
let conn: typeof import("../lib/repositories/connection-repository");
let rl: typeof import("../lib/connectors/rate-limiter");
let scholar: typeof import("../lib/connectors/research-and-dev/scholar-client");

before(async () => {
  db = await useTestDatabase();
  schema = await import("../lib/db");
  fp = await import("../lib/sync/footprint-sync");
  conn = await import("../lib/repositories/connection-repository");
  rl = await import("../lib/connectors/rate-limiter");
  scholar = await import("../lib/connectors/research-and-dev/scholar-client");
});
after(async () => { await schema.closeDbForTesting(); });

const realFetch = globalThis.fetch;
let sent: string[] = [];
type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;
function stub(routes: Record<string, Handler>) {
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    sent.push(url.host + url.pathname);
    const h = routes[url.host];
    if (!h) throw Object.assign(new Error(`network down: ${url.host}`), { name: "TypeError" });
    return h(url, init);
  }) as typeof fetch;
}
const quiet = () => { const s = { log: console.log, warn: console.warn }; console.log = () => {}; console.warn = () => {}; return () => Object.assign(console, s); };

const LC_OK: Handler = () => Response.json({ data: {
  matchedUser: { username: "asha", profile: { ranking: 4321, reputation: 3, realName: "Asha" }, badges: [{ displayName: "50 Days Badge 2025" }],
    submitStats: { acSubmissionNum: [{ difficulty: "All", count: 231 }, { difficulty: "Easy", count: 120 }, { difficulty: "Medium", count: 95 }, { difficulty: "Hard", count: 16 }] } },
  userContestRanking: { rating: 1687.4, globalRanking: 52011, attendedContestsCount: 9 },
} });
const HR: Record<string, Handler> = {
  "www.hackerrank.com": (url) => url.pathname.endsWith("/badges")
    ? Response.json({ models: [{ badge_name: "Problem Solving", stars: 5 }, { badge_name: "Python", stars: 4 }] })
    : Response.json([{ name: "Algorithms", practice: { score: 512.5, rank: 9001 } }, { name: "SQL", practice: { score: 0 } }]),
};

async function person(connections: Array<{ provider: string; handle: string; metadata?: Record<string, unknown> }>) {
  const personId = await createTestPerson("fp");
  for (const c of connections) await conn.saveExternalConnection({ personId, provider: c.provider, externalUsername: c.handle, profileUrl: `https://x/${c.handle}`, status: "detected", metadata: c.metadata ?? {} });
  return personId;
}
const evidenceFor = async (personId: string, origin: string) =>
  db.select().from(schema.evidenceItems).where(and(eq(schema.evidenceItems.personId, personId), eq(schema.evidenceItems.originSource, origin)));

describe("footprint sources", () => {
  beforeEach(() => { sent = []; rl.resetConnectorStateForTesting(); });
  afterEach(() => { globalThis.fetch = realFetch; });

  test("1.6.4 LeetCode: solved threshold, contest rating and badges become evidence; snapshot saved", async () => {
    const personId = await person([{ provider: "leetcode", handle: "asha" }]);
    stub({ "leetcode.com": LC_OK });
    const restore = quiet();
    const [r] = await fp.syncAllFootprints(personId, "user", { sources: ["leetcode"] }).finally(restore);
    assert.equal(r.state, "succeeded", r.error);
    const ev = await evidenceFor(personId, "leetcode");
    assert.deepEqual(ev.map((e) => `${e.subject}=${e.value}`).sort(), [
      "50 Days Badge 2025=LeetCode badge", "Data Structures & Algorithms=LeetCode 200+ Problems Solved", "LeetCode Contest Rating=1687",
    ]);
    const snaps = await db.select().from(schema.sourceSnapshots).where(and(eq(schema.sourceSnapshots.personId, personId), eq(schema.sourceSnapshots.source, "leetcode")));
    assert.equal(snaps.length, 1);
  });

  test("1.6.4/1.7.2 LeetCode 429s trip the breaker; the next sync serves the snapshot with zero network calls", async () => {
    const personId = await person([{ provider: "leetcode", handle: "asha" }]);
    const restore = quiet();
    try {
      stub({ "leetcode.com": LC_OK });
      await fp.syncAllFootprints(personId, "user", { sources: ["leetcode"], requestId: "warm" });
      stub({ "leetcode.com": () => new Response("", { status: 429 }) });
      for (let i = 0; i < 3; i++) await fp.syncAllFootprints(personId, "user", { sources: ["leetcode"], requestId: `rl${i}` });
      sent = [];
      const [r] = await fp.syncAllFootprints(personId, "user", { sources: ["leetcode"], requestId: "after" });
      assert.equal(r.state, "partial");
      assert.equal(sent.length, 0, "breaker open: nothing sent");
      const [op] = await db.select().from(schema.syncOperations).where(and(eq(schema.syncOperations.personId, personId), eq(schema.syncOperations.idempotencyKey, (await import("../lib/sync/sync-operation")).syncIdempotencyKey({ personId, source: "leetcode", trigger: "user", requestId: "after:leetcode" }))));
      assert.equal((op.result as { servedFromCache?: boolean }).servedFromCache, true);
    } finally {
      restore();
    }
  });

  test("1.6.5 HackerRank: star badges map to skills, practice scores to assessments; zero scores ignored", async () => {
    const personId = await person([{ provider: "hackerrank", handle: "asha_rao" }]);
    stub(HR);
    const restore = quiet();
    const [r] = await fp.syncAllFootprints(personId, "user", { sources: ["hackerrank"] }).finally(restore);
    assert.equal(r.state, "succeeded", r.error);
    const ev = await evidenceFor(personId, "hackerrank");
    assert.deepEqual(ev.map((e) => `${e.category}:${e.subject}=${e.value}`).sort(), [
      "assessment:HackerRank Algorithms=513", "skill:Problem Solving=5 stars", "skill:Python=4 stars",
    ]);
  });

  test("1.6.3 Kaggle: only the user's own datasets become candidate projects (foreign rows filtered)", async () => {
    const personId = await person([{ provider: "kaggle", handle: "asha" }]);
    stub({ "www.kaggle.com": () => Response.json([
      { ref: "asha/campus-energy", ownerRef: "asha", title: "Campus Energy Use", voteCount: 12, downloadCount: 340 },
      { ref: "someone/other", ownerRef: "someone", title: "Not Hers" },
    ]) });
    const restore = quiet();
    const [r] = await fp.syncAllFootprints(personId, "user", { sources: ["kaggle"] }).finally(restore);
    assert.equal(r.state, "succeeded", r.error);
    const projects = await db.select().from(schema.projects).where(eq(schema.projects.personId, personId));
    assert.deepEqual(projects.map((p) => `${p.title}:${(p.sources as string[]).join("+")}:${p.status}`), ["Campus Energy Use:kaggle:candidate"]);
    assert.ok(!sent.some((s) => s.includes("kernels")), "no API key: notebooks (auth-only) are not requested");
  });

  test("1.6.2 ORCID: works from the ORCID record, DOI-exact OpenAlex enrichment, evidence source=scholar", async () => {
    const personId = await person([{ provider: "scholar", handle: "0000-0002-1825-0097", metadata: { idKind: "orcid" } }]);
    stub({
      "pub.orcid.org": () => Response.json({ group: [
        { "work-summary": [{ "put-code": 1, title: { title: { value: "Graph Nets for Crops" } }, "publication-date": { year: { value: "2024" } }, "external-ids": { "external-id": [{ "external-id-type": "doi", "external-id-value": "10.1000/ABC" }] } }] },
        { "work-summary": [{ "put-code": 2, title: { title: { value: "Workshop Note" } }, "external-ids": { "external-id": [] } }] },
      ] }),
      "api.openalex.org": (url) => url.pathname.includes("10.1000") ? Response.json({ doi: "https://doi.org/10.1000/abc", cited_by_count: 14, primary_location: { source: { display_name: "AgriAI" } }, authorships: [{ author: { display_name: "A. Rao" } }, { author: { display_name: "K. Menon" } }] }) : new Response("", { status: 404 }),
    });
    const restore = quiet();
    const [r] = await fp.syncAllFootprints(personId, "user", { sources: ["scholar"] }).finally(restore);
    assert.equal(r.state, "succeeded", r.error);
    const ev = await evidenceFor(personId, "scholar");
    assert.deepEqual(ev.map((e) => `${e.category}:${e.subject}`).sort(), ["publication:Graph Nets for Crops", "publication:Workshop Note"]);
    const gn = ev.find((e) => e.subject === "Graph Nets for Crops")!;
    assert.equal(gn.sourceReference, "https://doi.org/10.1000/abc");
    assert.match(gn.interpretation, /AgriAI \(2024\); cited 14 times; with A\. Rao, K\. Menon/);
    assert.ok(!sent.some((s) => s.includes("api.openalex.org/works") && !s.includes("doi:")), "never OpenAlex's author.orcid filter");
  });

  test("1.6.2 no research ID entered: zero Scholar/ORCID/OpenAlex requests, no papers", async () => {
    const personId = await person([]);
    stub({});
    const [r] = await fp.syncAllFootprints(personId, "user", { sources: ["scholar"] });
    assert.equal(r.outcome, "skipped_not_connected");
    assert.equal(sent.length, 0);
    assert.equal((await evidenceFor(personId, "scholar")).length, 0);
  });

  test("1.6.2 ID validation: ORCID checksum and S2 author ID; no name path exists", () => {
    assert.equal(scholar.parseOrcid("https://orcid.org/0000-0002-1825-0097"), "0000-0002-1825-0097");
    assert.equal(scholar.parseOrcid("0000-0002-1825-0098"), null, "bad check digit");
    assert.equal(scholar.parseOrcid("Asha Rao"), null);
    assert.equal(scholar.parseSemanticScholarAuthorId("https://www.semanticscholar.org/author/Oren-Etzioni/1741101"), "1741101");
    assert.equal(scholar.parseSemanticScholarAuthorId("Oren Etzioni"), null);
  });

  test("1.6.6 one source offline never blocks the others; no exception escapes", async () => {
    const personId = await person([{ provider: "leetcode", handle: "asha" }, { provider: "hackerrank", handle: "asha_rao" }, { provider: "kaggle", handle: "asha" }]);
    stub({ ...HR, "www.kaggle.com": () => new Response("", { status: 500 }) }); // leetcode host absent => network down
    const restore = quiet();
    const results = await fp.syncAllFootprints(personId, "user").finally(restore);
    const by = Object.fromEntries(results.map((r) => [r.source, r]));
    assert.equal(by.hackerrank.state, "succeeded");
    assert.equal(by.leetcode.state, "failed", "offline with no snapshot: retryable failure, not a crash");
    assert.equal(by.kaggle.state, "failed");
    assert.equal(by.scholar.outcome, "skipped_not_connected");
  });

  test("1.6.6 settled TTL: a scheduled refresh inside 24 h sends nothing; Sync Now still runs", async () => {
    const personId = await person([{ provider: "hackerrank", handle: "asha_rao" }]);
    stub(HR);
    const restore = quiet();
    try {
      await fp.syncAllFootprints(personId, "user", { requestId: "first" });
      sent = [];
      const [cron] = await fp.syncAllFootprints(personId, "scheduler", { sources: ["hackerrank"] });
      assert.equal(cron.outcome, "skipped_fresh");
      assert.equal(sent.length, 0);
      const [manual] = await fp.syncAllFootprints(personId, "user", { sources: ["hackerrank"], requestId: "second" });
      assert.equal(manual.outcome, "ran");
    } finally {
      restore();
    }
  });

  test("1.9.1 sync-all fired twice concurrently with one Idempotency-Key: one operation per source", async () => {
    const personId = await person([{ provider: "hackerrank", handle: "asha_rao" }, { provider: "leetcode", handle: "asha" }]);
    stub({ ...HR, "leetcode.com": LC_OK });
    const restore = quiet();
    await Promise.all([fp.syncAllFootprints(personId, "user", { requestId: "dbl" }), fp.syncAllFootprints(personId, "user", { requestId: "dbl" })]).finally(restore);
    const ops = await db.select().from(schema.syncOperations).where(eq(schema.syncOperations.personId, personId));
    assert.deepEqual(ops.map((o) => o.source).sort(), ["hackerrank", "leetcode"]);
    assert.equal(sent.filter((s) => s.includes("leetcode.com")).length, 1);
  });
});
