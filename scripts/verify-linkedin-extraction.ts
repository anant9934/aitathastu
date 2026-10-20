/**
 * LinkedIn public-profile extraction through the real service, the real durable
 * job and a disposable LOCAL database (PGlite; scripts/lib/test-db.ts refuses
 * hosted hosts). Apify and Firecrawl are fake fetches: no network, no real
 * tokens, no paid runs, no real profiles.
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-linkedin-extraction.ts
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";

const TOKEN = "apify-test-token-not-real";
const ACTOR = "test-owner/test-linkedin-actor";

type RunScript = { start?: number; status?: string[]; items?: unknown[]; startStatus?: string };
const fake = {
  runs: 0,
  aborted: [] as string[],
  calls: [] as string[],
  firecrawled: [] as string[],
  /** Each started run takes the next script; the last one repeats. */
  scripts: [] as RunScript[],
  byRun: new Map<string, { script: RunScript; polls: number }>(),
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const realFetch = globalThis.fetch;

async function fakeProviders(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  if (url.hostname === "api.firecrawl.dev") {
    const target = String(JSON.parse(String(init?.body)).url);
    fake.firecrawled.push(target);
    return json({ success: true, data: { markdown: "# Asha builds things", metadata: { title: "Asha Rao — Portfolio", description: "Projects and writing" } } });
  }
  if (url.hostname !== "api.apify.com") return realFetch(input, init);
  assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${TOKEN}`, "every Apify call carries the server token");
  fake.calls.push(`${init?.method ?? "GET"} ${url.pathname}`);

  const start = url.pathname.match(/^\/v2\/acts\/([^/]+)\/runs$/);
  if (start && init?.method === "POST") {
    assert.equal(decodeURIComponent(start[1]), ACTOR.replace("/", "~"));
    assert.deepEqual(Object.keys(JSON.parse(String(init.body))), ["profileUrls"], "the actor gets only the profile URL");
    const script = fake.scripts[Math.min(fake.runs, fake.scripts.length - 1)];
    fake.runs++;
    if (script.start && script.start !== 201) return json({ error: { message: "nope" } }, script.start);
    const id = `run_${fake.runs}`;
    fake.byRun.set(id, { script, polls: 0 });
    return json({ data: { id, status: script.startStatus ?? script.status?.[0] ?? "RUNNING", defaultDatasetId: `ds_${id}` } }, 201);
  }
  const abort = url.pathname.match(/^\/v2\/actor-runs\/([^/]+)\/abort$/);
  if (abort) { fake.aborted.push(abort[1]); return json({ data: { id: abort[1], status: "ABORTED" } }); }
  const run = url.pathname.match(/^\/v2\/actor-runs\/([^/]+)$/);
  if (run) {
    const r = fake.byRun.get(run[1]);
    if (!r) return json({ error: { message: "not found" } }, 404);
    const statuses = r.script.status ?? ["SUCCEEDED"];
    const status = statuses[Math.min(++r.polls, statuses.length - 1)];
    return json({ data: { id: run[1], status, defaultDatasetId: `ds_${run[1]}` } });
  }
  const items = url.pathname.match(/^\/v2\/datasets\/ds_([^/]+)\/items$/);
  if (items) return json(fake.byRun.get(items[1])?.script.items ?? []);
  return json({ error: { message: "unexpected" } }, 404);
}

/** The provider output shape of the configured actor, for a public profile. */
const profile = (over: Record<string, unknown> = {}) => ({
  fullName: "Asha Rao", firstName: "Asha", lastName: "Rao", headline: "ML engineer", about: "I build retrieval systems.", location: "Pune, India",
  linkedinUrl: "https://www.linkedin.com/in/asha-rao", publicIdentifier: "asha-rao", connectionsCount: 500, followersCount: 900,
  experiences: [
    { title: "ML Intern", company: "DeepAI Labs", startDate: "Jan 2024", endDate: "Jun 2024", description: "Quantization.", employmentType: "Internship" },
    { title: "Engineer", company: "Acme", startDate: "Jul 2024", endDate: "Present", jobStillWorking: true },
  ],
  educations: [{ school: "IIT Bombay", degree: "B.Tech", fieldOfStudy: "Computer Science", startYear: "2020", endYear: "2024" }],
  skills: ["Python", { name: "PyTorch" }, "python"],
  languages: [{ name: "English", proficiency: "Full professional proficiency" }, "Hindi"],
  certifications: [{ name: "AWS Cloud Practitioner", authority: "Amazon Web Services", issueDate: "Mar 2023" }],
  courses: [{ name: "Deep Learning", number: "CS230" }],
  projects: [{ title: "RAG search", description: "Retrieval over course notes.", startDate: "2023-05" }],
  publications: [{ title: "Quantizing small LMs", publisher: "arXiv", date: "2024" }],
  volunteerExperiences: [{ organization: "Code Club", role: "Mentor", startDate: "2022" }],
  honorsAwards: [{ title: "Smart India Hackathon winner", issuer: "Government of India", date: "Dec 2022" }],
  websites: ["https://asha.dev", "https://www.linkedin.com/in/asha-rao", "http://localhost:3000"],
  articles: [{ headline: "What I learned shipping RAG", datePublished: "2024-02-10", url: "https://www.linkedin.com/pulse/rag-asha" }],
  updates: [{ text: "A post" }],
  peopleAlsoViewed: [{ fullName: "Someone Else", headline: "Recruiter", profileUrl: "https://www.linkedin.com/in/someone-else" }],
  ...over,
});

let clock = Date.now();
const now = () => clock;

before(async () => {
  await setupTestDatabase();
  for (const k of Object.keys(process.env)) if (/^(APIFY|FIRECRAWL)_/.test(k)) delete process.env[k];
  process.env.APIFY_LINKEDIN_ACTOR_ID = ACTOR;
  process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED = "true";
  process.env.APIFY_TOKEN = TOKEN;
  process.env.FIRECRAWL_API_KEY = "firecrawl-test-key-not-real";
  globalThis.fetch = fakeProviders as typeof fetch;
});
after(async () => {
  globalThis.fetch = realFetch;
  const { closeDbForTesting } = await import("../lib/db");
  await closeDbForTesting();
});
beforeEach(() => {
  fake.runs = 0; fake.aborted = []; fake.calls = []; fake.firecrawled = []; fake.scripts = []; fake.byRun.clear();
  clock += 3 * 60 * 60_000; // past any refresh cooldown from an earlier test
});

const svc = () => import("../lib/services/linkedin-extraction-service");

async function runToEnd(personId: string, jobId: string, maxSteps = 40) {
  const { advanceExtractionJob } = await svc();
  let view = await advanceExtractionJob(personId, jobId, { budgetMs: 60_000, now });
  for (let i = 0; i < maxSteps && view && ["queued", "running"].includes(view.state); i++) {
    clock += 4 * 60_000; // past any backoff and lease
    view = await advanceExtractionJob(personId, jobId, { budgetMs: 60_000, now });
  }
  return view!;
}

async function extract(personId: string, url = "linkedin.com/in/asha-rao", trigger: "initial" | "refresh" | "retry" = "initial") {
  const { requestExtraction } = await svc();
  const { job } = await requestExtraction(personId, url, trigger, { now: clock });
  return runToEnd(personId, job.id);
}

async function rows(personId: string) {
  const { getDb, linkedinProfileRecords, linkedinProfiles, evidenceItems } = await import("../lib/db");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  return {
    profile: (await db.select().from(linkedinProfiles).where(eq(linkedinProfiles.personId, personId)))[0] ?? null,
    records: await db.select().from(linkedinProfileRecords).where(eq(linkedinProfileRecords.personId, personId)),
    evidence: await db.select().from(evidenceItems).where(eq(evidenceItems.personId, personId)),
  };
}

test("migrations create both tables with their unique indexes, and replay cleanly", async () => {
  const { getDb } = await import("../lib/db");
  const { MIGRATION_SQL_STATEMENTS } = await import("../lib/db/migration-sql");
  const { sql } = await import("drizzle-orm");
  const db = (await getDb()) as unknown as { execute: (q: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> };
  for (const stmt of MIGRATION_SQL_STATEMENTS.filter((s) => /linkedin_profile/.test(s))) await db.execute(sql.raw(stmt)); // a second replay
  const idx = await db.execute(sql.raw("select indexname from pg_indexes where tablename in ('linkedin_profiles','linkedin_profile_records','source_processing_jobs') order by indexname"));
  const names = idx.rows.map((r) => r.indexname);
  for (const n of ["uq_linkedin_profiles_person", "uq_linkedin_records_person_kind_key", "idx_linkedin_records_person", "uq_linkedin_extract_inflight"]) assert.ok(names.includes(n), n);
});

test("a public profile is extracted once, every category saved, nothing about other people", async () => {
  const personId = await createTestPerson("li-ok");
  fake.scripts = [{ status: ["RUNNING", "RUNNING", "SUCCEEDED"], items: [profile()] }];
  const view = await extract(personId);
  assert.equal(view.state, "succeeded");
  assert.equal(fake.runs, 1, "exactly one provider run");
  assert.deepEqual(view.counts, { experience: 2, education: 1, skill: 2, language: 2, certification: 1, course: 1, project: 1, publication: 2, volunteering: 1, honor: 1, link: 2 });

  const { profile: p, records, evidence } = await rows(personId);
  assert.equal(p.fullName, "Asha Rao");
  assert.equal(p.publicIdentifier, "asha-rao");
  assert.ok(p.lastSuccessfulAt && p.lastSuccessfulJobId === view.id);
  assert.equal(records.length, 16);
  const all = JSON.stringify(records);
  assert.ok(!all.includes("Someone Else") && !all.includes("someone-else") && !all.includes("A post"), "people-also-viewed and posts are never stored");
  assert.ok(!all.includes("localhost"), "an unsafe URL is not kept");
  assert.ok(records.every((r) => r.sourceUrl === "https://www.linkedin.com/in/asha-rao" && r.provider === "apify" && r.lastJobId === view.id));
  const acme = records.find((r) => r.kind === "experience" && (r.data as Record<string, unknown>).company === "Acme")!;
  assert.equal((acme.data as Record<string, unknown>).current, true);
  assert.equal((acme.data as Record<string, unknown>).endDate, undefined, "'Present' is not turned into a date");

  // Firecrawl read only the personal website; never LinkedIn, never an unsafe host.
  assert.deepEqual(fake.firecrawled, ["https://asha.dev"]);
  const site = records.find((r) => r.kind === "link" && (r.data as Record<string, unknown>).url === "https://asha.dev")!;
  assert.equal(((site.data as Record<string, unknown>).website as Record<string, unknown>).title, "Asha Rao — Portfolio");

  // Downstream: self-declared evidence, no artifact reference; draft candidates only.
  const li = evidence.filter((e) => e.originSource === "linkedin");
  assert.ok(li.length >= 10);
  assert.ok(li.every((e) => e.verificationStatus === "imported" && e.source === "imported" && e.sourceReference?.startsWith("linkedin:linkedin_apify_")), "self-declared, never verified, traceable to its import key");
  assert.ok(li.some((e) => e.category === "skill" && e.subject === "Python"));
  const { readOnboardingDraft } = await import("../lib/services/onboarding-v2-service");
  const draft = await readOnboardingDraft(personId);
  assert.equal(draft?.experiences?.length, 2);
  assert.ok(draft!.experiences!.every((e) => e.status === "candidate" && e.source === "linkedin"));
  assert.equal(draft?.experiences?.find((e) => e.company === "DeepAI Labs")?.type, "internship");
  assert.equal(draft?.education?.[0]?.institution, "IIT Bombay");
  assert.equal(draft?.profiles?.linkedin, "https://www.linkedin.com/in/asha-rao");
  assert.ok(!(draft?.skills ?? []).includes("Python"), "LinkedIn skills are not added as confirmed draft skills");

  const { getExternalConnectionByProvider } = await import("../lib/repositories/connection-repository");
  const conn = await getExternalConnectionByProvider(personId, "linkedin");
  assert.equal(conn?.status, "connected");
  assert.ok(!JSON.stringify(conn?.metadata).includes(TOKEN), "no token in connection metadata");
});

test("refresh is idempotent; a record the profile no longer lists is marked, not deleted", async () => {
  const personId = await createTestPerson("li-refresh");
  fake.scripts = [{ items: [profile()] }];
  await extract(personId);
  const first = await rows(personId);

  clock += 2 * 60 * 60_000; // past the refresh cooldown
  fake.scripts = [{ items: [profile({ experiences: [profile().experiences[1]], about: undefined })] }];
  const view = await extract(personId, "https://www.linkedin.com/in/asha-rao/", "refresh");
  assert.equal(view.state, "succeeded");
  const second = await rows(personId);
  assert.equal(second.records.length, first.records.length, "no duplicates and nothing deleted");
  assert.equal(second.evidence.length, first.evidence.length, "evidence is upserted, not duplicated");
  const gone = second.records.find((r) => (r.data as Record<string, unknown>).company === "DeepAI Labs")!;
  assert.ok(gone.missingSince, "the dropped role is flagged");
  assert.equal(second.records.filter((r) => r.missingSince).length, 1);
  assert.equal(second.profile.about, "I build retrieval systems.", "an omitted field keeps its previous value");
  assert.ok(second.profile.lastSuccessfulAt! > first.profile.lastSuccessfulAt!);
  const site = second.records.find((r) => r.kind === "link" && (r.data as Record<string, unknown>).url === "https://asha.dev")!;
  assert.ok((site.data as Record<string, unknown>).website, "website details survive a re-extraction");
});

test("transient failures retry with backoff up to the limit; a failed refresh keeps the last success", async () => {
  const personId = await createTestPerson("li-retry");
  fake.scripts = [{ items: [profile()] }];
  await extract(personId);
  const before = await rows(personId);

  clock += 2 * 60 * 60_000; // past the refresh cooldown
  fake.runs = 0;
  fake.scripts = [{ status: ["RUNNING", "FAILED"] }];
  const { requestExtraction, advanceExtractionJob, MAX_ATTEMPTS } = await svc();
  const { job } = await requestExtraction(personId, "linkedin.com/in/asha-rao", "refresh", { now: clock });
  let view = await advanceExtractionJob(personId, job.id, { budgetMs: 60_000, now });
  assert.equal(view?.state, "running");
  assert.ok(view?.retryAt, "waiting for the backoff");
  assert.match(view!.message!, /retrying automatically/);
  const blocked = await advanceExtractionJob(personId, job.id, { budgetMs: 60_000, now });
  assert.equal(fake.runs, 1, "nothing runs during the backoff");
  assert.equal(blocked?.attempt, 2);
  view = await runToEnd(personId, job.id);
  assert.equal(view.state, "failed");
  assert.equal(view.errorCode, "provider_unavailable");
  assert.equal(fake.runs, MAX_ATTEMPTS, "bounded: one provider run per attempt");

  const after = await rows(personId);
  assert.equal(after.records.length, before.records.length);
  assert.equal(after.profile.lastSuccessfulJobId, before.profile.lastSuccessfulJobId);
  assert.equal(after.profile.fullName, "Asha Rao");
  const { getExternalConnectionByProvider } = await import("../lib/repositories/connection-repository");
  assert.equal((await getExternalConnectionByProvider(personId, "linkedin"))?.status, "connected", "still connected with the earlier data");
});

test("permanent failures stop at once with a sanitized reason", async () => {
  const cases: Array<[RunScript, string]> = [
    [{ start: 401 }, "provider_auth"],
    [{ start: 402 }, "provider_quota"],
    [{ items: [] }, "profile_unavailable"],
    [{ items: [{ url: "https://www.linkedin.com/in/asha-rao", error: "Profile is private" }] }, "profile_unavailable"],
    [{ items: [profile({ publicIdentifier: "someone-else", linkedinUrl: "https://www.linkedin.com/in/someone-else" })] }, "profile_mismatch"],
  ];
  for (const [script, code] of cases) {
    fake.runs = 0;
    fake.scripts = [script];
    clock += 3 * 60 * 60_000;
    const personId = await createTestPerson(`li-${code}`);
    const view = await extract(personId);
    assert.equal(view.state, "failed", code);
    assert.equal(view.errorCode, code);
    assert.equal(fake.runs, 1, `${code} is not retried`);
    assert.ok(view.message && !view.message.includes(TOKEN) && !/apify\.com|HTTP \d/.test(view.message));
    const { profile: p, records } = await rows(personId);
    assert.equal(p, null, `${code}: nothing saved`);
    assert.equal(records.length, 0);
  }
});

test("partial: malformed records and missing core sections are reported, the rest is saved", async () => {
  const personId = await createTestPerson("li-partial");
  const p = profile({ experiences: [{ title: "Engineer", company: "Acme" }, { title: "No company" }, "junk"] });
  delete (p as Record<string, unknown>).skills;
  fake.scripts = [{ items: [p] }];
  const view = await extract(personId);
  assert.equal(view.state, "partial");
  assert.ok(view.unavailableSections.includes("skill"));
  assert.equal(view.counts.experience, 1);
});

test("a run that never finishes is aborted and counted as a failed attempt", async () => {
  const personId = await createTestPerson("li-timeout");
  fake.scripts = [{ status: ["RUNNING"] }];
  const view = await extract(personId, "linkedin.com/in/asha-rao");
  assert.equal(view.state, "failed");
  assert.equal(view.errorCode, "provider_timeout");
  assert.ok(fake.aborted.length >= 1, "the stuck provider run is aborted");
});

test("duplicate requests share one job; concurrent requests never start two", async () => {
  const personId = await createTestPerson("li-dupe");
  fake.scripts = [{ status: ["RUNNING"] }];
  const { requestExtraction, latestExtractionJob } = await svc();
  const [a, b] = await Promise.all([
    requestExtraction(personId, "linkedin.com/in/asha-rao", "initial", { now: clock }),
    requestExtraction(personId, "linkedin.com/in/asha-rao", "initial", { now: clock }),
  ]);
  assert.equal(a.job.id, b.job.id);
  const again = await requestExtraction(personId, "linkedin.com/in/asha-rao", "initial", { now: clock });
  assert.equal(again.existing, true);
  assert.equal(again.job.id, a.job.id);
  assert.equal((await latestExtractionJob(personId))?.id, a.job.id);
  const { getDb, sourceProcessingJobs } = await import("../lib/db");
  const { and, eq, inArray } = await import("drizzle-orm");
  const db = await getDb();
  const inFlight = await db.select().from(sourceProcessingJobs).where(and(eq(sourceProcessingJobs.personId, personId), inArray(sourceProcessingJobs.status, ["queued", "processing"])));
  assert.equal(inFlight.length, 1);
});

test("jobs belong to their student: another student can't read, advance or cancel them", async () => {
  const owner = await createTestPerson("li-owner");
  const other = await createTestPerson("li-other");
  fake.scripts = [{ status: ["RUNNING"] }];
  const { requestExtraction, advanceExtractionJob, requestExtractionCancel, readSavedProfile } = await svc();
  const { job } = await requestExtraction(owner, "linkedin.com/in/asha-rao", "initial", { now: clock });
  assert.equal(await advanceExtractionJob(other, job.id, { now }), null);
  assert.equal(await requestExtractionCancel(other, job.id), null);
  assert.equal(await readSavedProfile(other), null);
  assert.equal(fake.runs, 0, "nothing ran for the other student");
});

test("cancel stops the run and keeps earlier data", async () => {
  const personId = await createTestPerson("li-cancel");
  fake.scripts = [{ status: ["RUNNING"] }];
  const { requestExtraction, advanceExtractionJob, requestExtractionCancel } = await svc();
  const { job } = await requestExtraction(personId, "linkedin.com/in/asha-rao", "initial", { now: clock });
  await advanceExtractionJob(personId, job.id, { budgetMs: 1_000, now });
  clock += 2 * 60_000; // the lease from that step has expired
  const view = await requestExtractionCancel(personId, job.id);
  assert.equal(view?.state, "cancelled");
  assert.deepEqual(fake.aborted, ["run_1"]);
});

test("request guards: invalid URL, not configured, refresh cooldown, daily limit", async () => {
  const personId = await createTestPerson("li-guards");
  const { requestExtraction, ExtractionRequestError, DAILY_JOB_LIMIT } = await svc();
  for (const bad of ["https://evil.example/in/asha", "https://www.linkedin.com/company/acme", "javascript:alert(1)", ""]) {
    await assert.rejects(requestExtraction(personId, bad, "initial", { now: clock }), (e: unknown) => e instanceof ExtractionRequestError && e.code === "invalid_url" && e.status === 400, bad);
  }
  const saved = process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED;
  delete process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED;
  await assert.rejects(requestExtraction(personId, "linkedin.com/in/asha-rao", "initial"), (e: unknown) => e instanceof ExtractionRequestError && e.status === 503);
  process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED = saved;

  fake.scripts = [{ items: [profile()] }];
  await extract(personId);
  await assert.rejects(requestExtraction(personId, "linkedin.com/in/asha-rao", "refresh", { now: clock + 60_000 }), (e: unknown) => e instanceof ExtractionRequestError && e.code === "cooldown" && e.status === 429);

  const heavy = await createTestPerson("li-daily");
  fake.scripts = [{ start: 401 }];
  // The daily window is counted on the jobs' real creation times.
  for (let i = 0; i < DAILY_JOB_LIMIT; i++) {
    const { job } = await requestExtraction(heavy, "linkedin.com/in/asha-rao", "retry", { now: Date.now() });
    await runToEnd(heavy, job.id);
  }
  await assert.rejects(requestExtraction(heavy, "linkedin.com/in/asha-rao", "retry", { now: Date.now() }), (e: unknown) => e instanceof ExtractionRequestError && e.code === "daily_limit");
});

test("switching to a different profile replaces the previous profile's records", async () => {
  const personId = await createTestPerson("li-switch");
  fake.scripts = [{ items: [profile()] }];
  await extract(personId);
  fake.scripts = [{ items: [profile({ fullName: "Asha R", publicIdentifier: "asha-r", linkedinUrl: "https://www.linkedin.com/in/asha-r", experiences: [{ title: "Analyst", company: "Beta" }], educations: [], websites: [] })] }];
  const view = await extract(personId, "linkedin.com/in/asha-r");
  assert.equal(view.state, "succeeded");
  const { profile: p, records } = await rows(personId);
  assert.equal(p.publicIdentifier, "asha-r");
  assert.ok(records.every((r) => r.sourceUrl === "https://www.linkedin.com/in/asha-r"), "no records of the old profile remain");
});

test("the cron resumes an unattended job and closes a long-silent one", async () => {
  const personId = await createTestPerson("li-cron");
  fake.scripts = [{ items: [profile()] }];
  const { requestExtraction, resumeStalledExtractions, latestExtractionJob, viewOf } = await svc();
  await requestExtraction(personId, "linkedin.com/in/asha-rao", "initial");
  const out = await resumeStalledExtractions({ limit: 20, budgetMs: 30_000 });
  assert.ok(out.some((o) => o.state === "succeeded"), JSON.stringify(out));
  assert.equal(viewOf((await latestExtractionJob(personId))!).state, "succeeded");
});
