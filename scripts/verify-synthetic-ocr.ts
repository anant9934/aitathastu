import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseResumeDocument } from "../lib/services/document-parser-service";
import { extractResumeStructured } from "../lib/services/resume-extraction-service";

async function main() {
  const fixtureDir = process.argv[2] || "/private/tmp/aitathastu-audit-fixtures";
  for (const filename of ["synthetic_image_cv.pdf", "synthetic_vector_cv.pdf"]) {
    const bytes = fs.readFileSync(path.join(fixtureDir, filename));
    const parsed = await parseResumeDocument(bytes, "pdf", { enableOcr: true, ocrTimeoutMs: 20000 });
    assert.equal(parsed.ocrUsed, true, `${filename}: OCR did not run`);
    assert.equal(parsed.ocrFailed, false, `${filename}: OCR failed`);
    assert.match(parsed.text.toUpperCase(), /ALEX MORGAN/, `${filename}: name missing`);
    assert.match(parsed.text.toUpperCase(), /EXAMPLE UNIVERSITY/, `${filename}: education missing`);
    assert.match(parsed.text.toUpperCase(), /PYTHON/, `${filename}: skill missing`);
    const extraction = await extractResumeStructured(parsed.text);
    assert.equal(extraction.success, true, `${filename}: structured extraction failed`);
    assert.equal(extraction.extractedProfile?.fullName?.toUpperCase(), "ALEX MORGAN", `${filename}: name classification failed`);
    assert.ok(extraction.extracted?.education.some((entry) => /EXAMPLE UNIVERSITY/i.test(entry.institution)), `${filename}: education classification failed`);
    assert.ok(extraction.extracted?.skills.some((entry) => entry.name === "Python"), `${filename}: skill classification failed`);
    console.log(`${filename}: OCR used; ${parsed.text.length} characters; ${parsed.metadata.parseDurationMs}ms parse; name, education and skill classified.`);
  }
  const docx = fs.readFileSync(path.join(fixtureDir, "synthetic_table_cv.docx"));
  const parsedDocx = await parseResumeDocument(docx, "docx", { enableOcr: false });
  assert.match(parsedDocx.text.toUpperCase(), /EXAMPLE UNIVERSITY/);
  assert.match(parsedDocx.text.toUpperCase(), /PYTORCH/);
  console.log(`synthetic_table_cv.docx: ${parsedDocx.text.length} characters; ${parsedDocx.metadata.parseDurationMs}ms parse; table and skills recovered.`);
  const nativePdf = fs.readFileSync(path.join(fixtureDir, "synthetic_native_cv.pdf"));
  const native = await parseResumeDocument(nativePdf, "pdf", { enableOcr: true });
  assert.equal(native.ocrUsed, false, "Native PDF should not run OCR");
  assert.match(native.text.toUpperCase(), /EXAMPLE UNIVERSITY/);
  console.log(`synthetic_native_cv.pdf: native text used; ${native.text.length} characters; ${native.metadata.parseDurationMs}ms parse.`);
  const mixedBytes = fs.readFileSync(path.join(fixtureDir, "synthetic_mixed_cv.pdf"));
  const mixed = await parseResumeDocument(mixedBytes, "pdf", { enableOcr: true, ocrTimeoutMs: 20000 });
  assert.equal(mixed.ocrUsed, true, "Mixed PDF should OCR its image page");
  assert.equal(mixed.pageCount, 2);
  assert.ok(mixed.pages?.some((page) => page.sourceType === "native"));
  assert.ok(mixed.pages?.some((page) => page.sourceType === "ocr"));
  assert.match(mixed.text.toUpperCase(), /EXAMPLE UNIVERSITY/);
  console.log(`synthetic_mixed_cv.pdf: native and OCR page paths used; ${mixed.text.length} characters; ${mixed.metadata.parseDurationMs}ms parse.`);

  const columns = await parseResumeDocument(fs.readFileSync(path.join(fixtureDir, "synthetic_two_column_cv.pdf")), "pdf");
  assert.match(columns.text.toUpperCase(), /EXAMPLE UNIVERSITY/);
  assert.match(columns.text.toUpperCase(), /PYTHON/);
  console.log(`synthetic_two_column_cv.pdf: ${columns.pages?.[0]?.readingOrder}; ${columns.metadata.parseDurationMs}ms parse; education and skills recovered.`);

  const standardDocx = await parseResumeDocument(fs.readFileSync(path.join(fixtureDir, "synthetic_standard_cv.docx")), "docx");
  assert.match(standardDocx.text.toUpperCase(), /EXAMPLE UNIVERSITY/);
  assert.match(standardDocx.text.toUpperCase(), /PYTORCH/);
  console.log(`synthetic_standard_cv.docx: ${standardDocx.text.length} characters recovered; ${standardDocx.metadata.parseDurationMs}ms parse.`);

  const short = await parseResumeDocument(fs.readFileSync(path.join(fixtureDir, "synthetic_short_cv.pdf")), "pdf");
  assert.match(short.text.toUpperCase(), /ALEX MORGAN/);
  assert.match(short.text.toUpperCase(), /PYTHON/);
  console.log(`synthetic_short_cv.pdf: ${short.text.length} characters recovered without a parser error; ${short.metadata.parseDurationMs}ms parse.`);

  const damaged = await parseResumeDocument(fs.readFileSync(path.join(fixtureDir, "synthetic_corrupted.pdf")), "pdf");
  assert.equal(damaged.requiresManualReview, true);
  assert.equal(damaged.text.trim(), "");
  console.log("synthetic_corrupted.pdf: no extracted text; manual review required.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
