/**
 * AI TATHASTU — SERVER-SIDE MODEL PROVIDER REGISTRY
 * 
 * Formal registry for all permitted AI/ML model providers.
 * Tracks configured model IDs, features, context limits, timeouts,
 * operational health states, and server-side secret presence.
 * Secrets are NEVER exposed through client-visible representations.
 */

import { ModelProviderName } from "../types";

export interface ProviderDefinition {
  providerId: ModelProviderName;
  displayName: string;
  configuredModelId: string;
  defaultEndpointUrl: string;
  envKeyNames: string[];
  supportedFeatures: {
    structuredOutput: boolean;
    toolCalling: boolean;
    streaming: boolean;
    jsonMode: boolean;
  };
  contextLimitTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
  rateLimitRpm: number;
  dataPrivacyPolicy: "zero_retention" | "standard_api_terms" | "enterprise";
  healthState: "operational" | "cooling_down" | "unconfigured" | "error";
  lastError?: string;
  lastCheckedAt?: string;
}

export const PROVIDER_REGISTRY: Record<ModelProviderName, ProviderDefinition> = {
  gemini: {
    providerId: "gemini",
    displayName: "Google Gemini",
    configuredModelId: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    defaultEndpointUrl: "https://generativelanguage.googleapis.com/v1beta",
    envKeyNames: ["GEMINI_API_KEYS", "GEMINI_API_KEY"],
    supportedFeatures: {
      structuredOutput: true,
      toolCalling: true,
      streaming: true,
      jsonMode: true,
    },
    contextLimitTokens: 1_000_000,
    maxOutputTokens: 8192,
    timeoutMs: 12_000,
    rateLimitRpm: 15,
    dataPrivacyPolicy: "standard_api_terms",
    healthState: "unconfigured",
  },
  groq: {
    providerId: "groq",
    displayName: "Groq LPU",
    configuredModelId: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    defaultEndpointUrl: "https://api.groq.com/openai/v1/chat/completions",
    envKeyNames: ["GROQ_API_KEYS", "GROQ_API_KEY"],
    supportedFeatures: {
      structuredOutput: true,
      toolCalling: true,
      streaming: true,
      jsonMode: true,
    },
    contextLimitTokens: 128_000,
    maxOutputTokens: 4096,
    timeoutMs: 8_000,
    rateLimitRpm: 30,
    dataPrivacyPolicy: "standard_api_terms",
    healthState: "unconfigured",
  },
  openrouter: {
    providerId: "openrouter",
    displayName: "OpenRouter Unified",
    configuredModelId: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct",
    defaultEndpointUrl: "https://openrouter.ai/api/v1/chat/completions",
    envKeyNames: ["OPENROUTER_API_KEYS", "OPENROUTER_API_KEY"],
    supportedFeatures: {
      structuredOutput: true,
      toolCalling: false,
      streaming: true,
      jsonMode: true,
    },
    contextLimitTokens: 128_000,
    maxOutputTokens: 4096,
    timeoutMs: 10_000,
    rateLimitRpm: 20,
    dataPrivacyPolicy: "standard_api_terms",
    healthState: "unconfigured",
  },
  mistral: {
    providerId: "mistral",
    displayName: "Mistral AI",
    configuredModelId: process.env.MISTRAL_MODEL || "mistral-small-latest",
    defaultEndpointUrl: "https://api.mistral.ai/v1/chat/completions",
    envKeyNames: ["MISTRAL_API_KEYS", "MISTRAL_API_KEY"],
    supportedFeatures: {
      structuredOutput: true,
      toolCalling: true,
      streaming: true,
      jsonMode: true,
    },
    contextLimitTokens: 32_000,
    maxOutputTokens: 2048,
    timeoutMs: 10_000,
    rateLimitRpm: 20,
    dataPrivacyPolicy: "standard_api_terms",
    healthState: "unconfigured",
  },
  cerebras: {
    providerId: "cerebras",
    displayName: "Cerebras Fast Inference",
    configuredModelId: process.env.CEREBRAS_MODEL || "llama3.1-8b",
    defaultEndpointUrl: "https://api.cerebras.ai/v1/chat/completions",
    envKeyNames: ["CEREBRAS_API_KEYS", "CEREBRAS_API_KEY"],
    supportedFeatures: {
      structuredOutput: true,
      toolCalling: false,
      streaming: true,
      jsonMode: true,
    },
    contextLimitTokens: 8192,
    maxOutputTokens: 2048,
    timeoutMs: 6_000,
    rateLimitRpm: 30,
    dataPrivacyPolicy: "standard_api_terms",
    healthState: "unconfigured",
  },
  sambanova: {
    providerId: "sambanova",
    displayName: "SambaNova Systems",
    configuredModelId: process.env.SAMBANOVA_MODEL || "Meta-Llama-3.1-70B-Instruct",
    defaultEndpointUrl: "https://api.sambanova.ai/v1/chat/completions",
    envKeyNames: ["SAMBANOVA_API_KEYS", "SAMBANOVA_API_KEY"],
    supportedFeatures: {
      structuredOutput: true,
      toolCalling: false,
      streaming: true,
      jsonMode: true,
    },
    contextLimitTokens: 64_000,
    maxOutputTokens: 4096,
    timeoutMs: 10_000,
    rateLimitRpm: 20,
    dataPrivacyPolicy: "standard_api_terms",
    healthState: "unconfigured",
  },
};

/**
 * Returns a sanitized client-safe representation of provider statuses
 * (without API keys, secrets, or internal tokens).
 */
export function getSanitizedProviderStatus(): Array<Omit<ProviderDefinition, "envKeyNames">> {
  return Object.values(PROVIDER_REGISTRY).map((p) => {
    const hasKeys = p.envKeyNames.some((k) => Boolean(process.env[k]?.trim()));
    return {
      providerId: p.providerId,
      displayName: p.displayName,
      configuredModelId: p.configuredModelId,
      defaultEndpointUrl: p.defaultEndpointUrl,
      supportedFeatures: p.supportedFeatures,
      contextLimitTokens: p.contextLimitTokens,
      maxOutputTokens: p.maxOutputTokens,
      timeoutMs: p.timeoutMs,
      rateLimitRpm: p.rateLimitRpm,
      dataPrivacyPolicy: p.dataPrivacyPolicy,
      healthState: hasKeys ? p.healthState : "unconfigured",
      lastError: p.lastError,
      lastCheckedAt: p.lastCheckedAt,
    };
  });
}
