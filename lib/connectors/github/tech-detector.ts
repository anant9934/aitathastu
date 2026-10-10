/**
 * AI TATHASTU — ADVANCED GITHUB TECHNOLOGY & AI/ML DETECTION ENGINE V4.3
 *
 * Deterministic technology detection from repository manifests, source files,
 * language statistics, and configuration files.
 *
 * Architectural Guarantees:
 * 1. Strict evidence provenance: MANIFEST_DECLARED, CONFIGURATION_OBSERVED,
 *    SOURCE_IMPORTED, README_DOCUMENTED, STUDENT_CONFIRMED.
 * 2. Never invents proficiency scores or false claims of mastery.
 * 3. Deterministic AI/ML classification into canonical subdomains.
 * 4. Prompt-injection defense: README text treated as untrusted data.
 */

export type TechnologyEvidenceProvenance =
  | "MANIFEST_DECLARED"
  | "CONFIGURATION_OBSERVED"
  | "SOURCE_IMPORTED"
  | "README_DOCUMENTED"
  | "STUDENT_CONFIRMED"
  | "UNKNOWN";

export type TechCategory =
  | "Languages"
  | "Frontend"
  | "Backend"
  | "Databases"
  | "AI & ML"
  | "GenAI"
  | "DevOps & Cloud";

export interface TechnologyFinding {
  name: string;
  category: TechCategory;
  provenance: TechnologyEvidenceProvenance;
  sourceFile?: string;
  confidence: number;
}

export type AiMlProjectCategory =
  | "Generative AI & LLMs"
  | "RAG & Retrieval"
  | "AI Agents & Orchestration"
  | "Computer Vision"
  | "Natural Language Processing"
  | "Deep Learning"
  | "Machine Learning"
  | "MLOps & Pipeline Engineering"
  | "Data Science & Analytics"
  | "Full-Stack Web & Applications"
  | "Systems & Infrastructure"
  | "Non-AI/ML Software"
  | "UNKNOWN";

interface TechDefinition {
  name: string;
  category: TechCategory;
  manifestPackages?: string[]; // exact or normalized package names
  configFiles?: RegExp[];      // file pattern matches
  sourcePatterns?: RegExp[];   // import / code patterns
  readmeKeywords?: RegExp[];   // documented keywords
}

