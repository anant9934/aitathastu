import crypto from "crypto";
import { CompletionRequest, CompletionResponse, ModelProvider, ModelProviderName } from "./types";
import {
  GeminiProvider,
  GroqProvider,
  OpenRouterProvider,
  CerebrasProvider,
  MistralProvider,
  SambaNovaProvider,
} from "./providers/adapters";
import { executeDeterministicFallback } from "./deterministic-fallback";
import { checkAiQuota, estimateTokens, recordAiUsage } from "./cost-control";
import { getDb, aiAuditLogs } from "../db";

export class IntelligenceRouter {
  private providers: ModelProvider[] = [];
  private cooldowns: Map<ModelProviderName, number> = new Map();

  constructor() {
    const providerMap: Record<ModelProviderName, ModelProvider> = {
      groq: new GroqProvider(),
      cerebras: new CerebrasProvider(),
      gemini: new GeminiProvider(),
      openrouter: new OpenRouterProvider(),
      mistral: new MistralProvider(),
      sambanova: new SambaNovaProvider(),
    };

    const orderStr = process.env.CLOUD_AI_PROVIDER_ORDER || "groq,cerebras,gemini,openrouter,mistral,sambanova";
    const orderNames = orderStr.split(",").map((s) => s.trim().toLowerCase() as ModelProviderName);

    const configuredProviders: ModelProvider[] = [];
    for (const name of orderNames) {
      if (providerMap[name]) {
        configuredProviders.push(providerMap[name]);
      }
    }
    for (const provider of Object.values(providerMap)) {
      if (!configuredProviders.includes(provider)) {
        configuredProviders.push(provider);
      }
    }
    this.providers = configuredProviders;
  }

  isProviderCoolingDown(name: ModelProviderName): boolean {
    const expiresAt = this.cooldowns.get(name);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.cooldowns.delete(name);
      return false;
    }
    return true;
  }

  setProviderCooldown(name: ModelProviderName, durationMs = 60_000) {
    this.cooldowns.set(name, Date.now() + durationMs);
  }

  private async logAudit(
    request: CompletionRequest,
    response: CompletionResponse,
    latencyMs: number,
    status: "success" | "fallback" | "error"
  ) {
    if (process.env.NODE_ENV === "test") return;
    try {
      const db = await getDb();
      const id = `audit_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      await db.insert(aiAuditLogs).values({
        id,
        personId: request.personId || null,
        task: request.task,
        provider: response.provider,
        model: response.modelUsed,
        promptVersion: request.promptVersion || "v1",
        latencyMs,
        status,
        fallbackUsed: response.fallbackUsed,
      });
    } catch {
      // Non-fatal logging failure
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    // Check daily AI token quota per user
    if (request.personId) {
      const quota = checkAiQuota(request.personId);
      if (!quota.allowed) {
        const fallbackRes = executeDeterministicFallback(request);
        const latencyMs = Date.now() - startTime;
        const finalFallbackResponse = { ...fallbackRes, latencyMs };
        void this.logAudit(request, finalFallbackResponse, latencyMs, "fallback");
        return finalFallbackResponse;
      }
    }

    for (const provider of this.providers) {
      if (provider.isAvailable() && !this.isProviderCoolingDown(provider.name)) {
        try {
          const res = await provider.complete(request);
          const latencyMs = Date.now() - startTime;
          const finalResponse = { ...res, latencyMs };

          // Record token usage
          if (request.personId) {
            const consumed = estimateTokens(request.userPrompt + request.systemPrompt + res.content);
            recordAiUsage(request.personId, consumed);
          }

          void this.logAudit(request, finalResponse, latencyMs, "success");
          return finalResponse;
        } catch {
          // Provider failure (429 or 5xx) -> set 60s cooldown
          this.setProviderCooldown(provider.name, 60_000);
          continue;
        }
      }
    }

    // Zero-LLM fallback: deterministic rule engine
    const fallbackRes = executeDeterministicFallback(request);
    const latencyMs = Date.now() - startTime;
    const finalFallbackResponse = { ...fallbackRes, latencyMs };

    void this.logAudit(request, finalFallbackResponse, latencyMs, "fallback");
    return finalFallbackResponse;
  }
}

export const defaultIntelligenceRouter = new IntelligenceRouter();
