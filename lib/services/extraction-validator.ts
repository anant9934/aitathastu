/**
 * AI TATHASTU — RESUME CLAIM VALIDATOR
 *
 * Sanity checks on structured resume output before a skill is offered for review:
 * 1. Grounding: the evidence line must mention the skill.
 * 2. Negation ("I have not used PyTorch") and aspiration ("want to learn X")
 *    in the evidence line disqualify the claim.
 * 3. Coursework-only mentions are kept with lower confidence.
 * Skill names are canonicalised (e.g. "sklearn" -> "Scikit-learn").
 */

export interface ValidationResult {
  valid: boolean;
  confidence: number;
  flag?: "negation" | "aspiration" | "coursework_only" | "missing_evidence" | "unsupported";
  reason?: string;
  normalizedValue: string;
}

const NEGATION_PATTERNS = [
  /\b(?:have\s+not|haven't|never|not\s+used|no\s+experience\s+with|no\s+prior\s+experience|no\s+commercial\s+experience|haven't\s+worked\s+with|lack\s+of|unfamiliar\s+with|did\s+not\s+use|didn't\s+use)\b/i,
  /\b(?:no\s+knowledge\s+of|without\s+using|excluding|excluded\s+.*?\s+from|not\s+proficient(?:\s+in|\s+with)?|no\s+proficiency(?:\s+in)?|not\s+experienced(?:\s+in)?|unskilled(?:\s+in)?)\b/i,
];

const ASPIRATION_PATTERNS = [
  /\b(?:want\s+to\s+learn|hoping\s+to\s+learn|planning\s+to\s+learn|planning\s+to\s+master|looking\s+forward\s+to\s+learn|aspiring\s+to|aiming\s+for|aiming\s+to|interested\s+in\s+learning|eager\s+to\s+explore)\b/i,
  /\b(?:future\s+goal|will\s+learn|would\s+like\s+to\s+master|aiming\s+to\s+build|hope\s+to\s+explore)\b/i,
];

const COURSEWORK_PATTERNS = [
  /\b(?:enrolled\s+in|theory\s+course|curriculum\s+subject|syllabus|lecture\s+topic|lecture\s+on|introductory\s+lecture|attended\s+seminar\s+on|lab\s+exercises\s+in)\b/i,
];

const TECH_NORMALIZATION: Record<string, string> = {
  "pytorch": "PyTorch",
  "python": "Python",
  "tensorflow": "TensorFlow",
  "tf": "TensorFlow",
  "scikit-learn": "Scikit-learn",
  "sklearn": "Scikit-learn",
  "typescript": "TypeScript",
  "ts": "TypeScript",
  "javascript": "JavaScript",
  "js": "JavaScript",
  "huggingface": "Hugging Face",
  "hugging face": "Hugging Face",
  "langchain": "LangChain",
  "llamaindex": "LlamaIndex",
  "llama-index": "LlamaIndex",
  "docker": "Docker",
  "fastapi": "FastAPI",
  "react": "React",
  "nextjs": "Next.js",
  "next.js": "Next.js",
  "postgresql": "PostgreSQL",
  "postgres": "PostgreSQL",
  "kubernetes": "Kubernetes",
  "k8s": "Kubernetes",
  "opencv": "OpenCV",
  "nlp": "Natural Language Processing",
  "rag": "Retrieval-Augmented Generation (RAG)",
  "c5": "CSS",
  "css": "CSS",
  "html": "HTML",
  "mongadb": "MongoDB",
  "mongodb": "MongoDB",
  "al": "Artificial Intelligence",
  "artificial intelligence": "Artificial Intelligence",
  "ml": "Machine Learning",
  "machine learning": "Machine Learning",
  "deepleaming": "Deep Learning",
  "deep learning": "Deep Learning",
  "opps": "OOPs",
  "oops": "OOPs",
  "sql": "SQL",
  "mysql": "MySQL",
  "git": "Git",
  "github": "GitHub",
  "postman": "Postman",
  "tailwind": "Tailwind CSS",
  "tailwindcss": "Tailwind CSS",
  "tailwind css": "Tailwind CSS",
  "linux": "Linux",
  "express": "Express.js",
  "expressjs": "Express.js",
  "express.js": "Express.js",
  "node": "Node.js",
  "nodejs": "Node.js",
  "node.js": "Node.js",
  "problem solving": "Problem Solving",
  "leadership": "Leadership",
  "team collaboration": "Team Collaboration",
  "communication": "Communication",
  "analytical thinking": "Analytical Thinking",
  "time management": "Time Management",
};

export class ExtractionValidator {
  static normalizeSkill(raw: string): string {
    const trimmed = raw.trim();
    return TECH_NORMALIZATION[trimmed.toLowerCase()] || trimmed;
  }

  static validateSkillClaim(skillName: string, sourceSpan: string, fullDocText?: string): ValidationResult {
    const norm = this.normalizeSkill(skillName);
    const span = sourceSpan.trim();

    if (fullDocText && !fullDocText.toLowerCase().includes(span.toLowerCase())) {
      return { valid: false, confidence: 0, flag: "missing_evidence", reason: "Source excerpt does not appear in the uploaded document text.", normalizedValue: norm };
    }
    if (NEGATION_PATTERNS.some((p) => p.test(span))) {
      return { valid: false, confidence: 0.1, flag: "negation", reason: `Excluded claim: source excerpt indicates negation ('${span}').`, normalizedValue: norm };
    }
    if (ASPIRATION_PATTERNS.some((p) => p.test(span))) {
      return { valid: false, confidence: 0.2, flag: "aspiration", reason: "Excluded claim: source excerpt indicates future learning ambition, not current capability.", normalizedValue: norm };
    }
    const coursework = COURSEWORK_PATTERNS.some((p) => p.test(span));
    const lower = span.toLowerCase();
    if (!lower.includes(skillName.toLowerCase()) && !lower.includes(norm.toLowerCase())) {
      return { valid: false, confidence: 0.1, flag: "unsupported", reason: `Source excerpt does not mention '${skillName}'.`, normalizedValue: norm };
    }
    return { valid: true, confidence: coursework ? 0.5 : 0.85, flag: coursework ? "coursework_only" : undefined, normalizedValue: norm };
  }
}
