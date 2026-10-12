import type { EvidenceItem } from "./evidence";
import type { Goal } from "./goal";
import { getGoalTemplate } from "./gaps";

export type EvidenceStrengthLevel = 0 | 1 | 2 | 3;

export type DimensionState = "unknown" | "some_evidence" | "demonstrated" | "verified";

export type DimensionPolicy = {
  key: string;
  label: string;
  weight: number;
  isCritical?: boolean;
  keywords: string[];
  description: string;
};

export type ReadinessPolicy = {
  key: string;
  name: string;
  version: string;
  goalTemplateKey: string;
  status: "active" | "deprecated";
  effectiveFrom: string;
  methodDescription: string;
  dimensions: DimensionPolicy[];
  minVerifiedCoverage: number; // percentage (e.g. 60)
  minEvidenceCoverage: number; // percentage (e.g. 60)
};

export type DimensionEvaluation = {
  key: string;
  label: string;
  weight: number;
  state: DimensionState;
  strengthLevel: EvidenceStrengthLevel;
  evidenceIds: string[];
  matchingEvidenceCount: number;
  hasVerifiedEvidence: boolean;
  contribution?: number;
  explanation: string;
};

export type ReadinessResult = {
  goalId?: string;
  goalTitle: string;
  policyKey: string;
  policyName: string;
  policyVersion: string;
  calculatedAt: string;
  publishable: boolean;
  score?: number;
  evidenceCoverage: number;
  verifiedCoverage: number;
  dimensions: DimensionEvaluation[];
  unavailableReasons: string[];
};

