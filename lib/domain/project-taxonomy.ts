// Centralized AI/ML Project Taxonomy & Configuration

export const PROJECT_CATEGORIES = [
  "Machine Learning",
  "Deep Learning",
  "Generative AI",
  "NLP",
  "Computer Vision",
  "Data Science",
  "Robotics",
  "MLOps",
  "AI Research",
  "Other AI/ML",
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_TYPES = [
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
  { value: "software_hardware", label: "Software + Hardware" },
  { value: "research", label: "Research" },
  { value: "other", label: "Other" },
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number]["value"];

export const PROJECT_PURPOSES = [
  { value: "academic", label: "Academic" },
  { value: "personal", label: "Personal" },
  { value: "research", label: "Research" },
  { value: "hackathon", label: "Hackathon / Competition" },
  { value: "internship", label: "Internship" },
  { value: "startup", label: "Startup / Product" },
  { value: "open_source", label: "Open Source" },
  { value: "other", label: "Other" },
] as const;

export type ProjectPurpose = (typeof PROJECT_PURPOSES)[number]["value"];

export const PROJECT_STATUSES = [
  { value: "idea", label: "Idea" },
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "maintained", label: "Maintained" },
  { value: "archived", label: "Archived" },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["value"];

export const PROJECT_VISIBILITIES = [
  { value: "private", label: "Private (Only You)" },
  { value: "institution", label: "Institution" },
  { value: "connections", label: "Connections" },
  { value: "public", label: "Public" },
] as const;

export type ProjectVisibility = (typeof PROJECT_VISIBILITIES)[number]["value"];

export const PROJECT_LINK_TYPES = [
  { value: "github", label: "GitHub Repository", icon: "Github" },
  { value: "demo", label: "Live Demo", icon: "ExternalLink" },
  { value: "website", label: "Project Website", icon: "Globe" },
  { value: "docs", label: "Documentation", icon: "BookOpen" },
  { value: "paper", label: "Research Paper", icon: "FileText" },
  { value: "dataset", label: "Dataset", icon: "Database" },
  { value: "model", label: "Model / Hugging Face", icon: "Sparkles" },
  { value: "video", label: "Demo Video", icon: "Video" },
  { value: "presentation", label: "Presentation / Slides", icon: "Layers" },
  { value: "design", label: "Design / Figma", icon: "Layout" },
  { value: "api_docs", label: "API Documentation", icon: "Code2" },
  { value: "hardware_docs", label: "Hardware Documentation", icon: "Cpu" },
  { value: "other", label: "Other Link", icon: "Link2" },
] as const;

export type ProjectLinkType = (typeof PROJECT_LINK_TYPES)[number]["value"];

export interface ProjectLinkRecord {
  id: string;
  type: ProjectLinkType;
  label: string;
  url: string;
  description?: string;
  visibility?: "private" | "public";
}

export const CONTRIBUTION_ROLES = [
  "Problem Definition",
  "Research",
  "Data Collection",
  "Data Cleaning",
  "Model Development",
  "Model Training",
  "Model Evaluation",
  "Prompt Engineering",
  "RAG Pipeline",
  "Backend",
  "Frontend",
  "System Architecture",
  "API Integration",
  "Hardware Assembly",
  "Sensor Integration",
  "Deployment",
  "Testing",
  "Documentation",
  "Project Management",
  "Other",
] as const;

export type ContributionRole = (typeof CONTRIBUTION_ROLES)[number];

export const TECH_GROUPS: Record<string, string[]> = {
  Programming: ["Python", "C++", "JavaScript", "TypeScript", "SQL", "Go", "Rust", "Java"],
  "AI & ML": ["PyTorch", "TensorFlow", "Scikit-Learn", "Keras", "Transformers", "OpenCV", "XGBoost", "LightGBM"],
  GenAI: ["RAG", "LangChain", "LlamaIndex", "Hugging Face", "FAISS", "ChromaDB", "Pinecone", "OpenAI", "Anthropic", "vLLM", "Ollama"],
  Backend: ["FastAPI", "Flask", "Django", "Node.js", "Express", "Next.js", "GraphQL"],
  Data: ["NumPy", "Pandas", "PostgreSQL", "MongoDB", "Redis", "DuckDB", "Spark", "Polars"],
  Deployment: ["Docker", "Kubernetes", "AWS", "GCP", "Azure", "MLflow", "ONNX", "Triton", "Modal", "Vercel"],
};

export interface StructuredMetricResult {
  id?: string;
  metricName: string;
  metricValue: string;
  unit?: string;
  split?: string;
  datasetSplit?: string;
  baseline?: string;
  reference?: string;
}

export interface TeamMemberRecord {
  id?: string;
  name: string;
  role?: string;
  institution?: string;
  personId?: string;
}

export interface MentorRecord {
  id?: string;
  name: string;
  role?: string;
  institution?: string;
  profileUrl?: string;
}

export interface ProjectTimelineRecord {
  startDate?: string;
  endDate?: string;
  expectedCompletionDate?: string;
  institution?: string;
  department?: string;
  isInternal?: boolean;
  relatedCourse?: string;
  relatedEvent?: string;
  course?: string;
  hackathon?: string;
}

export interface AiMlDetailsRecord {
  problemStatement?: string;
  proposedSolution?: string;
  dataset?: {
    name?: string;
    source?: string;
    url?: string;
    license?: string;
    description?: string;
  };
  modelFamily?: string;
  algorithm?: string;
  trainingApproach?: string;
  modelMethod?: {
    modelFamily?: string;
    algorithm?: string;
    architecture?: string;
    trainingApproach?: string;
    evaluationMethod?: string;
  };
  results?: StructuredMetricResult[];
  limitations?: string;
  futureImprovements?: string;
}

export interface HardwareDetailsRecord {
  platform?: string;
  hardwarePlatform?: string;
  microcontroller?: string;
  sensors?: string[];
  cameras?: string[];
  cameraModules?: string[];
  communications?: string[];
  components?: string[];
  architectureNotes?: string;
  prototypeStage?: string;
  testingNotes?: string;
  schematicUrl?: string;
  demoVideoUrl?: string;
}

export interface ProjectFullData {
  id: string;
  personId: string;
  title: string;
  summary?: string;
  description?: string;
  projectType: ProjectType;
  category?: ProjectCategory;
  purpose?: ProjectPurpose;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  repositoryUrl?: string | null;
  demoUrl?: string | null;
  technologies: string[];
  sources: string[];
  links: ProjectLinkRecord[];
  timeline?: ProjectTimelineRecord;
  team?: {
    projectStructure: "individual" | "team";
    teamName?: string;
    teamMembers?: TeamMemberRecord[];
    mentors?: MentorRecord[];
  };
  aiDetails?: AiMlDetailsRecord;
  hardwareDetails?: HardwareDetailsRecord;
  contributionRoles: string[];
  contributionNote?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Validates URLs defensively:
 * - Must start with http:// or https://
 * - Rejects loopback, private IPs, and cloud metadata IPs to avoid SSRF
 */
export function validateProjectUrl(rawUrl: string): { valid: boolean; error?: string; cleanUrl?: string } {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "URL is empty." };
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTP and HTTPS URLs are permitted." };
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF defense against loopback, cloud metadata, and RFC 1918 private subnets
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return { valid: false, error: "Local or private infrastructure addresses are not allowed." };
  }

  return { valid: true, cleanUrl: parsed.toString() };
}
