/**
 * One schema-constrained LLM call that turns reading-order resume text into
 * ResumeExtraction. Both the text-layer PDF path and the OCR path end here.
 *
 * Routed through IntelligenceRouter.completeStructured (Task 1.1.2): the full
 * provider pool (CLOUD_AI_PROVIDER_ORDER), strict json_schema decoding where
 * the provider supports it (Groq, Gemini, OpenRouter), JSON mode + zod repair
 * elsewhere (Cerebras, Mistral, SambaNova), and the shared AI quota.
 */

import { defaultIntelligenceRouter, StructuredCompletionError, type IntelligenceRouter, type StructuredAttempt } from "@/lib/intelligence/router";
import { RESUME_EXTRACTION_JSON_SCHEMA, ResumeExtractionSchema, type ResumeExtraction } from "./schema";
import { sanitizeTextForModel } from "@/lib/intelligence/context-firewall";

/** Long enough for a dense two-page CV; longer input is truncated, never split across calls. */
const MAX_INPUT_CHARS = 24_000;

export const RESUME_PROMPT_VERSION = "resume-structure-v3";

const SYSTEM_PROMPT = `Extract the resume into the JSON schema.
Rules:
- Copy values exactly as written, including dates like "Present". Never invent or infer missing data; use null or [].
- The text was rebuilt from the page layout. " | " separates text that was visually apart on one line. "<url>" is the hyperlink behind the text before it.
- A field holds only its own value. A date or location next to a company, role, project or institution goes in that entry's date/location field, never inside its name.
- No bullet characters, icons or labels ("Email:", "CGPA:", "Tech:") inside values.
- description (experience): each bullet point verbatim, one item per bullet.
- links: profile/portfolio URLs, typed by site. A project's URLs go in that project: link = live/demo, repository = source code.
- skills: individual skills/technologies, deduplicated; no category names or sentences.
- achievements: awards, patents, publications, competition results; one item each.
Example: "Zeta Analytics | Bengaluru, India" -> company "Zeta Analytics", location "Bengaluru, India". Wrong: company "Zeta Analytics Bengaluru, India".`;

export class ResumeStructuringError extends Error {
  constructor(
    message: string,
    public readonly kind: "not_configured" | "quota" | "provider" | "invalid_output",
    public readonly attempts: StructuredAttempt[] = []
  ) {
    super(message);
    this.name = "ResumeStructuringError";
  }
}

export async function structureResumeText(
  text: string,
  personId?: string,
  router: IntelligenceRouter = defaultIntelligenceRouter
): Promise<{ data: ResumeExtraction; model: string; provider: string; truncated: boolean; attempts: StructuredAttempt[] }> {
  const truncated = text.length > MAX_INPUT_CHARS;
  // Truncate first (preserves the character budget), then redact PII so phones/emails
  // never enter any LLM provider prompt, retry payload, or repair turn.
  const input = sanitizeTextForModel(truncated ? text.slice(0, MAX_INPUT_CHARS) : text);
  try {
    const result = await router.completeStructured(
      {
        task: "RESUME_STRUCTURE",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: input,
        personId,
        temperature: 0,
        maxTokens: 6000,
        promptVersion: RESUME_PROMPT_VERSION,
        schemaName: "resume",
        jsonSchema: RESUME_EXTRACTION_JSON_SCHEMA,
        timeoutMs: 25_000,
      },
      ResumeExtractionSchema
    );
    return { data: result.data, model: result.model, provider: result.provider, truncated, attempts: result.attempts };
  } catch (error) {
    if (error instanceof StructuredCompletionError) {
      throw new ResumeStructuringError(error.message, error.kind, error.attempts);
    }
    throw new ResumeStructuringError(error instanceof Error ? error.message : "Resume structuring failed.", "provider");
  }
}
