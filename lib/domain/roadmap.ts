import { findAimlRole } from "./aiml-role-taxonomy";

export type AimLGoalTemplate =
  | "GenAI Engineer"
  | "Generative AI Engineer"
  | "ML Engineer"
  | "Machine Learning Engineer"
  | "AI Engineer"
  | "Deep Learning Engineer"
  | "MLOps Engineer"
  | "NLP Engineer"
  | "Computer Vision Engineer"
  | "Data Scientist"
  | "Data Scientist (AI/ML)"
  | "AI Researcher"
  | "Applied AI Researcher"
  | "Robotics & AI Engineer"
  | "Reinforcement Learning Engineer"
  | "AI Product Builder / Founder"
  | "Still Exploring AI & ML"
  | "AI Internship"
  | "Placement Preparation"
  | "Custom Goal";

export type CoreActionPlatform = "Projects" | "Skills" | "Verification" | "Roadmap" | "Profile" | "Study LPU" | "Padho Code" | "ERIS" | "MentorMaze" | "External";

export type RoadmapStage = {
  stageNumber: number;
  title: string;
  description: string;
  requiredSkills: string[];
  status: "completed" | "in_progress" | "locked";
  recommendedActions: Array<{
    actionType: "Learn" | "Practice" | "Build" | "Verify" | "Interview";
    title: string;
    description: string;
    reason: string;
    sourcePlatform: CoreActionPlatform;
    destinationUrl?: string;
  }>;
};

export type StudentRoadmap = {
  goal: string;
  targetRole?: string;
  cohort?: number;
  totalStages: number;
  currentStageIndex: number;
  stages: RoadmapStage[];
  primaryActions: Array<{
    actionType: "Learn" | "Practice" | "Build" | "Verify" | "Interview";
    title: string;
    description: string;
    whyItMatters: string;
    sourcePlatform: CoreActionPlatform;
    destinationUrl?: string;
  }>;
};

type GoalCurriculum = {
  stages: Array<{
    title: string;
    description: string;
    prerequisiteSkills: string[];
    skills: string[];
    actions: Array<{
      actionType: "Learn" | "Practice" | "Build" | "Verify" | "Interview";
      title: string;
      description: string;
      sourcePlatform: CoreActionPlatform;
      destinationUrl?: string;
    }>;
  }>;
};

