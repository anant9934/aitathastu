/**
 * CV extraction evaluation: runs every fixture (and, when present, the private
 * real-document set) through the production extraction code, scores it against
 * ground truth and reports metrics by document type.
 *
 *   node --import tsx eval/cv/run.ts [--label NAME] [--only SUBSTRING] [--verbose]
 *
 * No LLM is called (CORE_DISABLE_LIVE_LLM=true): this measures the
 * deterministic pipeline every upload gets. Results for synthetic documents go
 * to eval/cv/results/NAME.json; results that mention private documents go to
 * private-fixtures/results/ only.
 */

// Must stay the first import: isolates the database, Redis and network before
// any other module runs (see live-guard.ts). AI configurations need CV_EVAL_ALLOW_LIVE_AI=yes.
import { LIVE_AI, liveGuardStats } from "./live-guard";
const AI_CONFIGS = (process.argv.includes("--ai-configs") ? process.argv[process.argv.indexOf("--ai-configs") + 1] ?? "" : "").split(",").filter(Boolean);
process.env.CORE_DISABLE_LIVE_LLM = LIVE_AI ? "false" : "true";

import fs from "node:fs";
import path from "node:path";
import { readDocumentText } from "@/lib/resume/document-text";
import { buildResumeReview, textFromExtractorPayload } from "@/lib/services/resume-ingestion-service";
import { shouldEnrichWithLLM } from "@/lib/services/resume-extraction-service";
import { findRecoveryGaps } from "@/lib/resume/targeted-recovery";

/** Stage switches per benchmark configuration. */
const CONFIG_STAGES: Record<string, { consent: boolean; structure: boolean; recovery: boolean; verify: boolean }> = {
  deterministic: { consent: false, structure: false, recovery: false, verify: false },
  structure: { consent: true, structure: true, recovery: false, verify: false },
  recovery: { consent: true, structure: false, recovery: true, verify: false },
  "structure+recovery": { consent: true, structure: true, recovery: true, verify: false },
  all: { consent: true, structure: true, recovery: true, verify: true },
};
let CURRENT = CONFIG_STAGES.deterministic;
let CURRENT_NAME = "deterministic";
import * as uploadLimits from "@/lib/config/upload-limits";
import { EVAL_SET, FIXTURE_DIR, loadPrivateTruth, loadSpecs, truthFromSpec, type Truth } from "./truth";
import { add, prf, scoreDocument, norm, type Counts, type DocScore } from "./score";
import { emptyPrediction, ocrPayload, toPrediction } from "./pipeline";

const args = process.argv.slice(2);
const label = args.includes("--label") ? args[args.indexOf("--label") + 1] : "latest";
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const verbose = args.includes("--verbose");

const GROUP: Record<string, string> = {
  "pdf-single": "text-pdf", "pdf-table": "text-pdf-tables", "pdf-sidebar": "two-column-pdf", "pdf-multipage": "multi-page-pdf",
  "docx-plain": "docx", "docx-table": "docx-tables", txt: "plain-text", rtf: "rtf", "scan-good": "scanned-pdf", "scan-poor": "scanned-pdf-degraded", png: "image", jpg: "image",
};

const accepted = (ext: string) =>
  ((uploadLimits as Record<string, unknown>).RESUME_ACCEPTED_EXTENSIONS as string[] | undefined ?? ["pdf", "docx"]).includes(ext);

/** Whether each AI stage would run for this document, without calling anything. */
function wouldCall(built: Awaited<ReturnType<typeof buildResumeReview>>, text: string) {
  const prev = process.env.CORE_DISABLE_LIVE_LLM;
  process.env.CORE_DISABLE_LIVE_LLM = "false";
  try {
    const d = shouldEnrichWithLLM(built.extraction.extracted, { consent: true, rawText: text, quality: built.extraction.quality });
    return { structure: d.shouldEnrich ? d.reason : null, recoveryGaps: built.extraction.extracted ? findRecoveryGaps(built.extraction.extracted, text).length : 0 };
  } finally {
    process.env.CORE_DISABLE_LIVE_LLM = prev;
  }
}

