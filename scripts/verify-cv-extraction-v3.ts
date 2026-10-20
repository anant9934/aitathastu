/**
 * CV extraction v3 (cv-extract/3.0) regression suite.
 *
 * Unit tests run the deterministic engine on the rendered fixtures in
 * eval/cv/fixtures (ground truth: eval/cv/specs). Integration tests use an
 * in-memory database (PGlite) for upload -> processing -> persisted records ->
 * decisions. LLM behaviour is tested with fake providers: no network, no paid
 * API. OCR tests run the Python extractor locally when its venv and Tesseract
 * are present and are skipped (with the reason) otherwise.
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-cv-extraction-v3.ts
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";
import { readDocumentText } from "../lib/resume/document-text";
import { extractResumeDeterministic } from "../lib/resume/deterministic-extractor";
import { extractCv } from "../lib/resume/extract/engine";
import { parseDatePoint, findDateRanges } from "../lib/resume/extract/dates";

process.env.CORE_DISABLE_LIVE_LLM = "true";
delete process.env.RESUME_EXTRACTOR_URL;

const FIX = path.join(process.cwd(), "eval/cv/fixtures");
const read = (f: string) => fs.readFileSync(path.join(FIX, f));
const NOW = new Date("2026-10-21T00:00:00Z");


async function extract(file: string) {
  const ext = file.endsWith(".docx") ? "docx" : "pdf";
  const doc = await readDocumentText(read(file), ext);
  const r = extractResumeDeterministic(doc.text, doc.hyperlinks, { lines: doc.lines, method: ext === "docx" ? "docx" : "native_pdf", now: NOW });
  return { doc, ...r, x: r.interpretation };
}

const PY = path.join(process.cwd(), "services/resume-extractor/.venv/bin/python");
function ocrAvailable(): string | null {
  if (!fs.existsSync(PY)) return "Python extractor venv not installed";
  try {
    execFileSync(path.join(process.cwd(), "services/resume-extractor/.venv/bin/tesseract"), ["--version"], { env: { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}` }, stdio: "ignore" });
    return null;
  } catch {
    return "Tesseract is not available locally";
  }
}

// ---------------------------------------------------------------- 1-12, 19, 24: extraction

test("01 text PDF: personal details, education with month dates, grades, projects, certifications", async () => {
  const { x, profile } = await extract("aarav-fresher--pdf-single.pdf");
  assert.equal(profile.fullName, "Aarav Mehta");
  assert.equal(profile.email, "aarav.mehta.dev@example.com");
  const vit = x.education.find((e) => /Vishwakarma/.test(e.institution))!;
  assert.deepEqual([vit.degree, vit.fieldOfStudy, vit.gpa, vit.dates?.start?.value, vit.dates?.end?.value, vit.current], ["B.Tech", "Computer Engineering", "8.62/10", "2021-08", "2025-06", true]);
  assert.equal(x.education.length, 3, "Class XII and Class X at the same school stay separate");
  assert.deepEqual(x.projects.map((p) => p.title), ["CampusCart", "LeafLens", "Expense Splitter CLI"]);
  assert.equal(x.projects[1].repositoryUrl, "https://github.com/aaravmehta-dev/leaflens");
  assert.deepEqual(x.certifications.map((c) => [c.name, c.issuer, c.dates?.issued?.value]), [
    ["AWS Certified Cloud Practitioner", "Amazon Web Services", "2024-03"],
    ["Deep Learning Specialization", "DeepLearning.AI", "2023-11"],
    ["Data Structures and Algorithms", "NPTEL", "2023-04"],
  ]);
  assert.equal(x.experience.length, 0, "a fresher with projects has no invented employment");
});

test("03 DOCX: paragraphs, data tables, layout tables and a contact line kept only in the page header", async () => {
  const rohan = (await extract("rohan-tables--docx-table.docx")).x;
  assert.deepEqual(rohan.education.map((e) => [e.degree, e.institution, e.graduationYear]), [
    ["M.Sc.", "Presidency University", "2016"], ["B.Sc. (Hons)", "St. Xavier's College, Kolkata", "2014"], ["Class XII", "South Point School", "2011"],
  ]);
  const vikram = await extract("vikram-minimal--docx-plain.docx");
  assert.equal(vikram.profile.email, "vikram.rao.sales@example.com", "header-only contact details are read");
  const fatima = (await extract("fatima-volunteer--docx-table.docx")).x;
  assert.ok(fatima.experience.some((e) => e.company === "Pratham Education Foundation"));
  assert.equal(fatima.volunteering?.length, 2);
});

test("04 two-column sidebar: name found after the sidebar, sections not interleaved", async () => {
  const { x, profile } = await extract("priya-sidebar--pdf-sidebar.pdf");
  assert.equal(profile.fullName, "Priya Raghavan");
  assert.deepEqual(x.experience.map((e) => [e.company, e.role]), [
    ["Northwind Payments Pvt. Ltd.", "Senior Software Engineer"], ["Cobalt Logistics", "Software Engineer II"], ["Infosys", "Systems Engineer"],
  ]);
  assert.deepEqual(x.languages?.map((l) => [l.language, l.proficiency]), [["English", "Fluent"], ["Tamil", "Native"], ["Hindi", "Conversational"]]);
  assert.equal(x.certifications[1].credentialId, "LF-8XK2Q1W9ZA");
});

test("05 multi-page: running header/footer removed, heading at a page bottom continues on the next page", async () => {
  const { doc, x } = await extract("meera-research--pdf-multipage.pdf");
  assert.deepEqual(doc.removed?.filter((r) => /Page/.test(r)), ["Page 1 of 2", "Page 2 of 2"]);
  assert.ok(!/Curriculum Vitae/.test(doc.text));
  assert.deepEqual(x.achievements.map((a) => a.title), ["DBT Junior Research Fellowship", "Best Poster Award, ISMB 2019"]);
  assert.equal(x.research?.length, 6);
  assert.ok(x.skills.some((s) => s.name === "Nextflow" && s.evidence?.page === 2), "skills on page 2 cite page 2");
});

test("06 dates stay with their records; precision is kept; ambiguous dates are flagged", async () => {
  const { x } = await extract("ananya-dates--pdf-single.pdf");
  const hdfc = x.experience.find((e) => e.company === "HDFC Bank")!;
  assert.deepEqual([hdfc.dates?.start?.value, hdfc.dates?.end?.value], ["2018", "2018"]);
  const iim = x.education.find((e) => /IIM/.test(e.institution))!;
  assert.deepEqual([iim.dates?.start?.value, iim.dates?.end?.value], ["2017", "2019"], "2017-19 session");
  const cspo = x.certifications.find((c) => /Scrum/.test(c.name))!;
  assert.equal(cspo.dates?.issued?.value, "2022", "12/03/2022 keeps only the year");
  assert.equal(cspo.dates?.issued?.ambiguous, true);
  assert.equal(cspo.review?.status, "needs_review");
  assert.deepEqual(parseDatePoint("15/03/2022").value, "2022-03", "day > 12 resolves the order");
});

test("07 projects and freelance work stay projects; internships keep their type", async () => {
  const { x } = await extract("kabir-internships--pdf-single.pdf");
  assert.equal(x.experience.length, 4);
  assert.ok(x.experience.every((e) => e.type === "internship"));
  assert.ok(!x.experience.some((e) => /Pharmacy|Freelance/i.test(`${e.company} ${e.role}`)));
  assert.ok(x.projects.some((p) => p.title === "Pharmacy Inventory Dashboard"));
});

test("08 certifications: issuer, month date, credential id; a year inside a name stays in the name", () => {
  const r = extractResumeDeterministic("Asha Rao\nasha@example.com\nCERTIFICATIONS\n- Oracle Cloud Infrastructure 2025 Certified Generative AI Professional | Oracle | Sep 2025\n- CKA — The Linux Foundation, Jun 2021 (Credential ID LF-123456)", [], { now: NOW }).interpretation;
  assert.deepEqual(r.certifications.map((c) => [c.name, c.issuer, c.dates?.issued?.value, c.credentialId]), [
    ["Oracle Cloud Infrastructure 2025 Certified Generative AI Professional", "Oracle", "2025-09", undefined],
    ["CKA", "The Linux Foundation", "2021-06", "LF-123456"],
  ]);
});

test("09 skills come from skill sections with evidence; tools named only in job bullets are not added as skills", async () => {
  const { x } = await extract("priya-sidebar--pdf-sidebar.pdf");
  const names = x.skills.map((s) => s.name);
  assert.ok(names.includes("Kafka") && names.includes("Spring Boot"));
  for (const s of x.skills) assert.ok(s.evidence?.section === "skills" && s.sourceSpan.length > 0);
  const vikram = (await extract("vikram-minimal--pdf-single.pdf")).x;
  assert.ok(!vikram.skills.some((s) => /sales|billing/i.test(s.name)));
  assert.ok(x.experience[0].technologies?.includes("Java"), "technologies in a role are kept on the role");
});

test("10 missing fields stay empty and are marked, never filled with placeholders", async () => {
  const { x } = await extract("vikram-minimal--pdf-single.pdf");
  for (const e of x.experience) {
    assert.equal(e.startDate, undefined);
    assert.equal(e.review?.fields.start, "not_found");
    assert.notEqual(e.role, "Team Member");
  }
  const r = extractResumeDeterministic("Asha Rao\nasha@example.com\nEDUCATION\nClass XII (CBSE), 2019, 91%", [], { now: NOW }).interpretation;
  assert.equal(r.education[0].institution, "", "no 'University / College' placeholder");
  assert.ok(r.education[0].review?.issues.includes("missing_institution"));
  const noTitle = extractResumeDeterministic("Asha Rao\nasha@example.com\nEXPERIENCE\nAcme Labs | Jan 2022 – Mar 2023\n- Built things for customers.", [], { now: NOW }).interpretation;
  assert.equal(noTitle.experience[0].role, "");
  assert.equal(noTitle.experience[0].review?.status, "needs_review");
});

test("11 an end date before its start date is marked invalid", async () => {
  const { x } = await extract("arjun-duplicates--pdf-single.pdf");
  const kappa = x.experience.find((e) => e.company === "Kappa Systems")!;
  assert.equal(kappa.review?.status, "invalid");
  assert.ok(kappa.review?.issues.includes("end_before_start"));
  assert.equal(kappa.review?.fields.end, "invalid");
});

test("12 duplicates: identical repeats merge, a continued section joins, repeated skills appear once", async () => {
  const { x, engine } = await extract("arjun-duplicates--pdf-single.pdf");
  assert.equal(x.certifications.length, 1);
  assert.equal(x.experience.length, 2, "Experience (continued) adds the second role");
  assert.equal(x.skills.filter((s) => s.name === "Python").length, 1);
  assert.ok(engine.warnings.some((w) => /Duplicate certification merged/.test(w)));
  const conflicting = extractResumeDeterministic("Asha Rao\nasha@example.com\nEXPERIENCE\nData Analyst, Swiggy | Jan 2021 – Dec 2021\n- Built dashboards.\nData Analyst, Swiggy | Jan 2022 – Dec 2022\n- Built more dashboards.", [], { now: NOW }).interpretation;
  assert.ok(conflicting.experience.every((e) => e.review?.status === "conflicting"), "same role with different dates is flagged");
});

test("19 Unicode: names with diacritics, curly apostrophes, ligatures and icon glyphs", async () => {
  const { x, profile } = await extract("zoe-unicode--pdf-sidebar.pdf");
  assert.equal(profile.fullName, "Zoë D'Souza");
  assert.equal(profile.email, "zoe.dsouza@example.com", "the envelope icon is not part of the address");
  assert.ok(x.education.some((e) => e.institution === "St. Xavier's College, Mapusa"));
  assert.ok(!JSON.stringify(x).includes("ﬁ"), "ligatures are folded");
});

test("24 review states: field statuses and OCR quality lower confidence", () => {
  const cv = extractCv("Asha Rao\nasha@example.com\nEXPERIENCE\nData Analyst, Swiggy | Jan 2021 – Present\n- Built dashboards.", { method: "ocr", pageQuality: { 1: 0.55 }, now: NOW });
  const r = cv.experience[0];
  assert.ok(r.review.issues.includes("low_ocr_quality"));
  assert.equal(r.review.status, "needs_review");
  assert.ok(r.review.confidence < 0.6);
  const clean = extractCv("Asha Rao\nasha@example.com\nEXPERIENCE\nData Analyst, Swiggy | Jan 2021 – Present\n- Built dashboards.", { method: "native_pdf", now: NOW });
  assert.equal(clean.experience[0].review.status, "high_confidence");
  assert.deepEqual(findDateRanges("Jun 2023 – Jan 2022").map((d) => [d.start?.value, d.end?.value]), [["2023-06", "2022-01"]]);
});

test("phone: the candidate's own number only, never a referee's or an ORCID", async () => {
  const { engine } = await extract("fatima-volunteer--pdf-single.pdf");
  assert.deepEqual(engine.personal.phones.map((p) => p.normalized), ["+919819077881"]);
  assert.deepEqual(engine.personal.emails.map((e) => e.value), ["fatima.sheikh@example.net"]);
  assert.ok(engine.referenceContacts.includes("kavita.rao@example.org"));
  const orcid = extractCv("Deepa K\ndeepa@example.ac.in\norcid.org/0000-0001-5109-3700", { now: NOW });
  assert.equal(orcid.personal.phones.length, 0);
});

// ---------------------------------------------------------------- 2, 14: OCR

test("02 scanned PDF and image: the production OCR path reads them", async (t) => {
  const reason = ocrAvailable();
  if (reason) return t.skip(reason);
  const { ocrPayload } = await import("../eval/cv/pipeline");
  const { textFromExtractorPayload } = await import("../lib/services/resume-ingestion-service");
  for (const file of ["aarav-fresher--scan-good.pdf", "kabir-internships--png.png"]) {
    const raw = ocrPayload(path.join(FIX, file));
    assert.ok(raw.pages[0].quality, "the extractor reports per-page OCR confidence");
    const t2 = textFromExtractorPayload(raw as never);
    const r = extractResumeDeterministic(t2.text, t2.hyperlinks, { lines: t2.lines, method: "ocr", pageQuality: t2.pageQuality, now: NOW });
    assert.ok(r.interpretation.education.length >= 1, `${file}: education`);
    assert.ok(r.interpretation.skills.length >= 5, `${file}: skills`);
  }
});

test("14 unreadable scan: low OCR confidence is reported and records are held for review", async (t) => {
  const reason = ocrAvailable();
  if (reason) return t.skip(reason);
  const { ocrPayload } = await import("../eval/cv/pipeline");
  const { textFromExtractorPayload } = await import("../lib/services/resume-ingestion-service");
  const raw = ocrPayload(path.join(FIX, "priya-sidebar--scan-poor.pdf"));
  assert.ok(raw.warnings.some((w) => /confidence is low/.test(w)));
  const t2 = textFromExtractorPayload(raw as never);
  const r = extractResumeDeterministic(t2.text, t2.hyperlinks, { lines: t2.lines, method: "ocr", pageQuality: t2.pageQuality, now: NOW });
  assert.ok(["poor", "unreadable", "limited"].includes(r.quality.textQuality));
  for (const e of [...r.interpretation.experience, ...r.interpretation.education]) assert.notEqual(e.review?.status, "high_confidence");
});

// ---------------------------------------------------------------- 13, 15: LLM output handling (fake providers)

async function routerWith(outputs: Array<string | Error>) {
  const { IntelligenceRouter } = await import("../lib/intelligence/router");
  const router = new IntelligenceRouter();
  let i = 0;
  (router as unknown as { providers: unknown[] }).providers = [{
    name: "groq", structuredCapability: "json_object", isAvailable: () => true,
    completeStructured: async () => {
      const next = outputs[Math.min(i++, outputs.length - 1)];
      if (next instanceof Error) throw next;
      return { content: next, modelUsed: "fake-model", totalTokens: 10 };
    },
  }];
  return router;
}

const VALID = { name: "Asha Rao", email: null, phone: null, location: null, links: [], education: [], experience: [], projects: [], skills: ["Python"], certifications: [], achievements: [] };

test("13 malformed model output: invalid JSON and unexpected keys are rejected, repair is bounded", async () => {
  await setupTestDatabase();
  const prev = process.env.CORE_DISABLE_LIVE_LLM;
  process.env.CORE_DISABLE_LIVE_LLM = "false";
  const { structureResumeText, ResumeStructuringError } = await import("../lib/resume/structure");
  const { ResumeExtractionSchema } = await import("../lib/resume/schema");
  try {
    assert.equal(ResumeExtractionSchema.safeParse({ ...VALID, salary: "10 LPA" }).success, false, "extra keys are a violation");
    const repaired = await structureResumeText("Asha Rao\nPython", "p1", await routerWith([JSON.stringify({ ...VALID, salary: "x" }), JSON.stringify(VALID)]));
    assert.equal(repaired.attempts[0].outcome, "schema_violation");
    assert.deepEqual(repaired.data.skills, ["Python"]);
    await assert.rejects(
      structureResumeText("Asha Rao", "p1", await routerWith(["not json", "{still not json"])),
      (e: unknown) => e instanceof ResumeStructuringError && e.attempts.filter((a) => a.outcome === "malformed_json").length === 2,
    );
  } finally {
    process.env.CORE_DISABLE_LIVE_LLM = prev;
  }
});

test("13b model values the document does not contain are dropped, and model records are held for review", async () => {
  const { toInterpretation } = await import("../lib/services/resume-extraction-service");
  const source = "Asha Rao\nEXPERIENCE\nSwiggy | 2021 – 2023\n- Built dashboards in Tableau.";
  const out = toInterpretation({
    ...VALID, skills: ["Tableau", "Kubernetes"],
    experience: [
      { company: "Swiggy", role: "Senior Data Scientist", type: "employment", location: null, start_date: "Jan 2019", end_date: "2023", description: ["Built dashboards in Tableau."] },
      { company: "Google", role: "Engineer", type: "employment", location: null, start_date: null, end_date: null, description: [] },
    ],
  }, source);
  assert.equal(out.experience.length, 1, "an organisation not in the document is dropped");
  assert.deepEqual([out.experience[0].role, out.experience[0].startDate, out.experience[0].endDate], ["", undefined, "2023"]);
  assert.equal(out.experience[0].provenance, "llm");
  assert.equal(out.experience[0].review?.status, "needs_review");
  assert.deepEqual(out.skills.map((s) => s.name), ["Tableau"]);
});

test("15 model timeout: the error is classified, and extraction still returns the deterministic result", async () => {
  await setupTestDatabase();
  const prev = process.env.CORE_DISABLE_LIVE_LLM;
  process.env.CORE_DISABLE_LIVE_LLM = "false";
  const { structureResumeText, ResumeStructuringError } = await import("../lib/resume/structure");
  try {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    await assert.rejects(
      structureResumeText("Asha Rao", "p1", await routerWith([timeout])),
      (e: unknown) => e instanceof ResumeStructuringError && e.kind === "provider" && e.attempts[0].outcome === "timeout",
    );
  } finally {
    process.env.CORE_DISABLE_LIVE_LLM = prev;
  }
  const { buildResumeReview } = await import("../lib/services/resume-ingestion-service");
  const doc = await readDocumentText(read("vikram-minimal--pdf-single.pdf"), "pdf");
  const built = await buildResumeReview({ text: doc.text, hyperlinks: doc.hyperlinks, fileFormat: "pdf", pageCount: 1, ocrUsed: false, via: "native-pdf", lines: doc.lines }, { documentId: "d", personId: "p", aiConsent: true });
  assert.equal(built.review.extractionMeta.llmUsed, false);
  assert.ok(built.reviewCandidates.length > 0, "the student still gets the deterministic suggestions");
});

// ---------------------------------------------------------------- 16-18: upload validation

test("16-18 upload validation: unsupported, oversized, too many pages, corrupted and encrypted files", async () => {
  const { validateDocumentSafety, imageDimensions, pdfPageCount } = await import("../lib/resume/document-safety");
  const { RESUME_ACCEPTED_EXTENSIONS, RESUME_MAX_PAGES } = await import("../lib/config/upload-limits");
  assert.ok(!(RESUME_ACCEPTED_EXTENSIONS as readonly string[]).includes("doc"));
  assert.ok(!(RESUME_ACCEPTED_EXTENSIONS as readonly string[]).includes("txt"));
  assert.ok((RESUME_ACCEPTED_EXTENSIONS as readonly string[]).includes("png"));
  assert.equal(validateDocumentSafety(Buffer.alloc(26 * 1024 * 1024, 0x25), "pdf").isTooLarge, true);
  const manyPages = Buffer.from(`%PDF-1.7\n1 0 obj << /Type /Pages /Count ${RESUME_MAX_PAGES + 5} /Kids [] >> endobj\n%%EOF`);
  assert.equal(pdfPageCount(manyPages), RESUME_MAX_PAGES + 5);
  assert.equal(validateDocumentSafety(manyPages, "pdf").isTooLarge, true);
  assert.equal(validateDocumentSafety(Buffer.from("PK\u0003\u0004not a pdf"), "pdf").isValid, false);
  assert.equal(validateDocumentSafety(Buffer.from("%PDF-1.4\ntrailer << /Encrypt 5 0 R >>"), "pdf").isEncrypted, true);
  const png = read("kabir-internships--png.png");
  assert.ok(imageDimensions(png)!.width > 1000);
  assert.equal(validateDocumentSafety(png, "png").isValid, true);
  assert.equal(validateDocumentSafety(png, "jpg").isValid, false, "signature must match the extension");
  const huge = Buffer.from(png); huge.writeUInt32BE(9000, 16);
  assert.equal(validateDocumentSafety(huge, "png").isTooLarge, true, "decompression-bomb guard");
  await assert.rejects(readDocumentText(Buffer.from("%PDF-1.4\n1 0 obj garbage"), "pdf"), "a corrupt PDF fails to parse (job reports PARSE_FAILED)");
});

// ---------------------------------------------------------------- 20-23, 25: persistence end to end

test("20-25 upload -> processing -> persisted records -> decisions; idempotent, isolated, edits preserved", async () => {
  await setupTestDatabase();
  const { queueResumeUpload, processResumeJob, getResumeJobStatus } = await import("../lib/services/resume-ingestion-service");
  const { persistExtraction, recordDecisions, listRecords } = await import("../lib/services/resume-extraction-persistence");
  const { applyReviewDecisions } = await import("../lib/services/resume-review-decisions");
  const { getDb, resumeDocuments, resumeExtractionRuns } = await import("../lib/db");
  const { eq } = await import("drizzle-orm");
  const owner = await createTestPerson("cvowner");
  const other = await createTestPerson("cvother");

  // Upload and process a real fixture through the production job.
  const bytes = read("priya-sidebar--pdf-sidebar.pdf");
  const { jobId, documentId } = await queueResumeUpload({ personId: owner, filename: "priya.pdf", mimeType: "application/pdf", bytes });
  await processResumeJob(jobId, owner);
  const status = await getResumeJobStatus(documentId, owner, jobId);
  assert.equal(status.status, "review_ready", status.message ?? "");
  const review = status.result!;
  // 25: response contract the onboarding UI depends on.
  assert.ok(review.reviewCandidates.length > 5);
  for (const c of review.reviewCandidates) {
    // Record candidates map to profile records by index; profile fields are "profile_<field>".
    assert.match(c.candidateId, c.category === "profile" ? /^profile_[a-zA-Z]+$/ : /^[a-zA-Z]+_\d+$/);
    assert.equal(typeof c.value, "string");
    assert.equal(typeof c.sourceSpan, "string");
  }
  const structured = review.structured as { experience: Array<{ company: string; role: string; startDate?: string }> };
  assert.equal(structured.experience[0].company, "Northwind Payments Pvt. Ltd.");
  assert.equal(review.extractionMeta.schemaVersion, "cv-extract/3.0");

  const db = await getDb();
  const records = await listRecords(owner, documentId);
  assert.equal(records.length, new Set(review.reviewCandidates.map((c) => c.candidateId)).size);
  const [run] = await db.select().from(resumeExtractionRuns).where(eq(resumeExtractionRuns.documentId, documentId));
  assert.deepEqual([run.status, run.method, run.textQuality], ["completed", "native_pdf", "good"]);

  // 23: an approved, corrected record survives reprocessing.
  const exp = review.reviewCandidates.find((c) => c.category === "experience")!;
  await recordDecisions(owner, documentId, [{ candidateId: exp.candidateId, state: "confirmed", correctedValue: "Senior Software Engineer · Northwind Payments" }]);
  // 20 + 22: a retried persist (same job) and a new run (new job) update rows instead of duplicating them.
  await persistExtraction({ personId: owner, documentId, jobId, candidates: review.reviewCandidates as never, llmUsed: false });
  await persistExtraction({ personId: owner, documentId, jobId: `${jobId}-retry`, candidates: review.reviewCandidates as never, llmUsed: false });
  const after = await listRecords(owner, documentId);
  assert.equal(after.length, records.length, "no duplicate rows after reprocessing");
  const kept = after.find((r) => r.candidateId === exp.candidateId)!;
  assert.deepEqual([kept.reviewStatus, kept.userValue], ["confirmed", "Senior Software Engineer · Northwind Payments"]);
  const again = await recordDecisions(owner, documentId, [{ candidateId: exp.candidateId, state: "confirmed", correctedValue: "Senior Software Engineer · Northwind Payments" }]);
  assert.deepEqual(again, { updated: 0, unchanged: 1 }, "a repeated save is a no-op");

  // 21: another account sees nothing and changes nothing.
  assert.equal((await getResumeJobStatus(documentId, other, jobId)).httpStatus, 404);
  assert.equal((await listRecords(other, documentId)).length, 0);
  assert.deepEqual(await recordDecisions(other, documentId, [{ candidateId: exp.candidateId, state: "rejected" }]), { updated: 0, unchanged: 0 });
  await assert.rejects(persistExtraction({ personId: other, documentId, jobId: "x", candidates: [], llmUsed: false }));

  // Decisions map to the stored profile record at the same index (leadership/footprints included).
  const [doc] = await db.select().from(resumeDocuments).where(eq(resumeDocuments.id, documentId));
  const known = new Set(review.reviewCandidates.map((c) => c.candidateId));
  const applied = applyReviewDecisions(doc.extractedProfile as never, known, [{ candidateId: exp.candidateId, state: "confirmed" }]);
  const idx = Number(exp.candidateId.split("_")[1]);
  assert.equal(applied.profile.groups.experience[idx].fields.organization.value, structured.experience[idx].company);

  // Same file uploaded again later: earlier decisions are carried over and preselected.
  const second = await queueResumeUpload({ personId: owner, filename: "priya-again.pdf", mimeType: "application/pdf", bytes });
  await processResumeJob(second.jobId, owner);
  const s2 = await getResumeJobStatus(second.documentId, owner, second.jobId);
  const carried = s2.result!.reviewCandidates.find((c) => c.category === "experience" && c.candidateId === exp.candidateId) as { previousDecision?: string; previousValue?: string } | undefined;
  assert.equal(carried?.previousDecision, "confirmed");
  assert.equal(carried?.previousValue, "Senior Software Engineer · Northwind Payments");

  // Retention: deleting the document removes its extracted records and payload.
  const { ObjectStorageService } = await import("../lib/storage/object-storage");
  await ObjectStorageService.deleteDocument(documentId, owner);
  assert.equal((await listRecords(owner, documentId)).length, 0);
  const [gone] = await db.select().from(resumeDocuments).where(eq(resumeDocuments.id, documentId));
  assert.equal(gone.extractedProfile, null);
  assert.equal((gone.metadata as Record<string, unknown>).review, undefined);
});

test("image upload without a configured OCR service fails clearly instead of returning empty success", async () => {
  await setupTestDatabase();
  const { queueResumeUpload, processResumeJob, getResumeJobStatus } = await import("../lib/services/resume-ingestion-service");
  const owner = await createTestPerson("cvimage");
  const { jobId, documentId } = await queueResumeUpload({ personId: owner, filename: "cv.png", mimeType: "image/png", bytes: read("kabir-internships--png.png") });
  await processResumeJob(jobId, owner);
  const s = await getResumeJobStatus(documentId, owner, jobId);
  assert.equal(s.status, "failed");
  assert.equal(s.errorCode, "OCR_SERVICE_NOT_CONFIGURED");
});

// ---------------------------------------------------------------- migration / infrastructure failures

test("missing resume_extraction_runs table produces PERSIST_FAILED (not silent success or crash)", async () => {
  // Simulates a production deployment where npm run db:migrate was never run.
  const db = await setupTestDatabase();
  const { queueResumeUpload, processResumeJob, getResumeJobStatus } = await import("../lib/services/resume-ingestion-service");
  const { sql } = await import("drizzle-orm");
  const owner = await createTestPerson("cvmigrate");

  // Drop the two new tables to reproduce a missing-migration environment.
  await (db as { execute: (q: unknown) => Promise<unknown> }).execute(sql.raw('DROP TABLE IF EXISTS "resume_extracted_records" CASCADE'));
  await (db as { execute: (q: unknown) => Promise<unknown> }).execute(sql.raw('DROP TABLE IF EXISTS "resume_extraction_runs" CASCADE'));

  const bytes = read("aarav-fresher--pdf-single.pdf");
  const { jobId, documentId } = await queueResumeUpload({ personId: owner, filename: "aarav.pdf", mimeType: "application/pdf", bytes });
  await processResumeJob(jobId, owner);
  const s = await getResumeJobStatus(documentId, owner, jobId);

  // The failure must be PERSIST_FAILED, not a crash, empty 200, or a
  // different code.  The UI distinction matters: PERSIST_FAILED is retryable
  // (after the operator applies the migration) while EXTRACTION_FAILED is not.
  assert.equal(s.status, "failed", "job must reach failed state");
  assert.equal(s.errorCode, "PERSIST_FAILED", "error code must be PERSIST_FAILED, not " + s.errorCode);
  assert.equal(s.retryable, true, "PERSIST_FAILED must be retryable");
  assert.equal(s.result, null, "failed job must not carry a review payload");
});

test("a record rejected by a database constraint fails the save, and the log carries the SQLSTATE but no CV text", async () => {
  await setupTestDatabase();
  const { queueResumeUpload, sanitizeError } = await import("../lib/services/resume-ingestion-service");
  const { persistExtraction, listRecords } = await import("../lib/services/resume-extraction-persistence");
  const owner = await createTestPerson("cvconstraint");
  const { jobId, documentId } = await queueResumeUpload({ personId: owner, filename: "a.pdf", mimeType: "application/pdf", bytes: read("aarav-fresher--pdf-single.pdf") });
  const secret = "+91 98765 43210 aarav private note";
  const bad = { candidateId: "skill_0", category: null as unknown as string, value: secret, sourceSpan: secret };
  const err = await persistExtraction({ personId: owner, documentId, jobId, candidates: [bad], llmUsed: false }).then(() => null, (e) => e);
  assert.ok(err, "a NOT NULL violation must not be reported as success");
  const safe = sanitizeError(err);
  assert.equal(safe.sqlState, "23502");
  assert.ok(!JSON.stringify(safe).includes("98765") && !JSON.stringify(safe).includes(owner), JSON.stringify(safe));
  assert.equal((await listRecords(owner, documentId)).length, 0, "no partial record rows");
});

test("after a successful save, reloading status returns the same persisted suggestions", async () => {
  await setupTestDatabase();
  const { queueResumeUpload, processResumeJob, getResumeJobStatus } = await import("../lib/services/resume-ingestion-service");
  const owner = await createTestPerson("cvreload");
  const { jobId, documentId } = await queueResumeUpload({ personId: owner, filename: "r.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: read("meera-research--docx-plain.docx") });
  await processResumeJob(jobId, owner);
  const first = await getResumeJobStatus(documentId, owner, jobId);
  assert.equal(first.status, "review_ready", first.message ?? "");
  await processResumeJob(jobId, owner);
  const reload = await getResumeJobStatus(documentId, owner);
  assert.deepEqual(reload.result!.reviewCandidates.map((c) => c.candidateId), first.result!.reviewCandidates.map((c) => c.candidateId));
});

test("D/G/K: a correction survives reload and retry, retry adds no run or record, and AI is not called without consent", async () => {
  const db = await setupTestDatabase();
  const { queueResumeUpload, processResumeJob, getResumeJobStatus, requeueResumeDocument } = await import("../lib/services/resume-ingestion-service");
  const { recordDecisions, listRecords } = await import("../lib/services/resume-extraction-persistence");
  const { resumeExtractionRuns } = await import("../lib/db");
  const { eq } = await import("drizzle-orm");
  const owner = await createTestPerson("cvdecide");
  const { jobId, documentId } = await queueResumeUpload({ personId: owner, filename: "k.pdf", mimeType: "application/pdf", bytes: read("kabir-internships--pdf-single.pdf"), aiConsent: false });
  await processResumeJob(jobId, owner);
  const first = await getResumeJobStatus(documentId, owner, jobId);
  assert.equal(first.status, "review_ready", first.message ?? "");
  assert.equal(first.result!.extractionMeta.llmAttempted, false, "no AI call without consent");
  const exp = first.result!.reviewCandidates.find((c) => c.category === "experience")!;
  const other = first.result!.reviewCandidates.find((c) => c.category === "skill")!;
  await recordDecisions(owner, documentId, [
    { candidateId: exp.candidateId, state: "confirmed", correctedValue: "Data Intern · Corrected Org" },
    { candidateId: other.candidateId, state: "rejected" },
  ]);

  const reload = await getResumeJobStatus(documentId, owner);
  const rExp = reload.result!.reviewCandidates.find((c) => c.candidateId === exp.candidateId)!;
  const rOther = reload.result!.reviewCandidates.find((c) => c.candidateId === other.candidateId)!;
  assert.deepEqual([rExp.decision, rExp.decidedValue, rOther.decision], ["confirmed", "Data Intern · Corrected Org", "rejected"]);
  assert.equal(rExp.value, exp.value, "the extracted value itself is kept as evidence");

  const recordsBefore = (await listRecords(owner, documentId)).length;
  const retryJob = await requeueResumeDocument(owner, documentId);
  assert.ok(retryJob);
  await processResumeJob(retryJob!, owner);
  const afterRetry = await getResumeJobStatus(documentId, owner, retryJob);
  assert.equal(afterRetry.status, "review_ready", afterRetry.message ?? "");
  const kept = afterRetry.result!.reviewCandidates.find((c) => c.candidateId === exp.candidateId)!;
  assert.deepEqual([kept.decision, kept.decidedValue], ["confirmed", "Data Intern · Corrected Org"]);
  assert.equal((await listRecords(owner, documentId)).length, recordsBefore, "retry adds no records");
  const runs = await db.select().from(resumeExtractionRuns).where(eq(resumeExtractionRuns.documentId, documentId));
  assert.deepEqual([runs.length, runs[0].status, runs[0].jobId], [1, "completed", retryJob], "retry updates the single run");
});

test("F: a failure in a later insert batch removes the rows this attempt added", async () => {
  await setupTestDatabase();
  const { queueResumeUpload } = await import("../lib/services/resume-ingestion-service");
  const { persistExtraction, listRecords } = await import("../lib/services/resume-extraction-persistence");
  const owner = await createTestPerson("cvpartial");
  const { jobId, documentId } = await queueResumeUpload({ personId: owner, filename: "p.pdf", mimeType: "application/pdf", bytes: read("vikram-minimal--pdf-single.pdf") });
  const good = Array.from({ length: 205 }, (_, i) => ({ candidateId: `skill_${i}`, category: "skill", value: `Skill ${i}`, sourceSpan: `Skill ${i}` }));
  const bad = { candidateId: "skill_999", category: null as unknown as string, value: "x", sourceSpan: "x" };
  await assert.rejects(persistExtraction({ personId: owner, documentId, jobId, candidates: [...good, bad], llmUsed: false }));
  assert.equal((await listRecords(owner, documentId)).length, 0, "the first batch of 200 was rolled back by hand");
});

test("migration: CV tables are created on an existing non-empty database, idempotently, without touching data", async () => {
  const db = await setupTestDatabase();
  const { sql } = await import("drizzle-orm");
  const { MIGRATION_SQL_STATEMENTS, CV_PERSISTENCE_MIGRATIONS } = await import("../lib/db/migration-sql");
  const { applyCvPersistenceMigration, verifyCvPersistenceSchema, isDataChanging } = await import("../lib/db/cv-persistence-migration");
  const exec = db as unknown as { execute: (q: unknown) => Promise<unknown> };
  const query = async (s: string) => {
    const r = (await exec.execute(sql.raw(s))) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    return Array.isArray(r) ? r : r.rows ?? [];
  };
  assert.equal(CV_PERSISTENCE_MIGRATIONS.filter(isDataChanging).length, 0);
  assert.ok(MIGRATION_SQL_STATEMENTS.filter(isDataChanging).length >= 20, "the full list does change data, so it is not run by builds");
  for (const s of CV_PERSISTENCE_MIGRATIONS) assert.ok(MIGRATION_SQL_STATEMENTS.includes(s), "the full list still contains the CV statements");

  // An existing database: a student, an uploaded CV, then the CV tables are missing.
  const owner = await createTestPerson("cvmig");
  const { queueResumeUpload } = await import("../lib/services/resume-ingestion-service");
  const { documentId } = await queueResumeUpload({ personId: owner, filename: "m.pdf", mimeType: "application/pdf", bytes: read("vikram-minimal--pdf-single.pdf") });
  await query('DROP TABLE IF EXISTS "resume_extracted_records" CASCADE');
  await query('DROP TABLE IF EXISTS "resume_extraction_runs" CASCADE');
  assert.equal((await verifyCvPersistenceSchema(query)).ok, false);

  const status = await applyCvPersistenceMigration(query);
  assert.deepEqual(status, { runs: true, records: true, identityIndex: true, foreignKeys: 4, ok: true });
  await query(`INSERT INTO "resume_extracted_records" (id, person_id, document_id, run_id, category, record_key, data, review_status, user_value) VALUES ('rec_keep', '${owner}', '${documentId}', 'run_x', 'skill', 'python', '{}'::jsonb, 'confirmed', 'Python')`);
  assert.equal((await applyCvPersistenceMigration(query)).ok, true, "second run is a no-op");
  const kept = await query(`SELECT review_status, user_value FROM "resume_extracted_records" WHERE id = 'rec_keep'`);
  assert.deepEqual(kept[0], { review_status: "confirmed", user_value: "Python" });
  assert.equal((await query(`SELECT count(*)::int AS n FROM "resume_documents" WHERE id = '${documentId}'`))[0].n, 1);
});

test("PERSIST_FAILED is distinct from EXTRACTION_FAILED in the UI contract", () => {
  const { failureInfo } = require("../lib/services/resume-ingestion-service");
  const pf = failureInfo("PERSIST_FAILED");
  const ef = failureInfo("EXTRACTION_FAILED");
  assert.ok(pf?.retryable, "PERSIST_FAILED must be retryable");
  assert.ok(ef?.retryable, "EXTRACTION_FAILED must also be retryable");
  assert.notEqual(pf?.message, ef?.message, "messages must differ so the UI can surface distinct guidance");
});

before(() => {
  assert.ok(fs.existsSync(path.join(FIX, "manifest.json")), "render fixtures first: python eval/cv/render.py");
});
