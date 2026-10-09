/**
 * AI TATHASTU — EXTRACTION ACCURACY BENCHMARK & EVALUATION SUITE
 *
 * Evaluates semantic extraction rules against a labeled ground-truth dataset
 * of diverse candidate statements (valid skills, negations, aspirations,
 * coursework, duplicate projects, and missing evidence).
 *
 * Produces quantitative precision, recall, and false-positive rejection rates.
 */

import { ExtractionValidator } from "./extraction-validator";

export interface BenchmarkTestCase {
  id: string;
  category: "skill" | "project" | "education";
  claimValue: string;
  sourceSpan: string;
  fullDocText: string;
  expectedValid: boolean;
  expectedFlag?: string;
  notes: string;
}

export const LABELED_BENCHMARK_DATASET: BenchmarkTestCase[] = [
  // 1. Positive valid skills
  {
    id: "pos_1",
    category: "skill",
    claimValue: "PyTorch",
    sourceSpan: "Developed CNN and ResNet models using PyTorch for image classification",
    fullDocText: "Experience: Developed CNN and ResNet models using PyTorch for image classification. Graduated 2024.",
    expectedValid: true,
    notes: "Direct demonstrated practical skill in computer vision",
  },
  {
    id: "pos_2",
    category: "skill",
    claimValue: "FastAPI",
    sourceSpan: "Built high-throughput REST inference endpoints using FastAPI and Docker",
    fullDocText: "Projects: Built high-throughput REST inference endpoints using FastAPI and Docker.",
    expectedValid: true,
    notes: "Demonstrated backend MLOps skill",
  },
  {
    id: "pos_3",
    category: "skill",
    claimValue: "scikit-learn",
    sourceSpan: "Implemented random forest and logistic regression with scikit-learn",
    fullDocText: "Machine Learning: Implemented random forest and logistic regression with scikit-learn.",
    expectedValid: true,
    notes: "Classical ML library with canonical normalization",
  },

  // 2. Negations (must be REJECTED)
  {
    id: "neg_1",
    category: "skill",
    claimValue: "PyTorch",
    sourceSpan: "Experienced with TensorFlow, but have not used PyTorch in production",
    fullDocText: "Skills: Experienced with TensorFlow, but have not used PyTorch in production.",
    expectedValid: false,
    expectedFlag: "negation",
    notes: "Explicit negation must never be credited as a skill",
  },
  {
    id: "neg_2",
    category: "skill",
    claimValue: "C++",
    sourceSpan: "Python developer with no experience with C++ or low-level systems",
    fullDocText: "Background: Python developer with no experience with C++ or low-level systems.",
    expectedValid: false,
    expectedFlag: "negation",
    notes: "Lack of experience disclaimer",
  },
  {
    id: "neg_3",
    category: "skill",
    claimValue: "Kubernetes",
    sourceSpan: "Managed Docker deployments without using Kubernetes",
    fullDocText: "DevOps: Managed Docker deployments without using Kubernetes.",
    expectedValid: false,
    expectedFlag: "negation",
    notes: "Exclusion statement",
  },

  // 3. Aspirations / Future ambitions (must be REJECTED)
  {
    id: "asp_1",
    category: "skill",
    claimValue: "LangChain",
    sourceSpan: "Currently planning to learn LangChain and autonomous agents in upcoming semester",
    fullDocText: "Future Goals: Currently planning to learn LangChain and autonomous agents in upcoming semester.",
    expectedValid: false,
    expectedFlag: "aspiration",
    notes: "Future goal statement should not become profile skill",
  },
  {
    id: "asp_2",
    category: "skill",
    claimValue: "TensorFlow",
    sourceSpan: "Eager to explore TensorFlow in the future",
    fullDocText: "Passionate about ML, eager to explore TensorFlow in the future.",
    expectedValid: false,
    expectedFlag: "aspiration",
    notes: "Aspirational curiosity",
  },

  // 4. Unsupported or Hallucinated (Span does not mention skill or missing from doc)
  {
    id: "halluc_1",
    category: "skill",
    claimValue: "Quantum Computing",
    sourceSpan: "Completed B.Tech in Computer Science with focus on software engineering",
    fullDocText: "Education: Completed B.Tech in Computer Science with focus on software engineering.",
    expectedValid: false,
    expectedFlag: "unsupported",
    notes: "Hallucinated skill completely absent from cited span",
  },
  {
    id: "halluc_2",
    category: "skill",
    claimValue: "Rust",
    sourceSpan: "Built microservices using Rust",
    fullDocText: "Education: B.Tech in Computer Science at ABC College. No mention of Rust anywhere.",
    expectedValid: false,
    expectedFlag: "missing_evidence",
    notes: "Span invented or fabricated, not in source document",
  },

  // 5. Project claims
  {
    id: "proj_1",
    category: "project",
    claimValue: "Autonomous Drone Navigation",
    sourceSpan: "Autonomous Drone Navigation: Real-time obstacle avoidance with YOLOv8",
    fullDocText: "Projects: Autonomous Drone Navigation: Real-time obstacle avoidance with YOLOv8 on Jetson Nano.",
    expectedValid: true,
    notes: "Grounded project with verified text span",
  },
  {
    id: "proj_2",
    category: "project",
    claimValue: "Fake Blockchain Trading Bot",
    sourceSpan: "Built Next.js e-commerce app with Stripe integration",
    fullDocText: "Projects: Built Next.js e-commerce app with Stripe integration.",
    expectedValid: false,
    expectedFlag: "unsupported",
    notes: "Project title fabricated / mismatch with cited span",
  },
];

