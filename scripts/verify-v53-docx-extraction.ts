import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseResumeDocument } from "../lib/services/document-parser-service";

async function main() {
  const temporary = mkdtempSync(join(tmpdir(), "v53-docx-"));
  try {
    const document = join(temporary, "sample.docx");
    const bundledPython = join(process.cwd(), "services/resume-extractor/.venv/bin/python");
    const python = process.env.V53_PYTHON || (existsSync(bundledPython) ? bundledPython : "python3");
    const generated = spawnSync(python, [join(process.cwd(), "scripts/generate-v53-document-fixture.py"), document, "docx"], { encoding: "utf8" });
    assert.equal(generated.status, 0, generated.stderr || "Could not generate DOCX fixture");
    const result = await parseResumeDocument(readFileSync(document), "docx", { enableOcr: false });
    assert.equal(result.documentType, "type_g_docx");
    for (const phrase of ["ASHA MEHTA", "Example University", "Solar Energy Forecasting", "Python, SQL, PyTorch"]) assert.ok(result.text.includes(phrase), phrase);
    console.log(JSON.stringify({ type: result.documentType, chars: result.text.length, ocrUsed: result.ocrUsed }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
