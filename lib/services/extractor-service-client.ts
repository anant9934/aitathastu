/**
 * AI TATHASTU — UNIVERSAL RESUME EXTRACTOR SERVICE CLIENT
 *
 * Server-only client for the Python extraction service (Render, or local FastAPI).
 *
 * Authorization model: the extractor derives privilege only from WHICH
 * credential is presented. Ordinary calls use EXTRACTOR_API_TOKEN and are
 * always treated as the student identified by X-User-Id. Verifier calls use
 * the separate EXTRACTOR_VERIFIER_TOKEN, and only after the caller's role was
 * looked up server-side (see lib/auth/extractor-identity.ts). X-Org-Id is
 * always sent so the extractor can scope verifier access to one organization.
 */

import crypto from "node:crypto";
import type { LayoutPage } from "@/lib/resume/layout";

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
  error_code?: string | null;
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
}

/** Who a call is made on behalf of. Always built server-side, never from request input. */
export interface ExtractorIdentity {
  personId: string;
  organizationId: string | null;
  isVerifier: boolean;
}

/** Thrown for any non-2xx or network failure, with a classification the job pipeline can map to an error code. */
export class ExtractorServiceError extends Error {
  constructor(
    message: string,
    public readonly kind: "unreachable" | "timeout" | "auth" | "not_found" | "rejected" | "server",
    public readonly httpStatus?: number
  ) {
    super(message);
    this.name = "ExtractorServiceError";
  }
}