export interface BenchmarkMetrics {
  totalCases: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  negationRejectionRate: number;
  aspirationRejectionRate: number;
  hallucinationRejectionRate: number;
}

export function runExtractionBenchmark(): {
  metrics: BenchmarkMetrics;
  results: Array<{ testId: string; passed: boolean; reason?: string }>;
} {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  let totalNegations = 0;
  let rejectedNegations = 0;
  let totalAspirations = 0;
  let rejectedAspirations = 0;
  let totalHallucinations = 0;
  let rejectedHallucinations = 0;

  const results: Array<{ testId: string; passed: boolean; reason?: string }> = [];

  for (const tc of LABELED_BENCHMARK_DATASET) {
    let outcomeValid = false;
    let flag: string | undefined;

    if (tc.category === "skill") {
      const res = ExtractionValidator.validateSkillClaim(tc.claimValue, tc.sourceSpan, tc.fullDocText);
      outcomeValid = res.valid;
      flag = res.flag;
    } else if (tc.category === "project") {
      const res = ExtractionValidator.validateProjectClaim(tc.claimValue, tc.sourceSpan, tc.fullDocText);
      outcomeValid = res.valid;
      flag = res.flag;
    }

    if (tc.expectedFlag === "negation") {
      totalNegations++;
      if (!outcomeValid && flag === "negation") rejectedNegations++;
    } else if (tc.expectedFlag === "aspiration") {
      totalAspirations++;
      if (!outcomeValid && flag === "aspiration") rejectedAspirations++;
    } else if (tc.expectedFlag === "unsupported" || tc.expectedFlag === "missing_evidence") {
      totalHallucinations++;
      if (!outcomeValid) rejectedHallucinations++;
    }

    const testPassed = outcomeValid === tc.expectedValid;
    results.push({
      testId: tc.id,
      passed: testPassed,
      reason: testPassed ? undefined : `Expected valid=${tc.expectedValid}, got valid=${outcomeValid} (flag=${flag})`,
    });

    if (tc.expectedValid && outcomeValid) tp++;
    else if (!tc.expectedValid && outcomeValid) fp++;
    else if (!tc.expectedValid && !outcomeValid) tn++;
    else if (tc.expectedValid && !outcomeValid) fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 1;

  return {
    metrics: {
      totalCases: LABELED_BENCHMARK_DATASET.length,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1Score: Number(f1Score.toFixed(4)),
      negationRejectionRate: totalNegations > 0 ? Number((rejectedNegations / totalNegations).toFixed(4)) : 1,
      aspirationRejectionRate: totalAspirations > 0 ? Number((rejectedAspirations / totalAspirations).toFixed(4)) : 1,
      hallucinationRejectionRate: totalHallucinations > 0 ? Number((rejectedHallucinations / totalHallucinations).toFixed(4)) : 1,
    },
    results,
  };
}