export const TECHNOLOGY_REGISTRY: TechDefinition[] = [
  // --- Languages ---
  { name: "Python", category: "Languages", manifestPackages: ["python"], configFiles: [/requirements\.txt$/i, /pyproject\.toml$/i, /pipfile$/i], readmeKeywords: [/\bpython\b/i] },
  { name: "TypeScript", category: "Languages", manifestPackages: ["typescript", "ts-node", "tsx"], configFiles: [/tsconfig\.json$/i], readmeKeywords: [/\btypescript\b/i] },
  { name: "JavaScript", category: "Languages", manifestPackages: ["javascript"], configFiles: [/package\.json$/i], readmeKeywords: [/\bjavascript\b/i] },
  { name: "SQL", category: "Languages", manifestPackages: ["sql"], configFiles: [/\.sql$/i], readmeKeywords: [/\bsql\b/i] },
  { name: "Go", category: "Languages", manifestPackages: ["go"], configFiles: [/go\.mod$/i], readmeKeywords: [/\bgolang\b/i, /\bgo\b/i] },
  { name: "Rust", category: "Languages", manifestPackages: ["rust"], configFiles: [/cargo\.toml$/i], readmeKeywords: [/\brust\b/i] },
  { name: "C++", category: "Languages", manifestPackages: ["cpp"], configFiles: [/cmakelists\.txt$/i, /\.cpp$/i], readmeKeywords: [/\bc\+\+\b/i] },
  { name: "Java", category: "Languages", manifestPackages: ["java"], configFiles: [/pom\.xml$/i, /build\.gradle$/i], readmeKeywords: [/\bjava\b/i] },

  // --- AI & ML Core ---
  { name: "PyTorch", category: "AI & ML", manifestPackages: ["torch", "torchvision", "torchaudio", "pytorch-lightning"], readmeKeywords: [/\bpytorch\b/i] },
  { name: "TensorFlow", category: "AI & ML", manifestPackages: ["tensorflow", "tensorflow-gpu", "tf-nightly"], readmeKeywords: [/\btensorflow\b/i] },
  { name: "Keras", category: "AI & ML", manifestPackages: ["keras"], readmeKeywords: [/\bkeras\b/i] },
  { name: "Scikit-Learn", category: "AI & ML", manifestPackages: ["scikit-learn", "sklearn"], readmeKeywords: [/\bscikit-learn\b/i, /\bsklearn\b/i] },
  { name: "XGBoost", category: "AI & ML", manifestPackages: ["xgboost"], readmeKeywords: [/\bxgboost\b/i] },
  { name: "LightGBM", category: "AI & ML", manifestPackages: ["lightgbm"], readmeKeywords: [/\blightgbm\b/i] },
  { name: "OpenCV", category: "AI & ML", manifestPackages: ["opencv-python", "opencv-python-headless", "cv2"], readmeKeywords: [/\bopencv\b/i] },
  { name: "Pandas", category: "AI & ML", manifestPackages: ["pandas"], readmeKeywords: [/\bpandas\b/i] },
  { name: "NumPy", category: "AI & ML", manifestPackages: ["numpy"], readmeKeywords: [/\bnumpy\b/i] },
  { name: "SciPy", category: "AI & ML", manifestPackages: ["scipy"], readmeKeywords: [/\bscipy\b/i] },
  { name: "ONNX", category: "AI & ML", manifestPackages: ["onnx", "onnxruntime"], readmeKeywords: [/\bonnx\b/i] },

  // --- GenAI & LLMs ---
  { name: "Transformers", category: "GenAI", manifestPackages: ["transformers", "@huggingface/transformers"], readmeKeywords: [/\btransformers\b/i] },
  { name: "Hugging Face", category: "GenAI", manifestPackages: ["huggingface_hub", "datasets", "accelerate", "diffusers"], readmeKeywords: [/\bhugging\s*face\b/i] },
  { name: "LangChain", category: "GenAI", manifestPackages: ["langchain", "langchain-core", "langchain-community", "@langchain/core"], readmeKeywords: [/\blangchain\b/i] },
  { name: "LangGraph", category: "GenAI", manifestPackages: ["langgraph", "@langchain/langgraph"], readmeKeywords: [/\blanggraph\b/i] },
  { name: "LlamaIndex", category: "GenAI", manifestPackages: ["llama-index", "llamaindex"], readmeKeywords: [/\bllama-?index\b/i] },
  { name: "OpenAI API", category: "GenAI", manifestPackages: ["openai"], readmeKeywords: [/\bopenai\b/i, /\bgpt-[34o]\b/i] },
  { name: "Anthropic API", category: "GenAI", manifestPackages: ["anthropic"], readmeKeywords: [/\banthropic\b/i, /\bclaude\b/i] },
  { name: "vLLM", category: "GenAI", manifestPackages: ["vllm"], readmeKeywords: [/\bvllm\b/i] },

  // --- Vector DBs & RAG ---
  { name: "ChromaDB", category: "GenAI", manifestPackages: ["chromadb", "chroma"], readmeKeywords: [/\bchromadb?\b/i] },
  { name: "FAISS", category: "GenAI", manifestPackages: ["faiss-cpu", "faiss-gpu", "faiss"], readmeKeywords: [/\bfaiss\b/i] },
  { name: "Pinecone", category: "GenAI", manifestPackages: ["pinecone-client", "@pinecone-database/pinecone"], readmeKeywords: [/\bpinecone\b/i] },
  { name: "Qdrant", category: "GenAI", manifestPackages: ["qdrant-client", "@qdrant/js-client-rest"], readmeKeywords: [/\bqdrant\b/i] },
  { name: "Weaviate", category: "GenAI", manifestPackages: ["weaviate-client"], readmeKeywords: [/\bweaviate\b/i] },

  // --- MLOps ---
  { name: "MLflow", category: "AI & ML", manifestPackages: ["mlflow"], readmeKeywords: [/\bmlflow\b/i] },
  { name: "DVC", category: "AI & ML", manifestPackages: ["dvc"], configFiles: [/\.dvc$/i], readmeKeywords: [/\bdvc\b/i] },
  { name: "Weights & Biases", category: "AI & ML", manifestPackages: ["wandb"], readmeKeywords: [/\bwandb\b/i, /\bweights & biases\b/i] },

  // --- Frontend ---
  { name: "React", category: "Frontend", manifestPackages: ["react", "react-dom"], readmeKeywords: [/\breact\b/i] },
  { name: "Next.js", category: "Frontend", manifestPackages: ["next"], configFiles: [/next\.config/i], readmeKeywords: [/\bnext\.?js\b/i] },
  { name: "Vue", category: "Frontend", manifestPackages: ["vue"], readmeKeywords: [/\bvue(\.js)?\b/i] },
  { name: "Angular", category: "Frontend", manifestPackages: ["@angular/core"], readmeKeywords: [/\bangular\b/i] },
  { name: "Tailwind CSS", category: "Frontend", manifestPackages: ["tailwindcss", "@tailwindcss/postcss"], configFiles: [/tailwind\.config/i], readmeKeywords: [/\btailwind\b/i] },

  // --- Backend & APIs ---
  { name: "FastAPI", category: "Backend", manifestPackages: ["fastapi", "uvicorn"], readmeKeywords: [/\bfastapi\b/i] },
  { name: "Django", category: "Backend", manifestPackages: ["django"], readmeKeywords: [/\bdjango\b/i] },
  { name: "Flask", category: "Backend", manifestPackages: ["flask"], readmeKeywords: [/\bflask\b/i] },
  { name: "Express", category: "Backend", manifestPackages: ["express"], readmeKeywords: [/\bexpress(\.js)?\b/i] },
  { name: "NestJS", category: "Backend", manifestPackages: ["@nestjs/core"], readmeKeywords: [/\bnestjs\b/i] },
  { name: "Streamlit", category: "Backend", manifestPackages: ["streamlit"], readmeKeywords: [/\bstreamlit\b/i] },
  { name: "Gradio", category: "Backend", manifestPackages: ["gradio"], readmeKeywords: [/\bgradio\b/i] },

  // --- Databases ---
  { name: "PostgreSQL", category: "Databases", manifestPackages: ["pg", "postgres", "psycopg2", "psycopg2-binary", "asyncpg"], readmeKeywords: [/\bpostgre(sql)?\b/i] },
  { name: "MongoDB", category: "Databases", manifestPackages: ["mongodb", "mongoose", "pymongo"], readmeKeywords: [/\bmongodb\b/i] },
  { name: "Redis", category: "Databases", manifestPackages: ["redis", "ioredis"], readmeKeywords: [/\bredis\b/i] },
  { name: "SQLite", category: "Databases", manifestPackages: ["sqlite3", "better-sqlite3"], readmeKeywords: [/\bsqlite\b/i] },

  // --- DevOps & Cloud ---
  { name: "Docker", category: "DevOps & Cloud", configFiles: [/dockerfile$/i, /docker-compose/i], readmeKeywords: [/\bdocker\b/i] },
  { name: "CUDA", category: "DevOps & Cloud", manifestPackages: ["cuda", "pycuda"], readmeKeywords: [/\bcuda\b/i] },
  { name: "Kubernetes", category: "DevOps & Cloud", configFiles: [/\bk8s\b/i, /helm/i], readmeKeywords: [/\bkubernetes\b/i, /\bk8s\b/i] },
  { name: "GitHub Actions", category: "DevOps & Cloud", configFiles: [/\.github\/workflows/i], readmeKeywords: [/\bgithub actions\b/i] },
  { name: "Vercel", category: "DevOps & Cloud", configFiles: [/vercel\.json$/i], readmeKeywords: [/\bvercel\b/i] },
];

