/**
 * Phase 1 headless backend contract tests (Task 1.8.1). No React, no browser:
 * pure modules plus a disposable local Postgres (see scripts/lib/test-db.ts).
 *
 *   npm run test:backend-contracts
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { useTestDatabase, createTestPerson } from "./lib/test-db";
import {
  SOURCE_SYNC_STATES, SYNC_TRANSITIONS, canTransition, transition, aggregateOnboardingStatus,
  InvalidSyncTransitionError, fromLegacyStatus, type SourceSnapshot,
} from "../lib/sync/state-machine";
import { mergeDraftPatch } from "../lib/onboarding-draft-merge";

// ───────────────────────── 1.9.3 state machine ─────────────────────────
describe("1.9.3 sync state machine", () => {
  test("every state has an entry in the transition table", () => {
    for (const state of SOURCE_SYNC_STATES) assert.ok(SYNC_TRANSITIONS[state], state);
  });

  test("documented edges are allowed, everything else is rejected", () => {
    const allowed = new Set<string>();
    for (const [from, edges] of Object.entries(SYNC_TRANSITIONS)) {
      for (const edge of edges) for (const by of edge.by) allowed.add(`${from}>${edge.to}>${by}`);
    }
    // Pin the doc table (docs/ONBOARDING_SYNC_STATE_MACHINE.md).
    assert.equal(allowed.size, 28);
    for (const from of SOURCE_SYNC_STATES) for (const to of SOURCE_SYNC_STATES) for (const by of ["user", "worker", "scheduler"] as const) {
      assert.equal(canTransition(from, to, by), allowed.has(`${from}>${to}>${by}`), `${from} -> ${to} by ${by}`);
    }
  });

  test("dead_letter leaves only by user action", () => {
    assert.throws(() => transition("dead_letter", "queued", "scheduler"), InvalidSyncTransitionError);
    assert.throws(() => transition("dead_letter", "queued", "worker"), InvalidSyncTransitionError);
    assert.equal(transition("dead_letter", "queued", "user"), "queued");
  });

  test("page navigation has no trigger: nothing moves succeeded except refresh", () => {
    assert.deepEqual(SYNC_TRANSITIONS.succeeded.map((e) => e.to), ["queued"]);
    assert.ok(!canTransition("succeeded", "queued", "worker"));
  });

  test("legacy status strings map onto spec states", () => {
    assert.equal(fromLegacyStatus("completed"), "succeeded");
    assert.equal(fromLegacyStatus("retry"), "queued");
    assert.equal(fromLegacyStatus("partial"), "partial");
    assert.equal(fromLegacyStatus(null), "not_started");
  });

  const snap = (states: Record<string, string>): SourceSnapshot[] =>
    Object.entries(states).map(([source, state]) => ({ source, state } as SourceSnapshot));

  const cases: [string, Record<string, string>, string, string][] = [
    ["resume+github ok, linkedin skipped, scholar no ORCID", { resume: "succeeded", github: "succeeded", linkedin: "skipped_optional", scholar: "not_started", kaggle: "not_started" }, "completed", "All 2 connected sources are up to date."],
    ["github running, leetcode queued", { resume: "succeeded", github: "running", linkedin: "skipped_optional", scholar: "not_started", leetcode: "queued" }, "in_progress", "1 of 3 sources done, 2 still running."],
    ["linkedin OTP pending", { resume: "succeeded", github: "succeeded", linkedin: "awaiting_user", scholar: "not_started" }, "awaiting_user", "linkedin needs a verification code to continue."],
    ["partial + dead letter", { resume: "succeeded", github: "partial", linkedin: "dead_letter", scholar: "succeeded" }, "completed_with_issues", "2 of 4 sources imported; 2 need attention."],
    ["resume failed", { resume: "failed", github: "succeeded", linkedin: "skipped_optional", scholar: "not_started" }, "completed_with_issues", "1 of 2 sources imported; 1 need attention."],
    ["nothing connected", { resume: "skipped_optional", github: "not_started", linkedin: "skipped_optional", scholar: "not_started", kaggle: "not_started" }, "not_started", "No sources connected yet — you can add them any time."],
    ["timed out while another runs", { resume: "succeeded", github: "timed_out", linkedin: "running", scholar: "not_started" }, "in_progress", "2 of 3 sources done, 1 still running."],
  ];
  for (const [name, states, status, headline] of cases) {
    test(`aggregate: ${name} -> ${status}`, () => {
      const summary = aggregateOnboardingStatus(snap(states));
      assert.equal(summary.status, status);
      assert.equal(summary.headline, headline);
      assert.equal(summary.canProceed, true);
    });
  }
});

// ───────────────────────── 1.2.4 merge rules ─────────────────────────
describe("1.2.4 draft merge rules", () => {
  const base = { name: "Asha", institution: "", skills: ["Python"], projects: [{ id: "a", title: "A" }] };

  test("system writes fill empty scalars only and union arrays by key", () => {
    const { draft, systemEntries } = mergeDraftPatch({
      current: base, origin: "system", systemEntries: {}, nextRevision: 5,
      patch: { name: "Scraped", institution: "IIT", projects: [{ id: "a", title: "A2" }, { id: "b", title: "B" }] },
    });
    assert.equal(draft.name, "Asha");
    assert.equal(draft.institution, "IIT");
    assert.deepEqual(draft.projects, [{ id: "a", title: "A" }, { id: "b", title: "B" }]);
    assert.deepEqual(systemEntries, { projects: { b: 5 } });
  });

  test("user replace keeps system entries newer than baseRevision, drops older ones", () => {
    const current = { ...base, projects: [{ id: "a", title: "A" }, { id: "old", title: "Old" }, { id: "new", title: "New" }] };
    const { draft } = mergeDraftPatch({
      current, origin: "user", nextRevision: 9, baseRevision: 4,
      systemEntries: { projects: { old: 3, new: 7 } },
      patch: { projects: [{ id: "a", title: "A edited" }] },
    });
    assert.deepEqual((draft.projects as { id: string }[]).map((p) => p.id), ["a", "new"]);
  });

  test("user replace without baseRevision is a plain replace (legacy clients)", () => {
    const { draft } = mergeDraftPatch({ current: base, origin: "user", systemEntries: { skills: { python: 2 } }, nextRevision: 3, patch: { skills: [] } });
    assert.deepEqual(draft.skills, []);
  });
});

// ───────────────────── 1.9.1 / 1.9.2 / 1.9.4 sync operations (DB) ─────────────────────
describe("sync operations against local Postgres", () => {
  let personId: string;
  let ops: typeof import("../lib/sync/sync-operation");
  let db: Awaited<ReturnType<typeof useTestDatabase>>;
  let schema: typeof import("../lib/db");

  before(async () => {
    db = await useTestDatabase();
    schema = await import("../lib/db");
    ops = await import("../lib/sync/sync-operation");
    personId = await createTestPerson("contracts");
  });
  after(async () => { await schema.closeDbForTesting(); });

  test("1.9.1 the same sync fired twice concurrently runs once and writes one set of rows", async () => {
    const { writeEvidenceBatch } = await import("../lib/repositories/evidence-repository");
    let calls = 0;
    const work = async (ctx: import("../lib/sync/sync-operation").SyncContext) => {
      calls++;
      await new Promise((r) => setTimeout(r, 50));
      await writeEvidenceBatch(personId, ["typescript", "go", "rust"].map((k) => ({
        category: "skill" as const, subject: k, value: k, source: "imported" as const, verificationStatus: "imported" as const,
        sourceReference: `leetcode:${k}`, interpretation: k, whyItMatters: "test", importKey: `leetcode_${k}`,
      })));
      return { outcome: "succeeded" as const, result: { idempotencyKey: ctx.idempotencyKey } };
    };
    const params = { personId, source: "leetcode" as const, trigger: "user" as const, requestId: "req-double-click" };
    const [a, b] = await Promise.all([ops.runSyncOperation(params, work), ops.runSyncOperation(params, work)]);
    assert.equal(calls, 1, "work must run exactly once");
    assert.equal(a.operation.id, b.operation.id);
    assert.deepEqual([a.deduplicated, b.deduplicated].sort(), [false, true]);

    // A retry after the first completed (e.g. client timeout) is also a no-op.
    const replay = await ops.runSyncOperation(params, work);
    assert.equal(calls, 1);
    assert.equal(replay.deduplicated, true);
    assert.equal(replay.operation.state, "succeeded");

    const rows = await db.select().from(schema.syncOperations).where(eq(schema.syncOperations.personId, personId));
    assert.equal(rows.filter((r) => r.source === "leetcode").length, 1);
    const evidence = await db.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.personId, personId));
    assert.equal(evidence.filter((e) => e.importKey?.startsWith("leetcode_")).length, 3);
  });

  test("1.9.1 a second Sync Now while one is in flight dedupes even across buckets", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let calls = 0;
    const slow = async () => { calls++; await gate; return { outcome: "succeeded" as const }; };
    const first = ops.runSyncOperation({ personId, source: "kaggle", trigger: "user", requestId: "click-1" }, slow);
    await new Promise((r) => setTimeout(r, 30));
    const second = await ops.runSyncOperation({ personId, source: "kaggle", trigger: "user", requestId: "click-2" }, slow);
    assert.equal(second.deduplicated, true, "different request id, same active source");
    release();
    await first;
    assert.equal(calls, 1);
  });

  test("1.9.1 user-trigger keys collapse within the dedupe window", () => {
    const t = 1_700_000_000_000;
    const k = (now: number) => ops.syncIdempotencyKey({ personId: "p", source: "github", trigger: "user", now });
    assert.equal(k(t), k(t + 10));
    assert.notEqual(k(t), k(t + 120_000));
  });

  test("1.9.2 every log line and outbound header carries the operation's correlation ID", async () => {
    const lines: string[] = [];
    const orig = { log: console.log, warn: console.warn };
    console.log = (l: unknown) => { lines.push(String(l)); };
    console.warn = (l: unknown) => { lines.push(String(l)); };
    let header = "";
    let run;
    try {
      run = await ops.runSyncOperation({ personId, source: "hackerrank", trigger: "user", requestId: "corr-test" }, async (ctx) => {
        header = ctx.outboundHeaders["X-Correlation-ID"];
        ctx.log.info("hackerrank.fetch", { metadata: { url: "https://example.invalid" } });
        return { outcome: "succeeded" };
      });
    } finally {
      Object.assign(console, orig);
    }
    const corr = run.operation.correlationId;
    assert.match(corr, /^sync_[0-9a-f-]{36}$/);
    assert.equal(header, corr);
    const json = lines.map((l) => JSON.parse(l));
    assert.deepEqual(json.map((j) => j.event), ["sync.attempt.started", "hackerrank.fetch", "sync.attempt.finished"]);
    for (const j of json) assert.equal(j.correlationId, corr, "correlationId is a top-level field");
  });

  test("1.9.4 repeated failures dead-letter with the last error kept; no auto-retry after", async () => {
    let calls = 0;
    const failing = async () => { calls++; throw new Error(`Scholar 500 #${calls}`); };
    const quiet = { log: console.log, warn: console.warn };
    console.log = () => {}; console.warn = () => {};
    try {
      let { operation } = await ops.runSyncOperation({ personId, source: "scholar", trigger: "scheduler" }, failing);
      assert.equal(operation.state, "failed");
      assert.equal(operation.attempts, 1);
      // Backoff not elapsed: scheduler retry is refused.
      assert.equal(await ops.retrySyncOperation(operation, "scheduler", Date.now()), null);
      while (operation.state === "failed") {
        const queued = await ops.retrySyncOperation(operation, "scheduler", operation.nextAttemptAt!.getTime() + 1);
        ({ operation } = await ops.executeSyncOperation(queued!, failing));
      }
      assert.equal(operation.state, "dead_letter");
      assert.equal(operation.attempts, 4, "scholar maxAttempts");
      assert.equal(calls, 4);
      assert.equal(operation.lastError, "Scholar 500 #4");
      assert.equal(operation.lastErrorCode, "max_attempts_exceeded:unexpected_error");
      await assert.rejects(ops.retrySyncOperation(operation, "scheduler", Date.now() + 1e9), InvalidSyncTransitionError);
      const manual = await ops.retrySyncOperation(operation, "user");
      assert.equal(manual!.state, "queued");
      assert.equal(manual!.attempts, 0, "manual retry gets a fresh attempt budget");
    } finally {
      Object.assign(console, quiet);
    }
  });

  test("1.9.4 a non-retryable error dead-letters on the first attempt", async () => {
    const quiet = { log: console.log, warn: console.warn };
    console.log = () => {}; console.warn = () => {};
    try {
      const { operation } = await ops.runSyncOperation({ personId, source: "linkedin", trigger: "user", requestId: "captcha" }, async () => {
        throw new ops.SyncError("LinkedIn presented a CAPTCHA", "linkedin_captcha", false);
      });
      assert.equal(operation.state, "dead_letter");
      assert.equal(operation.lastErrorCode, "linkedin_captcha");
    } finally {
      Object.assign(console, quiet);
    }
  });

  test("1.9.1 resume upload idempotency: concurrent duplicate runs once; failure releases the key; other content is separate", async () => {
    const idem = await import("../lib/sync/idempotency");
    const bytes = Buffer.from("%PDF-1.4 same cv bytes");
    const key = idem.contentIdempotencyKey(personId, "resume_upload", bytes);
    let calls = 0;
    const fn = async () => { calls++; await new Promise((r) => setTimeout(r, 80)); return { documentId: `doc_${calls}`, jobId: `job_${calls}` }; };
    const [a, b] = await Promise.all([
      idem.withIdempotency({ key, personId, scope: "resume_upload" }, fn),
      idem.withIdempotency({ key, personId, scope: "resume_upload" }, fn),
    ]);
    assert.equal(calls, 1);
    assert.deepEqual(a.response, b.response);
    assert.deepEqual([a.replayed, b.replayed].sort(), [false, true]);
    const other = idem.contentIdempotencyKey(personId, "resume_upload", Buffer.from("%PDF-1.4 a different cv"));
    assert.notEqual(other, key);
    const failKey = idem.requestIdempotencyKey(personId, "resume_upload", "client-key-1");
    await assert.rejects(idem.withIdempotency({ key: failKey, personId, scope: "resume_upload" }, async () => { throw new Error("storage down"); }));
    const retry = await idem.withIdempotency({ key: failKey, personId, scope: "resume_upload" }, async () => ({ documentId: "doc_retry" }));
    assert.equal(retry.replayed, false, "a failed first attempt does not block the retry");
  });

  test("attempt budget overrun records timed_out and aborts the work's signal", async () => {
    const quiet = { log: console.log, warn: console.warn };
    console.log = () => {}; console.warn = () => {};
    let aborted = false;
    try {
      const { operation } = await ops.runSyncOperation({ personId, source: "github", trigger: "user", requestId: "slow" }, async (ctx) => {
        await new Promise((r) => setTimeout(r, 300));
        aborted = ctx.signal.aborted;
        return { outcome: "succeeded" };
      }, { timeoutMs: 50 });
      assert.equal(operation.state, "timed_out");
      assert.equal(operation.lastErrorCode, "timeout");
      await new Promise((r) => setTimeout(r, 300));
      assert.equal(aborted, true);
    } finally {
      Object.assign(console, quiet);
    }
  });
});