async function extract(file: string) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const started = Date.now();
  if (!accepted(ext)) return { supported: false, text: "", ocrUsed: false, latencyMs: 0, review: null, ocrText: "" };
  let input;
  let ocrText = "";
  if (ext === "pdf" || ext === "docx" || ext === "txt" || ext === "rtf") {
    const parsed = await readDocumentText(fs.readFileSync(file), ext);
    if (parsed.text.replace(/\s/g, "").length >= 40) {
      input = { text: parsed.text, hyperlinks: parsed.hyperlinks, fileFormat: ext, pageCount: parsed.pageCount, ocrUsed: false, via: ext === "pdf" ? "native-pdf" : ext, lines: parsed.lines };
    }
  }
  if (!input) {
    const raw = ocrPayload(file);
    ocrText = raw.raw_text;
    const { text, hyperlinks, pageCount, lines, pageQuality } = textFromExtractorPayload(raw as never);
    input = { text, hyperlinks, fileFormat: ext, pageCount, ocrUsed: true, via: "extractor-ocr", renderProfile: raw.profile as never, lines, pageQuality };
  }
  // One evaluation "person" per document and configuration, as each CV is a different
  // student: per-person AI quotas then behave as in production instead of accumulating.
  const built = await buildResumeReview(input as never, { documentId: "eval-doc", personId: `eval-${CURRENT_NAME}-${path.basename(file)}`, aiConsent: CURRENT.consent, stages: { structure: CURRENT.structure, recovery: CURRENT.recovery, verify: CURRENT.verify } });
  return { supported: true, text: input.text, ocrUsed: input.ocrUsed, latencyMs: Date.now() - started, review: built.review, ocrText, would: wouldCall(built, input.text) };
}

/** Order-insensitive word recall of OCR text against the text layer of the source PDF. */
function wordRecall(reference: string, ocr: string) {
  const bag = (s: string) => norm(s).split(" ").filter((w) => w.length > 1);
  const pool = new Map<string, number>();
  for (const w of bag(ocr)) pool.set(w, (pool.get(w) || 0) + 1);
  const ref = bag(reference);
  let hit = 0;
  for (const w of ref) { const n = pool.get(w) || 0; if (n > 0) { hit++; pool.set(w, n - 1); } }
  return ref.length ? hit / ref.length : 1;
}

type Row = { would?: { structure: string | null; recoveryGaps: number }; ai?: { calls: import("@/lib/intelligence/stage-routing").AiCallRecord[]; totalTokens: number; costUsd: number | null }; style?: string; file: string; group: string; spec: string; supported: boolean; ocrUsed: boolean; latencyMs: number; score: DocScore; wordRecall?: number; failed?: string };

async function main(capture?: Row[]) {
  const jobs: Array<{ file: string; group: string; spec: string; truth: Truth; reference?: string; private: boolean; style?: string }> = [];
  const specs = new Map(loadSpecs().map((s) => [s.id, s]));
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, "manifest.json"), "utf8"));
  for (const doc of manifest.documents) {
    const spec = specs.get(doc.spec)!;
    const primary = spec.variants.find((v) => v.startsWith("pdf-"));
    jobs.push({
      file: path.join(FIXTURE_DIR, doc.file), group: GROUP[doc.variant], spec: doc.spec, truth: truthFromSpec(spec), private: false, style: (spec as { style?: string }).style ?? "classic",
      reference: ["scan-good", "scan-poor", "png", "jpg"].includes(doc.variant) && primary ? path.join(FIXTURE_DIR, `${doc.spec}--${primary}.pdf`) : undefined,
    });
  }
  // Real CVs never go to an external provider unless explicitly allowed.
  const aiOnRealCvs = AI_CONFIGS.some((c) => c !== "deterministic") && process.env.CV_EVAL_ALLOW_REAL_CVS_WITH_AI !== "yes";
  if (aiOnRealCvs) console.error("Real CVs are excluded from AI configurations (set CV_EVAL_ALLOW_REAL_CVS_WITH_AI=yes only with the owners' consent).");
  for (const [file, truth] of EVAL_SET !== "dev" || aiOnRealCvs ? [] : loadPrivateTruth()) {
    const full = path.join(process.cwd(), "private-fixtures", file);
    if (fs.existsSync(full)) jobs.push({ file: full, group: "real-cv", spec: truth.id, truth, private: true });
  }

  const rows: Row[] = [];
  for (const j of jobs) {
    if (only && !j.file.includes(only)) continue;
    let row: Row;
    try {
      const r = await extract(j.file);
      const pred = r.review ? toPrediction(r.review as never) : emptyPrediction();
      const score = scoreDocument(j.truth, pred, r.text);
      row = { file: path.basename(j.file), group: j.group, spec: j.spec, supported: r.supported, ocrUsed: r.ocrUsed, latencyMs: r.latencyMs, score, would: r.would, ai: (r.review?.extractionMeta as { ai?: Row["ai"] } | undefined)?.ai };
      if (j.reference && r.ocrText) row.wordRecall = wordRecall((await readDocumentText(fs.readFileSync(j.reference), "pdf")).text, r.ocrText);
      if (verbose) console.log(`\n### ${path.basename(j.file)}\n${row.score.diffs.map((x) => `   ${x}`).join("\n")}`);
    } catch (err) {
      row = { file: path.basename(j.file), group: j.group, spec: j.spec, supported: true, ocrUsed: false, latencyMs: 0, score: scoreDocument(j.truth, emptyPrediction(), ""), failed: err instanceof Error ? err.message : String(err) };
    }
    row.style = j.style;
    rows.push(row);
    (row as Row & { private?: boolean }).private = j.private;
  }
  if (capture) { capture.push(...rows); return; }
  if (!AI_CONFIGS.length) { report(rows); stageExposure(rows); return; }
  if (!benchRows) report(rows);
}

