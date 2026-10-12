/**
 * AI TATHASTU — SKILLS & EVIDENCE KNOWLEDGE CATALOG V2
 *
 * Provides a curated, grounded knowledge taxonomy for skills,
 * interconnections, contextual 3-4 line descriptions,
 * and dynamic relationship mapping based on student projects.
 */

export type SkillCategory = "Core" | "Specialized" | "Tooling" | "Theoretical";

export interface SkillCatalogEntry {
  canonicalName: string;
  category: SkillCategory;
  shortLabel?: string;
  iconType: string;
  badgeLabel: string;
  description: string;
  relatedTechnologies: string[];
  prerequisites?: string[];
  color: string;
  glowColor: string;
  bgLight: string;
  accentColor: string;
}

export type SkillRelationType =
  | "Foundational Knowledge"
  | "Prerequisite"
  | "Commonly Used Together"
  | "Shared Project Evidence"
  | "Framework Dependency"
  | "Related Academic Concept";

export interface SkillKnowledgeEdge {
  source: string;
  target: string;
  relationType: SkillRelationType;
  description: string;
  isProjectBacked?: boolean;
  projectTitle?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Curated Skill Catalog
// ─────────────────────────────────────────────────────────────────────────────

export const SKILL_CATALOG: Record<string, SkillCatalogEntry> = {
  "machine learning": {
    canonicalName: "Machine Learning",
    category: "Specialized",
    iconType: "brain",
    badgeLabel: "Specialized Domain",
    description:
      "Machine Learning involves statistical algorithms that learn patterns from empirical data without being explicitly programmed. It forms the technical backbone of predictive analytics, pattern recognition, and autonomous systems in modern AI development.",
    relatedTechnologies: ["Scikit-Learn", "PyTorch", "TensorFlow", "XGBoost", "Pandas", "NumPy"],
    color: "linear-gradient(135deg, #0284C7, #38BDF8)",
    glowColor: "rgba(2, 132, 199, 0.45)",
    bgLight: "rgba(2, 132, 199, 0.08)",
    accentColor: "#0284C7",
  },
  "artificial intelligence": {
    canonicalName: "Artificial Intelligence",
    category: "Specialized",
    iconType: "brain",
    badgeLabel: "Specialized Domain",
    description:
      "Artificial Intelligence encompasses computational systems capable of performing cognitive tasks such as reasoning, problem-solving, and perception. It integrates machine learning, neural architectures, and algorithmic heuristics to solve complex real-world challenges.",
    relatedTechnologies: ["Machine Learning", "Deep Learning", "NLP", "Computer Vision", "LLMs"],
    color: "linear-gradient(135deg, #7C3AED, #A855F7)",
    glowColor: "rgba(124, 58, 237, 0.45)",
    bgLight: "rgba(124, 58, 237, 0.08)",
    accentColor: "#7C3AED",
  },
  python: {
    canonicalName: "Python",
    category: "Core",
    iconType: "python",
    badgeLabel: "Core Language",
    description:
      "Python is a versatile programming language widely used in AI, machine learning, automation, and data analysis. It provides access to frameworks such as PyTorch, TensorFlow, and scikit-learn, enabling developers to build intelligent systems and process real-world data efficiently.",
    relatedTechnologies: ["PyTorch", "NumPy", "Pandas", "FastAPI", "TensorFlow", "Scikit-Learn"],
    color: "linear-gradient(135deg, #6366F1, #8B5CF6)",
    glowColor: "rgba(99, 102, 241, 0.45)",
    bgLight: "rgba(99, 102, 241, 0.08)",
    accentColor: "#6366F1",
  },
  javascript: {
    canonicalName: "JavaScript",
    category: "Core",
    iconType: "javascript",
    badgeLabel: "Core Language",
    description:
      "JavaScript is the foundational programming language of the modern web, enabling interactive user interfaces, dynamic application logic, and full-stack development. It powers front-end client rendering as well as event-driven server execution.",
    relatedTechnologies: ["React", "Node.js", "Express.js", "Next.js", "TypeScript"],
    color: "linear-gradient(135deg, #0284C7, #06B6D4)",
    glowColor: "rgba(6, 182, 212, 0.45)",
    bgLight: "rgba(6, 182, 212, 0.08)",
    accentColor: "#0284C7",
  },
  react: {
    canonicalName: "React",
    category: "Specialized",
    iconType: "react",
    badgeLabel: "Frontend Architecture",
    description:
      "React is a declarative, component-based library for crafting responsive user interfaces and modern web applications. It utilizes a virtual DOM and modular state management to power performant client-facing dashboards and AI interfaces.",
    relatedTechnologies: ["JavaScript", "TypeScript", "Next.js", "Tailwind CSS", "Redux"],
    color: "linear-gradient(135deg, #EC4899, #F43F5E)",
    glowColor: "rgba(236, 72, 153, 0.45)",
    bgLight: "rgba(236, 72, 153, 0.08)",
    accentColor: "#EC4899",
  },
  c: {
    canonicalName: "C",
    category: "Core",
    iconType: "code",
    badgeLabel: "Systems Language",
    description:
      "C is a foundational procedural systems programming language providing low-level memory management and hardware access. It is the basis of operating system kernels, device drivers, and high-performance computing runtimes.",
    relatedTechnologies: ["C++", "Data Structures", "Algorithms", "Operating Systems", "Linux"],
    color: "linear-gradient(135deg, #3B82F6, #60A5FA)",
    glowColor: "rgba(59, 130, 246, 0.45)",
    bgLight: "rgba(59, 130, 246, 0.08)",
    accentColor: "#3B82F6",
  },
  "c++": {
    canonicalName: "C++",
    category: "Core",
    iconType: "code",
    badgeLabel: "Systems Language",
    description:
      "C++ provides high-performance object-oriented and generic programming capabilities with zero-cost abstractions. It is extensively used in game engines, autonomous driving robotics, and latency-critical deep learning inference backends.",
    relatedTechnologies: ["C", "CUDA", "OpenCV", "Data Structures", "Algorithms"],
    color: "linear-gradient(135deg, #2563EB, #3B82F6)",
    glowColor: "rgba(37, 99, 235, 0.45)",
    bgLight: "rgba(37, 99, 235, 0.08)",
    accentColor: "#2563EB",
  },
  sql: {
    canonicalName: "SQL",
    category: "Tooling",
    iconType: "database",
    badgeLabel: "Database Standard",
    description:
      "SQL is the domain-specific language designed for managing and querying structured relational databases. It enables precise data aggregation, join operations, and schema manipulation essential for analytics pipelines and data-driven systems.",
    relatedTechnologies: ["PostgreSQL", "MySQL", "DuckDB", "SQLite", "Database Design"],
    color: "linear-gradient(135deg, #059669, #10B981)",
    glowColor: "rgba(16, 185, 129, 0.45)",
    bgLight: "rgba(16, 185, 129, 0.08)",
    accentColor: "#059669",
  },
  postgresql: {
    canonicalName: "PostgreSQL",
    category: "Tooling",
    iconType: "postgresql",
    badgeLabel: "Relational Engine",
    description:
      "PostgreSQL is a powerful, open-source object-relational database system known for reliability, robust query planning, and advanced features such as JSON indexing and pgvector extensions for vector search.",
    relatedTechnologies: ["SQL", "Supabase", "pgvector", "Docker", "Database Design"],
    color: "linear-gradient(135deg, #0D9488, #14B8A6)",
    glowColor: "rgba(13, 148, 136, 0.45)",
    bgLight: "rgba(13, 148, 136, 0.08)",
    accentColor: "#0D9488",
  },
  mongodb: {
    canonicalName: "MongoDB",
    category: "Tooling",
    iconType: "database",
    badgeLabel: "Document Store",
    description:
      "MongoDB is a leading NoSQL document database that stores operational data in flexible, JSON-like collections. It provides elastic horizontal scaling and schema flexibility for rapid web application iterations.",
    relatedTechnologies: ["Node.js", "Express.js", "JavaScript", "Database Design"],
    color: "linear-gradient(135deg, #16A34A, #22C55E)",
    glowColor: "rgba(22, 163, 74, 0.45)",
    bgLight: "rgba(22, 163, 74, 0.08)",
    accentColor: "#16A34A",
  },
  git: {
    canonicalName: "Git",
    category: "Tooling",
    iconType: "git",
    badgeLabel: "Version Control",
    description:
      "Git is a distributed version control system designed to track changes in source code during software engineering. It facilitates collaborative branching, peer code review, and atomic release histories.",
    relatedTechnologies: ["GitHub", "GitLab", "CI/CD", "Linux", "DevOps"],
    color: "linear-gradient(135deg, #2563EB, #60A5FA)",
    glowColor: "rgba(37, 99, 235, 0.45)",
    bgLight: "rgba(37, 99, 235, 0.08)",
    accentColor: "#2563EB",
  },
  github: {
    canonicalName: "GitHub",
    category: "Tooling",
    iconType: "github",
    badgeLabel: "Developer Platform",
    description:
      "GitHub is the premier cloud platform for Git repository hosting, open-source collaboration, pull-request code reviews, and GitHub Actions CI/CD automation. It serves as public provenance for engineering evidence.",
    relatedTechnologies: ["Git", "GitHub Actions", "Docker", "Markdown", "CI/CD"],
    color: "linear-gradient(135deg, #0F766E, #14B8A6)",
    glowColor: "rgba(15, 118, 110, 0.45)",
    bgLight: "rgba(15, 118, 110, 0.08)",
    accentColor: "#0F766E",
  },
  html: {
    canonicalName: "HTML",
    category: "Core",
    iconType: "code",
    badgeLabel: "Markup Standard",
    description:
      "HTML (HyperText Markup Language) is the standard markup language for structuring web pages and application viewports. It provides semantic elements and accessibility landmarks essential for clean DOM architectures.",
    relatedTechnologies: ["CSS", "JavaScript", "Web Development", "React"],
    color: "linear-gradient(135deg, #EA580C, #F97316)",
    glowColor: "rgba(234, 88, 12, 0.45)",
    bgLight: "rgba(234, 88, 12, 0.08)",
    accentColor: "#EA580C",
  },
  css: {
    canonicalName: "CSS",
    category: "Core",
    iconType: "code",
    badgeLabel: "Styling Language",
    description:
      "CSS (Cascading Style Sheets) controls visual presentation, typography, fluid layouts, and responsive animations across browsers. It enables tailored design systems and accessible user interfaces.",
    relatedTechnologies: ["HTML", "JavaScript", "Tailwind CSS", "Responsive Design"],
    color: "linear-gradient(135deg, #0284C7, #38BDF8)",
    glowColor: "rgba(2, 132, 199, 0.45)",
    bgLight: "rgba(2, 132, 199, 0.08)",
    accentColor: "#0284C7",
  },
  mathematics: {
    canonicalName: "Mathematics",
    category: "Theoretical",
    iconType: "math",
    badgeLabel: "Theoretical Science",
    description:
      "Mathematics forms the rigorous mathematical bedrock for computer science and artificial intelligence. Concepts in linear algebra, multivariable calculus, and discrete mathematics underpin neural weights, gradient optimization, and formal verification.",
    relatedTechnologies: ["Statistics", "Linear Algebra", "Calculus", "Algorithms", "Optimization"],
    color: "linear-gradient(135deg, #EA580C, #F59E0B)",
    glowColor: "rgba(234, 88, 12, 0.45)",
    bgLight: "rgba(234, 88, 12, 0.08)",
    accentColor: "#EA580C",
  },
  statistics: {
    canonicalName: "Statistics",
    category: "Theoretical",
    iconType: "math",
    badgeLabel: "Theoretical Science",
    description:
      "Statistics provides mathematical principles for quantifying uncertainty, hypothesis testing, probability distributions, and parameter estimation. It is indispensable for validating machine learning models and experimental ablations.",
    relatedTechnologies: ["Mathematics", "Data Analysis", "Probability", "Machine Learning"],
    color: "linear-gradient(135deg, #D97706, #FBBF24)",
    glowColor: "rgba(217, 119, 6, 0.45)",
    bgLight: "rgba(217, 119, 6, 0.08)",
    accentColor: "#D97706",
  },
  "data structures": {
    canonicalName: "Data Structures",
    category: "Theoretical",
    iconType: "dsa",
    badgeLabel: "Core Computer Science",
    description:
      "Data Structures dictate how computational data is organized, accessed, and modified in memory (e.g. hash tables, binary search trees, graphs, heaps). Mastering them ensures scalable software architecture and optimal time-space trade-offs.",
    relatedTechnologies: ["Algorithms", "C", "C++", "Python", "Mathematics"],
    color: "linear-gradient(135deg, #F59E0B, #FBBF24)",
    glowColor: "rgba(245, 158, 11, 0.45)",
    bgLight: "rgba(245, 158, 11, 0.08)",
    accentColor: "#F59E0B",
  },
  algorithms: {
    canonicalName: "Algorithms",
    category: "Theoretical",
    iconType: "dsa",
    badgeLabel: "Core Computer Science",
    description:
      "Algorithms are precise sequences of computational steps for solving defined problems such as sorting, graph traversal, and dynamic optimization. They determine the asymptotic efficiency and scalability of computational systems.",
    relatedTechnologies: ["Data Structures", "Mathematics", "Problem Solving", "C++"],
    color: "linear-gradient(135deg, #EA580C, #F59E0B)",
    glowColor: "rgba(234, 88, 12, 0.45)",
    bgLight: "rgba(234, 88, 12, 0.08)",
    accentColor: "#EA580C",
  },
  nlp: {
    canonicalName: "NLP",
    category: "Specialized",
    iconType: "nlp",
    badgeLabel: "Specialized Domain",
    description:
      "Natural Language Processing (NLP) bridges human language and machine understanding using statistical linguistics, sequence models, and transformer architectures. It powers semantic document search, language translation, and generative dialogue systems.",
    relatedTechnologies: ["Transformers", "LLMs", "PyTorch", "spaCy", "LangChain"],
    color: "linear-gradient(135deg, #E11D48, #FB7185)",
    glowColor: "rgba(225, 29, 72, 0.45)",
    bgLight: "rgba(225, 29, 72, 0.08)",
    accentColor: "#E11D48",
  },
  "deep learning": {
    canonicalName: "Deep Learning",
    category: "Specialized",
    iconType: "brain",
    badgeLabel: "Specialized Domain",
    description:
      "Deep Learning uses hierarchical artificial neural networks with multiple layers to learn complex representations from raw sensory data. It is the driving force behind modern breakthroughs in computer vision, speech recognition, and generative AI.",
    relatedTechnologies: ["PyTorch", "TensorFlow", "Neural Networks", "CUDA", "Transformers"],
    color: "linear-gradient(135deg, #7C3AED, #C084FC)",
    glowColor: "rgba(124, 58, 237, 0.45)",
    bgLight: "rgba(124, 58, 237, 0.08)",
    accentColor: "#7C3AED",
  },
  "computer vision": {
    canonicalName: "Computer Vision",
    category: "Specialized",
    iconType: "eye",
    badgeLabel: "Specialized Domain",
    description:
      "Computer Vision enables machines to extract meaningful information from digital images and video streams. It leverages convolutional neural networks, vision transformers, and image processing filters for detection, segmentation, and perception.",
    relatedTechnologies: ["OpenCV", "YOLOv8", "TorchVision", "Deep Learning", "MediaPipe"],
    color: "linear-gradient(135deg, #D97706, #F59E0B)",
    glowColor: "rgba(217, 119, 6, 0.45)",
    bgLight: "rgba(217, 119, 6, 0.08)",
    accentColor: "#D97706",
  },
  fastapi: {
    canonicalName: "FastAPI",
    category: "Tooling",
    iconType: "code",
    badgeLabel: "API Framework",
    description:
      "FastAPI is a modern, fast web framework for building REST APIs with Python 3 based on standard Python type hints. It offers asynchronous support and automatic OpenAPI documentation, making it the industry choice for AI model deployment.",
    relatedTechnologies: ["Python", "Uvicorn", "Pydantic", "Docker", "RESTful APIs"],
    color: "linear-gradient(135deg, #059669, #34D399)",
    glowColor: "rgba(5, 150, 105, 0.45)",
    bgLight: "rgba(5, 150, 105, 0.08)",
    accentColor: "#059669",
  },
  docker: {
    canonicalName: "Docker",
    category: "Tooling",
    iconType: "docker",
    badgeLabel: "DevOps Tooling",
    description:
      "Docker is a containerization platform that packages applications and their complete dependency graphs into lightweight, isolated containers. It eliminates environment discrepancies between local development and production cloud clusters.",
    relatedTechnologies: ["Kubernetes", "Git", "Linux", "CI/CD", "Cloud"],
    color: "linear-gradient(135deg, #0284C7, #06B6D4)",
    glowColor: "rgba(2, 132, 199, 0.45)",
    bgLight: "rgba(2, 132, 199, 0.08)",
    accentColor: "#0284C7",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base Edges (Taxonomy-driven)
// ─────────────────────────────────────────────────────────────────────────────

export const CANONICAL_KNOWLEDGE_EDGES: Array<{
  source: string;
  target: string;
  relationType: SkillRelationType;
  description: string;
}> = [
  {
    source: "python",
    target: "machine learning",
    relationType: "Foundational Knowledge",
    description: "Python is the primary language used to implement machine learning pipelines.",
  },
  {
    source: "python",
    target: "deep learning",
    relationType: "Foundational Knowledge",
    description: "Deep learning frameworks like PyTorch execute primarily in Python.",
  },
  {
    source: "python",
    target: "fastapi",
    relationType: "Framework Dependency",
    description: "FastAPI is built natively on modern asynchronous Python.",
  },
  {
    source: "python",
    target: "sql",
    relationType: "Commonly Used Together",
    description: "Python data scripts query and transform relational SQL databases.",
  },
  {
    source: "machine learning",
    target: "artificial intelligence",
    relationType: "Related Academic Concept",
    description: "Machine learning provides empirical algorithmic methods for artificial intelligence.",
  },
  {
    source: "machine learning",
    target: "deep learning",
    relationType: "Foundational Knowledge",
    description: "Deep learning is a specialized representation-learning branch of machine learning.",
  },
  {
    source: "machine learning",
    target: "nlp",
    relationType: "Related Academic Concept",
    description: "Modern NLP leverages machine learning algorithms for language understanding.",
  },
  {
    source: "machine learning",
    target: "computer vision",
    relationType: "Related Academic Concept",
    description: "Computer vision systems rely on machine learning for visual feature classification.",
  },
  {
    source: "machine learning",
    target: "mathematics",
    relationType: "Prerequisite",
    description: "Linear algebra and calculus define model weights and optimization functions.",
  },
  {
    source: "machine learning",
    target: "statistics",
    relationType: "Prerequisite",
    description: "Probability distributions and statistical tests validate machine learning models.",
  },
  {
    source: "machine learning",
    target: "data structures",
    relationType: "Commonly Used Together",
    description: "Efficient data structures support matrix operations and model feature pipelines.",
  },
  {
    source: "mathematics",
    target: "statistics",
    relationType: "Related Academic Concept",
    description: "Statistics is built upon probability theory and mathematical foundations.",
  },
  {
    source: "mathematics",
    target: "data structures",
    relationType: "Related Academic Concept",
    description: "Discrete math and graph theory form the theoretical core of data structures.",
  },
  {
    source: "data structures",
    target: "algorithms",
    relationType: "Foundational Knowledge",
    description: "Algorithms operate directly on and manipulate underlying data structures.",
  },
  {
    source: "data structures",
    target: "c",
    relationType: "Commonly Used Together",
    description: "C is traditionally used to implement foundational pointer-based data structures.",
  },
  {
    source: "javascript",
    target: "react",
    relationType: "Framework Dependency",
    description: "React is a JavaScript library built for declarative component rendering.",
  },
  {
    source: "javascript",
    target: "html",
    relationType: "Commonly Used Together",
    description: "JavaScript interacts with and manipulates the HTML Document Object Model.",
  },
  {
    source: "html",
    target: "css",
    relationType: "Commonly Used Together",
    description: "HTML structures document contents while CSS governs styling and layout.",
  },
  {
    source: "css",
    target: "react",
    relationType: "Commonly Used Together",
    description: "React components encapsulate CSS styling for modular user interfaces.",
  },
  {
    source: "git",
    target: "github",
    relationType: "Commonly Used Together",
    description: "Git commands interface with GitHub cloud repositories for collaboration.",
  },
  {
    source: "git",
    target: "docker",
    relationType: "Commonly Used Together",
    description: "Git repositories store reproducible Dockerfiles for containerized CI builds.",
  },
  {
    source: "sql",
    target: "postgresql",
    relationType: "Framework Dependency",
    description: "PostgreSQL is an advanced open-source implementation of SQL database standards.",
  },
  {
    source: "sql",
    target: "mongodb",
    relationType: "Related Academic Concept",
    description: "Relational SQL systems contrast with document-based MongoDB storage patterns.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

export function getSkillCatalogEntry(name: string): SkillCatalogEntry {
  const normalized = name.toLowerCase().trim();
  if (SKILL_CATALOG[normalized]) {
    return SKILL_CATALOG[normalized];
  }

  // Intelligent fallback for uncommon/custom skills
  let category: SkillCategory = "Core";
  let iconType = "code";

  if (/math|stat|calculus|probability|algebra/i.test(normalized)) {
    category = "Theoretical";
    iconType = "math";
  } else if (/git|docker|sql|postgres|mongo|linux|aws|azure|cloud|tool/i.test(normalized)) {
    category = "Tooling";
    iconType = "tool";
  } else if (/ai|ml|learning|nlp|vision|genai|llm|deep|neural|rag/i.test(normalized)) {
    category = "Specialized";
    iconType = "brain";
  }

  const titleCased = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    canonicalName: titleCased,
    category,
    iconType,
    badgeLabel: `${category} Competency`,
    description: `${titleCased} is a recognized technical competency in modern computing. It demonstrates practical implementation skills and supports complex system development across academic and industry projects.`,
    relatedTechnologies: [],
    color: "linear-gradient(135deg, #4F46E5, #6366F1)",
    glowColor: "rgba(79, 70, 229, 0.4)",
    bgLight: "rgba(79, 70, 229, 0.08)",
    accentColor: "#4F46E5",
  };
}

export function buildSkillGraphEdges(
  studentSkillNames: string[],
  studentProjects: Array<{ title: string; technologies?: string[] }> = []
): SkillKnowledgeEdge[] {
  const normMap = new Map<string, string>();
  for (const s of studentSkillNames) {
    normMap.set(s.toLowerCase().trim(), s);
  }

  const edgeSet = new Set<string>();
  const results: SkillKnowledgeEdge[] = [];

  // 1. Check canonical knowledge edges between student skills
  for (const edge of CANONICAL_KNOWLEDGE_EDGES) {
    const src = normMap.get(edge.source);
    const tgt = normMap.get(edge.target);
    if (src && tgt && src !== tgt) {
      const key = [src.toLowerCase(), tgt.toLowerCase()].sort().join("<->");
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        results.push({
          source: src,
          target: tgt,
          relationType: edge.relationType,
          description: edge.description,
          isProjectBacked: false,
        });
      }
    }
  }

  // 2. Discover student project-backed co-occurrence edges
  for (const proj of studentProjects) {
    const techs = (proj.technologies || [])
      .map((t) => normMap.get(t.toLowerCase().trim()))
      .filter((t): t is string => Boolean(t));

    for (let i = 0; i < techs.length; i++) {
      for (let j = i + 1; j < techs.length; j++) {
        const s1 = techs[i];
        const s2 = techs[j];
        if (s1 === s2) continue;
        const key = [s1.toLowerCase(), s2.toLowerCase()].sort().join("<->");

        // If edge already exists from knowledge base, enrich it with project evidence
        const existing = results.find(
          (e) =>
            (e.source === s1 && e.target === s2) ||
            (e.source === s2 && e.target === s1)
        );

        if (existing) {
          existing.isProjectBacked = true;
          existing.projectTitle = proj.title;
        } else if (!edgeSet.has(key)) {
          edgeSet.add(key);
          results.push({
            source: s1,
            target: s2,
            relationType: "Shared Project Evidence",
            description: `Applied together in confirmed project: ${proj.title}`,
            isProjectBacked: true,
            projectTitle: proj.title,
          });
        }
      }
    }
  }

  return results;
}
