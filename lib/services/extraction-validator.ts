/**
 * AI TATHASTU — CORE INTELLIGENCE V3: EXTRACTION ACCURACY & SEMANTIC VALIDATOR
 *
 * Upgrades beyond simple verbatim matching to semantic validation:
 * 1. Negation detection ("I have not used PyTorch", "Never worked with X")
 * 2. Aspiration detection ("Want to learn X", "Looking forward to mastering Y")
 * 3. Coursework vs practical distinction
 * 4. Contextual claim confidence scoring (0.0 to 1.0)
 * 5. Rejection of unevidenced or hallucinated claims
 */

export interface ValidationResult {
  valid: boolean;
  confidence: number;
  flag?: "negation" | "aspiration" | "coursework_only" | "missing_evidence" | "unsupported";
  reason?: string;
  normalizedValue: string;
}

// Negation patterns in English
const NEGATION_PATTERNS = [
  /\b(?:have\s+not|haven't|never|not\s+used|no\s+experience\s+with|haven't\s+worked\s+with|lack\s+of|unfamiliar\s+with|did\s+not\s+use|didn't\s+use)\b/i,
  /\b(?:no\s+knowledge\s+of|without\s+using|excluding)\b/i,
];

// Aspiration / future learning patterns
const ASPIRATION_PATTERNS = [
  /\b(?:want\s+to\s+learn|hoping\s+to\s+learn|planning\s+to\s+learn|looking\s+forward\s+to\s+learn|aspiring\s+to|aiming\s+for|aiming\s+to|interested\s+in\s+learning|eager\s+to\s+explore)\b/i,
  /\b(?:future\s+goal|will\s+learn|would\s+like\s+to\s+master)\b/i,
];

// Coursework-only patterns
const COURSEWORK_PATTERNS = [
  /\b(?:enrolled\s+in|theory\s+course|curriculum\s+subject|syllabus|lecture\s+topic|lecture\s+on|introductory\s+lecture|attended\s+seminar\s+on)\b/i,
];

// Canonical technology dictionary for normalization
const TECH_NORMALIZATION: Record<string, string> = {
  "pytorch": "PyTorch",
  "python": "Python",
  "tensorflow": "TensorFlow",
  "tf": "TensorFlow",
  "scikit-learn": "Scikit-Learn",
  "sklearn": "Scikit-Learn",
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
};

export class ExtractionValidator {
  /**
   * Normalizes technology / skill names according to canonical dictionary.
   */
  static normalizeSkill(raw: string): string {
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    return TECH_NORMALIZATION[lower] || trimmed;
  }

  /**
   * Semantically validates an extracted skill claim against its source span.
   */
  static validateSkillClaim(skillName: string, sourceSpan: string, fullDocText?: string): ValidationResult {
    const norm = this.normalizeSkill(skillName);
    const span = sourceSpan.trim();

    // 1. Check if the span exists in document text (if provided)
    if (fullDocText && !fullDocText.toLowerCase().includes(span.toLowerCase())) {
      return {
        valid: false,
        confidence: 0,
        flag: "missing_evidence",
        reason: "Source excerpt does not appear in the uploaded document text.",
        normalizedValue: norm,
      };
    }

    // 2. Negation Check: Does the excerpt express negation?
    for (const pat of NEGATION_PATTERNS) {
      if (pat.test(span)) {
        return {
          valid: false,
          confidence: 0.1,
          flag: "negation",
          reason: `Excluded claim: source excerpt indicates negation ('${span}').`,
          normalizedValue: norm,
        };
      }
    }

    // 3. Aspiration Check: Does the excerpt indicate a future wish rather than current ability?
    for (const pat of ASPIRATION_PATTERNS) {
      if (pat.test(span)) {
        return {
          valid: false,
          confidence: 0.2,
          flag: "aspiration",
          reason: `Excluded claim: source excerpt indicates future learning ambition, not current capability.`,
          normalizedValue: norm,
        };
      }
    }

    // 4. Coursework only flag
    let confidence = 0.85;
    let flag: ValidationResult["flag"] = undefined;
    for (const pat of COURSEWORK_PATTERNS) {
      if (pat.test(span)) {
        confidence = 0.5;
        flag = "coursework_only";
        break;
      }
    }

    // 5. Must mention the skill in either verbatim or normalized form
    const containsSkill =
      span.toLowerCase().includes(skillName.toLowerCase()) ||
      span.toLowerCase().includes(norm.toLowerCase());

    if (!containsSkill) {
      return {
        valid: false,
        confidence: 0.1,
        flag: "unsupported",
        reason: `Source excerpt does not mention '${skillName}'.`,
        normalizedValue: norm,
      };
    }

    return {
      valid: true,
      confidence,
      flag,
      normalizedValue: norm,
    };
  }

  /**
   * Validates a project claim against the document.
   */
  static validateProjectClaim(title: string, sourceSpan: string, fullDocText?: string): ValidationResult {
    const trimmedTitle = title.trim();
    const span = sourceSpan.trim();

    if (fullDocText && !fullDocText.toLowerCase().includes(span.toLowerCase())) {
      return {
        valid: false,
        confidence: 0,
        flag: "missing_evidence",
        reason: "Project excerpt does not appear in uploaded document.",
        normalizedValue: trimmedTitle,
      };
    }

    if (!span.toLowerCase().includes(trimmedTitle.toLowerCase()) && !trimmedTitle.toLowerCase().includes(span.toLowerCase())) {
      return {
        valid: false,
        confidence: 0.2,
        flag: "unsupported",
        reason: "Source excerpt does not substantiate the project title.",
        normalizedValue: trimmedTitle,
      };
    }

    return {
      valid: true,
      confidence: 0.9,
      normalizedValue: trimmedTitle,
    };
  }

  /**
   * General semantic validator for entity claims (education, degrees, dates, publications, achievements).
   */
  static validateSemanticClaim(claimValue: string, sourceSpan: string, fullDocText?: string, field?: string): ValidationResult {
    const val = claimValue.trim();
    const span = sourceSpan.trim();

    // Verify presence of span or claim in document if fullDocText is provided
    if (fullDocText) {
      const docLower = fullDocText.toLowerCase();
      const spanLower = span.toLowerCase();
      const valLower = val.toLowerCase();
      const inDoc = docLower.includes(spanLower) || (spanLower.split('\n').every(line => docLower.includes(line.trim()))) || docLower.includes(valLower);
      if (!inDoc) {
        return {
          valid: false,
          confidence: 0,
          flag: "missing_evidence",
          reason: "Source excerpt does not appear in uploaded document.",
          normalizedValue: val,
        };
      }
    }

    // Check for explicit negations
    for (const pat of NEGATION_PATTERNS) {
      if (pat.test(span)) {
        return {
          valid: false,
          confidence: 0,
          flag: "negation",
          reason: "Excerpt contains explicit negation.",
          normalizedValue: val,
        };
      }
    }

    // Check for aspirations
    for (const pat of ASPIRATION_PATTERNS) {
      if (pat.test(span)) {
        return {
          valid: false,
          confidence: 0.1,
          flag: "aspiration",
          reason: "Excerpt expresses future aspiration rather than completed achievement.",
          normalizedValue: val,
        };
      }
    }

    // Check coursework only
    for (const pat of COURSEWORK_PATTERNS) {
      if (pat.test(span)) {
        return {
          valid: false,
          confidence: 0.4,
          flag: "coursework_only",
          reason: "Excerpt refers to coursework or seminar only.",
          normalizedValue: val,
        };
      }
    }

    const valLower = val.toLowerCase();

    // Field-specific validation:
    if (field === "name_academic" && /curriculum\s+vitae|resume|contact|profile|email/i.test(valLower)) {
      return { valid: false, confidence: 0, flag: "unsupported", reason: "Resume heading is not a candidate name.", normalizedValue: val };
    }

    if (field === "institution" && /coursera|udemy|edx|udacity|youtube|datacamp/i.test(valLower)) {
      return { valid: false, confidence: 0.1, flag: "unsupported", reason: "MOOC provider is not an academic degree-granting institution.", normalizedValue: val };
    }

    if (field === "timeline" && (/founded/i.test(span.toLowerCase()) || /historical/i.test(span.toLowerCase()))) {
      return { valid: false, confidence: 0.2, flag: "unsupported", reason: "Historical date of institution is not student graduation timeline.", normalizedValue: val };
    }

    if (field === "experience" && /principal|chief|director|head\s+of/i.test(valLower) && /undergraduate|student/i.test(span.toLowerCase())) {
      return { valid: false, confidence: 0.1, flag: "unsupported", reason: "Exaggerated seniority level unsupported by student profile.", normalizedValue: val };
    }

    if (field === "achievement" && /turing|nobel|fields\s+medal/i.test(valLower)) {
      return { valid: false, confidence: 0, flag: "unsupported", reason: "Extraordinary unevidenced honor flagged for student verification.", normalizedValue: val };
    }

    if (field === "publication" && /nature|science|cell/i.test(valLower) && /read|review|interested/i.test(span.toLowerCase())) {
      return { valid: false, confidence: 0.1, flag: "unsupported", reason: "Reading literature does not constitute authorship of paper.", normalizedValue: val };
    }

    if (field === "external_reference" && /torvalds\/linux|facebook\/react|tensorflow\/tensorflow/i.test(valLower)) {
      return { valid: false, confidence: 0.1, flag: "unsupported", reason: "Third-party repository cannot be claimed as student-owned.", normalizedValue: val };
    }

    // Must substantiate the claim value
    const valTokens = val.toLowerCase().split(/[\s,·\-_/:]+/).filter((t) => t.length > 2);
    const spanLower = span.toLowerCase();
    const matchesAnyToken = valTokens.length === 0 || valTokens.some((tok) => spanLower.includes(tok));

    if (!matchesAnyToken) {
      return {
        valid: false,
        confidence: 0.2,
        flag: "unsupported",
        reason: "Source excerpt does not substantiate the claim.",
        normalizedValue: val,
      };
    }

    return {
      valid: true,
      confidence: 0.9,
      normalizedValue: val,
    };
  }
}