let benchRows: Record<string, Row[]> | null = null;

/** How many documents would trigger each AI stage with consent (no call is made). */
function stageExposure(rows: Row[]) {
  const n = rows.filter((r) => r.would).length;
  const structure = rows.filter((r) => r.would?.structure);
  const recovery = rows.filter((r) => (r.would?.recoveryGaps ?? 0) > 0);
  const f1 = (sel: Row[]) => (sel.length ? summarise(sel).field.f1 : null);
  console.log(`\nAI stage exposure with consent (no calls made): whole-CV structuring on ${structure.length}/${n} documents (their deterministic field F1 ${pct(f1(structure))}), targeted recovery on ${recovery.length}/${n} (F1 ${pct(f1(recovery))}); the rest need no AI call.`);
  const reasons: Record<string, number> = {};
  for (const r of structure) reasons[r.would!.structure!] = (reasons[r.would!.structure!] || 0) + 1;
  if (structure.length) console.log(`  structuring reasons: ${Object.entries(reasons).map(([k, v]) => `${k} ${v}`).join(", ")}`);
}

function summarise(rows: Row[]) {
  const fields: Record<string, Counts> = {};
  const records: Record<string, Counts> = {};
  const all: Counts = { tp: 0, fp: 0, fn: 0 };
  const extended: Record<string, Counts> = {};
  const extAll: Counts = { tp: 0, fp: 0, fn: 0 };
  const rec: Counts = { tp: 0, fp: 0, fn: 0 };
  let dates = 0, datesTotal = 0, assoc = 0, assocTotal = 0, claimed = 0, ungrounded = 0, dups = 0, predRecords = 0, flagsExp = 0, flagsRaised = 0, leaks = 0;
  for (const r of rows) {
    for (const [k, c] of Object.entries(r.score.fields)) { fields[k] ??= { tp: 0, fp: 0, fn: 0 }; add(fields[k], c); add(all, c); }
    for (const [k, c] of Object.entries(r.score.extended ?? {})) { extended[k] ??= { tp: 0, fp: 0, fn: 0 }; add(extended[k], c); add(extAll, c); }
    for (const [k, c] of Object.entries(r.score.records)) { records[k] ??= { tp: 0, fp: 0, fn: 0 }; add(records[k], c); add(rec, c); dups += c.duplicates; predRecords += c.tp + c.fp; }
    dates += r.score.dates.correct; datesTotal += r.score.dates.total;
    assoc += r.score.association.correct; assocTotal += r.score.association.total;
    claimed += r.score.unsupported.claimed; ungrounded += r.score.unsupported.ungrounded;
    flagsExp += r.score.flags.expected; flagsRaised += r.score.flags.raised; leaks += r.score.forbiddenLeaks.length;
  }
  const failures = rows.filter((r) => r.failed || !r.supported).length;
  const recall = rows.filter((r) => r.wordRecall !== undefined);
  return {
    documents: rows.length,
    extractionFailures: failures,
    field: prf(all), fieldCounts: all,
    extendedField: extAll.tp + extAll.fp + extAll.fn ? prf(extAll) : null, extendedCounts: extAll,
    record: prf(rec), recordCounts: rec,
    dateAccuracy: datesTotal ? dates / datesTotal : null,
    associationAccuracy: assocTotal ? assoc / assocTotal : null,
    duplicateRate: predRecords ? dups / predRecords : 0,
    unsupportedClaimRate: claimed ? ungrounded / claimed : 0,
    reviewFlagRecall: flagsExp ? flagsRaised / flagsExp : null,
    referenceContactLeaks: leaks,
    calibration: rows.reduce((acc, r) => {
      for (const [k, v] of Object.entries(r.score.calibration ?? {})) { acc[k] ??= { correct: 0, total: 0 }; acc[k].correct += v.correct; acc[k].total += v.total; }
      return acc;
    }, {} as Record<string, { correct: number; total: number }>),
    ocrWordRecall: recall.length ? recall.reduce((s, r) => s + (r.wordRecall || 0), 0) / recall.length : null,
    meanLatencyMs: Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / Math.max(1, rows.length)),
    byField: Object.fromEntries(Object.entries(fields).sort().map(([k, c]) => [k, { ...prf(c), ...c }])),
    byExtendedField: Object.fromEntries(Object.entries(extended).sort().map(([k, c]) => [k, { ...prf(c), ...c }])),
    byRecord: Object.fromEntries(Object.entries(records).sort().map(([k, c]) => [k, { ...prf(c), ...c }])),
  };
}

