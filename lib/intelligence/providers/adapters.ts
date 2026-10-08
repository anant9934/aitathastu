import { ModelProvider, ModelProviderName, CompletionRequest, CompletionResponse } from "../types";
import { KeyPool } from "./key-pool";

abstract class BaseHttpProvider implements ModelProvider {
  abstract name: ModelProviderName;
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
      throw new Error(`Provider ${this.name} request failed with status ${res.status}`);
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
}

export class GeminiProvider implements ModelProvider {
  name: ModelProviderName = "gemini";
  private keyPool = new KeyPool(["GEMINI_API_KEYS", "GEMINI_API_KEY"]);

  isAvailable(): boolean {
    return this.keyPool.hasKeys();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const key = this.keyPool.getNextKey();
    if (!key) throw new Error("No Gemini key available");

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      throw new Error(`Gemini API error: ${res.status}`);
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
  constructor() {
    super(
      ["OPENROUTER_API_KEYS", "OPENROUTER_API_KEY"],
      process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct",
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
