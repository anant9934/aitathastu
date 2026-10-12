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

    const isNetlify = Boolean(process.env.NETLIFY || process.env.NETLIFY_CONTEXT);
    const hasRenderUrl = !isNetlify && !!(
      process.env.RESUME_EXTRACTOR_URL ||
      process.env.RESUME_EXTRACTOR_SERVICE_URL
    );

    let parsedDoc;
    try {
      parsedDoc = await parseResumeDocument(bytes, extension as "pdf" | "docx", {
        // The packaged Tesseract.js model can OCR these PDFs within the function
        // budget. Keep budget strictly bounded on Netlify (12s) to prevent gateway timeouts.
        enableOcr: true,
        ocrTimeoutMs: isNetlify ? 12000 : 15000,
      });
    } catch {
      return fail(
        "PARSE_FAILED",
        "We could not read this file. It may be scanned, protected, or damaged. Please enter details manually.",
        422
      );
    }

    const rawText = parsedDoc.text;

    // --- Render OCR Fallback (Non-Netlify only) ---
    // If bundled Tesseract.js cannot recover text and NOT on Netlify, try Render service.
    let renderDocId: string | null = null;
    if (!rawText.trim() || rawText.replace(/\s+/g, "").length < 40) {
      if (isNetlify || !hasRenderUrl) {
        // On Netlify: Do NOT block on external Render service (which causes 502 gateway timeouts).
        return fail(
          parsedDoc.ocrUsed ? "OCR_LOW_QUALITY" : "NATIVE_TEXT_UNAVAILABLE",
          parsedDoc.ocrUsed
            ? "We could not read the scanned pages clearly. Try a sharper scan or enter details manually."
            : "No readable text was found. Try exporting the document again or enter details manually.",
          422
        );
      }

      // Forward to Render for full OCR extraction
      try {
        const { ExtractorServiceClient } = await import("@/lib/services/extractor-service-client");
        await SourceProcessingJobService.updateStage(jobId, personId, "extract");

        const renderResult = await ExtractorServiceClient.uploadAndExtract({
          fileBuffer: bytes,
          filename: file.name,
          mimeType: file.type || (extension === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
          personId,
          role: "student",
        });

        const hasProfileRecords = Boolean(
          renderResult.profile?.groups &&
          Object.values(renderResult.profile.groups).some((arr: any) => Array.isArray(arr) && arr.length > 0)
        );

        if (!renderResult.ok || (!renderResult.raw_text?.trim() && !hasProfileRecords)) {
          return fail(
            "OCR_RENDER_EMPTY",
            "We could not read the scanned pages clearly. Try a sharper scan or enter details manually.",
            422
          );
        }

        renderDocId = renderResult.document_id;
        const renderText = renderResult.raw_text?.trim() ? renderResult.raw_text : "Extracted from scanned resume";

        // Continue extraction pipeline using Render's OCR text
        await SourceProcessingJobService.updateStage(jobId, personId, "validate");
        const { extractResumeStructured } = await import("@/lib/services/resume-extraction-service");
        const { resumeCandidates, saveResumeCandidates } = await import("@/lib/services/resume-review-service");
        const { resumeSuggestions, resumeDiscovery } = await import("@/lib/resume-suggestions");

        const legacySuggestions = resumeSuggestions(renderText);
        const legacyDiscovery = resumeDiscovery(renderText);
        const extraction = await extractResumeStructured(renderText, personId, []);

        if (!extraction.success || !extraction.extracted) {
          return fail("EXTRACTION_FAILED", "We could not extract reviewable details. Please retry or enter details manually.", 422);
        }

        let reviewCandidates = resumeCandidates(extraction.extracted, renderText);

        // If deterministic regex found no claims in raw OCR text, pull directly from Render's structured profile
        if (reviewCandidates.length === 0 && renderResult.profile?.groups) {
          const groups = renderResult.profile.groups as Record<string, any[]>;
          const fallbackCandidates: Array<{ candidateId: string; category: any; value: string; sourceSpan: string }> = [];

          (groups.skills || []).forEach((r: any, idx: number) => {
            const val = r.fields?.canonical_name?.value || r.fields?.original_wording?.value;
            if (val && typeof val === "string" && val.trim()) {
              fallbackCandidates.push({ candidateId: `skill_${idx}`, category: "skill", value: val.trim(), sourceSpan: val.trim() });
              if (!extraction.extracted!.skills.some((s) => s.name.toLowerCase() === val.trim().toLowerCase())) {
                extraction.extracted!.skills.push({ name: val.trim(), category: "other", proficiencyHint: "unknown", sourceSpan: val.trim() });
              }
            }
          });

          (groups.education || []).forEach((r: any, idx: number) => {
            const deg = r.fields?.degree_title?.value || r.fields?.qualification?.value || "";
            const inst = r.fields?.institution?.value || r.fields?.university?.value || "";
            const val = [deg, inst].filter(Boolean).join(" · ");
            if (val && val.trim()) {
              fallbackCandidates.push({ candidateId: `education_${idx}`, category: "education", value: val.trim(), sourceSpan: val.trim() });
              if (!extraction.extracted!.education.some((e) => e.institution.toLowerCase() === inst.toLowerCase())) {
                extraction.extracted!.education.push({ institution: inst || "Academic Institution", degree: deg || "Degree", sourceSpan: val.trim() });
              }
            }
          });

          (groups.experience || []).forEach((r: any, idx: number) => {
            const role = r.fields?.job_title?.value || "";
            const org = r.fields?.organization?.value || "";
            const val = [role, org].filter(Boolean).join(" · ");
            if (val && val.trim()) {
              fallbackCandidates.push({ candidateId: `experience_${idx}`, category: "experience", value: val.trim(), sourceSpan: val.trim() });
              if (!extraction.extracted!.experience.some((ex) => ex.company.toLowerCase() === org.toLowerCase())) {
                extraction.extracted!.experience.push({ role: role || "Role", company: org || "Organization", sourceSpan: val.trim() });
              }
            }
          });

          (groups.projects || []).forEach((r: any, idx: number) => {
            const title = r.fields?.title?.value;
            if (title && typeof title === "string" && title.trim()) {
              fallbackCandidates.push({ candidateId: `project_${idx}`, category: "project", value: title.trim(), sourceSpan: title.trim() });
              if (!extraction.extracted!.projects.some((p) => p.title.toLowerCase() === title.trim().toLowerCase())) {
                extraction.extracted!.projects.push({ title: title.trim(), description: "", technologies: [], sourceSpan: title.trim() });
              }
            }
          });

          (groups.certifications || []).forEach((r: any, idx: number) => {
            const title = r.fields?.title?.value;
            if (title && typeof title === "string" && title.trim()) {
              fallbackCandidates.push({ candidateId: `certification_${idx}`, category: "certification", value: title.trim(), sourceSpan: title.trim() });
              if (!extraction.extracted!.certifications.some((c) => c.name.toLowerCase() === title.trim().toLowerCase())) {
                extraction.extracted!.certifications.push({ name: title.trim(), sourceSpan: title.trim() });
              }
            }
          });

          if (fallbackCandidates.length > 0) {
            reviewCandidates = fallbackCandidates;
          }
        }

        if (reviewCandidates.length === 0) {
          return fail("NO_CLAIMS_FOUND", "No supported claims were found for review. Please enter details manually.", 422);
        }

        await SourceProcessingJobService.updateStage(jobId, personId, "persist");
        await saveResumeCandidates(personId, documentId, extraction.extracted, renderText);

        // Save durable blob
        const { ObjectStorageService } = await import("@/lib/storage/object-storage");
        await ObjectStorageService.storeDocument({
          documentId,
          personId,
          filename: file.name,
          mimeType: file.type || "application/pdf",
          buffer: bytes,
        }).catch(() => null);

        await SourceProcessingJobService.completeJob({
          jobId,
          personId,
          resultReference: `resume:sha256:${documentId}`,
          metadata: { candidates: reviewCandidates.length, via: "render-ocr" },
        });

        return makeJsonResponse(
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
              success: true,
              provider: "render-tesseract",
              modelUsed: "universal-extractor-v2",
              llmUsed: false,
              ocrUsed: renderResult.ocr_used,
              ocrFailed: false,
              fallbackUsed: true,
              latencyMs: Math.round(renderResult.processing_seconds * 1000),
              textTruncated: false,
              error: null,
            },
            suggestions: legacySuggestions,
            discovery: legacyDiscovery,
            message: "Your resume was analysed with OCR on the Render extraction engine. Source-backed suggestions were saved for review.",
            requestId,
          },
          200,
          requestId
        );

      } catch (renderErr) {
        // Render is unreachable or timed out — fail with actionable message
        console.error("Render OCR fallback failed:", renderErr);
        return fail(
          "OCR_SERVICE_UNAVAILABLE",
          "Our OCR service is temporarily unavailable. Please try again in a moment, or enter details manually.",
          503
        );
      }
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
    let persistenceStep = "job stage";
    try {
      await SourceProcessingJobService.updateStage(jobId, personId, "persist");
      persistenceStep = "candidate snapshot";
      await saveResumeCandidates(personId, documentId, extraction.extracted, rawText);

      // Persist durable document and blob in Neon PostgreSQL
      const { ObjectStorageService } = await import("@/lib/storage/object-storage");
      await ObjectStorageService.storeDocument({
        documentId,
        personId,
        filename: file.name,
        mimeType: file.type || (extension === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        buffer: bytes,
      }).catch((storageErr) => console.warn("Durable storage notice:", storageErr));

      // Synchronize Schema v2 profile to resumeDocuments table
      const { getDb, resumeDocuments } = await import("@/lib/db");
      const { eq } = await import("drizzle-orm");
      persistenceStep = "document database";
      const db = await getDb();

      // Convert candidates into Schema v2 record groups for unified persistence
      const v2Groups: Record<string, any[]> = {
        identity: [{
          record_id: `id_${documentId.slice(0, 8)}`,
          fields: {
            full_name: {
              value: extraction.extractedProfile?.fullName || "",
              original_value: extraction.extractedProfile?.fullName || "",
              confidence: 0.95,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "header", snippet: extraction.extractedProfile?.fullName || "", method: "native_pdf" }],
              history: []
            },
            professional_headline: {
              value: (extraction.extractedProfile as any)?.headline || "",
              original_value: (extraction.extractedProfile as any)?.headline || "",
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "header", snippet: (extraction.extractedProfile as any)?.headline || "", method: "native_pdf" }],
              history: []
            }
          },
          record_state: "extracted"
        }],
        contact: [{
          record_id: `ct_${documentId.slice(0, 8)}`,
          fields: {
            email: {
              value: extraction.extractedProfile?.email || "",
              original_value: extraction.extractedProfile?.email || "",
              confidence: 0.98,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "contact", snippet: extraction.extractedProfile?.email || "", method: "native_pdf" }],
              history: []
            },
            phone: {
              value: extraction.extractedProfile?.mobile || "",
              original_value: extraction.extractedProfile?.mobile || "",
              confidence: 0.92,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "contact", snippet: extraction.extractedProfile?.mobile || "", method: "native_pdf" }],
              history: []
            }
          },
          record_state: "extracted"
        }],
        education: (extraction.extracted?.education || []).map((e, idx) => ({
          record_id: `edu_${idx}`,
          fields: {
            qualification: {
              value: e.degree || "",
              original_value: e.degree || "",
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "education", snippet: e.sourceSpan || e.degree, method: "native_pdf" }],
              history: []
            },
            institution: {
              value: e.institution || "",
              original_value: e.institution || "",
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "education", snippet: e.sourceSpan || e.institution, method: "native_pdf" }],
              history: []
            },
            specialization: {
              value: e.fieldOfStudy || "",
              original_value: e.fieldOfStudy || "",
              confidence: 0.85,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "education", snippet: e.sourceSpan || e.fieldOfStudy || "", method: "native_pdf" }],
              history: []
            },
            expected_graduation: {
              value: e.graduationYear || "",
              original_value: e.graduationYear || "",
              confidence: 0.85,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "education", snippet: e.sourceSpan || e.graduationYear || "", method: "native_pdf" }],
              history: []
            }
          },
          record_state: "extracted"
        })),
        skills: (extraction.extracted?.skills || []).map((s, idx) => ({
          record_id: `sk_${idx}`,
          fields: {
            canonical_name: {
              value: s.name,
              original_value: s.name,
              confidence: 0.95,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "skills", snippet: s.sourceSpan || s.name, method: "native_pdf" }],
              history: []
            }
          },
          record_state: "extracted"
        })),
        projects: (extraction.extracted?.projects || []).map((p, idx) => ({
          record_id: `pr_${idx}`,
          fields: {
            title: {
              value: p.title,
              original_value: p.title,
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "projects", snippet: p.sourceSpan || p.title, method: "native_pdf" }],
              history: []
            },
            description: {
              value: p.description || "",
              original_value: p.description || "",
              confidence: 0.85,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "projects", snippet: p.sourceSpan || p.description || "", method: "native_pdf" }],
              history: []
            },
            technologies: {
              value: (p.technologies || []).join(", "),
              original_value: (p.technologies || []).join(", "),
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "projects", snippet: p.sourceSpan || "", method: "native_pdf" }],
              history: []
            }
          },
          record_state: "extracted"
        })),
        experience: (extraction.extracted?.experience || []).map((ex, idx) => ({
          record_id: `exp_${idx}`,
          fields: {
            organization: {
              value: ex.company,
              original_value: ex.company,
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "experience", snippet: ex.sourceSpan || ex.company, method: "native_pdf" }],
              history: []
            },
            job_title: {
              value: ex.role,
              original_value: ex.role,
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "experience", snippet: ex.sourceSpan || ex.role, method: "native_pdf" }],
              history: []
            }
          },
          record_state: "extracted"
        })),
        certifications: (extraction.extracted?.certifications || []).map((c, idx) => ({
          record_id: `cert_${idx}`,
          fields: {
            title: {
              value: c.name,
              original_value: c.name,
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "certifications", snippet: c.sourceSpan || c.name, method: "native_pdf" }],
              history: []
            }
          },
          record_state: "extracted"
        })),
        awards: (extraction.extracted?.achievements || []).map((a, idx) => ({
          record_id: `aw_${idx}`,
          fields: {
            name: {
              value: a.title,
              original_value: a.title,
              confidence: 0.88,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "awards", snippet: a.sourceSpan || a.title, method: "native_pdf" }],
              history: []
            }
          },
          record_state: "extracted"
        })),
        digital_footprint: Object.entries(extraction.discoveredProfiles || {}).map(([platform, url], idx) => ({
          record_id: `df_${idx}`,
          fields: {
            platform: {
              value: platform,
              original_value: platform,
              confidence: 0.95,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "links", snippet: String(url), method: "hyperlink" }],
              history: []
            },
            original_url: {
              value: String(url),
              original_value: String(url),
              confidence: 0.95,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ page: 1, section: "links", snippet: String(url), method: "hyperlink" }],
              history: []
            }
          },
          record_state: "extracted"
        })),
        summary: [],
        internships: [],
        research: [],
        books_patents: [],
        leadership: [],
        extraction_metadata: []
      };

      const canonicalV2Profile = {
        schema_version: "2.0",
        document_id: documentId,
        groups: v2Groups,
        metadata: {
          document_id: documentId,
          file_format: extension,
          page_count: parsedDoc.pages?.length || 1,
          ocr_attempted: Boolean(parsedDoc.ocrUsed || parsedDoc.ocrFailed),
          ocr_used: parsedDoc.ocrUsed || false,
          text_quality: "good",
          processing_seconds: (extraction.latencyMs || 500) / 1000,
          extraction_methods: [parsedDoc.ocrUsed ? "ocr" : "native_pdf"],
          parser_version: "2.0.0",
          model_version: "v3.9-zero-llm",
          warnings: [],
          status: "completed",
        }
      };

      await db
        .update(resumeDocuments)
        .set({
          status: "completed",
          extractedProfile: canonicalV2Profile,
          metadata: canonicalV2Profile.metadata,
          updatedAt: new Date(),
        })
        .where(eq(resumeDocuments.id, documentId))
        .catch(() => null);

    } catch (persistErr) {
      console.error("Resume persistence failed", {
        step: persistenceStep,
        errorType: persistErr instanceof Error ? persistErr.name : typeof persistErr,
      });
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