const GENAI_CURRICULUM: GoalCurriculum = {
  stages: [
    {
      title: "Stage 1: Core Python & Programming Foundations",
      description: "Master clean Python, asynchronous I/O, OOP, and data structures.",
      prerequisiteSkills: [],
      skills: ["Python", "DSA", "OOP"],
      actions: [
        { actionType: "Practice", title: "Practice Python Data Structures", description: "Implement graph and queue data structures in Python.", sourcePlatform: "Skills", destinationUrl: "/student/skills" },
        { actionType: "Learn", title: "Async Programming in Python", description: "Learn async/await and streaming patterns.", sourcePlatform: "Skills", destinationUrl: "/student/skills" },
      ],
    },
    {
      title: "Stage 2: Machine Learning & Mathematics Foundations",
      description: "Linear algebra, matrix operations, calculus, and foundational ML with scikit-learn.",
      prerequisiteSkills: ["Python"],
      skills: ["Linear Algebra", "Scikit-Learn", "Machine Learning"],
      actions: [
        { actionType: "Learn", title: "Vector & Matrix Mathematics", description: "Review dot products, cosine distance, and embedding spaces.", sourcePlatform: "Skills", destinationUrl: "/student/skills" },
        { actionType: "Practice", title: "Scikit-Learn Pipelines", description: "Build data preprocessing and classification pipelines.", sourcePlatform: "Skills", destinationUrl: "/student/skills" },
      ],
    },
    {
      title: "Stage 3: Deep Learning & Transformers",
      description: "Neural network architectures, PyTorch, attention mechanisms, and Transformer encoders/decoders.",
      prerequisiteSkills: ["Python", "Machine Learning"],
      skills: ["PyTorch", "Deep Learning", "Transformers"],
      actions: [
        { actionType: "Build", title: "Fine-tune a Small Language Model", description: "Use Hugging Face transformers with PEFT/LoRA.", sourcePlatform: "Projects", destinationUrl: "/student/projects" },
        { actionType: "Verify", title: "Document Evidence for Deep Learning", description: "Submit your transformer project evidence.", sourcePlatform: "Verification", destinationUrl: "/verification" },
      ],
    },
    {
      title: "Stage 4: Vector Databases, RAG & Agents",
      description: "Vector indexing, retrieval augmented generation, prompt pipelines, and multi-agent systems.",
      prerequisiteSkills: ["Transformers", "Python"],
      skills: ["Vector Databases", "FAISS", "LangChain", "RAG"],
      actions: [
        { actionType: "Build", title: "Build an End-to-End RAG System", description: "Implement semantic search with FAISS and hybrid ranking.", sourcePlatform: "Projects", destinationUrl: "/student/projects" },
        { actionType: "Practice", title: "Evaluate Retrieval Quality with RAGAS", description: "Measure context precision, recall, and answer relevance.", sourcePlatform: "Skills", destinationUrl: "/student/skills" },
      ],
    },
    {
      title: "Stage 5: Production Deployment & LLMOps",
      description: "Model serving, latency optimization, Dockerization, monitoring, and security evaluation.",
      prerequisiteSkills: ["RAG", "FastAPI"],
      skills: ["FastAPI", "Docker", "LLMOps", "Model Evaluation"],
      actions: [
        { actionType: "Build", title: "Deploy FastAPI Inference Microservice", description: "Containerize your model pipeline and expose streaming endpoints.", sourcePlatform: "Projects", destinationUrl: "/student/projects" },
        { actionType: "Interview", title: "Technical Architecture Review for GenAI", description: "Review systems architecture on RAG and vector retrieval.", sourcePlatform: "Roadmap", destinationUrl: "/student/roadmap" },
      ],
    },
  ],
};

const ML_ENGINEER_CURRICULUM: GoalCurriculum = {
  stages: [
    {
      title: "Stage 1: Core Programming & Algorithms",
      description: "Python data structures, OOP, complexity analysis, and numeric computation.",
      prerequisiteSkills: [],
      skills: ["Python", "DSA", "NumPy"],
      actions: [
        { actionType: "Practice", title: "Algorithmic Problem Solving", description: "Solve algorithmic graph and tree challenges.", sourcePlatform: "Skills", destinationUrl: "/student/skills" },
        { actionType: "Learn", title: "Numerical Python Optimization", description: "Vectorized operations and memory profiling with NumPy.", sourcePlatform: "Skills", destinationUrl: "/student/skills" },
      ],
    },
    {
      title: "Stage 2: Classical Machine Learning & Feature Engineering",
      description: "Regression, classification, ensemble models (XGBoost), and cross-validation.",
      prerequisiteSkills: ["Python"],
      skills: ["Machine Learning", "Scikit-Learn", "Feature Engineering"],
      actions: [
        { actionType: "Build", title: "Tabular Feature Engineering Pipeline", description: "Build automated imputation and feature selection.", sourcePlatform: "Projects", destinationUrl: "/student/projects" },
        { actionType: "Practice", title: "Model Validation Techniques", description: "Stratified K-fold and hyperparameter tuning.", sourcePlatform: "Skills", destinationUrl: "/student/skills" },
      ],
    },
    {
      title: "Stage 3: Deep Learning Frameworks",
      description: "Convolutional and recurrent networks, PyTorch model training loops, and loss optimization.",
      prerequisiteSkills: ["Machine Learning", "Python"],
      skills: ["PyTorch", "Deep Learning"],
      actions: [
        { actionType: "Build", title: "Custom PyTorch Training Loop", description: "Implement early stopping, learning rate scheduling, and checkpointing.", sourcePlatform: "Projects", destinationUrl: "/student/projects" },
        { actionType: "Verify", title: "Verify Deep Learning Evidence", description: "Validate neural network implementation mastery.", sourcePlatform: "Verification", destinationUrl: "/verification" },
      ],
    },
    {
      title: "Stage 4: MLOps & Production Pipelines",
      description: "Model tracking, artifact storage, inference latency benchmarking, and automated retraining.",
      prerequisiteSkills: ["PyTorch"],
      skills: ["MLOps", "Docker", "Model Monitoring", "FastAPI"],
      actions: [
        { actionType: "Build", title: "Containerize ML Inference Service", description: "Deploy Dockerized model server with health checks.", sourcePlatform: "Projects", destinationUrl: "/student/projects" },
        { actionType: "Interview", title: "ML System Design Review", description: "Practice large-scale model design and data distribution.", sourcePlatform: "Roadmap", destinationUrl: "/student/roadmap" },
      ],
    },
  ],
};

