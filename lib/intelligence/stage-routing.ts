/**
 * Which provider and model each AI stage of CV extraction uses.
 *
 * Stages: "structure" (whole-CV structuring, only when the deterministic result
 * is measurably uncertain), "recovery" (fields the rules left empty) and
 * "verify" (an optional second opinion from a different provider).
 *
 *   AI_STAGE_<STAGE>_PROVIDERS=gemini,groq        order for that stage (subset of CLOUD_AI_PROVIDER_ORDER)
 *   AI_STAGE_<STAGE>_MODEL_<PROVIDER>=<model id>  model for that provider in that stage
 *   AI_PRICE_USD_PER_1M_TOKENS_<PROVIDER>=<n>     blended price, used only to report cost
 *
 * No model id or price is built in: unset stages use the provider's configured
 * model (GROQ_MODEL, GEMINI_MODEL, OPENROUTER_MODEL) and cost is reported as unknown.
 */

import { ACTIVE_ALLOWED_PROVIDERS } from "./router";
import type { ModelProviderName } from "./types";

export type AiStage = "structure" | "recovery" | "verify";

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:\-/]{1,99}$/;

export interface StageRoute {
  providers?: ModelProviderName[];
  models: Partial<Record<ModelProviderName, string>>;
  /** Why a stage cannot run (verify with no provider independent of the producers). */
  unavailable?: string;
}

/** Model a provider runs when a stage sets none: its configured model, else the adapter default. */
const MODEL_ENV: Record<ModelProviderName, [string, string]> = {
  groq: ["GROQ_MODEL", "openai/gpt-oss-120b"],
  gemini: ["GEMINI_MODEL", "gemini-3.5-flash-lite"],
  openrouter: ["OPENROUTER_MODEL", "openai/gpt-oss-120b"],
  cerebras: ["CEREBRAS_MODEL", "gpt-oss-120b"],
  mistral: ["MISTRAL_MODEL", "mistral-small-latest"],
  sambanova: ["SAMBANOVA_MODEL", "Meta-Llama-3.3-70B-Instruct"],
};
export function configuredModel(provider: ModelProviderName, env: NodeJS.ProcessEnv = process.env): string {
  const [name, fallback] = MODEL_ENV[provider];
  return (env[name] ?? "").trim().replace(/^["']|["']$/g, "") || fallback;
}

export function stageRoute(stage: AiStage, opts: { exclude?: ModelProviderName[]; excludeModels?: string[]; env?: NodeJS.ProcessEnv } = {}): StageRoute {
  const env = opts.env ?? process.env;
  const key = stage.toUpperCase();
  const listed = (env[`AI_STAGE_${key}_PROVIDERS`] ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    .filter((n, i, all): n is ModelProviderName => (ACTIVE_ALLOWED_PROVIDERS as readonly string[]).includes(n) && all.indexOf(n) === i);
  const models: Partial<Record<ModelProviderName, string>> = {};
  for (const p of ACTIVE_ALLOWED_PROVIDERS) {
    const m = env[`AI_STAGE_${key}_MODEL_${p.toUpperCase()}`]?.trim();
    if (m && MODEL_ID.test(m)) models[p] = m;
  }
  const exclude = new Set(opts.exclude ?? []);
  if (!exclude.size) return { ...(listed.length ? { providers: listed } : {}), models };
  // Independence: a verifier must not be the provider that produced the values.
  const base = listed.length ? listed : (env.CLOUD_AI_PROVIDER_ORDER ?? ACTIVE_ALLOWED_PROVIDERS.join(","))
    .split(",").map((s) => s.trim().toLowerCase()).filter((n): n is ModelProviderName => (ACTIVE_ALLOWED_PROVIDERS as readonly string[]).includes(n));
  // Independence also means a different model: two providers serving the same
  // model (OpenRouter and Groq both running gpt-oss-120b) are one opinion, not two.
  const excludedModels = new Set((opts.excludeModels ?? []).map((m) => m.toLowerCase()));
  const providers = [...new Set(base)].filter((p) => !exclude.has(p) && !excludedModels.has((models[p] ?? configuredModel(p, env)).toLowerCase()));
  return providers.length ? { providers, models } : { providers: [], models, unavailable: "no_independent_provider" };
}

/** Reported cost of one call, from configured prices only; null when no price is configured. */
export function estimateCostUsd(provider: string, totalTokens: number | undefined, env: NodeJS.ProcessEnv = process.env): number | null {
  const price = Number(env[`AI_PRICE_USD_PER_1M_TOKENS_${provider.toUpperCase()}`]);
  if (!totalTokens || !Number.isFinite(price) || price < 0) return null;
  return Math.round((totalTokens / 1_000_000) * price * 1_000_000) / 1_000_000;
}

/** One AI call as reported in the extraction metadata (no prompt or document content). */
export interface AiCallRecord {
  stage: AiStage;
  provider?: string;
  model?: string;
  latencyMs: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Provider attempts made (cooling-down providers skipped are not counted). */
  attempts?: number;
  /** True when the first provider tried did not answer and a later one did. */
  fallback?: boolean;
  costUsd: number | null;
  outcome: "ok" | "failed" | "skipped";
  reason?: string;
}

/** Usage fields of a call record from a router result or a failure's attempts. */
export function usageOf(r: { attempts?: Array<{ outcome: string }>; totalTokens?: number; inputTokens?: number; outputTokens?: number } | undefined): Partial<AiCallRecord> {
  if (!r) return {};
  const tried = (r.attempts ?? []).filter((a) => a.outcome !== "cooling_down");
  return {
    ...(r.totalTokens ? { totalTokens: r.totalTokens } : {}),
    ...(r.inputTokens !== undefined ? { inputTokens: r.inputTokens } : {}),
    ...(r.outputTokens !== undefined ? { outputTokens: r.outputTokens } : {}),
    ...(tried.length ? { attempts: tried.length, fallback: tried[0].outcome !== "ok" && tried.some((a) => a.outcome === "ok") } : {}),
  };
}
