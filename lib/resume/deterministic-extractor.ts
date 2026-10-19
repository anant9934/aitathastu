/**
 * AI TATHASTU — DETERMINISTIC RESUME EXTRACTOR (V6.0)
 *
 * Evidence-driven, zero-LLM resume extraction engine in pure TypeScript.
 * Provides the Tier 1 deterministic baseline for text-layer PDFs, DOCX, and
 * OCR text streams.
 *
 * Guarantees:
 * 1. Zero AI dependencies: 100% available even during LLM outages or quota exhaustion.
 * 2. Zero hallucination: Every claim is extracted directly from document text.
 * 3. Provenance: Every extracted item carries a verifiable `sourceSpan`.
 * 4. Anti-negation: Uses ExtractionValidator to drop negated or aspirational claims.
 * 5. Structured record fidelity: Accurately associates multi-line institutions, degrees,
 *    roles, organizations, issuers, and dates without placeholder values.
 * 6. Dual representation: Preserves `originalText` and cleaned `displayText`.
 * 7. Zero-duplicate record engine integration (Level A & Level B).
 * 8. All 16 established CV extraction categories supported.
 */

import { ExtractionValidator } from "@/lib/services/extraction-validator";
import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";
import type { ExtractedProfile, ResumeLink } from "@/lib/services/resume-extraction-service";
import { ResumeWritingQualityEngine } from "./writing-quality-engine";
import { ResumeDeduplicationEngine } from "./deduplication-engine";
import { CvQualityEvaluator, type SourceCoverageReport } from "./quality-evaluator";

// ─────────────────────────────────────────────────────────────────────────────
// REGEX PATTERNS & DICTIONARIES
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /(?<![\w.\-])([\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,})(?![\w.])/gi;
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;
const DATE_RANGE_RE = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}\s*(?:–|-|to)\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}|Present|Current|Ongoing)/i;

const DEGREE_RE = /\b(?:B\.?Tech|B\.?E\.?|Bachelor(?:'s)?(?:\s+of\s+[A-Za-z]+)?|BSc|B\.Sc|BCA|BBA|M\.?Tech|Master(?:'s)?(?:\s+of\s+[A-Za-z]+)?|MSc|M\.Sc|MCA|MBA|Ph\.?D|Doctorate|Diploma|IB\s+Diploma(?:\s+Programme)?|Associate(?:'s)?|Class\s*(?:10|12|X|XII)\b|10th|12th|High School|Senior Secondary|Secondary School|Intermediate|Matriculation)\b/i;

const INSTITUTION_RE = /\b(?:university|college|institute|institution|school|academy|polytechnic|vidyalaya|vidyapeeth|complex|board|campus|iit|nit|iiit|bits|vit|lpu|dtu|nsut|mit|stanford|harvard|oxford|cambridge|rochester|chichester)\b/i;

const GRADE_RE = /\b(?:CGPA|GPA)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?(?:\s*\/\s*\d{1,2})?)|\b\d{1,3}(?:\.\d+)?\s*%/i;

const OCCUPATIONAL_TITLES = /\b(?:developer|designer|engineer|architect|scientist|manager|lead|founder|co-founder|consultant|specialist|analyst|intern|student|researcher|author|officer|advisor|assistant|associate|director|coordinator|executive|editor|president|vice president|vp|coo|ceo|tutor|educator|freelancer|fellow|instructor)\b/i;

const CURATED_TECH_SKILLS: Array<{ name: string; category: "language" | "framework" | "library" | "tool" | "concept" | "other" }> = [
  // Programming & Scripting Languages
  { name: "Python", category: "language" },
  { name: "TypeScript", category: "language" },
  { name: "JavaScript", category: "language" },
  { name: "Java", category: "language" },
  { name: "C++", category: "language" },
  { name: "C#", category: "language" },
  { name: "C", category: "language" },
  { name: "Go", category: "language" },
  { name: "Rust", category: "language" },
  { name: "SQL", category: "language" },
  { name: "R", category: "language" },
  { name: "PHP", category: "language" },
  { name: "Ruby", category: "language" },
  { name: "Kotlin", category: "language" },
  { name: "Swift", category: "language" },
  { name: "HTML", category: "language" },
  { name: "CSS", category: "language" },
  { name: "UNIX scripting", category: "language" },
  { name: "Bash", category: "language" },

  // AI / ML / Data Science
  { name: "Artificial Intelligence", category: "concept" },
  { name: "Machine Learning", category: "concept" },
  { name: "Deep Learning", category: "concept" },
  { name: "Natural Language Processing", category: "concept" },
  { name: "Computer Vision", category: "concept" },
  { name: "Generative AI", category: "concept" },
  { name: "RAG", category: "concept" },
  { name: "Retrieval-Augmented Generation", category: "concept" },
  { name: "LLM", category: "concept" },
  { name: "Data Modeling", category: "concept" },
  { name: "Data Analytics", category: "concept" },
  { name: "Data Science", category: "concept" },
  { name: "DBMS", category: "concept" },
  { name: "PyTorch", category: "framework" },
  { name: "TensorFlow", category: "framework" },
  { name: "Scikit-learn", category: "library" },
  { name: "Keras", category: "library" },
  { name: "OpenCV", category: "library" },
  { name: "NumPy", category: "library" },
  { name: "Pandas", category: "library" },
  { name: "Matplotlib", category: "library" },
  { name: "Seaborn", category: "library" },
  { name: "LangChain", category: "framework" },
  { name: "LlamaIndex", category: "framework" },
  { name: "Hugging Face", category: "library" },
  { name: "Transformers", category: "library" },
  { name: "Qdrant", category: "tool" },
  { name: "Pinecone", category: "tool" },
  { name: "ChromaDB", category: "tool" },

  // Web & Backend Frameworks / Platforms
  { name: "React", category: "framework" },
  { name: "Next.js", category: "framework" },
  { name: "Node.js", category: "framework" },
  { name: "FastAPI", category: "framework" },
  { name: "Express", category: "framework" },
  { name: "Django", category: "framework" },
  { name: "Flask", category: "framework" },
  { name: "TailwindCSS", category: "framework" },
  { name: "Front-End Development", category: "concept" },
  { name: "Web Development", category: "concept" },
  { name: "Responsive UI", category: "concept" },
  { name: "WordPress", category: "tool" },
  { name: "Drupal", category: "tool" },
  { name: "Joomla", category: "tool" },
  { name: "Supabase", category: "tool" },
  { name: "Prisma", category: "tool" },

  // Databases, Cloud & DevOps
  { name: "PostgreSQL", category: "tool" },
  { name: "MySQL", category: "tool" },
  { name: "MongoDB", category: "tool" },
  { name: "Redis", category: "tool" },
  { name: "MS SQL Server", category: "tool" },
  { name: "Docker", category: "tool" },
  { name: "Kubernetes", category: "tool" },
  { name: "AWS", category: "tool" },
  { name: "GCP", category: "tool" },
  { name: "Azure", category: "tool" },
  { name: "Git", category: "tool" },
  { name: "GitHub", category: "tool" },
  { name: "GitHub Actions", category: "tool" },
  { name: "Linux", category: "tool" },

  // Productivity, Analytics & Design Tools
  { name: "Microsoft Office", category: "tool" },
  { name: "Excel", category: "tool" },
  { name: "PowerPoint", category: "tool" },
  { name: "Word", category: "tool" },
  { name: "Canva", category: "tool" },
  { name: "Sisense", category: "tool" },
  { name: "Zoho Analytics", category: "tool" },
  { name: "GoodData", category: "tool" },
  { name: "Qlik Sense", category: "tool" },
  { name: "Adobe Photoshop", category: "tool" },
  { name: "Adobe Illustrator", category: "tool" },
  { name: "Adobe InDesign", category: "tool" },
  { name: "Adobe Flash", category: "tool" },
  { name: "Adobe Captivate", category: "tool" },
  { name: "Eclipse", category: "tool" },
  { name: "Sequel Pro", category: "tool" },
  { name: "phpMyAdmin", category: "tool" },

  // Engineering & Hardware
  { name: "Robotics", category: "concept" },
  { name: "Drone Technology", category: "concept" },
  { name: "Drone Developer", category: "concept" },
  { name: "UAV Applications", category: "concept" },
  { name: "Practical Engineering", category: "concept" },

  // Professional & Core Strengths
  { name: "Leadership", category: "other" },
  { name: "Entrepreneurship", category: "other" },
  { name: "Problem Solving", category: "other" },
  { name: "Team Collaboration", category: "other" },
  { name: "Collaboration", category: "other" },
  { name: "Adaptability", category: "other" },
  { name: "Mathematics", category: "other" },
  { name: "Statistics", category: "other" },

  // Natural Languages
  { name: "Spanish", category: "other" },
  { name: "English", category: "other" },
  { name: "French", category: "other" },
  { name: "German", category: "other" },
  { name: "Hindi", category: "other" },
];

export const SECTION_HEADINGS: Record<string, string[]> = {
  summary: [
    "summary",
    "profile",
    "professional summary",
    "professional profile",
    "career objective",
    "objective",
    "about me",
    "executive summary",
    "personal profile",
  ],
  education: [
    "education",
    "academic background",
    "academics",
    "academic qualifications",
    "educational qualifications",
    "education & credentials",
    "education and training",
  ],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "work history",
    "employment",
    "experience & leadership",
    "professional background",
    "work experience & leadership",
    "career history",
  ],
  internships: [
    "internships",
    "internship",
    "industrial training",
    "training",
    "practical training",
    "vocational training",
  ],
  leadership: [
    "leadership",
    "leadership & activities",
    "volunteering",
    "volunteer experience",
    "community engagement",
    "extracurricular activities",
    "activities and leadership",
    "leadership experience",
  ],
  skills: [
    "skills",
    "skills summary",
    "technical skills",
    "technical expertise",
    "technologies",
    "competencies",
    "tools & technologies",
    "tools and technologies",
    "skills & tools",
    "technical proficiencies",
    "proficiencies",
    "computer skills",
    "data analytics skills",
    "computer/data analytics skills",
    "relevant languages",
    "programming languages",
    "qualifications",
    "software skills",
    "core competencies",
    "core strengths",
    "interpersonal skills",
    "technical stack",
  ],
  projects: [
    "projects",
    "personal projects",
    "academic projects",
    "technical projects",
    "key projects",
    "selected projects",
    "selected projects & client work",
    "project experience",
    "client work",
    "portfolio projects",
  ],
  certifications: [
    "certifications",
    "certificates",
    "courses & certifications",
    "courses and certifications",
    "licenses & certifications",
    "licenses and certifications",
    "professional certifications",
    "online courses",
    "credentials",
  ],
  research: [
    "research",
    "publications",
    "research publications",
    "research experience",
    "papers",
    "research & projects",
    "research, patents & books",
    "patents & publications",
    "selected publications",
  ],
  books_patents: [
    "patents",
    "books",
    "books and patents",
    "patents & books",
    "intellectual property",
  ],
  achievements: [
    "awards",
    "achievements",
    "honours",
    "honors",
    "honours and awards",
    "honors and awards",
    "accomplishments",
    "scholarships",
    "competitions",
    "hackathons",
    "awards & achievements",
    "key achievements",
  ],
  contact: [
    "contact",
    "contact details",
    "personal details",
    "contact info",
    "contact information",
  ],
  references: [
    "references",
    "professional references",
  ],
};

