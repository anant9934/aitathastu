import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import { parseResumeDocument } from "../lib/services/document-parser-service";

function scannedPdf(jpeg: Buffer, width: number, height: number): Buffer {
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [0];
  const append = (part: string | Buffer) => chunks.push(typeof part === "string" ? Buffer.from(part, "latin1") : part);
  const position = () => chunks.reduce((sum, part) => sum + part.length, 0);
  const object = (id: number, body: string | Buffer) => {
    offsets[id] = position();
    append(`${id} 0 obj\n`); append(body); append("\nendobj\n");
  };
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 750 300] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = position();
  append(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  append(jpeg); append("\nendstream\nendobj\n");
  const command = "q 750 0 0 300 0 0 cm /Im0 Do Q\n";
  object(5, `<< /Length ${command.length} >>\nstream\n${command}endstream`);
  const xref = position();
  append("xref\n0 6\n0000000000 65535 f \n");
  for (let id = 1; id <= 5; id++) append(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.concat(chunks);
}

async function main() {
  const canvas = createCanvas(1500, 600);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff"; context.fillRect(0, 0, 1500, 600);
  context.fillStyle = "#111"; context.font = "bold 72px Arial";
  ["ASHA MEHTA", "EDUCATION", "BTECH COMPUTER SCIENCE", "SKILLS PYTHON SQL"].forEach((line, index) => context.fillText(line, 70, 110 + index * 120));
  const document = scannedPdf(await canvas.encode("jpeg"), 1500, 600);
  const result = await parseResumeDocument(document, "pdf", { enableOcr: true, ocrTimeoutMs: 30000 });
  assert.equal(result.ocrUsed, true, JSON.stringify(result.warnings));
  assert.equal(result.ocrFailed, false, JSON.stringify(result.warnings));
  assert.match(result.text.toUpperCase(), /ASHA\s+MEHTA/);
  console.log(JSON.stringify({ type: result.documentType, ocrUsed: result.ocrUsed, ocrFailed: result.ocrFailed, chars: result.text.length, text: result.text.trim().replace(/\s+/g, " ").slice(0, 150) }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
