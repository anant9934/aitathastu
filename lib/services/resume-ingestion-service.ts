/**
 * AI TATHASTU — RESUME INGESTION PIPELINE
 *
 * Upload-to-review flow (see docs/ARCHITECTURE.md for the diagram):
 *
 *   POST /api/resume/extract      validate + store blob + create job (queued) -> 202
 *   GET  /api/resume/[id]/status  advance the job one step, return its real state
 *
 * Why poll-driven instead of a background worker: on serverless platforms (e.g. Vercel)
 * a request may not outlive its response, and fire-and-forget work is silently killed. So
 * every unit of work here runs inside an awaited status request and is short:
 *   - text-layer PDF / DOCX: read in-process (pdf.js positions, no canvas, no
 *     tesseract) and rebuilt in reading order by lib/resume/layout.ts;
 *   - scanned / image-only PDFs are handed to the Python extractor (Render),
 *     which OCRs in its own background task and returns word boxes; those go
 *     through the same layout reconstruction. Later polls just ask it for status.
 * Both branches then make the same single structuring call (lib/resume/structure.ts).
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
import { getDb, resumeDocuments, sourceProcessingJobs } from "@/lib/db";
import { ObjectStorageService } from "@/lib/storage/object-storage";
import { SourceProcessingJobService, type SourceProcessingJob, type ProcessingStage } from "./source-processing-job-service";
import { readDocumentText } from "@/lib/resume/document-text";
import { reconstructReadingOrderDetailed, type LayoutLineMeta } from "@/lib/resume/layout";
import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";
import {
  extractResumeStructured,
  extractResumeDeterministicResult,
  adaptRenderProfileToInterpretation,
  shouldEnrichWithLLM,
  mergeExtractionResults,
  type ResumeExtractionResult,
} from "./resume-extraction-service";
import { discoverFootprintsFromResume } from "./digital-footprint-discovery";
import { resumeCandidates, saveResumeCandidates } from "./resume-review-service";
import { buildProfileV2 } from "./resume-profile-v2";
import { ExtractorServiceClient, ExtractorServiceError, type ExtractorProfileV2 } from "./extractor-service-client";
import { resolveExtractorIdentity } from "@/lib/auth/extractor-identity";
import { docMeta, loadOwnedResumeDocument } from "@/lib/api/resume-route-helpers";
import { markRunFailed, persistExtraction, runIdForJob } from "./resume-extraction-persistence";

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
  | "AI_QUOTA_EXCEEDED"
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
  AI_QUOTA_EXCEEDED: { message: "You've reached today's limit for automatic CV reading. It resets at 00:00 UTC; until then you can enter your details manually.", retryable: true },
  EXTRACTION_FAILED: { message: "We could not extract reviewable details. Please retry or enter details manually.", retryable: true },
  NO_CLAIMS_FOUND: { message: "No supported details were found for review. Please enter details manually.", retryable: false },
  PERSIST_FAILED: { message: "We could not save the extraction for review. Please retry.", retryable: true },
  PROCESSING_STALLED: { message: "Processing stopped unexpectedly. Please retry.", retryable: true },
};

/** Fewer non-whitespace characters than this means the PDF has no usable text layer. */
const MIN_TEXT_CHARS = 40;
/** Active heartbeat lease duration before a background job can be reclaimed. */
const LEASE_DURATION_MS = 60_000;
/**
 * A sleeping Render extractor took 53 s to answer /health (measured
 * 2026-10-14), longer than one 20 s upload attempt. An unreachable extractor
 * is therefore retried on later polls for this long before the job fails.
 */
const EXTRACTOR_WARMUP_BUDGET_MS = 120_000;
/** Minimum gap between handoff retries while waiting for the extractor. */
const EXTRACTOR_RETRY_GAP_MS = 3_000;
/** Total budget for an extractor OCR job before we give up. */
const OCR_DEADLINE_MS = 5 * 60_000;

export type ResumeReviewCandidate = {
  candidateId: string;
  /** profile = one onboarding profile field (see `field`); link = one typed profile URL. */
  category: string;
  value: string;
  sourceSpan: string;
  field?: string;
  recordData?: Record<string, unknown>;
  /** Decision the student made on the same item in an earlier upload of this file. */
  previousDecision?: "confirmed" | "rejected";
  previousValue?: string;
};