// Approved versioned readiness policies
const READINESS_POLICIES: Record<string, ReadinessPolicy> = {
  "ml-engineer-v1": {
    key: "ml-engineer-v1",
    name: "AI Tathastu ML Engineer Readiness v1",
    version: "v1",
    goalTemplateKey: "ml-engineer",
    status: "active",
    effectiveFrom: "2026-10-01",
    methodDescription:
      "Deterministic 5-dimension evaluation model prioritizing independently verified code, ML implementations, and production deployment.",
    minVerifiedCoverage: 60,
    minEvidenceCoverage: 60,
    dimensions: [
      {
        key: "programming",
        label: "Programming",
        weight: 20,
        isCritical: true,
        keywords: ["python", "c++", "java", "sql", "coding", "software", "programming", "algorithms"],
        description: "Core coding languages and data processing fundamentals.",
      },
      {
        key: "machine_learning",
        label: "Machine Learning",
        weight: 25,
        isCritical: true,
        keywords: [
          "machine learning",
          "ml",
          "deep learning",
          "pytorch",
          "tensorflow",
          "scikit-learn",
          "keras",
          "nlp",
          "computer vision",
          "transformers",
        ],
        description: "ML frameworks, model training, loss optimization, and evaluation.",
      },
      {
        key: "project_build",
        label: "Project / Build",
        weight: 20,
        isCritical: false,
        keywords: ["project", "built", "repo", "github", "pipeline", "kaggle", "prototype", "dataset"],
        description: "Hands-on implementation of end-to-end models with real datasets.",
      },
      {
        key: "deployment",
        label: "Deployment",
        weight: 20,
        isCritical: true,
        keywords: ["deploy", "docker", "kubernetes", "fastapi", "flask", "aws", "gcp", "azure", "serving", "production", "ci/cd"],
        description: "Serving models, containerization, cloud deployment, and APIs.",
      },
      {
        key: "interview",
        label: "Interview & Systems",
        weight: 15,
        isCritical: false,
        keywords: ["interview", "presentation", "communication", "leadership", "mentoring", "system design"],
        description: "Technical articulation, trade-off analysis, and system discussion.",
      },
    ],
  },
  "ai-researcher-v1": {
    key: "ai-researcher-v1",
    name: "AI Tathastu AI Researcher Readiness v1",
    version: "v1",
    goalTemplateKey: "ai-researcher",
    status: "active",
    effectiveFrom: "2026-10-01",
    methodDescription:
      "Deterministic evaluation focused on foundational mathematics, experimental rigor, and scientific reporting.",
    minVerifiedCoverage: 60,
    minEvidenceCoverage: 60,
    dimensions: [
      {
        key: "foundations",
        label: "Foundational Math & Theory",
        weight: 25,
        isCritical: true,
        keywords: ["math", "mathematics", "linear algebra", "calculus", "probability", "statistics", "theory"],
        description: "Linear algebra, probability, calculus, and theoretical foundations.",
      },
      {
        key: "literature",
        label: "Literature Survey & Analysis",
        weight: 20,
        isCritical: false,
        keywords: ["paper", "reading", "survey", "arxiv", "literature", "review", "reading group"],
        description: "Synthesizing recent papers, arXiv reading, and methodology critique.",
      },
      {
        key: "experimentation",
        label: "Rigorous Experimentation",
        weight: 25,
        isCritical: true,
        keywords: ["experiment", "ablation", "benchmark", "evaluation", "metrics", "reproducibility"],
        description: "Controlled experiments, baseline comparisons, and ablation studies.",
      },
      {
        key: "writing",
        label: "Scientific Writing",
        weight: 15,
        isCritical: false,
        keywords: ["writing", "publication", "paper", "manuscript", "report", "arxiv"],
        description: "Documenting hypotheses, technical reports, and research briefs.",
      },
      {
        key: "critique",
        label: "Peer Critique & Discussion",
        weight: 15,
        isCritical: false,
        keywords: ["critique", "seminar", "presentation", "conference", "discussion"],
        description: "Academic discussion, seminar participation, and peer review.",
      },
    ],
  },
  "ai-founder-v1": {
    key: "ai-founder-v1",
    name: "AI Tathastu AI Founder Readiness v1",
    version: "v1",
    goalTemplateKey: "ai-founder",
    status: "active",
    effectiveFrom: "2026-10-01",
    methodDescription:
      "Deterministic evaluation of customer discovery, rapid prototype delivery, and traction milestones.",
    minVerifiedCoverage: 60,
    minEvidenceCoverage: 60,
    dimensions: [
      {
        key: "problem_discovery",
        label: "Problem Discovery",
        weight: 25,
        isCritical: true,
        keywords: ["user", "customer", "problem", "interview", "validation", "market", "discovery"],
        description: "Validating user pain points, customer interviews, and market need.",
      },
      {
        key: "prototype_build",
        label: "Prototype / MVP Build",
        weight: 25,
        isCritical: true,
        keywords: ["mvp", "prototype", "product", "demo", "app", "built", "fullstack", "software"],
        description: "Rapidly building working software that users can try.",
      },
      {
        key: "distribution",
        label: "Distribution & Feedback",
        weight: 20,
        isCritical: false,
        keywords: ["growth", "users", "launch", "feedback", "analytics", "distribution", "retention"],
        description: "Getting early users, collecting feedback, and iterating on retention.",
      },
      {
        key: "execution",
        label: "Execution & Delivery",
        weight: 15,
        isCritical: false,
        keywords: ["roadmap", "shipping", "milestone", "delivery", "sprint"],
        description: "Consistent shipping pace and product roadmap execution.",
      },
      {
        key: "pitch",
        label: "Value Proposition & Narrative",
        weight: 15,
        isCritical: false,
        keywords: ["pitch", "deck", "investor", "demo", "storytelling", "narrative"],
        description: "Explaining the vision and value proposition with clarity.",
      },
    ],
  },
};

/**
 * Returns the active readiness policy matching a goal title or template key.
 */
function getReadinessPolicyForGoal(goalTitle: string): ReadinessPolicy | null {
  const { template, isCustom } = getGoalTemplate(goalTitle);
  if (isCustom) return null;

  switch (template.goalKey) {
    case "ml-engineer":
      return READINESS_POLICIES["ml-engineer-v1"];
    case "ai-researcher":
      return READINESS_POLICIES["ai-researcher-v1"];
    case "ai-founder":
      return READINESS_POLICIES["ai-founder-v1"];
    default:
      return null;
  }
}

/**
 * Evaluates evidence strength for a dimension deterministically.
 * Avoids blind double-counting of correlated resume keywords.
 */
