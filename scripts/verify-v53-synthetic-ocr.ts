import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import { recognizeScannedDocument } from "../lib/services/document-parser-service";

async function main() {
  const canvas = createCanvas(1500, 440);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 1500, 440);
  context.fillStyle = "#111111";
  context.font = "bold 74px Arial";
  context.fillText("ASHA MEHTA", 70, 110);
  context.font = "58px Arial";
  context.fillText("EDUCATION", 70, 225);
  context.fillText("BTECH COMPUTER SCIENCE", 70, 325);
  const result = await recognizeScannedDocument(await canvas.encode("png"), 30000);
  assert.equal(result.success, true, result.error);
  assert.equal(result.checksumValid, true, "OCR model checksum must be valid");
  assert.match(result.text.toUpperCase(), /ASHA\s+MEHTA/);
  assert.match(result.text.toUpperCase(), /EDUCATION/);
  console.log(JSON.stringify({ success: result.success, modelChecksumValid: result.checksumValid, confidence: result.pageResults[0]?.confidence, extracted: result.text.trim().replace(/\s+/g, " ") }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