const AI_ENGINEER_CURRICULUM: GoalCurriculum = {
  stages: [
    {
      title: "Stage 1: Software & Systems Foundation",
      description: "Modern Python, REST APIs, asynchronous programming, and databases.",
      prerequisiteSkills: [],
      skills: ["Python", "FastAPI", "SQL", "PostgreSQL"],
      actions: [
        { actionType: "Build", title: "Build Scalable Backend API", description: "Develop async endpoints with SQL database persistence.", sourcePlatform: "Projects", destinationUrl: "/student/projects" },
      ],
    },
    {
      title: "Stage 2: AI Model Integration & Orchestration",
      description: "LLM APIs, embedding generation, semantic retrieval, and agent workflows.",
      prerequisiteSkills: ["Python", "FastAPI"],
      skills: ["LangChain", "OpenAI", "Vector Databases"],
      actions: [
        { actionType: "Build", title: "Build Agentic Workflow Pipeline", description: "Integrate tool-calling agents with vector search.", sourcePlatform: "Projects", destinationUrl: "/student/projects" },
      ],
    },
    {
      title: "Stage 3: Systems Verification & Placement Preparation",
      description: "Architecture review, load testing, and technical interview simulations.",
      prerequisiteSkills: ["LangChain"],
      skills: ["Docker", "Kubernetes", "System Design"],
      actions: [
        { actionType: "Interview", title: "AI Full-Stack Architecture Review", description: "Complete technical systems simulation.", sourcePlatform: "Roadmap", destinationUrl: "/student/roadmap" },
      ],
    },
  ],
};

const RESEARCHER_CURRICULUM: GoalCurriculum = {
  stages: [
    {
      title: "Stage 1: Advanced Mathematical Foundations",
      description: "Rigorous probability, linear algebra proofs, multivariate calculus, and optimization theory.",
      prerequisiteSkills: [],
      skills: ["Mathematics & Proofs", "Probability", "Linear Algebra"],
      actions: [
        { actionType: "Learn", title: "Optimization Theory for Deep Learning", description: "Study SGD convergence and loss landscape geometry.", sourcePlatform: "Skills", destinationUrl: "/student/skills" },
      ],
    },
    {
      title: "Stage 2: Literature Review & Baseline Reproduction",
      description: "Read seminal papers, dissect code repositories, and reproduce benchmark experiments.",
      prerequisiteSkills: ["Mathematics & Proofs"],
      skills: ["PyTorch", "Literature Review", "Experimental Rigor"],
      actions: [
        { actionType: "Build", title: "Reproduce a Recent ArXiv Paper", description: "Implement architecture and report baseline metrics.", sourcePlatform: "Projects", destinationUrl: "/student/projects" },
      ],
    },
    {
      title: "Stage 3: Novel Hypothesis & Manuscript Draft",
      description: "Formulate research questions, run ablations, and draft an academic preprint.",
      prerequisiteSkills: ["Experimental Rigor"],
      skills: ["LaTeX", "ArXiv", "Statistical Testing"],
      actions: [
        { actionType: "Verify", title: "Research Evidence Review", description: "Submit manuscript draft for formal verification review.", sourcePlatform: "Verification", destinationUrl: "/verification" },
      ],
    },
  ],
};

