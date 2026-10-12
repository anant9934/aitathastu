/**
 * AI TATHASTU — RESUME INGESTION PIPELINE
 *
 * Upload-to-review flow (see docs/ARCHITECTURE.md for the diagram):
 *
 *   POST /api/resume/extract      validate + store blob + create job (queued) -> 202
 *   GET  /api/resume/[id]/status  advance the job one step, return its real state
 *
 * Why poll-driven instead of a background worker: on Netlify a request may
 * not outlive its response, and fire-and-forget work is silently killed. So
 * every unit of work here runs inside an awaited status request and is short:
 *   - text-layer PDF / DOCX parsing runs in-process (pdf.js text only, no
 *     canvas, no tesseract) and normally finishes in well under a second;
 *   - scanned / image-only PDFs are handed to the Python extractor (Render),
 *     which OCRs in its own background task. Later polls just ask it for status.
 *
 * Concurrency: polls from several tabs may arrive together. Every step claims
 * the job with a conditional status/stage transition, and only the winner does
 * the work (see SourceProcessingJobService.transition).
 *
 * Failures always carry a specific error code (e.g. OCR_ENGINE_UNAVAILABLE vs
 * OCR_NO_TEXT) and are logged server-side with the real cause. Nothing is
 * collapsed into a generic "scan not clear".
 */

import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb, resumeDocuments } from "@/lib/db";
import { ObjectStorageService } from "@/lib/storage/object-storage";
import { SourceProcessingJobService, type SourceProcessingJob } from "./source-processing-job-service";
import { parseResumeDocument } from "./document-parser-service";
import { extractResumeStructured } from "./resume-extraction-service";
import { resumeCandidates, saveResumeCandidates } from "./resume-review-service";
import { resumeSuggestions, resumeDiscovery } from "@/lib/resume-suggestions";
import { buildProfileV2 } from "./resume-profile-v2";
import { ExtractorServiceClient, ExtractorServiceError, type ExtractorProfileV2 } from "./extractor-service-client";
import { resolveExtractorIdentity } from "@/lib/auth/extractor-identity";

export type ResumeFailureCode =
  | "DOCUMENT_RETRIEVAL_FAILED"
  | "PARSE_FAILED"
  | "NATIVE_TEXT_UNAVAILABLE"
  | "OCR_SERVICE_NOT_CONFIGURED"
  | "OCR_SERVICE_UNREACHABLE"
  | "OCR_SERVICE_AUTH_FAILED"
  | "OCR_SERVICE_REJECTED"
  | "OCR_ENGINE_UNAVAILABLE"
  | "OCR_EXTRACTION_ERROR"
  | "OCR_NO_TEXT"
  | "OCR_TIMEOUT"
  | "EXTRACTION_FAILED"
  | "NO_CLAIMS_FOUND"
  | "PERSIST_FAILED"
  | "PROCESSING_STALLED";

const FAILURES: Record<ResumeFailureCode, { message: string; retryable: boolean }> = {
  DOCUMENT_RETRIEVAL_FAILED: { message: "We could not load your stored file. Please upload it again.", retryable: true },
  PARSE_FAILED: { message: "This file could not be read. It may be damaged. Export it again as PDF or DOCX, or enter details manually.", retryable: false },
  NATIVE_TEXT_UNAVAILABLE: { message: "No readable text was found in this document. Export it again or enter details manually.", retryable: false },
  OCR_SERVICE_NOT_CONFIGURED: { message: "This looks like a scanned document, and scanned-document reading is not configured on this server. Upload a text-based PDF or DOCX, or enter details manually.", retryable: false },
  OCR_SERVICE_UNREACHABLE: { message: "Our scanned-document reader is not responding right now. Please retry in a minute.", retryable: true },
  OCR_SERVICE_AUTH_FAILED: { message: "Our scanned-document reader rejected this server's credentials. This is a configuration problem on our side; please try again later.", retryable: true },
  OCR_SERVICE_REJECTED: { message: "Our scanned-document reader could not accept this file (it may exceed the page or size limit).", retryable: false },
  OCR_ENGINE_UNAVAILABLE: { message: "The OCR engine is unavailable on our scanned-document reader. This is a problem on our side, not with your file. Please try again later.", retryable: true },
  OCR_EXTRACTION_ERROR: { message: "Our scanned-document reader hit an internal error on this file. Please retry, or enter details manually.", retryable: true },
  OCR_NO_TEXT: { message: "We could not read the scanned pages clearly. Try a sharper scan or enter details manually.", retryable: false },
  OCR_TIMEOUT: { message: "Reading this scanned document took too long. Please retry, or enter details manually.", retryable: true },
  EXTRACTION_FAILED: { message: "We could not extract reviewable details. Please retry or enter details manually.", retryable: true },
  NO_CLAIMS_FOUND: { message: "No supported details were found for review. Please enter details manually.", retryable: false },
  PERSIST_FAILED: { message: "We could not save the extraction for review. Please retry.", retryable: true },
  PROCESSING_STALLED: { message: "Processing stopped unexpectedly. Please retry.", retryable: true },
};

