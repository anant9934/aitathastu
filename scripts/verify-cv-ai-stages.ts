/**
 * Stage-specific AI routing for CV extraction, with fake providers only (no
 * network, no API keys): routing and model selection, fallback, the
 * evidence-based whole-CV gate, independent verification, redaction,
 * timeouts, malformed output, duplicates, reprocessing and usage reporting.
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-cv-ai-stages.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";
import { stageRoute, estimateCostUsd } from "../lib/intelligence/stage-routing";
import { readDocumentText } from "../lib/resume/document-text";
import { extractResumeDeterministicResult, shouldEnrichWithLLM } from "../lib/services/resume-extraction-service";

const FIX = path.join(process.cwd(), "eval/cv/fixtures");

type Reply = (req: { userPrompt: string; systemPrompt: string; model?: string; task: string }) => unknown;
async function fakeRouter(providers: Array<{ name: "groq" | "gemini" | "openrouter"; reply: Reply }>) {
  const { IntelligenceRouter } = await import("../lib/intelligence/router");
  const router = new IntelligenceRouter();
  const calls: Array<{ provider: string; model?: string; task: string; prompt: string }> = [];
  (router as unknown as { providers: unknown[] }).providers = providers.map((p) => ({
    name: p.name, structuredCapability: "strict_json_schema", isAvailable: () => true,
    completeStructured: async (req: { userPrompt: string; systemPrompt: string; model?: string; task: string }) => {
      calls.push({ provider: p.name, model: req.model, task: req.task, prompt: req.userPrompt });
      const r = await p.reply(req);
      if (r instanceof Error) throw r;
      return { content: typeof r === "string" ? r : JSON.stringify(r), modelUsed: req.model ?? `${p.name}-configured`, totalTokens: 1000 };
    },
  }));
  return { router, calls };
}

async function withLiveFlag<T>(fn: () => Promise<T>) {
  const prev = process.env.CORE_DISABLE_LIVE_LLM;
  process.env.CORE_DISABLE_LIVE_LLM = "false";
  try { return await fn(); } finally { process.env.CORE_DISABLE_LIVE_LLM = prev; }
}

test("stage routes: providers and models come from configuration, are validated, and verification excludes producers", () => {
  const env = {
    CLOUD_AI_PROVIDER_ORDER: "groq,gemini,openrouter",
    AI_STAGE_STRUCTURE_PROVIDERS: "gemini, groq, mistral, gemini",
    AI_STAGE_STRUCTURE_MODEL_GEMINI: "model-a",
    AI_STAGE_STRUCTURE_MODEL_GROQ: "bad model id; rm -rf",
  } as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(stageRoute("structure", { env }), { providers: ["gemini", "groq"], models: { gemini: "model-a" } }, "unknown providers, duplicates and malformed model ids are ignored");
  assert.deepEqual(stageRoute("recovery", { env }), { models: {} }, "an unconfigured stage uses the global order and configured models");
  assert.deepEqual(stageRoute("verify", { env, exclude: ["groq"] }).providers, ["gemini", "openrouter"]);
  assert.equal(stageRoute("verify", { env: { CLOUD_AI_PROVIDER_ORDER: "groq" } as unknown as NodeJS.ProcessEnv, exclude: ["groq"] }).unavailable, "no_independent_provider");
  assert.equal(estimateCostUsd("groq", 1000, {} as unknown as NodeJS.ProcessEnv), null, "no configured price, no invented cost");
  assert.equal(estimateCostUsd("groq", 2_000_000, { AI_PRICE_USD_PER_1M_TOKENS_GROQ: "0.5" } as unknown as NodeJS.ProcessEnv), 1);
});

test("router: a stage route narrows and orders providers, passes the stage model, and falls back on 429", async () => {
  await setupTestDatabase();
  await withLiveFlag(async () => {
    const { ProviderHttpError } = await import("../lib/intelligence/types");
    const { z } = await import("zod");
    const { router, calls } = await fakeRouter([
      { name: "groq", reply: () => ({ ok: true }) },
      { name: "gemini", reply: () => new ProviderHttpError("gemini", 429, "rate limited") },
      { name: "openrouter", reply: () => ({ ok: true }) },
    ]);
    const res = await router.completeStructured({
      task: "RESUME_RECOVERY", systemPrompt: "s", userPrompt: "u", schemaName: "x", jsonSchema: {},
      providers: ["gemini", "openrouter"], models: { openrouter: "stage-model" },
    }, z.object({ ok: z.boolean() }).strict());
    assert.deepEqual(calls.map((c) => [c.provider, c.model]), [["gemini", undefined], ["openrouter", "stage-model"]], "groq is outside the route; gemini fails over to openrouter");
    assert.deepEqual([res.provider, res.model, res.attempts.map((a) => a.outcome)], ["openrouter", "stage-model", ["rate_limited_or_5xx", "ok"]]);
    assert.equal(router.isProviderCoolingDown("gemini"), true, "the rate-limited provider cools down");
  });
});

test("whole-CV gate: well-read documents skip the call; a poor scan or an empty detected section triggers it", async () => {
  const prev = process.env.CORE_DISABLE_LIVE_LLM;
  process.env.CORE_DISABLE_LIVE_LLM = "false";
  try {
    for (const f of ["aarav-fresher--pdf-single.pdf", "meera-research--docx-plain.docx", "ishaan-modern--pdf-single.pdf"]) {
      const doc = await readDocumentText(fs.readFileSync(path.join(FIX, f)), f.endsWith(".docx") ? "docx" : "pdf");
      const r = extractResumeDeterministicResult(doc.text, doc.hyperlinks, { lines: doc.lines });
      assert.deepEqual(shouldEnrichWithLLM(r.extracted, { consent: true, rawText: doc.text, quality: r.quality }), { shouldEnrich: false, reason: "deterministic_result_reliable" }, f);
    }
    const r = extractResumeDeterministicResult("Asha Rao\nEXPERIENCE\nAnalyst | Acme | 2020 – 2022", [], {});
    assert.equal(shouldEnrichWithLLM(r.extracted, { consent: true, rawText: "x".repeat(100), quality: { ...r.quality!, textQuality: "poor" } }).reason, "low_text_quality");
    const empty = extractResumeDeterministicResult("Asha Rao\nPROJECTS\n\nSKILLS\nPython", [], {});
    assert.equal(shouldEnrichWithLLM(empty.extracted, { consent: true, rawText: "Asha Rao\nPROJECTS\n- \nSKILLS\nPython", quality: empty.quality }).reason, "projects_section_detected_but_zero_records_extracted");
  } finally {
    process.env.CORE_DISABLE_LIVE_LLM = prev;
  }
});

const AI_CV = [
  "Riya Sen", "riya.sen@example.com | +91 98765 43210", "Date of Birth: 12 March 2001",
  "EXPERIENCE", "Senior Analyst | Mar 2020 – Present", "- Worked at the Bharat Electricity Board on billing analytics.",
  "EDUCATION", "Jadavpur University | B.E. Electrical Engineering | 2014 – 2018",
  "PROJECTS", "Tariff Explorer | Python, Pandas", "- Interactive explorer of state electricity tariffs across ten years.",
  "Meter Anomaly Finder | Python, scikit-learn", "- Flags smart-meter readings that deviate from usual load curves.",
  "SKILLS", "Python, SQL, Pandas, scikit-learn, Plotly, PostgreSQL",
].join("\n");

test("verification: a different provider checks AI values; unsupported values are removed; agreement never auto-approves", async () => {
  await setupTestDatabase();
  await withLiveFlag(async () => {
    const { buildResumeReview } = await import("../lib/services/resume-ingestion-service");
    const VALID = { name: "Riya Sen", email: null, phone: null, location: null, links: [], education: [], experience: [], projects: [], skills: ["Python"], certifications: [], achievements: [] };
    const { router, calls } = await fakeRouter([
      { name: "groq", reply: (req) => req.task === "RESUME_STRUCTURE" ? VALID : { fixes: [{ gap: "experience_0", field: "company", value: "Bharat Electricity Board" }] } },
      { name: "gemini", reply: (req) => {
        const id = /Claim (c\d+): experience company/.exec(req.userPrompt)?.[1];
        return { verdicts: id ? [{ claim: id, verdict: "unsupported", quote: null }] : [] };
      } },
    ]);
    const built = await buildResumeReview({ text: AI_CV, hyperlinks: [], fileFormat: "txt", pageCount: 1, ocrUsed: false, via: "txt" }, { documentId: "d", personId: "p", aiConsent: true, router, stages: { recovery: true, verify: true } });
    const verifyCalls = calls.filter((c) => c.task === "RESUME_VERIFY");
    assert.equal(verifyCalls.length, 1);
    assert.equal(verifyCalls[0].provider, "gemini", "the verifier is not the provider that produced the value");
    assert.ok(!/98765|riya\.sen@|12 March 2001/.test(verifyCalls[0].prompt), "no contact details or birth date in the verification prompt");
    const exp = built.extractedInterpretation.experience[0];
    assert.equal(exp.company, "", "a value the verifier rejects is removed");
    assert.ok(exp.review?.issues.includes("verification_rejected"));
    const meta = built.review.extractionMeta as { verification: { rejected: number }; ai: { calls: Array<{ stage: string; provider?: string; totalTokens?: number }>; totalTokens: number; costUsd: number | null } };
    assert.equal(meta.verification.rejected, 1);
    assert.deepEqual(meta.ai.calls.map((c) => [c.stage, c.provider]), [["recovery", "groq"], ["verify", "gemini"]], "the whole-CV pass is skipped for this well-read CV");
    assert.equal(meta.ai.totalTokens, 2000);
    assert.equal(meta.ai.costUsd, null, "cost is unknown without configured prices");
  });
});

test("verification: a supported verdict needs a quote that is really in the lines; it still leaves the value for review", async () => {
  await setupTestDatabase();
  await withLiveFlag(async () => {
    const { verifyAiValues } = await import("../lib/resume/ai-verification");
    const text = "Asha Rao\nEXPERIENCE\nAnalyst | Jan 2020 – Mar 2022\n- Built dashboards for Acme Analytics clients.";
    const make = () => ({ education: [], certifications: [], projects: [], skills: [], achievements: [],
      experience: [{ company: "Acme Analytics", role: "Analyst", provenance: "llm", review: { status: "needs_review", confidence: 0.6, issues: ["model_extracted"], fields: {} } }] }) as never;
    const x1 = make();
    const { router: r1 } = await fakeRouter([{ name: "gemini", reply: () => ({ verdicts: [{ claim: "c0", verdict: "supported", quote: "dashboards for Acme Analytics clients" }, { claim: "c1", verdict: "supported", quote: "Analyst at Google" }] }) }]);
    const o1 = await verifyAiValues(x1, text, { producers: ["groq"], router: r1 });
    assert.deepEqual([o1.supported, o1.unclear], [1, 1], "an invented quote does not count as support");
    const r = (x1 as { experience: Array<{ review: { status: string; issues: string[] } }> }).experience[0];
    assert.equal(r.review.status, "needs_review");
    assert.ok(r.review.issues.includes("second_model_agreed") && r.review.issues.includes("verification_unclear"));

    const { router: r2 } = await fakeRouter([{ name: "gemini", reply: () => new Promise(() => undefined) }]);
    const o2 = await verifyAiValues(make(), text, { producers: ["groq"], router: r2, budgetMs: 1_000 });
    assert.equal(o2.reason, "llm_deadline");
    const { router: r3 } = await fakeRouter([{ name: "gemini", reply: () => "{not json" }]);
    const x3 = make();
    const o3 = await verifyAiValues(x3, text, { producers: ["groq"], router: r3 });
    assert.equal(o3.reason, "llm_provider", "malformed output fails closed");
    assert.equal((x3 as { experience: Array<{ company: string }> }).experience[0].company, "Acme Analytics", "nothing changes on failure");
    // The only configured provider produced the values: the verifier never asks it.
    const { router: r4, calls: c4 } = await fakeRouter([{ name: "gemini", reply: () => ({ verdicts: [] }) }]);
    const o4 = await verifyAiValues(make(), text, { producers: ["gemini"], router: r4 });
    assert.equal(c4.length, 0, "the producer is never its own verifier");
    assert.equal(o4.reason, "llm_not_configured");
  });
});

test("duplicates and reprocessing: AI stages do not add records twice, and confirmed values survive a reprocess", async () => {
  await setupTestDatabase();
  await withLiveFlag(async () => {
    const { buildResumeReview } = await import("../lib/services/resume-ingestion-service");
    const { router } = await fakeRouter([
      { name: "groq", reply: (req) => req.task === "RESUME_RECOVERY" ? { fixes: [{ gap: "experience_0", field: "company", value: "Bharat Electricity Board" }] } : { verdicts: [] } },
    ]);
    const input = { text: AI_CV, hyperlinks: [], fileFormat: "txt", pageCount: 1, ocrUsed: false, via: "txt" };
    const a = await buildResumeReview(input, { documentId: "d", personId: "p", aiConsent: true, router, stages: { recovery: true } });
    const b = await buildResumeReview(input, { documentId: "d", personId: "p", aiConsent: true, router, stages: { recovery: true } });
    assert.deepEqual(a.reviewCandidates.map((c) => c.candidateId), b.reviewCandidates.map((c) => c.candidateId), "same suggestions on a second run");
    assert.equal(a.extractedInterpretation.experience.length, 1);

    const { queueResumeUpload, processResumeJob, getResumeJobStatus, requeueResumeDocument } = await import("../lib/services/resume-ingestion-service");
    const { recordDecisions } = await import("../lib/services/resume-extraction-persistence");
    const owner = await createTestPerson("cvaistage");
    const { jobId, documentId } = await queueResumeUpload({ personId: owner, filename: "cv.txt", mimeType: "text/plain", bytes: Buffer.from(AI_CV) });
    await processResumeJob(jobId, owner);
    const s1 = await getResumeJobStatus(documentId, owner, jobId);
    const exp = s1.result!.reviewCandidates.find((c) => c.category === "experience")!;
    await recordDecisions(owner, documentId, [{ candidateId: exp.candidateId, state: "confirmed", correctedValue: "Senior Analyst · Bharat Electricity Board" }]);
    const again = await requeueResumeDocument(owner, documentId);
    await processResumeJob(again!, owner);
    const s2 = await getResumeJobStatus(documentId, owner, again);
    const kept = s2.result!.reviewCandidates.find((c) => c.candidateId === exp.candidateId)!;
    assert.deepEqual([kept.decision, kept.decidedValue], ["confirmed", "Senior Analyst · Bharat Electricity Board"]);
  });
});

test("independence: a provider serving the producer's model is not a second opinion", () => {
  const env = { CLOUD_AI_PROVIDER_ORDER: "groq,gemini,openrouter", GROQ_MODEL: "openai/gpt-oss-120b", OPENROUTER_MODEL: "\"openai/gpt-oss-120b\"", GEMINI_MODEL: "gemini-3.5-flash-lite" } as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(stageRoute("verify", { env, exclude: ["groq"], excludeModels: ["openai/gpt-oss-120b"] }).providers, ["gemini"]);
  const geminiOnly = { ...env, CLOUD_AI_PROVIDER_ORDER: "groq,openrouter" } as unknown as NodeJS.ProcessEnv;
  assert.equal(stageRoute("verify", { env: geminiOnly, exclude: ["groq"], excludeModels: ["openai/gpt-oss-120b"] }).unavailable, "no_independent_provider");
});

test("deadline: with under 10 s left the whole-CV call is skipped, under 4 s recovery and verification are too", async () => {
  await setupTestDatabase();
  await withLiveFlag(async () => {
    const { buildResumeReview } = await import("../lib/services/resume-ingestion-service");
    const { router, calls } = await fakeRouter([{ name: "groq", reply: () => ({ fixes: [], verdicts: [] }) }]);
    const poor = { text: "Asha Rao\nEXPERIENCE\nAnalyst | 2020 – 2022\n- x\nPROJECTS\n\nSKILLS\nPython", hyperlinks: [], fileFormat: "txt", pageCount: 1, ocrUsed: false, via: "txt" };
    // 8.5 s left: 3.5 s after the persistence margin.
    const built = await buildResumeReview(poor, { documentId: "d", personId: "p", aiConsent: true, router, stages: { recovery: true, verify: true }, deadlineAt: Date.now() + 8_500 });
    const meta = built.review.extractionMeta as { ai: { calls: Array<{ stage: string; outcome: string; reason?: string }> }; recovery?: { reason?: string } };
    assert.equal(calls.length, 0, "no provider is called");
    assert.deepEqual(meta.ai.calls.map((c) => [c.stage, c.outcome, c.reason]), [["structure", "skipped", "time_budget_exhausted"]]);
    assert.equal(meta.recovery?.reason, "time_budget_exhausted");
    assert.ok(built.reviewCandidates.length > 0, "the deterministic result is still returned in time");
  });
});

test("usage: input/output tokens, attempts and fallback are recorded from provider responses only", async () => {
  await setupTestDatabase();
  await withLiveFlag(async () => {
    const { recoverMissingFields } = await import("../lib/resume/targeted-recovery");
    const { extractResumeDeterministic } = await import("../lib/resume/deterministic-extractor");
    const { ProviderHttpError } = await import("../lib/intelligence/types");
    const { IntelligenceRouter } = await import("../lib/intelligence/router");
    const router = new IntelligenceRouter();
    (router as unknown as { providers: unknown[] }).providers = [
      { name: "groq", structuredCapability: "strict_json_schema", isAvailable: () => true, completeStructured: async () => { throw new ProviderHttpError("groq", 503, "unavailable"); } },
      { name: "gemini", structuredCapability: "strict_json_schema", isAvailable: () => true, completeStructured: async () => ({ content: JSON.stringify({ fixes: [] }), modelUsed: "m", totalTokens: 120, inputTokens: 100, outputTokens: 20 }) },
    ];
    const x = extractResumeDeterministic(AI_CV, [], {}).interpretation;
    const o = await recoverMissingFields(x, AI_CV, { router });
    assert.deepEqual([o.usage?.inputTokens, o.usage?.outputTokens, o.usage?.attempts, o.usage?.fallback], [100, 20, 2, true]);
  });
});

test("quota exhaustion and provider errors leave the deterministic extraction and saved edits intact", async () => {
  await setupTestDatabase();
  await withLiveFlag(async () => {
    const { buildResumeReview } = await import("../lib/services/resume-ingestion-service");
    const { ProviderHttpError } = await import("../lib/intelligence/types");
    const input = { text: AI_CV, hyperlinks: [], fileFormat: "txt", pageCount: 1, ocrUsed: false, via: "txt" };
    const plain = await buildResumeReview(input, { documentId: "d", personId: "p", aiConsent: false });
    const { router } = await fakeRouter([
      { name: "groq", reply: () => new ProviderHttpError("groq", 402, "insufficient credits") },
      { name: "gemini", reply: () => "{broken" },
    ]);
    const failed = await buildResumeReview(input, { documentId: "d", personId: "p", aiConsent: true, router, stages: { recovery: true, verify: true } });
    assert.deepEqual(failed.extractedInterpretation.experience, plain.extractedInterpretation.experience, "nothing changes when every provider fails");
    assert.deepEqual(failed.reviewCandidates.map((c) => c.candidateId), plain.reviewCandidates.map((c) => c.candidateId));
    assert.equal(router.isProviderCoolingDown("groq"), true, "an account-wide quota error cools the provider down");
  });
});

test("live-eval guard: production-like settings are overridden; only provider hosts, under a ceiling, can be reached", async () => {
  const { installLiveEvalGuard } = await import("../eval/cv/live-guard");
  const env = { NODE_ENV: "production", DATABASE_URL: "postgres://u:p@ep-prod.neon.tech/db", DATABASE_MODE: "postgres", DATABASE_TRANSPORT: "neon-http", UPSTASH_REDIS_REST_URL: "https://prod.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" } as unknown as NodeJS.ProcessEnv;
  const sent: string[] = [];
  const target = { fetch: (async (input: string) => { sent.push(new URL(input).hostname); return new Response("{}"); }) as unknown as typeof fetch };
  const { stats } = installLiveEvalGuard({ env, ceiling: 2, target });
  assert.deepEqual([env.NODE_ENV, env.DATABASE_URL, env.DATABASE_MODE, env.PGLITE_IN_MEMORY, env.DATABASE_TRANSPORT, env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN], ["test", "", "pglite", "true", "", undefined, undefined]);
  await assert.rejects(target.fetch("https://prod.upstash.io/pipeline"), /blocked request to prod\.upstash\.io/);
  await assert.rejects(target.fetch("https://ep-prod.neon.tech/sql"), /blocked/);
  await target.fetch("https://api.groq.com/openai/v1/chat/completions");
  await target.fetch("https://generativelanguage.googleapis.com/v1beta/models/x:generateContent");
  await assert.rejects(target.fetch("https://openrouter.ai/api/v1/chat/completions"), /ceiling reached/);
  assert.deepEqual(sent, ["api.groq.com", "generativelanguage.googleapis.com"], "blocked and over-ceiling requests never reach the network");
  assert.deepEqual([stats.refusedOverCeiling, stats.blockedHosts], [1, { "prod.upstash.io": 1, "ep-prod.neon.tech": 1 }]);
});

test("live-eval guard: in a fresh process the database is in-memory PGlite and AI quotas stay in memory", async () => {
  const { execFileSync } = await import("node:child_process");
  const probe = `
    const { installLiveEvalGuard } = await import("./eval/cv/live-guard.ts");
    installLiveEvalGuard({ env: process.env, ceiling: 1 });
    const { getDb } = await import("./lib/db/index.ts");
    const db = await getDb();
    const { reserveAiQuota } = await import("./lib/intelligence/cost-control.ts");
    const q = await reserveAiQuota("eval-probe", 10);
    const { PGlite } = await import("@electric-sql/pglite");
    console.log(JSON.stringify({ pglite: db.$client instanceof PGlite, dataDir: db.$client?.dataDir ?? null, quotaBackend: q.backend }));
  `;
  const out = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", probe], {
    cwd: process.cwd(),
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", DATABASE_URL: "postgres://u:p@127.0.0.1:1/prod", DATABASE_MODE: "postgres", UPSTASH_REDIS_REST_URL: "https://127.0.0.1:1", UPSTASH_REDIS_REST_TOKEN: "t" },
    timeout: 120_000,
  }).toString().trim().split("\n").pop()!;
  const r = JSON.parse(out) as { pglite: boolean; dataDir: string | null; quotaBackend: string };
  assert.deepEqual([r.pglite, r.quotaBackend], [true, "memory"], out);
  assert.ok(!r.dataDir || /memory/.test(r.dataDir), "no on-disk database either");
});

test("live-eval runner: refuses without opt-in; with opt-in excludes real CVs and reaches no host but providers", async () => {
  const { spawnSync } = await import("node:child_process");
  const base = { PATH: process.env.PATH, HOME: process.env.HOME } as unknown as NodeJS.ProcessEnv;
  const refused = spawnSync(process.execPath, ["--import", "tsx", "eval/cv/run.ts", "--ai-configs", "recovery"], { env: base, encoding: "utf8", timeout: 120_000 });
  assert.equal(refused.status, 2);
  // Opted in but with no API keys at all: nothing can reach a provider, so this costs nothing.
  const dry = spawnSync(process.execPath, ["--import", "tsx", "eval/cv/run.ts", "--ai-configs", "deterministic,recovery", "--only", "ishaan-modern--pdf"], {
    env: { ...base, CV_EVAL_ALLOW_LIVE_AI: "yes", NODE_ENV: "production", DATABASE_URL: "postgres://u:p@127.0.0.1:1/prod", UPSTASH_REDIS_REST_URL: "https://127.0.0.1:1", UPSTASH_REDIS_REST_TOKEN: "t" },
    encoding: "utf8", timeout: 300_000,
  });
  assert.equal(dry.status, 0, dry.stderr.slice(-800));
  assert.match(dry.stderr, /Real CVs are excluded from AI configurations/);
  assert.match(dry.stdout, /provider requests sent: \{\}; refused at the ceiling of 132: 0; blocked non-provider hosts: \{\}/);
});

test("recovery is off by default: no provider call even with AI consent; AI_RECOVERY_ENABLED=true turns it on", async () => {
  await setupTestDatabase();
  await withLiveFlag(async () => {
    const { buildResumeReview } = await import("../lib/services/resume-ingestion-service");
    const input = { text: AI_CV, hyperlinks: [], fileFormat: "txt", pageCount: 1, ocrUsed: false, via: "txt" };
    const prev = process.env.AI_RECOVERY_ENABLED;
    try {
      delete process.env.AI_RECOVERY_ENABLED;
      const off = await fakeRouter([{ name: "groq", reply: () => ({ fixes: [{ gap: "experience_0", field: "company", value: "Bharat Electricity Board" }] }) }]);
      const builtOff = await buildResumeReview(input, { documentId: "d", personId: "p", aiConsent: true, router: off.router });
      assert.equal(off.calls.filter((c) => c.task === "RESUME_RECOVERY").length, 0, "no recovery call by default");
      assert.equal(off.calls.length, 0, "no provider call at all for this well-read CV");
      assert.equal(builtOff.extractedInterpretation.experience[0].company, "", "the gap stays for the student to fill");
      assert.equal((builtOff.review.extractionMeta as { recovery?: { reason?: string } }).recovery?.reason, "stage_disabled");

      process.env.AI_RECOVERY_ENABLED = "false";
      const no = await fakeRouter([{ name: "groq", reply: () => ({ fixes: [] }) }]);
      await buildResumeReview(input, { documentId: "d", personId: "p", aiConsent: true, router: no.router });
      assert.equal(no.calls.length, 0, "explicitly false: no call");

      process.env.AI_RECOVERY_ENABLED = "true";
      const on = await fakeRouter([{ name: "groq", reply: () => ({ fixes: [{ gap: "experience_0", field: "company", value: "Bharat Electricity Board" }] }) }]);
      const builtOn = await buildResumeReview(input, { documentId: "d", personId: "p", aiConsent: true, router: on.router });
      assert.equal(on.calls.filter((c) => c.task === "RESUME_RECOVERY").length, 1, "enabled: one recovery call");
      assert.equal(builtOn.extractedInterpretation.experience[0].company, "Bharat Electricity Board");

      const noConsent = await fakeRouter([{ name: "groq", reply: () => ({ fixes: [] }) }]);
      await buildResumeReview(input, { documentId: "d", personId: "p", aiConsent: false, router: noConsent.router });
      assert.equal(noConsent.calls.length, 0, "enabled but no consent: still no call");
    } finally {
      if (prev === undefined) delete process.env.AI_RECOVERY_ENABLED; else process.env.AI_RECOVERY_ENABLED = prev;
    }
  });
});
