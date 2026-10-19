import fs from "fs";
import path from "path";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { getDb, resumeDocuments, sourceProcessingJobs, users, persons, personProfiles, evidenceItems } from "@/lib/db";
import { readDocumentText } from "@/lib/resume/document-text";
import { queueResumeUpload, processResumeJob, getResumeJobStatus, type ResumeReviewPayload } from "@/lib/services/resume-ingestion-service";
import { applyReviewDecisions, type ReviewDecision } from "@/lib/services/resume-review-decisions";
import { ResumePerson360Mapper } from "@/lib/services/resume-person360-mapper";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { sanitizeTextForModel } from "@/lib/intelligence/context-firewall";
import type { ExtractorProfileV2 } from "@/lib/services/extractor-service-client";

const FILES_TO_TEST = [
  { path: "resume for test/Anant-Kumar-Resume.pdf", label: "Anant-Kumar-Resume.pdf" },
  { path: "resume for test/Image_6.pdf", label: "Image_6.pdf" },
  { path: "resume for test/Image_7.pdf", label: "Image_7.pdf" },
  { path: "resume for test/myresume.pdf", label: "myresume.pdf" },
];

const PHONE_REGEX = /\b[6-9]\d{9}\b|\+\d{1,3}[\s\-.]?\d{3,14}|\(\d{3}\)[\s\-.]?\d{3}[\s\-.]?\d{4}/;

interface FileEvaluation {
  filename: string;
  pdfType: "native text" | "scanned";
  sizeBytes: number;
  pageCount: number;
  textLayerChars: number;
  extractionPath: string;
  uploadStatus: string;
  processingResult: string;
  processingTimeMs: number;
  extractedClaims: {
    fullName?: string | null;
    email?: string | null;
    mobile?: string | null;
    location?: string | null;
    educationCount: number;
    educationSample: any[];
    experienceCount: number;
    experienceSample: any[];
    skillsCount: number;
    skillsSample: string[];
    projectsCount: number;
    projectsSample: any[];
    certificationsCount: number;
    linksCount: number;
    linksSample: any[];
  };
  reviewUICandidatesCount: number;
  reviewDecisionResult: string;
  persistenceAndReloadResult: string;
  persistedEntities: {
    resumeDocStatus: string;
    personProfileName?: string | null;
    evidenceItemsCount: number;
  };
  candidateAccounting?: {
    totalCandidates: number;
    profileCandidates: number;
    domainCandidates: number;
    confirmed: number;
    rejected: number;
    pending: number;
    invariantHolds: boolean;
  };
  phonePrivacyResult: {
    sourceHasPhone: boolean;
    extractedPhoneLocal: boolean;
    phoneRedactedForModel: boolean;
    phoneLeakedToLogsOrLLM: boolean;
    verdict: string;
  };
  defectsFound: string[];
  finalStatus: "PASS" | "FAIL" | "BLOCKED";
}

