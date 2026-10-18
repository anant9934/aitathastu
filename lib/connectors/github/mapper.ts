import crypto from "crypto";

export type RawGitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  topics?: string[];
  stargazers_count?: number;
  fork?: boolean;
  private?: boolean;
  default_branch?: string;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
  manifests?: Record<string, string>; // e.g. requirements.txt, package.json, Dockerfile
  readmeSnippet?: string;
};

export type DiscoveredGitHubProject = {
  id: string;
  externalRepoId: number;
  title: string;
  description: string;
  repositoryUrl: string;
  homepageUrl?: string | null;
  primaryLanguage?: string | null;
  languages?: string[];
  technologies: string[];
  technologyFindings?: import("./tech-detector").TechnologyFinding[];
  aiMlCategories?: import("./tech-detector").AiMlProjectCategory[];
  projectClassification?: import("./tech-detector").RepositoryClassification;
  stars: number;
  forks?: number;
  isFork: boolean;
  isArchived?: boolean;
  isTemplate?: boolean;
  isEmpty?: boolean;
  diskUsage?: number;
  license?: string | null;
  isPrivate: boolean;
  sources: string[];
  status: "candidate";
  provenance: string;
  checksum: string;
  detectedManifests: string[];
  observedFiles?: string[];
  studentContributionStatus?: "UNVERIFIED" | "STUDENT_CONFIRMED" | "GITHUB_ATTRIBUTED";
  lastGitHubSyncAt?: string;
  lastGitHubPushAt?: string;
  analysisStage?: "metadata" | "manifest_verified" | "deep_inspected";
};

export type TechnologyConfig = {
  name: string;
  category: "Languages" | "AI & ML" | "GenAI" | "Data & Databases" | "Backend & APIs" | "DevOps & Cloud";
  regexes: RegExp[];
};

export const AI_ML_TECH_REGISTRY: TechnologyConfig[] = [
  // Languages
  { name: "Python", category: "Languages", regexes: [/\bpython\b/i] },
  { name: "SQL", category: "Languages", regexes: [/\bsql\b/i] },
  { name: "TypeScript", category: "Languages", regexes: [/\btypescript\b/i] },
  { name: "JavaScript", category: "Languages", regexes: [/\bjavascript\b/i] },

  // AI & ML Core
  { name: "NumPy", category: "AI & ML", regexes: [/\bnumpy\b/i] },
  { name: "Pandas", category: "AI & ML", regexes: [/\bpandas\b/i] },
  { name: "Matplotlib", category: "AI & ML", regexes: [/\bmatplotlib\b/i] },
  { name: "Scikit-Learn", category: "AI & ML", regexes: [/\b(scikit-learn|sklearn)\b/i] },
  { name: "PyTorch", category: "AI & ML", regexes: [/\bpytorch\b/i] },
  { name: "TensorFlow", category: "AI & ML", regexes: [/\btensorflow\b/i] },
  { name: "Keras", category: "AI & ML", regexes: [/\bkeras\b/i] },
  { name: "OpenCV", category: "AI & ML", regexes: [/\b(opencv|cv2)\b/i] },
  { name: "Computer Vision", category: "AI & ML", regexes: [/\b(computer vision|yolo|object detection|image segmentation)\b/i] },
  { name: "NLP", category: "AI & ML", regexes: [/\b(nlp|natural language processing|tokenization)\b/i] },
  { name: "MLflow", category: "AI & ML", regexes: [/\bmlflow\b/i] },
  { name: "DVC", category: "AI & ML", regexes: [/\bdvc\b/i] },

  // GenAI & LLMs
  { name: "Transformers", category: "GenAI", regexes: [/\btransformers\b/i] },
  { name: "Hugging Face", category: "GenAI", regexes: [/\bhuggingface\b/i] },
  { name: "LangChain", category: "GenAI", regexes: [/\blangchain\b/i] },
  { name: "LlamaIndex", category: "GenAI", regexes: [/\bllamaindex\b/i] },
  { name: "FAISS", category: "GenAI", regexes: [/\bfaiss\b/i] },
  { name: "Chroma", category: "GenAI", regexes: [/\bchroma(db)?\b/i] },
  { name: "Pinecone", category: "GenAI", regexes: [/\bpinecone\b/i] },
  { name: "RAG", category: "GenAI", regexes: [/\b(rag|retrieval augmented|vector search|semantic search)\b/i] },
  { name: "OpenAI", category: "GenAI", regexes: [/\bopenai\b/i] },

  // Backend & APIs
  { name: "FastAPI", category: "Backend & APIs", regexes: [/\bfastapi\b/i] },
  { name: "Flask", category: "Backend & APIs", regexes: [/\bflask\b/i] },
  { name: "Django", category: "Backend & APIs", regexes: [/\bdjango\b/i] },
  { name: "Streamlit", category: "Backend & APIs", regexes: [/\bstreamlit\b/i] },
  { name: "Gradio", category: "Backend & APIs", regexes: [/\bgradio\b/i] },

  // Data & Databases
  { name: "PostgreSQL", category: "Data & Databases", regexes: [/\b(postgresql|postgres)\b/i] },
  { name: "MongoDB", category: "Data & Databases", regexes: [/\bmongodb\b/i] },

  // DevOps & Cloud
  { name: "Docker", category: "DevOps & Cloud", regexes: [/\bdocker\b/i] },
  { name: "Kubernetes", category: "DevOps & Cloud", regexes: [/\b(kubernetes|k8s)\b/i] },
  { name: "AWS", category: "DevOps & Cloud", regexes: [/\baws\b/i] },
  { name: "Azure", category: "DevOps & Cloud", regexes: [/\bazure\b/i] },
  { name: "GCP", category: "DevOps & Cloud", regexes: [/\b(gcp|google cloud)\b/i] },
];