function evaluateDimensionStrength(
  dim: DimensionPolicy,
  evidence: EvidenceItem[]
): {
  strengthLevel: EvidenceStrengthLevel;
  matchingItems: EvidenceItem[];
  explanation: string;
} {
  // Find matching items by keyword or integration category/topic
  const matchingItems = evidence.filter((ev) => {
    const text = `${ev.subject} ${ev.value} ${ev.whyItMatters || ""}`.toLowerCase();
    const keywordMatch = dim.keywords.some((kw) => text.includes(kw));
    if (keywordMatch) return true;

    // Direct assessment / interview category mappings
    if (ev.category === "interview" && dim.key === "interview") return true;
    if (ev.category === "assessment") {
      if (dim.key === "programming" && (text.includes("programming") || text.includes("python") || text.includes("coding"))) return true;
      if (dim.key === "machine_learning" && (text.includes("machine learning") || text.includes("ml") || text.includes("deep learning"))) return true;
    }
    return false;
  });

  if (matchingItems.length === 0) {
    return {
      strengthLevel: 0,
      matchingItems: [],
      explanation: "No qualifying evidence yet in this dimension.",
    };
  }

  // Level 3: Independently verified direct evidence (faculty review, ERIS assessment, AI interview rubric)
  const verifiedItems = matchingItems.filter((e) => e.verificationStatus === "verified");
  if (verifiedItems.length > 0) {
    const isEris = verifiedItems.some((e) => e.category === "assessment" || e.interpretation?.includes("ERIS"));
    const isInterview = verifiedItems.some((e) => e.category === "interview" || e.interpretation?.includes("Interview"));
    let srcDesc = "authorized review";
    if (isEris && isInterview) srcDesc = "ERIS assessment & AI interview";
    else if (isEris) srcDesc = "ERIS assessment";
    else if (isInterview) srcDesc = "AI interview rubric";

    return {
      strengthLevel: 3,
      matchingItems,
      explanation: `Independently verified via ${srcDesc} (${verifiedItems.length} verified item${verifiedItems.length > 1 ? "s" : ""}).`,
    };
  }

  // Level 2: Demonstrated artifact evidence (e.g. project with concrete reference / repo or non-correlated items)
  // Deduplicate correlated items: items with same source or sourceReference are treated as one cluster
  const distinctSources = new Set(matchingItems.map((e) => `${e.source}_${e.category}`));
  const hasDemonstratedProject = matchingItems.some(
    (e) => (e.category === "project" || e.sourceReference) && e.verificationStatus !== "rejected"
  );

  if (hasDemonstratedProject || distinctSources.size >= 2) {
    return {
      strengthLevel: 2,
      matchingItems,
      explanation: `Demonstrated through hands-on project artifacts or multiple independent records (${matchingItems.length} item${matchingItems.length > 1 ? "s" : ""}, unverified).`,
    };
  }

  // Level 1: Claim / self-reported single record
  return {
    strengthLevel: 1,
    matchingItems,
    explanation: `Self-reported or extracted mention (${matchingItems.length} item${matchingItems.length > 1 ? "s" : ""}). Awaiting verified demonstration.`,
  };
}

/**
 * Multiplier for each strength level:
 * Level 0 = 0
 * Level 1 = 0.35 (Claim / self-reported)
 * Level 2 = 0.65 (Demonstrated hands-on artifact)
 * Level 3 = 1.00 (Independently verified direct evidence)
 */
export const STRENGTH_MULTIPLIERS: Record<EvidenceStrengthLevel, number> = {
  0: 0.0,
  1: 0.35,
  2: 0.65,
  3: 1.0,
};

/**
 * Calculates defensible readiness estimate for a goal and evidence set.
 * Enforces the publication gate: never fabricates a percentage if requirements fail.
 */
