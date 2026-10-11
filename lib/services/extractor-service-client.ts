/**
 * AI TATHASTU — UNIVERSAL RESUME EXTRACTOR SERVICE CLIENT
 *
 * Communicates with the Render Docker Web Service or local FastAPI extraction engine.
 * - Authenticates using scoped service-to-service headers (`X-User-Id`, `X-User-Role`, `X-Org-Id`).
 * - Generates cryptographically signed short-lived user tokens for secure client-side direct uploads.
 * - Never exposes backend secrets in client bundles.
 */

import crypto from "node:crypto";

export interface ExtractorUploadResponse {
  document_id: string;
  filename: string;
  status: string;
  max_pages: number;
}

export interface ExtractorStatusResponse {
  document_id: string;
  status: "uploaded" | "queued" | "processing" | "completed" | "partial" | "failed";
  warnings: string[];
}

export interface ExtractorEvidence {
  page: number | null;
  section: string | null;
  snippet: string;
  method: "native_pdf" | "ocr" | "docx" | "txt" | "rtf" | "image" | "hyperlink" | "derived";
  block_id?: string | null;
}

export interface ExtractorField {
  value: string;
  original_value: string;
  evidence: ExtractorEvidence[];
  confidence: number;
  confidence_kind: "heuristic";
  review_state: "extracted" | "reviewed" | "student_confirmed" | "independently_verified" | "rejected" | "uncertain";
  history: Array<{
    action: string;
    actor: string;
    timestamp: string;
    previous_value?: string | null;
    new_value?: string | null;
    previous_state: string;
  }>;
}

export interface ExtractorRecord {
  record_id: string;
  fields: Record<string, ExtractorField>;
  record_state: "extracted" | "reviewed" | "student_confirmed" | "independently_verified" | "rejected" | "uncertain";
}

export interface ExtractorProfileV2 {
  schema_version: "2.0";
  document_id: string;
  groups: Record<string, ExtractorRecord[]>;
  metadata: {
    document_id: string;
    file_format: string;
    page_count: number;
    ocr_attempted: boolean;
    ocr_used: boolean;
    text_quality: "good" | "limited" | "poor" | "empty";
    processing_seconds: number;
    extraction_methods: string[];
    parser_version: string;
    model_version: string;
    warnings: string[];
    status: "uploaded" | "queued" | "processing" | "completed" | "partial" | "failed";
    reviewed_at?: string | null;
  };
}

export interface ExtractorDocumentView {
  profile: ExtractorProfileV2 | null;
  status: ExtractorStatusResponse;
}

export interface ExtractorReviewParams {
  group: string;
  record_id: string;
  field?: string | null;
  action: "accept" | "correct" | "reject" | "uncertain" | "confirm" | "verify";
  corrected_value?: string | null;
  reviewer_role?: "student" | "verifier";
}

function b64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

export class ExtractorServiceClient {
  private static getBaseUrl(): string {
    const raw = (
      process.env.RESUME_EXTRACTOR_URL ||
      process.env.RESUME_EXTRACTOR_SERVICE_URL ||
      process.env.NEXT_PUBLIC_RESUME_EXTRACTOR_URL
    )?.trim();
    if (raw) return raw.replace(/\/+$/, "");
    return "http://127.0.0.1:8000";
  }

  private static getApiToken(): string {
    return (
      process.env.EXTRACTOR_API_TOKEN ||
      process.env.RESUME_EXTRACTOR_SERVICE_API_KEY ||
      process.env.RESUME_EXTRACTOR_SERVICE_SECRET
    )?.trim() || "development-only-change-me";
  }

  /**
   * Generates a signed short-lived user token for client-side direct uploads.
   * Never leaks the shared service secret to client JavaScript.
   */
  static generateSignedUserToken(params: {
    personId: string;
    role?: "student" | "verifier";
    action?: string;
    documentId?: string;
    expiresInSeconds?: number;
  }): string {
    const { personId, role = "student", action = "*", documentId, expiresInSeconds = 900 } = params;
    const secret = this.getApiToken();
    const payload = {
      sub: personId,
      role,
      act: action,
      ...(documentId ? { doc: documentId } : {}),
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    };

    const serialized = JSON.stringify(payload);
    const payloadB64 = b64UrlEncode(Buffer.from(serialized, "utf-8"));
    const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
    const sigB64 = b64UrlEncode(sig);

    return `u.${payloadB64}.${sigB64}`;
  }

  private static makeHeaders(personId: string, role: string = "student", extra?: Record<string, string>): HeadersInit {
    return {
      Authorization: `Bearer ${this.getApiToken()}`,
      "X-User-Id": personId,
      "X-User-Role": role,
      ...extra,
    };
  }

