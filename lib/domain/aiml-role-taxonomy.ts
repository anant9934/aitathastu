/**
 * AI/ML Target Role & Goal Taxonomy
 * AI Tathastu Ecosystem — Version 1.0.0
 * 
 * Centralized, versioned taxonomy for AI & ML career directions and student outcomes.
 * The ecosystem strictly targets Artificial Intelligence and Machine Learning disciplines.
 */

export const AIML_TAXONOMY_VERSION = "1.0.0";

export type AimlRoleCategory =
  | "engineering"
  | "research"
  | "data_product"
  | "exploration";

export type AimlRoleDefinition = {
  id: string;
  title: string;
  category: AimlRoleCategory;
  categoryLabel: string;
  description: string;
  popular: boolean;
  sortOrder: number;
  corePrerequisites: string[];
  recommendedTechnologies: string[];
  hasReadinessPolicy: boolean;
};

export const AIML_ROLE_CATALOG: AimlRoleDefinition[] = [
  // Engineering Category
  {
    id: "genai_engineer",
    title: "Generative AI Engineer",
    category: "engineering",
    categoryLabel: "Engineering",
    description: "Build LLM applications, RAG pipelines, fine-tuning workflows, and autonomous agent systems.",
    popular: true,
    sortOrder: 1,
    corePrerequisites: ["Python", "Transformers", "Vector Databases", "Prompt Engineering"],
    recommendedTechnologies: ["LangChain", "LlamaIndex", "FAISS", "PyTorch", "FastAPI"],
    hasReadinessPolicy: true,
  },
  {
    id: "ml_engineer",
    title: "Machine Learning Engineer",
    category: "engineering",
    categoryLabel: "Engineering",
    description: "Design, train, optimize, and deploy scalable machine learning models in production.",
    popular: true,
    sortOrder: 2,
    corePrerequisites: ["Python", "Scikit-Learn", "Linear Algebra", "Data Structures"],
    recommendedTechnologies: ["NumPy", "Pandas", "Scikit-Learn", "XGBoost", "PyTorch"],
    hasReadinessPolicy: true,
  },
  {
    id: "ai_engineer",
    title: "AI Engineer",
    category: "engineering",
    categoryLabel: "Engineering",
    description: "Bridge software systems and AI APIs to build resilient, AI-powered applications and services.",
    popular: true,
    sortOrder: 3,
    corePrerequisites: ["Python", "REST APIs", "SQL", "Cloud Basics"],
    recommendedTechnologies: ["FastAPI", "Docker", "PostgreSQL", "OpenAI API", "LangChain"],
    hasReadinessPolicy: true,
  },
  {
    id: "deep_learning_engineer",
    title: "Deep Learning Engineer",
    category: "engineering",
    categoryLabel: "Engineering",
    description: "Architect, train, and benchmark multi-layer neural networks for vision, speech, and complex data.",
    popular: false,
    sortOrder: 4,
    corePrerequisites: ["PyTorch", "Calculus", "Linear Algebra", "GPU Computing"],
    recommendedTechnologies: ["PyTorch", "TensorFlow", "CUDA", "Weights & Biases", "ONNX"],
    hasReadinessPolicy: true,
  },
  {
    id: "mlops_engineer",
    title: "MLOps Engineer",
    category: "engineering",
    categoryLabel: "Engineering",
    description: "Automate ML CI/CD pipelines, model registries, drift detection, and production monitoring.",
    popular: false,
    sortOrder: 5,
    corePrerequisites: ["Docker", "Kubernetes", "CI/CD", "Python", "Model Serving"],
    recommendedTechnologies: ["MLflow", "Kubeflow", "Docker", "FastAPI", "Prometheus"],
    hasReadinessPolicy: true,
  },
  {
    id: "nlp_engineer",
    title: "NLP Engineer",
    category: "engineering",
    categoryLabel: "Engineering",
    description: "Develop natural language understanding, text classification, tokenizers, and translation systems.",
    popular: false,
    sortOrder: 6,
    corePrerequisites: ["Python", "Linguistics Basics", "Transformers", "Tokenization"],
    recommendedTechnologies: ["Hugging Face", "spaCy", "NLTK", "PyTorch", "BERTopic"],
    hasReadinessPolicy: true,
  },
  {
    id: "computer_vision_engineer",
    title: "Computer Vision Engineer",
    category: "engineering",
    categoryLabel: "Engineering",
    description: "Implement object detection, semantic segmentation, image generation, and spatial reasoning.",
    popular: false,
    sortOrder: 7,
    corePrerequisites: ["OpenCV", "Convolutional Networks", "Image Processing", "Python"],
    recommendedTechnologies: ["OpenCV", "YOLO", "PyTorch", "Albumentations", "Torchvision"],
    hasReadinessPolicy: true,
  },

  // Research and Specialized AI Category
  {
    id: "ai_researcher",
    title: "AI Researcher",
    category: "research",
    categoryLabel: "Research & Specialized AI",
    description: "Formulate novel algorithmic hypotheses, publish research papers, and advance the state of the art.",
    popular: true,
    sortOrder: 8,
    corePrerequisites: ["Mathematics & Proofs", "PyTorch", "Literature Review", "Experimental Rigor"],
    recommendedTechnologies: ["PyTorch", "LaTeX", "ArXiv", "Weights & Biases", "NumPy"],
    hasReadinessPolicy: true,
  },
  {
    id: "applied_ai_researcher",
    title: "Applied AI Researcher",
    category: "research",
    categoryLabel: "Research & Specialized AI",
    description: "Translate theoretical advancements into practical prototypes solving high-impact domain problems.",
    popular: false,
    sortOrder: 9,
    corePrerequisites: ["Statistical Testing", "PyTorch", "Domain Modeling", "Benchmarking"],
    recommendedTechnologies: ["PyTorch", "Hugging Face", "SciPy", "Matplotlib", "FastAPI"],
    hasReadinessPolicy: false,
  },
  {
    id: "robotics_ai_engineer",
    title: "Robotics & AI Engineer",
    category: "research",
    categoryLabel: "Research & Specialized AI",
    description: "Integrate perception, kinematics, control algorithms, and sensor fusion for robotic systems.",
    popular: false,
    sortOrder: 10,
    corePrerequisites: ["Control Theory", "Kinematics", "C++", "Python", "Sensors"],
    recommendedTechnologies: ["ROS 2", "Gazebo", "OpenCV", "PyTorch", "C++"],
    hasReadinessPolicy: false,
  },
  {
    id: "rl_engineer",
    title: "Reinforcement Learning Engineer",
    category: "research",
    categoryLabel: "Research & Specialized AI",
    description: "Develop policy gradients, Q-learning agents, and simulation environments for sequential decisions.",
    popular: false,
    sortOrder: 11,
    corePrerequisites: ["Markov Decision Processes", "Dynamic Programming", "PyTorch", "Probability"],
    recommendedTechnologies: ["Gymnasium", "Stable-Baselines3", "Ray RLlib", "PyTorch", "MuJoCo"],
    hasReadinessPolicy: false,
  },

  // Data and Product Category
  {
    id: "data_scientist_aiml",
    title: "Data Scientist (AI/ML)",
    category: "data_product",
    categoryLabel: "Data & Product",
    description: "Extract statistical insights, build predictive models, run A/B experiments, and tell data stories.",
    popular: true,
    sortOrder: 12,
    corePrerequisites: ["Statistics", "SQL", "Python", "Exploratory Data Analysis"],
    recommendedTechnologies: ["Pandas", "Scikit-Learn", "Seaborn", "PostgreSQL", "Statsmodels"],
    hasReadinessPolicy: true,
  },
  {
    id: "ai_product_builder",
    title: "AI Product Builder / Founder",
    category: "data_product",
    categoryLabel: "Data & Product",
    description: "Build, launch, and monetize user-facing AI applications with full-stack product intuition.",
    popular: false,
    sortOrder: 13,
    corePrerequisites: ["Product Thinking", "Full-Stack Development", "LLM APIs", "User Feedback"],
    recommendedTechnologies: ["Next.js", "FastAPI", "OpenAI API", "TailwindCSS", "Supabase"],
    hasReadinessPolicy: true,
  },

  // Exploration Category
  {
    id: "exploring_aiml",
    title: "Still Exploring AI & ML",
    category: "exploration",
    categoryLabel: "Exploration",
    description: "Discover the landscape across engineering, research, and applications before committing to a specialty.",
    popular: true,
    sortOrder: 14,
    corePrerequisites: ["Python Basics", "Curiosity", "Mathematics Foundations"],
    recommendedTechnologies: ["Python", "Jupyter Notebooks", "Google Colab", "Scikit-Learn"],
    hasReadinessPolicy: false,
  },
];

