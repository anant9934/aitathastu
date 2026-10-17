import crypto from "crypto";
import type { ZodType } from "zod";
import {
  CompletionRequest, CompletionResponse, ModelProvider, ModelProviderName,
  ProviderHttpError, type StructuredCompletionRequest,
} from "./types";
import {
  GeminiProvider,
  GroqProvider,
  OpenRouterProvider,
} from "./providers/adapters";
import { executeDeterministicFallback } from "./deterministic-fallback";
import { estimateTokens, releaseAiQuota, reserveAiQuota, settleAiQuota, type QuotaReservation } from "./cost-control";
import { getDb, aiAuditLogs } from "../db";
import { coreIngestionReady } from "../security/core-ingestion-gate";

export const ACTIVE_ALLOWED_PROVIDERS: readonly ModelProviderName[] = [
  "groq",
  "gemini",
  "openrouter",
] as const;

export class IntelligenceRouter {
  private providers: ModelProvider[] = [];
  private cooldowns: Map<ModelProviderName, number> = new Map();

  constructor() {
    const providerMap: Partial<Record<ModelProviderName, ModelProvider>> = {
      groq: new GroqProvider(),
      gemini: new GeminiProvider(),
      openrouter: new OpenRouterProvider(),
    };

    const defaultOrder = "groq,gemini,openrouter";
    const orderStr = process.env.CLOUD_AI_PROVIDER_ORDER || defaultOrder;
    const orderNames = orderStr
      .split(",")
      .map((s) => s.trim().toLowerCase() as ModelProviderName)
      .filter(Boolean);

    const configuredProviders: ModelProvider[] = [];
    const seen = new Set<ModelProviderName>();

    for (const name of orderNames) {
      // 1. Strictly enforce active allowed providers; reject sambanova, mistral, cerebras, and unknown providers
      if (!ACTIVE_ALLOWED_PROVIDERS.includes(name)) {
        continue;
      }
      // 2. Reject duplicate entries
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);

      const p = providerMap[name];
      if (p) {
        configuredProviders.push(p);
      }
    }

    // 3. Fallback: if no valid provider configured, default to all allowed providers in standard order
    if (configuredProviders.length === 0) {
      for (const name of ACTIVE_ALLOWED_PROVIDERS) {
        const p = providerMap[name];
        if (p) configuredProviders.push(p);
      }
    }

    // 4. Do not append any unconfigured or retired providers; CLOUD_AI_PROVIDER_ORDER defines the complete allowed set
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
    // Awaited by every caller (Task 2.6.2): a detached promise can be frozen when a
    // serverless invocation ends, dropping the row. Tests opt in to exercise it.
    if (process.env.NODE_ENV === "test" && process.env.AI_AUDIT_IN_TESTS !== "true") return;
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

    if (process.env.CORE_DISABLE_LIVE_LLM === "true" || !coreIngestionReady()) {
      const fallbackRes = executeDeterministicFallback(request);
      const finalResponse = { ...fallbackRes, latencyMs: Date.now() - startTime };
      await this.logAudit(request, finalResponse, finalResponse.latencyMs, "fallback");
      return finalResponse;
    }

    // Distributed per-user and global quota (Task 1.7.1).
    const quota = await reserveAiQuota(request.personId, estimateTokens(request.userPrompt + request.systemPrompt) + (request.maxTokens ?? 1000));
    if (!quota.allowed) {
      const fallbackRes = executeDeterministicFallback(request);
      const latencyMs = Date.now() - startTime;
      const finalFallbackResponse = { ...fallbackRes, latencyMs, quotaExceeded: quota.reason };
      await this.logAudit(request, finalFallbackResponse, latencyMs, "fallback");
      return finalFallbackResponse;
    }

    for (const provider of this.providers) {
      if (provider.isAvailable() && !this.isProviderCoolingDown(provider.name)) {
        try {
          const res = await provider.complete(request);
          const latencyMs = Date.now() - startTime;
          const finalResponse = { ...res, latencyMs };
          await settleAiQuota(quota, estimateTokens(request.userPrompt + request.systemPrompt + res.content));

          await this.logAudit(request, finalResponse, latencyMs, "success");
          return finalResponse;
        } catch {
          // Provider failure (429 or 5xx) -> set 60s cooldown
          this.setProviderCooldown(provider.name, 60_000);
          continue;
        }
      }
    }

    // Zero-LLM fallback: deterministic rule engine
    await releaseAiQuota(quota);
    const fallbackRes = executeDeterministicFallback(request);
    const latencyMs = Date.now() - startTime;
    const finalFallbackResponse = { ...fallbackRes, latencyMs };

