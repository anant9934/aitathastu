export type IntelligenceTask =
  | "PROFILE_EXTRACT"
  | "PROJECT_SUMMARY"
  | "PROJECT_TECH_DETECTION"
  | "PROJECT_DEDUP"
  | "GOAL_INTERPRETATION"
  | "EORA_EXPLANATION"
  | "EORA_CHAT"
  | "ROADMAP_EXPLANATION"
  | "LEARNING_RECOMMENDATIONS"
  | "RESUME_STRUCTURE"
  // Legacy aliases
  | "resume_interpretation"
  | "project_summarization"
  | "technology_extraction"
  | "eora_explanation"
  | "eora_chat"
  | "deduplication_suggestion"
  | "roadmap_wording";

export type ModelProviderName =
  | "gemini"
  | "groq"
  | "openrouter"
  | "cerebras"
  | "mistral"
  | "sambanova";

export type CompletionRequest = {
  task: IntelligenceTask;
  systemPrompt: string;
  userPrompt: string;
  personId?: string;
  temperature?: number;
  maxTokens?: number;
  promptVersion?: string;
};

export type CompletionResponse = {
  content: string;
  provider: ModelProviderName | "deterministic_fallback";
  modelUsed: string;
  fallbackUsed: boolean;
  latencyMs?: number;
  /** Set when the deterministic fallback ran because the AI quota refused the call. */
  quotaExceeded?: string;
};

/**
 * How a provider can be made to return schema-shaped JSON (Task 1.1.2).
 *  - strict_json_schema: the API enforces the schema itself (constrained decoding).
 *  - json_object: the API only guarantees syntactically valid JSON; the
 *    router validates with zod and sends at most one repair prompt.
 */
export type StructuredCapability = "strict_json_schema" | "json_object";

export type StructuredCompletionRequest = CompletionRequest & {
  schemaName: string;
  /** JSON Schema with every key required and additionalProperties: false. */
  jsonSchema: Record<string, unknown>;
  timeoutMs?: number;
  /** Prior bad output + validation errors, for the single json_object repair turn. */
  repair?: { previousOutput: string; errors: string };
};

export type StructuredProviderResponse = { content: string; modelUsed: string; totalTokens?: number };

export function parseProviderRetryAfter(
  headers?: Headers | Record<string, string | null | undefined> | null,
  body?: string
): number | undefined {
  if (headers) {
    const getHeader = (name: string): string | null | undefined => {
      if (typeof (headers as Headers).get === "function") {
        return (headers as Headers).get(name);
      }
      const record = headers as Record<string, string | null | undefined>;
      return record[name] ?? record[name.toLowerCase()];
    };

    const retryAfter = getHeader("retry-after");
    if (retryAfter) {
      const sec = parseFloat(retryAfter);
      if (!isNaN(sec) && isFinite(sec)) {
        return Math.max(0, Math.round(sec * 1000));
      }
      const dateMs = Date.parse(retryAfter);
      if (!isNaN(dateMs)) {
        return Math.max(0, dateMs - Date.now());
      }
    }

    const retryAfterMs = getHeader("retry-after-ms");
    if (retryAfterMs) {
      const ms = parseFloat(retryAfterMs);
      if (!isNaN(ms) && isFinite(ms)) {
        return Math.max(0, Math.round(ms));
      }
    }

    const resetReq = getHeader("x-ratelimit-reset-requests") || getHeader("x-ratelimit-reset-tokens");
    if (resetReq) {
      if (resetReq.endsWith("ms")) {
        const ms = parseFloat(resetReq.slice(0, -2));
        if (!isNaN(ms) && isFinite(ms)) return Math.max(0, Math.round(ms));
      } else if (resetReq.endsWith("s")) {
        const s = parseFloat(resetReq.slice(0, -1));
        if (!isNaN(s) && isFinite(s)) return Math.max(0, Math.round(s * 1000));
      } else {
        const val = parseFloat(resetReq);
        if (!isNaN(val) && isFinite(val)) return Math.max(0, Math.round(val * 1000));
      }
    }
  }

  if (body) {
    const match = body.match(/try again in\s+([0-9.]+)\s*(ms|s|sec|seconds|m|min|minutes)/i);
    if (match) {
      const amount = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      if (!isNaN(amount) && isFinite(amount)) {
        if (unit.startsWith("ms")) return Math.round(amount);
        if (unit.startsWith("m")) return Math.round(amount * 60_000);
        return Math.round(amount * 1000);
      }
    }
  }

  return undefined;
}

export function isAccountWideQuotaError(status: number, body?: string): boolean {
  if (status === 402) return true;
  if (!body) return false;
  const lower = body.toLowerCase();
  return (
    lower.includes("resource_exhausted") ||
    lower.includes("insufficient_quota") ||
    lower.includes("quota_exceeded") ||
    lower.includes("quota exceeded") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("daily_limit") ||
    lower.includes("daily limit") ||
    lower.includes("tokens per day") ||
    lower.includes("requests per day") ||
    lower.includes("tpd") ||
    lower.includes("rpd") ||
    lower.includes("organization quota") ||
    lower.includes("account quota") ||
    lower.includes("account-wide") ||
    lower.includes("check your plan and billing") ||
    lower.includes("free_tier_limit")
  );
}

export class ProviderHttpError extends Error {
  readonly retryAfterMs?: number;
  readonly isAccountWideQuota: boolean;
  readonly responseBody: string;

  constructor(
    readonly provider: ModelProviderName,
    readonly status: number,
    body: string,
    headers?: Headers | Record<string, string | null | undefined> | null
  ) {
    super(`${provider} ${status}: ${body.slice(0, 300)}`);
    this.name = "ProviderHttpError";
    this.responseBody = body;
    this.retryAfterMs = parseProviderRetryAfter(headers, body);
    this.isAccountWideQuota = isAccountWideQuotaError(status, body);
  }
}


export interface ModelProvider {
  name: ModelProviderName;
  structuredCapability: StructuredCapability;
  isAvailable(): boolean;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  completeStructured(request: StructuredCompletionRequest): Promise<StructuredProviderResponse>;
}

export type JobStatus = "queued" | "processing" | "complete" | "failed";

export type IntelligenceJob = {
  id: string;
  personId?: string;
  task: IntelligenceTask;
  status: JobStatus;
  result?: CompletionResponse;
  error?: string;
  createdAt: string;
  completedAt?: string;
};
