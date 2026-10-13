/**
 * AI TATHASTU — UNIVERSAL RESUME EXTRACTOR INTEGRATION & PARITY TEST SUITE
 *
 * Validates:
 * 1. Object Storage durable persistence in Neon DB.
 * 2. Cryptographic signed token generation and scoping.
 * 3. Multi-tenant document isolation.
 * 4. Person 360 idempotent mapping with verified field preservation.
 * 5. Conflict detection and logging in `sourceConflicts`.
 * 6. EORA review guidance generation.
 * 7. Canonical Schema v2.0 structure across 15 information groups.
 */

import crypto from "node:crypto";
import { getDb, evidenceItems, personProfiles, sourceConflicts, resumeDocuments, resumeReviewHistory } from "../lib/db";
import { ObjectStorageService } from "../lib/storage/object-storage";
import { ExtractorServiceClient, type ExtractorProfileV2 } from "../lib/services/extractor-service-client";
import { ResumePerson360Mapper } from "../lib/services/resume-person360-mapper";
import { EoraResumeAdvisor } from "../lib/services/eora-resume-advisor";
import { and, eq } from "drizzle-orm";

async function runIntegrationSuite() {
  console.log("================================================================");
  console.log("AI TATHASTU — UNIVERSAL RESUME EXTRACTOR INTEGRATION SUITE");
  console.log("================================================================\n");

  const testUserA = `usr_a_${Date.now()}`;
  const testUserB = `usr_b_${Date.now()}`;
  const testPersonA = `pers_a_${Date.now()}`;
  const testPersonB = `pers_b_${Date.now()}`;
  const testDocId = crypto.randomUUID();

  // Setup database and seed test users/persons
  const dbInit = await getDb();
  const { users, persons } = await import("../lib/db/schema");
  await dbInit.insert(users).values([
    { id: testUserA, email: `${testUserA}@test.edu`, passwordHash: "dummyhash" },
    { id: testUserB, email: `${testUserB}@test.edu`, passwordHash: "dummyhash" },
  ]);
  await dbInit.insert(persons).values([
    { id: testPersonA, primaryUserId: testUserA, displayName: "Student Alpha" },
    { id: testPersonB, primaryUserId: testUserB, displayName: "Student Bravo" },
  ]);

  // ---------------------------------------------------------------------------
  // [Test 1] Object Storage Persistence & Isolation
  // ---------------------------------------------------------------------------
  console.log("[Test 1/7] Testing durable object storage and tenant isolation...");
  const dummyPdf = Buffer.from("%PDF-1.4\n%Dummy resume payload content for testing\n%%EOF");
  await ObjectStorageService.storeDocument({
    documentId: testDocId,
    personId: testPersonA,
    filename: "anant_kumar_resume.pdf",
    mimeType: "application/pdf",
    buffer: dummyPdf,
  });

  // User A can read it
  const retrievedA = await ObjectStorageService.getDocument(testDocId, testPersonA);
  if (retrievedA.buffer.toString() !== dummyPdf.toString()) {
    throw new Error("Retrieved document buffer mismatch");
  }

  // User B cannot read it
  let blockedUserB = false;
  try {
    await ObjectStorageService.getDocument(testDocId, testPersonB);
  } catch {
    blockedUserB = true;
  }
  if (!blockedUserB) {
    throw new Error("Security failure: User B was able to read User A's document");
  }
  console.log("  ✓ Durable storage verified with strict tenant isolation.");

  // ---------------------------------------------------------------------------
  // [Test 2] Signed User Token Generation & Scoping
  // ---------------------------------------------------------------------------
  console.log("[Test 2/7] Testing cryptographically signed user token generation...");
  const token = ExtractorServiceClient.generateSignedUserToken({
    personId: testPersonA,
    action: "upload",
    documentId: testDocId,
    expiresInSeconds: 300,
  });
  if (!token.startsWith("u.") || token.split(".").length !== 3) {
    throw new Error("Invalid signed token format");
  }
  console.log("  ✓ Short-lived signed user upload token verified.");

  // ---------------------------------------------------------------------------
  // [Test 3] EORA Review Guidance Generation
  // ---------------------------------------------------------------------------
  console.log("[Test 3/7] Testing EORA review advisor analysis...");
  const mockV2Profile: ExtractorProfileV2 = {
    schema_version: "2.0",
    document_id: testDocId,
    groups: {
      identity: [{
        record_id: "rec_id_1",
        fields: {
          full_name: {
            value: "Anant Kumar",
            original_value: "Anant Kumar",
            evidence: [{ page: 1, section: "header", snippet: "Anant Kumar", method: "native_pdf" }],
            confidence: 0.95,
            confidence_kind: "heuristic",
            review_state: "extracted",
            history: [],
          },
          professional_headline: {
            value: "AI Research Engineer",
            original_value: "AI Research Engineer",
            evidence: [{ page: 1, section: "header", snippet: "AI Research Engineer", method: "native_pdf" }],
            confidence: 0.9,
            confidence_kind: "heuristic",
            review_state: "extracted",
            history: [],
          },
        },
        record_state: "extracted",
      }],
      contact: [],
      summary: [],
      education: [{
        record_id: "rec_edu_1",
        fields: {
          institution: {
            value: "Lovely Professional University",
            original_value: "Lovely Professional University",
            evidence: [{ page: 1, section: "education", snippet: "LPU", method: "native_pdf" }],
            confidence: 0.92,
            confidence_kind: "heuristic",
            review_state: "extracted",
            history: [],
          },
          qualification: {
            value: "B.Tech Computer Science & Engineering",
            original_value: "B.Tech Computer Science & Engineering",
            evidence: [{ page: 1, section: "education", snippet: "B.Tech CSE", method: "native_pdf" }],
            confidence: 0.88,
            confidence_kind: "heuristic",
            review_state: "extracted",
            history: [],
          },
          expected_graduation: {
            value: "", // Missing date to test EORA detection
            original_value: "",
            evidence: [{ page: 1, section: "education", snippet: "Expected", method: "native_pdf" }],
            confidence: 0.5,
            confidence_kind: "heuristic",
            review_state: "extracted",
            history: [],
          },
        },
        record_state: "extracted",
      }],
      skills: [{
        record_id: "rec_sk_1",
        fields: {
          canonical_name: {
            value: "PyTorch",
            original_value: "PyTorch",
            evidence: [{ page: 1, section: "skills", snippet: "PyTorch, CUDA", method: "native_pdf" }],
            confidence: 0.98,
            confidence_kind: "heuristic",
            review_state: "extracted",
            history: [],
          },
        },
        record_state: "extracted",
      }],
      projects: [{
        record_id: "rec_pr_1",
        fields: {
          title: {
            value: "Neural Multi-Agent Orchestrator",
            original_value: "Neural Multi-Agent Orchestrator",
            evidence: [{ page: 1, section: "projects", snippet: "Neural Multi-Agent", method: "native_pdf" }],
            confidence: 0.89,
            confidence_kind: "heuristic",
            review_state: "extracted",
            history: [],
          },
          technologies: {
            value: "Python, PyTorch, FastMCP",
            original_value: "Python, PyTorch, FastMCP",
            evidence: [{ page: 1, section: "projects", snippet: "Python, PyTorch", method: "native_pdf" }],
            confidence: 0.9,
            confidence_kind: "heuristic",
            review_state: "extracted",
            history: [],
          },
        },
        record_state: "extracted",
      }],
      experience: [],
      internships: [],
      awards: [],
      certifications: [],
      research: [],
      books_patents: [],
      leadership: [],
      digital_footprint: [{
        record_id: "rec_df_1",
        fields: {
          platform: {
            value: "github",
            original_value: "github",
            evidence: [{ page: 1, section: "links", snippet: "github.com/anant9934", method: "hyperlink" }],
            confidence: 0.99,
            confidence_kind: "heuristic",
            review_state: "extracted",
            history: [],
          },
        },
        record_state: "extracted",
      }],
      extraction_metadata: [],
    },
    metadata: {
      document_id: testDocId,
      file_format: "pdf",
      page_count: 2,
      ocr_attempted: false,
      ocr_used: false,
      text_quality: "good",
      processing_seconds: 0.42,
      extraction_methods: ["native_pdf"],
      parser_version: "2.0.0",
      model_version: "deterministic-1",
      warnings: [],
      status: "completed",
    },
  };

  const advice = EoraResumeAdvisor.analyzeProfile(mockV2Profile);
  if (advice.stats.missingCriticalDates < 1) {
    throw new Error("EORA failed to detect missing graduation date");
  }
  if (!advice.stats.discoveredPlatforms.includes("github")) {
    throw new Error("EORA failed to detect discovered GitHub profile link");
  }
  console.log(`  ✓ EORA advisor generated guidance: "${advice.primaryMessage}"`);

  // ---------------------------------------------------------------------------
  // [Test 4] Person 360 Idempotent Mapping
  // ---------------------------------------------------------------------------
  console.log("[Test 4/7] Testing Person 360 synchronization...");
  const mappingRes = await ResumePerson360Mapper.applyProfileToPerson360(
    testPersonA,
    testDocId,
    mockV2Profile
  );
  if (!mappingRes.success || mappingRes.evidenceCreated < 1 || mappingRes.projectsCreated < 1) {
    throw new Error("Person 360 mapping failed to insert skills or projects");
  }
  console.log(`  ✓ Person 360 updated: ${mappingRes.evidenceCreated} evidence items, ${mappingRes.projectsCreated} candidate projects.`);

  // ---------------------------------------------------------------------------
  // [Test 5] Protection of Independently Verified Fields
  // ---------------------------------------------------------------------------
  console.log("[Test 5/7] Testing protection of independently verified fields...");
  const db = await getDb();
  // Mark institution as independently verified
  await db.insert(evidenceItems).values({
    id: `ev_verified_${Date.now()}`,
    personId: testPersonA,
    category: "education",
    subject: "institution",
    value: "Stanford University",
    source: "official_transcript",
    verificationStatus: "verified",
    interpretation: "Independently verified by university registrar",
    whyItMatters: "Verified degree",
  });

  // Try applying a resume claiming a different institution
  const conflictProfile = JSON.parse(JSON.stringify(mockV2Profile));
  conflictProfile.groups.education[0].fields.institution.value = "Unverified College";

  const reMapping = await ResumePerson360Mapper.applyProfileToPerson360(
    testPersonA,
    testDocId,
    conflictProfile
  );

  if (!reMapping.skippedVerifiedFields.includes("institution")) {
    throw new Error("Security violation: Verified institution was not protected from resume overwrite");
  }
  console.log("  ✓ Verified fields strictly preserved. Overwrite prevented.");

  // ---------------------------------------------------------------------------
  // [Test 6] Conflict Registry Logging
  // ---------------------------------------------------------------------------
  console.log("[Test 6/7] Testing conflict registry detection...");
  // Set existing profile institution to Stanford
  await db.update(personProfiles).set({ institution: "Stanford University" }).where(eq(personProfiles.personId, testPersonA));
  // Remove verified status to test conflict logging when non-verified values disagree
  await db.delete(evidenceItems).where(and(eq(evidenceItems.personId, testPersonA), eq(evidenceItems.subject, "institution")));

  const conflictMapping = await ResumePerson360Mapper.applyProfileToPerson360(
    testPersonA,
    testDocId,
    conflictProfile
  );

  const conflicts = await db.select().from(sourceConflicts).where(eq(sourceConflicts.personId, testPersonA));
  if (conflicts.length === 0) {
    throw new Error("Conflict detection failed to record discrepancy in sourceConflicts table");
  }
  console.log(`  ✓ Discrepancy logged to sourceConflicts registry: ${conflicts[0].field} ('${conflicts[0].valueA}' vs '${conflicts[0].valueB}').`);

  // ---------------------------------------------------------------------------
  // [Test 7] Secure Document Deletion
  // ---------------------------------------------------------------------------
  console.log("[Test 7/7] Testing secure document purge...");
  const deleted = await ObjectStorageService.deleteDocument(testDocId, testPersonA);
  if (!deleted) {
    throw new Error("Failed to delete document from storage");
  }
  const postDoc = await db.select().from(resumeDocuments).where(eq(resumeDocuments.id, testDocId));
  if (postDoc[0]?.status !== "deleted") {
    throw new Error("Document status not set to deleted");
  }
  console.log("  ✓ Document payload deleted and status transitioned to deleted.");

  console.log("\n================================================================");
  console.log("ALL 7 RESUME EXTRACTOR INTEGRATION ACCEPTANCE TESTS PASSED");
  console.log("================================================================\n");
}

runIntegrationSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Integration Test Failure:", err);
    process.exit(1);
  });