/** Fewer non-whitespace characters than this means the PDF has no usable text layer. */
const MIN_TEXT_CHARS = 40;
/** A claimed in-process step older than this is assumed to have died with its request. */
const STALE_CLAIM_MS = 90_000;
/** Total budget for an extractor OCR job before we give up. */
const OCR_DEADLINE_MS = 5 * 60_000;

export type ResumeReviewPayload = {
  reviewCandidates: Array<{ candidateId: string; category: string; value: string; sourceSpan: string }>;
  structured: unknown;
  extractedProfile: unknown;
  discoveredProfiles: unknown;
  discoveredRepositories: unknown;
  extractionMeta: Record<string, unknown>;
  suggestions: unknown;
  discovery: unknown;
};

class PipelineFailure extends Error {
  constructor(public readonly code: ResumeFailureCode, public readonly cause?: unknown) {
    super(code);
  }
}

function classifyExtractorError(err: unknown): ResumeFailureCode {
  if (err instanceof ExtractorServiceError) {
    if (err.kind === "auth") return "OCR_SERVICE_AUTH_FAILED";
    if (err.kind === "rejected") return "OCR_SERVICE_REJECTED";
    if (err.kind === "server") return "OCR_EXTRACTION_ERROR";
    return "OCR_SERVICE_UNREACHABLE";
  }
  return "OCR_SERVICE_UNREACHABLE";
}

function meta(job: SourceProcessingJob): Record<string, unknown> {
  return (job.metadata ?? {}) as Record<string, unknown>;
}

async function fail(job: SourceProcessingJob, code: ResumeFailureCode, cause?: unknown) {
  const f = FAILURES[code];
  console.error("[resume-pipeline] job failed", {
    jobId: job.id,
    code,
    cause: cause instanceof Error ? `${cause.name}: ${cause.message}` : cause ?? null,
  });
  await SourceProcessingJobService.failJob({
    jobId: job.id,
    personId: job.personId,
    errorCode: code,
    errorMessage: f.message,
    status: "failed",
    canRetry: f.retryable,
  });
  const documentId = meta(job).documentId;
  if (typeof documentId === "string") {
    const db = await getDb();
    await db
      .update(resumeDocuments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, job.personId)));
  }
}

/**
 * Stores an uploaded resume and queues it. Does no parsing.
 *
 * Document IDs are random UUIDs, not content hashes: two people uploading
 * byte-identical files must get two separate rows, and a content-hash ID
 * let the second upload overwrite the first person's row. The sha256 is kept
 * separately in resume_documents.checksum.
 */
export async function queueResumeUpload(params: {
  personId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<{ jobId: string; documentId: string }> {
  const documentId = crypto.randomUUID();
  await ObjectStorageService.storeDocument({
    documentId,
    personId: params.personId,
    filename: params.filename,
    mimeType: params.mimeType,
    buffer: params.bytes,
  });
  const jobId = await queueJobForDocument(params.personId, documentId, params.filename);
  return { jobId, documentId };
}

/** Re-queues an already-stored document (retry without asking for the file again). */
export async function requeueResumeDocument(personId: string, documentId: string): Promise<string | null> {
  const db = await getDb();
  const [doc] = await db
    .select()
    .from(resumeDocuments)
    .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)))
    .limit(1);
  if (!doc || doc.status === "deleted") return null;
  return queueJobForDocument(personId, documentId, doc.filename);
}

