/**
 * AI TATHASTU — RESUME EXTRACTION API V4.2
 *
 * POST /api/resume/extract
 *
 * CRITICAL ARCHITECTURAL DECISIONS:
 * 1. STRICT ZERO-LLM RESUME EXTRACTION: No generative AI calls, no external models.
 * 2. SUB-60-SECOND PERFORMANCE BUDGET: Single-pass document parsing + deterministic engine.
 * 3. CONTENT-HASH FAST PATH: SHA-256 caching reuses completed extractions instantly (<1s).
 * 4. UNIFIED JSON CONTRACT: Always returns valid JSON with { ok, requestId }, never HTML errors.
 * 5. PERSISTENT JOB LIFECYCLE: Syncs job state to Neon so downstream screens never see stale spinners.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { extractResumeStructured } from "@/lib/services/resume-extraction-service";
import { resumeCandidates, saveResumeCandidates } from "@/lib/services/resume-review-service";
import { parseResumeDocument } from "@/lib/services/document-parser-service";
import { resumeSuggestions, resumeDiscovery } from "@/lib/resume-suggestions";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { validateDocumentSafety } from "@/lib/services/document-parser-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function makeJsonResponse(
  payload: Record<string, unknown>,
  status: number,
  requestId: string,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      ...extraHeaders,
    },
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let jobId: string | null = null;
  let personId: string | null = null;

  const fail = async (
    code: string,
    message: string,
    status: number,
    extraHeaders?: Record<string, string>
  ) => {
    if (jobId && personId) {
      await SourceProcessingJobService.failJob({
        jobId,
        personId,
        errorCode: code,
        errorMessage: message,
        status: "failed",
        canRetry: status >= 500 || status === 429,
      }).catch(() => null);
    }
    return makeJsonResponse(
      {
        ok: false,
        code,
        message,
        retryable: status >= 500 || status === 429,
        requestId,
        jobId: jobId ?? undefined,
        // Legacy error field for backward compatibility
        error: message,
      },
      status,
      requestId,
      extraHeaders
    );
  };

  try {
    if (!coreIngestionReady()) {
      return fail(
        "INGESTION_SECURITY_INCOMPLETE",
        "Resume import is unavailable because production ingestion security setup is incomplete.",
        503
      );
    }

    const authRes = await getOrCreateOnboardingAuthContext().catch(() => null);
    if (!authRes || !authRes.auth) {
      return fail(
        "UNAUTHORIZED",
        "Unable to initialize secure session for resume upload. Please refresh and try again.",
        401
      );
    }
    const auth = authRes.auth;
    personId = auth.person.id;

    // Rate limiting tied to authenticated / guest person ID
    const rl = await checkRateLimitDistributed(personId, "resume");
    if (!rl.allowed) {
      return fail(
        "RATE_LIMITED",
        "Too many resume upload requests. Please wait a minute before uploading again.",
        429,
        { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) }
      );
    }

    // --- File Reception & Validation ---
    let file: File;
    try {
      const form = await request.formData();
      const requestedJobId = form.get("jobId");
      if (typeof requestedJobId === "string" && requestedJobId.trim()) {
        const job = await SourceProcessingJobService.getJobForPerson(requestedJobId.trim(), personId);
        if (job && job.sourceId === "resume" && job.status === "running") {
          jobId = job.id;
        }
      }

      if (form.get("aiConsent") !== "true" && form.get("consent") !== "true") {
        return fail("CONSENT_REQUIRED", "Confirm that your resume may be processed.", 400);
      }

      const candidate = form.get("resume");
      if (!(candidate instanceof File)) {
        return fail("MISSING_FILE", "Choose a PDF or DOCX file first.", 400);
      }
      file = candidate;
    } catch {
      return fail(
        "FORM_RECEIVE_FAILED",
        "The file could not be received. Please try again or enter details manually.",
        400
      );
    }

    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "pdf" && extension !== "docx") {
      return fail("UNSUPPORTED_MEDIA_TYPE", "Use a PDF or DOCX file.", 415);
    }
    if (file.size === 0) {
      return fail("EMPTY_FILE", "This file is empty. Please choose another or enter details manually.", 400);
    }
    if (file.size > MAX_BYTES) {
      return fail("FILE_TOO_LARGE", "Choose a file under 5 MB, or enter details manually.", 413);
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Magic byte and encrypted-document validation
    const isPdf = bytes.subarray(0, 5).toString() === "%PDF-";
    const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes.includes(Buffer.from("[Content_Types].xml"));
    if ((extension === "pdf" && !isPdf) || (extension === "docx" && !isDocx)) {
      return fail(
        "INVALID_FILE_CONTENT",
        "The file content does not match its extension. Please choose another file.",
        415
      );
    }
    const safety = validateDocumentSafety(bytes, extension as "pdf" | "docx");
    if (safety.isEncrypted) {
      return fail("ENCRYPTED_DOCUMENT", "Remove the document password, then upload the unencrypted PDF.", 422);
    }
    if (!safety.isValid) {
      return fail("INVALID_DOCUMENT", "This document is damaged or uses an unsupported structure. Export it again as PDF or DOCX.", 422);
    }

    // Track job lifecycle
    if (!jobId) {
      jobId = await SourceProcessingJobService.startJob({
        personId,
        sourceId: "resume",
        stage: "acquire",
      });
    }

    // Reprocess identical uploads: older cached snapshots hold only review claims,
    // not OCR text or profile links, so a cache hit would silently lose them.
    const documentId = crypto.createHash("sha256").update(bytes).digest("hex");

    // --- Deterministic Document Parsing & OCR ---
    await SourceProcessingJobService.updateStage(jobId, personId, "parse");

    let parsedDoc;
    try {
      parsedDoc = await parseResumeDocument(bytes, extension as "pdf" | "docx", {
        enableOcr: true,
        ocrTimeoutMs: 15000,
      });
    } catch {
      return fail(
        "PARSE_FAILED",
        "We could not read this file. It may be scanned, protected, or damaged. Please enter details manually.",
        422
      );
    }

    const rawText = parsedDoc.text;
    if (!rawText.trim()) {
      return fail(
        parsedDoc.ocrUsed ? "OCR_LOW_QUALITY" : "NATIVE_TEXT_UNAVAILABLE",
        parsedDoc.ocrUsed
          ? "We could not read the scanned pages clearly. Try a sharper scan or enter details manually."
          : "No readable text was found. Try exporting the document again or enter details manually.",
        422
      );
    }

    // --- Deterministic Extraction (ZERO-LLM) ---
    await SourceProcessingJobService.updateStage(jobId, personId, "extract");
    const legacySuggestions = resumeSuggestions(rawText);
    const legacyDiscovery = resumeDiscovery(rawText);

    const extraction = await extractResumeStructured(rawText, personId, parsedDoc.hyperlinks);
    if (!extraction.success || !extraction.extracted) {
      return fail(
        "EXTRACTION_FAILED",
        "We could not extract reviewable details. Please retry or enter details manually.",
        422
      );
    }

    // --- Validation & Normalization ---
    await SourceProcessingJobService.updateStage(jobId, personId, "validate");
    const reviewCandidates = resumeCandidates(extraction.extracted, rawText);
    if (reviewCandidates.length === 0) {
      return fail(
        "NO_CLAIMS_FOUND",
        "No supported claims were found for review. Please enter details manually.",
        422
      );
    }

    // --- Snapshot Persistence ---
    try {
      await SourceProcessingJobService.updateStage(jobId, personId, "persist");
      await saveResumeCandidates(personId, documentId, extraction.extracted, rawText);
    } catch {
      return fail(
        "PERSIST_FAILED",
        "We could not save the extraction for review. Please retry or enter details manually.",
        503
      );
    }

    await SourceProcessingJobService.completeJob({
      jobId,
      personId,
      resultReference: `resume:sha256:${documentId}`,
      metadata: { candidates: reviewCandidates.length },
    });

    // --- Build Canonical Success Response ---
    const successResponse = makeJsonResponse(
      {
        ok: true,
        status: "completed",
        documentId,
        jobId,
        structured: extraction.extracted,
        extractedProfile: extraction.extractedProfile,
        discoveredProfiles: extraction.discoveredProfiles,
        discoveredRepositories: extraction.discoveredRepositories,
        candidates: extraction.candidates,
        reviewCandidates,
        extractionMeta: {
          success: extraction.success,
          provider: extraction.provider,
          modelUsed: extraction.modelUsed,
          llmUsed: false,
          ocrUsed: parsedDoc.ocrUsed,
          ocrFailed: parsedDoc.ocrFailed,
          fallbackUsed: extraction.fallbackUsed,
          latencyMs: extraction.latencyMs,
          textTruncated: extraction.truncated,
          error: extraction.error || null,
        },
        suggestions: legacySuggestions,
        discovery: legacyDiscovery,
        message:
          "Your resume was analysed deterministically without generative AI. Source-backed suggestions were saved for review.",
        requestId,
      },
      200,
      requestId
    );

    if (authRes.sessionCookieToSet) {
      successResponse.cookies.set(
        authRes.sessionCookieToSet.name,
        authRes.sessionCookieToSet.value,
        authRes.sessionCookieToSet.options as Parameters<typeof successResponse.cookies.set>[2]
      );
    }

    return successResponse;
  } catch (err) {
    return fail("UNKNOWN_PROCESSING_FAILURE", "We could not process this document. Please retry or enter details manually.", 500);
  }
}
