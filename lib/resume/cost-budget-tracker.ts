/**
 * AI TATHASTU — COST & BUDGET TRACKER (V6.0)
 *
 * Implements strict cost controls, preflight token estimation, and usage
 * metering for selective LLM operations.
 *
 * Enforces:
 * 1. Hard budget ceiling per CV ($0.01 USD default).
 * 2. Soft budget target ($0.003 USD default).
 * 3. Explicit student consent requirement.
 * 4. Metering of validated improvements per 1,000 tokens.
 */

export interface CostConfig {
  enrichmentEnabled: boolean;
  targetCoverage: number;
  softBudgetUsd: number;
  hardBudgetUsd: number;
  maxRecoveryAttempts: number;
  maxQaAttempts: number;
  requireConsent: boolean;
}

export function getCostConfig(): CostConfig {
  return {
    enrichmentEnabled: process.env.CV_LLM_ENRICHMENT_ENABLED !== "false",
    targetCoverage: Number(process.env.CV_LLM_TARGET_COVERAGE || "0.90"),
    softBudgetUsd: Number(process.env.CV_LLM_SOFT_BUDGET_USD || "0.003"),
    hardBudgetUsd: Number(process.env.CV_LLM_HARD_BUDGET_USD || "0.01"),
    maxRecoveryAttempts: Number(process.env.CV_LLM_MAX_RECOVERY_ATTEMPTS || "2"),
    maxQaAttempts: Number(process.env.CV_LLM_MAX_QA_ATTEMPTS || "1"),
    requireConsent: process.env.CV_LLM_REQUIRE_CONSENT !== "false",
  };
}

// Current official standard rates per million tokens (illustrative baseline for Gemini Flash / Groq)
export const PROVIDER_RATES_PER_MILLION: Record<string, { input: number; output: number }> = {
  gemini: { input: 0.10, output: 0.40 }, // $0.10 / M in, $0.40 / M out
  groq: { input: 0.08, output: 0.24 },   // $0.08 / M in, $0.24 / M out
  openrouter: { input: 0.15, output: 0.60 },
  default: { input: 0.10, output: 0.40 },
};

export interface PreflightEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  allowed: boolean;
  reason: string;
}

export interface ModelInvocationRecord {
  jobId: string;
  provider: string;
  model: string;
  purpose: "missing_record_recovery" | "semantic_deduplication" | "writing_quality_cleanup" | "risk_audit";
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  recordsImproved: number;
}

export class CvCostLedger {
  private invocations: ModelInvocationRecord[] = [];
  private cumulativeCostUsd = 0;
  private recoveryAttempts = 0;
  private qaAttempts = 0;

  constructor(public readonly config: CostConfig = getCostConfig()) {}

  /**
   * Performs preflight token and cost estimation before any model request.
   */
  public preflightCheck(
    inputText: string,
    expectedOutputTokens = 800,
    provider = "gemini",
    studentConsent = false
  ): PreflightEstimate {
    if (!this.config.enrichmentEnabled) {
      return {
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedCostUsd: 0,
        allowed: false,
        reason: "llm_enrichment_disabled",
      };
    }

    if (this.config.requireConsent && !studentConsent) {
      return {
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedCostUsd: 0,
        allowed: false,
        reason: "student_consent_required",
      };
    }

    // Conservative estimation: ~3.8 chars per token for structured text
    const estimatedInputTokens = Math.ceil(inputText.length / 3.8);
    const rates = PROVIDER_RATES_PER_MILLION[provider] || PROVIDER_RATES_PER_MILLION.default;

    const estimatedOutputTokens = expectedOutputTokens;
    const estimatedCostUsd =
      (estimatedInputTokens * rates.input + estimatedOutputTokens * rates.output) / 1_000_000;

    const projectedTotalCost = this.cumulativeCostUsd + estimatedCostUsd;

    if (projectedTotalCost > this.config.hardBudgetUsd) {
      return {
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedCostUsd,
        allowed: false,
        reason: `hard_budget_exceeded: projected $${projectedTotalCost.toFixed(5)} > $${this.config.hardBudgetUsd.toFixed(5)}`,
      };
    }

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUsd,
      allowed: true,
      reason: "within_budget",
    };
  }

  /**
   * Records completed invocation metrics.
   */
  public recordInvocation(record: ModelInvocationRecord) {
    this.invocations.push(record);
    this.cumulativeCostUsd += record.costUsd;

    if (record.purpose === "missing_record_recovery") {
      this.recoveryAttempts++;
    } else {
      this.qaAttempts++;
    }
  }

  public getSummary() {
    const totalInputTokens = this.invocations.reduce((sum, i) => sum + i.inputTokens, 0);
    const totalOutputTokens = this.invocations.reduce((sum, i) => sum + i.outputTokens, 0);
    const totalTokens = totalInputTokens + totalOutputTokens;
    const totalRecordsImproved = this.invocations.reduce((sum, i) => sum + i.recordsImproved, 0);

    const validatedImprovementsPer1000Tokens =
      totalTokens > 0 ? (totalRecordsImproved / totalTokens) * 1000 : 0;

    const costPerValidatedImprovement =
      totalRecordsImproved > 0 ? this.cumulativeCostUsd / totalRecordsImproved : 0;

    return {
      totalInvocations: this.invocations.length,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      cumulativeCostUsd: Number(this.cumulativeCostUsd.toFixed(6)),
      totalRecordsImproved,
      validatedImprovementsPer1000Tokens: Number(validatedImprovementsPer1000Tokens.toFixed(3)),
      costPerValidatedImprovement: Number(costPerValidatedImprovement.toFixed(6)),
      withinSoftBudget: this.cumulativeCostUsd <= this.config.softBudgetUsd,
      withinHardBudget: this.cumulativeCostUsd <= this.config.hardBudgetUsd,
      recoveryAttempts: this.recoveryAttempts,
      qaAttempts: this.qaAttempts,
    };
  }
}
