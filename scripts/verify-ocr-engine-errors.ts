/**
 * In-process OCR (used by benchmarks/scripts; production routes delegate OCR to
 * the extractor) must report engine faults with a specific code.
 *
 *   node --import tsx scripts/verify-ocr-engine-errors.ts <scanned.pdf> [--expect-model-missing]
 */
import fs from "node:fs";
import { recognizeScannedDocument, resolveLocalTrainedDataPath } from "../lib/services/document-parser-service";

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error("usage: verify-ocr-engine-errors.ts <scanned.pdf> [--expect-model-missing]");
  const expectMissing = flag === "--expect-model-missing";
  const model = resolveLocalTrainedDataPath();
  console.log("model checksumValid:", model.checksumValid);

  const result = await recognizeScannedDocument(fs.readFileSync(file), 60000);
  console.log({ success: result.success, errorCode: result.errorCode ?? null, chars: result.text.length });

  const ok = expectMissing
    ? !model.checksumValid && !result.success && result.errorCode === "OCR_MODEL_UNAVAILABLE"
    : model.checksumValid && result.success && result.text.includes("Sharma");
  console.log(ok ? "PASS" : "FAIL", expectMissing ? "missing model -> OCR_MODEL_UNAVAILABLE" : "valid model -> text recovered");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
