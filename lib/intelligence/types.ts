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
};

export interface ModelProvider {
  name: ModelProviderName;
  isAvailable(): boolean;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
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