export type ResumeReviewPayload = {
  reviewCandidates: ResumeReviewCandidate[];
  structured: unknown;
  extractedProfile: unknown;
  discoveredProfiles: unknown;
  links: unknown;
  resume: unknown;
  extractionMeta: Record<string, unknown>;
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

/**
 * Loggable view of an error. Drizzle query errors embed the bound parameters
 * (CV text, phone numbers, ids) in their message, so only the driver's own
 * message and SQLSTATE are kept.
 */
export function sanitizeError(err: unknown): { errorClass: string; sqlState: string | null; message: string } {
  if (!(err instanceof Error)) return { errorClass: typeof err, sqlState: null, message: typeof err === "string" ? err.slice(0, 300) : "" };
  let inner: unknown = err;
  for (let i = 0; i < 5 && inner instanceof Error && (inner as { cause?: unknown }).cause instanceof Error; i++) inner = (inner as { cause?: unknown }).cause;
  const code = [inner, err].map((e) => (e as { code?: unknown }).code).find((c) => typeof c === "string" && /^[0-9A-Z]{5}$/.test(c)) as string | undefined;
  const raw = (inner as Error).message.split(/\n?params:/)[0];
  const message = /^Failed query:/.test(raw) ? "Failed query" : raw;
  return { errorClass: (inner as Error).constructor.name, sqlState: code ?? null, message: message.slice(0, 300) };
}

async function fail(job: SourceProcessingJob, code: ResumeFailureCode, cause?: unknown) {
  const f = FAILURES[code];
  console.error("[resume-pipeline] job failed", {
    jobId: job.id,
    code,
    cause: cause === undefined || cause === null ? null : sanitizeError(cause),
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
    await markRunFailed(job.personId, documentId, job.id, code).catch((e) =>
      console.warn("[resume-pipeline] could not record failed run", { jobId: job.id, error: sanitizeError(e) }));
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
  aiConsent?: boolean;
}): Promise<{ jobId: string; documentId: string }> {
  const documentId = crypto.randomUUID();
  await ObjectStorageService.storeDocument({
    documentId,
    personId: params.personId,
    filename: params.filename,
    mimeType: params.mimeType,
    buffer: params.bytes,
  });
  const jobId = await queueJobForDocument(params.personId, documentId, params.filename, params.aiConsent);
  return { jobId, documentId };
}

/** Re-queues an already-stored document (retry without asking for the file again). Preserves prior AI consent scope without broadening. */
export async function requeueResumeDocument(personId: string, documentId: string, explicitAiConsent?: boolean): Promise<string | null> {
  const db = await getDb();
  const [doc] = await db
    .select()
    .from(resumeDocuments)
    .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)))
    .limit(1);
  if (!doc || doc.status === "deleted") return null;
  const docMeta = (doc.metadata as Record<string, unknown>) || {};
  const aiConsent = explicitAiConsent !== undefined ? explicitAiConsent : docMeta.aiConsent === true;
  return queueJobForDocument(personId, documentId, doc.filename, aiConsent);
}

