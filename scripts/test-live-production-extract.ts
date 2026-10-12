/**
 * Upload real PDFs to the live extraction API.
 * Usage: node --import tsx scripts/test-live-production-extract.ts
 *   --text-native /path/native.pdf --vector-outline /path/outline.pdf
 *   --additional /path/image.pdf  (repeat for more image PDFs)
 * Environment alternatives: TEXT_NATIVE_PDF, VECTOR_OUTLINE_PDF,
 * RESUME_EXTRACT_BASE_URL. The output omits extracted personal data.
 */
import fs from "node:fs";
import path from "node:path";

type Kind = "text-native" | "vector-outline" | "additional-ocr";
type Case = { kind: Kind; filePath: string };
type Candidate = { category?: unknown; value?: unknown; sourceSpan?: unknown };
type Result = { label: string; passed: boolean; detail: string; durationMs?: number };
const CATEGORIES = ["education", "experience", "project", "skill", "certification", "achievement"] as const;

function parseArgs(args: string[]) {
  const options = {
    baseUrl: process.env.RESUME_EXTRACT_BASE_URL || "https://www.aitathastu.com",
    textNative: process.env.TEXT_NATIVE_PDF || path.resolve("scripts/fixtures/test_student_cv.pdf"),
    vectorOutline: process.env.VECTOR_OUTLINE_PDF || "/Users/quantumanant/Downloads/myresume.pdf",
    additional: [] as string[],
  };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!["--base-url", "--text-native", "--vector-outline", "--additional"].includes(flag)) {
      throw new Error(`Unknown option: ${flag}`);
    }
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--base-url") options.baseUrl = value;
    if (flag === "--text-native") options.textNative = value;
    if (flag === "--vector-outline") options.vectorOutline = value;
    if (flag === "--additional") options.additional.push(value);
  }
  return options;
}

function validateResponse(body: unknown, kind: Kind): string[] {
  if (!body || typeof body !== "object") return ["response is not a JSON object"];
  const data = body as Record<string, unknown>;
  if (data.ok !== true) return [`API error ${String(data.code || "unknown")}: ${String(data.message || data.error || "no message")}`];
  const problems: string[] = [];
  if (data.status !== "completed") problems.push("job status is not completed");
  if (typeof data.documentId !== "string" || !/^[a-f0-9]{64}$/i.test(data.documentId)) problems.push("missing document ID");
  if (typeof data.jobId !== "string" || !data.jobId.trim()) problems.push("missing job ID");
  const meta = data.extractionMeta as Record<string, unknown> | undefined;
  if (meta?.success !== true) problems.push("extractionMeta.success is not true");
  if (meta?.ocrFailed === true) problems.push("OCR reported failure");
  if (kind === "text-native" && meta?.ocrUsed !== false) problems.push("text-native PDF unexpectedly used OCR");
  if (kind !== "text-native" && meta?.ocrUsed !== true) problems.push("outline/image PDF did not report OCR use");

  const candidates = Array.isArray(data.reviewCandidates) ? data.reviewCandidates as Candidate[] : [];
  const minimumCandidates = kind === "vector-outline" ? 5 : kind === "text-native" ? 2 : 1;
  if (candidates.length < minimumCandidates) problems.push(`fewer than ${minimumCandidates} review candidates`);
  const categories = new Set<string>();
  for (const [index, candidate] of candidates.entries()) {
    if (!CATEGORIES.includes(candidate.category as typeof CATEGORIES[number])) problems.push(`candidate ${index + 1} has an unknown category`);
    const value = typeof candidate.value === "string" ? candidate.value.trim() : "";
    if (value.length < 2 && !(candidate.category === "skill" && /^[CR]$/.test(value))) {
      problems.push(`candidate ${index + 1} (${String(candidate.category)}) has no meaningful value`);
    }
    if (typeof candidate.sourceSpan !== "string" || candidate.sourceSpan.trim().length < 3) problems.push(`candidate ${index + 1} (${String(candidate.category)}) has no source span`);
    if (typeof candidate.category === "string") categories.add(candidate.category);
  }
  if (categories.size < (kind === "additional-ocr" ? 1 : 2)) problems.push("too few extracted claim categories");
  const structured = data.structured as Record<string, unknown> | undefined;
  if (!structured || typeof structured !== "object") problems.push("missing structured extraction");
  else for (const category of categories) {
    const field = category === "education" || category === "experience" ? category : `${category}s`;
    if (!Array.isArray(structured[field]) || (structured[field] as unknown[]).length === 0) {
      problems.push(`structured ${category} is empty despite review candidates`);
    }
  }
  if (kind === "text-native" && (!categories.has("education") || !categories.has("skill"))) {
    problems.push("text-native PDF is missing education or skill claims");
  }
  if (kind === "vector-outline" && (!categories.has("project") || !categories.has("skill"))) {
    problems.push("vector-outline PDF is missing project or skill claims");
  }
  return [...new Set(problems)];
}

async function testUpload(testCase: Case, baseUrl: string): Promise<Result> {
  const label = `${testCase.kind}: ${path.basename(testCase.filePath)}`;
  const filePath = path.resolve(testCase.filePath);
  if (!fs.existsSync(filePath)) return { label, passed: false, detail: `input missing: ${filePath}` };
  if (path.extname(filePath).toLowerCase() !== ".pdf") return { label, passed: false, detail: "input must be a PDF" };
  try {
    const formData = new FormData();
    formData.append("consent", "true");
    formData.append("aiConsent", "true");
    formData.append("resume", new Blob([fs.readFileSync(filePath)], { type: "application/pdf" }), path.basename(filePath));
    const start = Date.now();
    const response = await fetch(`${baseUrl}/api/resume/extract`, {
      method: "POST", body: formData, signal: AbortSignal.timeout(90_000),
    });
    const durationMs = Date.now() - start;
    const body: unknown = await response.json().catch(() => null);
    const issues = validateResponse(body, testCase.kind);
    if (!response.ok) issues.unshift(`HTTP ${response.status}`);
    const candidates = body && typeof body === "object" && "reviewCandidates" in body && Array.isArray(body.reviewCandidates)
      ? body.reviewCandidates as Candidate[] : [];
    const counts = CATEGORIES.map(category => `${category}:${candidates.filter(candidate => candidate.category === category).length}`)
      .filter(item => !item.endsWith(":0"));
    return {
      label, passed: issues.length === 0, durationMs,
      detail: issues.length ? [...new Set(issues)].join("; ") :
        `${candidates.length} claims (${counts.join(", ")}); OCR ${testCase.kind === "text-native" ? "off" : "on"}`,
    };
  } catch (error) {
    return { label, passed: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const cases: Case[] = [
    { kind: "text-native", filePath: options.textNative },
    { kind: "vector-outline", filePath: options.vectorOutline },
    ...options.additional.map(filePath => ({ kind: "additional-ocr" as const, filePath })),
  ];
  console.log(`Live extraction target: ${baseUrl} | ${cases.length} PDF(s)`);
  const results: Result[] = [];
  for (const testCase of cases) {
    const result = await testUpload(testCase, baseUrl);
    results.push(result);
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.label}${result.durationMs === undefined ? "" : ` (${result.durationMs}ms)`}: ${result.detail}`);
  }
  const passed = results.filter(result => result.passed).length;
  console.log(`LIVE EXTRACTION: ${passed}/${results.length} passed, ${results.length - passed} failed`);
  if (passed !== results.length) process.exitCode = 1;
}

run().catch(error => { console.error("LIVE EXTRACTION: setup failed:", error); process.exitCode = 1; });
