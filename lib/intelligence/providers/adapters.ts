import {
  ModelProvider, ModelProviderName, CompletionRequest, CompletionResponse,
  ProviderHttpError, type StructuredCapability, type StructuredCompletionRequest, type StructuredProviderResponse,
} from "../types";

function structuredMessages(request: StructuredCompletionRequest, inlineSchema: boolean) {
  const system = inlineSchema
    ? `${request.systemPrompt}

Return ONLY a JSON object matching this JSON Schema exactly (every key present, no extra keys, null where unknown):
${JSON.stringify(request.jsonSchema)}`
    : request.systemPrompt;
  const messages: { role: string; content: string }[] = [
    { role: "system", content: system },
    { role: "user", content: request.userPrompt },
  ];
  if (request.repair) {
    messages.push(
      { role: "assistant", content: request.repair.previousOutput.slice(0, 20_000) },
      { role: "user", content: `That JSON failed validation:
${request.repair.errors}
Return the corrected JSON object only. Do not add information that is not in the resume.` },
    );
  }
  return messages;
}

/**
 * Runs `attempt` with successive keys from the pool:
 * - 401/403 drops that key and rotates to the next key.
 * - 429: If it's an account-wide limit (e.g. RESOURCE_EXHAUSTED, insufficient_quota, daily caps),
 *   rotating keys under the same account is futile and wasteful. It is thrown to the router at once.
 * - 429 per-key rate limit: Honors provider-supplied backoff before next attempt (if <= 2000ms), then rotates.
 * - Anything else (incl. 402 billing, which is account-wide) is thrown to the router at once.
 */
async function withKeyRotation<T>(pool: KeyPool, provider: ModelProviderName, attempt: (key: string) => Promise<T>): Promise<T> {
  const tries = Math.min(3, Math.max(1, pool.size()));
  let last: unknown = new Error(`No API key available for provider ${provider}`);
  for (let i = 0; i < tries; i++) {
    const key = pool.getNextKey();
    if (!key) break;
    try {
      return await attempt(key);
    } catch (error) {
      last = error;
      if (!(error instanceof ProviderHttpError)) throw error;
      if (error.status === 401 || error.status === 403) {
        pool.markKeyFailed(key);
        continue;
      }
      if (error.status === 429) {
        // Do NOT rotate credentials against an account-wide limit
        if (error.isAccountWideQuota) {
          throw error;
        }
        // Honor provider-supplied backoff before next key attempt if short
        if (error.retryAfterMs && error.retryAfterMs > 0 && error.retryAfterMs <= 2000) {
          await new Promise((resolve) => setTimeout(resolve, error.retryAfterMs));
        }
        continue;
      }
      throw error;
    }
  }
  throw last;
}

async function readProviderError(provider: ModelProviderName, res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  throw new ProviderHttpError(provider, res.status, body, res.headers);
}
import { KeyPool } from "./key-pool";

abstract class BaseHttpProvider implements ModelProvider {
  abstract name: ModelProviderName;
  /** Conservative default; providers verified to enforce schemas override it. */
  structuredCapability: StructuredCapability = "json_object";
  protected keyPool: KeyPool;
  protected defaultModel: string;
  protected endpointUrl: string;

  constructor(envVars: string[], defaultModel: string, endpointUrl: string) {
    this.keyPool = new KeyPool(envVars);
    this.defaultModel = defaultModel;
    this.endpointUrl = endpointUrl;
  }

  isAvailable(): boolean {
    return this.keyPool.hasKeys();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const key = this.keyPool.getNextKey();
    if (!key) {
      throw new Error(`No API key available for provider ${this.name}`);
    }

    const payload = {
      model: this.defaultModel,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1000,
      ...(this.defaultModel.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
    };

    const res = await fetch(this.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.keyPool.markKeyFailed(key);
      }
      return readProviderError(this.name, res);
    }

    const data = await res.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    return {
      content,
      provider: this.name,
      modelUsed: this.defaultModel,
      fallbackUsed: false,
    };
  }

  /** Extra body fields some providers need (e.g. OpenRouter provider routing). */
  protected structuredExtras(): Record<string, unknown> {
    return {};
  }

  completeStructured(request: StructuredCompletionRequest): Promise<StructuredProviderResponse> {
    return withKeyRotation(this.keyPool, this.name, (key) => this.structuredWithKey(request, key));
  }

  private async structuredWithKey(request: StructuredCompletionRequest, key: string): Promise<StructuredProviderResponse> {
    const strict = this.structuredCapability === "strict_json_schema";
    const model = request.model || this.defaultModel;
    const res = await fetch(this.endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0,
        max_tokens: request.maxTokens ?? 6000,
        ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
        response_format: strict
          ? { type: "json_schema", json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema } }
          : { type: "json_object" },
        messages: structuredMessages(request, !strict),
        ...this.structuredExtras(),
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? 25_000),
    });
    if (!res.ok) return readProviderError(this.name, res);
    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content ?? "", modelUsed: model, totalTokens: data.usage?.total_tokens, inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens };
  }
}