const pct = (x: number | null) => (x === null ? "  n/a" : `${(x * 100).toFixed(1).padStart(5)}`);

function report(rows: Row[]) {
  const groups = [...new Set(rows.map((r) => r.group))];
  console.log("\nper document  (field F1 | record F1 | dates | unsupported | latency)");
  for (const r of rows) {
    const s = summarise([r]);
    console.log(`  ${r.file.padEnd(44)} ${pct(s.field.f1)} | ${pct(s.record.f1)} | ${pct(s.dateAccuracy)} | ${pct(s.unsupportedClaimRate)} | ${String(r.latencyMs).padStart(5)}ms${r.failed ? `  FAILED: ${r.failed}` : ""}${r.supported ? "" : "  UNSUPPORTED FORMAT"}${r.score.unsupported.examples.length && verbose ? `  ungrounded: ${r.score.unsupported.examples.join(" / ")}` : ""}`);
  }
  console.log("\nby document type   docs  fieldP fieldR fieldF1 recF1  dates assoc unsupp  dupl flags ocrWR  extF1");
  const out: Record<string, unknown> = {};
  const styles = [...new Set(rows.map((r) => r.style).filter(Boolean))].map((s) => `template:${s}`);
  for (const g of [...groups, ...(styles.length > 1 ? styles : []), "ALL-SYNTHETIC", "ALL"]) {
    const sel = g === "ALL" ? rows : g === "ALL-SYNTHETIC" ? rows.filter((r) => r.group !== "real-cv") : g.startsWith("template:") ? rows.filter((r) => `template:${r.style}` === g) : rows.filter((r) => r.group === g);
    if (!sel.length) continue;
    const s = summarise(sel);
    out[g] = s;
    console.log(`  ${g.padEnd(22)} ${String(s.documents).padStart(3)}  ${pct(s.field.precision)}  ${pct(s.field.recall)}  ${pct(s.field.f1)}  ${pct(s.record.f1)} ${pct(s.dateAccuracy)} ${pct(s.associationAccuracy)} ${pct(s.unsupportedClaimRate)} ${pct(s.duplicateRate)} ${pct(s.reviewFlagRecall)} ${pct(s.ocrWordRecall)}  ${pct(s.extendedField?.f1 ?? null)}${s.extractionFailures ? `  failures=${s.extractionFailures}` : ""}`);
  }
  const all = out["ALL"] as ReturnType<typeof summarise> | undefined;
  if (all) {
    console.log("\nreview-status calibration (education, experience, certification records; all documents)");
    for (const [k, v] of Object.entries(all.calibration)) console.log(`  ${k.padEnd(18)} ${v.correct}/${v.total} fully correct (${pct(v.total ? v.correct / v.total : null)}%)`);
  }
  const syn = out["ALL-SYNTHETIC"] as ReturnType<typeof summarise> | undefined;
  if (syn) {
    console.log("\nsynthetic set by field  (P / R / F1, tp fp fn)");
    for (const [k, v] of Object.entries(syn.byField)) console.log(`  ${k.padEnd(28)} ${pct(v.precision)} ${pct(v.recall)} ${pct(v.f1)}   ${v.tp} ${v.fp} ${v.fn}`);
    console.log("\nsynthetic set, extended fields (not in the core F1)");
    for (const [k, v] of Object.entries(syn.byExtendedField)) console.log(`  ${k.padEnd(28)} ${pct(v.precision)} ${pct(v.recall)} ${pct(v.f1)}   ${v.tp} ${v.fp} ${v.fn}`);
    console.log("\nsynthetic set by record type");
    for (const [k, v] of Object.entries(syn.byRecord)) console.log(`  ${k.padEnd(28)} ${pct(v.precision)} ${pct(v.recall)} ${pct(v.f1)}   ${v.tp} ${v.fp} ${v.fn}`);
  }
  const publicRows = rows.filter((r) => !(r as Row & { private?: boolean }).private);
  const dir = path.join(process.cwd(), "eval/cv/results");
  fs.mkdirSync(dir, { recursive: true });
  const publicSummary = Object.fromEntries(Object.entries(out).filter(([g]) => g !== "real-cv" && g !== "ALL"));
  fs.writeFileSync(path.join(dir, `${label}.json`), JSON.stringify({ label, generatedAt: new Date().toISOString(), summary: publicSummary, documents: publicRows.map((r) => ({ file: r.file, group: r.group, supported: r.supported, failed: r.failed ?? null, latencyMs: r.latencyMs, wordRecall: r.wordRecall ?? null, field: prf(Object.values(r.score.fields).reduce((a, c) => (add(a, c), a), { tp: 0, fp: 0, fn: 0 })), dates: r.score.dates, unsupported: r.score.unsupported, flags: r.score.flags })) }, null, 2) + "\n");
  const privRows = rows.filter((r) => (r as Row & { private?: boolean }).private);
  if (privRows.length) {
    const pdir = path.join(process.cwd(), "private-fixtures/results");
    fs.mkdirSync(pdir, { recursive: true });
    fs.writeFileSync(path.join(pdir, `${label}.json`), JSON.stringify({ label, summary: out["real-cv"], documents: privRows }, null, 2) + "\n");
  }
  console.log(`\nwrote eval/cv/results/${label}.json${privRows.length ? ` and private-fixtures/results/${label}.json` : ""}`);
}

