/**
 * AI TATHASTU — DASHBOARD SERVICE
 * 
 * Canonical server-side orchestration for the personalized 5-section student dashboard.
 * Unifies Person 360, verified evidence, user preferences, and the 96-configuration
 * domain personalization engine.
 */

import { getPerson360 } from "./person-360-service";
import {
  composePersonalizedDashboard,
  normalizeInterest,
  type CanonicalInterest,
  type ComposedDashboardViewModel,
  type StudentPersonalizationContext,
  type ProjectRecord,
} from "../domain/personalization-engine";
import { AIML_ROLE_CATALOG } from "../domain/aiml-role-taxonomy";
import type { EvidenceItem, EvidenceCategory, VerificationStatus, EvidenceSource } from "../domain/evidence";
import { calculateReadiness } from "../domain/readiness";

export interface DashboardCompositionOptions {
  primary?: string | null;
  secondary?: string[];
  role?: string;
  roleId?: string;
  goal?: string;
  timeline?: string;
  name?: string;
}

function resolveRoleId(roleTitleOrId?: string): string {
  if (!roleTitleOrId) return "exploring_aiml";
  const cleaned = roleTitleOrId.toLowerCase().trim();
  const matchedById = AIML_ROLE_CATALOG.find((r) => r.id === cleaned);
  if (matchedById) return matchedById.id;
  const matchedByTitle = AIML_ROLE_CATALOG.find((r) => r.title.toLowerCase() === cleaned);
  if (matchedByTitle) return matchedByTitle.id;
  if (cleaned.includes("genai") || cleaned.includes("generative")) return "genai_engineer";
  if (cleaned.includes("ml") || cleaned.includes("machine learning")) return "ml_engineer";
  if (cleaned.includes("research")) return "ai_researcher";
  if (cleaned.includes("vision")) return "computer_vision_engineer";
  if (cleaned.includes("nlp")) return "nlp_engineer";
  return "exploring_aiml";
}

/**
 * Produces the canonical composed dashboard view model for an authenticated student.
 */
export async function getStudentDashboardComposition(
  personId: string,
  options?: DashboardCompositionOptions
): Promise<ComposedDashboardViewModel> {
  const person360 = await getPerson360(personId, personId);

  const rawMetadata = (person360.preferences?.metadata as Record<string, unknown>) || {};
  const targetRole =
    options?.role ||
    (rawMetadata.targetRole as string) ||
    person360.profile?.specialization ||
    "Still Exploring AI & ML";

  const targetRoleId =
    options?.roleId ||
    (rawMetadata.targetRoleId as string) ||
    resolveRoleId(targetRole);

  const goal =
    options?.goal ||
    person360.activeGoal?.title ||
    (rawMetadata.customGoalText as string) ||
    "Choose your AI/ML goal";

  const targetTimeline =
    options?.timeline ||
    (rawMetadata.targetTimeline as string) ||
    "";

  // Priority resolution: explicit query option > saved preference > default "learning"
  const rawPrimary =
    options?.primary !== undefined
      ? options.primary
      : person360.preferences?.primaryPriority;
  const primaryInterest: CanonicalInterest = normalizeInterest(rawPrimary);

  let secondaryInterests: CanonicalInterest[] = [];
  if (options?.secondary !== undefined) {
    secondaryInterests = options.secondary
      .map((s) => normalizeInterest(s))
      .filter((s) => s !== primaryInterest);
  } else if (person360.preferences?.secondaryPriorities) {
    secondaryInterests = person360.preferences.secondaryPriorities
      .map((s) => normalizeInterest(s))
      .filter((s) => s !== primaryInterest);
  }
  // Deduplicate and cap to 2
  secondaryInterests = Array.from(new Set(secondaryInterests)).slice(0, 2);

  // Extract skills from evidence ledger
  const skills: Array<{ name: string; category?: string; verificationStatus: string; source?: string }> =
    (person360.evidence || [])
      .filter((e) => e.category === "skill")
      .map((e) => ({
        name: e.subject || e.value,
        category: e.category,
        verificationStatus: e.verificationStatus,
        source: e.source,
      }));

  // Map projects
  const projects: ProjectRecord[] = (person360.projects || []).map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    technologies: p.technologies || [],
    sources: p.sources || ["manual"],
    status: p.status,
  }));

  // Map full evidence items
  const evidenceItems: EvidenceItem[] = (person360.evidence || []).map((e) => ({
    id: e.id,
    category: (e.category as EvidenceCategory) || "skill",
    subject: e.subject,
    value: e.value,
    verificationStatus: (e.verificationStatus as VerificationStatus) || "unverified",
    source: (["self_reported", "resume_extracted", "institutional", "imported", "verified", "ai_inferred"].includes(e.source)
      ? e.source
      : "imported") as EvidenceSource,
    sourceReference: e.sourceReference,
    observedAt: e.observedAt,
    createdAt: e.observedAt,
    interpretation: e.interpretation || e.subject,
    whyItMatters: e.whyItMatters || "Recorded in student evidence ledger.",
  }));

  // Defensible, mathematically grounded readiness calculation using active versioned readiness policy
  const readinessResult = calculateReadiness(
    { id: person360.activeGoal?.id, title: goal },
    evidenceItems
  );

  const verifiedReadinessScore =
    readinessResult.publishable && readinessResult.score !== undefined
      ? readinessResult.score
      : null;
  const isReadinessAvailable = readinessResult.publishable && readinessResult.score !== undefined;

  const context: StudentPersonalizationContext = {
    personId,
    name: options?.name || person360.person.displayName || "Student",
    targetRole,
    targetRoleId,
    goal,
    targetTimeline,
    primaryInterest,
    secondaryInterests,
    degree: person360.profile?.degree || "",
    institution: person360.profile?.institution || "",
    cohort: person360.profile?.expectedGraduationYear || undefined,
    skills,
    projects,
    evidenceItems,
    journeyEvents: (person360.journeySummary || []).map((event) => ({ title: event.title, description: event.description, timestamp: event.timestamp })),
    verifiedReadinessScore,
    isReadinessAvailable,
    isDemo: false,
  };

  return composePersonalizedDashboard(context);
}