/**
 * Parses package names declared in common repository manifest files.
 */
export function extractManifestPackages(filename: string, content: string): string[] {
  const pkgs: string[] = [];
  const lowerName = filename.toLowerCase();

  try {
    if (lowerName === "package.json") {
      const parsed = JSON.parse(content);
      const allDeps = {
        ...(parsed.dependencies || {}),
        ...(parsed.devDependencies || {}),
      };
      pkgs.push(...Object.keys(allDeps).map((k) => k.toLowerCase()));
    } else if (lowerName === "requirements.txt" || lowerName.endsWith("requirements.txt")) {
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
        const nameMatch = trimmed.match(/^([a-zA-Z0-9_\-]+)/);
        if (nameMatch) {
          pkgs.push(nameMatch[1].toLowerCase());
        }
      }
    } else if (lowerName === "pyproject.toml") {
      // Poetry & PEP 621 dependencies
      const depMatches = [...content.matchAll(/([a-zA-Z0-9_\-]+)\s*=\s*["'{]/g)];
      for (const dm of depMatches) {
        const pkg = dm[1].toLowerCase();
        if (pkg !== "name" && pkg !== "version" && pkg !== "description") {
          pkgs.push(pkg);
        }
      }
      const arrayMatches = [...content.matchAll(/["']([a-zA-Z0-9_\-]+)(?:[><=~^].*?)?["']/g)];
      for (const am of arrayMatches) {
        pkgs.push(am[1].toLowerCase());
      }
    } else if (lowerName === "pipfile") {
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        const m = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*=/);
        if (m) pkgs.push(m[1].toLowerCase());
      }
    } else if (lowerName === "cargo.toml") {
      const depMatches = [...content.matchAll(/([a-zA-Z0-9_\-]+)\s*=\s*["'{]/g)];
      for (const dm of depMatches) {
        pkgs.push(dm[1].toLowerCase());
      }
    } else if (lowerName === "go.mod") {
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        const m = trimmed.match(/^(?:require\s+)?([a-zA-Z0-9.\-_/]+)\s+v/);
        if (m) pkgs.push(m[1].toLowerCase());
      }
    } else if (lowerName === "dockerfile" || lowerName.endsWith("dockerfile")) {
      if (/cuda/i.test(content)) pkgs.push("cuda");
      if (/python/i.test(content)) pkgs.push("python");
    }
  } catch {
    // Malformed manifest non-fatal
  }

  return Array.from(new Set(pkgs));
}

/**
 * Detects technologies in a repository by inspecting manifests, configuration files,
 * language statistics, and sanitized README documentation.
 */
export function detectRepositoryTechnologies(params: {
  manifests?: Record<string, string>; // filename -> content
  languages?: Record<string, number>; // language -> byteCount
  observedFiles?: string[];
  readmeText?: string | null;
  primaryLanguage?: string | null;
}): TechnologyFinding[] {
  const findings = new Map<string, TechnologyFinding>();

  const allManifestPkgs = new Map<string, string>(); // pkg -> filename
  if (params.manifests) {
    for (const [fname, content] of Object.entries(params.manifests)) {
      const pkgs = extractManifestPackages(fname, content);
      for (const p of pkgs) {
        if (!allManifestPkgs.has(p)) {
          allManifestPkgs.set(p, fname);
        }
      }
    }
  }

  const observedFiles = [
    ...(params.observedFiles || []),
    ...Object.keys(params.manifests || {}),
  ].map((f) => f.toLowerCase());
  const sanitizedReadme = (params.readmeText || "").toLowerCase();

  // 1. Check languages from GitHub language stats (Tier 1: SOURCE_IMPORTED)
  if (params.languages) {
    for (const [lang] of Object.entries(params.languages)) {
      const tech = TECHNOLOGY_REGISTRY.find(
        (t) => t.category === "Languages" && t.name.toLowerCase() === lang.toLowerCase()
      );
      if (tech) {
        findings.set(tech.name, {
          name: tech.name,
          category: tech.category,
          provenance: "SOURCE_IMPORTED",
          confidence: 0.85,
        });
      }
    }
  }

  if (params.primaryLanguage && !findings.has(params.primaryLanguage)) {
    const tech = TECHNOLOGY_REGISTRY.find(
      (t) => t.category === "Languages" && t.name.toLowerCase() === params.primaryLanguage?.toLowerCase()
    );
    if (tech) {
      findings.set(tech.name, {
        name: tech.name,
        category: tech.category,
        provenance: "SOURCE_IMPORTED",
        confidence: 0.85,
      });
    }
  }

  // 2. Check manifest dependencies (Tier 2: MANIFEST_DECLARED)
  for (const tech of TECHNOLOGY_REGISTRY) {
    if (tech.manifestPackages) {
      for (const pkg of tech.manifestPackages) {
        if (allManifestPkgs.has(pkg)) {
          const sourceFile = allManifestPkgs.get(pkg);
          findings.set(tech.name, {
            name: tech.name,
            category: tech.category,
            provenance: "MANIFEST_DECLARED",
            sourceFile,
            confidence: 0.95,
          });
          break;
        }
      }
    }

    // 3. Check configuration files (Tier 3: CONFIGURATION_OBSERVED)
    if (tech.configFiles && !findings.has(tech.name)) {
      for (const rx of tech.configFiles) {
        const matchedFile = observedFiles.find((f) => rx.test(f));
        if (matchedFile) {
          findings.set(tech.name, {
            name: tech.name,
            category: tech.category,
            provenance: "CONFIGURATION_OBSERVED",
            sourceFile: matchedFile,
            confidence: 0.90,
          });
          break;
        }
      }
    }

    // 4. Check README documentation (Tier 4: README_DOCUMENTED)
    if (tech.readmeKeywords && !findings.has(tech.name) && sanitizedReadme) {
      for (const kw of tech.readmeKeywords) {
        if (kw.test(sanitizedReadme)) {
          findings.set(tech.name, {
            name: tech.name,
            category: tech.category,
            provenance: "README_DOCUMENTED",
            sourceFile: "README.md",
            confidence: 0.65,
          });
          break;
        }
      }
    }
  }

  return Array.from(findings.values());
}

/**
 * Deterministically classifies a repository into one or more AI/ML or Software categories.
 * A project may belong to multiple subdomains (e.g., Computer Vision + Deep Learning).
 */
export function classifyRepositoryAiMl(
  findings: TechnologyFinding[],
  topics: string[] = [],
  description: string = ""
): AiMlProjectCategory[] {
  const categories = new Set<AiMlProjectCategory>();
  const techNames = new Set(findings.map((f) => f.name.toLowerCase()));
  const topicSet = new Set(topics.map((t) => t.toLowerCase()));
  const descLower = description.toLowerCase();

  const hasTopic = (...t: string[]) => t.some((item) => topicSet.has(item) || descLower.includes(item));

  // 1. Generative AI & LLMs
  if (
    techNames.has("transformers") ||
    techNames.has("hugging face") ||
    techNames.has("openai api") ||
    techNames.has("anthropic api") ||
    techNames.has("vllm") ||
    hasTopic("llm", "generative-ai", "gpt", "rag", "prompt-engineering")
  ) {
    categories.add("Generative AI & LLMs");
  }

  // 2. RAG & Semantic Retrieval
  if (
    techNames.has("chroma") ||
    techNames.has("faiss") ||
    techNames.has("pinecone") ||
    techNames.has("qdrant") ||
    techNames.has("weaviate") ||
    techNames.has("llamaindex") ||
    hasTopic("rag", "retrieval-augmented-generation", "vector-database", "semantic-search")
  ) {
    categories.add("RAG & Retrieval");
  }

  // 3. AI Agents & Orchestration
  if (
    techNames.has("langchain") ||
    techNames.has("langgraph") ||
    hasTopic("agent", "ai-agents", "crewai", "autogen")
  ) {
    categories.add("AI Agents & Orchestration");
  }

  // 4. Computer Vision
  if (
    techNames.has("opencv") ||
    hasTopic("computer-vision", "opencv", "yolo", "object-detection", "image-segmentation")
  ) {
    categories.add("Computer Vision");
  }

  // 5. Deep Learning
  if (
    techNames.has("pytorch") ||
    techNames.has("tensorflow") ||
    techNames.has("keras") ||
    hasTopic("deep-learning", "neural-network", "cnn", "rnn", "lstm")
  ) {
    categories.add("Deep Learning");
  }

  // 6. Classical Machine Learning
  if (
    techNames.has("scikit-learn") ||
    techNames.has("xgboost") ||
    techNames.has("lightgbm") ||
    hasTopic("machine-learning", "scikit-learn", "classification", "regression", "random-forest")
  ) {
    categories.add("Machine Learning");
  }

  // 7. MLOps & Pipelines
  if (
    techNames.has("mlflow") ||
    techNames.has("dvc") ||
    techNames.has("weights & biases") ||
    techNames.has("onnx") ||
    hasTopic("mlops", "model-monitoring", "pipeline")
  ) {
    categories.add("MLOps & Pipeline Engineering");
  }

  // 8. Data Science & Analytics
  if (
    (techNames.has("pandas") && techNames.has("numpy")) ||
    hasTopic("data-science", "eda", "data-analysis")
  ) {
    categories.add("Data Science & Analytics");
  }

  // 9. Full-Stack Web & Applications
  if (
    techNames.has("react") ||
    techNames.has("next.js") ||
    techNames.has("fastapi") ||
    techNames.has("django") ||
    techNames.has("flask") ||
    techNames.has("express") ||
    techNames.has("streamlit") ||
    techNames.has("gradio")
  ) {
    categories.add("Full-Stack Web & Applications");
  }

  // 10. Systems & Infrastructure
  if (
    techNames.has("docker") ||
    techNames.has("kubernetes") ||
    techNames.has("github actions") ||
    techNames.has("go") ||
    techNames.has("rust") ||
    techNames.has("c++")
  ) {
    categories.add("Systems & Infrastructure");
  }

  // 11. Non-AI/ML Software baseline (if no AI/ML signals are detected)
  const hasAiMlSignals =
    categories.has("Generative AI & LLMs") ||
    categories.has("RAG & Retrieval") ||
    categories.has("AI Agents & Orchestration") ||
    categories.has("Computer Vision") ||
    categories.has("Deep Learning") ||
    categories.has("Machine Learning") ||
    categories.has("MLOps & Pipeline Engineering") ||
    categories.has("Data Science & Analytics");

  if (!hasAiMlSignals) {
    categories.add("Non-AI/ML Software");
  }

  return Array.from(categories);
}
