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

export class ProviderHttpError extends Error {
  constructor(readonly provider: ModelProviderName, readonly status: number, body: string) {
    super(`${provider} ${status}: ${body.slice(0, 300)}`);
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
