import { scoreSkillConfidence, type SkillConfidence } from "@/lib/domain/skill-confidence";
/**
 * AI TATHASTU — EXPLAINABLE SKILLS & PROFICIENCY INTELLIGENCE SERVICE V4.7
 *
 * Implements:
 * 1. Skill Evidence Aggregation & Deduplication across all permitted sources (CV, GitHub,
 *    Portfolio, Hugging Face, Coding platforms, Assessments, Project contributions, Certifications)
 * 2. 5-Dimension Explainable Proficiency Framework (Never fictional numeric scores)
 * 3. Conservative 6-Stage Progression (Not assessed -> Exposure recorded -> Applied evidence available -> Demonstrated -> Assessed -> Verified)
 * 4. Contextual Personal Contribution Auditing with explicit non-third-party disclosure
 * 5. Deterministic Answers to 7 Core Questions per skill
 * 6. Canonical Skill Evidence Graph (Skill -> Project -> Repository -> File -> Contribution -> Assessment)
 * 7. Goal & Role Personalization without punitive absence assumptions
 * 8. Dashboard & PersonGraph Metric Harmonization (tracked, evidenced, demonstrated, assessed, verified)
 */

import crypto from "crypto";
import { getPerson360 } from "./person-360-service";
import { getProjectsByPersonId, getProjectContributionsByPersonId, saveProjectContribution } from "../repositories/project-repository";
import { getExternalConnections } from "../repositories/connection-repository";
import {
  getStudentAssessments,
  getCodingActivitiesByPersonId,
  getLearningActivitiesByPersonId,
} from "../repositories/integration-repository";
import { createEvidenceRecord } from "../repositories/evidence-repository";
import { AIML_ROLE_CATALOG, type AimlRoleDefinition } from "../domain/aiml-role-taxonomy";
import { AI_ML_TECH_REGISTRY } from "../connectors/github/mapper";
import { getDb, evidenceItems, projects } from "../db";
import { eq, and } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type SkillProficiencyLevel =
  | "Not assessed"
  | "Claimed"
  | "Exposure recorded"
  | "Applied evidence available"
  | "Demonstrated"
  | "Assessed"
  | "Verified";

export type GoalRelevance =
  | "required_core"
  | "recommended"
  | "complementary"
  | "elective";

export type SkillCategory =
  | "AI & ML"
  | "GenAI"
  | "Data"
  | "Backend"
  | "Tools"
  | "Cloud"
  | "Languages"
  | "Other";

export interface SkillObservation {
  id: string;
  source:
    | "resume"
    | "github"
    | "portfolio"
    | "huggingface"
    | "leetcode"
    | "hackerrank"
    | "stackoverflow"
    | "devto"
    | "kaggle"
    | "linkedin"
    | "scholar"
    | "assessment"
    | "project"
    | "certification"
    | "self_reported"
    | "faculty_verified";
  sourceType:
    | "manifest_declared"
    | "source_code"
    | "readme_documented"
    | "resume_mention"
    | "project_applied"
    | "personal_contribution"
    | "platform_badge"
    | "graded_assessment"
    | "faculty_verification"
    | "self_claim";
  sourceReference: string | null;
  observedAt: string;
  summary: string;
  provenanceFile?: string;
  repositoryUrl?: string;
}

export interface PersonalContributionInfo {
  confirmed: boolean;
  projectTitle?: string;
  projectId?: string;
  featureImplemented?: string;
  componentDescription?: string;
  fileReference?: string;
  confirmedAt?: string;
  isThirdPartyVerified: false; // Architectural guarantee
}

export interface SkillEvidenceGraphNode {
  id: string;
  type: "skill" | "project" | "repository" | "file" | "contribution" | "assessment" | "verification";
  label: string;
  metadata?: Record<string, unknown>;
}

export interface SkillEvidenceGraphEdge {
  id: string;
  from: string;
  to: string;
  relationship: "demonstrated_in" | "stored_in" | "observed_in" | "contributed_by" | "evaluated_by" | "verified_by";
  label: string;
}

export interface SkillEvidenceGraph {
  nodes: SkillEvidenceGraphNode[];
  edges: SkillEvidenceGraphEdge[];
}

export interface SevenQuestionsAnalysis {
  whatIsThisSkill: {
    name: string;
    category: SkillCategory;
    definition: string;
  };
  whereWasItObserved: {
    sources: string[];
    observations: Array<{
      /** evidence_items.id (or project id) this answer rests on. */
      evidenceId: string;
      source: string;
      sourceReference: string | null;
      details: string;
    }>;
  };
  /** Task 1.3.2 answers 3-6 (additive; the original fields stay for existing consumers). */
  whatIsTheVerificationStatus: {
    status: "Pending" | "Corroborated" | "Verified";
    confidenceScore: number | null;
    tierLabel: string | null;
    evidenceIds: string[];
  };
  howDoesItRelateToGoal: {
    relevance: GoalRelevance;
    targetRole: string | null;
    explanation: string;
  };
  whatAreDemonstratedProjects: {
    projectIds: string[];
    titles: string[];
  };
  whatAreDemonstratedCodeArtifacts: {
    files: string[];
  };
  howWasItUsed: {
    usageSummary: string;
    projects: string[];
    manifestsOrFiles: string[];
  };
  whatDidStudentPersonallyContribute: {
    hasContribution: boolean;
    statement: string;
    roles: string[];
    fileReference?: string;
  };
  howMuchKnowledgeDemonstrated: {
    level: SkillProficiencyLevel;
    explanation: string;
    isVerified: boolean;
  };
  whatEvidenceIsMissing: {
    missingPoints: string[];
  };
  whatShouldStudentLearnOrProveNext: {
    action: string;
    suggestedTask: string;
    assessmentAvailable: boolean;
    /** Where to act on it: the skill's place in the roadmap. */
    href: string;
  };
}

