/**
 * AI TATHASTU — RESUME EXTRACTION API V3.9
 *
 * POST /api/resume/extract
 *
 * CRITICAL ARCHITECTURAL DECISION: STRICT ZERO-LLM RESUME EXTRACTION.
 * Accepts PDF or DOCX, parses text, embedded hyperlinks, and runs OCR for scans.
 * Directly invokes the canonical DeterministicResumeExtractionEngine.
 *
 * The student reviews and confirms extracted items before anything becomes canonical.
 *
 * Security:
 * - Rate limited (5 req/min per authenticated student)
 * - File type + magic byte validation
 * - File size limit (5MB)
 * - Zero LLM API calls, zero prompts, zero model provider dependencies
 * - Authenticated student ownership required
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { getServerAuthContext, getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { extractResumeStructured } from "@/lib/services/resume-extraction-service";
import { resumeCandidates, saveResumeCandidates } from "@/lib/services/resume-review-service";
import { parseResumeDocument } from "@/lib/services/document-parser-service";
import { resumeSuggestions, resumeDiscovery } from "@/lib/resume-suggestions";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function error(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store", ...headers } });
}

export async function POST(request: Request) {
  if (!coreIngestionReady()) return error("Resume import is unavailable because production ingestion security setup is incomplete.", 503);
  const authRes = await getOrCreateOnboardingAuthContext().catch(() => null);
  if (!authRes || !authRes.auth) return error("Unable to initialize secure session for resume upload.", 401);
  const auth = authRes.auth;
  const personId = auth.person.id;

  let jobId: string | null = null;
  const fail = async (message: string, status: number) => {
    if (jobId) await SourceProcessingJobService.failJob({ jobId, personId, errorCode: `HTTP_${status}`, errorMessage: message }).catch(() => null);
    return error(message, status);
  };

  // Tie upload cost to the authenticated account; client-supplied IP headers cannot reset its quota.
  const rl = await checkRateLimitDistributed(personId, "resume");
  if (!rl.allowed) {
    return error(
      "Too many resume upload requests. Please wait a minute before uploading again.",
      429,
      { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) }
    );
  }

  // --- File reception ---
  let file: File;
  try {
    const form = await request.formData();
    const requestedJobId = form.get("jobId");
    if (typeof requestedJobId === "string") {
      const job = await SourceProcessingJobService.getJobForPerson(requestedJobId, personId);
      if (!job || job.sourceId !== "resume" || job.status !== "running") return error("Invalid resume processing job.", 400);
      jobId = job.id;
    }
    if (form.get("aiConsent") !== "true" && form.get("consent") !== "true") {
      return fail("Confirm that your resume may be processed.", 400);
    }
    const candidate = form.get("resume");
    if (!(candidate instanceof File)) {
      return fail("Choose a PDF or DOCX file first.", 400);
    }
    file = candidate;
  } catch {
    return fail("The file could not be received. Please try again or enter details manually.", 400);
  }

  // --- File validation ---
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "pdf" && extension !== "docx") {
    return fail("Use a PDF or DOCX file.", 415);
  }
  if (file.size === 0) {
    return fail("This file is empty. Please choose another or enter details manually.", 400);
  }
  if (file.size > MAX_BYTES) {
    return fail("Choose a file under 5 MB, or enter details manually.", 413);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Magic byte validation
  const isPdf = bytes.subarray(0, 5).toString() === "%PDF-";
  const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes.includes(Buffer.from("[Content_Types].xml"));
  if ((extension === "pdf" && !isPdf) || (extension === "docx" && !isDocx)) {
    return fail("The file content does not match its extension. Please choose another file.", 415);
  }

  if (!jobId) jobId = await SourceProcessingJobService.startJob({ personId, sourceId: "resume", stage: "acquire" });
  await SourceProcessingJobService.updateStage(jobId, personId, "parse");

  // --- Deterministic Document Parsing & OCR ---
  let parsedDoc;
  try {
    parsedDoc = await parseResumeDocument(bytes, extension as "pdf" | "docx");
  } catch {
    return fail(
      "We could not read this file. It may be scanned, protected, or damaged. Please enter details manually.",
      422
    );
  }

  const rawText = parsedDoc.text;
  if (rawText.replace(/\s/g, "").length < 40) {
    return fail(
      "We could not read enough text. Please use a readable document or enter details manually.",
      422
    );
  }

  // --- Deterministic regex suggestions (legacy UI compatibility) ---
  const legacySuggestions = resumeSuggestions(rawText);
  const legacyDiscovery = resumeDiscovery(rawText);
  await SourceProcessingJobService.updateStage(jobId, personId, "extract");

  // --- Structured Deterministic Extraction (ZERO-LLM) ---
  const extraction = await extractResumeStructured(rawText, personId, parsedDoc.hyperlinks);
  if (!extraction.success || !extraction.extracted) {
    return fail("We could not extract reviewable details. Please retry or enter details manually.", 422);
  }
  await SourceProcessingJobService.updateStage(jobId, personId, "validate");
  const reviewCandidates = resumeCandidates(extraction.extracted, rawText);
  if (reviewCandidates.length === 0) {
    return fail("No supported claims were found for review. Please enter details manually.", 422);
  }

  const documentId = crypto.createHash("sha256").update(bytes).digest("hex");
  try {
    await SourceProcessingJobService.updateStage(jobId, personId, "persist");
    await saveResumeCandidates(personId, documentId, extraction.extracted, rawText);
  } catch {
    return fail("We could not save the extraction for review. Please retry or enter details manually.", 503);
  }
  await SourceProcessingJobService.completeJob({ jobId, personId, resultReference: `resume:sha256:${documentId}`, metadata: { candidates: reviewCandidates.length } });

  // --- Build response ---
  const response = NextResponse.json({
    documentId,
    jobId,
    // Structured extraction candidates
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
      error: extraction.error,
    },

    // Legacy regex extraction (for backward UI prefill compatibility)
    suggestions: legacySuggestions,
    discovery: legacyDiscovery,

    message: "Your resume was analysed deterministically without generative AI. Source-backed suggestions were saved for review; they remain unverified until independently checked.",
  }, { headers: { "Cache-Control": "private, no-store" } });

  if (authRes.sessionCookieToSet) {
    response.cookies.set(
      authRes.sessionCookieToSet.name,
      authRes.sessionCookieToSet.value,
      authRes.sessionCookieToSet.options as Parameters<typeof response.cookies.set>[2]
    );
  }

  return response;
}