async function bench() {
  if (!AI_CONFIGS.length) return main();
  benchRows = {};
  for (const name of AI_CONFIGS) {
    const cfg = CONFIG_STAGES[name];
    if (!cfg) { console.error(`unknown configuration ${name}; use ${Object.keys(CONFIG_STAGES).join(", ")}`); process.exit(2); }
    CURRENT = cfg;
    CURRENT_NAME = name;
    const captured: Row[] = [];
    const origLog = console.log, origInfo = console.info, origWarn = console.warn;
    console.log = console.info = console.warn = () => undefined;
    try { await main(captured); } finally { console.log = origLog; console.info = origInfo; console.warn = origWarn; }
    benchRows[name] = captured;
  }
  benchReport(benchRows);
  if (liveGuardStats) console.log(`\nprovider requests sent: ${JSON.stringify(liveGuardStats.allowed)}; refused at the ceiling of ${liveGuardStats.ceiling}: ${liveGuardStats.refusedOverCeiling}; blocked non-provider hosts: ${JSON.stringify(liveGuardStats.blockedHosts)}`);
}

/** Measured values only: anything the providers did not report stays "unknown". */
function benchReport(all: Record<string, Row[]>) {
  const names = Object.keys(all);
  const base = all[names[0]];
  const known = (xs: Array<number | undefined>) => (xs.length && xs.every((x) => typeof x === "number") ? (xs as number[]) : null);
  const mean = (xs: number[] | null) => (xs ? (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(0) : "unknown");
  console.log("\nconfig              docs  coreP  coreR coreF1  extF1  calls s/r/v  failed fallback  AI latency/CV  in tokens/CV out tokens/CV  cost/CV");
  for (const name of names) {
    const rows = all[name];
    const s = summarise(rows);
    const calls = rows.flatMap((r) => r.ai?.calls ?? []).filter((c) => c.outcome !== "skipped");
    const n = (st: string) => calls.filter((c) => c.stage === st).length;
    const perCv = (k: "latencyMs" | "inputTokens" | "outputTokens") => rows.map((r) => (r.ai?.calls ?? []).filter((c) => c.outcome !== "skipped").reduce<number | undefined>((sum, c) => (sum === undefined || c[k] === undefined ? undefined : sum + (c[k] as number)), 0));
    const costs = rows.map((r) => (r.ai?.calls?.length ? r.ai.costUsd ?? undefined : 0));
    const failed = calls.filter((c) => c.outcome === "failed").length;
    const fallback = calls.filter((c) => c.fallback).length;
    const cost = known(costs as Array<number | undefined>);
    console.log(`${name.padEnd(19)} ${String(s.documents).padStart(4)}  ${pct(s.field.precision)}  ${pct(s.field.recall)}  ${pct(s.field.f1)}  ${pct(s.extendedField?.f1 ?? null)}  ${String(n("structure")).padStart(3)}/${String(n("recovery")).padStart(2)}/${String(n("verify")).padStart(2)}   ${String(failed).padStart(5)} ${String(fallback).padStart(8)}  ${String(mean(known(perCv("latencyMs")))).padStart(10)} ms  ${String(mean(known(perCv("inputTokens")))).padStart(12)} ${String(mean(known(perCv("outputTokens")))).padStart(13)}  ${cost ? `$${(cost.reduce((a, b) => a + b, 0) / cost.length).toFixed(5)}` : "unknown"}`);
  }
  const groupsOf = (r: Row) => [r.group === "real-cv" ? "real" : "synthetic", r.group, ...(r.ocrUsed ? ["ocr"] : ["text-layer"])];
  const groups = [...new Set(base.flatMap(groupsOf))];
  console.log("\ncore field F1 by document group (" + names.join(" | ") + ")");
  for (const g of groups) console.log(`  ${g.padEnd(22)} ${names.map((n) => pct(summarise(all[n].filter((r) => groupsOf(r).includes(g))).field.f1)).join(" | ")}`);
  const baseFields = summarise(base).byField;
  for (const name of names.slice(1)) {
    const fields = summarise(all[name]).byField;
    const changes = Object.keys({ ...baseFields, ...fields }).map((k) => {
      const a = baseFields[k] ?? { tp: 0, fp: 0, fn: 0, f1: 1 }, b = fields[k] ?? { tp: 0, fp: 0, fn: 0, f1: 1 };
      return { k, dF1: b.f1 - a.f1, addedFalse: b.fp - a.fp, addedMissing: b.fn - a.fn };
    }).filter((c) => c.dF1 !== 0 || c.addedFalse || c.addedMissing).sort((x, y) => x.dF1 - y.dF1);
    console.log(`\n${name} vs ${names[0]}: per-field changes (regressions first; false additions = extra fp, false omissions = extra fn)`);
    if (!changes.length) console.log("  no field changed");
    for (const c of changes) console.log(`  ${c.k.padEnd(28)} F1 ${c.dF1 >= 0 ? "+" : ""}${(c.dF1 * 100).toFixed(1)}  false additions ${c.addedFalse >= 0 ? "+" : ""}${c.addedFalse}  false omissions ${c.addedMissing >= 0 ? "+" : ""}${c.addedMissing}`);
    const docs = all[name].map((r, i) => ({ file: r.file, d: summarise([r]).field.f1 - summarise([base[i]]).field.f1 })).filter((x) => Math.abs(x.d) > 1e-9);
    if (docs.length) console.log(`  documents changed: ${docs.map((x) => `${x.file} ${x.d >= 0 ? "+" : ""}${(x.d * 100).toFixed(1)}`).join(", ")}`);
  }
}

bench().catch((e) => { console.error(e); process.exit(1); });