export type GoalCategory =
  | "career_entry"
  | "placement"
  | "portfolio"
  | "academic"
  | "upskilling"
  | "network"
  | "founder"
  | "custom";

export type GoalOutcomeDefinition = {
  id: string;
  label: string;
  category: GoalCategory;
  description: string;
  isCustom?: boolean;
};

export const AIML_GOAL_OUTCOMES: GoalOutcomeDefinition[] = [
  {
    id: "goal_internship",
    label: "Get an AI/ML internship",
    category: "career_entry",
    description: "Target entry-level industry internships with hands-on project artifacts and verified skills.",
  },
  {
    id: "goal_job_prep",
    label: "Prepare for an AI/ML job",
    category: "placement",
    description: "Practice technical interviews, systems design, and portfolio evidence for full-time hiring.",
  },
  {
    id: "goal_build_project",
    label: "Build a strong AI/ML project",
    category: "portfolio",
    description: "Create an end-to-end working artifact with GitHub source code, live demo, and measurable evaluation.",
  },
  {
    id: "goal_research",
    label: "Work on AI/ML research",
    category: "academic",
    description: "Engage with academic literature, formulate hypotheses, and write reproducible experiment benchmarks.",
  },
  {
    id: "goal_learning",
    label: "Improve my AI/ML knowledge",
    category: "upskilling",
    description: "Master algorithmic foundations, mathematical concepts, and modern framework mechanics.",
  },
  {
    id: "goal_mentorship",
    label: "Find AI/ML mentors or collaborators",
    category: "network",
    description: "Connect with senior engineers, researchers, and peers for guidance and group projects.",
  },
  {
    id: "goal_product",
    label: "Create an AI-powered product",
    category: "founder",
    description: "Build an MVP solving a concrete problem, validate with users, and launch an application.",
  },
  {
    id: "goal_custom",
    label: "Set my own AI/ML goal",
    category: "custom",
    description: "Define a tailored outcome specific to your personal journey and academic interests.",
    isCustom: true,
  },
];

