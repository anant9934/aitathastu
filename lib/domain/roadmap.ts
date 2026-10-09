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
    sourcePlatform: "Study LPU" | "Padho Code" | "Projects" | "ERIS" | "MentorMaze" | "External";
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
    sourcePlatform: "Study LPU" | "Padho Code" | "Projects" | "ERIS" | "MentorMaze" | "External";
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
      sourcePlatform: "Study LPU" | "Padho Code" | "Projects" | "ERIS" | "MentorMaze" | "External";
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
        { actionType: "Practice", title: "Practice Python Data Structures", description: "Implement graph and queue data structures in Python.", sourcePlatform: "Padho Code" },
        { actionType: "Learn", title: "Async Programming in Python", description: "Learn async/await and streaming patterns.", sourcePlatform: "Study LPU" },
      ],
    },
    {
      title: "Stage 2: Machine Learning & Mathematics Foundations",
      description: "Linear algebra, matrix operations, calculus, and foundational ML with scikit-learn.",
      prerequisiteSkills: ["Python"],
      skills: ["Linear Algebra", "Scikit-Learn", "Machine Learning"],
      actions: [
        { actionType: "Learn", title: "Vector & Matrix Mathematics", description: "Review dot products, cosine distance, and embedding spaces.", sourcePlatform: "Study LPU" },
        { actionType: "Practice", title: "Scikit-Learn Pipelines", description: "Build data preprocessing and classification pipelines.", sourcePlatform: "Padho Code" },
      ],
    },
    {
      title: "Stage 3: Deep Learning & Transformers",
      description: "Neural network architectures, PyTorch, attention mechanisms, and Transformer encoders/decoders.",
      prerequisiteSkills: ["Python", "Machine Learning"],
      skills: ["PyTorch", "Deep Learning", "Transformers"],
      actions: [
        { actionType: "Build", title: "Fine-tune a Small Language Model", description: "Use Hugging Face transformers with PEFT/LoRA.", sourcePlatform: "Projects" },
        { actionType: "Verify", title: "Request Faculty Verification for Deep Learning", description: "Submit your transformer project evidence.", sourcePlatform: "ERIS" },
      ],
    },
    {
      title: "Stage 4: Vector Databases, RAG & Agents",
      description: "Vector indexing, retrieval augmented generation, prompt pipelines, and multi-agent systems.",
      prerequisiteSkills: ["Transformers", "Python"],
      skills: ["Vector Databases", "FAISS", "LangChain", "RAG"],
      actions: [
        { actionType: "Build", title: "Build an End-to-End RAG System", description: "Implement semantic search with FAISS and hybrid ranking.", sourcePlatform: "Projects" },
        { actionType: "Practice", title: "Evaluate Retrieval Quality with RAGAS", description: "Measure context precision, recall, and answer relevance.", sourcePlatform: "Padho Code" },
      ],
    },
    {
      title: "Stage 5: Production Deployment & LLMOps",
      description: "Model serving, latency optimization, Dockerization, monitoring, and security evaluation.",
      prerequisiteSkills: ["RAG", "FastAPI"],
      skills: ["FastAPI", "Docker", "LLMOps", "Model Evaluation"],
      actions: [
        { actionType: "Build", title: "Deploy FastAPI Inference Microservice", description: "Containerize your model pipeline and expose streaming endpoints.", sourcePlatform: "Projects" },
        { actionType: "Interview", title: "Technical Mock Interview for GenAI", description: "Complete a MentorMaze systems interview on RAG architectures.", sourcePlatform: "MentorMaze" },
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
        { actionType: "Practice", title: "Algorithmic Problem Solving", description: "Solve algorithmic graph and tree challenges.", sourcePlatform: "Padho Code" },
        { actionType: "Learn", title: "Numerical Python Optimization", description: "Vectorized operations and memory profiling with NumPy.", sourcePlatform: "Study LPU" },
      ],
    },
    {
      title: "Stage 2: Classical Machine Learning & Feature Engineering",
      description: "Regression, classification, ensemble models (XGBoost), and cross-validation.",
      prerequisiteSkills: ["Python"],
      skills: ["Machine Learning", "Scikit-Learn", "Feature Engineering"],
      actions: [
        { actionType: "Build", title: "Tabular Feature Engineering Pipeline", description: "Build automated imputation and feature selection.", sourcePlatform: "Projects" },
        { actionType: "Practice", title: "Model Validation Techniques", description: "Stratified K-fold and hyperparameter tuning.", sourcePlatform: "Padho Code" },
      ],
    },
    {
      title: "Stage 3: Deep Learning Frameworks",
      description: "Convolutional and recurrent networks, PyTorch model training loops, and loss optimization.",
      prerequisiteSkills: ["Machine Learning", "Python"],
      skills: ["PyTorch", "Deep Learning"],
      actions: [
        { actionType: "Build", title: "Custom PyTorch Training Loop", description: "Implement early stopping, learning rate scheduling, and checkpointing.", sourcePlatform: "Projects" },
        { actionType: "Verify", title: "ERIS Deep Learning Assessment", description: "Validate neural network implementation mastery.", sourcePlatform: "ERIS" },
      ],
    },
    {
      title: "Stage 4: MLOps & Production Pipelines",
      description: "Model tracking, artifact storage, inference latency benchmarking, and automated retraining.",
      prerequisiteSkills: ["PyTorch"],
      skills: ["MLOps", "Docker", "Model Monitoring", "FastAPI"],
      actions: [
        { actionType: "Build", title: "Containerize ML Inference Service", description: "Deploy Dockerized model server with health checks.", sourcePlatform: "Projects" },
        { actionType: "Interview", title: "ML System Design Interview", description: "Practice large-scale model design with MentorMaze.", sourcePlatform: "MentorMaze" },
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
        { actionType: "Build", title: "Build Scalable Backend API", description: "Develop async endpoints with SQL database persistence.", sourcePlatform: "Projects" },
      ],
    },
    {
      title: "Stage 2: AI Model Integration & Orchestration",
      description: "LLM APIs, embedding generation, semantic retrieval, and agent workflows.",
      prerequisiteSkills: ["Python", "FastAPI"],
      skills: ["LangChain", "OpenAI", "Vector Databases"],
      actions: [
        { actionType: "Build", title: "Build Agentic Workflow Pipeline", description: "Integrate tool-calling agents with vector search.", sourcePlatform: "Projects" },
      ],
    },
    {
      title: "Stage 3: Systems Verification & Placement Preparation",
      description: "Architecture review, load testing, and technical interview simulations.",
      prerequisiteSkills: ["LangChain"],
      skills: ["Docker", "Kubernetes", "System Design"],
      actions: [
        { actionType: "Interview", title: "AI Full-Stack Architecture Mock", description: "Complete technical systems simulation.", sourcePlatform: "MentorMaze" },
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
        { actionType: "Learn", title: "Optimization Theory for Deep Learning", description: "Study SGD convergence and loss landscape geometry.", sourcePlatform: "Study LPU" },
      ],
    },
    {
      title: "Stage 2: Literature Review & Baseline Reproduction",
      description: "Read seminal papers, dissect code repositories, and reproduce benchmark experiments.",
      prerequisiteSkills: ["Mathematics & Proofs"],
      skills: ["PyTorch", "Literature Review", "Experimental Rigor"],
      actions: [
        { actionType: "Build", title: "Reproduce a Recent ArXiv Paper", description: "Implement architecture and report baseline metrics.", sourcePlatform: "Projects" },
      ],
    },
    {
      title: "Stage 3: Novel Hypothesis & Manuscript Draft",
      description: "Formulate research questions, run ablations, and draft an academic preprint.",
      prerequisiteSkills: ["Experimental Rigor"],
      skills: ["LaTeX", "ArXiv", "Statistical Testing"],
      actions: [
        { actionType: "Verify", title: "Faculty Research Review on ERIS", description: "Submit manuscript draft for formal faculty critique.", sourcePlatform: "ERIS" },
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
        { actionType: "Practice", title: "Advanced SQL Analytical Queries", description: "Window functions, CTEs, and time-series aggregation.", sourcePlatform: "Padho Code" },
      ],
    },
    {
      title: "Stage 2: Predictive Modeling & Experimentation",
      description: "Supervised and unsupervised learning, feature selection, and A/B test design.",
      prerequisiteSkills: ["Python", "Statistics"],
      skills: ["Scikit-Learn", "Machine Learning", "A/B Testing"],
      actions: [
        { actionType: "Build", title: "End-to-End Business Predictive Model", description: "Build churn/conversion predictive model with feature importance.", sourcePlatform: "Projects" },
      ],
    },
    {
      title: "Stage 3: Executive Storytelling & Model Deployment",
      description: "Interactive dashboards, model explainability (SHAP), and stakeholder presentations.",
      prerequisiteSkills: ["Scikit-Learn"],
      skills: ["Data Visualization", "SHAP", "Streamlit"],
      actions: [
        { actionType: "Interview", title: "Data Science Technical Interview", description: "Practice business case breakdown and metric defense on MentorMaze.", sourcePlatform: "MentorMaze" },
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
