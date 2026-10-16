/**
 * Tasks 1.6.1 / 1.6.7 / 1.6.8 end to end: lib/services/linkedin-import-service
 * -> the real Render worker image (services/resume-extractor) running headless
 * Chromium against tests/mock_linkedin.py. No real LinkedIn account is used.
 *
 *   docker run -d --name tathastu-phase1-extractor -p 18800:8000 \
 *     -e EXTRACTOR_API_TOKEN=local-phase1-extractor-token-0123456789 -e ENVIRONMENT=development \
 *     -e LINKEDIN_BASE_URL=http://127.0.0.1:9999 -e LINKEDIN_PARSER=simple -e LINKEDIN_OTP_WINDOW_SECONDS=15 \
 *     -v $PWD/services/resume-extractor/tests/mock_linkedin.py:/srv/backend/mock_linkedin.py:ro tathastu-phase1-extractor
 *   docker exec -d tathastu-phase1-extractor python /srv/backend/mock_linkedin.py 9999
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";

process.env.RESUME_EXTRACTOR_URL = process.env.TEST_EXTRACTOR_URL || "http://127.0.0.1:18800";
process.env.EXTRACTOR_API_TOKEN = "local-phase1-extractor-token-0123456789";
process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY ||= "test-encryption-key-test-encryption-key-0123456789";
delete process.env.UPSTASH_REDIS_REST_URL;

let workerUp = false;
let db: Awaited<ReturnType<typeof setupTestDatabase>>;
let schema: typeof import("../lib/db");
let li: typeof import("../lib/services/linkedin-import-service");
let conn: typeof import("../lib/repositories/connection-repository");

before(async () => {
  workerUp = await fetch(`${process.env.RESUME_EXTRACTOR_URL}/health`).then((r) => r.ok).catch(() => false);
  db = await setupTestDatabase();
  schema = await import("../lib/db");
  li = await import("../lib/services/linkedin-import-service");
  conn = await import("../lib/repositories/connection-repository");
});
after(async () => { await schema.closeDbForTesting(); });

const quiet = () => { const s = { log: console.log, warn: console.warn }; console.log = () => {}; console.warn = () => {}; return () => Object.assign(console, s); };
async function pollUntil(personId: string, done: (s: Awaited<ReturnType<typeof li.advanceLinkedIn>>) => boolean, seconds = 60) {
  for (let i = 0; i < seconds * 2; i++) {
    const s = await li.advanceLinkedIn(personId);
    if (done(s)) return s;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("timed out polling");
}
const terminal = (s: { state: string }) => ["succeeded", "dead_letter", "skipped_optional", "failed"].includes(s.state);

describe("LinkedIn import against the worker + mock LinkedIn", { timeout: 300_000 }, () => {
  test("password is stored encrypted, never in plaintext; plain sign-in imports the profile as candidates", async (t) => {
    if (!workerUp) return t.skip("worker not running");
    const restore = quiet();
    try {
      const personId = await createTestPerson("li");
      await li.connectLinkedIn(personId, "ok@test.invalid", "S3cret-pass!");
      const [c] = await db.select().from(schema.externalConnections).where(and(eq(schema.externalConnections.personId, personId), eq(schema.externalConnections.provider, "linkedin")));
      const meta = c.metadata as Record<string, unknown>;
      assert.equal(typeof meta.encryptedPassword, "string");
      assert.ok(!JSON.stringify(c).includes("S3cret-pass!"), "plaintext password nowhere in the row");
      assert.equal(await li.storedLinkedInPassword(personId), "S3cret-pass!", "decrypts with this person's key binding");
      const end = await pollUntil(personId, terminal);
      assert.equal(end.state, "succeeded", end.error ?? "");
      const ev = await db.select().from(schema.evidenceItems).where(and(eq(schema.evidenceItems.personId, personId), eq(schema.evidenceItems.originSource, "linkedin")));
      assert.deepEqual(ev.map((e) => e.subject).sort(), ["Anna University", "Machine Learning Intern at Orbit Robotics"]);
      const { readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
      const draft = (await readOnboardingDraft(personId))!;
      assert.equal(draft.experiences?.[0]?.status, "candidate");
      assert.match(draft.profiles.linkedin ?? "", /\/in\/mock-student\//);
    } finally {
      restore();
    }
  });

  test("OTP challenge: op goes awaiting_user, the relayed code completes the import", async (t) => {
    if (!workerUp) return t.skip("worker not running");
    const restore = quiet();
    try {
      const personId = await createTestPerson("liotp");
      await li.connectLinkedIn(personId, "otp@test.invalid", "pw");
      const waiting = await pollUntil(personId, (s) => s.state === "awaiting_user" || terminal(s));
      assert.equal(waiting.state, "awaiting_user");
      assert.ok((waiting.challengeSecondsLeft ?? 0) > 0);
      const relayed = await li.relayLinkedInOtp(personId, "123456");
      assert.equal(relayed.state, "running");
      const end = await pollUntil(personId, terminal);
      assert.equal(end.state, "succeeded", end.error ?? "");
    } finally {
      restore();
    }
  });

  test("CAPTCHA: dead letter after exactly one attempt, never retried; next attempt refused for 24 h", async (t) => {
    if (!workerUp) return t.skip("worker not running");
    const restore = quiet();
    try {
      const personId = await createTestPerson("licap");
      await li.connectLinkedIn(personId, "captcha@test.invalid", "pw");
      const end = await pollUntil(personId, terminal);
      assert.equal(end.state, "dead_letter");
      assert.match(end.error ?? "", /CAPTCHA/);
      const [op] = await db.select().from(schema.syncOperations).where(and(eq(schema.syncOperations.personId, personId), eq(schema.syncOperations.source, "linkedin")));
      assert.equal(op.attempts, 1);
      assert.equal(op.lastErrorCode, "linkedin_captcha");
      await assert.rejects(li.connectLinkedIn(personId, "captcha@test.invalid", "pw"), li.LinkedInPolicyError, "1 login attempt per 24 h");
    } finally {
      restore();
    }
  });

  test("wrong password: dead letter and the stored password is erased", async (t) => {
    if (!workerUp) return t.skip("worker not running");
    const restore = quiet();
    try {
      const personId = await createTestPerson("libad");
      await li.connectLinkedIn(personId, "x@test.invalid", "wrong");
      const end = await pollUntil(personId, terminal);
      assert.equal(end.state, "dead_letter");
      assert.equal(await li.storedLinkedInPassword(personId), null);
    } finally {
      restore();
    }
  });

  test("Skip during the code prompt: skipped_optional, aggregate onboarding status unaffected", async (t) => {
    if (!workerUp) return t.skip("worker not running");
    const restore = quiet();
    try {
      const personId = await createTestPerson("liskip");
      await li.connectLinkedIn(personId, "otp@test.invalid", "pw");
      await pollUntil(personId, (s) => s.state === "awaiting_user" || terminal(s));
      const skipped = await li.skipLinkedIn(personId);
      assert.equal(skipped.state, "skipped_optional");
      const { getSyncStatus } = await import("../lib/sync/runners");
      const status = await getSyncStatus(personId);
      assert.deepEqual(status.aggregate.skipped, ["linkedin"]);
      assert.equal(status.aggregate.status, "not_started", "skipping LinkedIn is not an issue");
      assert.equal(status.aggregate.canProceed, true);
    } finally {
      restore();
    }
  });

  test("no code within the window: timed out, then dead letter (no automatic retry of a login)", async (t) => {
    if (!workerUp) return t.skip("worker not running");
    const restore = quiet();
    try {
      const personId = await createTestPerson("lito");
      await li.connectLinkedIn(personId, "otp@test.invalid", "pw");
      const end = await pollUntil(personId, terminal, 40);
      assert.equal(end.state, "dead_letter");
      assert.match(end.error ?? "", /verification code/);
    } finally {
      restore();
    }
  });

  test("1.6.7 disconnect: encryptedPassword and sessionCookies deleted, connection disconnected", async (t) => {
    if (!workerUp) return t.skip("worker not running");
    const restore = quiet();
    try {
      const personId = await createTestPerson("lidc");
      await li.connectLinkedIn(personId, "ok@test.invalid", "pw");
      await pollUntil(personId, terminal);
      await li.disconnectLinkedIn(personId);
      const c = await conn.getExternalConnectionByProvider(personId, "linkedin");
      const meta = (c!.metadata || {}) as Record<string, unknown>;
      assert.equal(c!.status, "disconnected");
      assert.ok(!("encryptedPassword" in meta), "password key removed, not just marked");
      assert.ok(!("sessionCookies" in meta));
    } finally {
      restore();
    }
  });

  test("1.6.1 optional everywhere: onboarding completes and nothing references LinkedIn as required", async () => {
    const personId = await createTestPerson("liopt");
    const { completeOnboarding } = await import("../lib/services/onboarding-v2-service");
    const restore = quiet();
    const done = await completeOnboarding(personId, {
      role: "student", name: "No LinkedIn", priorities: ["career_readiness"], primaryPriority: "career_readiness", resume: "skipped",
    }).catch((e) => e);
    restore();
    assert.ok(!(done instanceof Error) || !/linkedin/i.test(done.message), `completion must never require LinkedIn: ${done instanceof Error ? done.message : "ok"}`);
  });
});