async function queueJobForDocument(personId: string, documentId: string, filename: string): Promise<string> {
  const jobId = await SourceProcessingJobService.startJob({
    personId,
    sourceId: "resume",
    stage: "acquire",
    status: "queued",
    metadata: { documentId, filename },
  });
  const db = await getDb();
  await db
    .update(resumeDocuments)
    .set({
      status: "queued",
      metadata: sql`coalesce(${resumeDocuments.metadata}, '{}'::jsonb) || ${JSON.stringify({ jobId })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));
  return jobId;
}

/**
 * Advances a resume job by at most one step and returns its current row.
 * Safe to call repeatedly and concurrently.
 */
export async function advanceResumeJob(jobId: string, personId: string): Promise<SourceProcessingJob | null> {
  const job = await SourceProcessingJobService.getJobForPerson(jobId, personId);
  if (!job || job.sourceId !== "resume") return job;

  try {
    if (job.status === "queued") {
      const claimed = await SourceProcessingJobService.transition({
        jobId, personId, from: ["queued"], to: "processing", stage: "parse",
        metadata: { claimedAt: Date.now() },
      });
      if (claimed) await runInProcessStep(claimed);
    } else if (job.status === "processing") {
      const m = meta(job);
      if (job.stage === "extract" && typeof m.extractorDocumentId === "string") {
        await pollExtractor(job, m.extractorDocumentId);
      } else if (typeof m.claimedAt === "number" && Date.now() - m.claimedAt > STALE_CLAIM_MS) {
        await fail(job, "PROCESSING_STALLED", `stage ${job.stage} claimed ${Date.now() - m.claimedAt}ms ago`);
      }
    }
  } catch (err) {
    const fresh = await SourceProcessingJobService.getJobForPerson(jobId, personId);
    if (fresh) await fail(fresh, err instanceof PipelineFailure ? err.code : "EXTRACTION_FAILED", err instanceof PipelineFailure ? err.cause : err);
  }

  return SourceProcessingJobService.getJobForPerson(jobId, personId);
}

async function runInProcessStep(job: SourceProcessingJob) {
  const documentId = meta(job).documentId as string;
  let doc;
  try {
    doc = await ObjectStorageService.getDocument(documentId, job.personId);
  } catch (err) {
    throw new PipelineFailure("DOCUMENT_RETRIEVAL_FAILED", err);
  }
  const extension = doc.filename.toLowerCase().endsWith(".docx") ? "docx" : "pdf";

  let parsed;
  try {
    // Text layer only. OCR never runs inside a serverless request: it needs a
    // native canvas binary, a WASM worker and a 5 MB model, and routinely
    // exceeded the function time limit. Scanned PDFs go to the extractor.
    parsed = await parseResumeDocument(doc.buffer, extension, { enableOcr: false });
  } catch (err) {
    throw new PipelineFailure("PARSE_FAILED", err);
  }

  if (parsed.text.replace(/\s/g, "").length >= MIN_TEXT_CHARS) {
    await finalize(job, documentId, {
      text: parsed.text,
      hyperlinks: parsed.hyperlinks,
      fileFormat: extension,
      pageCount: parsed.pageCount || 1,
      ocrUsed: false,
      via: extension === "docx" ? "docx" : "native-pdf",
    });
    return;
  }

  if (extension === "docx") throw new PipelineFailure("NATIVE_TEXT_UNAVAILABLE");
  if (!ExtractorServiceClient.isConfigured()) throw new PipelineFailure("OCR_SERVICE_NOT_CONFIGURED");

  // Hand the scan to the extractor. Both calls are short: upload stores the
  // file, startExtraction only queues a background task there.
  try {
    const identity = await resolveExtractorIdentity(job.personId);
    const uploaded = await ExtractorServiceClient.uploadResume({
      fileBuffer: doc.buffer,
      filename: doc.filename,
      mimeType: doc.mimeType || "application/pdf",
      identity,
    });
    await ExtractorServiceClient.startExtraction(uploaded.document_id, identity);
    await SourceProcessingJobService.updateStage(job.id, job.personId, "extract", {
      extractorDocumentId: uploaded.document_id,
      submittedAt: Date.now(),
    });
    const db = await getDb();
    await db
      .update(resumeDocuments)
      .set({
        status: "processing",
        metadata: sql`coalesce(${resumeDocuments.metadata}, '{}'::jsonb) || ${JSON.stringify({ extractorDocumentId: uploaded.document_id })}::jsonb`,
      })
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, job.personId)));
  } catch (err) {
    throw new PipelineFailure(classifyExtractorError(err), err);
  }
}

async function pollExtractor(job: SourceProcessingJob, extractorDocumentId: string) {
  const m = meta(job);
  const identity = await resolveExtractorIdentity(job.personId);
  let status;
  try {
    status = await ExtractorServiceClient.getStatus(extractorDocumentId, identity);
  } catch (err) {
    // A single failed status poll is not fatal; the deadline below is.
    const submittedAt = typeof m.submittedAt === "number" ? m.submittedAt : 0;
    if (Date.now() - submittedAt > OCR_DEADLINE_MS) throw new PipelineFailure("OCR_TIMEOUT", err);
    console.warn("[resume-pipeline] extractor status poll failed", { jobId: job.id, error: err instanceof Error ? err.message : err });
    return;
  }

  if (status.status === "queued" || status.status === "processing" || status.status === "uploaded") {
    const submittedAt = typeof m.submittedAt === "number" ? m.submittedAt : 0;
    if (Date.now() - submittedAt > OCR_DEADLINE_MS) throw new PipelineFailure("OCR_TIMEOUT", `extractor still ${status.status}`);
    return;
  }

  if (status.status === "failed") {
    const code: ResumeFailureCode = status.error_code === "OCR_ENGINE_UNAVAILABLE" ? "OCR_ENGINE_UNAVAILABLE" : "OCR_EXTRACTION_ERROR";
    throw new PipelineFailure(code, { extractorErrorCode: status.error_code ?? null, warnings: status.warnings });
  }

  // completed | partial: exactly one poll gets to persist.
  const claimed = await SourceProcessingJobService.transition({
    jobId: job.id, personId: job.personId, from: ["processing"], fromStage: "extract",
    to: "processing", stage: "persist", metadata: { claimedAt: Date.now() },
  });
  if (!claimed) return;

  let rawText: string;
  let profile: ExtractorProfileV2 | null;
  try {
    const [text, view] = await Promise.all([
      ExtractorServiceClient.getRawText(extractorDocumentId, identity),
      ExtractorServiceClient.getDocument(extractorDocumentId, identity),
    ]);
    rawText = text.raw_text || "";
    profile = view.profile;
  } catch (err) {
    throw new PipelineFailure(classifyExtractorError(err), err);
  }

  const hasRecords = Boolean(profile && Object.values(profile.groups).some((rows) => rows.length > 0));
  if (rawText.replace(/\s/g, "").length < MIN_TEXT_CHARS && !hasRecords) {
    throw new PipelineFailure("OCR_NO_TEXT", { warnings: status.warnings });
  }

  await finalize(claimed, meta(claimed).documentId as string, {
    text: rawText,
    hyperlinks: [],
    fileFormat: "pdf",
    pageCount: profile?.metadata.page_count || 1,
    ocrUsed: true,
    via: "extractor-ocr",
    extractorProfile: profile,
  });
}

/** Turns extractor profile records into review candidates when the text-based extractor found none. */
function candidatesFromExtractorProfile(profile: ExtractorProfileV2) {
  const out: ResumeReviewPayload["reviewCandidates"] = [];
  const v = (r: { fields: Record<string, { value: string }> }, ...keys: string[]) =>
    keys.map((k) => r.fields[k]?.value?.trim()).find(Boolean) || "";
  const push = (category: string, rows: ExtractorProfileV2["groups"][string] | undefined, pick: (r: ExtractorProfileV2["groups"][string][number]) => string) =>
    (rows || []).forEach((r, i) => {
      const value = pick(r);
      if (value) out.push({ candidateId: `${category}_${i}`, category, value, sourceSpan: value });
    });
  push("skill", profile.groups.skills, (r) => v(r, "canonical_name", "original_wording"));
  push("education", profile.groups.education, (r) => [v(r, "degree_title", "qualification"), v(r, "institution", "university")].filter(Boolean).join(" · "));
  push("experience", profile.groups.experience, (r) => [v(r, "job_title"), v(r, "organization")].filter(Boolean).join(" · "));
  push("project", profile.groups.projects, (r) => v(r, "title"));
  push("certification", profile.groups.certifications, (r) => v(r, "title"));
  return out;
}

async function finalize(
  job: SourceProcessingJob,
  documentId: string,
  input: {
    text: string;
    hyperlinks: string[];
    fileFormat: string;
    pageCount: number;
    ocrUsed: boolean;
    via: string;
    extractorProfile?: ExtractorProfileV2 | null;
  }
) {
  const { personId } = job;
  await SourceProcessingJobService.updateStage(job.id, personId, "validate");

  const extraction = await extractResumeStructured(input.text, personId, input.hyperlinks);
  if (!extraction.success || !extraction.extracted) throw new PipelineFailure("EXTRACTION_FAILED", extraction.error);

  // Candidate IDs are `${category}_${index}` and must index into the stored
  // profile's record arrays (apply maps decisions back by that index). So the
  // profile is always built from the same source the candidates came from.
  let reviewCandidates: ResumeReviewPayload["reviewCandidates"] = resumeCandidates(extraction.extracted, input.text);
  let profile: ExtractorProfileV2;
  if (reviewCandidates.length === 0 && input.extractorProfile) {
    reviewCandidates = candidatesFromExtractorProfile(input.extractorProfile);
    profile = input.extractorProfile;
  } else {
    profile = buildProfileV2({
      documentId,
      extraction,
      fileFormat: input.fileFormat,
      pageCount: input.pageCount,
      ocrUsed: input.ocrUsed,
    });
  }
  if (reviewCandidates.length === 0) throw new PipelineFailure("NO_CLAIMS_FOUND");

  await SourceProcessingJobService.updateStage(job.id, personId, "persist");

  const review: ResumeReviewPayload = {
    reviewCandidates,
    structured: extraction.extracted,
    extractedProfile: extraction.extractedProfile ?? null,
    discoveredProfiles: extraction.discoveredProfiles ?? {},
    discoveredRepositories: extraction.discoveredRepositories ?? [],
    extractionMeta: {
      success: true,
      provider: input.via === "extractor-ocr" ? "extractor-tesseract" : extraction.provider,
      modelUsed: extraction.modelUsed,
      llmUsed: false,
      ocrUsed: input.ocrUsed,
      latencyMs: extraction.latencyMs,
      via: input.via,
    },
    suggestions: resumeSuggestions(input.text),
    discovery: resumeDiscovery(input.text),
  };

  try {
    // Snapshot first: /apply and onboarding completion validate claims against it.
    await saveResumeCandidates(personId, documentId, extraction.extracted, input.text);
    const db = await getDb();
    const updated = await db
      .update(resumeDocuments)
      .set({
        status: "review_ready",
        extractedProfile: profile,
        metadata: sql`coalesce(${resumeDocuments.metadata}, '{}'::jsonb) || ${JSON.stringify({ review, via: input.via })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)))
      .returning();
    if (updated.length !== 1) throw new Error(`resume_documents row ${documentId} not found for owner`);
  } catch (err) {
    throw new PipelineFailure("PERSIST_FAILED", err);
  }

  await SourceProcessingJobService.transition({
    jobId: job.id, personId, from: ["processing"], to: "review_ready", stage: "review",
    errorCode: null, errorMessage: null,
    resultReference: `resume:${documentId}`,
    metadata: { candidates: reviewCandidates.length, via: input.via },
  });
}

export function failureInfo(code: string | null | undefined) {
  return code && code in FAILURES ? FAILURES[code as ResumeFailureCode] : null;
}
