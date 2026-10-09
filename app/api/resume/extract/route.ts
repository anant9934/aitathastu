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
 * - Rate limited (5 req/min per IP)
 * - File type + magic byte validation
 * - File size limit (5MB)
 * - Zero LLM API calls, zero prompts, zero model provider dependencies
 * - Authenticated student ownership required
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { extractResumeStructured } from "@/lib/services/resume-extraction-service";
import { saveResumeCandidates } from "@/lib/services/resume-review-service";
import { parseResumeDocument } from "@/lib/services/document-parser-service";
import { resumeSuggestions, resumeDiscovery } from "@/lib/resume-suggestions";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function error(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function POST(request: Request) {
  if (!coreIngestionReady()) return error("Resume import is unavailable until credential rotation is complete.", 503);
  // Rate limiting (resume tier: 5 req/min per IP)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "client";
  const rl = checkRateLimit(ip, "resume");
  if (!rl.allowed) {
    return error(
      "Too many resume upload requests. Please wait a minute before uploading again.",
      429,
      { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) }
    );
  }

  const auth = await getServerAuthContext().catch(() => null);
  if (!auth) return error("Sign in before uploading a resume.", 401);
  const personId = auth.person.id;

  // --- File reception ---
  let file: File;
  try {
    const form = await request.formData();
    if (form.get("aiConsent") !== "true" && form.get("consent") !== "true") {
      return error("Confirm that your resume may be processed.", 400);
    }
    const candidate = form.get("resume");
    if (!(candidate instanceof File)) {
      return error("Choose a PDF or DOCX file first.", 400);
    }
    file = candidate;
  } catch {
    return error("The file could not be received. Please try again or enter details manually.", 400);
  }

  // --- File validation ---
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "pdf" && extension !== "docx") {
    return error("Use a PDF or DOCX file.", 415);
  }
  if (file.size === 0) {
    return error("This file is empty. Please choose another or enter details manually.", 400);
  }
  if (file.size > MAX_BYTES) {
    return error("Choose a file under 5 MB, or enter details manually.", 413);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Magic byte validation
  const isPdf = bytes.subarray(0, 5).toString() === "%PDF-";
  const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes.includes(Buffer.from("[Content_Types].xml"));
  if ((extension === "pdf" && !isPdf) || (extension === "docx" && !isDocx)) {
    return error("The file content does not match its extension. Please choose another file.", 415);
  }

  // --- Deterministic Document Parsing & OCR ---
  let parsedDoc;
  try {
    parsedDoc = await parseResumeDocument(bytes, extension as "pdf" | "docx");
  } catch {
    return error(
      "We could not read this file. It may be scanned, protected, or damaged. Please enter details manually.",
      422
    );
  }

  const rawText = parsedDoc.text;
  if (rawText.replace(/\s/g, "").length < 40 && parsedDoc.requiresManualReview) {
    return error(
      "We could not read enough text. Scanned or image-only files need manual entry.",
      422
    );
  }

  // --- Deterministic regex suggestions (legacy UI compatibility) ---
  const legacySuggestions = resumeSuggestions(rawText);
  const legacyDiscovery = resumeDiscovery(rawText);

  // --- Structured Deterministic Extraction (ZERO-LLM) ---
  const extraction = await extractResumeStructured(rawText, personId, parsedDoc.hyperlinks);

  const documentId = crypto.createHash("sha256").update(bytes).digest("hex");
  if (extraction.extracted) {
    try {
      await saveResumeCandidates(personId, documentId, extraction.extracted);
    } catch {
      return error("We could not save the extraction for review. Please retry or enter details manually.", 503);
    }
  }

  // --- Build response ---
  return NextResponse.json({
    documentId,
    // Structured extraction candidates
    structured: extraction.extracted,
    extractedProfile: extraction.extractedProfile,
    discoveredProfiles: extraction.discoveredProfiles,
    discoveredRepositories: extraction.discoveredRepositories,
    candidates: extraction.candidates,
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

    message: extraction.success
      ? "Your resume was analysed deterministically without generative AI. Review every extracted item carefully — nothing is saved until you confirm it."
      : "Basic information was extracted from your resume. Please review and complete manually.",
  });
}