export function calculateReadiness(
  goal: Goal | { id?: string; title: string },
  evidence: EvidenceItem[],
  forcedPolicy?: ReadinessPolicy
): ReadinessResult {
  const goalTitle = goal.title || "Custom Goal";
  const policy = forcedPolicy || getReadinessPolicyForGoal(goalTitle);
  const calculatedAt = new Date().toISOString();

  // Custom goal without policy
  if (!policy) {
    return {
      goalId: goal.id,
      goalTitle,
      policyKey: "custom-no-policy",
      policyName: "No Readiness Policy Available",
      policyVersion: "none",
      calculatedAt,
      publishable: false,
      evidenceCoverage: 0,
      verifiedCoverage: 0,
      dimensions: [],
      unavailableReasons: [
        "Readiness scoring is not available for this custom goal yet. Explore Evidence, Gaps, and Next Actions below.",
      ],
    };
  }

  const dimensionEvaluations: DimensionEvaluation[] = [];
  let evidencedDimensionsCount = 0;
  let verifiedDimensionsCount = 0;
  const missingCriticalDimensions: string[] = [];

  for (const dim of policy.dimensions) {

    const { strengthLevel, matchingItems, explanation } = evaluateDimensionStrength(dim, evidence);

    const hasVerified = strengthLevel === 3;
    const isEvidenced = strengthLevel > 0;

    if (isEvidenced) evidencedDimensionsCount++;
    if (hasVerified) verifiedDimensionsCount++;

    if (dim.isCritical && strengthLevel === 0) {
      missingCriticalDimensions.push(dim.label);
    }

    let state: DimensionState = "unknown";
    if (strengthLevel === 3) state = "verified";
    else if (strengthLevel === 2) state = "demonstrated";
    else if (strengthLevel === 1) state = "some_evidence";

    dimensionEvaluations.push({
      key: dim.key,
      label: dim.label,
      weight: dim.weight,
      state,
      strengthLevel,
      evidenceIds: matchingItems.map((e) => e.id),
      matchingEvidenceCount: matchingItems.length,
      hasVerifiedEvidence: hasVerified,
      explanation,
    });
  }

  const totalDimensions = policy.dimensions.length;
  const evidenceCoverage = Math.round((evidencedDimensionsCount / totalDimensions) * 100);
  const verifiedCoverage = Math.round((verifiedDimensionsCount / totalDimensions) * 100);

  // Publication gate check
  const unavailableReasons: string[] = [];

  if (verifiedCoverage < policy.minVerifiedCoverage) {
    unavailableReasons.push(
      `More verified evidence is needed before a meaningful estimate can be shown (current verified coverage: ${verifiedCoverage}%, required: ${policy.minVerifiedCoverage}%).`
    );
  }

  if (evidenceCoverage < policy.minEvidenceCoverage) {
    unavailableReasons.push(
      `Evidence coverage is currently ${evidenceCoverage}%, but minimum ${policy.minEvidenceCoverage}% is required.`
    );
  }

  if (missingCriticalDimensions.length > 0) {
    unavailableReasons.push(
      `Critical dimension${missingCriticalDimensions.length > 1 ? "s" : ""} completely unsupported: ${missingCriticalDimensions.join(", ")}.`
    );
  }

  const publishable = unavailableReasons.length === 0;

  if (!publishable) {
    return {
      goalId: goal.id,
      goalTitle,
      policyKey: policy.key,
      policyName: policy.name,
      policyVersion: policy.version,
      calculatedAt,
      publishable: false,
      score: undefined,
      evidenceCoverage,
      verifiedCoverage,
      dimensions: dimensionEvaluations,
      unavailableReasons,
    };
  }

  // Calculate score and contribution per dimension deterministically
  // Sum of contributions will exactly equal score
  let totalScore = 0;
  for (const dimEval of dimensionEvaluations) {
    const mult = STRENGTH_MULTIPLIERS[dimEval.strengthLevel];
    const contribution = Math.round(dimEval.weight * mult);
    dimEval.contribution = contribution;
    totalScore += contribution;
  }

  // Bound score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

  return {
    goalId: goal.id,
    goalTitle,
    policyKey: policy.key,
    policyName: policy.name,
    policyVersion: policy.version,
    calculatedAt,
    publishable: true,
    score: finalScore,
    evidenceCoverage,
    verifiedCoverage,
    dimensions: dimensionEvaluations,
    unavailableReasons: [],
  };
}
