/**
 * Verify the packaged OCR model without relying on a model in process.cwd().
 * Use an absolute tsx loader path because the test changes process.cwd(),
 * then pass a PDF that requires OCR.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseResumeDocument, resolveLocalTrainedDataPath } from "../lib/services/document-parser-service";

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Provide a PDF requiring OCR.");
  const bytes = fs.readFileSync(path.resolve(input));
  const originalCwd = process.cwd();
  const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), "aitathastu-ocr-cwd-"));
  try {
    process.chdir(emptyCwd);
    assert.equal(fs.existsSync(path.join(process.cwd(), "eng.traineddata")), false);
    assert.equal(resolveLocalTrainedDataPath().checksumValid, true, "bundled model not found");
    const parsed = await parseResumeDocument(bytes, "pdf", { enableOcr: true, ocrTimeoutMs: 20000 });
    assert.equal(parsed.ocrUsed, true, "PDF did not exercise OCR");
    assert.equal(parsed.ocrFailed, false, `OCR failed: ${parsed.warnings?.join("; ")}`);
    assert.equal(parsed.metadata.ocrModelChecksumValid, true, "OCR model checksum failed");
    assert.ok(parsed.text.trim().length > 100, "OCR returned too little text");
    console.log(`Serverless OCR model: PASS (${parsed.text.length} characters, model checksum verified, independent of cwd)`);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(emptyCwd, { recursive: true, force: true });
  }
}

main().catch(error => { console.error("Serverless OCR model: FAIL", error); process.exitCode = 1; });
