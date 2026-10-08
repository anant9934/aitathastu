import type { EvidenceItem } from "./evidence";

export type GapState = "demonstrated" | "partially_evidenced" | "unknown" | "not_applicable";

export type GoalDimension = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
};

export type GoalRequirementTemplate = {
  goalKey: string;
  title: string;
  dimensions: GoalDimension[];
};

export type GoalDimensionState = {
  dimensionId: string;
  label: string;
  description: string;
  state: GapState;
  matchingEvidence: EvidenceItem[];
  explanation: string;
};

export type GapEvaluation = {
  goalTitle: string;
  isCustomGoal: boolean;
  dimensions: GoalDimensionState[];
  unknownCount: number;
  partiallyEvidencedCount: number;
  demonstratedCount: number;
  unknownDimensionLabels: string[];
};

export const GOAL_REQUIREMENT_TEMPLATES: Record<string, GoalRequirementTemplate> = {
  "ml-engineer": {
    goalKey: "ml-engineer",
    title: "ML Engineer",
    dimensions: [
      {
        id: "programming",
        label: "Programming evidence",
        description: "Core coding languages such as Python, C++, or data engineering tools.",
        keywords: ["python", "c++", "java", "sql", "coding", "software", "programming", "algorithms"],
      },
      {
        id: "machine_learning",
        label: "Machine learning evidence",
        description: "ML frameworks, model training, evaluation metrics, or deep learning libraries.",
        keywords: ["machine learning", "ml", "deep learning", "pytorch", "tensorflow", "scikit-learn", "keras", "nlp", "computer vision", "transformers"],
      },
      {
        id: "project_build",
        label: "Project / build evidence",
        description: "Hands-on implementation of end-to-end models with real datasets.",
        keywords: ["project", "built", "repo", "github", "pipeline", "kaggle", "prototype", "dataset"],
      },
      {
        id: "deployment",
        label: "Deployment evidence",
        description: "Serving models, Docker, cloud deployment, APIs, or production pipelines.",
        keywords: ["deploy", "docker", "kubernetes", "fastapi", "flask", "aws", "gcp", "azure", "serving", "production", "ci/cd"],
      },
      {
        id: "interview",
        label: "Interview & communication evidence",
        description: "Problem breakdown, technical articulation, and system discussion.",
        keywords: ["interview", "presentation", "communication", "leadership", "mentoring"],
      },
    ],
  },
  "ai-researcher": {
    goalKey: "ai-researcher",
    title: "AI Researcher",
    dimensions: [
      {
        id: "foundations",
        label: "Foundational mathematics & theory",
        description: "Linear algebra, probability, calculus, and theoretical ML fundamentals.",
        keywords: ["math", "mathematics", "linear algebra", "calculus", "probability", "statistics", "theory"],
      },
      {
        id: "literature",
        label: "Literature survey & paper reading",
        description: "Synthesizing recent papers, tracking arXiv, and analyzing methodology.",
        keywords: ["paper", "reading", "survey", "arxiv", "literature", "review", "reading group"],
      },
      {
        id: "experimentation",
        label: "Rigorous experimentation",
        description: "Controlled experiments, baseline comparisons, and ablation studies.",
        keywords: ["experiment", "ablation", "benchmark", "evaluation", "metrics", "reproducibility"],
      },
      {
        id: "writing",
        label: "Scientific writing & briefs",
        description: "Documenting hypotheses, technical reports, or conference submissions.",
        keywords: ["writing", "publication", "paper", "manuscript", "report", "arxiv"],
      },
      {
        id: "critique",
        label: "Peer discussion & critique",
        description: "Academic discussion, seminar participation, and peer review.",
        keywords: ["critique", "seminar", "presentation", "conference", "discussion"],
      },
    ],
  },
  "ai-founder": {
    goalKey: "ai-founder",
    title: "AI Founder",
    dimensions: [
      {
        id: "problem_discovery",
        label: "Problem discovery evidence",
        description: "Validating user pain points, customer interviews, and market need.",
        keywords: ["user", "customer", "problem", "interview", "validation", "market", "discovery"],
      },
      {
        id: "prototype_build",
        label: "Prototype / MVP build evidence",
        description: "Rapidly building working software that users can try.",
        keywords: ["mvp", "prototype", "product", "demo", "app", "built", "fullstack", "software"],
      },
      {
        id: "distribution",
        label: "Distribution & user feedback evidence",
        description: "Getting early users, collecting feedback, and iterating on retention.",
        keywords: ["growth", "users", "launch", "feedback", "analytics", "distribution", "retention"],
      },
      {
        id: "execution",
        label: "Execution & milestone delivery",
        description: "Consistent shipping pace and product roadmap execution.",
        keywords: ["roadmap", "shipping", "milestone", "delivery", "sprint"],
      },
      {
        id: "pitch",
        label: "Value proposition & pitch",
        description: "Explaining the vision and value proposition with clarity.",
        keywords: ["pitch", "deck", "investor", "demo", "storytelling", "narrative"],
      },
    ],
  },
};