async function queueJobForDocument(personId: string, documentId: string, filename: string, aiConsent?: boolean): Promise<string> {
  const isAiConsented = aiConsent === true;
  const jobId = await SourceProcessingJobService.startJob({
    personId,
    sourceId: "resume",
    stage: "acquire",
    status: "queued",
    metadata: { documentId, filename, aiConsent: isAiConsented },
  });
  const db = await getDb();
  await db
    .update(resumeDocuments)
    .set({
      status: "queued",
      metadata: sql`coalesce(${resumeDocuments.metadata}, '{}'::jsonb) || ${JSON.stringify({ jobId, aiConsent: isAiConsented })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));
  return jobId;
}

export type ResumeJobStatusResult = {
  ok: boolean;
  httpStatus: number;
  documentId?: string;
  jobId?: string;
  filename?: string;
  status?: string;
  stage?: string;
  errorCode?: string | null;
  message?: string | null;
  retryable?: boolean;
  result?: ResumeReviewPayload | null;
  shouldNudge?: boolean;
  code?: string;
  error?: string;
};

export function isJobLeaseExpired(job: SourceProcessingJob): boolean {
  const m = meta(job);
  const lastActive =
    typeof m.heartbeatAt === "number"
      ? m.heartbeatAt
      : typeof m.claimedAt === "number"
      ? m.claimedAt
      : 0;
  if (!lastActive) return true;
  if (job.stage === "awaiting_extractor") {
    return Date.now() - lastActive >= EXTRACTOR_RETRY_GAP_MS;
  }
  return Date.now() - lastActive > LEASE_DURATION_MS;
}

/**
 * Fast, read-only status inspection. Does NOT run extraction or OCR inline.
 * Safe to call concurrently from multiple browser tabs.
 */
export async function getResumeJobStatus(
  documentId: string,
  personId: string,
  requestedJobId?: string | null
): Promise<ResumeJobStatusResult> {
  const doc = await loadOwnedResumeDocument(documentId, personId);
  if (!doc) {
    return { ok: false, httpStatus: 404, code: "NOT_FOUND", error: "Document not found." };
  }

  const mDoc = docMeta(doc);
  const jobId = requestedJobId || (mDoc.jobId as string | undefined);
  if (!jobId) {
    return { ok: false, httpStatus: 404, code: "NO_JOB", error: "This document has no processing job." };
  }

  let job = await SourceProcessingJobService.getJobForPerson(jobId, personId);
  if (!job || job.sourceId !== "resume" || (job.metadata as Record<string, unknown>)?.documentId !== documentId) {
    return { ok: false, httpStatus: 404, code: "NOT_FOUND", error: "Processing job not found." };
  }

  // Persist stage recovery:
  // If the document already has a review payload saved in resumeDocuments, but the job is stuck in persist stage:
  if (job.status === "processing" && job.stage === "persist" && doc.status === "review_ready" && mDoc.review) {
    const recovered = await SourceProcessingJobService.transition({
      jobId: job.id,
      personId,
      from: ["processing"],
      to: "review_ready",
      stage: "review",
      errorCode: null,
      errorMessage: null,
      resultReference: `resume:${documentId}`,
      metadata: { heartbeatAt: Date.now(), recoveredFromPersist: true },
    });
    if (recovered) job = recovered;
  }

  const ready = job.status === "review_ready" || job.status === "completed";
  const failure = failureInfo(job.errorCode);
  const shouldNudge =
    job.status === "queued" ||
    (job.status === "processing" && isJobLeaseExpired(job));

  return {
    ok: true,
    httpStatus: 200,
    documentId,
    jobId: job.id,
    filename: doc.filename,
    status: job.status,
    stage: job.stage,
    errorCode: job.errorCode,
    message: job.errorMessage,
    retryable: failure ? failure.retryable : Boolean((job.metadata as Record<string, unknown>)?.retryable),
    result: (ready || job.status === "review_ready" || job.status === "completed") && mDoc.review ? (mDoc.review as ResumeReviewPayload) : null,
    shouldNudge,
  };
}

/**
 * Executes a resume job asynchronously in the background.
 * Uses atomic transitions and leases so concurrent executions never duplicate work.
 */
export async function processResumeJob(jobId: string, personId: string): Promise<SourceProcessingJob | null> {
  let job = await SourceProcessingJobService.getJobForPerson(jobId, personId);
  if (!job || job.sourceId !== "resume") return job;

  if (["review_ready", "completed", "failed", "timed_out", "cancelled", "retry"].includes(job.status)) {
    return job;
  }

  try {
    if (job.status === "queued") {
      const claimed = await SourceProcessingJobService.transition({
        jobId,
        personId,
        from: ["queued"],
        to: "processing",
        stage: "parse",
        metadata: { claimedAt: Date.now(), heartbeatAt: Date.now() },
      });
      if (!claimed) return SourceProcessingJobService.getJobForPerson(jobId, personId);
      job = claimed;
      await runInProcessStep(job);
    } else if (job.status === "processing") {
      const m = meta(job);
      if (job.stage === "extract" && typeof m.extractorDocumentId === "string") {
        await pollExtractor(job, m.extractorDocumentId);
      } else if (job.stage === "awaiting_extractor") {
        const lastClaimed = typeof m.claimedAt === "number" ? m.claimedAt : 0;
        if (Date.now() - lastClaimed >= EXTRACTOR_RETRY_GAP_MS && (await reclaimAwaitingJob(job, lastClaimed))) {
          await runInProcessStep(job);
        }
      } else if (job.stage === "persist") {
        const documentId = meta(job).documentId as string;
        const db = await getDb();
        const [doc] = await db
          .select()
          .from(resumeDocuments)
          .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)))
          .limit(1);
        if (doc && doc.status === "review_ready" && docMeta(doc).review) {
          await SourceProcessingJobService.transition({
            jobId: job.id,
            personId,
            from: ["processing"],
            to: "review_ready",
            stage: "review",
            resultReference: `resume:${documentId}`,
            metadata: { recoveredFromPersist: true, heartbeatAt: Date.now() },
          });
        } else if (isJobLeaseExpired(job)) {
          await fail(job, "PERSIST_FAILED", "Persistence interrupted before review could be recorded.");
        }
      } else if (isJobLeaseExpired(job)) {
        const retryCount = Number(job.retryCount || 0);
        if (retryCount >= 3) {
          await fail(job, "PROCESSING_STALLED", `stage ${job.stage} lease expired after ${retryCount} retries`);
          return SourceProcessingJobService.getJobForPerson(jobId, personId);
        }
        const reclaimed = await SourceProcessingJobService.transition({
          jobId,
          personId,
          from: ["processing"],
          to: "processing",
          stage: job.stage as ProcessingStage,
          incrementRetry: true,
          metadata: { claimedAt: Date.now(), heartbeatAt: Date.now() },
        });
        if (reclaimed) {
          job = reclaimed;
          if (job.stage === "parse") {
            await runInProcessStep(job);
          } else if (job.stage === "extract" && typeof meta(job).extractorDocumentId === "string") {
            await pollExtractor(job, meta(job).extractorDocumentId as string);
          }
        }
      }
    }
  } catch (err) {
    const fresh = await SourceProcessingJobService.getJobForPerson(jobId, personId);
    if (fresh) {
      await fail(fresh, err instanceof PipelineFailure ? err.code : "EXTRACTION_FAILED", err instanceof PipelineFailure ? err.cause : err);
    }
  }

  return SourceProcessingJobService.getJobForPerson(jobId, personId);
}

/**
 * Advances a resume job by at most one step. Backward-compatible wrapper around processResumeJob.
 */
export async function advanceResumeJob(jobId: string, personId: string): Promise<SourceProcessingJob | null> {
  return processResumeJob(jobId, personId);
}

async function runInProcessStep(job: SourceProcessingJob) {
  const documentId = meta(job).documentId as string;
  let doc;
  try {
    doc = await ObjectStorageService.getDocument(documentId, job.personId);
  } catch (err) {
    throw new PipelineFailure("DOCUMENT_RETRIEVAL_FAILED", err);
  }
  const name = doc.filename.toLowerCase();
  const extension = name.endsWith(".docx") ? "docx" : /\.(?:png|jpe?g)$/.test(name) ? "image" : "pdf";

  // Verification switch: send text-layer PDFs through the OCR branch too.
  const forceOcr = extension === "pdf" && process.env.RESUME_FORCE_OCR === "true";
  let parsed: Awaited<ReturnType<typeof readDocumentText>> = { text: "", hyperlinks: [], pageCount: 1 };
  if (extension !== "image") {
    try {
      parsed = await readDocumentText(doc.buffer, extension);
    } catch (err) {
      throw new PipelineFailure("PARSE_FAILED", err);
    }
  }

  if (extension !== "image" && !forceOcr && parsed.text.replace(/\s/g, "").length >= MIN_TEXT_CHARS) {
    await finalize(job, documentId, {
      text: parsed.text,
      hyperlinks: parsed.hyperlinks,
      fileFormat: extension,
      pageCount: parsed.pageCount || 1,
      ocrUsed: false,
      via: extension === "docx" ? "docx" : "native-pdf",
      lines: parsed.lines,
    });
    return;
  }

  if (extension === "docx") throw new PipelineFailure("NATIVE_TEXT_UNAVAILABLE");

  if (!ExtractorServiceClient.isConfigured()) {
    throw new PipelineFailure("OCR_SERVICE_NOT_CONFIGURED");
  }

  // Hand the scan to the Render extractor.
  try {
    const identity = await resolveExtractorIdentity(job.personId);
    const uploaded = await ExtractorServiceClient.uploadResume({
      fileBuffer: doc.buffer,
      filename: doc.filename,
      mimeType: doc.mimeType || "application/pdf",
      identity,
      jobId: job.id,
    });
    await ExtractorServiceClient.startExtraction(uploaded.document_id, identity, { forceOcr });
    await SourceProcessingJobService.updateStage(job.id, job.personId, "extract", {
      extractorDocumentId: uploaded.document_id,
      submittedAt: Date.now(),
      heartbeatAt: Date.now(),
    });
    const db = await getDb();
    await db
      .update(resumeDocuments)
      .set({
        status: "processing",
        metadata: sql`coalesce(${resumeDocuments.metadata}, '{}'::jsonb) || ${JSON.stringify({ extractorDocumentId: uploaded.document_id })}::jsonb`,
      })
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, job.personId)));

    // Immediately begin polling extractor in this background context
    await pollExtractor(job, uploaded.document_id);
  } catch (err) {
    if (err instanceof PipelineFailure) throw err;
    const code = classifyExtractorError(err);
    const since = typeof meta(job).extractorWaitSince === "number" ? (meta(job).extractorWaitSince as number) : Date.now();
    if (code === "OCR_SERVICE_UNREACHABLE" && Date.now() - since < EXTRACTOR_WARMUP_BUDGET_MS) {
      await SourceProcessingJobService.updateStage(job.id, job.personId, "awaiting_extractor", {
        extractorWaitSince: since,
        claimedAt: Date.now(),
        heartbeatAt: Date.now(),
        extractorAttempts: Number(meta(job).extractorAttempts || 0) + 1,
      });
      return;
    }
    throw new PipelineFailure(code, err);
  }
}

async function pollExtractor(job: SourceProcessingJob, extractorDocumentId: string) {
  const m = meta(job);
  const identity = await resolveExtractorIdentity(job.personId);
  const submittedAt = typeof m.submittedAt === "number" ? m.submittedAt : Date.now();
  const documentId = (m.documentId as string) || job.resultReference?.replace(/^resume:/, "");
  if (!documentId) {
    throw new PipelineFailure("DOCUMENT_RETRIEVAL_FAILED", "Document ID not found in job metadata");
  }

  const loopStart = Date.now();
  while (Date.now() - loopStart < 22_000) {
    if (Date.now() - submittedAt > OCR_DEADLINE_MS) {
      throw new PipelineFailure("OCR_TIMEOUT", "OCR deadline exceeded");
    }

    let status;
    try {
      status = await ExtractorServiceClient.getStatus(extractorDocumentId, identity);
    } catch (err) {
      console.warn("[resume-pipeline] extractor status poll warning", { jobId: job.id, error: err instanceof Error ? err.message : err });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    await SourceProcessingJobService.updateStage(job.id, job.personId, "extract", {
      heartbeatAt: Date.now(),
    });

    if (status.status === "failed") {
      let code: ResumeFailureCode = "OCR_EXTRACTION_ERROR";
      if (status.error_code === "OCR_ENGINE_UNAVAILABLE") code = "OCR_ENGINE_UNAVAILABLE";
      else if (status.error_code === "OCR_TIMEOUT") code = "OCR_TIMEOUT";
      else if (status.error_code === "OCR_NO_TEXT") code = "OCR_NO_TEXT";
      throw new PipelineFailure(code, { extractorErrorCode: status.error_code ?? null, warnings: status.warnings });
    }

    if (status.status === "completed" || status.status === "partial") {
      const claimed = await SourceProcessingJobService.transition({
        jobId: job.id, personId: job.personId, from: ["processing"], fromStage: "extract",
        to: "processing", stage: "persist", metadata: { claimedAt: Date.now(), heartbeatAt: Date.now() },
      });
      if (!claimed) return;

      let text: string;
      let hyperlinks: string[];
      let pageCount: number;
      let renderProfile: ExtractorProfileV2 | null = null;
      let ocrLines: LayoutLineMeta[] | undefined;
      let pageQuality: Record<number, number> | undefined;
      try {
        const raw = await ExtractorServiceClient.getRawText(extractorDocumentId, identity);
        ({ text, hyperlinks, pageCount, lines: ocrLines, pageQuality } = textFromExtractorPayload(raw));

        // Retrieve Render Schema v2.0 structured profile
        try {
          const docView = await ExtractorServiceClient.getDocument(extractorDocumentId, identity);
          if (docView && docView.profile) {
            renderProfile = docView.profile;
          }
        } catch (profileErr) {
          console.warn("[resume-pipeline] could not fetch Render profile view, will use raw text", profileErr);
        }
      } catch (err) {
        throw new PipelineFailure(classifyExtractorError(err), err);
      }

      if (text.replace(/\s/g, "").length < MIN_TEXT_CHARS) {
        throw new PipelineFailure("OCR_NO_TEXT", { warnings: status.warnings });
      }

      await finalize(claimed, documentId, {
        text,
        hyperlinks,
        fileFormat: /\.(?:png|jpe?g)$/i.test(String(m.filename ?? "")) ? "image" : "pdf",
        pageCount,
        ocrUsed: true,
        via: "extractor-ocr",
        renderProfile,
        lines: ocrLines,
        pageQuality,
      });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/** Reading-order text, links and line metadata from the extractor's /text payload (OCR word boxes). */
export function textFromExtractorPayload(raw: { raw_text?: string; pages?: Array<{ page?: number; links?: Array<{ url: string }>; quality?: { mean_confidence?: number } } & Record<string, any>> }): { text: string; hyperlinks: string[]; pageCount: number; lines?: LayoutLineMeta[]; pageQuality?: Record<number, number> } {
  const hyperlinks = [...new Set((raw.pages || []).flatMap((p) => (p.links || []).map((l) => l.url)).filter((u) => /^https?:/i.test(u)))];
  const pageQuality: Record<number, number> = {};
  for (const p of raw.pages || []) if (typeof p.quality?.mean_confidence === "number" && typeof p.page === "number") pageQuality[p.page] = p.quality.mean_confidence;
  const quality = Object.keys(pageQuality).length ? pageQuality : undefined;
  if (raw.pages?.length) {
    const order = reconstructReadingOrderDetailed(raw.pages as never, hyperlinks);
    if (order.text.replace(/\s/g, "").length >= MIN_TEXT_CHARS || !raw.raw_text) {
      return { text: order.text, hyperlinks, pageCount: raw.pages.length, lines: order.lines, pageQuality: quality };
    }
  }
  return { text: raw.raw_text || "", hyperlinks, pageCount: raw.pages?.length || 1, pageQuality: quality };
}

/**
 * Field-level review candidates for onboarding profile fields and typed links.
 * They are not Person 360 records: accepting one writes to the onboarding
 * draft only, so they never go through /apply.
 */
function profileCandidates(extraction: ResumeExtractionResult, text: string): ResumeReviewCandidate[] {
  const lines = text.split("\n");
  const span = (v: string) => lines.find((l) => l.toLowerCase().includes(v.toLowerCase()))?.trim().slice(0, 300) || v;
  const p = extraction.extractedProfile || {};
  const out: ResumeReviewCandidate[] = [];
  const hasStructuredEdu = Boolean(extraction.extracted?.education && extraction.extracted.education.length > 0);
  const fields: Array<[string, string | number | undefined]> = [
    ["fullName", p.fullName], ["email", p.email], ["mobile", p.mobile], ["location", p.location],
  ];
  if (!hasStructuredEdu) {
    fields.push(
      ["institution", p.institution], ["degree", p.degree], ["specialization", p.specialization],
      ["expectedGraduationYear", p.expectedGraduationYear],
    );
  }
  for (const [field, value] of fields) {
    if (value === undefined || value === "") continue;
    out.push({ candidateId: `profile_${field}`, category: "profile", field, value: String(value), sourceSpan: span(String(value)) });
  }
  // Digital footprint links are handed off to DFI rather than generic CV review cards
  return out;
}

export interface ExtractionInput {
  text: string;
  hyperlinks: string[];
  fileFormat: string;
  pageCount: number;
  ocrUsed: boolean;
  via: string;
  renderProfile?: ExtractorProfileV2 | null;
  /** Per-line page/heading/height metadata aligned with `text`. */
  lines?: LayoutLineMeta[];
  /** Mean OCR word confidence per page (0-1), when the extractor reports it. */
  pageQuality?: Record<number, number>;
}

async function finalize(job: SourceProcessingJob, documentId: string, input: ExtractionInput) {
  const { personId } = job;
  await SourceProcessingJobService.updateStage(job.id, personId, "validate", { heartbeatAt: Date.now() });
  const t0 = Date.now();
  const built = await buildResumeReview(input, { documentId, personId, aiConsent: meta(job).aiConsent === true, jobId: job.id });
  const { review, profile, reviewCandidates, extractedInterpretation, mergedDiscoveredProfiles, llmEnrichmentSuccess } = built;
  const extractMs = Date.now() - t0;

  await SourceProcessingJobService.updateStage(job.id, personId, "persist", { heartbeatAt: Date.now() });

  try {
    // Records first: a retry re-upserts the same ids, and decided rows are left alone.
    const t1 = Date.now();
    let persisted: Awaited<ReturnType<typeof persistExtraction>>;
    try {
      persisted = await persistExtraction({
        personId, documentId, jobId: job.id, candidates: reviewCandidates as never,
        quality: built.extraction.quality, llmUsed: llmEnrichmentSuccess, timings: { extractMs },
      });
    } catch (persistErr) {
      const safe = sanitizeError(persistErr);
      // 42P01 undefined_table, 42703 undefined_column: the deployed code is ahead of the schema.
      const schemaBehind = safe.sqlState === "42P01" || safe.sqlState === "42703";
      console.error("[resume-pipeline] persist stage failed", {
        jobId: job.id, documentId, runId: runIdForJob(job.id),
        stage: "persist_records", operation: "upsert", committed: false, ...safe,
        ...(schemaBehind ? { hint: "Database schema is behind the code: run `npm run db:migrate` against this database." } : {}),
      });
      throw persistErr;
    }
    review.extractionMeta.persistMs = Date.now() - t1;
    review.extractionMeta.runId = persisted.runId;
    for (const c of review.reviewCandidates) {
      const prior = persisted.carried.get(c.candidateId);
      if (prior) Object.assign(c, { previousDecision: prior.state, ...(prior.userValue ? { previousValue: prior.userValue } : {}) });
    }
    // Snapshot first: /apply and onboarding completion validate claims against it.
    await saveResumeCandidates(personId, documentId, extractedInterpretation, input.text);
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
    if (updated.length !== 1) {
      console.error("[resume-pipeline] persist stage failed", { jobId: job.id, documentId, stage: "persist_snapshot", operation: "update", committed: false, errorClass: "NotFound", sqlState: null, message: "resume_documents row not found for owner" });
      throw new Error(`resume_documents row ${documentId} not found for owner`);
    }
  } catch (err) {
    throw new PipelineFailure("PERSIST_FAILED", err);
  }

  await SourceProcessingJobService.transition({
    jobId: job.id, personId, from: ["processing"], to: "review_ready", stage: "review",
    errorCode: null, errorMessage: null,
    resultReference: `resume:${documentId}`,
    metadata: {
      candidates: reviewCandidates.length,
      via: input.via,
      heartbeatAt: Date.now(),
      llmEnriched: llmEnrichmentSuccess,
      deterministicCoverage: extractedInterpretation ? Object.keys(extractedInterpretation).length : 0,
    },
  });

  await seedDraftFromResume(personId, documentId, extractedInterpretation, mergedDiscoveredProfiles);
}

/**
 * Text in, reviewable extraction out: deterministic baseline, optional
 * consented LLM enrichment, link discovery and review candidates. No database
 * writes, so the evaluation suite runs exactly this code.
 */
export async function buildResumeReview(
  input: ExtractionInput,
  ctx: { documentId: string; personId: string; aiConsent: boolean; jobId?: string }
) {
  const { documentId, personId } = ctx;
  const job = { id: ctx.jobId ?? "eval" };

  // 1. Establish Tier 1 Deterministic Baseline via Source-Grounded Reconciliation
  const method = input.ocrUsed ? "ocr" : input.fileFormat === "docx" ? "docx" : input.fileFormat === "pdf" ? "native_pdf" : "text";
  const tsBaseline = extractResumeDeterministicResult(input.text, input.hyperlinks, {
    lines: input.lines, method, pageQuality: input.pageQuality, pageCount: input.pageCount,
  });
  // The OCR text from Render goes through the same engine as text-layer files.
  // Render's own profile is a fallback only: merging two parses of the same
  // text duplicated records and let the weaker parse overwrite fields.
  let baseline: ResumeExtractionResult = tsBaseline;
  if (!(tsBaseline.success && tsBaseline.extracted) && input.renderProfile) {
    const renderResult = adaptRenderProfileToInterpretation(input.renderProfile, input.text);
    if (renderResult.success && renderResult.extracted) baseline = renderResult;
  }

  // 2. Evaluate Optional AI Enrichment
  const userConsent = ctx.aiConsent;
  const decision = shouldEnrichWithLLM(baseline.extracted, { consent: userConsent, rawText: input.text });

  let extraction: ResumeExtractionResult = baseline;
  let llmEnrichmentAttempted = false;
  let llmEnrichmentSuccess = false;
  let llmErrorNotice: string | undefined;

  if (decision.shouldEnrich) {
    llmEnrichmentAttempted = true;
    try {
      const enrichedResult = await extractResumeStructured(input.text, personId);
      if (enrichedResult.success && enrichedResult.extracted) {
        extraction = mergeExtractionResults(baseline, enrichedResult, input.text);
        llmEnrichmentSuccess = true;
      } else {
        llmErrorNotice = enrichedResult.error;
        console.warn("[resume-pipeline] optional LLM enrichment unavailable, proceeding with deterministic baseline", {
          jobId: job.id,
          errorKind: enrichedResult.errorKind,
          error: enrichedResult.error,
        });
        // Non-blocking AI: preserve successful deterministic extraction
        extraction = baseline;
      }
    } catch (err) {
      llmErrorNotice = err instanceof Error ? err.message : String(err);
      console.warn("[resume-pipeline] exception during optional LLM enrichment, falling back to deterministic baseline", {
        jobId: job.id,
        error: llmErrorNotice,
      });
      extraction = baseline;
    }
  } else {
    console.info("[resume-pipeline] optional LLM enrichment skipped", {
      jobId: job.id,
      reason: decision.reason,
    });
  }

  // 3. Fallback verification: prefer deterministic baseline before failing
  if (!extraction.success || !extraction.extracted) {
    if (baseline.success && baseline.extracted) {
      extraction = baseline;
    } else {
      throw new PipelineFailure(
        extraction.errorKind === "quota" ? "AI_QUOTA_EXCEEDED" : "EXTRACTION_FAILED",
        extraction.error || llmErrorNotice
      );
    }
  }

  // 4. Run deterministic discovery to catch embedded PDF annotations, DOCX links, and multi-line URLs
  const deterministicFootprints = discoverFootprintsFromResume({
    text: input.text,
    hyperlinks: input.hyperlinks,
    documentId,
  });

  const isInvalidRootUrl = (u?: string | null) =>
    !u ||
    /^https?:\/\/(?:www\.)?github\.com(?:\/github)?\/?$/i.test(u) ||
    /^https?:\/\/(?:www\.)?linkedin\.com(?:\/in|\/pub)?\/?$/i.test(u);

  if (extraction.links) {
    extraction.links = extraction.links.filter((l) => !isInvalidRootUrl(l.url));
  }

  const mergedDiscoveredProfiles: Record<string, string> = {};
  if (extraction.discoveredProfiles) {
    for (const [k, v] of Object.entries(extraction.discoveredProfiles)) {
      if (v && !isInvalidRootUrl(v)) mergedDiscoveredProfiles[k] = v;
    }
  }
  for (const fp of deterministicFootprints) {
    if ((!mergedDiscoveredProfiles[fp.provider] || isInvalidRootUrl(mergedDiscoveredProfiles[fp.provider])) && fp.normalizedUrl && !isInvalidRootUrl(fp.normalizedUrl)) {
      mergedDiscoveredProfiles[fp.provider] = fp.normalizedUrl;
    }
  }

  const extractedInterpretation = extraction.extracted;
  if (!extractedInterpretation) {
    throw new PipelineFailure("EXTRACTION_FAILED", "Extracted output is empty");
  }
  if (extractedInterpretation.digitalFootprints) {
    extractedInterpretation.digitalFootprints = extractedInterpretation.digitalFootprints.filter(
      (df) => !isInvalidRootUrl(df.url)
    );
  }

  // 5. Review Candidates
  const reviewCandidates = [...profileCandidates(extraction, input.text), ...resumeCandidates(extractedInterpretation, input.text)];
  if (reviewCandidates.length === 0) throw new PipelineFailure("NO_CLAIMS_FOUND");
  const profile = buildProfileV2({
    documentId,
    extraction,
    fileFormat: input.fileFormat,
    pageCount: input.pageCount,
    ocrUsed: input.ocrUsed,
  });

  const review: ResumeReviewPayload = {
    reviewCandidates,
    structured: extractedInterpretation,
    extractedProfile: extraction.extractedProfile ?? null,
    discoveredProfiles: mergedDiscoveredProfiles,
    links: extraction.links ?? [],
    resume: extraction.resume ?? null,
    extractionMeta: {
      success: true,
      provider: extraction.provider,
      modelUsed: extraction.modelUsed,
      promptVersion: extraction.promptVersion,
      llmUsed: llmEnrichmentSuccess,
      llmAttempted: llmEnrichmentAttempted,
      llmSkippedReason: !decision.shouldEnrich ? decision.reason : undefined,
      llmError: llmErrorNotice,
      ocrUsed: input.ocrUsed,
      quality: extraction.quality ?? baseline.quality,
      schemaVersion: extraction.quality?.schemaVersion ?? baseline.quality?.schemaVersion,
      latencyMs: extraction.latencyMs,
      truncated: extraction.truncated,
      via: input.via,
      deterministicBaselineUsed: true,
    },
  };

  return { review, profile, reviewCandidates, extractedInterpretation, mergedDiscoveredProfiles, llmEnrichmentSuccess, extraction };
}

/**
 * Seeds the onboarding draft with the CV's candidates (Task 1.1.5), as a
 * "system" write: entries are unioned by key and scalars only fill empty
 * fields, so it never overwrites what the student already typed, even when
 * it lands mid-autosave (Task 1.2.4). Everything is a candidate until the
 * student confirms it on the review screen. Best-effort: the review payload is
 * already persisted, so a failure here is logged, not surfaced.
 */
async function seedDraftFromResume(
  personId: string,
  documentId: string,
  x: ResumeInterpretationOutput,
  discoveredProfiles?: Record<string, string>
) {
  try {
    const { writeOnboardingDraft } = await import("./onboarding-v2-service");
    const firstEdu = x.education[0];
    await writeOnboardingDraft(personId, {
      resumeDocumentId: documentId,
      ...(discoveredProfiles && Object.keys(discoveredProfiles).length > 0
        ? { discoveredResumeProfiles: discoveredProfiles }
        : {}),
      institution: firstEdu?.institution || "",
      degree: firstEdu?.degree || "",
      education: x.education.map((e) => ({
        institution: e.institution, degree: e.degree || undefined, fieldOfStudy: e.fieldOfStudy, graduationYear: e.graduationYear,
        startDate: e.startDate, endDate: e.endDate, gpa: e.gpa, percentage: e.percentage, academicLevel: e.academicLevel,
        status: "candidate", source: "resume",
      })),
      experiences: x.experience.map((e) => ({
        company: e.company, role: e.role, type: e.type, startDate: e.startDate, endDate: e.endDate, duration: e.duration,
        highlights: e.highlights, status: "candidate", source: "resume",
      })),
      projects: x.projects.map((p) => ({
        id: `resume_${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60)}`,
        title: p.title, description: p.description || "", technologies: p.technologies || [], sources: ["resume"],
        status: "candidate", url: p.repositoryUrl || "",
      })),
      techCandidates: x.skills.map((s) => ({ name: s.name, source: "resume", provenance: "resume_extracted" })),
    }, { origin: "system" });
  } catch (error) {
    console.error(JSON.stringify({ event: "resume.draft_seed_failed", documentId, error: error instanceof Error ? error.message : String(error) }));
  }
}

export function failureInfo(code: string | null | undefined) {
  return code && code in FAILURES ? FAILURES[code as ResumeFailureCode] : null;
}

/** Compare-and-swap on claimedAt so two concurrent polls never both re-upload. */
async function reclaimAwaitingJob(job: SourceProcessingJob, claimedAt: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(sourceProcessingJobs)
    .set({ metadata: sql`${sourceProcessingJobs.metadata} || ${JSON.stringify({ claimedAt: Date.now(), heartbeatAt: Date.now() })}::jsonb` })
    .where(and(
      eq(sourceProcessingJobs.id, job.id),
      eq(sourceProcessingJobs.personId, job.personId),
      eq(sourceProcessingJobs.stage, "awaiting_extractor"),
      sql`(${sourceProcessingJobs.metadata}->>'claimedAt')::bigint = ${claimedAt}`
    ))
    .returning();
  if (rows.length === 1) job.metadata = rows[0].metadata;
  return rows.length === 1;
}