const DATA_SCIENTIST_CURRICULUM: GoalCurriculum = {
  stages: [
    {
      title: "Stage 1: Data Wrangling, Statistics & SQL",
      description: "Master exploratory data analysis, hypothesis testing, and complex SQL joins.",
      prerequisiteSkills: [],
      skills: ["Python", "Pandas", "SQL", "Statistics"],
      actions: [
        { actionType: "Practice", title: "Advanced SQL Analytical Queries", description: "Window functions, CTEs, and time-series aggregation.", sourcePlatform: "Skills", destinationUrl: "/student/skills" },
      ],
    },
    {
      title: "Stage 2: Predictive Modeling & Experimentation",
      description: "Supervised and unsupervised learning, feature selection, and A/B test design.",
      prerequisiteSkills: ["Python", "Statistics"],
      skills: ["Scikit-Learn", "Machine Learning", "A/B Testing"],
      actions: [
        { actionType: "Build", title: "End-to-End Business Predictive Model", description: "Build churn/conversion predictive model with feature importance.", sourcePlatform: "Projects", destinationUrl: "/student/projects" },
      ],
    },
    {
      title: "Stage 3: Executive Storytelling & Model Deployment",
      description: "Interactive dashboards, model explainability (SHAP), and stakeholder presentations.",
      prerequisiteSkills: ["Scikit-Learn"],
      skills: ["Data Visualization", "SHAP", "Streamlit"],
      actions: [
        { actionType: "Interview", title: "Data Science Technical Review", description: "Practice business case breakdown and metric defense.", sourcePlatform: "Roadmap", destinationUrl: "/student/roadmap" },
      ],
    },
  ],
};

const GOAL_CURRICULA: Record<string, GoalCurriculum> = {
  "GenAI Engineer": GENAI_CURRICULUM,
  "Generative AI Engineer": GENAI_CURRICULUM,
  "ML Engineer": ML_ENGINEER_CURRICULUM,
  "Machine Learning Engineer": ML_ENGINEER_CURRICULUM,
  "AI Engineer": AI_ENGINEER_CURRICULUM,
  "Deep Learning Engineer": ML_ENGINEER_CURRICULUM,
  "MLOps Engineer": ML_ENGINEER_CURRICULUM,
  "NLP Engineer": GENAI_CURRICULUM,
  "Natural Language Processing Engineer": GENAI_CURRICULUM,
  "Computer Vision Engineer": ML_ENGINEER_CURRICULUM,
  "AI Researcher": RESEARCHER_CURRICULUM,
  "Applied AI Researcher": RESEARCHER_CURRICULUM,
  "Robotics & AI Engineer": ML_ENGINEER_CURRICULUM,
  "Reinforcement Learning Engineer": RESEARCHER_CURRICULUM,
  "Data Scientist": DATA_SCIENTIST_CURRICULUM,
  "Data Scientist (AI/ML)": DATA_SCIENTIST_CURRICULUM,
  "AI Product Builder / Founder": AI_ENGINEER_CURRICULUM,
  "Still Exploring AI & ML": GENAI_CURRICULUM,
};