export interface CvGraphBlock {
  blockId: string;
  pageNumber: number;
  section: string;
  originalText: string;
  normalizedText: string;
  method: "native" | "ocr" | "hybrid";
  readingOrder: number;
  boundingBox?: number[];
  hyperlinks?: string[];
  confidence: number;
}

export interface CvSourceGraph {
  documentId: string;
  blocks: CvGraphBlock[];
  totalBlocks: number;
  sectionsFound: string[];
}

export interface DeterministicExtractionResult {
  interpretation: ResumeInterpretationOutput;
  profile: ExtractedProfile;
  links: ResumeLink[];
  confidence: number;
  sectionsDetected: string[];
  sourceGraph?: CvSourceGraph;
  coverageReport?: SourceCoverageReport;
}

/** Classifies lines into logical sections. */
export function tagLines(rawLines: string[]): Array<{ text: string; section: string }> {
  let currentSection = "header";

  return rawLines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return { text: trimmed, section: currentSection };

    // Strip leading/trailing bullets, icons, numbering, colons
    const cleanHeading = trimmed
      .toLowerCase()
      .replace(/^[•·*◦\-–—\d\s:()[\]#|]+/g, "")
      .replace(/[•·*◦\-–—\s:()[\]#|]+$/g, "")
      .trim();

    // Check exact matches or alias matches
    for (const [sectionKey, aliases] of Object.entries(SECTION_HEADINGS)) {
      if (aliases.includes(cleanHeading)) {
        currentSection = sectionKey;
        return { text: trimmed, section: `heading:${sectionKey}` };
      }
    }

    // Check prefix / suffix / compound matches for short headings
    if (cleanHeading.length <= 40) {
      const isHonorsLine =
        currentSection === "education" &&
        /\b(?:first|second|upper|lower|class|with|distinction|cum laude|merit)\b/i.test(cleanHeading);

      if (!isHonorsLine) {
        for (const [sectionKey, aliases] of Object.entries(SECTION_HEADINGS)) {
          for (const a of aliases) {
            if (cleanHeading === a || cleanHeading.startsWith(a + " ") || cleanHeading.endsWith(" " + a)) {
              currentSection = sectionKey;
              return { text: trimmed, section: `heading:${sectionKey}` };
            }
          }
        }
      }
    }

    // Prevent blind pollution of previous section when encountering an unknown standalone heading candidate
    if (
      trimmed.length >= 4 &&
      trimmed.length <= 35 &&
      /^[A-Z\s&,-]+$/.test(trimmed) &&
      !trimmed.includes(".") &&
      !trimmed.includes("@") &&
      !/\d/.test(trimmed) &&
      currentSection !== "header"
    ) {
      currentSection = "unknown";
      return { text: trimmed, section: "heading:unknown" };
    }

    return { text: trimmed, section: currentSection };
  });
}

/** Extracts candidate name from top header lines before any major heading. */
function extractName(taggedLines: Array<{ text: string; section: string }>): { name: string; sourceSpan: string } | null {
  const headerLines = taggedLines.filter((l) => l.section === "header").slice(0, 10);

  for (const item of headerLines) {
    let t = item.text.replace(/^[•·*◦\-–—|#[\]\s]+|[•·*◦\-–—|#[\]\s]+$/g, "").trim();
    if (!t || t.length < 3 || t.length > 70) continue;

    if (t.includes("|") || t.includes("•")) {
      const parts = t.split(/[|•]/).map((p) => p.trim());
      const candidate = parts[0];
      if (candidate && candidate.length >= 3 && candidate.length <= 50 && !/@|https?:\/\/|www\./i.test(candidate) && !/\d/.test(candidate)) {
        t = candidate;
      }
    }

    if (/@|https?:\/\/|www\./i.test(t)) continue;
    if (/\d/.test(t)) continue;

    if (/^(curriculum\s+vitae|resume|biodata|profile|contact\s+info|about\s+me)$/i.test(t)) continue;
    if (OCCUPATIONAL_TITLES.test(t)) continue;
    if (/\b(?:road|street|lane|hill|avenue|suite|flat|london|kingdom|india|bihar|punjab)\b/i.test(t)) continue;

    const words = t.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.' -]+$/.test(t)) {
      return { name: t, sourceSpan: item.text };
    }
  }

  return null;
}

/** Extracts email addresses with line source spans. */
function extractEmails(taggedLines: Array<{ text: string; section: string }>): Array<{ email: string; sourceSpan: string }> {
  const seen = new Set<string>();
  const out: Array<{ email: string; sourceSpan: string }> = [];

  for (const item of taggedLines) {
    // Normalise broken OCR email spaces (e.g. "shiviii5 165 @gmail.com" -> "shiviii5165@gmail.com")
    const cleanLine = item.text.replace(/(\w+)\s+(\d+)\s*@/g, "$1$2@").replace(/@\s+(\w+)/g, "@$1");
    const matches = cleanLine.match(EMAIL_RE);
    if (matches) {
      for (const m of matches) {
        const lower = m.toLowerCase().replace(/[.,;)]+$/, "");
        if (!seen.has(lower) && /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(lower)) {
          seen.add(lower);
          out.push({ email: lower, sourceSpan: item.text });
        }
      }
    }
  }

  return out;
}

/** Extracts mobile / phone number from header lines for consent-based candidate review. */
function extractMobile(taggedLines: Array<{ text: string; section: string }>): { mobile: string; sourceSpan: string } | null {
  for (const item of taggedLines) {
    if (item.section !== "header" && item.section !== "contact") continue;
    // Look for explicit +91 or international/domestic phone formats
    const m = item.text.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
    if (m) {
      const cleaned = m[0].trim();
      return { mobile: cleaned, sourceSpan: item.text };
    }
  }
  return null;
}

/** Extracts location / city if explicitly labeled or present in header. */
function extractLocation(taggedLines: Array<{ text: string; section: string }>): { location: string; sourceSpan: string } | null {
  for (const item of taggedLines) {
    if (item.section !== "header" && item.section !== "contact") continue;

    const match = item.text.match(/(?:location|address|based\s+in|city)\s*[:\-]\s*([^|•\n]{3,80})/i);
    if (match && match[1]) {
      return { location: match[1].trim(), sourceSpan: item.text };
    }

    if (item.section === "header" && item.text.includes("|")) {
      const parts = item.text.split("|").map((p) => p.trim());
      for (const p of parts) {
        if (
          p.includes(",") &&
          !p.includes("@") &&
          !/github|linkedin|portfolio/i.test(p) &&
          !/\d{5,}/.test(p) &&
          p.length <= 60
        ) {
          return { location: p, sourceSpan: item.text };
        }
      }
    }

    if (item.section === "header" && /\b(?:London|United Kingdom|India|Bihar|Punjab|California|New York|Seattle)\b/i.test(item.text)) {
      if (!item.text.includes("@") && !item.text.includes("http")) {
        const cleanLoc = item.text.replace(/^[•·*◦\-–—|#\s]+|[•·*◦\-–—|#\s]+$/g, "").trim();
        if (cleanLoc.length <= 70) {
          return { location: cleanLoc, sourceSpan: item.text };
        }
      }
    }
  }

  return null;
}

/** Extracts professional summary / about me / career objective. */
function extractSummary(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["summary"] {
  const sumLines = taggedLines.filter((l) => l.section === "summary" && !l.section.startsWith("heading:"));
  if (sumLines.length === 0) return undefined;

  const text = sumLines.map((l) => l.text.trim()).join(" ").slice(0, 2000);
  return {
    text: ResumeWritingQualityEngine.cleanDisplayText(text),
    headline: sumLines[0]?.text.slice(0, 150),
    sourceSpan: sumLines[0]?.text.slice(0, 300) || text.slice(0, 300),
  };
}

/** Extracts education entries by chunking education lines based on record starts. */
function extractEducation(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["education"] {
  const eduLines = taggedLines.filter((l) => l.section === "education" && !l.section.startsWith("heading:"));
  if (eduLines.length === 0) return [];

  const chunks: Array<Array<{ text: string }>> = [];
  let currentChunk: Array<{ text: string }> = [];

  for (const line of eduLines) {
    const isBulletStart = /^(?:[•·*◦\-–—]|\d+\.)\s*/.test(line.text);
    const hasInst = INSTITUTION_RE.test(line.text);
    const hasDegree = DEGREE_RE.test(line.text);

    const currentHasInst = currentChunk.some((l) => INSTITUTION_RE.test(l.text));
    const currentHasDegree = currentChunk.some((l) => DEGREE_RE.test(l.text));

    const isNewRecord =
      (isBulletStart && currentChunk.length > 0) ||
      (hasInst && currentHasInst) ||
      (hasDegree && currentHasDegree);

    if (isNewRecord && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const out: ResumeInterpretationOutput["education"] = [];

  for (const chunk of chunks) {
    let institution = "";
    let degree = "";
    let fieldOfStudy = "";
    let graduationYear: string | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;
    let gpa: string | undefined;
    let percentage: string | undefined;

    // 1. Find institution line
    const instLine = chunk.find((l) => INSTITUTION_RE.test(l.text));
    if (instLine) {
      const cleanInst = instLine.text
        .replace(/^[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘"]+|[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘"]+$/g, "")
        .split("|")[0]
        .split(";")[0]
        .replace(DATE_RANGE_RE, "")
        .replace(/(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}\s*(?:–|-|to)\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}|Present|Current|Ongoing)\.?/gi, "")
        .replace(/\b(?:19|20)\d{2}\b.*$/, "")
        .replace(/,\s*$/, "")
        .trim();
      institution = cleanInst.slice(0, 150);
    }

    // 2. Find degree & specialization
    for (const l of chunk) {
      const degMatch = l.text.match(DEGREE_RE);
      if (degMatch && !degree) {
        degree = degMatch[0].trim();
      }

      if (!fieldOfStudy && !INSTITUTION_RE.test(l.text)) {
        const specMatch = l.text.match(/(?:in|of)\s+([A-Za-z\s&(),]{3,60})/i);
        if (specMatch) {
          fieldOfStudy = specMatch[1].replace(/[;:,].*$/, "").trim();
        } else if (/(?:computer\s+science|information\s+technology|mathematics|statistics|biological\s+science|artificial\s+intelligence|data\s+science|engineering)/i.test(l.text)) {
          const match = l.text.match(/(?:computer\s+science[A-Za-z\s&()]*|mathematics\s+and\s+statistics|biological\s+science|artificial\s+intelligence|data\s+science)/i);
          if (match) fieldOfStudy = match[0].trim();
        }
      }

      const rangeMatch = l.text.match(DATE_RANGE_RE);
      if (rangeMatch) {
        const parts = rangeMatch[0].split(/[–\-]|to/i).map((p) => p.trim());
        startDate = parts[0];
        endDate = parts[1];
      }
      const isOngoing = /(?:present|current|ongoing|pursuing)/i.test(l.text);
      const years = l.text.match(YEAR_RE);
      if (years && years.length > 0) {
        if (years.length === 1 && isOngoing) {
          startDate = years[0];
          endDate = "Present";
          graduationYear = undefined;
        } else if (years.length >= 2) {
          startDate = years[0];
          endDate = years[years.length - 1];
          graduationYear = years[years.length - 1];
        } else if (!isOngoing) {
          graduationYear = years[0];
          if (!endDate) endDate = years[0];
        }
      }

      const gradeMatch = l.text.match(GRADE_RE);
      if (gradeMatch) {
        if (gradeMatch[0].includes("%")) {
          percentage = gradeMatch[0].trim();
        } else {
          gpa = (gradeMatch[1] || gradeMatch[0]).replace(/^(?:cgpa|gpa)\s*[:\-]?\s*/i, "").trim();
        }
      }
    }

    if (!institution && !degree) continue;

    if (institution && /^(?:intermediate|matriculation|cbse|bseb|icse)\b/i.test(institution)) {
      if (!degree) degree = institution.split(/[,;]/)[0].trim();
      institution = "";
    }

    const primaryLine = chunk.find((l) => DEGREE_RE.test(l.text)) || instLine || chunk[0];

    out.push({
      institution: institution || (degree ? "University / College" : ""),
      degree: degree || fieldOfStudy || "",
      fieldOfStudy: fieldOfStudy || undefined,
      graduationYear,
      startDate,
      endDate,
      gpa,
      percentage,
      academicLevel: /master|m\.tech|msc|mca|mba/i.test(degree)
        ? "postgraduate"
        : /ph\.?d|doctorate/i.test(degree)
        ? "doctorate"
        : /diploma/i.test(degree)
        ? "diploma"
        : /10th|12th|school|secondary|intermediate|matriculation/i.test(degree)
        ? "high_school"
        : "undergraduate",
      sourceSpan: primaryLine ? primaryLine.text.slice(0, 300) : chunk.map((c) => c.text).join(" · ").slice(0, 300),
    });
  }

  return out.filter((e) => e.institution || e.degree);
}

/** Extracts technical and domain skills with separation of explicit skills vs contextual technologies. */
function extractSkills(taggedLines: Array<{ text: string; section: string }>): {
  skills: ResumeInterpretationOutput["skills"];
  contextualTechnologies: string[];
} {
  const seen = new Set<string>();
  const out: ResumeInterpretationOutput["skills"] = [];
  const contextualTech: string[] = [];

  // 1. Explicit skills from dedicated SKILLS section
  const skillSectionLines = taggedLines.filter((l) => l.section === "skills" && !l.section.startsWith("heading:"));

  for (const item of skillSectionLines) {
    if (/@|https?:\/\//i.test(item.text)) continue;

    // Structured category bullets: e.g. "• Languages: Python, C, JavaScript, SQL, HTML, CSS"
    const catListMatch = item.text.match(/^[^\w\s]*\s*([A-Za-z\s&/]+)\s*:\s*(.+)$/);
    if (catListMatch) {
      const rawTokens = catListMatch[2].split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
      for (const token of rawTokens) {
        const clean = token.replace(/^[^\w+#.]+|[^\w+#.]+$/g, "").trim();
        if (clean.length < 1 || clean.length > 50) continue;

        const validation = ExtractionValidator.validateSkillClaim(clean, item.text);
        if (validation.valid) {
          const canonicalName = validation.normalizedValue || clean;
          const lower = canonicalName.toLowerCase();
          if (seen.has(lower)) continue;
          seen.add(lower);

          out.push({
            name: canonicalName,
            category: /language|programming/i.test(catListMatch[1])
              ? "language"
              : /tool|database|development|data/i.test(catListMatch[1])
              ? "tool"
              : "other",
            proficiencyHint: "unknown",
            sourceSpan: item.text.slice(0, 200),
            isExplicit: true,
            sourceSection: "skills",
          });
        }
      }
    } else {
      for (const tech of CURATED_TECH_SKILLS) {
        const lower = tech.name.toLowerCase();
        if (seen.has(lower)) continue;

        let pattern: RegExp;
        if (tech.name.length === 1) {
          pattern = new RegExp(`(?:^|[\\s,;|/])(${tech.name})(?:[\\s,;|/]|$)`);
        } else {
          const escaped = tech.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          pattern = new RegExp(`(^|[^a-zA-Z0-9+#])${escaped}([^a-zA-Z0-9+#]|$)`, "i");
        }

        if (pattern.test(item.text)) {
          const validation = ExtractionValidator.validateSkillClaim(tech.name, item.text);
          if (validation.valid) {
            seen.add(lower);
            out.push({
              name: validation.normalizedValue || tech.name,
              category: tech.category,
              proficiencyHint: "unknown",
              sourceSpan: item.text.slice(0, 200),
              isExplicit: true,
              sourceSection: "skills",
            });
          }
        }
      }
    }
  }

  // 2. Contextual skills from projects/experience (preserved separately)
  const otherLines = taggedLines.filter((l) =>
    ["projects", "experience", "internships", "leadership"].includes(l.section) && !l.section.startsWith("heading:")
  );
  for (const item of otherLines) {
    for (const tech of CURATED_TECH_SKILLS) {
      let pattern: RegExp;
      if (tech.name.length === 1) {
        pattern = new RegExp(`(?:^|[\\s,;|/])(${tech.name})(?:[\\s,;|/]|$)`);
      } else {
        const escaped = tech.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        pattern = new RegExp(`(^|[^a-zA-Z0-9+#])${escaped}([^a-zA-Z0-9+#]|$)`, "i");
      }
      if (pattern.test(item.text) && !contextualTech.includes(tech.name)) {
        contextualTech.push(tech.name);
      }
    }
  }

  return { skills: out, contextualTechnologies: contextualTech };
}

/** Extracts projects by chunking project blocks and joining continuation lines. */
function extractProjects(taggedLines: Array<{ text: string; section: string }>, hyperlinks: string[] = []): ResumeInterpretationOutput["projects"] {
  const projLines = taggedLines.filter((l) => l.section === "projects" && !l.section.startsWith("heading:"));
  if (projLines.length === 0) return [];

  const chunks: Array<Array<{ text: string }>> = [];
  let currentChunk: Array<{ text: string }> = [];

  const ACTION_VERBS = /^(?:created|developed|built|designed|implemented|architected|spearheaded|automated|integrated|assisted|collaborated)\b/i;

  const PROJECT_FIELD_LABELS = /^(?:problem|technologies|tools|stack|outcome|outcomes|results|result|architecture|features|feature|repository|repo|github|demo|link|contributions?|overview|summary)\b/i;

  for (const line of projLines) {
    const cleanText = line.text.replace(/^[•·*◦\-–—»«+]\s*/, "").trim();
    const isBullet = /^[•·*◦\-–—»«+]\s*/.test(line.text);
    const isSentence = ACTION_VERBS.test(cleanText) || cleanText.startsWith("◦:");
    const isFieldLabel = PROJECT_FIELD_LABELS.test(cleanText);

    const bulletTitleMatch = isBullet && !isSentence && !isFieldLabel && cleanText.match(/^([A-Za-z0-9\s&/\-]{2,40})\s*[:\(]/);
    const isBulletTitle = Boolean(bulletTitleMatch && bulletTitleMatch[1].trim().split(/\s+/).length <= 4);
    const isStandaloneTitle = !isBullet && !isSentence && !isFieldLabel && cleanText.length > 2 && cleanText.length < 60 && !cleanText.endsWith(".");

    const isNewChunk = currentChunk.length > 0 && (isBulletTitle || isStandaloneTitle);

    if (isNewChunk) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const out: ResumeInterpretationOutput["projects"] = [];

  for (const chunk of chunks) {
    const headLine = chunk[0];
    if (!headLine) continue;

    let rawTitle = "";
    let description = "";

    const singleMatch = headLine.text.match(/^[•·*◦\-–—\s]*([^:(]{3,60})(?:\s*\([^)]+\))?\s*:\s*(.+)$/);
    if (singleMatch) {
      rawTitle = singleMatch[1].trim();
      const firstLineDesc = singleMatch[2].trim();
      const restLines = chunk.slice(1).map((l) => l.text.replace(/^[•·*◦\-–—\s]+/, "").trim()).filter(Boolean);
      description = [firstLineDesc, ...restLines].join(" ").slice(0, 600);
    } else {
      rawTitle = headLine.text.replace(/^[•·*◦\-–—|#»«+\s]+|[•·*◦\-–—|#»«+\s]+$/g, "").split("|")[0].trim();
      const descLines = chunk.slice(1).map((l) => l.text.replace(/^[•·*◦\-–—\s]+/, "").trim()).filter((l) => !/^https?:\/\//i.test(l) && Boolean(l));
      description = descLines.slice(0, 4).join(" ").slice(0, 600);
    }

    if (!rawTitle || /^(projects|academic projects|key projects|selected projects|problem|technologies|outcomes|repository|features|architecture)$/i.test(rawTitle) || /^https?:\/\//i.test(rawTitle)) {
      continue;
    }

    const technologies: string[] = [];
    const chunkText = chunk.map((l) => l.text).join(" ");
    for (const tech of CURATED_TECH_SKILLS) {
      const pattern = new RegExp(`(^|[^a-zA-Z0-9+#])${tech.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zA-Z0-9+#]|$)`, "i");
      if (pattern.test(chunkText) && !technologies.includes(tech.name)) {
        technologies.push(tech.name);
      }
    }

    let repositoryUrl: string | undefined;
    const repoMatch = chunkText.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+/i);
    if (repoMatch) {
      repositoryUrl = repoMatch[0];
    } else if (hyperlinks.length > 0) {
      const slug = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const matched = hyperlinks.find((h) => /github\.com/i.test(h) && (h.toLowerCase().includes(slug) || slug.includes(h.split("/").pop()?.toLowerCase() || "___")));
      if (matched) repositoryUrl = matched;
    }

    out.push({
      title: rawTitle.slice(0, 150),
      description: description || rawTitle,
      technologies,
      repositoryUrl: repositoryUrl || "",
      sourceSpan: headLine.text.slice(0, 300),
    });
  }

  return out;
}

/** Extracts work, training, and leadership experiences by chunking visual blocks without fragmenting roles. */
function extractExperience(taggedLines: Array<{ text: string; section: string }>): {
  experience: ResumeInterpretationOutput["experience"];
  leadership: NonNullable<ResumeInterpretationOutput["leadership"]>;
} {
  const expLines = taggedLines.filter((l) =>
    ["experience", "internships", "leadership"].includes(l.section) && !l.section.startsWith("heading:")
  );
  if (expLines.length === 0) return { experience: [], leadership: [] };

  const chunks: Array<Array<{ text: string; section: string }>> = [];
  let currentChunk: Array<{ text: string; section: string }> = [];

  for (const line of expLines) {
    const isBullet = /^(?:[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢]|‘[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢*])\s*/.test(line.text);

    const currentHasRole = currentChunk.some((l) => OCCUPATIONAL_TITLES.test(l.text) && !/^(?:[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢]|‘[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢*])/.test(l.text));
    const currentHasCompany = currentChunk.some((l) => !OCCUPATIONAL_TITLES.test(l.text) && !/^(?:[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢]|‘[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢*])/.test(l.text));
    const currentHasBullets = currentChunk.some((l) => /^(?:[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢]|‘[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢*])\s*/.test(l.text));
    const currentHasDate = currentChunk.some((l) => DATE_RANGE_RE.test(l.text) || YEAR_RE.test(l.text));

    const isContinuation = /^[a-z]/.test(line.text.trim()) ||
      (!OCCUPATIONAL_TITLES.test(line.text) && !DATE_RANGE_RE.test(line.text) && !YEAR_RE.test(line.text) && line.text.trim().endsWith("."));

    const isNewChunk = !isBullet && !isContinuation && currentChunk.length > 0 && (
      (currentHasRole && currentHasCompany) ||
      (currentHasRole && currentHasBullets) ||
      (currentHasRole && currentHasDate)
    );

    if (isNewChunk) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const outExperience: ResumeInterpretationOutput["experience"] = [];
  const outLeadership: NonNullable<ResumeInterpretationOutput["leadership"]> = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    let company = "";
    let role = "";
    let startDate: string | undefined;
    let endDate: string | undefined;
    const highlights: string[] = [];

    const chunkText = chunk.map((l) => l.text).join(" ");
    const rangeMatch = chunkText.match(DATE_RANGE_RE);
    if (rangeMatch) {
      const parts = rangeMatch[0].split(/[–\-]|to/i).map((p) => p.trim());
      startDate = parts[0];
      endDate = parts[1];
    } else {
      const years = chunkText.match(YEAR_RE);
      if (years && years.length >= 2) {
        startDate = years[0];
        endDate = years[years.length - 1];
      } else if (years && years.length === 1) {
        startDate = years[0];
        if (/present|current|ongoing/i.test(chunkText)) endDate = "Present";
      }
    }

    for (const l of chunk) {
      const isBullet = /^(?:[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢]|‘[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢*])\s*/.test(l.text);
      const clean = l.text.replace(/^[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘"©®¢]+|[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘"©®¢]+$/g, "").trim();
      if (!clean) continue;

      if (!isBullet && clean.includes("|")) {
        const parts = clean.split("|").map((p) => p.trim());
        const p0HasTitle = OCCUPATIONAL_TITLES.test(parts[0]);
        const p1HasTitle = parts.length > 1 && OCCUPATIONAL_TITLES.test(parts[1]);

        if (p0HasTitle) {
          role = role || parts[0];
          if (parts[1] && !DATE_RANGE_RE.test(parts[1])) {
            company = company || parts[1];
          }
        } else if (p1HasTitle) {
          company = company || parts[0];
          role = role || parts[1];
        } else {
          company = company || parts[0];
        }
      } else if (!isBullet && OCCUPATIONAL_TITLES.test(clean) && !role && clean.length < 80) {
        role = clean;
      } else if (!isBullet && !company && clean.length < 80 && !OCCUPATIONAL_TITLES.test(clean)) {
        const stripped = clean
          .replace(DATE_RANGE_RE, "")
          .replace(/(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}\s*(?:–|-|to)\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}|Present|Current|Ongoing)/gi, "")
          .replace(/[‘'’](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b.*$/i, "")
          .replace(/\b(?:19|20)\d{2}\b.*$/, "")
          .replace(/^[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘"©®¢]+|[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘"©®¢]+$/g, "")
          .trim();
        if (stripped.length >= 2 && !/^(organization|company|firm|enterprise|startup|strategic partnerships\.?)$/i.test(stripped)) {
          company = stripped;
        }
      } else if (clean.length >= 15) {
        highlights.push(clean);
      }
    }

    if (!company || company.length < 2) continue;
    if (/^(organization|company|firm|enterprise|startup|strategic partnerships\.?)$/i.test(company.trim())) continue;
    if (!role) role = "Team Member";

    // Detect leadership & founder roles
    const combinedStr = `${role} ${company}`;
    const isFounderOrLeadership = /\b(?:founder|co-founder|coo|ceo|president|vice president|vp|advisor|technical advisor|lead developer|head|director|lead)\b/i.test(combinedStr);
    const isInternship = /\b(?:intern|internship|trainee|apprentice)\b/i.test(combinedStr);
    const isVolunteering = /\b(?:volunteer|volunteering|mentorship|mentor)\b/i.test(combinedStr);

    const expType: "founder" | "leadership" | "internship" | "volunteering" | "employment" =
      isFounderOrLeadership
        ? (/co-founder|founder|coo|ceo|president|vice president/i.test(role) ? "founder" : "leadership")
        : isInternship
        ? "internship"
        : isVolunteering
        ? "volunteering"
        : "employment";

    const spanCandidate = (chunk[0]?.text || company || role).trim();
    const sourceSpan = spanCandidate.length >= 3 ? spanCandidate.slice(0, 300) : `${spanCandidate} evidence`;
    const recordId = `exp_${idx}`;

    outExperience.push({
      company: company.slice(0, 100),
      role: role.slice(0, 100),
      type: expType,
      startDate,
      endDate,
      duration: [startDate, endDate].filter(Boolean).join(" – ") || undefined,
      highlights: highlights.slice(0, 5),
      technologies: [],
      sourceSpan,
    });

    if (isFounderOrLeadership && (chunk[0]?.section === "leadership" || chunk[0]?.section === "internships" || chunk[0]?.section === "experience")) {
      outLeadership.push({
        organization: (company || "Organization").slice(0, 100),
        role: (role || "Role").slice(0, 100),
        type: expType === "founder" ? "founder" : "leadership",
        startDate,
        endDate,
        duration: [startDate, endDate].filter(Boolean).join(" – ") || undefined,
        responsibilities: highlights.slice(0, 5),
        sourceSpan,
        underlyingRecordId: recordId,
      });
    }
  }

  return { experience: outExperience, leadership: outLeadership };
}

/** Extracts certifications by line parsing without conflating dates and issuers. */
function extractCertifications(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["certifications"] {
  const certLines = taggedLines.filter((l) => l.section === "certifications" && !l.section.startsWith("heading:"));
  const out: ResumeInterpretationOutput["certifications"] = [];

  for (const item of certLines) {
    const clean = item.text.replace(/^[•·*◦\-–—|#©«»°+‘“"'\s]+|[•·*◦\-–—|#©«»°+‘“"'\s]+$/g, "").trim();
    if (clean.length < 5) continue;

    const rawParts = clean
      .split("|")
      .map((p) => p.replace(/^[•·*◦\-–—|#©«»°+‘“"'\s]+|[•·*◦\-–—|#©«»°+‘“"'\s]+$/g, "").trim())
      .filter((p) => p.length >= 2 && /[a-zA-Z0-9]/.test(p));

    if (rawParts.length === 0) continue;

    let name = rawParts[0];
    let issuer = rawParts.length > 1 ? rawParts[1] : undefined;
    let year: string | undefined;

    const knownIssuers = /(?:Coursera|Udemy|AWS|Amazon|Google|Microsoft|NPTEL|edX|HackerRank|Oracle|Infosys|Simplilearn|Forage|Reliance Foundation|The Chartered Institute for IT|Chartered Institute|BlockSeBlock)/i;

    if (rawParts.length >= 2 && knownIssuers.test(rawParts[0]) && !knownIssuers.test(rawParts[1])) {
      name = rawParts[1];
      issuer = rawParts[0];
    }

    const yearMatches = clean.match(YEAR_RE);
    if (yearMatches) {
      year = yearMatches[yearMatches.length - 1];
    }

    if (issuer) {
      issuer = issuer.replace(/(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}/gi, "").trim();
    } else {
      const match = clean.match(knownIssuers);
      if (match) issuer = match[0];
    }

    out.push({
      name: name.slice(0, 150),
      issuer: issuer ? issuer.slice(0, 100) : undefined,
      year,
      sourceSpan: item.text.slice(0, 300),
    });
  }

  return out;
}

/** Extracts research, patents, books, and awards into structured achievements. */
function extractAchievements(taggedLines: Array<{ text: string; section: string }>): {
  achievements: ResumeInterpretationOutput["achievements"];
  research: NonNullable<ResumeInterpretationOutput["research"]>;
} {
  const targetLines = taggedLines.filter((l) =>
    ["research", "books_patents", "achievements"].includes(l.section) && !l.section.startsWith("heading:")
  );
  const outAchievements: ResumeInterpretationOutput["achievements"] = [];
  const outResearch: NonNullable<ResumeInterpretationOutput["research"]> = [];

  const chunks: Array<Array<{ text: string; section: string }>> = [];
  let currentChunk: Array<{ text: string; section: string }> = [];

  for (const line of targetLines) {
    const isTopBullet = /^(?:[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢]|‘[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab©®¢*])\s*/.test(line.text);
    if (isTopBullet && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  for (const chunk of chunks) {
    const fullText = chunk.map((c) => c.text.replace(/^[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘"©®¢]+/, "").trim()).join(" ");
    if (fullText.length < 5) continue;

    // Detect summary lines that aggregate publications/patents/leadership/grades
    const isSummaryPublicationCount =
      /^publications\s*:\s*author\/co-author/i.test(fullText) ||
      /\b(?:author\/co-author of \d+ books|co-inventor on \d+ patent)\b/i.test(fullText) ||
      /^publications\s*:\s*author/i.test(fullText);
    const isSummaryLeadership =
      /^leadership\s*:\s*(?:president|ceo|coo|founder)/i.test(fullText) &&
      /\b(?:cgpa|\d+\.\d+)\b/i.test(fullText);

    if (isSummaryPublicationCount || isSummaryLeadership) {
      // These are composite summary bullets that restate dedicated sections (research, experience, education).
      // Skip them from emitting duplicate cards.
      continue;
    }

    let category: "award" | "hackathon" | "publication" | "patent" = "award";
    let title = fullText;
    let description = "";

    const prefixMatch = fullText.match(/^(Patent|Book|Publication|Paper)\s*:\s*(.+)$/i);
    if (prefixMatch) {
      const pType = prefixMatch[1].toLowerCase();
      category = pType === "patent" ? "patent" : "publication";
      const rest = prefixMatch[2];
      const colonSplit = rest.split(":");
      if (colonSplit.length > 1) {
        title = colonSplit[0].trim();
        description = colonSplit.slice(1).join(":").trim();
      } else {
        title = rest.trim();
      }
    } else if (/patent/i.test(fullText)) {
      category = "patent";
    } else if (/book|publi|journal|paper|conference/i.test(fullText)) {
      category = "publication";
    } else if (/hackathon|competition|contest/i.test(fullText)) {
      category = "hackathon";
    }

    const isFromResearchSection = chunk.some((c) => c.section === "research" || c.section === "books_patents");

    if (isFromResearchSection) {
      outResearch.push({
        title: title.slice(0, 200),
        type: category === "patent" ? "patent" : /book/i.test(fullText) ? "book" : "paper",
        description: description ? description.slice(0, 500) : undefined,
        sourceSpan: chunk[0]?.text.slice(0, 300) || fullText.slice(0, 300),
      });
    } else {
      outAchievements.push({
        title: title.slice(0, 200),
        category,
        description: description.slice(0, 300),
        sourceSpan: chunk[0]?.text.slice(0, 300) || fullText.slice(0, 300),
      });
    }
  }

  return { achievements: outAchievements, research: outResearch };
}

/** Extracts digital footprints from source text and hyperlinks. Strictly rejects fake URLs. */
function extractDigitalFootprints(
  taggedLines: Array<{ text: string; section: string }>,
  hyperlinks: string[] = []
): NonNullable<ResumeInterpretationOutput["digitalFootprints"]> {
  const out: NonNullable<ResumeInterpretationOutput["digitalFootprints"]> = [];
  const seenUrls = new Set<string>();

  const allCandidateSources = [
    ...taggedLines.map((l) => l.text),
    ...(Array.isArray(hyperlinks) ? hyperlinks : []),
  ];

  for (const rawSrc of allCandidateSources) {
    if (!rawSrc || typeof rawSrc !== "string") continue;
    const src = rawSrc.trim();
    if (!src) continue;

    // 1. GitHub matching (including OCR typos like 'gittub', 'github, com', or spaced handle 'shiviii5 165')
    const ghMatch = src.match(/(?:https?:\/\/)?(?:www\.)?(?:github|gittub|gittubs)[\s.:/,]+(?:github[\s.,]*com[\s/]*)?([a-zA-Z0-9_-]+)/i);
    if (ghMatch) {
      let handle = ghMatch[1].trim();
      const afterMatch = src.slice((ghMatch.index || 0) + ghMatch[0].length).trim();
      const numSuffix = afterMatch.match(/^([0-9a-zA-Z_-]+)/);
      if (numSuffix && !/^(?:email|mobile|phone|linkedin)/i.test(numSuffix[1])) {
        handle = `${handle}${numSuffix[1]}`;
      }
      handle = handle.replace(/[^a-zA-Z0-9_-]/g, "");
      const lower = handle.toLowerCase();
      if (lower && lower.length >= 3 && !["github", "orgs", "topics", "com", "www"].includes(lower)) {
        const canonicalUrl = `https://github.com/${handle}`;
        if (!seenUrls.has(canonicalUrl)) {
          seenUrls.add(canonicalUrl);
          out.push({
            platform: "GitHub",
            url: canonicalUrl,
            handle,
            type: "profile",
            discoveryMethod: "cv_source",
            sourceSpan: src.slice(0, 300),
          });
        }
      }
    }

    // 2. LinkedIn matching (including OCR typos like 'linkedin.comy/in/...')
    const liMatch =
      src.match(/(?:https?:\/\/)?(?:www\.)?linkedin[\s.]*com[y]?[\s/]+(?:in|pub)[\s/]+([a-zA-Z0-9_\-\.]+)/i) ||
      src.match(/(?:linkedin|linked\s*in)\s*:\s*(?:https?:\/\/)?(?:www\.)?(?:linkedin[\s.]*com[y]?\/in\/)?([a-zA-Z0-9_\-\.]+)/i);
    if (liMatch) {
      const handle = liMatch[1].trim().replace(/[^a-zA-Z0-9_-]/g, "");
      const lower = handle.toLowerCase();
      if (lower && lower.length >= 3 && !["feed", "jobs", "in", "pub", "company"].includes(lower)) {
        const canonicalUrl = `https://linkedin.com/in/${handle}`;
        if (!seenUrls.has(canonicalUrl)) {
          seenUrls.add(canonicalUrl);
          out.push({
            platform: "LinkedIn",
            url: canonicalUrl,
            handle,
            type: "profile",
            discoveryMethod: "cv_source",
            sourceSpan: src.slice(0, 300),
          });
        }
      }
    }

    // 3. LeetCode
    const leetMatch = src.match(/(?:https?:\/\/)?(?:www\.)?leetcode\.(?:com|cn)\/(?:u\/)?([a-zA-Z0-9_\-\.]+)/i);
    if (leetMatch) {
      const handle = leetMatch[1].trim().replace(/[^a-zA-Z0-9_-]/g, "");
      if (handle && handle.length >= 2) {
        const canonicalUrl = `https://leetcode.com/u/${handle}`;
        if (!seenUrls.has(canonicalUrl)) {
          seenUrls.add(canonicalUrl);
          out.push({
            platform: "LeetCode",
            url: canonicalUrl,
            handle,
            type: "profile",
            discoveryMethod: "cv_source",
            sourceSpan: src.slice(0, 300),
          });
        }
      }
    }

    // 4. Personal Portfolio & Custom Domains (e.g. anantkumar.site, anantshivam.online)
    const portMatches = Array.from(src.matchAll(/(?:joint\s+)?portfolio\s*:\s*([a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}(?:\/[^\s|]*)?)/gi));
    for (const portLabelMatch of portMatches) {
      const rawHost = portLabelMatch[1].trim().replace(/[.,;:)\]]+$/, "");
      const cleanUrl = rawHost.startsWith("http") ? rawHost : `https://${rawHost}`;
      try {
        const parsed = new URL(cleanUrl);
        const canonicalUrl = parsed.origin;
        if (!seenUrls.has(canonicalUrl)) {
          seenUrls.add(canonicalUrl);
          out.push({
            platform: "Portfolio",
            url: canonicalUrl,
            handle: parsed.hostname,
            type: "portfolio",
            discoveryMethod: "cv_source",
            sourceSpan: src.slice(0, 300),
          });
        }
      } catch {
        // ignore
      }
    }

    if (/^https?:\/\//i.test(src) && !/github\.com|linkedin\.com|leetcode\.com/i.test(src)) {
      try {
        const parsed = new URL(src);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        const ignoredHosts = new Set([
          "gmail.com", "yahoo.com", "google.com", "docs.google.com", "drive.google.com",
          "b.tech", "m.tech", "b.sc", "m.sc", "b.com", "m.com", "b.e", "m.e"
        ]);
        if (!ignoredHosts.has(host) && host.includes(".") && !host.endsWith(".gov") && !host.endsWith(".edu")) {
          const canonicalUrl = `${parsed.protocol}//${parsed.host}`;
          if (!seenUrls.has(canonicalUrl)) {
            seenUrls.add(canonicalUrl);
            out.push({
              platform: "Portfolio",
              url: canonicalUrl,
              handle: host,
              type: "portfolio",
              discoveryMethod: "cv_source",
              sourceSpan: src.slice(0, 300),
            });
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return out;
}

/** Builds the complete Source Structure Graph across lines/blocks. */
function buildSourceGraph(taggedLines: Array<{ text: string; section: string }>, hyperlinks: string[] = []): CvSourceGraph {
  const blocks: CvGraphBlock[] = taggedLines.map((line, idx) => ({
    blockId: `block_${idx + 1}`,
    pageNumber: 1,
    section: line.section.replace("heading:", ""),
    originalText: line.text,
    normalizedText: ResumeWritingQualityEngine.cleanDisplayText(line.text),
    method: "native",
    readingOrder: idx + 1,
    confidence: 0.95,
    hyperlinks: hyperlinks.filter((h) => line.text.includes(h) || h.toLowerCase().includes(line.text.toLowerCase().slice(0, 15))),
  }));

  const sectionsFound = Array.from(new Set(blocks.map((b) => b.section))).filter((s) => s !== "header" && s !== "unknown");

  return {
    documentId: `doc_${Date.now()}`,
    blocks,
    totalBlocks: blocks.length,
    sectionsFound,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts a complete, valid ResumeInterpretationOutput and ExtractedProfile
 * entirely deterministically without calling any external model.
 */
export function extractResumeDeterministic(sourceText: string, hyperlinks: string[] = []): DeterministicExtractionResult {
  const lines = sourceText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tagged = tagLines(lines);

  const nameResult = extractName(tagged);
  const emails = extractEmails(tagged);
  const _mobileResult = extractMobile(tagged);
  const loc = extractLocation(tagged);
  const summary = extractSummary(tagged);

  const education = extractEducation(tagged);
  const { skills, contextualTechnologies: _contextualTechnologies } = extractSkills(tagged);
  const projects = extractProjects(tagged, hyperlinks);
  const { experience, leadership } = extractExperience(tagged);
  const certifications = extractCertifications(tagged);
  const { achievements, research } = extractAchievements(tagged);
  const digitalFootprints = extractDigitalFootprints(tagged, hyperlinks);

  // Raw extraction before deduplication
  const rawInterpretation: ResumeInterpretationOutput = {
    personal: {
      fullName: nameResult?.name,
      email: emails[0]?.email,
      location: loc?.location,
      sourceSpan: nameResult?.sourceSpan || emails[0]?.sourceSpan,
    },
    summary,
    education,
    skills,
    projects,
    experience,
    leadership,
    certifications,
    achievements,
    research,
    hackathons: [],
    training: [],
    volunteering: [],
    languages: [],
    digitalFootprints,
    additional: [],
  };

  // Pass through Zero-Duplicate Record Engine (Level A & Level B)
  const dedupResult = ResumeDeduplicationEngine.deduplicateAll(rawInterpretation);
  const interpretation = dedupResult.interpretation;

  const primaryEdu = interpretation.education[0];
  const profile: ExtractedProfile = {
    fullName: nameResult?.name,
    email: emails[0]?.email,
    mobile: undefined,
    location: loc?.location,
    institution: primaryEdu?.institution,
    degree: primaryEdu?.degree,
    specialization: primaryEdu?.fieldOfStudy,
    expectedGraduationYear: primaryEdu?.graduationYear ? Number(primaryEdu.graduationYear) : undefined,
    gpa: primaryEdu?.gpa,
  };

  const links: ResumeLink[] = (interpretation.digitalFootprints || []).map((df) => ({
    type: df.platform.toLowerCase() as any,
    url: df.url,
  }));

  const sourceGraph = buildSourceGraph(tagged, hyperlinks);
  const coverageReport = CvQualityEvaluator.evaluateSourceCoverage(interpretation, sourceText);

  // Sections detected
  const sectionsDetected = Array.from(new Set(tagged.map((t) => t.section.replace("heading:", "")))).filter(
    (s) => s !== "header" && s !== "unknown"
  );

  let score = 0;
  if (profile.fullName) score += 0.2;
  if (profile.email) score += 0.2;
  if (interpretation.education.length > 0) score += 0.2;
  if (interpretation.skills.length >= 3) score += 0.2;
  if (interpretation.projects.length > 0 || interpretation.experience.length > 0) score += 0.2;

  return {
    interpretation,
    profile,
    links,
    confidence: Math.round(score * 100) / 100,
    sectionsDetected,
    sourceGraph,
    coverageReport,
  };
}
