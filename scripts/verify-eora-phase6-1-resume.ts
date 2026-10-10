/** Focused offline checks for Phase 6.1 resume recovery. No provider or database calls. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseResumeDocument } from "../lib/services/document-parser-service";
import { DeterministicResumeExtractionEngine } from "../lib/services/deterministic-resume-extraction-engine";
import { extractResumeStructured } from "../lib/services/resume-extraction-service";
import { resumeCandidates } from "../lib/services/resume-review-service";
import { checkRateLimitDistributed, resetRateLimits } from "../lib/security/rate-limit";
import {
  encryptConnectionToken,
  decryptConnectionToken,
  decryptConnectionTokenWithMeta,
  reencryptConnectionToken,
  TokenReauthorizationRequiredError,
} from "../lib/security/connection-token";

async function main() {
  const pdf = readFileSync(path.join(process.cwd(), "scripts/fixtures/test_student_cv.pdf"));
  const parsed = await parseResumeDocument(pdf, "pdf", { enableOcr: false });
  const extraction = await extractResumeStructured(parsed.text, "phase61-test");
  assert.equal(extraction.success, true);
  assert.equal(extraction.provider, "deterministic-engine");
  assert.ok(extraction.extracted);
  const candidates = resumeCandidates(extraction.extracted, parsed.text);
  assert.ok(candidates.length > 0);
  const normalized = parsed.text.replace(/\s+/g, " ").toLocaleLowerCase();
  assert.ok(candidates.every((candidate) => normalized.includes(candidate.sourceSpan.replace(/\s+/g, " ").toLocaleLowerCase())));
  console.log("PASS PDF parsing produces source-grounded review candidates without LLM calls");

  const firstSkill = extraction.extracted.skills[0];
  assert.ok(firstSkill);
  const tampered = { ...extraction.extracted, skills: [{ ...firstSkill, sourceSpan: "A fabricated source sentence not in this document" }] };
  assert.equal(resumeCandidates(tampered, parsed.text).some((candidate) => candidate.category === "skill"), false);
  console.log("PASS candidates with absent source spans are discarded");

  const original = DeterministicResumeExtractionEngine.extract;
  try {
    DeterministicResumeExtractionEngine.extract = () => ({ structured: { skills: [{ name: "", sourceSpan: "" }] } }) as ReturnType<typeof original>;
    const malformed = await extractResumeStructured("synthetic input");
    assert.equal(malformed.success, false);
    assert.equal(malformed.extracted, null);
    console.log("PASS malformed structured output cannot report success");

    DeterministicResumeExtractionEngine.extract = () => { throw new Error("synthetic internal failure"); };
    const failed = await extractResumeStructured("synthetic input");
    assert.equal(failed.success, false);
    assert.equal(failed.extracted, null);
    assert.ok(!failed.error?.includes("synthetic internal failure"));
    console.log("PASS engine failure cannot fabricate success or leak internal error");
  } finally {
    DeterministicResumeExtractionEngine.extract = original;
  }

  resetRateLimits();
  for (let i = 0; i < 5; i++) assert.equal((await checkRateLimitDistributed("phase61-student", "resume")).allowed, true);
  assert.equal((await checkRateLimitDistributed("phase61-student", "resume")).allowed, false);
  resetRateLimits();
  console.log("PASS authenticated-student resume quota is five requests per minute");

  // Dual-key token rotation & migration test
  const originalKey = process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY;
  const originalPrev = process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  try {
    const keyA = "a".repeat(32);
    const keyB = "b".repeat(32);
    process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY = keyA;
    delete process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY_PREVIOUS;

    const person = "student_rotation_test";
    const sampleToken = "gho_test_oauth_token_123456";
    const sealedWithA = encryptConnectionToken(sampleToken, person);

    // Rotate to Key B without previous key -> throws TokenReauthorizationRequiredError
    process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY = keyB;
    assert.throws(() => decryptConnectionToken(sealedWithA, person), TokenReauthorizationRequiredError);

    // Configure Key A as previous key -> decrypts seamlessly and identifies "previous"
    process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY_PREVIOUS = keyA;
    const meta = decryptConnectionTokenWithMeta(sealedWithA, person);
    assert.equal(meta.token, sampleToken);
    assert.equal(meta.keyUsed, "previous");

    // Re-encrypt under Key B
    const { reencrypted, changed } = reencryptConnectionToken(sealedWithA, person);
    assert.equal(changed, true);

    // Remove previous key -> re-encrypted envelope decrypts under Key B alone
    delete process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY_PREVIOUS;
    assert.equal(decryptConnectionToken(reencrypted, person), sampleToken);
    console.log("PASS dual-key token rotation, transparent re-encryption, and safe error handling");
  } finally {
    if (originalKey !== undefined) process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY = originalKey;
    else delete process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY;
    if (originalPrev !== undefined) process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY_PREVIOUS = originalPrev;
    else delete process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  }

  console.log("Phase 6.1/6.2 offline resume and security checks: 6/6 passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