export function generatePersonalizedRoadmap(
  goalOrRole: string,
  evidencedSkills: string[] = [],
  expectedGraduationYear?: number,
  placementStatus?: string,
  options?: {
    targetRole?: string;
    specificGoal?: string;
    primaryPriority?: string;
    confirmedProjectCount?: number;
  }
): StudentRoadmap {
  const normSkills = new Set(evidencedSkills.map((s) => s.toLowerCase().trim()));

  const roleKey = options?.targetRole || goalOrRole;
  const roleDef = findAimlRole(roleKey);
  const resolvedRole = roleDef?.title || roleKey;

  let curriculum: GoalCurriculum | undefined = GOAL_CURRICULA[resolvedRole];
  if (!curriculum) {
    const matchedKey = Object.keys(GOAL_CURRICULA).find(
      (k) => k.toLowerCase() === resolvedRole.toLowerCase()
    );
    curriculum = matchedKey ? GOAL_CURRICULA[matchedKey] : undefined;
  }

  if (!curriculum) {
    return { goal: goalOrRole, targetRole: resolvedRole, cohort: expectedGraduationYear, totalStages: 0, currentStageIndex: -1, stages: [], primaryActions: [] };
  }

  const stages: RoadmapStage[] = [];
  let currentStageIndex = -1;

  for (let i = 0; i < curriculum.stages.length; i++) {
    const rawStage = curriculum.stages[i];

    const demonstratedCount = rawStage.skills.filter((skill) =>
      normSkills.has(skill.toLowerCase().trim())
    ).length;

    const isFullyEvidenced = demonstratedCount === rawStage.skills.length && demonstratedCount > 0;
    const isPartiallyEvidenced = demonstratedCount > 0;

    let status: "completed" | "in_progress" | "locked" = "locked";

    if (isFullyEvidenced) {
      status = "completed";
    } else if (currentStageIndex === -1) {
      status = "in_progress";
      currentStageIndex = i;
    } else {
      status = "locked";
    }

    const actions = rawStage.actions.map((act) => ({
      ...act,
      destinationUrl: act.destinationUrl || (act.actionType === "Build" ? "/student/projects" : act.actionType === "Verify" ? "/verification" : "/student/skills"),
      reason: isPartiallyEvidenced
        ? `Verified evidence covers ${demonstratedCount}/${rawStage.skills.length} skills in this stage; review the remaining requirements.`
        : `No verified evidence is recorded for these ${resolvedRole} stage skills: ${rawStage.skills.join(", ")}.`,
    }));
    stages.push({
      stageNumber: i + 1,
      title: rawStage.title,
      description: rawStage.description,
      requiredSkills: rawStage.skills,
      status,
      recommendedActions: actions,
    });
  }

  if (currentStageIndex === -1) {
    currentStageIndex = Math.max(0, stages.length - 1);
    if (stages[currentStageIndex]) {
      stages[currentStageIndex].status = "in_progress";
    }
  }

  const activeStage = stages[currentStageIndex] || stages[0];
  if (activeStage && options?.confirmedProjectCount) {
    activeStage.recommendedActions.unshift({
      actionType: "Build",
      title: "Document evaluation for a confirmed project",
      description: "Add your personal contribution, evaluation method, and observed results to a recorded project.",
      sourcePlatform: "Projects",
      destinationUrl: "/student/projects",
      reason: `${options.confirmedProjectCount} confirmed project record${options.confirmedProjectCount === 1 ? "" : "s"} can be strengthened with documented evidence. This does not complete a skill milestone automatically.`,
    });
  }

  // Adjust action prioritization based on priority, specific goal, and graduation context
  const currentYear = new Date().getFullYear();
  const isNearGraduation =
    (expectedGraduationYear && expectedGraduationYear <= currentYear + 1) ||
    placementStatus === "actively_applying" ||
    placementStatus === "interviewing";

  const isInternshipGoal =
    options?.specificGoal?.toLowerCase().includes("internship") ||
    options?.primaryPriority === "jobs";

  const isProjectGoal =
    options?.specificGoal?.toLowerCase().includes("project") ||
    options?.primaryPriority === "projects";

  const prioritizedActions = [...activeStage.recommendedActions];

  prioritizedActions.sort((a, b) => {
    let orderA = 3;
    let orderB = 3;

    if (isNearGraduation || isInternshipGoal) {
      const orderMap: Record<string, number> = { Interview: 0, Verify: 1, Build: 2, Practice: 3, Learn: 4 };
      orderA = orderMap[a.actionType] ?? 5;
      orderB = orderMap[b.actionType] ?? 5;
    } else if (isProjectGoal) {
      const orderMap: Record<string, number> = { Build: 0, Practice: 1, Verify: 2, Learn: 3, Interview: 4 };
      orderA = orderMap[a.actionType] ?? 5;
      orderB = orderMap[b.actionType] ?? 5;
    }

    return orderA - orderB;
  });

  const primaryActions = prioritizedActions.slice(0, 3).map((act) => ({
    actionType: act.actionType,
    title: act.title,
    description: act.description,
    sourcePlatform: act.sourcePlatform,
    destinationUrl: act.destinationUrl || (act.actionType === "Build" ? "/student/projects" : act.actionType === "Verify" ? "/verification" : "/student/skills"),
    whyItMatters:
      isNearGraduation && (act.actionType === "Interview" || act.actionType === "Verify")
        ? `Because you are graduating in ${expectedGraduationYear || "the upcoming cycle"}, verified proof and interview practice are highest priority for your ${resolvedRole} target.`
        : isInternshipGoal && act.actionType === "Interview"
        ? `Because you are targeting an internship in ${resolvedRole}, early mock interview feedback helps identify communication gaps.`
        : `Your goal is ${resolvedRole}. You have ${
            activeStage.status === "in_progress" ? "unmet requirements" : "next steps"
          } in "${activeStage.title}", and this fills that specific gap.`,
  }));

  return {
    goal: options?.specificGoal || goalOrRole,
    targetRole: resolvedRole,
    cohort: expectedGraduationYear,
    totalStages: stages.length,
    currentStageIndex,
    stages,
    primaryActions,
  };
}

