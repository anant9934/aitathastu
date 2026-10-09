/**
 * AI TATHASTU — RESUME EXTRACTION API
 *
 * POST /api/resume/extract
 *
 * Accepts PDF or DOCX, extracts text, then calls the LLM extraction service
 * to produce structured, Zod-validated profile candidates.
 *
 * The student must review and confirm every extracted item before it becomes
 * canonical profile data. Candidate provenance is stored for later validation.
 *
 * Security:
 * - Rate limited (5 req/min per IP)
 * - File type + magic byte validation
 * - File size limit (5MB)
 * - Prompt injection defense in extraction service
 * - Authenticated student and explicit model-processing consent required
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { extractResumeStructured } from "@/lib/services/resume-extraction-service";
import { saveResumeCandidates } from "@/lib/services/resume-review-service";
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
    if (form.get("aiConsent") !== "true") {
      return error("Confirm that your resume may be processed by an approved AI provider.", 400);
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

  // --- Text extraction ---
  let rawText = "";
  try {
    if (extension === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        rawText = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else {
      const mammoth = await import("mammoth");
      rawText = (await mammoth.extractRawText({ buffer: bytes })).value;
    }
  } catch {
    return error(
      "We could not read this file. It may be scanned, protected, or damaged. Please enter details manually.",
      422
    );
  }

  if (rawText.replace(/\s/g, "").length < 40) {
    return error(
      "We could not read enough text. Scanned or image-only files need manual entry.",
      422
    );
  }

  // --- Deterministic regex suggestions (always fast, always returned) ---
  const legacySuggestions = resumeSuggestions(rawText);
  const legacyDiscovery = resumeDiscovery(rawText);

  // --- Structured LLM extraction ---
  const extraction = await extractResumeStructured(rawText, personId);

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
    // LLM structured extraction (primary — requires student review before saving)
    structured: extraction.extracted,
    extractionMeta: {
      success: extraction.success,
      provider: extraction.provider,
      modelUsed: extraction.modelUsed,
      fallbackUsed: extraction.fallbackUsed,
      latencyMs: extraction.latencyMs,
      textTruncated: extraction.truncated,
      error: extraction.error,
    },

    // Legacy regex extraction (fast fallback for immediate UI prefill)
    suggestions: legacySuggestions,
    discovery: legacyDiscovery,

    message: extraction.success
      ? "Your resume was analysed. Review every extracted item carefully — nothing is saved until you confirm it."
      : "Basic information was extracted from your resume. Please review and complete manually.",
  });
}
