import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { request } from "@playwright/test";

async function main() {
  const baseURL = process.env.BASE_URL || "http://127.0.0.1:3101";
  const fixtureDir = process.env.FIXTURE_DIR || "/private/tmp/aitathastu-audit-fixtures";
  const student = await request.newContext({ baseURL });
  const otherStudent = await request.newContext({ baseURL });
  const pollOnly = await request.newContext({ baseURL });
  let reviewedClaim: Record<string, unknown> | null = null;
  try {
    const jobs = await pollOnly.get("/api/student/processing-jobs");
    assert.equal(jobs.status(), 200);
    assert.deepEqual((await jobs.json()).jobs, []);
    assert.equal((await (await pollOnly.get("/api/auth/session")).json()).authenticated, false, "Read-only job poll minted a guest session");
    const files = [
      { name: "synthetic_native_cv.pdf", type: "application/pdf", ocr: false },
      { name: "synthetic_image_cv.pdf", type: "application/pdf", ocr: true },
      { name: "synthetic_vector_cv.pdf", type: "application/pdf", ocr: true },
      { name: "synthetic_table_cv.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ocr: false },
    ];
    for (const file of files) {
      const response = await student.post("/api/resume/extract", {
        multipart: {
          aiConsent: "true",
          resume: { name: file.name, mimeType: file.type, buffer: fs.readFileSync(path.join(fixtureDir, file.name)) },
        },
        timeout: 60000,
      });
      const data = await response.json();
      assert.equal(response.status(), 200, `${file.name}: ${data.code || data.error || response.status()}`);
      assert.equal(data.ok, true);
      assert.equal(data.extractionMeta?.ocrUsed, file.ocr, `${file.name}: wrong OCR flag`);
      assert.ok(Array.isArray(data.reviewCandidates) && data.reviewCandidates.length > 0, `${file.name}: no review candidates`);
      assert.ok(data.structured?.education?.some((entry: { institution?: string }) => /Example University/i.test(entry.institution || "")), `${file.name}: no education`);
      if (file.name === "synthetic_native_cv.pdf" || file.name === "synthetic_table_cv.docx") {
        assert.equal(data.discoveredProfiles?.github, "https://github.com/alexexample", `${file.name}: GitHub link missing`);
        assert.equal(data.discoveredProfiles?.linkedin, "https://linkedin.com/in/alexexample", `${file.name}: LinkedIn link missing`);
      }
      if (file.name === "synthetic_vector_cv.pdf") {
        reviewedClaim = { ...data.reviewCandidates[0], documentId: data.documentId, corrected: false };
      }
      console.log(`${file.name}: HTTP 200; OCR=${data.extractionMeta.ocrUsed}; ${data.reviewCandidates.length} review candidates.`);
    }

    const ownDraft = await student.get("/api/onboarding-v2");
    const otherDraft = await otherStudent.get("/api/onboarding-v2");
    assert.equal((await ownDraft.json()).authenticated, true, "Upload session missing");
    assert.equal((await otherDraft.json()).authenticated, false, "Another guest inherited the upload session");
    console.log("Separate guest request contexts remained isolated.");

    const beforeSession = await (await student.get("/api/auth/session")).json();
    const email = `synthetic-audit-${Date.now()}@example.test`;
    const upgrade = await student.put("/api/onboarding-v2", {
      data: { version: 2, name: "Alex Morgan", role: "student", email, password: "SyntheticPass123!" },
    });
    assert.equal(upgrade.status(), 200, `Guest upgrade failed: ${(await upgrade.json()).error || ""}`);
    const afterSession = await (await student.get("/api/auth/session")).json();
    assert.equal(afterSession.person.id, beforeSession.person.id, "Upgrade changed person ownership");
    assert.equal(afterSession.user.email, email);

    const otherStart = await otherStudent.put("/api/onboarding-v2", { data: { version: 2, name: "Other Student", role: "student" } });
    assert.equal(otherStart.status(), 200);
    const otherBefore = await (await otherStudent.get("/api/auth/session")).json();
    const collision = await otherStudent.put("/api/onboarding-v2", {
      data: { version: 2, name: "Other Student", role: "student", email, password: "SyntheticPass123!" },
    });
    assert.equal(collision.status(), 409, "Existing email should require explicit sign in");
    const otherAfter = await (await otherStudent.get("/api/auth/session")).json();
    assert.equal(otherAfter.person.id, otherBefore.person.id, "Existing-email attempt switched ownership");
    assert.notEqual(otherAfter.person.id, afterSession.person.id);

    assert.ok(reviewedClaim, "Missing source backed review claim");
    const completion = await student.post("/api/onboarding-v2", {
      data: {
        version: 2, name: "Alex Morgan", role: "student", email, password: "SyntheticPass123!",
        resumeReviewed: [reviewedClaim],
        education: [{ institution: "Unconfirmed University", degree: "MSc", status: "candidate" }],
        experiences: [{ company: "Unconfirmed Lab", role: "Researcher", status: "candidate" }],
        achievements: [{ title: "Unconfirmed Prize", category: "award", status: "candidate" }],
      },
    });
    assert.equal(completion.status(), 200, `Completion failed: ${(await completion.json()).error || ""}`);
    const person360Response = await student.get("/api/student/person-360");
    assert.equal(person360Response.status(), 200);
    const person360 = await person360Response.json();
    const evidenceText = JSON.stringify(person360.evidence || []);
    assert.equal(evidenceText.includes("Unconfirmed University"), false);
    assert.equal(evidenceText.includes("Unconfirmed Lab"), false);
    assert.equal(evidenceText.includes("Unconfirmed Prize"), false);
    assert.equal(person360.person.id, beforeSession.person.id);
    console.log("Guest upgrade kept the same person; existing-email collision stayed isolated; reviewed claim saved; pending records stayed out of Person 360.");
  } finally {
    await student.dispose();
    await otherStudent.dispose();
    await pollOnly.dispose();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