export function calculateRepoChecksum(repo: RawGitHubRepo): string {
  const payload = JSON.stringify({
    name: repo.name,
    description: repo.description,
    topics: repo.topics?.slice().sort(),
    language: repo.language,
    default_branch: repo.default_branch,
    pushed_at: repo.pushed_at,
    manifests: repo.manifests,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function hasRepoMeaningfullyChanged(
  oldChecksum: string | undefined,
  newChecksum: string
): boolean {
  if (!oldChecksum) return true;
  return oldChecksum !== newChecksum;
}

export function mapGitHubRepoToProject(repo: RawGitHubRepo): DiscoveredGitHubProject {
  const detectedManifests: string[] = [];
  if (repo.manifests) {
    detectedManifests.push(...Object.keys(repo.manifests));
  }

  // Scan text from metadata and manifests
  const manifestContent = repo.manifests
    ? Object.values(repo.manifests).join(" ")
    : "";

  const textToScan = [
    repo.name,
    repo.description || "",
    repo.language || "",
    ...(repo.topics || []),
    repo.readmeSnippet || "",
    manifestContent,
  ].join(" ");

  const detectedTechs = new Set<string>();

  if (repo.language) {
    detectedTechs.add(repo.language);
  }

  for (const tech of AI_ML_TECH_REGISTRY) {
    for (const rx of tech.regexes) {
      if (rx.test(textToScan)) {
        detectedTechs.add(tech.name);
        break;
      }
    }
  }

  const checksum = calculateRepoChecksum(repo);
  const isPrivate = Boolean(repo.private);

  // Determine progressive stage
  let analysisStage: "metadata" | "manifest_verified" | "deep_inspected" = "metadata";
  if (detectedManifests.length > 0 || repo.readmeSnippet) {
    analysisStage = "manifest_verified";
  }

  return {
    id: `gh_${repo.id}`,
    externalRepoId: repo.id,
    title: repo.name,
    description: repo.description || (isPrivate ? "Private repository" : "GitHub public repository"),
    repositoryUrl: repo.html_url,
    technologies: Array.from(detectedTechs),
    stars: repo.stargazers_count || 0,
    isFork: repo.fork || false,
    isPrivate,
    sources: ["github"],
    status: "candidate",
    provenance: `Detected from GitHub ${isPrivate ? "private" : "public"} repository. Discovered and candidate-mapped; personal contribution self-reported until reviewed.`,
    checksum,
    detectedManifests,
    analysisStage,
  };
}

export function mapGitHubReposToProjects(repos: RawGitHubRepo[]): DiscoveredGitHubProject[] {
  return repos
    .filter((repo) => !repo.fork && !repo.private) // public repositories only until private access has a separate consent flow
    .map(mapGitHubRepoToProject);
}