    await this.logAudit(request, finalFallbackResponse, latencyMs, "fallback");
    return finalFallbackResponse;
  }

  /**
   * Schema-constrained completion across the provider pool (Task 1.1.2).
   * Providers with native strict JSON schema decoding are tried first, in
   * CLOUD_AI_PROVIDER_ORDER; json_object-only providers follow and get one
   * repair turn when zod rejects their output. 429 / 5xx / timeouts cool a
   * provider down for 60 s; other 4xx and invalid output just move on.
   * There is no deterministic fallback here: the caller decides what an
   * unstructured failure means.
   */
  async completeStructured<T>(request: StructuredCompletionRequest, schema: ZodType<T>): Promise<StructuredCompletionResult<T>> {
    const started = Date.now();
    const attempts: StructuredAttempt[] = [];
    if (process.env.CORE_DISABLE_LIVE_LLM === "true" || !coreIngestionReady()) {
      throw new StructuredCompletionError("Live LLM calls are disabled in this environment.", "not_configured", attempts);
    }
    const ordered = [
      ...this.providers.filter((p) => p.structuredCapability === "strict_json_schema"),
      ...this.providers.filter((p) => p.structuredCapability === "json_object"),
    ].filter((p) => p.isAvailable());
    if (!ordered.length) throw new StructuredCompletionError("No AI provider is configured.", "not_configured", attempts);

    const quota = await reserveAiQuota(request.personId, estimateTokens(request.systemPrompt + request.userPrompt) + (request.maxTokens ?? 6000));
    if (!quota.allowed) throw new StructuredCompletionError(quota.reason || "AI quota reached.", "quota", attempts, quota);

    for (const provider of ordered) {
      if (this.isProviderCoolingDown(provider.name)) {
        attempts.push({ provider: provider.name, outcome: "cooling_down", ms: 0 });
        continue;
      }
      const turns = provider.structuredCapability === "json_object" ? 2 : 1;
      let repair: StructuredCompletionRequest["repair"];
      for (let turn = 0; turn < turns; turn++) {
        const t0 = Date.now();
        try {
          const res = await provider.completeStructured({ ...request, repair });
          let json: unknown;
          try {
            json = JSON.parse(res.content);
          } catch {
            attempts.push({ provider: provider.name, outcome: "malformed_json", ms: Date.now() - t0 });
            repair = { previousOutput: res.content, errors: "The output was not valid JSON." };
            continue;
          }
          const parsed = schema.safeParse(json);
          if (!parsed.success) {
            const errors = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
            attempts.push({ provider: provider.name, outcome: "schema_violation", ms: Date.now() - t0, detail: errors.slice(0, 300) });
            repair = { previousOutput: res.content, errors };
            continue;
          }
          attempts.push({ provider: provider.name, outcome: "ok", ms: Date.now() - t0 });
          await settleAiQuota(quota, res.totalTokens ?? estimateTokens(request.systemPrompt + request.userPrompt + res.content));
          const response: CompletionResponse = { content: res.content, provider: provider.name, modelUsed: res.modelUsed, fallbackUsed: false, latencyMs: Date.now() - started };
          await this.logAudit(request, response, Date.now() - started, attempts.length > 1 ? "fallback" : "success");
          return { data: parsed.data, provider: provider.name, model: res.modelUsed, attempts, latencyMs: Date.now() - started };
        } catch (error) {
          const ms = Date.now() - t0;
          if (error instanceof ProviderHttpError) {
            const transient = error.status === 429 || error.status >= 500;
            if (transient) this.setProviderCooldown(provider.name, 60_000);
            // 402: billing/plan problem on the whole account; don't retry it for an hour.
            if (error.status === 402) this.setProviderCooldown(provider.name, 60 * 60_000);
            attempts.push({ provider: provider.name, outcome: transient ? "rate_limited_or_5xx" : "rejected_4xx", status: error.status, ms, detail: error.message.slice(0, 300) });
          } else {
            const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
            if (timedOut) this.setProviderCooldown(provider.name, 60_000);
            attempts.push({ provider: provider.name, outcome: timedOut ? "timeout" : "network_error", ms, detail: error instanceof Error ? error.message.slice(0, 300) : String(error) });
          }
          break; // next provider
        }
      }
    }
    await releaseAiQuota(quota);
    throw new StructuredCompletionError("Every AI provider failed to return valid structured output.", "provider", attempts);
  }
}

export type StructuredAttempt = {
  provider: ModelProviderName;
  outcome: "ok" | "cooling_down" | "malformed_json" | "schema_violation" | "rate_limited_or_5xx" | "rejected_4xx" | "timeout" | "network_error";
  status?: number;
  ms: number;
  detail?: string;
};

export type StructuredCompletionResult<T> = { data: T; provider: ModelProviderName; model: string; attempts: StructuredAttempt[]; latencyMs: number };

export class StructuredCompletionError extends Error {
  constructor(message: string, readonly kind: "not_configured" | "quota" | "provider", readonly attempts: StructuredAttempt[], readonly quota?: QuotaReservation) {
    super(message);
    this.name = "StructuredCompletionError";
  }
}

export const defaultIntelligenceRouter = new IntelligenceRouter();