export interface ExplainableSkillIntelligence {
  name: string;
  canonicalName: string;
  category: SkillCategory;
  level: SkillProficiencyLevel;
  goalRelevance: GoalRelevance;
  isGoalPrerequisite: boolean;

  dimensions: {
    selfAssessedKnowledge: "None" | "Beginner" | "Intermediate" | "Advanced";
    observedTechnicalEvidence: {
      count: number;
      files: string[];
      repositories: string[];
      platforms: string[];
    };
    demonstratedApplication: {
      projectCount: number;
      projects: Array<{
        id: string;
        title: string;
        repositoryUrl?: string | null;
        roles: string[];
        description?: string;
      }>;
    };
    assessedCompetency: {
      assessed: boolean;
      score?: number;
      testTitle?: string;
      assessedAt?: string;
    };
    independentVerification: {
      verified: boolean;
      verifiedBy?: string;
      verifiedAt?: string;
      method?: string;
    };
  };

  conciseExplanation: string;
  /** Deterministic evidence-based score with a traceable breakdown (Task 1.3.1). */
  confidence: SkillConfidence | null;
  sevenQuestions: SevenQuestionsAnalysis;
  graph: SkillEvidenceGraph;
  observations: SkillObservation[];
  personalContribution?: PersonalContributionInfo;
  lastObservedAt: string;
}