async function runAcceptanceTest() {
  console.log("════════════════════════════════════════════════════════════════════════");
  console.log("AI TATHASTU — FOUR-RESUME REAL-WORLD ACCEPTANCE TEST SUITE");
  console.log("════════════════════════════════════════════════════════════════════════\n");

  const db = await getDb();

  // Create isolated test user & person
  const testUserId = `usr_acc_${Date.now()}`;
  const testPersonId = `pers_acc_${Date.now()}`;
  await db.insert(users).values({
    id: testUserId,
    email: `${testUserId}@acceptance-test.internal`,
    passwordHash: "dummyhash",
  });
  await db.insert(persons).values({
    id: testPersonId,
    primaryUserId: testUserId,
    displayName: "QA Acceptance Runner",
  });
  console.log(`Created test harness identity: User=${testUserId}, Person=${testPersonId}\n`);

  const results: FileEvaluation[] = [];

  for (const fileInfo of FILES_TO_TEST) {
    console.log(`────────────────────────────────────────────────────────────────────────`);
    console.log(`Testing File: ${fileInfo.label}`);
    console.log(`────────────────────────────────────────────────────────────────────────`);

    const fullPath = path.resolve(process.cwd(), fileInfo.path);
    if (!fs.existsSync(fullPath)) {
      results.push({
        filename: fileInfo.label,
        pdfType: "native text",
        sizeBytes: 0,
        pageCount: 0,
        textLayerChars: 0,
        extractionPath: "N/A",
        uploadStatus: "FILE_NOT_FOUND",
        processingResult: "FAILED",
        processingTimeMs: 0,
        extractedClaims: { educationCount: 0, educationSample: [], experienceCount: 0, experienceSample: [], skillsCount: 0, skillsSample: [], projectsCount: 0, projectsSample: [], certificationsCount: 0, linksCount: 0, linksSample: [] },
        reviewUICandidatesCount: 0,
        reviewDecisionResult: "FAILED",
        persistenceAndReloadResult: "FAILED",
        persistedEntities: { resumeDocStatus: "missing", evidenceItemsCount: 0 },
        phonePrivacyResult: { sourceHasPhone: false, extractedPhoneLocal: false, phoneRedactedForModel: true, phoneLeakedToLogsOrLLM: false, verdict: "N/A" },
        defectsFound: ["File does not exist at specified path"],
        finalStatus: "FAIL",
      });
      continue;
    }

    const fileBuf = fs.readFileSync(fullPath);
    const sizeBytes = fileBuf.length;

    // Phase 1: Input Analysis
    let parsedInput;
    try {
      parsedInput = await readDocumentText(fileBuf, "pdf");
    } catch (err) {
      console.error(`  [Phase 1] Failed to parse PDF: ${err}`);
      results.push({
        filename: fileInfo.label,
        pdfType: "native text",
        sizeBytes,
        pageCount: 0,
        textLayerChars: 0,
        extractionPath: "N/A",
        uploadStatus: "PARSE_ERROR",
        processingResult: "FAILED",
        processingTimeMs: 0,
        extractedClaims: { educationCount: 0, educationSample: [], experienceCount: 0, experienceSample: [], skillsCount: 0, skillsSample: [], projectsCount: 0, projectsSample: [], certificationsCount: 0, linksCount: 0, linksSample: [] },
        reviewUICandidatesCount: 0,
        reviewDecisionResult: "FAILED",
        persistenceAndReloadResult: "FAILED",
        persistedEntities: { resumeDocStatus: "error", evidenceItemsCount: 0 },
        phonePrivacyResult: { sourceHasPhone: false, extractedPhoneLocal: false, phoneRedactedForModel: true, phoneLeakedToLogsOrLLM: false, verdict: "N/A" },
        defectsFound: [`PDF parsing failed: ${err instanceof Error ? err.message : String(err)}`],
        finalStatus: "FAIL",
      });
      continue;
    }

    const textLayerChars = parsedInput.text.replace(/\s/g, "").length;
    const pageCount = parsedInput.pageCount || 1;
    const isNativeText = textLayerChars >= 40;
    const pdfType: "native text" | "scanned" = isNativeText ? "native text" : "scanned";

    console.log(`  Phase 1 Input Verification:`);
    console.log(`    Size: ${(sizeBytes / 1024).toFixed(1)} KB | Pages: ${pageCount}`);
    console.log(`    Native text layer characters: ${textLayerChars}`);
    console.log(`    Detected Type: ${pdfType.toUpperCase()} (Requires OCR: ${!isNativeText})`);

    const defects: string[] = [];

    // Phase 2: Upload & Process through the real application pipeline
    const startTime = Date.now();
    let uploadRes;
    try {
      uploadRes = await queueResumeUpload({
        personId: testPersonId,
        filename: fileInfo.label,
        mimeType: "application/pdf",
        bytes: fileBuf,
        aiConsent: true,
      });
      console.log(`  [Phase 2] Upload Queued: DocId=${uploadRes.documentId}, JobId=${uploadRes.jobId}`);
    } catch (err) {
      console.error(`  [Phase 2] Upload queueing failed:`, err);
      results.push({
        filename: fileInfo.label,
        pdfType,
        sizeBytes,
        pageCount,
        textLayerChars,
        extractionPath: isNativeText ? "native-pdf" : "extractor-ocr",
        uploadStatus: "QUEUE_FAILED",
        processingResult: "FAILED",
        processingTimeMs: Date.now() - startTime,
        extractedClaims: { educationCount: 0, educationSample: [], experienceCount: 0, experienceSample: [], skillsCount: 0, skillsSample: [], projectsCount: 0, projectsSample: [], certificationsCount: 0, linksCount: 0, linksSample: [] },
        reviewUICandidatesCount: 0,
        reviewDecisionResult: "FAILED",
        persistenceAndReloadResult: "FAILED",
        persistedEntities: { resumeDocStatus: "failed", evidenceItemsCount: 0 },
        phonePrivacyResult: { sourceHasPhone: false, extractedPhoneLocal: false, phoneRedactedForModel: true, phoneLeakedToLogsOrLLM: false, verdict: "N/A" },
        defectsFound: [`Queueing failed: ${err instanceof Error ? err.message : String(err)}`],
        finalStatus: "FAIL",
      });
      continue;
    }

    // Process Job
    console.log(`  [Phase 2] Processing Job ${uploadRes.jobId}...`);
    let terminalJob = await processResumeJob(uploadRes.jobId, testPersonId);

    // If job needs OCR polling (async Render task), poll until review_ready
    let pollCount = 0;
    while (terminalJob && terminalJob.status === "processing" && pollCount < 40) {
      pollCount++;
      await new Promise((r) => setTimeout(r, 2000));
      terminalJob = await processResumeJob(uploadRes.jobId, testPersonId);
      console.log(`    Polling job (${pollCount * 2}s): status=${terminalJob?.status}, stage=${terminalJob?.stage}`);
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`  [Phase 2] Job completed in ${(processingTimeMs / 1000).toFixed(1)}s with status: ${terminalJob?.status}`);

    if (terminalJob?.status !== "review_ready" && terminalJob?.status !== "completed") {
      defects.push(`Job failed to reach review_ready. Status=${terminalJob?.status}, Error=${terminalJob?.errorMessage || terminalJob?.errorCode}`);
    }

    // Read status and review payload
    const statusRes = await getResumeJobStatus(uploadRes.documentId, testPersonId, uploadRes.jobId);
    const reviewPayload = statusRes.result;
    const via = (terminalJob?.metadata as any)?.via || (reviewPayload?.extractionMeta?.via as string) || (isNativeText ? "native-pdf" : "extractor-ocr");

    console.log(`  [Phase 2] Extraction Path Used: ${via}`);

    // Read stored resume document
    const [docRow] = await db
      .select()
      .from(resumeDocuments)
      .where(and(eq(resumeDocuments.id, uploadRes.documentId), eq(resumeDocuments.personId, testPersonId)));

    const docMeta = (docRow?.metadata as any) || {};
    const extractedProf = (docRow?.extractedProfile as ExtractorProfileV2) || null;
    const structured = reviewPayload?.structured as any;

    // Inspect claims
    const fullName = reviewPayload?.extractedProfile ? (reviewPayload.extractedProfile as any).fullName : null;
    const email = reviewPayload?.extractedProfile ? (reviewPayload.extractedProfile as any).email : null;
    const mobile = reviewPayload?.extractedProfile ? (reviewPayload.extractedProfile as any).mobile : null;
    const location = reviewPayload?.extractedProfile ? (reviewPayload.extractedProfile as any).location : null;

    const education = structured?.education || [];
    const experience = structured?.experience || [];
    const skills = structured?.skills || [];
    const projects = structured?.projects || [];
    const certifications = structured?.certifications || [];
    const links = (reviewPayload?.links as any[]) || [];

    // Redaction helpers for privacy compliance
    const redactEmail = (e: string | null | undefined) => (!e ? "(none)" : e.replace(/^([^@]{2})[^@]*(@.*)$/, "$1***$2"));
    const redactPhone = (p: string | null | undefined) => (!p ? "(none)" : "[PHONE_REDACTED]");
    const redactLocation = (l: string | null | undefined) => (!l ? "(none)" : l.includes(",") ? l.split(",").map(s => s.trim()).slice(-2).join(", ") : "[LOCATION_REDACTED]");

    console.log(`  [Phase 2 Claims Inspection]:`);
    console.log(`    Full Name:   ${fullName || "(none)"}`);
    console.log(`    Email:       ${redactEmail(email)}`);
    console.log(`    Mobile:      ${mobile ? "PRESENT (Stored locally, [PHONE_REDACTED])" : "(none)"}`);
    console.log(`    Location:    ${redactLocation(location)}`);
    console.log(`    Education:   ${education.length} entries`);
    education.forEach((e: any, idx: number) => {
      console.log(`      [${idx}] ${e.institution} | ${e.degree || "(no degree)"} | ${e.startDate || ""}-${e.endDate || ""}`);
    });
    console.log(`    Experience:  ${experience.length} entries`);
    experience.forEach((e: any, idx: number) => {
      console.log(`      [${idx}] ${e.company} | ${e.role} | ${e.startDate || ""}-${e.endDate || ""}`);
    });
    console.log(`    Skills:      ${skills.length} skills (${skills.map((s: any) => typeof s === "string" ? s : s.name).join(", ")})`);
    console.log(`    Projects:    ${projects.length} entries`);
    projects.forEach((p: any, idx: number) => {
      console.log(`      [${idx}] ${p.name || p.title}`);
    });
    console.log(`    Links:       ${links.length} entries`);
    links.forEach((l: any) => {
      console.log(`      ${l.type}: ${l.url}`);
    });

    // Phase 3: Phone Privacy Verification
    // Check if phone was in the document text
    const fullDocText = `${parsedInput.text} ${reviewPayload?.structured ? JSON.stringify(reviewPayload.structured) : ""}`;
    const sourceHasPhone = PHONE_REGEX.test(parsedInput.text) || (mobile !== null && mobile !== undefined);
    
    // Check redaction of raw text before model
    const sanitizedForModel = sanitizeTextForModel(parsedInput.text);
    const phoneInSanitized = PHONE_REGEX.test(sanitizedForModel);
    
    // Check if phone was leaked into non-mobile review candidates
    const phoneInReviewClaims = reviewPayload?.reviewCandidates?.some(
      (c) => c.category !== "profile" && c.field !== "mobile" && PHONE_REGEX.test(c.value)
    ) ?? false;

    const phonePrivacyVerdict = (!phoneInSanitized && !phoneInReviewClaims) ? "VERIFIED_SECURE" : "LEAK_DETECTED";
    if (phoneInSanitized) defects.push("Phone number regex matched after sanitizeTextForModel");
    if (phoneInReviewClaims) defects.push("Phone number leaked into non-mobile review candidate values");

    console.log(`  [Phase 3 Phone Privacy]:`);
    console.log(`    Source contains phone: ${sourceHasPhone}`);
    console.log(`    Phone captured deterministically/locally: ${Boolean(mobile)}`);
    console.log(`    Phone redacted for model: ${!phoneInSanitized}`);
    console.log(`    Privacy Verdict: ${phonePrivacyVerdict}`);

    // Phase 2 (cont.): Review UI & Apply Verification
    const reviewCandidates = reviewPayload?.reviewCandidates || [];
    const profileCandidatesCount = reviewCandidates.filter((c) => c.category === "profile").length;
    const domainCandidatesCount = reviewCandidates.filter((c) => c.category !== "profile").length;
    const breakdown: Record<string, number> = {};
    for (const c of reviewCandidates) {
      breakdown[c.category] = (breakdown[c.category] || 0) + 1;
    }
    console.log(`  [Phase 2 Review UI & Apply]:`);
    console.log(`    Total Candidates Presented: ${reviewCandidates.length}`);
    console.log(`    Profile Candidates (Onboarding Draft only): ${profileCandidatesCount}`);
    console.log(`    Domain Entity Candidates (Person 360 Reviewable): ${domainCandidatesCount}`);
    console.log(`    Category Breakdown:`, JSON.stringify(breakdown));

    let applySuccess = false;
    let persistedDocStatus = "unknown";
    let evidenceCount = 0;
    let personProfileName: string | null = null;
    let appliedDecisionsSummary = { confirmed: 0, rejected: 0, pending: 0, invariantHolds: true };

    if (reviewCandidates.length > 0 && extractedProf) {
      const domainCandidates = reviewCandidates.filter((c) => c.category !== "profile");
      // Build decisions confirming domain candidates
      const decisions: ReviewDecision[] = domainCandidates.map((c) => ({
        candidateId: c.candidateId,
        state: "confirmed" as const,
      }));

      const known = new Set(reviewCandidates.map((c) => c.candidateId));
      const applied = applyReviewDecisions(extractedProf, known, decisions);
      appliedDecisionsSummary = {
        confirmed: applied.confirmed,
        rejected: applied.rejected,
        pending: applied.pending,
        invariantHolds: domainCandidates.length === (applied.confirmed + applied.rejected + applied.pending),
      };

      if (!appliedDecisionsSummary.invariantHolds) {
        defects.push(
          `Candidate accounting invariant violated: ${domainCandidates.length} domain candidates !== ${applied.confirmed} confirmed + ${applied.rejected} rejected + ${applied.pending} pending`
        );
      }

      if (applied.unknown.length > 0) {
        defects.push(`applyReviewDecisions returned unknown candidates: ${applied.unknown.join(", ")}`);
      } else {
        // Persist through ResumePerson360Mapper
        try {
          await db
            .update(resumeDocuments)
            .set({ extractedProfile: applied.profile, status: "completed", updatedAt: new Date() })
            .where(and(eq(resumeDocuments.id, uploadRes.documentId), eq(resumeDocuments.personId, testPersonId)));

          const mappingResult = await ResumePerson360Mapper.applyProfileToPerson360(
            testPersonId,
            uploadRes.documentId,
            applied.profile
          );

          await SourceProcessingJobService.completeJob({
            jobId: uploadRes.jobId,
            personId: testPersonId,
            resultReference: `resume:${uploadRes.documentId}`,
            metadata: { applied: true },
          });

          // Reload persisted data from DB to verify persistence & integrity
          const [reloadedDoc] = await db
            .select()
            .from(resumeDocuments)
            .where(and(eq(resumeDocuments.id, uploadRes.documentId), eq(resumeDocuments.personId, testPersonId)));

          const [reloadedProfile] = await db
            .select()
            .from(personProfiles)
            .where(eq(personProfiles.personId, testPersonId));

          const evidenceList = await db
            .select()
            .from(evidenceItems)
            .where(eq(evidenceItems.personId, testPersonId));

          persistedDocStatus = reloadedDoc?.status || "missing";
          personProfileName = reloadedProfile?.headline || reloadedProfile?.institution || null;
          evidenceCount = evidenceList.length;
          applySuccess = persistedDocStatus === "completed" && mappingResult.success;

          console.log(`    Apply decisions: Confirmed=${applied.confirmed}, Rejected=${applied.rejected}, Pending=${applied.pending}`);
          console.log(`    Accounting Invariant: ${domainCandidates.length} Domain = ${applied.confirmed} Confirmed + ${applied.rejected} Rejected + ${applied.pending} Pending (Holds: ${appliedDecisionsSummary.invariantHolds})`);
          console.log(`    Mapper result: Success=${mappingResult.success}, EvidenceCreated=${mappingResult.evidenceCreated}, ProjectsCreated=${mappingResult.projectsCreated}`);
          console.log(`    Persistence reload verified: DocStatus=${persistedDocStatus}, PersonProfileName=${personProfileName}, EvidenceItems=${evidenceCount}`);
        } catch (err) {
          console.error(`    Apply/Persistence error:`, err);
          defects.push(`Apply/Persistence error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } else {
      defects.push("No review candidates or missing extracted profile for apply step");
    }

    // Idempotency check: repeated polling should not alter completed status or duplicate records
    const repeatedStatus = await getResumeJobStatus(uploadRes.documentId, testPersonId, uploadRes.jobId);
    if (repeatedStatus.status !== "completed") {
      defects.push(`Idempotency check failed: expected status completed, got ${repeatedStatus.status}`);
    }

    const finalStatus: "PASS" | "FAIL" | "BLOCKED" = defects.length === 0 ? "PASS" : "FAIL";

    results.push({
      filename: fileInfo.label,
      pdfType,
      sizeBytes,
      pageCount,
      textLayerChars,
      extractionPath: via,
      uploadStatus: "202_ACCEPTED",
      processingResult: terminalJob?.status || "UNKNOWN",
      processingTimeMs,
      extractedClaims: {
        fullName,
        email,
        mobile,
        location,
        educationCount: education.length,
        educationSample: education.slice(0, 2),
        experienceCount: experience.length,
        experienceSample: experience.slice(0, 2),
        skillsCount: skills.length,
        skillsSample: skills.slice(0, 5).map((s: any) => typeof s === "string" ? s : s.name),
        projectsCount: projects.length,
        projectsSample: projects.slice(0, 2),
        certificationsCount: certifications.length,
        linksCount: links.length,
        linksSample: links,
      },
      reviewUICandidatesCount: reviewCandidates.length,
      reviewDecisionResult: applySuccess ? "APPLIED_SUCCESSFULLY" : "APPLY_FAILED",
      persistenceAndReloadResult: applySuccess ? "PERSISTED_AND_RELOADED_OK" : "RELOAD_FAILED",
      persistedEntities: {
        resumeDocStatus: persistedDocStatus,
        personProfileName,
        evidenceItemsCount: evidenceCount,
      },
      candidateAccounting: {
        totalCandidates: reviewCandidates.length,
        profileCandidates: profileCandidatesCount,
        domainCandidates: domainCandidatesCount,
        confirmed: appliedDecisionsSummary.confirmed,
        rejected: appliedDecisionsSummary.rejected,
        pending: appliedDecisionsSummary.pending,
        invariantHolds: appliedDecisionsSummary.invariantHolds,
      },
      phonePrivacyResult: {
        sourceHasPhone,
        extractedPhoneLocal: Boolean(mobile),
        phoneRedactedForModel: !phoneInSanitized,
        phoneLeakedToLogsOrLLM: phoneInSanitized || phoneInReviewClaims,
        verdict: phonePrivacyVerdict,
      },
      defectsFound: defects,
      finalStatus,
    });
  }

  // Write full results to JSON
  fs.writeFileSync(
    path.join(process.cwd(), "scripts", "four_resumes_acceptance_results.json"),
    JSON.stringify(results, null, 2)
  );

  console.log("\n════════════════════════════════════════════════════════════════════════");
  console.log("ACCEPTANCE TEST SUMMARY SCORECARD");
  console.log("════════════════════════════════════════════════════════════════════════\n");
  for (const r of results) {
    console.log(`File: ${r.filename}`);
    console.log(`  Type: ${r.pdfType} | Path: ${r.extractionPath} | Time: ${(r.processingTimeMs / 1000).toFixed(1)}s`);
    console.log(`  Processing: ${r.processingResult} | Review Candidates: ${r.reviewUICandidatesCount}`);
    console.log(`  Persistence & Reload: ${r.persistenceAndReloadResult} (Evidence: ${r.persistedEntities.evidenceItemsCount})`);
    console.log(`  Phone Privacy: ${r.phonePrivacyResult.verdict}`);
    console.log(`  Defects: ${r.defectsFound.length === 0 ? "None" : r.defectsFound.join("; ")}`);
    console.log(`  Final Status: [${r.finalStatus}]\n`);
  }
}

runAcceptanceTest().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