export const GENERIC_GOAL_TEMPLATE: GoalRequirementTemplate = {
  goalKey: "custom",
  title: "Custom Goal",
  dimensions: [
    {
      id: "learn",
      label: "Learn: Core understanding",
      description: "Key concepts and foundational knowledge for this direction.",
      keywords: ["course", "degree", "learning", "study", "books", "fundamentals", "education"],
    },
    {
      id: "build",
      label: "Build: Hands-on application",
      description: "Creating concrete projects, prototypes, or artifacts.",
      keywords: ["project", "built", "created", "developed", "portfolio", "application", "github"],
    },
    {
      id: "verify",
      label: "Verify: Independent validation",
      description: "Testing, external review, or verifiable demonstrations.",
      keywords: ["verified", "assessment", "certification", "grade", "test", "audit"],
    },
    {
      id: "connect",
      label: "Connect: Community & peers",
      description: "Discussions with practitioners, mentors, or peer collaborators.",
      keywords: ["community", "meetup", "peer", "mentor", "collaboration", "network", "club"],
    },
    {
      id: "apply",
      label: "Apply / Act: Real-world delivery",
      description: "Using skills in internships, open source, or live user workflows.",
      keywords: ["experience", "work", "job", "internship", "client", "production", "delivered"],
    },
  ],
};

export function getGoalTemplate(goalTitle: string): { template: GoalRequirementTemplate; isCustom: boolean } {
  const norm = goalTitle.trim().toLowerCase();
  if (/machine learning|\bml\b|\bai engineer|data scien/.test(norm)) {
    return { template: GOAL_REQUIREMENT_TEMPLATES["ml-engineer"], isCustom: false };
  }
  if (/research|scientist|phd|academic/.test(norm)) {
    return { template: GOAL_REQUIREMENT_TEMPLATES["ai-researcher"], isCustom: false };
  }
  if (/founder|startup|business|entrepreneur/.test(norm)) {
    return { template: GOAL_REQUIREMENT_TEMPLATES["ai-founder"], isCustom: false };
  }
  return { template: GENERIC_GOAL_TEMPLATE, isCustom: true };
}

export function evaluateGaps(goalTitle: string, evidence: EvidenceItem[]): GapEvaluation {
  const { template, isCustom } = getGoalTemplate(goalTitle);

  let unknownCount = 0;
  let partiallyEvidencedCount = 0;
  let demonstratedCount = 0;
  const unknownDimensionLabels: string[] = [];

  const dimensions: GoalDimensionState[] = template.dimensions.map((dim) => {
    // Find matching evidence items
    const matches = evidence.filter((ev) => {
      const combined = `${ev.subject} ${ev.value} ${ev.whyItMatters || ""}`.toLowerCase();
      const kwMatch = dim.keywords.some((kw) => combined.includes(kw));
      if (kwMatch) return true;
      if (ev.category === "interview" && dim.id === "interview") return true;
      if (ev.category === "assessment") {
        if (dim.id === "programming" && (combined.includes("programming") || combined.includes("python") || combined.includes("coding"))) return true;
        if ((dim.id === "machine_learning" || dim.id === "ml_frameworks") && (combined.includes("machine learning") || combined.includes("ml") || combined.includes("deep learning"))) return true;
      }
      return false;
    });

    if (matches.length === 0) {
      unknownCount++;
      unknownDimensionLabels.push(dim.label);
      return {
        dimensionId: dim.id,
        label: dim.label,
        description: dim.description,
        state: "unknown",
        matchingEvidence: [],
        explanation: `No verified ${dim.label.toLowerCase()} yet.`,
      };
    }

    // Check if any matching evidence is independently verified
    const hasVerified = matches.some((m) => m.verificationStatus === "verified");

    if (hasVerified) {
      demonstratedCount++;
      return {
        dimensionId: dim.id,
        label: dim.label,
        description: dim.description,
        state: "demonstrated",
        matchingEvidence: matches,
        explanation: `Verified evidence exists from ${matches.length} recorded item(s).`,
      };
    }

    partiallyEvidencedCount++;
    return {
      dimensionId: dim.id,
      label: dim.label,
      description: dim.description,
      state: "partially_evidenced",
      matchingEvidence: matches,
      explanation: `Mentioned in ${matches.length} self-reported or resume item(s). Not independently verified.`,
    };
  });

  return {
    goalTitle,
    isCustomGoal: isCustom,
    dimensions,
    unknownCount,
    partiallyEvidencedCount,
    demonstratedCount,
    unknownDimensionLabels,
  };
}