  /**
   * Checks health and engine version of the resume extraction service.
   */
  static async checkHealth(): Promise<{ status: string; schema_version: string; tesseract_version?: string }> {
    const res = await fetch(`${this.getBaseUrl()}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      throw new Error(`Resume Extractor service health check failed with status ${res.status}`);
    }
    return res.json();
  }

  /**
   * Uploads resume file buffer to the extractor backend.
   */
  static async uploadResume(params: {
    fileBuffer: Buffer;
    filename: string;
    mimeType: string;
    personId: string;
    role?: "student" | "verifier";
  }): Promise<ExtractorUploadResponse> {
    const { fileBuffer, filename, mimeType, personId, role = "student" } = params;
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append("file", blob, filename);

    const res = await fetch(`${this.getBaseUrl()}/api/resumes/upload`, {
      method: "POST",
      headers: this.makeHeaders(personId, role),
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Upload failed");
      throw new Error(`Resume upload failed (${res.status}): ${errorText}`);
    }

    return res.json();
  }

  /**
   * Synchronous upload + extract in a single Render request.
   * Returns the full extracted profile without polling.
   * Used as the OCR fallback when Vercel serverless cannot run Tesseract.
   */
  static async uploadAndExtract(params: {
    fileBuffer: Buffer;
    filename: string;
    mimeType: string;
    personId: string;
    role?: "student" | "verifier";
  }): Promise<{
    ok: boolean;
    document_id: string;
    status: string;
    profile: ExtractorProfileV2;
    raw_text: string;
    warnings: string[];
    ocr_used: boolean;
    processing_seconds: number;
  }> {
    const { fileBuffer, filename, mimeType, personId, role = "student" } = params;
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append("file", blob, filename);

    const res = await fetch(`${this.getBaseUrl()}/api/resumes/upload-and-extract`, {
      method: "POST",
      headers: this.makeHeaders(personId, role),
      body: formData,
      // 90s timeout — Render has no serverless limit, handles complex OCR docs
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Extraction failed");
      throw new Error(`Render extraction failed (${res.status}): ${errorText}`);
    }

    return res.json();
  }

  /**
   * Triggers background extraction for an uploaded document.
   */
  static async startExtraction(documentId: string, personId: string): Promise<ExtractorStatusResponse> {
    const res = await fetch(`${this.getBaseUrl()}/api/resumes/extract`, {
      method: "POST",
      headers: this.makeHeaders(personId, "student", { "Content-Type": "application/json" }),
      body: JSON.stringify({ document_id: documentId }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Extraction failed");
      throw new Error(`Starting extraction failed (${res.status}): ${errorText}`);
    }

    return res.json();
  }

  /**
   * Polls document extraction status.
   */
  static async getStatus(documentId: string, personId: string): Promise<ExtractorStatusResponse> {
    const res = await fetch(`${this.getBaseUrl()}/api/resumes/${documentId}/status`, {
      method: "GET",
      headers: this.makeHeaders(personId, "student"),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`Status check failed (${res.status})`);
    }

    return res.json();
  }

  /**
   * Fetches full DocumentView including canonical Schema v2.0 profile.
   */
  static async getDocument(
    documentId: string,
    personId: string,
    role: "student" | "verifier" = "student"
  ): Promise<ExtractorDocumentView> {
    const res = await fetch(`${this.getBaseUrl()}/api/resumes/${documentId}`, {
      method: "GET",
      headers: this.makeHeaders(personId, role),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Fetching document view failed (${res.status})`);
    }

    return res.json();
  }

  /**
   * Submits a field or record review action.
   */
  static async reviewField(
    documentId: string,
    personId: string,
    params: ExtractorReviewParams,
    role: "student" | "verifier" = "student"
  ): Promise<{ ok: boolean; record: ExtractorRecord }> {
    const res = await fetch(`${this.getBaseUrl()}/api/resumes/${documentId}/review`, {
      method: "POST",
      headers: this.makeHeaders(personId, role, { "Content-Type": "application/json" }),
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "Review action failed");
      throw new Error(`Review failed (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * Exports document in JSON or Summary TXT format.
   */
  static async exportDocument(
    documentId: string,
    personId: string,
    format: "json" | "summary" = "json"
  ): Promise<string> {
    const res = await fetch(`${this.getBaseUrl()}/api/resumes/${documentId}/export?format=${format}`, {
      method: "GET",
      headers: this.makeHeaders(personId, "student"),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Export failed (${res.status})`);
    }

    return res.text();
  }

  /**
   * Retries an extraction.
   */
  static async retryExtraction(documentId: string, personId: string): Promise<ExtractorStatusResponse> {
    const res = await fetch(`${this.getBaseUrl()}/api/resumes/${documentId}/retry`, {
      method: "POST",
      headers: this.makeHeaders(personId, "student"),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Retry failed (${res.status})`);
    }

    return res.json();
  }

  /**
   * Deletes a document from the extractor service.
   */
  static async deleteDocument(documentId: string, personId: string): Promise<boolean> {
    const res = await fetch(`${this.getBaseUrl()}/api/resumes/${documentId}`, {
      method: "DELETE",
      headers: this.makeHeaders(personId, "student"),
      signal: AbortSignal.timeout(10000),
    });

    return res.status === 204 || res.status === 200;
  }
}