function b64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export class ExtractorServiceClient {
  static isConfigured(): boolean {
    return Boolean((process.env.RESUME_EXTRACTOR_URL || "").trim());
  }

  private static getBaseUrl(): string {
    const raw = (process.env.RESUME_EXTRACTOR_URL || "").trim();
    if (raw) return raw.replace(/\/+$/, "");
    return "http://127.0.0.1:8000";
  }

  private static getApiToken(): string {
    const token = (process.env.EXTRACTOR_API_TOKEN || "").trim();
    if (token) return token;
    // Fail closed: the extractor rejects the dev default in production anyway,
    // and a clear error here beats an opaque 401 from the service.
    if (process.env.NODE_ENV === "production") {
      throw new ExtractorServiceError("EXTRACTOR_API_TOKEN is not configured.", "auth");
    }
    return "development-only-change-me";
  }

  private static getVerifierToken(): string | null {
    return (process.env.EXTRACTOR_VERIFIER_TOKEN || "").trim() || null;
  }

  /**
   * Generates a signed short-lived student token (used by the integration test script).
   * Never leaks the shared service secret to client JavaScript.
   */
  static generateSignedUserToken(params: {
    personId: string;
    action?: string;
    documentId?: string;
    expiresInSeconds?: number;
  }): string {
    const { personId, action = "*", documentId, expiresInSeconds = 900 } = params;
    const payload = {
      sub: personId,
      role: "student",
      act: action,
      ...(documentId ? { doc: documentId } : {}),
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    };
    const payloadB64 = b64UrlEncode(Buffer.from(JSON.stringify(payload), "utf-8"));
    const sig = crypto.createHmac("sha256", this.getApiToken()).update(payloadB64).digest();
    return `u.${payloadB64}.${b64UrlEncode(sig)}`;
  }

  private static makeHeaders(identity: ExtractorIdentity, extra?: Record<string, string>): Record<string, string> {
    let token = this.getApiToken();
    if (identity.isVerifier) {
      const verifierToken = this.getVerifierToken();
      if (!verifierToken) {
        throw new ExtractorServiceError("EXTRACTOR_VERIFIER_TOKEN is not configured.", "auth");
      }
      token = verifierToken;
    }
    return {
      Authorization: `Bearer ${token}`,
      "X-User-Id": identity.personId,
      ...(identity.organizationId ? { "X-Org-Id": identity.organizationId } : {}),
      ...extra,
    };
  }

  private static async request(path: string, init: RequestInit & { timeoutMs: number }): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.getBaseUrl()}${path}`, { ...init, signal: AbortSignal.timeout(init.timeoutMs) });
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      throw new ExtractorServiceError(
        `Extractor ${isTimeout ? "timed out" : "unreachable"} for ${path}: ${err instanceof Error ? err.message : String(err)}`,
        isTimeout ? "timeout" : "unreachable"
      );
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      const kind = res.status === 401 || res.status === 403 ? "auth"
        : res.status === 404 ? "not_found"
        : res.status < 500 ? "rejected"
        : "server";
      throw new ExtractorServiceError(`Extractor ${path} failed (${res.status}): ${detail}`, kind, res.status);
    }
    return res;
  }

  static async checkHealth(): Promise<{ status: string; schema_version: string; tesseract_version?: string }> {
    const res = await this.request("/health", { method: "GET", timeoutMs: 5000 });
    return res.json();
  }

  /** Uploads a stored document to the extractor so it can be OCR'd. */
  static async uploadResume(params: {
    fileBuffer: Buffer;
    filename: string;
    mimeType: string;
    identity: ExtractorIdentity;
  }): Promise<ExtractorUploadResponse> {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(params.fileBuffer)], { type: params.mimeType }), params.filename);
    const res = await this.request("/api/resumes/upload", {
      method: "POST",
      headers: this.makeHeaders(params.identity),
      body: formData,
      // Must finish inside the hosting function's limit (Vercel: 15s-60s maxDuration).
      // A sleeping Render instance is woken earlier by
      // /api/resume/preflight; if it still is not up, the job fails as
      // OCR_SERVICE_UNREACHABLE (retryable) instead of hanging.
      timeoutMs: 20000,
    });
    return res.json();
  }

  /** Queues extraction. The extractor runs it in a background task and returns 202 immediately. */
  static async startExtraction(
    documentId: string,
    identity: ExtractorIdentity,
    options: { forceOcr?: boolean } = {}
  ): Promise<ExtractorStatusResponse> {
    const res = await this.request("/api/resumes/extract", {
      method: "POST",
      headers: this.makeHeaders(identity, { "Content-Type": "application/json" }),
      body: JSON.stringify({ document_id: documentId, ...(options.forceOcr ? { force_ocr: true } : {}) }),
      timeoutMs: 10000,
    });
    return res.json();
  }

  static async getStatus(documentId: string, identity: ExtractorIdentity): Promise<ExtractorStatusResponse> {
    const res = await this.request(`/api/resumes/${encodeURIComponent(documentId)}/status`, {
      method: "GET",
      headers: this.makeHeaders(identity),
      timeoutMs: 8000,
    });
    return res.json();
  }

  static async getDocument(documentId: string, identity: ExtractorIdentity): Promise<ExtractorDocumentView> {
    const res = await this.request(`/api/resumes/${encodeURIComponent(documentId)}`, {
      method: "GET",
      headers: this.makeHeaders(identity),
      timeoutMs: 15000,
    });
    return res.json();
  }

  /** Raw OCR/native text lines, used to run the deterministic Node extractor on OCR output. */
  /** Extracted text plus positioned spans per page (OCR word boxes or native words). */
  static async getRawText(documentId: string, identity: ExtractorIdentity): Promise<{ raw_text: string; ocr_used: boolean; pages?: LayoutPage[] }> {
    const res = await this.request(`/api/resumes/${encodeURIComponent(documentId)}/text`, {
      method: "GET",
      headers: this.makeHeaders(identity),
      timeoutMs: 15000,
    });
    return res.json();
  }

  static async reviewField(
    documentId: string,
    identity: ExtractorIdentity,
    params: ExtractorReviewParams
  ): Promise<{ ok: boolean; record: ExtractorRecord }> {
    const res = await this.request(`/api/resumes/${encodeURIComponent(documentId)}/review`, {
      method: "POST",
      headers: this.makeHeaders(identity, { "Content-Type": "application/json" }),
      body: JSON.stringify(params),
      timeoutMs: 10000,
    });
    return res.json();
  }

  static async deleteDocument(documentId: string, identity: ExtractorIdentity): Promise<boolean> {
    const res = await this.request(`/api/resumes/${encodeURIComponent(documentId)}`, {
      method: "DELETE",
      headers: this.makeHeaders(identity),
      timeoutMs: 10000,
    });
    return res.status === 204 || res.status === 200;
  }
}
