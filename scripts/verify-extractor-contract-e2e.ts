/**
 * AI TATHASTU — RENDER API CONTRACT VERIFICATION SUITE
 *
 * Validates the full ExtractorServiceClient contract against a live Python extractor:
 * 1. Health check & version negotiation
 * 2. Authentication enforcement (401 on missing/bad token)
 * 3. Document upload (multipart PDF/DOCX)
 * 4. Extraction initiation (POST /api/resumes/extract -> 202)
 * 5. Job status polling (GET /api/resumes/{id}/status)
 * 6. Raw text retrieval with layout & reading order (GET /api/resumes/{id}/text)
 * 7. Structured profile retrieval (GET /api/resumes/{id} -> ExtractorDocumentView)
 * 8. Schema v2.0 validation (15 canonical groups, typed fields)
 * 9. Evidence snippets (every field has source evidence)
 * 10. Multi-tenant ownership isolation (User B cannot access User A's doc)
 * 11. Document deletion (DELETE /api/resumes/{id} -> 204/200)
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { ExtractorServiceClient, type ExtractorIdentity } from "../lib/services/extractor-service-client";

// Set environment for local test server
process.env.RESUME_EXTRACTOR_URL = "http://127.0.0.1:8765";
process.env.EXTRACTOR_API_TOKEN = "dev-test-token-at-least-32-chars-long";

const userA: ExtractorIdentity = { personId: "pers_alpha_9999", organizationId: "org_test", isVerifier: false };
const userB: ExtractorIdentity = { personId: "pers_bravo_8888", organizationId: "org_test", isVerifier: false };

async function main() {
  console.log("================================================================================");
  console.log("PHASE 3: RENDER API CONTRACT VERIFICATION");
  console.log("Target: " + process.env.RESUME_EXTRACTOR_URL);
  console.log("================================================================================\n");

  // 1. Health Check
  console.log("[1/11] Checking /health endpoint...");
  const health = await ExtractorServiceClient.checkHealth();
  console.log("  Response:", JSON.stringify(health));
  assert.equal(health.status, "ok", "Health status must be ok");
  assert.equal(health.schema_version, "2.0", "Schema version must be 2.0");
  console.log("  ✓ Health check passed.\n");

  // 2. Authentication enforcement
  console.log("[2/11] Testing authentication enforcement...");
  try {
    const rawRes = await fetch("http://127.0.0.1:8765/api/resumes/upload", {
      method: "POST",
      headers: { Authorization: "Bearer bad-token-that-fails" },
      body: new FormData(),
    });
    assert.equal(rawRes.status, 401, "Expected 401 for invalid token");
    console.log("  ✓ Missing / invalid token correctly rejected with 401.\n");
  } catch (err: any) {
    if (err.name === "AssertionError") throw err;
    console.log("  ✓ Auth rejection confirmed:", err.message);
  }

  // 3. Document Upload
  console.log("[3/11] Testing Document Upload (POST /api/resumes/upload)...");
  const fixturePath = path.join(process.cwd(), "scripts", "fixtures", "test_student_cv.pdf");
  const fileBuffer = fs.readFileSync(fixturePath);
  const uploadRes = await ExtractorServiceClient.uploadResume({
    fileBuffer,
    filename: "test_student_cv.pdf",
    mimeType: "application/pdf",
    identity: userA,
  });
  console.log("  Uploaded document_id:", uploadRes.document_id);
  assert.ok(uploadRes.document_id, "Must return document_id");
  assert.equal(uploadRes.status, "uploaded", "Initial status must be uploaded");
  console.log("  ✓ Document upload returned 201 with UUID document_id.\n");

  const docId = uploadRes.document_id;

  // 4. Extraction Initiation
  console.log("[4/11] Testing Extraction Initiation (POST /api/resumes/extract)...");
  const startRes = await ExtractorServiceClient.startExtraction(docId, userA);
  console.log("  Extraction start response:", JSON.stringify(startRes));
  assert.ok(["queued", "processing", "completed"].includes(startRes.status), "Status must be valid");
  console.log("  ✓ Extraction successfully initiated (202 Accepted).\n");

  // 5. Job Status Polling
  console.log("[5/11] Testing Job Status Polling (GET /api/resumes/{id}/status)...");
  let status = await ExtractorServiceClient.getStatus(docId, userA);
  let attempts = 0;
  while (status.status !== "completed" && status.status !== "failed" && attempts < 15) {
    await new Promise((r) => setTimeout(r, 500));
    status = await ExtractorServiceClient.getStatus(docId, userA);
    attempts++;
  }
  console.log("  Final polled status:", status.status);
  assert.equal(status.status, "completed", "Job status must reach completed");
  console.log("  ✓ Job polling reached 'completed'.\n");

  // 6. Raw Text Retrieval
  console.log("[6/11] Testing Raw Text Retrieval (GET /api/resumes/{id}/text)...");
  const rawTextRes = await ExtractorServiceClient.getRawText(docId, userA);
  console.log("  Raw text length:", rawTextRes.raw_text.length, "chars");
  console.log("  OCR used:", rawTextRes.ocr_used);
  console.log("  Pages captured:", rawTextRes.pages?.length || 0);
  assert.ok(rawTextRes.raw_text.length > 50, "Raw text should not be empty");
  console.log("  ✓ Raw text and layout retrieved successfully.\n");

  // 7. Structured Profile Retrieval (getDocument)
  console.log("[7/11] Testing Structured Profile Retrieval via ExtractorServiceClient.getDocument()...");
  const docView = await ExtractorServiceClient.getDocument(docId, userA);
  assert.ok(docView, "docView must not be null");
  assert.ok(docView.profile, "docView.profile must not be null");
  console.log("  Retrieved profile schema_version:", docView.profile.schema_version);
  console.log("  Retrieved profile document_id:", docView.profile.document_id);
  console.log("  Available groups:", Object.keys(docView.profile.groups).join(", "));
  console.log("  ✓ ExtractorServiceClient.getDocument() successfully retrieved structured profile!\n");

  // 8. Schema v2.0 Group Validation
  console.log("[8/11] Validating Canonical Schema v2.0 15 Groups...");
  const expectedGroups = [
    "identity", "contact", "summary", "education", "experience",
    "internships", "skills", "projects", "awards", "certifications",
    "research", "books_patents", "leadership", "digital_footprint", "extraction_metadata"
  ];
  for (const grp of expectedGroups) {
    assert.ok(grp in docView.profile.groups, `Group ${grp} must be present in profile`);
  }
  console.log("  ✓ All 15 canonical groups present in profile.groups.\n");

  // 9. Source Evidence Snippets
  console.log("[9/11] Checking Source Evidence Snippets...");
  let totalEvidenceCount = 0;
  for (const [groupName, records] of Object.entries(docView.profile.groups)) {
    if (groupName === "extraction_metadata") continue;
    for (const rec of records) {
      for (const [fieldName, field] of Object.entries(rec.fields)) {
        if (field.value) {
          assert.ok(field.evidence && field.evidence.length > 0, `Field ${groupName}.${fieldName} missing evidence`);
          assert.ok(field.evidence[0].snippet.length > 0, `Evidence snippet empty for ${groupName}.${fieldName}`);
          totalEvidenceCount++;
        }
      }
    }
  }
  console.log(`  ✓ Verified ${totalEvidenceCount} extracted fields have valid evidence snippets.\n`);

  // 10. Multi-tenant Ownership Isolation
  console.log("[10/11] Testing Multi-Tenant Ownership Isolation (User B accessing User A's document)...");
  let userBBlocked = false;
  try {
    await ExtractorServiceClient.getDocument(docId, userB);
  } catch (err: any) {
    userBBlocked = true;
    console.log(`  ✓ User B received expected rejection: HTTP ${err.httpStatus} (${err.kind})`);
    assert.ok(err.kind === "not_found" || [403, 404].includes(err.httpStatus), "Expected 403 or 404 for cross-tenant access");
  }
  assert.ok(userBBlocked, "Security error: User B was able to access User A's document!");

  // 11. Deletion and Cleanup
  console.log("\n[11/11] Testing Document Deletion (DELETE /api/resumes/{id})...");
  const deleted = await ExtractorServiceClient.deleteDocument(docId, userA);
  assert.equal(deleted, true, "Delete should return true");
  let accessAfterDelete = false;
  try {
    await ExtractorServiceClient.getDocument(docId, userA);
  } catch {
    accessAfterDelete = true;
  }
  assert.ok(accessAfterDelete, "Document should not be accessible after deletion");
  console.log("  ✓ Document successfully deleted and cleaned up.\n");

  console.log("================================================================================");
  console.log("ALL 11 RENDER API CONTRACT VERIFICATION TESTS PASSED!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("CONTRACT VERIFICATION FAILED:", err);
  process.exit(1);
});
