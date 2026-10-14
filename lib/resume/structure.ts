/**
 * One schema-constrained LLM call that turns reading-order resume text into
 * ResumeExtraction. Both the text-layer PDF path and the OCR path end here.
 *
 * Provider: Groq (OpenAI-compatible) with strict json_schema output, so the
 * response is guaranteed to match RESUME_EXTRACTION_JSON_SCHEMA; zod re-checks it.
 */

import { KeyPool } from "@/lib/intelligence/providers/key-pool";
import { checkAiQuota, estimateTokens, recordAiUsage } from "@/lib/intelligence/cost-control";
import { RESUME_EXTRACTION_JSON_SCHEMA, ResumeExtractionSchema, type ResumeExtraction } from "./schema";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
/** Long enough for a dense two-page CV; longer input is truncated, never split across calls. */
const MAX_INPUT_CHARS = 24_000;

export const RESUME_PROMPT_VERSION = "resume-structure-v2";

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
  constructor(message: string, public readonly kind: "not_configured" | "quota" | "provider" | "invalid_output") {
    super(message);
    this.name = "ResumeStructuringError";
  }
}

let pool: KeyPool | null = null;

export async function structureResumeText(
  text: string,
  personId?: string
): Promise<{ data: ResumeExtraction; model: string; truncated: boolean; usage?: { prompt_tokens?: number; completion_tokens?: number } }> {
  pool ??= new KeyPool(["GROQ_API_KEYS", "GROQ_API_KEY"]);
  if (!pool.hasKeys() || process.env.CORE_DISABLE_LIVE_LLM === "true") {
    throw new ResumeStructuringError("Resume structuring model is not configured.", "not_configured");
  }
  if (personId && !checkAiQuota(personId).allowed) {
    throw new ResumeStructuringError("Daily AI quota reached.", "quota");
  }

  const truncated = text.length > MAX_INPUT_CHARS;
  const input = truncated ? text.slice(0, MAX_INPUT_CHARS) : text;
  const model = process.env.RESUME_LLM_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b";

  let lastError: unknown;
  // One retry on a different key for transient provider errors; never a loop.
  for (let attempt = 0; attempt < 2; attempt++) {
    const key = pool.getNextKey();
    if (!key) break;
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_completion_tokens: 6000,
          ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
          response_format: {
            type: "json_schema",
            json_schema: { name: "resume", strict: true, schema: RESUME_EXTRACTION_JSON_SCHEMA },
          },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: input },
          ],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) pool.markKeyFailed(key);
        const body = await res.text().catch(() => "");
        lastError = new ResumeStructuringError(`Groq ${res.status}: ${body.slice(0, 300)}`, "provider");
        if (res.status === 400) break; // schema/request problem: retrying will not help
        continue;
      }
      const json = await res.json();
      const content: string = json.choices?.[0]?.message?.content ?? "";
      const parsed = ResumeExtractionSchema.safeParse(JSON.parse(content));
      if (!parsed.success) {
        throw new ResumeStructuringError(`Model output failed validation: ${parsed.error.issues[0]?.message}`, "invalid_output");
      }
      if (personId) recordAiUsage(personId, json.usage?.total_tokens ?? estimateTokens(SYSTEM_PROMPT + input + content));
      return { data: parsed.data, model, truncated, usage: json.usage };
    } catch (err) {
      lastError = err;
      if (err instanceof ResumeStructuringError && err.kind === "invalid_output") break;
    }
  }
  throw lastError instanceof ResumeStructuringError
    ? lastError
    : new ResumeStructuringError(lastError instanceof Error ? lastError.message : "Resume structuring failed.", "provider");
}