/** Gemini's responseJsonSchema does not take type arrays; express "string or null" as anyOf. */
export function toGeminiJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiJsonSchema);
  if (!schema || typeof schema !== "object") return schema;
  const node = schema as Record<string, unknown>;
  if (Array.isArray(node.type)) {
    const { type, ...rest } = node;
    return { anyOf: (type as string[]).map((t) => ({ ...(t === "null" ? {} : toGeminiJsonSchema(rest) as object), type: t })) };
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, toGeminiJsonSchema(v)]));
}

export class GeminiProvider implements ModelProvider {
  name: ModelProviderName = "gemini";
  structuredCapability: StructuredCapability = "strict_json_schema";

  completeStructured(request: StructuredCompletionRequest): Promise<StructuredProviderResponse> {
    return withKeyRotation(this.keyPool, "gemini", (key) => this.structuredWithKey(request, key));
  }

  private async structuredWithKey(request: StructuredCompletionRequest, key: string): Promise<StructuredProviderResponse> {
    const model = request.model || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const contents = [{ role: "user", parts: [{ text: request.userPrompt }] }];
    if (request.repair) {
      contents.push(
        { role: "model", parts: [{ text: request.repair.previousOutput.slice(0, 20_000) }] },
        { role: "user", parts: [{ text: `That JSON failed validation:
${request.repair.errors}
Return the corrected JSON only.` }] },
      );
    }
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      // Key in a header, not the URL, so it never lands in request logs.
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0,
          maxOutputTokens: request.maxTokens ?? 6000,
          responseMimeType: "application/json",
          responseJsonSchema: toGeminiJsonSchema(request.jsonSchema),
        },
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? 25_000),
    });
    if (!res.ok) return readProviderError("gemini", res);
    const data = await res.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      modelUsed: model,
      totalTokens: data.usageMetadata?.totalTokenCount,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    };
  }
  private keyPool = new KeyPool(["GEMINI_API_KEYS", "GEMINI_API_KEY"]);

  isAvailable(): boolean {
    return this.keyPool.hasKeys();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const key = this.keyPool.getNextKey();
    if (!key) throw new Error("No Gemini key available");

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${request.systemPrompt}\n\n${request.userPrompt}` }] },
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 1000,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.keyPool.markKeyFailed(key);
      }
      return readProviderError("gemini", res);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      content,
      provider: "gemini",
      modelUsed: model,
      fallbackUsed: false,
    };
  }
}

export class GroqProvider extends BaseHttpProvider {
  name: ModelProviderName = "groq";
  structuredCapability: StructuredCapability = "strict_json_schema";
  constructor() {
    super(
      ["GROQ_API_KEYS", "GROQ_API_KEY"],
      process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      "https://api.groq.com/openai/v1/chat/completions"
    );
  }
}

export class OpenRouterProvider extends BaseHttpProvider {
  name: ModelProviderName = "openrouter";
  structuredCapability: StructuredCapability = "strict_json_schema";

  /** Route only to upstreams that honour response_format; otherwise strict is not guaranteed. */
  protected structuredExtras() {
    return { provider: { require_parameters: true } };
  }
  constructor() {
    super(
      ["OPENROUTER_API_KEYS", "OPENROUTER_API_KEY"],
      // gpt-oss-120b: fast upstreams with strict structured outputs; the former
      // llama-3.3-70b default timed out at 25 s with require_parameters (2026-10-14).
      process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b",
      "https://openrouter.ai/api/v1/chat/completions"
    );
  }
}

export class CerebrasProvider extends BaseHttpProvider {
  name: ModelProviderName = "cerebras";
  constructor() {
    super(
      ["CEREBRAS_API_KEYS", "CEREBRAS_API_KEY"],
      process.env.CEREBRAS_MODEL || "gpt-oss-120b",
      "https://api.cerebras.ai/v1/chat/completions"
    );
  }
}

export class MistralProvider extends BaseHttpProvider {
  name: ModelProviderName = "mistral";
  constructor() {
    super(
      ["MISTRAL_API_KEYS", "MISTRAL_API_KEY"],
      process.env.MISTRAL_MODEL || "mistral-small-latest",
      "https://api.mistral.ai/v1/chat/completions"
    );
  }
}

export class SambaNovaProvider extends BaseHttpProvider {
  name: ModelProviderName = "sambanova";
  constructor() {
    super(
      ["SAMBANOVA_API_KEYS", "SAMBANOVA_API_KEY"],
      process.env.SAMBANOVA_MODEL || "Meta-Llama-3.3-70B-Instruct",
      "https://api.sambanova.ai/v1/chat/completions"
    );
  }
}
