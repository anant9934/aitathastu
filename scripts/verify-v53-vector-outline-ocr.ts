import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseResumeDocument } from "../lib/services/document-parser-service";

async function main() {
  const temporary = mkdtempSync(join(tmpdir(), "v53-vector-"));
  try {
    const document = join(temporary, "outlined.pdf");
    const bundledPython = join(process.cwd(), "services/resume-extractor/.venv/bin/python");
    const python = process.env.V53_PYTHON || (existsSync(bundledPython) ? bundledPython : "python3");
    const generated = spawnSync(python, [join(process.cwd(), "scripts/generate-v53-document-fixture.py"), document], { encoding: "utf8" });
    assert.equal(generated.status, 0, generated.stderr || "Could not generate outlined PDF fixture");
    const result = await parseResumeDocument(readFileSync(document), "pdf", { enableOcr: true, ocrTimeoutMs: 30000 });
    assert.equal(result.documentType, "type_c_vector_outline");
    assert.equal(result.ocrUsed, true);
    assert.equal(result.ocrFailed, false, JSON.stringify(result.warnings));
    assert.match(result.text.toUpperCase(), /ASHA\s+MEHTA/);
    console.log(JSON.stringify({ type: result.documentType, ocrUsed: result.ocrUsed, ocrFailed: result.ocrFailed, chars: result.text.length }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