/**
 * Deterministic demo/preview dashboard composition for unauthenticated or gallery mode.
 * Supports testing all 6 primary modes and 96 combinations instantly.
 */
export function getDemoDashboardComposition(
  options?: DashboardCompositionOptions
): ComposedDashboardViewModel {
  const targetRole = options?.role || "Generative AI Engineer";
  const targetRoleId = options?.roleId || resolveRoleId(targetRole);
  const goal = options?.goal || "Get an AI/ML internship";
  const targetTimeline = options?.timeline || "Within 6 months";

  const primaryInterest: CanonicalInterest = normalizeInterest(options?.primary || "learning");
  let secondaryInterests: CanonicalInterest[] = [];
  if (options?.secondary !== undefined) {
    secondaryInterests = options.secondary
      .map((s) => normalizeInterest(s))
      .filter((s) => s !== primaryInterest);
  } else if (options?.primary !== undefined) {
    // When primary is explicitly specified without secondary, default to single-interest mode
    secondaryInterests = [];
  } else {
    // Default demo baseline when no parameters given
    secondaryInterests = ["projects"].filter((s) => s !== primaryInterest) as CanonicalInterest[];
  }
  secondaryInterests = Array.from(new Set(secondaryInterests)).slice(0, 2);

  const demoProjects: ProjectRecord[] = [
    {
      id: "demo-p1",
      title: "RAG Code Knowledge Graph",
      description: "Local hybrid retrieval with LangChain, ChromaDB, and AST parsing for Python repositories.",
      technologies: ["Python", "LangChain", "ChromaDB", "FastAPI"],
      sources: ["github"],
      status: "Verified",
    },
    {
      id: "demo-p2",
      title: "Agentic Evaluation Benchmark",
      description: "Automated test harness comparing Claude, GPT-4, and Gemini 1.5 Flash across tool-calling accuracy.",
      technologies: ["PyTorch", "Transformers", "Docker"],
      sources: ["github", "manual"],
      status: "Confirmed",
    },
  ];

  const demoSkills = [
    { name: "Python", category: "skill", verificationStatus: "verified", source: "padho_code" },
    { name: "Transformers", category: "skill", verificationStatus: "verified", source: "assessment" },
    { name: "Vector Databases", category: "skill", verificationStatus: "self_reported", source: "github" },
    { name: "Prompt Engineering", category: "skill", verificationStatus: "self_reported", source: "manual" },
    { name: "FastAPI", category: "skill", verificationStatus: "verified", source: "github" },
  ];

  const demoEvidence: EvidenceItem[] = [
    {
      id: "demo-e1",
      category: "skill",
      subject: "Python & DSA Mastery",
      value: "Advanced",
      verificationStatus: "verified",
      source: "imported",
      sourceReference: "PC-98214",
      observedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      interpretation: "Advanced algorithmic problem-solving in Python.",
      whyItMatters: "Verified by automated coding evaluation harness.",
    },
    {
      id: "demo-e2",
      category: "skill",
      subject: "Transformer Fine-Tuning",
      value: "Proficient",
      verificationStatus: "verified",
      source: "institutional",
      sourceReference: "ERIS-CERT-88",
      observedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      interpretation: "Proficient in transformer architectures and fine-tuning.",
      whyItMatters: "Verified by ERIS institutional assessment.",
    },
  ];

  const context: StudentPersonalizationContext = {
    personId: "demo-user",
    name: options?.name || "Rahul Sharma",
    targetRole,
    targetRoleId,
    goal,
    targetTimeline,
    primaryInterest,
    secondaryInterests,
    degree: "B.Tech Computer Science and Engineering",
    institution: "Lovely Professional University (LPU)",
    cohort: 2026,
    skills: demoSkills,
    projects: demoProjects,
    evidenceItems: demoEvidence,
    verifiedReadinessScore: 78,
    isReadinessAvailable: true,
    isDemo: true,
  };

  const model = composePersonalizedDashboard(context);
  model.sourceFreshness.isDemo = true;
  return model;
}