export interface SkillsIntelligenceSummary {
  skills: ExplainableSkillIntelligence[];
  targetRole: string;
  targetRoleId: string;
  stats: {
    trackedSkills: number;
    evidencedSkills: number;
    demonstratedSkills: number;
    assessedSkills: number;
    verifiedSkills: number;
    goalPrerequisitesMet: number;
    goalPrerequisitesTotal: number;
    totalEvidencePoints: number;
  };
  missingGoalSkills: Array<{
    name: string;
    category: SkillCategory;
    relevance: GoalRelevance;
    suggestedTask: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill Dictionary & Canonical Normalization
// ─────────────────────────────────────────────────────────────────────────────

const CANONICAL_SKILL_MAP: Record<string, string> = {
  python: "Python",
  pytorch: "PyTorch",
  "scikit-learn": "Scikit-Learn",
  sklearn: "Scikit-Learn",
  tensorflow: "TensorFlow",
  langchain: "LangChain",
  llamaindex: "LlamaIndex",
  transformers: "Transformers",
  huggingface: "Hugging Face",
  fastapi: "FastAPI",
  flask: "Flask",
  django: "Django",
  docker: "Docker",
  kubernetes: "Kubernetes",
  pandas: "Pandas",
  numpy: "NumPy",
  matplotlib: "Matplotlib",
  sql: "SQL",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  mongodb: "MongoDB",
  typescript: "TypeScript",
  javascript: "JavaScript",
  react: "React",
  "react.js": "React",
  nextjs: "Next.js",
  "next.js": "Next.js",
  faiss: "FAISS",
  chroma: "Chroma",
  chromadb: "Chroma",
  pinecone: "Pinecone",
  rag: "RAG",
  llm: "LLMs",
  llms: "LLMs",
  nlp: "NLP",
  opencv: "OpenCV",
  cv2: "OpenCV",
  "computer vision": "Computer Vision",
  git: "Git",
  linux: "Linux",
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
  cuda: "CUDA",
  mlops: "MLOps",
  "vector databases": "Vector Databases",
  "prompt engineering": "Prompt Engineering",
  "linear algebra": "Linear Algebra",
  "deep learning": "Deep Learning",
  "machine learning": "Machine Learning",
};

const SKILL_DEFINITIONS: Record<string, { definition: string; category: SkillCategory }> = {
  Python: {
    definition: "Core high-level programming language universally standard for AI, ML, data science, and backend APIs.",
    category: "Languages",
  },
  PyTorch: {
    definition: "Deep learning framework for dynamic neural network computation, tensor operations, and model training.",
    category: "AI & ML",
  },
  "Scikit-Learn": {
    definition: "Machine learning library providing classical algorithms for regression, classification, clustering, and preprocessing.",
    category: "AI & ML",
  },
  Transformers: {
    definition: "Library and architecture for state-of-the-art pretrained transformer models across NLP, vision, and multimodal AI.",
    category: "GenAI",
  },
  LangChain: {
    definition: "Framework for developing LLM-powered applications, document chains, retrieval-augmented generation (RAG), and agents.",
    category: "GenAI",
  },
  LlamaIndex: {
    definition: "Data framework for connecting custom data sources to large language models for structured context retrieval.",
    category: "GenAI",
  },
  FastAPI: {
    definition: "Modern, high-performance web framework for building RESTful microservices and AI model inference endpoints.",
    category: "Backend",
  },
  Docker: {
    definition: "Containerization platform used to package, isolate, and reproducibly deploy AI models and software applications.",
    category: "Tools",
  },
  "Vector Databases": {
    definition: "Specialized high-dimensional databases for embedding storage, approximate nearest neighbor (ANN) search, and RAG pipelines.",
    category: "Data",
  },
  RAG: {
    definition: "Retrieval-Augmented Generation pattern combining external knowledge retrieval with language model inference.",
    category: "GenAI",
  },
  Pandas: {
    definition: "Data manipulation and analysis library offering DataFrame structures for tabular and time-series data.",
    category: "Data",
  },
  NumPy: {
    definition: "Fundamental package for scientific computing with multi-dimensional arrays, linear algebra, and mathematical routines.",
    category: "Data",
  },
  TensorFlow: {
    definition: "End-to-end open-source machine learning platform developed by Google for distributed model training and deployment.",
    category: "AI & ML",
  },
  SQL: {
    definition: "Standard relational database query language for data extraction, aggregation, transformation, and management.",
    category: "Data",
  },
  TypeScript: {
    definition: "Statically typed superset of JavaScript providing robust type safety for modern web applications and tools.",
    category: "Languages",
  },
  "Prompt Engineering": {
    definition: "Systematic methodology for crafting, evaluating, and optimizing prompts to guide generative AI models.",
    category: "GenAI",
  },
};

export function normalizeSkillName(raw: string): string {
  const cleaned = raw.trim();
  const lower = cleaned.toLowerCase();
  return CANONICAL_SKILL_MAP[lower] || cleaned;
}

export function categorizeSkill(name: string): SkillCategory {
  const norm = normalizeSkillName(name);
  if (SKILL_DEFINITIONS[norm]) return SKILL_DEFINITIONS[norm].category;

  const lower = norm.toLowerCase();
  for (const item of AI_ML_TECH_REGISTRY) {
    if (item.name.toLowerCase() === lower || item.regexes.some((r) => r.test(norm))) {
      if (item.category === "GenAI") return "GenAI";
      if (item.category === "AI & ML") return "AI & ML";
      if (item.category === "Data & Databases") return "Data";
      if (item.category === "Backend & APIs") return "Backend";
      if (item.category === "DevOps & Cloud") return "Cloud";
      if (item.category === "Languages") return "Languages";
      return "Tools";
    }
  }
  if (lower.includes("rag") || lower.includes("llm") || lower.includes("prompt") || lower.includes("agent")) return "GenAI";
  if (lower.includes("ml") || lower.includes("vision") || lower.includes("learning") || lower.includes("neural")) return "AI & ML";
  if (lower.includes("sql") || lower.includes("data") || lower.includes("database")) return "Data";
  if (lower.includes("api") || lower.includes("server") || lower.includes("backend")) return "Backend";
  if (lower.includes("cloud") || lower.includes("aws") || lower.includes("gcp") || lower.includes("docker")) return "Cloud";
  if (lower.includes("git") || lower.includes("tool") || lower.includes("linux")) return "Tools";
  return "Other";
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill Intelligence Orchestration Service
// ─────────────────────────────────────────────────────────────────────────────

export class SkillIntelligenceService {
  /**
   * Builds the complete explainable skills intelligence summary for a student.
   */
  static async getSkillsIntelligence(personId: string): Promise<SkillsIntelligenceSummary> {
    const [
      person360,
      projectsList,
      contributionsList,
      connectionsList,
      assessmentsList,
      codingList,
      learningList,
    ] = await Promise.all([
      getPerson360(personId, personId),
      getProjectsByPersonId(personId),
      getProjectContributionsByPersonId(personId),
      getExternalConnections(personId),
      getStudentAssessments(personId).catch(() => []),
      getCodingActivitiesByPersonId(personId).catch(() => []),
      getLearningActivitiesByPersonId(personId).catch(() => []),
    ]);

    // 1. Resolve Target Role & Prerequisites
    const targetRole =
      (person360.preferences?.metadata as Record<string, unknown>)?.targetRole as string ||
      person360.activeGoal?.title ||
      "Generative AI Engineer";
    const targetRoleId =
      (person360.preferences?.metadata as Record<string, unknown>)?.targetRoleId as string ||
      "genai_engineer";

    const roleDef: AimlRoleDefinition | undefined =
      AIML_ROLE_CATALOG.find((r) => r.id === targetRoleId) ||
      AIML_ROLE_CATALOG.find((r) => r.title.toLowerCase() === targetRole.toLowerCase()) ||
      AIML_ROLE_CATALOG[0];

    const corePrerequisites = new Set((roleDef?.corePrerequisites || []).map(normalizeSkillName));
    const recommendedTechs = new Set((roleDef?.recommendedTechnologies || []).map(normalizeSkillName));

    // 2. Map Project Contributions
    const contributionMap = new Map<string, { roles: string[]; description: string }>();
    for (const c of contributionsList) {
      contributionMap.set(c.projectId, {
        roles: (c.roles as string[]) || [],
        description: c.description || "",
      });
    }

    // 3. Aggregate All Observations by Canonical Skill
    const skillObservationsMap = new Map<string, SkillObservation[]>();
    const registerObservation = (skillRaw: string, obs: SkillObservation) => {
      const canonical = normalizeSkillName(skillRaw);
      if (!canonical) return;
      const list = skillObservationsMap.get(canonical) || [];
      // Deduplicate identical source reference observations
      const isDuplicate = list.some(
        (existing) =>
          existing.source === obs.source &&
          existing.sourceType === obs.sourceType &&
          existing.sourceReference === obs.sourceReference
      );
      if (!isDuplicate) {
        list.push(obs);
        skillObservationsMap.set(canonical, list);
      }
    };

    // A. Neon DB Evidence Items (Skills, Projects, Resume, Assessments)
    for (const ev of person360.evidence || []) {
      if (ev.category === "skill") {
        let src: SkillObservation["source"] = "self_reported";
        let srcType: SkillObservation["sourceType"] = "self_claim";

        if (ev.source === "resume_extracted") {
          src = "resume";
          srcType = "resume_mention";
        } else if (ev.source === "imported") {
          // By platform (evidence_items.origin_source, Task 1.2.2). Previously every
          // import was labelled GitHub, so a HackerRank badge counted as a manifest.
          const origin = (ev as { originSource?: string | null }).originSource ?? "github";
          if (origin === "hackerrank" || origin === "leetcode") { src = origin; srcType = "platform_badge"; }
          else if (origin === "kaggle") { src = "kaggle"; srcType = "project_applied"; }
          else if (origin === "linkedin") { src = "linkedin"; srcType = "self_claim"; } // LinkedIn skills are self-declared
          else if (origin === "scholar") { src = "scholar"; srcType = "project_applied"; }
          else { src = "github"; srcType = "manifest_declared"; }
        } else if (ev.verificationStatus === "verified") {
          src = "faculty_verified";
          srcType = "faculty_verification";
        } else if (
          (ev as { importKey?: string }).importKey?.startsWith("contrib_") ||
          ev.value?.includes("Confirmed personal contribution")
        ) {
          src = "project";
          srcType = "personal_contribution";
        }

        registerObservation(ev.subject, {
          id: ev.id,
          source: src,
          sourceType: srcType,
          sourceReference: ev.sourceReference || (src === "resume" ? "Resume (Skills Section)" : "External Profile"),
          observedAt: ev.observedAt,
          summary: ev.interpretation || `Evidence recorded for ${ev.subject}`,
        });
      } else if (ev.category === "assessment" && ["leetcode", "hackerrank"].includes((ev as { originSource?: string | null }).originSource ?? "")) {
        // Platform scores (contest rating, practice score) corroborate; they are not graded assessments.
        const origin = (ev as { originSource?: string | null }).originSource as "leetcode" | "hackerrank";
        registerObservation(ev.subject, {
          id: ev.id,
          source: origin,
          sourceType: "platform_badge",
          sourceReference: ev.sourceReference || null,
          observedAt: ev.observedAt,
          summary: ev.interpretation || ev.value,
        });
      } else if (ev.category === "assessment") {
        registerObservation(ev.subject, {
          id: ev.id,
          source: "assessment",
          sourceType: "graded_assessment",
          sourceReference: ev.sourceReference || "ERIS Assessment Engine",
          observedAt: ev.observedAt,
          summary: ev.value || "Graded technical assessment",
        });
      } else if (ev.category === "certification") {
        registerObservation(ev.subject, {
          id: ev.id,
          source: "certification",
          sourceType: "platform_badge",
          sourceReference: ev.sourceReference || "Verified Credential",
          observedAt: ev.observedAt,
          summary: ev.value || "Earned certification",
        });
      }
    }

    // B. Projects (Technologies declared & personal contributions confirmed)
    for (const proj of projectsList) {
      const contrib = contributionMap.get(proj.id);
      const isConfirmedProj = proj.status === "confirmed";

      for (const tech of (proj.technologies as string[]) || []) {
        const canonical = normalizeSkillName(tech);
        const repoUrl = proj.repositoryUrl || undefined;

        // Observation 1: Declared in project stack
        registerObservation(canonical, {
          id: `obs_proj_${proj.id}_${canonical.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          source: (proj.sources as string[])?.includes("github") ? "github" : "project",
          sourceType: "project_applied",
          sourceReference: repoUrl || `Project: ${proj.title}`,
          observedAt: proj.updatedAt?.toISOString() || new Date().toISOString(),
          summary: `Applied in ${isConfirmedProj ? "confirmed" : "candidate"} project '${proj.title}'`,
          repositoryUrl: repoUrl,
        });

        // Observation 2: If student confirmed a personal contribution on this project
        if (isConfirmedProj && contrib && (contrib.roles.length > 0 || contrib.description)) {
          registerObservation(canonical, {
            id: `obs_contrib_${proj.id}_${canonical.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
            source: "project",
            sourceType: "personal_contribution",
            sourceReference: `Project: ${proj.title}`,
            observedAt: proj.updatedAt?.toISOString() || new Date().toISOString(),
            summary: `Personal contribution confirmed by student: ${contrib.roles.join(", ")}${
              contrib.description ? ` (${contrib.description})` : ""
            }`,
          });
        }
      }
    }

    // C. Graded Topic Assessments from ERIS / Integrations
    for (const a of assessmentsList) {
      const overallScore = a.results?.[0]?.overallResult ? String(a.results[0].overallResult) : undefined;
      for (const topic of a.topics || []) {
        const topicName = topic.topicLabel || topic.topicKey;
        if (!topicName) continue;
        registerObservation(topicName, {
          id: `obs_eval_${a.id}_${topicName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          source: "assessment",
          sourceType: "graded_assessment",
          sourceReference: `Assessment: ${a.assessmentTitle || "Topic Test"}`,
          observedAt: a.completedAt || a.createdAt,
          summary: overallScore
            ? `Evaluated score: ${overallScore}% (${topic.value || "Passing"})`
            : `Evaluated score: ${topic.value || "Mastered"} in ${topicName}`,
        });
      }
    }

    // D. Coding Practice Activities (Padho Code, LeetCode, etc.)
    for (const cp of codingList) {
      if (cp.topic) {
        registerObservation(cp.topic, {
          id: `obs_code_${cp.id}`,
          source: "leetcode",
          sourceType: "platform_badge",
          sourceReference: `Padho Code Topic: ${cp.topic}`,
          observedAt: cp.completedAt || cp.createdAt,
          summary: `Completed coding practice challenge in ${cp.language || "Python"} (Difficulty: ${cp.difficulty || "standard"})`,
        });
      }
    }

    // 4. Construct Explainable Skill Intelligence Records
    const explainableSkills: ExplainableSkillIntelligence[] = [];
    // Skills the student hid (Task 2.2.3) stay in evidence_items but drop out of the map, its counts and readiness.
    const hiddenRaw = (person360.preferences?.metadata as Record<string, unknown> | undefined)?.hiddenSkills;
    const hidden = new Set((Array.isArray(hiddenRaw) ? hiddenRaw : []).filter((h): h is string => typeof h === "string").map((h) => normalizeSkillName(h).toLowerCase()));
    const allKnownSkills = Array.from(skillObservationsMap.keys()).filter((k) => !hidden.has(k.toLowerCase()));

    for (const skillName of allKnownSkills) {
      const observations = skillObservationsMap.get(skillName) || [];
      const category = categorizeSkill(skillName);

      // Determine Goal Relevance
      let goalRelevance: GoalRelevance = "elective";
      const isCore = corePrerequisites.has(skillName);
      const isRec = recommendedTechs.has(skillName);
      if (isCore) goalRelevance = "required_core";
      else if (isRec) goalRelevance = "recommended";
      else if (category === "AI & ML" || category === "GenAI" || category === "Data") goalRelevance = "complementary";

      // Evaluate 5 Dimensions
      const resumeObs = observations.filter((o) => o.source === "resume");
      const githubObs = observations.filter((o) => o.source === "github");
      const projectObs = observations.filter((o) => o.sourceType === "project_applied");
      const contribObs = observations.filter((o) => o.sourceType === "personal_contribution");
      const assessmentObs = observations.filter((o) => o.sourceType === "graded_assessment");
      const verifiedObs = observations.filter((o) => o.sourceType === "faculty_verification");

      // Related Confirmed Projects
      const relatedProjects = projectsList
        .filter((p) => {
          const techs = ((p.technologies as string[]) || []).map(normalizeSkillName);
          return techs.includes(skillName);
        })
        .map((p) => {
          const c = contributionMap.get(p.id);
          return {
            id: p.id,
            title: p.title,
            repositoryUrl: p.repositoryUrl || null,
            roles: c?.roles || [],
            description: c?.description || "",
          };
        });

      // Personal Contribution Details
      let personalContrib: PersonalContributionInfo | undefined = undefined;
      const projWithContrib = relatedProjects.find((p) => p.roles.length > 0 || p.description);
      if (projWithContrib) {
        personalContrib = {
          confirmed: true,
          projectTitle: projWithContrib.title,
          projectId: projWithContrib.id,
          featureImplemented: projWithContrib.roles.join(", "),
          componentDescription: projWithContrib.description,
          isThirdPartyVerified: false,
        };
      }

      // Compute Conservative Proficiency Level
      let level: SkillProficiencyLevel = "Exposure recorded";

      if (verifiedObs.length > 0) {
        level = "Verified";
      } else if (assessmentObs.length > 0) {
        level = "Assessed";
      } else if (contribObs.length > 0 || personalContrib?.confirmed) {
        level = "Demonstrated";
      } else if (relatedProjects.length > 0 || githubObs.length >= 2) {
        level = "Applied evidence available";
      } else if (githubObs.length > 0 || resumeObs.length > 0) {
        level = "Exposure recorded";
      } else if (observations.some((o) => o.sourceType === "self_claim")) {
        level = "Claimed";
      } else {
        level = "Not assessed";
      }

      // Generate Truthful Concise Explanation
      const conciseExplanation = this.generateConciseSentence(skillName, {
        hasResume: resumeObs.length > 0,
        hasGithub: githubObs.length > 0,
        hasProject: relatedProjects.length > 0,
        hasContribution: Boolean(personalContrib?.confirmed),
        hasAssessment: assessmentObs.length > 0,
        isVerified: verifiedObs.length > 0,
        projectTitle: relatedProjects[0]?.title,
      });

      const confidence = scoreSkillConfidence(observations, {
        projects: relatedProjects.map((p) => ({ id: p.id, repositoryUrl: p.repositoryUrl })),
        personalContributionConfirmed: Boolean(personalContrib?.confirmed),
      });

      // Answering the 7 Core Questions
      const sevenQuestions: SevenQuestionsAnalysis = {
        whatIsThisSkill: {
          name: skillName,
          category,
          definition:
            SKILL_DEFINITIONS[skillName]?.definition ||
            `${skillName} is a recognized technology in the ${category} domain used for AI software development.`,
        },
        whereWasItObserved: {
          sources: Array.from(new Set(observations.map((o) => o.source))),
          observations: observations.map((o) => ({
            evidenceId: o.id,
            source: o.source,
            sourceReference: o.sourceReference,
            details: o.summary,
          })),
        },
        howWasItUsed: {
          usageSummary:
            relatedProjects.length > 0
              ? `Integrated across ${relatedProjects.length} projects (${relatedProjects.map((p) => p.title).join(", ")}).`
              : githubObs.length > 0
              ? `Declared as a project dependency or code artifact across connected repositories.`
              : resumeObs.length > 0
              ? `Documented in student's verified curriculum vitae.`
              : `Reported by student during onboarding.`,
          projects: relatedProjects.map((p) => p.title),
          manifestsOrFiles: observations.map((o) => o.sourceReference).filter(Boolean) as string[],
        },
        whatIsTheVerificationStatus: {
          status: confidence?.tier === 1 ? "Verified" : confidence?.tier === 2 ? "Corroborated" : "Pending",
          confidenceScore: confidence?.score ?? null,
          tierLabel: confidence?.label ?? null,
          evidenceIds: confidence ? [...new Set(confidence.breakdown.flatMap((b) => b.evidenceIds))] : [],
        },
        howDoesItRelateToGoal: {
          relevance: goalRelevance,
          targetRole: targetRole || null,
          explanation:
            goalRelevance === "required_core" ? `A core requirement for ${targetRole || "your target role"}.`
            : goalRelevance === "recommended" ? `Recommended for ${targetRole || "your target role"}.`
            : goalRelevance === "complementary" ? `A specialization that strengthens a ${targetRole || "target-role"} profile.`
            : `Not required for ${targetRole || "your target role"}; an elective.`,
        },
        whatAreDemonstratedProjects: {
          projectIds: relatedProjects.map((p) => p.id),
          titles: relatedProjects.map((p) => p.title),
        },
        whatAreDemonstratedCodeArtifacts: {
          // Files inside repositories (manifest / source references), not bare profile links.
          files: [...new Set(observations
            .filter((o) => ["manifest_declared", "source_code", "readme_documented"].includes(o.sourceType))
            .map((o) => o.sourceReference)
            .filter((r): r is string => Boolean(r && /^https?:\/\//.test(r))))],
        },
        whatDidStudentPersonallyContribute: {
          hasContribution: Boolean(personalContrib?.confirmed),
          statement: personalContrib?.confirmed
            ? `Student personally confirmed contribution: ${personalContrib.featureImplemented}${
                personalContrib.componentDescription ? ` — ${personalContrib.componentDescription}` : ""
              } on project '${personalContrib.projectTitle}'. (Note: Self-confirmation does not constitute third-party proof).`
            : "Your personal contribution has not yet been assessed.",
          roles: personalContrib?.featureImplemented ? personalContrib.featureImplemented.split(", ") : [],
          fileReference: personalContrib?.fileReference,
        },
        howMuchKnowledgeDemonstrated: {
          level,
          explanation: this.explainKnowledgeLevel(level, skillName),
          isVerified: level === "Verified",
        },
        whatEvidenceIsMissing: {
          missingPoints: this.identifyMissingEvidence(level, {
            hasContribution: Boolean(personalContrib?.confirmed),
            hasAssessment: assessmentObs.length > 0,
            hasProject: relatedProjects.length > 0,
          }),
        },
        whatShouldStudentLearnOrProveNext: {
          action:
            level === "Verified"
              ? "Architectural optimization & production scaling"
              : level === "Assessed"
              ? "Request faculty or peer verification review"
              : level === "Demonstrated"
              ? "Take a targeted ERIS topic assessment"
              : level === "Applied evidence available"
              ? "Confirm your personal contribution statement on the project"
              : "Build an end-to-end practical project using this technology",
          suggestedTask: `Complete the ${skillName} verification assessment or submit a production-grade code sample.`,
          assessmentAvailable: true,
          href: `/student/roadmap#skill-${skillName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        },
      };

      // Construct Real Evidence Graph
      const graph = this.buildCanonicalEvidenceGraph(skillName, observations, relatedProjects, personalContrib);

      // Latest observation date
      const lastObservedAt = observations.reduce(
        (latest, o) => (new Date(o.observedAt) > new Date(latest) ? o.observedAt : latest),
        observations[0]?.observedAt || new Date().toISOString()
      );

      explainableSkills.push({
        name: skillName,
        canonicalName: skillName,
        category,
        level,
        goalRelevance,
        isGoalPrerequisite: isCore,
        dimensions: {
          selfAssessedKnowledge: observations.some(
            (o) => o.sourceType === "self_claim" || o.sourceType === "resume_mention"
          )
            ? "Intermediate"
            : "None",
          observedTechnicalEvidence: {
            count: githubObs.length + resumeObs.length,
            files: observations.map((o) => o.sourceReference).filter(Boolean) as string[],
            repositories: relatedProjects.map((p) => p.repositoryUrl).filter(Boolean) as string[],
            platforms: Array.from(new Set(observations.map((o) => o.source))),
          },
          demonstratedApplication: {
            projectCount: relatedProjects.length,
            projects: relatedProjects,
          },
          assessedCompetency: {
            assessed: assessmentObs.length > 0,
            score: assessmentsList[0]?.results?.[0]?.overallResult
              ? Number(assessmentsList[0].results[0].overallResult)
              : undefined,
            testTitle: assessmentsList[0]?.assessmentTitle,
            assessedAt: assessmentsList[0]?.completedAt || undefined,
          },
          independentVerification: {
            verified: verifiedObs.length > 0,
            verifiedBy: person360.evidence?.find((e) => e.verificationStatus === "verified")?.verifiedByPersonId || undefined,
            verifiedAt: person360.evidence?.find((e) => e.verificationStatus === "verified")?.verifiedAt || undefined,
            method: "Institutional Faculty Review",
          },
        },
        conciseExplanation,
        confidence,
        sevenQuestions,
        graph,
        observations,
        personalContribution: personalContrib,
        lastObservedAt,
      });
    }

    // 5. Identify Missing Goal Prerequisites (Never punitive!)
    const missingGoalSkills: SkillsIntelligenceSummary["missingGoalSkills"] = [];
    for (const coreSkill of corePrerequisites) {
      if (!allKnownSkills.includes(coreSkill)) {
        missingGoalSkills.push({
          name: coreSkill,
          category: categorizeSkill(coreSkill),
          relevance: "required_core",
          suggestedTask: `Missing evidence: No observation has been recorded yet. This does not mean you lack this skill; you can self-claim it, link a repository, or take an assessment.`,
        });
      }
    }

    // 6. Sort by Progression Strength & Relevance
    const levelWeight: Record<SkillProficiencyLevel, number> = {
      Verified: 5,
      Assessed: 4,
      Demonstrated: 3,
      "Applied evidence available": 2,
      "Exposure recorded": 1,
      Claimed: 0,
      "Not assessed": -1,
    };
    explainableSkills.sort((a, b) => {
      if (a.isGoalPrerequisite && !b.isGoalPrerequisite) return -1;
      if (!a.isGoalPrerequisite && b.isGoalPrerequisite) return 1;
      return levelWeight[b.level] - levelWeight[a.level] || b.observations.length - a.observations.length;
    });

    // 7. Harmonized Statistics
    const trackedCount = explainableSkills.length;
    const evidencedCount = explainableSkills.filter(
      (s) => s.level !== "Claimed" && s.level !== "Not assessed"
    ).length;
    const demonstratedCount = explainableSkills.filter(
      (s) => s.level === "Demonstrated" || s.level === "Assessed" || s.level === "Verified"
    ).length;
    const assessedCount = explainableSkills.filter(
      (s) => s.level === "Assessed" || s.level === "Verified"
    ).length;
    const verifiedCount = explainableSkills.filter((s) => s.level === "Verified").length;
    const prereqsMet = explainableSkills.filter(
      (s) => s.isGoalPrerequisite && (s.level === "Demonstrated" || s.level === "Assessed" || s.level === "Verified")
    ).length;

    return {
      skills: explainableSkills,
      targetRole,
      targetRoleId,
      stats: {
        trackedSkills: trackedCount,
        evidencedSkills: evidencedCount,
        demonstratedSkills: demonstratedCount,
        assessedSkills: assessedCount,
        verifiedSkills: verifiedCount,
        goalPrerequisitesMet: prereqsMet,
        goalPrerequisitesTotal: corePrerequisites.size,
        totalEvidencePoints: person360.evidence?.length || 0,
      },
      missingGoalSkills,
    };
  }

  /**
   * Generates the honest, evidence-contingent concise explanation sentence.
   */
  private static generateConciseSentence(
    skillName: string,
    state: {
      hasResume: boolean;
      hasGithub: boolean;
      hasProject: boolean;
      hasContribution: boolean;
      hasAssessment: boolean;
      isVerified: boolean;
      projectTitle?: string;
    }
  ): string {
    if (state.isVerified) {
      return `${skillName} has been independently verified by authorized faculty review.`;
    }
    if (state.hasAssessment) {
      return `${skillName} competency has been formally evaluated via standard assessment.`;
    }
    if (state.hasContribution && state.projectTitle) {
      return `${skillName} was personally implemented by you in confirmed project '${state.projectTitle}'. Competency has not yet been independently verified.`;
    }
    if (state.hasGithub && state.hasResume) {
      return `${skillName} appears in your GitHub project dependencies and was also mentioned in your resume. Your personal contribution has not yet been assessed.`;
    }
    if (state.hasGithub) {
      return `${skillName} appears in your GitHub project dependencies. Your personal contribution has not yet been assessed.`;
    }
    if (state.hasResume) {
      return `${skillName} was mentioned in your reviewed resume. Your personal contribution has not yet been assessed.`;
    }
    if (state.hasProject && state.projectTitle) {
      return `${skillName} is declared in confirmed project '${state.projectTitle}'. Your personal contribution has not yet been assessed.`;
    }
    return `You reported familiarity with ${skillName}. Practical demonstration has not yet been assessed.`;
  }

  private static explainKnowledgeLevel(level: SkillProficiencyLevel, name: string): string {
    switch (level) {
      case "Verified":
        return `Third-party certified. Independent faculty review or verified credential confirms your technical capability in ${name}.`;
      case "Assessed":
        return `Evaluated. Authentic graded assessment score proves applied conceptual and technical fluency in ${name}.`;
      case "Demonstrated":
        return `Practical proof. You confirmed personally implementing code or architecture using ${name} in a real project.`;
      case "Applied evidence available":
        return `Observed artifact. ${name} is present in project code and manifests, but your specific personal role has not yet been stated.`;
      case "Exposure recorded":
        return `Mentioned or imported. ${name} was found in your resume or repository manifest, but no practical code authorship is confirmed.`;
      case "Claimed":
        return `Self-reported claim. You stated familiarity with ${name}, but no code or independent proof has been connected yet.`;
      case "Not assessed":
      default:
        return `No verifiable evidence has been observed yet for ${name}.`;
    }
  }

  private static identifyMissingEvidence(
    level: SkillProficiencyLevel,
    state: { hasContribution: boolean; hasAssessment: boolean; hasProject: boolean }
  ): string[] {
    const missing: string[] = [];
    if (!state.hasProject) missing.push("Applied project implementation repository");
    if (!state.hasContribution) missing.push("Explicit student personal contribution statement");
    if (!state.hasAssessment) missing.push("Graded technical topic assessment score");
    if (level !== "Verified") missing.push("Independent faculty or credential verification");
    return missing;
  }

  /**
   * Constructs the real, canonical evidence graph with zero simulated links.
   */
  private static buildCanonicalEvidenceGraph(
    skillName: string,
    observations: SkillObservation[],
    projects: Array<{ id: string; title: string; repositoryUrl?: string | null; roles: string[]; description?: string }>,
    personalContrib?: PersonalContributionInfo
  ): SkillEvidenceGraph {
    const nodes: SkillEvidenceGraphNode[] = [];
    const edges: SkillEvidenceGraphEdge[] = [];
    const addedNodeIds = new Set<string>();

    const skillNodeId = `skill_${skillName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    nodes.push({ id: skillNodeId, type: "skill", label: skillName });
    addedNodeIds.add(skillNodeId);

    // Projects connected to this skill
    for (const p of projects) {
      const projNodeId = `proj_${p.id}`;
      if (!addedNodeIds.has(projNodeId)) {
        nodes.push({ id: projNodeId, type: "project", label: p.title });
        addedNodeIds.add(projNodeId);
      }
      edges.push({
        id: `edge_${skillNodeId}_${projNodeId}`,
        from: skillNodeId,
        to: projNodeId,
        relationship: "demonstrated_in",
        label: "Demonstrated in",
      });

      // Repository link
      if (p.repositoryUrl) {
        const repoNodeId = `repo_${p.id}`;
        if (!addedNodeIds.has(repoNodeId)) {
          nodes.push({
            id: repoNodeId,
            type: "repository",
            label: p.repositoryUrl.replace(/^https?:\/\/(www\.)?github\.com\//, ""),
            metadata: { url: p.repositoryUrl },
          });
          addedNodeIds.add(repoNodeId);
        }
        edges.push({
          id: `edge_${projNodeId}_${repoNodeId}`,
          from: projNodeId,
          to: repoNodeId,
          relationship: "stored_in",
          label: "Source code in",
        });
      }

      // Personal Contribution Node
      if (p.roles.length > 0 || p.description) {
        const contribNodeId = `contrib_${p.id}`;
        if (!addedNodeIds.has(contribNodeId)) {
          nodes.push({
            id: contribNodeId,
            type: "contribution",
            label: `Student Role: ${p.roles.join(", ") || "Component Developer"}`,
            metadata: { description: p.description },
          });
          addedNodeIds.add(contribNodeId);
        }
        edges.push({
          id: `edge_${projNodeId}_${contribNodeId}`,
          from: projNodeId,
          to: contribNodeId,
          relationship: "contributed_by",
          label: "Authored by student",
        });
      }
    }

    // Direct Observations (Files, Assessments, CV)
    for (const obs of observations) {
      if (obs.sourceType === "manifest_declared" && obs.sourceReference) {
        const fileNodeId = `file_${obs.id}`;
        if (!addedNodeIds.has(fileNodeId)) {
          nodes.push({ id: fileNodeId, type: "file", label: obs.sourceReference });
          addedNodeIds.add(fileNodeId);
          edges.push({
            id: `edge_${skillNodeId}_${fileNodeId}`,
            from: skillNodeId,
            to: fileNodeId,
            relationship: "observed_in",
            label: "Declared in manifest",
          });
        }
      } else if (obs.sourceType === "graded_assessment") {
        const evalNodeId = `eval_${obs.id}`;
        if (!addedNodeIds.has(evalNodeId)) {
          nodes.push({ id: evalNodeId, type: "assessment", label: obs.summary });
          addedNodeIds.add(evalNodeId);
          edges.push({
            id: `edge_${skillNodeId}_${evalNodeId}`,
            from: skillNodeId,
            to: evalNodeId,
            relationship: "evaluated_by",
            label: "Evaluated by",
          });
        }
      } else if (obs.sourceType === "faculty_verification") {
        const verNodeId = `ver_${obs.id}`;
        if (!addedNodeIds.has(verNodeId)) {
          nodes.push({ id: verNodeId, type: "verification", label: "Faculty Verified" });
          addedNodeIds.add(verNodeId);
          edges.push({
            id: `edge_${skillNodeId}_${verNodeId}`,
            from: skillNodeId,
            to: verNodeId,
            relationship: "verified_by",
            label: "Independently verified",
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Records student answers to the 5 contextual personal contribution questions.
   * Saves into evidenceItems with 'student_confirmed' provenance and updates projectContributions.
   */
  static async recordSkillContribution(params: {
    personId: string;
    skill: string;
    projectId: string;
    didYouPersonallyUse?: boolean;
    roleInProject?: string;
    codebaseParts?: string;
    challengesSolved?: string;
    projectType?: "solo" | "team" | "forked";
    liveComfortLevel?: "high" | "medium" | "developing";
    featureImplemented?: string;
    componentDescription?: string;
    fileReference?: string;
    wantsAssessment?: boolean;
  }): Promise<{ success: boolean; skillIntelligence: ExplainableSkillIntelligence }> {
    const {
      personId,
      skill,
      projectId,
      didYouPersonallyUse = true,
      roleInProject,
      codebaseParts,
      challengesSolved,
      projectType,
      liveComfortLevel,
      fileReference,
    } = params;

    const canonicalSkill = normalizeSkillName(skill);

    const feature = params.featureImplemented || roleInProject || `Contributor (${canonicalSkill})`;
    let description = params.componentDescription || "";
    if (!description && (roleInProject || codebaseParts || challengesSolved || projectType || liveComfortLevel)) {
      const parts: string[] = [];
      if (roleInProject) parts.push(`Role: ${roleInProject}`);
      if (codebaseParts) parts.push(`Codebase parts: ${codebaseParts}`);
      if (challengesSolved) parts.push(`Challenges solved: ${challengesSolved}`);
      if (projectType) parts.push(`Project type: ${projectType}`);
      if (liveComfortLevel) parts.push(`Live demo comfort: ${liveComfortLevel}`);
      description = parts.join(". ");
    }

    if (didYouPersonallyUse) {
      // 1. Update Project technologies in Neon DB so project is clearly tagged with this skill
      try {
        const db = await getDb();
        const [project] = await db
          .select()
          .from(projects)
          .where(and(eq(projects.id, projectId), eq(projects.personId, personId)))
          .limit(1);

        if (project) {
          const existingTechs = (project.technologies as string[]) || [];
          if (!existingTechs.some((t) => normalizeSkillName(t) === canonicalSkill)) {
            await db
              .update(projects)
              .set({
                technologies: [...existingTechs, canonicalSkill],
                updatedAt: new Date(),
              })
              .where(and(eq(projects.id, projectId), eq(projects.personId, personId)));
          }
        }
      } catch {
        // Non-fatal if project update fails
      }

      // 2. Update Project Contribution record in Neon DB
      await saveProjectContribution(
        projectId,
        personId,
        [feature || canonicalSkill],
        description || "Student confirmed active personal participation in project codebase."
      );

      // 3. Persist Evidence Item with truthful provenance
      await createEvidenceRecord(personId, {
        category: "skill",
        subject: canonicalSkill,
        value: `Confirmed personal contribution: ${feature}. ${description}`,
        source: "self_reported",
        verificationStatus: "self_reported",
        sourceReference: fileReference || `Project Contribution: ${projectId}`,
        interpretation: `Student explicitly confirmed personal implementation role in project ${projectId}. This constitutes practical demonstration claim, not third-party proof.`,
        whyItMatters: "Distinguishes actual individual contribution from mere repository co-presence.",
        importKey: `contrib_${personId}_${projectId}_${canonicalSkill.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      });
    }

    // Return updated intelligence for this skill
    const summary = await this.getSkillsIntelligence(personId);
    let updated = summary.skills.find(
      (s) =>
        s.canonicalName.toLowerCase() === canonicalSkill.toLowerCase() ||
        s.name.toLowerCase() === canonicalSkill.toLowerCase()
    );

    if (!updated) {
      // Find by partial match if canonical name differs slightly
      updated = summary.skills.find((s) => s.canonicalName.toLowerCase().includes(canonicalSkill.toLowerCase()));
    }

    if (!updated) {
      throw new Error(`Could not recalculate intelligence for skill '${canonicalSkill}'.`);
    }

    return {
      success: true,
      skillIntelligence: updated,
    };
  }
}