import { getDb, roadmapMilestones, type TathastuDb } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import crypto from "node:crypto";

export async function persistRoadmapMilestones(
  personId: string,
  goalId: string,
  roadmap: StudentRoadmap,
  dbClient?: TathastuDb
): Promise<void> {
  const db = dbClient || (await getDb());

  for (let i = 0; i < roadmap.stages.length; i++) {
    const stage = roadmap.stages[i];
    const milestoneId = `ms_${crypto.createHash("sha256").update(`${personId}:${goalId}:${stage.stageNumber}:${stage.title}`).digest("hex").slice(0, 16)}`;

    await db
      .insert(roadmapMilestones)
      .values({
        id: milestoneId,
        personId,
        goalId,
        competencyId: stage.requiredSkills[0] || stage.title,
        title: stage.title,
        description: stage.description,
        outcome: `Master competency requirements for ${stage.title}`,
        actionType: (stage.recommendedActions[0]?.actionType as "Build" | "Practice" | "Learn" | "Verify" | "Document") || "Build",
        destinationUrl: stage.recommendedActions[0]?.destinationUrl || "/student/projects",
        prerequisiteIds: stage.requiredSkills,
        completionCriteria: `Verified evidence recorded for skills: ${stage.requiredSkills.join(", ")}`,
        status: stage.status === "completed" ? "completed" : stage.status === "in_progress" ? "in_progress" : "pending",
        orderIndex: stage.stageNumber,
        version: 1,
      })
      .onConflictDoUpdate({
        target: roadmapMilestones.id,
        set: {
          status: stage.status === "completed" ? "completed" : stage.status === "in_progress" ? "in_progress" : "pending",
          updatedAt: new Date(),
        },
      });
  }
}

export async function getPersistedRoadmapMilestones(
  personId: string,
  goalId: string,
  dbClient?: TathastuDb
) {
  const db = dbClient || (await getDb());
  return db
    .select()
    .from(roadmapMilestones)
    .where(and(eq(roadmapMilestones.personId, personId), eq(roadmapMilestones.goalId, goalId)))
    .orderBy(roadmapMilestones.orderIndex);
}
