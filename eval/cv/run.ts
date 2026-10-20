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

process.env.CORE_DISABLE_LIVE_LLM = "true";

import fs from "node:fs";
import path from "node:path";
import { readDocumentText } from "@/lib/resume/document-text";
import { buildResumeReview, textFromExtractorPayload } from "@/lib/services/resume-ingestion-service";
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
  "docx-plain": "docx", "docx-table": "docx-tables", "scan-good": "scanned-pdf", "scan-poor": "scanned-pdf-degraded", png: "image", jpg: "image",
};

const accepted = (ext: string) =>
  ((uploadLimits as Record<string, unknown>).RESUME_ACCEPTED_EXTENSIONS as string[] | undefined ?? ["pdf", "docx"]).includes(ext);

async function extract(file: string) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const started = Date.now();
  if (!accepted(ext)) return { supported: false, text: "", ocrUsed: false, latencyMs: 0, review: null, ocrText: "" };
  let input;
  let ocrText = "";
  if (ext === "pdf" || ext === "docx") {
    const parsed = await readDocumentText(fs.readFileSync(file), ext);
    if (parsed.text.replace(/\s/g, "").length >= 40) {
      input = { text: parsed.text, hyperlinks: parsed.hyperlinks, fileFormat: ext, pageCount: parsed.pageCount, ocrUsed: false, via: ext === "docx" ? "docx" : "native-pdf", lines: parsed.lines };
    }
  }
  if (!input) {
    const raw = ocrPayload(file);
    ocrText = raw.raw_text;
    const { text, hyperlinks, pageCount, lines, pageQuality } = textFromExtractorPayload(raw as never);
    input = { text, hyperlinks, fileFormat: ext, pageCount, ocrUsed: true, via: "extractor-ocr", renderProfile: raw.profile as never, lines, pageQuality };
  }
  const built = await buildResumeReview(input as never, { documentId: "eval-doc", personId: "eval-person", aiConsent: false });
  return { supported: true, text: input.text, ocrUsed: input.ocrUsed, latencyMs: Date.now() - started, review: built.review, ocrText };
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

type Row = { file: string; group: string; spec: string; supported: boolean; ocrUsed: boolean; latencyMs: number; score: DocScore; wordRecall?: number; failed?: string };

async function main() {
  const jobs: Array<{ file: string; group: string; spec: string; truth: Truth; reference?: string; private: boolean }> = [];
  const specs = new Map(loadSpecs().map((s) => [s.id, s]));
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, "manifest.json"), "utf8"));
  for (const doc of manifest.documents) {
    const spec = specs.get(doc.spec)!;
    const primary = spec.variants.find((v) => v.startsWith("pdf-"));
    jobs.push({
      file: path.join(FIXTURE_DIR, doc.file), group: GROUP[doc.variant], spec: doc.spec, truth: truthFromSpec(spec), private: false,
      reference: ["scan-good", "scan-poor", "png", "jpg"].includes(doc.variant) && primary ? path.join(FIXTURE_DIR, `${doc.spec}--${primary}.pdf`) : undefined,
    });
  }
  for (const [file, truth] of EVAL_SET === "holdout" ? [] : loadPrivateTruth()) {
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
      row = { file: path.basename(j.file), group: j.group, spec: j.spec, supported: r.supported, ocrUsed: r.ocrUsed, latencyMs: r.latencyMs, score };
      if (j.reference && r.ocrText) row.wordRecall = wordRecall((await readDocumentText(fs.readFileSync(j.reference), "pdf")).text, r.ocrText);
      if (verbose) console.log(`\n### ${path.basename(j.file)}\n${row.score.diffs.map((x) => `   ${x}`).join("\n")}`);
    } catch (err) {
      row = { file: path.basename(j.file), group: j.group, spec: j.spec, supported: true, ocrUsed: false, latencyMs: 0, score: scoreDocument(j.truth, emptyPrediction(), ""), failed: err instanceof Error ? err.message : String(err) };
    }
    rows.push(row);
    (row as Row & { private?: boolean }).private = j.private;
  }
  report(rows);
}

function summarise(rows: Row[]) {
  const fields: Record<string, Counts> = {};
  const records: Record<string, Counts> = {};
  const all: Counts = { tp: 0, fp: 0, fn: 0 };
  const rec: Counts = { tp: 0, fp: 0, fn: 0 };
  let dates = 0, datesTotal = 0, assoc = 0, assocTotal = 0, claimed = 0, ungrounded = 0, dups = 0, predRecords = 0, flagsExp = 0, flagsRaised = 0, leaks = 0;
  for (const r of rows) {
    for (const [k, c] of Object.entries(r.score.fields)) { fields[k] ??= { tp: 0, fp: 0, fn: 0 }; add(fields[k], c); add(all, c); }
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
  console.log("\nby document type   docs  fieldP fieldR fieldF1 recF1  dates assoc unsupp  dupl flags ocrWR");
  const out: Record<string, unknown> = {};
  for (const g of [...groups, "ALL-SYNTHETIC", "ALL"]) {
    const sel = g === "ALL" ? rows : g === "ALL-SYNTHETIC" ? rows.filter((r) => r.group !== "real-cv") : rows.filter((r) => r.group === g);
    if (!sel.length) continue;
    const s = summarise(sel);
    out[g] = s;
    console.log(`  ${g.padEnd(22)} ${String(s.documents).padStart(3)}  ${pct(s.field.precision)}  ${pct(s.field.recall)}  ${pct(s.field.f1)}  ${pct(s.record.f1)} ${pct(s.dateAccuracy)} ${pct(s.associationAccuracy)} ${pct(s.unsupportedClaimRate)} ${pct(s.duplicateRate)} ${pct(s.reviewFlagRecall)} ${pct(s.ocrWordRecall)}${s.extractionFailures ? `  failures=${s.extractionFailures}` : ""}`);
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

main().catch((e) => { console.error(e); process.exit(1); });