export const AIML_TIMELINE_OPTIONS = [
  { id: "3_months", label: "Within 3 months", months: 3 },
  { id: "6_months", label: "Within 6 months", months: 6 },
  { id: "12_months", label: "Within 12 months", months: 12 },
  { id: "specific_date", label: "A specific date", isDatePicker: true },
  { id: "flexible", label: "Not sure yet", isFlexible: true },
] as const;

/**
 * Find role definition by ID or title
 */
export function findAimlRole(idOrTitle: string): AimlRoleDefinition | undefined {
  if (!idOrTitle) return undefined;
  const norm = idOrTitle.trim().toLowerCase();
  return AIML_ROLE_CATALOG.find(
    (r) => r.id.toLowerCase() === norm || r.title.toLowerCase() === norm
  );
}

/**
 * Get role by ID with safe fallback to first canonical role
 */
export function getRoleById(roleId: string): AimlRoleDefinition {
  const found = findAimlRole(roleId);
  return found || AIML_ROLE_CATALOG[0];
}

/**
 * Get popular initial 6 roles for 3x2 grid
 */
export function getPopularAimlRoles(): AimlRoleDefinition[] {
  return AIML_ROLE_CATALOG.filter((r) => r.popular);
}

/**
 * Search AI/ML roles by query
 */
export function searchAimlRoles(query: string): AimlRoleDefinition[] {
  if (!query || !query.trim()) return AIML_ROLE_CATALOG;
  const q = query.trim().toLowerCase();
  return AIML_ROLE_CATALOG.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.categoryLabel.toLowerCase().includes(q) ||
      r.corePrerequisites.some((p) => p.toLowerCase().includes(q)) ||
      r.recommendedTechnologies.some((t) => t.toLowerCase().includes(q))
  );
}

/**
 * Validate custom goal text
 */
export function validateCustomGoal(goalText: string): { valid: boolean; error?: string } {
  if (!goalText || !goalText.trim()) {
    return { valid: false, error: "Please enter your custom AI/ML goal." };
  }
  const trimmed = goalText.trim();
  if (trimmed.length < 5) {
    return { valid: false, error: "Goal description must be at least 5 characters." };
  }
  if (trimmed.length > 200) {
    return { valid: false, error: "Goal description must be under 200 characters." };
  }
  return { valid: true };
}

/**
 * Validate target timeline input
 */
export function validateTargetTimeline(
  timelineChoice: string,
  customDate?: string
): { valid: boolean; error?: string; formatted: string } {
  if (timelineChoice === "specific_date") {
    if (!customDate || !customDate.trim()) {
      return { valid: false, error: "Please select a target date.", formatted: "" };
    }
    const d = new Date(customDate);
    if (isNaN(d.getTime())) {
      return { valid: false, error: "Invalid calendar date provided.", formatted: "" };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) {
      return { valid: false, error: "Target date must be in the future.", formatted: "" };
    }
    return { valid: true, formatted: customDate };
  }

  const matched = AIML_TIMELINE_OPTIONS.find((t) => t.id === timelineChoice || t.label === timelineChoice);
  if (matched) {
    return { valid: true, formatted: matched.label };
  }

  return { valid: true, formatted: timelineChoice || "Not sure yet" };
}
