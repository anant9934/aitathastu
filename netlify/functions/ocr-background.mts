/**
 * AI TATHASTU — NETLIFY BACKGROUND FUNCTION: Async OCR Job Processor
 *
 * Invoked via POST /.netlify/functions/ocr-background by /api/resume/ocr-trigger
 *
 * SECURITY:
 * - OCR_INTERNAL_SECRET required in Authorization header
 * - personId/documentId ownership validated via ObjectStorageService (Neon lookup)
 * - No student PII, document contents, or extracted text in logs
 * - No PDF bytes in the invocation body — only job reference IDs
 *
 * Netlify Background Functions: returns 202 immediately, runs up to 15 minutes.
 */

import type { Config } from "@netlify/functions";

export default async function handler(req: Request): Promise<Response> {
  const startTime = Date.now();

  // --- Step 1: Validate internal invocation secret ---
  const authHeader = req.headers.get("authorization") || "";
  const internalSecret = (process.env.OCR_INTERNAL_SECRET || "").trim();

  if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
    console.error("[OCR-BG] Unauthorized invocation");
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Step 2: Parse job reference (NO PDF bytes in body) ---
  let jobId: string;
  let personId: string;
  let documentId: string;

  try {
    const body = (await req.json()) as {
      jobId?: string;
      personId?: string;
      documentId?: string;
    };
    if (!body.jobId || !body.personId || !body.documentId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing jobId, personId, or documentId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    jobId = body.jobId;
    personId = body.personId;
    documentId = body.documentId;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Return 202 immediately — Netlify continues processing async
  processOcrJob({ jobId, personId, documentId, startTime }).catch((err) => {
    console.error("[OCR-BG] Unhandled error", {
      jobId,
      errorType: err instanceof Error ? err.name : typeof err,
    });
  });

  return new Response(
    JSON.stringify({ ok: true, status: "PROCESSING", jobId }),
    { status: 202, headers: { "Content-Type": "application/json" } }
  );
}

async function processOcrJob({
  jobId,
  personId,
  documentId,
  startTime,
}: {
  jobId: string;
  personId: string;
  documentId: string;
  startTime: number;
}) {
  // Dynamic imports for Netlify bundle compatibility
  const { getDb, resumeDocuments } = await import("../../lib/db/index.js");
  const { eq, and } = await import("drizzle-orm");
  const { ObjectStorageService } = await import("../../lib/storage/object-storage.js");
  const { SourceProcessingJobService } = await import(
    "../../lib/services/source-processing-job-service.js"
  );

  // --- Step 3: Verify job ownership ---
  const existingJob = await SourceProcessingJobService.getJobForPerson(jobId, personId).catch(
    () => null
  );
  if (!existingJob) {
    console.warn("[OCR-BG] Job not found or ownership mismatch", { jobId });
    return;
  }
  if (existingJob.status === "completed") {
    console.warn("[OCR-BG] Job already completed, skipping", { jobId });
    return;
  }

  // --- Step 4: Mark job as running ---
  await SourceProcessingJobService.updateStage(jobId, personId, "acquire").catch(() => null);

  // --- Step 5: Retrieve document from Neon blob storage ---
  let docBuffer: Buffer;
  let mimeType: string;

  try {
    await SourceProcessingJobService.updateStage(jobId, personId, "parse").catch(() => null);
    const doc = await ObjectStorageService.getDocument(documentId, personId);
    docBuffer = doc.buffer;
    mimeType = doc.mimeType;
  } catch (retrieveErr) {
    console.error("[OCR-BG] Document retrieval failed", {
      jobId,
      errorType: retrieveErr instanceof Error ? retrieveErr.name : typeof retrieveErr,
    });
    await SourceProcessingJobService.failJob({
      jobId,
      personId,
      errorCode: "DOCUMENT_RETRIEVAL_FAILED",
      errorMessage: "Could not retrieve the document for processing.",
      canRetry: true,
    }).catch(() => null);
    return;
  }

  // --- Step 6: Run Node.js OCR pipeline ---
  try {
    await SourceProcessingJobService.updateStage(jobId, personId, "extract").catch(() => null);

    const { parseResumeDocument } = await import(
      "../../lib/services/document-parser-service.js"
    );

    const extension: "pdf" | "docx" = mimeType.includes("pdf")
      ? "pdf"
      : mimeType.includes("docx") || mimeType.includes("officedocument")
      ? "docx"
      : "pdf";

    // 45-second OCR timeout — generous budget for background processing
    const parsedDoc = await parseResumeDocument(docBuffer, extension, {
      enableOcr: true,
      ocrTimeoutMs: 45000,
    });

    // --- Step 7: Structured extraction ---
    await SourceProcessingJobService.updateStage(jobId, personId, "normalize").catch(() => null);

    const { extractResumeStructured } = await import(
      "../../lib/services/resume-extraction-service.js"
    );
    // Signature: (resumeText: string, _personId?: string, extraHyperlinks?: string[])
    const extraction = await extractResumeStructured(
      parsedDoc.text,
      personId,
      parsedDoc.hyperlinks
    );

    // --- Step 8: Persist to Neon ---
    await SourceProcessingJobService.updateStage(jobId, personId, "persist").catch(() => null);

    const db = await getDb();
    const processingSeconds = (Date.now() - startTime) / 1000;

    const docMetadata = {
      documentId,
      file_format: extension,
      page_count: parsedDoc.pageCount ?? 1,
      ocr_attempted: parsedDoc.ocrUsed || Boolean(parsedDoc.ocrFailed),
      ocr_used: parsedDoc.ocrUsed || false,
      text_quality: "good",
      processing_seconds: processingSeconds,
      extraction_methods: parsedDoc.ocrUsed ? ["native_pdf", "ocr"] : ["native_pdf"],
      parser_version: "2.0.0",
      model_version: "v3.9-zero-llm",
      warnings: parsedDoc.warnings || [],
      status: "completed",
    };

    await db
      .update(resumeDocuments)
      .set({
        status: "completed",
        extractedProfile: { extraction, metadata: docMetadata },
        metadata: docMetadata,
        updatedAt: new Date(),
      })
      .where(
        and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId))
      )
      .catch(() => null);

    // --- Step 9: Complete job ---
    await SourceProcessingJobService.completeJob({
      jobId,
      personId,
      resultReference: `resume:bg:${documentId}`,
      metadata: {
        ocr_used: parsedDoc.ocrUsed,
        processing_ms: Date.now() - startTime,
      },
    }).catch(() => null);

    console.log("[OCR-BG] Job completed", {
      jobId,
      ocr_used: parsedDoc.ocrUsed,
      duration_ms: Date.now() - startTime,
    });
  } catch (processingErr) {
    console.error("[OCR-BG] Pipeline error", {
      jobId,
      errorType: processingErr instanceof Error ? processingErr.name : typeof processingErr,
    });
    await SourceProcessingJobService.failJob({
      jobId,
      personId,
      errorCode: "OCR_PROCESSING_FAILED",
      errorMessage: "Document processing failed. Please retry or enter details manually.",
      canRetry: true,
    }).catch(() => null);
  }
}

export const config: Config = {
  background: true,
};
