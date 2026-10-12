import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseResumeDocument } from "../lib/services/document-parser-service";

async function main() {
  const temporary = mkdtempSync(join(tmpdir(), "v53-mixed-"));
  try {
    const document = join(temporary, "mixed.pdf");
    const bundledPython = join(process.cwd(), "services/resume-extractor/.venv/bin/python");
    const python = process.env.V53_PYTHON || (existsSync(bundledPython) ? bundledPython : "python3");
    const generated = spawnSync(python, [join(process.cwd(), "scripts/generate-v53-document-fixture.py"), document, "mixed"], { encoding: "utf8" });
    assert.equal(generated.status, 0, generated.stderr || "Could not generate mixed PDF fixture");
    const result = await parseResumeDocument(readFileSync(document), "pdf", { enableOcr: true, ocrTimeoutMs: 30000 });
    assert.equal(result.documentType, "type_d_hybrid");
    assert.equal(result.ocrUsed, true);
    assert.equal(result.ocrFailed, false, JSON.stringify(result.warnings));
    assert.match(result.text.toUpperCase(), /NATIVE TEXT LAYER/);
    assert.match(result.text.toUpperCase(), /SOLAR ENERGY FORECASTING/);
    console.log(JSON.stringify({ type: result.documentType, ocrUsed: result.ocrUsed, pages: result.pageCount, sources: result.pages?.map(page => page.sourceType) ?? [] }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
