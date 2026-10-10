/**
 * AI TATHASTU — DETERMINISTIC RESUME EXTRACTION ENGINE V3.9
 *
 * CRITICAL ARCHITECTURAL DECISION: STRICT ZERO-LLM RESUME EXTRACTION.
 * No generative LLM API calls, no multimodal LLM, no prompt router.
 * Pure deterministic document parsing, section recognition, regex heuristics,
 * versioned technology dictionaries, and structured validation.
 */

import { ExtractionValidator } from "./extraction-validator";
import { discoverDigitalFootprints, type DiscoveredFootprintsSummary } from "./digital-footprint-registry";
import type { ResumeInterpretationOutput } from "../intelligence/schemas";

export interface ExtractedPersonalDetails {
  fullName: string;
  email: string;
  mobile: string;
  location?: string;
  portfolioUrl?: string;
}

export interface ExtractedAcademicInfo {
  institution: string;
  degree: string;
  specialization?: string;
  currentYear?: string;
  expectedGraduationYear?: number;
  graduationYear?: string;
  gpa?: string;
  sourceSpan: string;
}

export interface StructuredExtractionCandidate {
  candidateId: string;
  category: "education" | "experience" | "project" | "skill" | "certification" | "research" | "profile";
  value: string;
  sourceSpan: string;
  ruleId: string;
  parserVersion: "v3.9-zero-llm";
  confidenceScore: number;
}

export interface DeterministicExtractionResult {
  extractedProfile: {
    fullName: string;
    email: string;
    mobile: string;
    degree?: string;
    specialization?: string;
    institution?: string;
    currentYear?: string;
    expectedGraduationYear?: number;
    gpa?: string;
  };
  discoveredProfiles: Partial<Record<string, string>>;
  discoveredRepositories: Array<{ url: string; owner: string; repo: string }>;
  structured: ResumeInterpretationOutput;
  candidates: StructuredExtractionCandidate[];
  sectionMap: Record<string, string[]>;
  documentId?: string;
  metadata: {
    engine: "DeterministicResumeExtractionEngine";
    version: "3.9.0";
    llmUsed: false;
    totalChars: number;
    linesCount: number;
    sectionsFound: string[];
  };
}

// ============================================================================
// 1. SECTION REGISTRY & BOUNDED STATE MACHINE
// ============================================================================

export interface SectionDefinition {
  id: string;
  canonicalName: string;
  pattern: RegExp;
}

export const SECTION_REGISTRY_V3_9: SectionDefinition[] = [
  {
    id: "contact",
    canonicalName: "Contact Details",
    pattern: /^(contact|contact information|personal details|contact details|personal info)$/i,
  },
  {
    id: "summary",
    canonicalName: "Professional Summary",
    pattern: /^(summary|professional summary|executive summary|about|about me|profile|biography|objective|career objective)$/i,
  },
  {
    id: "education",
    canonicalName: "Education",
    pattern: /^(education|academics|academic background|qualifications|academic qualifications|education\s*&\s*qualifications|educational background)$/i,
  },
  {
    id: "skills",
    canonicalName: "Technical Skills",
    pattern: /^(technical skills|skills|core competencies|key skills|skills\s*&\s*technologies|technical competencies|technical proficiencies|areas of expertise|technologies|tools\s*&\s*technologies)$/i,
  },
  {
    id: "projects",
    canonicalName: "Projects",
    pattern: /^(projects|key projects|academic projects|personal projects|technical projects|selected projects|software projects)$/i,
  },
  {
    id: "experience",
    canonicalName: "Experience",
    pattern: /^(experience|work experience|professional experience|employment|employment history|work history|relevant experience|internships|internship experience)$/i,
  },
  {
    id: "certifications",
    canonicalName: "Certifications",
    pattern: /^(certifications|certificates|licenses|courses\s*&\s*certifications|certifications\s*&\s*licenses)$/i,
  },
  {
    id: "achievements",
    canonicalName: "Achievements",
    pattern: /^(achievements|awards|honors|awards\s*&\s*achievements|accomplishments|honors\s*&\s*awards)$/i,
  },
  {
    id: "research",
    canonicalName: "Research & Publications",
    pattern: /^(research|publications|papers|research papers|patents|selected publications|research\s*&\s*publications)$/i,
  },
  {
    id: "profiles",
    canonicalName: "Digital Profiles",
    pattern: /^(links|profiles|online profiles|socials|web presence|digital footprints)$/i,
  },
];

function cleanLineForHeaderMatch(line: string): string {
  return line
    .replace(/^[*_#:\-•—–\s]+|[*_#:\-•—–\s]+$/g, "")
    .replace(/[:|]+$/, "")
    .trim();
}

function preprocessTwoColumnLines(lines: string[]): string[] {
  // Check if there is a multi-column block with | where section headers exist
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("|")) {
      const parts = line.split("|").map((p) => cleanLineForHeaderMatch(p));
      const hasHeader = parts.some((part) =>
        SECTION_REGISTRY_V3_9.some((sec) => sec.pattern.test(part))
      );
      if (hasHeader) {
        startIdx = i;
        break;
      }
    }
  }

  if (startIdx !== -1) {
    const prefix = lines.slice(0, startIdx);
    const leftCol: string[] = [];
    const rightCol: string[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      if (/^[-=_\s]{3,}$/.test(line)) continue;
      if (line.includes("|")) {
        const parts = line.split("|");
        const left = parts[0]?.trim();
        const right = parts.slice(1).join("|").trim();
        if (left) leftCol.push(left);
        if (right) rightCol.push(right);
      } else if (line.trim()) {
        leftCol.push(line.trim());
      }
    }
    return [...prefix, ...leftCol, ...rightCol];
  }

  return lines;
}

/**
 * Splits document text into clean, structured section blocks.
 */
export function segmentSections(rawText: string): {
  sectionMap: Record<string, string[]>;
  headerLines: string[];
} {
  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => Boolean(l) && !/^--\s*\d+\s+of\s+\d+\s*--$/.test(l));

  const lines = preprocessTwoColumnLines(rawLines);

  const sectionMap: Record<string, string[]> = {
    header: [],
  };

  let currentSection = "header";
  const headerLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleaned = cleanLineForHeaderMatch(line);

    // Check if line matches a known section header
    let matchedSection: string | null = null;
    if (cleaned.length <= 40) {
      for (const sec of SECTION_REGISTRY_V3_9) {
        if (sec.pattern.test(cleaned)) {
          matchedSection = sec.id;
          break;
        }
      }
    }

    if (matchedSection) {
      currentSection = matchedSection;
      if (!sectionMap[currentSection]) sectionMap[currentSection] = [];
      headerLines.push(line);
    } else {
      if (!sectionMap[currentSection]) sectionMap[currentSection] = [];
      sectionMap[currentSection].push(line);
    }
  }

  return { sectionMap, headerLines };
}

// ============================================================================
// 2. PERSONAL DETAILS EXTRACTOR
// ============================================================================

export function extractPersonalDetails(
  headerLines: string[],
  fullText: string
): ExtractedPersonalDetails {
  // 1. Email
  const emailMatch = fullText.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  const email = emailMatch ? emailMatch[1] : "";

  // 2. Phone / Mobile (with country code support, e.g. +91, +1, or standard 10 digits)
  const phoneMatch = fullText.match(
    /(?:(?:Mobile|Phone|Tel|Cell)[:\s]*)?(\+?\d{1,4}[-.\s]?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}\b)/i
  );
  let mobile = "";
  if (phoneMatch) {
    const candidate = phoneMatch[1] || phoneMatch[0];
    const digitsOnly = candidate.replace(/\D/g, "");
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      mobile = candidate.trim();
    }
  }

  // 3. Name candidate: check top 5 lines of document before any section
  let fullName = "";
  for (const line of headerLines.slice(0, 6)) {
    const cleaned = line.replace(/[*_#:`]/g, "").trim();
    if (!cleaned || cleaned.includes("@") || /\d/.test(cleaned)) continue;
    if (/curriculum|resume|vitae|contact|phone|email|profile|github|linkedin|portfolio/i.test(cleaned)) continue;

    const words = cleaned.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && cleaned.length >= 4 && cleaned.length <= 45) {
      // Must look like a name (letters, hyphens, periods, spaces)
      if (/^[\p{L}.'’\- ]+$/u.test(cleaned)) {
        fullName = cleaned;
        break;
      }
    }
  }

  return {
    fullName,
    email,
    mobile,
  };
}

// ============================================================================
// 3. EDUCATION EXTRACTOR
// ============================================================================

const DEGREE_PATTERNS = [
  { regex: /\b(B\.?\s*Tech(?:\.|nology)?(?:\s+in\s+[^,–—\n]+)?)\b/i, name: "B.Tech" },
  { regex: /\b(B\.?\s*E\.?(?:\s+in\s+[^,–—\n]+)?)\b/i, name: "B.E." },
  { regex: /\b(M\.?\s*Tech(?:\.|nology)?(?:\s+in\s+[^,–—\n]+)?)\b/i, name: "M.Tech" },
  { regex: /\b(Bachelor\s+of\s+(?:Technology|Science|Engineering|Computer\s+Applications))(?:\s+in\s+[^,–—\n]+)?\b/i, name: "Bachelor's" },
  { regex: /\b(Master\s+of\s+(?:Technology|Science|Engineering|Computer\s+Applications))(?:\s+in\s+[^,–—\n]+)?\b/i, name: "Master's" },
  { regex: /\b(B\.?S\.?c?|B\.?C\.?A\.?)\b/i, name: "B.Sc" },
  { regex: /\b(M\.?S\.?c?|M\.?C\.?A\.?)\b/i, name: "M.Sc" },
  { regex: /\b(Ph\.?\s*D\.?|Doctor\s+of\s+Philosophy)\b/i, name: "Ph.D." },
  { regex: /\b(High\s+School|Senior\s+Secondary|Intermediate|CBSE|ICSE)\b/i, name: "High School" },
];

const INSTITUTION_KEYWORDS = [
  "University",
  "Institute",
  "College",
  "School",
  "Academy",
  "IIT",
  "NIT",
  "IIIT",
  "BITS",
  "LPU",
  "Lovely Professional University",
  "Stanford",
  "MIT",
  "Berkeley",
  "Carnegie Mellon",
  "Polytechnic",
];

export function extractEducationEntries(lines: string[]): ExtractedAcademicInfo[] {
  const entries: ExtractedAcademicInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 5) continue;

    // Look for degree match
    let detectedDegree = "";
    for (const deg of DEGREE_PATTERNS) {
      const match = line.match(deg.regex);
      if (match) {
        detectedDegree = match[1] || deg.name;
        break;
      }
    }

    // Look for institution match
    let detectedInst = "";
    for (const inst of INSTITUTION_KEYWORDS) {
      if (new RegExp(`\\b${inst}\\b`, "i").test(line)) {
        detectedInst = inst;
        break;
      }
    }

    // If degree or institution found, build entry with lookahead
    if (detectedDegree || detectedInst) {
      const blockLines = [line];
      for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
        const nextLine = lines[j];
        const nextHasDegree = DEGREE_PATTERNS.some((d) => d.regex.test(nextLine));
        const nextHasInst = INSTITUTION_KEYWORDS.some((inst) => new RegExp(`\\b${inst}\\b`, "i").test(nextLine));
        if (nextHasDegree || nextHasInst) break;
        blockLines.push(nextLine);
      }

      const combinedBlock = blockLines.join(", ");

      // Look for dates
      const yearRange = combinedBlock.match(/\b(20\d\d)\s*[-–—to]+\s*(20\d\d|present|expected|current)\b/i);
      const singleYear = combinedBlock.match(/\b(20\d\d)\b/);
      const gradYearStr = yearRange ? yearRange[2] : singleYear ? singleYear[1] : undefined;
      const gradYearNum = gradYearStr && /^\d{4}$/.test(gradYearStr) ? parseInt(gradYearStr, 10) : undefined;

      // Look for GPA / CGPA
      const gpaMatch = combinedBlock.match(/\b(?:CGPA|GPA|Score|Percentage)\s*[:=\-]?\s*([0-9.]+(?:\s*\/\s*[0-9.]+)?%?)/i) ||
                       combinedBlock.match(/\b([0-9]\.[0-9]{1,2}\s*\/\s*(?:10|4(?:\.0)?))\b/);
      const gpa = gpaMatch ? gpaMatch[1] : undefined;

      // Specialization
      const specMatch = combinedBlock.match(/\b(?:in|major in|specialization in)\s+([A-Za-z\s&]{4,40})(?:[,–—\n]|$)/i);
      const specialization = specMatch ? specMatch[1].trim() : undefined;

      const institution = detectedInst
        ? (line.split(/[,–—|]/).find((p) => new RegExp(detectedInst, "i").test(p))?.trim() || detectedInst)
        : (line.split(/[,–—|]/)[0]?.trim() || "University");

      const degree = detectedDegree || "Bachelor's Degree";

      // Current Year inference
      let currentYear = "";
      if (yearRange && /present|current/i.test(yearRange[2])) {
        const startYear = parseInt(yearRange[1], 10);
        const currentYearNum = new Date().getFullYear();
        const diff = currentYearNum - startYear + 1;
        if (diff === 1) currentYear = "1st Year";
        else if (diff === 2) currentYear = "2nd Year";
        else if (diff === 3) currentYear = "3rd Year";
        else if (diff >= 4) currentYear = "4th Year";
      }

      entries.push({
        institution: institution.slice(0, 100),
        degree: degree.slice(0, 100),
        specialization: specialization?.slice(0, 80),
        currentYear,
        expectedGraduationYear: gradYearNum,
        graduationYear: gradYearStr,
        gpa,
        sourceSpan: combinedBlock.slice(0, 250),
      });

      if (entries.length >= 4) break;
    }
  }

  return entries;
}

// ============================================================================
// 4. TECHNICAL SKILLS TAXONOMY & EXTRACTOR
// ============================================================================

interface SkillTaxonomyEntry {
  name: string;
  category: "language" | "framework" | "library" | "tool" | "concept" | "other";
  aliases?: string[];
  requiresBoundary?: boolean;
}

export const TECH_TAXONOMY_V3_9: SkillTaxonomyEntry[] = [
  // Programming Languages
  { name: "Python", category: "language", aliases: ["python3"] },
  { name: "TypeScript", category: "language", aliases: ["ts"] },
  { name: "JavaScript", category: "language", aliases: ["js", "es6"] },
  { name: "C++", category: "language", aliases: ["cpp"], requiresBoundary: true },
  { name: "C", category: "language", requiresBoundary: true },
  { name: "Java", category: "language", requiresBoundary: true },
  { name: "Go", category: "language", aliases: ["golang"], requiresBoundary: true },
  { name: "Rust", category: "language" },
  { name: "R", category: "language", requiresBoundary: true },
  { name: "SQL", category: "language", aliases: ["postgresql", "mysql", "sqlite"] },
  { name: "Bash", category: "language", aliases: ["shell", "zsh"] },
  { name: "Kotlin", category: "language" },
  { name: "Swift", category: "language" },
  { name: "HTML", category: "language", aliases: ["html5"] },
  { name: "CSS", category: "language", aliases: ["css3"] },

  // AI/ML Frameworks & Libraries
  { name: "PyTorch", category: "framework", aliases: ["torch"] },
  { name: "TensorFlow", category: "framework", aliases: ["tf", "keras"] },
  { name: "Scikit-learn", category: "library", aliases: ["sklearn"] },
  { name: "Hugging Face", category: "framework", aliases: ["transformers", "diffusers"] },
  { name: "LangChain", category: "framework" },
  { name: "LlamaIndex", category: "framework" },
  { name: "OpenCV", category: "library", aliases: ["cv2"] },
  { name: "Pandas", category: "library" },
  { name: "NumPy", category: "library" },
  { name: "SciPy", category: "library" },
  { name: "Matplotlib", category: "library" },
  { name: "Seaborn", category: "library" },
  { name: "XGBoost", category: "library" },
  { name: "LightGBM", category: "library" },
  { name: "CatBoost", category: "library" },
  { name: "JAX", category: "framework" },
  { name: "spaCy", category: "library" },
  { name: "NLTK", category: "library" },
  { name: "FastAI", category: "framework" },
  { name: "ONNX", category: "tool" },

  // Web & Backend Frameworks
  { name: "React", category: "framework", aliases: ["react.js", "reactjs"] },
  { name: "Next.js", category: "framework", aliases: ["nextjs"] },
  { name: "FastAPI", category: "framework" },
  { name: "Node.js", category: "framework", aliases: ["nodejs"] },
  { name: "Express", category: "framework", aliases: ["express.js"] },
  { name: "Django", category: "framework" },
  { name: "Flask", category: "framework" },
  { name: "Tailwind CSS", category: "framework", aliases: ["tailwindcss"] },

  // Databases & Vector Stores
  { name: "PostgreSQL", category: "tool", aliases: ["postgres"] },
  { name: "Neon", category: "tool" },
  { name: "MongoDB", category: "tool", aliases: ["mongo"] },
  { name: "Redis", category: "tool" },
  { name: "ChromaDB", category: "tool", aliases: ["chroma"] },
  { name: "Pinecone", category: "tool" },
  { name: "Qdrant", category: "tool" },
  { name: "SQLite", category: "tool" },

  // Dev & Cloud Tools
  { name: "Git", category: "tool", requiresBoundary: true },
  { name: "GitHub", category: "tool" },
  { name: "Docker", category: "tool" },
  { name: "Kubernetes", category: "tool", aliases: ["k8s"] },
  { name: "Linux", category: "tool", aliases: ["ubuntu"] },
  { name: "AWS", category: "tool", aliases: ["amazon web services"] },
  { name: "GCP", category: "tool", aliases: ["google cloud"] },
  { name: "Azure", category: "tool" },
  { name: "Vercel", category: "tool" },
  { name: "Render", category: "tool" },
  { name: "CI/CD", category: "tool", aliases: ["github actions"] },

  // AI/ML Core Concepts
  { name: "Deep Learning", category: "concept" },
  { name: "Machine Learning", category: "concept", aliases: ["ml"] },
  { name: "Computer Vision", category: "concept", aliases: ["cv"] },
  { name: "Natural Language Processing", category: "concept", aliases: ["nlp"] },
  { name: "Reinforcement Learning", category: "concept", aliases: ["rl"] },
  { name: "Data Structures & Algorithms", category: "concept", aliases: ["dsa"] },
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractSkills(
  skillLines: string[],
  fullText: string
): ResumeInterpretationOutput["skills"] {
  const results: ResumeInterpretationOutput["skills"] = [];
  const seen = new Set<string>();

  const skillText = skillLines.join("\n");

  for (const entry of TECH_TAXONOMY_V3_9) {
    const candidates = [entry.name, ...(entry.aliases || [])];

    let matched = false;
    let matchedSpan = "";

    for (const term of candidates) {
      let regex: RegExp;
      if (term.length === 1 || (entry.requiresBoundary && term.length <= 2)) {
        // Strict word boundary with case-sensitivity for single-letter identifiers (e.g. "C", "R")
        regex = new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(term)}(?![a-zA-Z0-9])`, term.length === 1 ? "s" : "i");
      } else {
        regex = new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(term)}(?![a-zA-Z0-9])`, "i");
      }

      // Check in lines to extract sourceSpan
      for (const line of (skillLines.length > 0 ? skillLines : fullText.split(/\r?\n/))) {
        if (regex.test(line)) {
          // Validate using ExtractionValidator (filters out negations and aspirational claims)
          const valRes = ExtractionValidator.validateSkillClaim(entry.name, line, undefined, term);
          if (valRes.valid) {
            matched = true;
            matchedSpan = line.slice(0, 200);
            break;
          }
        }
      }

      if (matched) break;
    }

    if (matched && !seen.has(entry.name.toLowerCase())) {
      seen.add(entry.name.toLowerCase());
      results.push({
        name: entry.name,
        category: entry.category,
        proficiencyHint: "intermediate",
        sourceSpan: matchedSpan,
      });
    }
  }

  return results;
}

// ============================================================================
// 5. PROJECTS EXTRACTOR
// ============================================================================

export function extractProjects(
  projectLines: string[],
  discoveredRepos: Array<{ url: string; owner: string; repo: string }>
): ResumeInterpretationOutput["projects"] {
  const projects: ResumeInterpretationOutput["projects"] = [];

  interface RawProjectBlock {
    title: string;
    description: string;
    lines: string[];
    repoUrl?: string;
  }

  const blocks: RawProjectBlock[] = [];
  let currentBlock: RawProjectBlock | null = null;

  for (const line of projectLines) {
    const isNumberedTitle = /^\d+[\.)]\s+[A-Za-z]/.test(line) && line.length <= 80 && !line.endsWith(".");
    const isBullet = (/^[•\-*–—]\s*/.test(line) || /^\d+\.\s*/.test(line)) && !isNumberedTitle;
    const hasRepo = /github\.com\/[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+/i.test(line);
    const isUrl = /^https?:\/\//i.test(line) || /^github\.com\//i.test(line);

    // If it is a bold/distinct short title line without bullets, and NOT a URL
    if ((!isBullet || isNumberedTitle) && !isUrl && line.length <= 80 && !line.endsWith(".")) {
      if (currentBlock) blocks.push(currentBlock);
      const titleClean = line.replace(/^\d+[\.)]\s+/, "").replace(/^[*_#:\s]+|[*_#:\s]+$/g, "");
      currentBlock = {
        title: titleClean,
        description: "",
        lines: [line],
      };
    } else if (currentBlock) {
      currentBlock.lines.push(line);
      if (hasRepo && !currentBlock.repoUrl) {
        const repoMatch = line.match(/https?:\/\/github\.com\/[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+/i);
        if (repoMatch) currentBlock.repoUrl = repoMatch[0];
      }
      if (!isUrl) {
        const cleanedLine = line.replace(/^[•\-*–—\d.]+\s*/, "").trim();
        currentBlock.description = (currentBlock.description + " " + cleanedLine).trim();
      }
    } else {
      // First line if it starts directly
      currentBlock = {
        title: line.replace(/^[•\-*–—\d.]+\s*/, "").slice(0, 60),
        description: line,
        lines: [line],
      };
      if (hasRepo && !currentBlock.repoUrl) {
        const repoMatch = line.match(/https?:\/\/github\.com\/[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+/i);
        if (repoMatch) currentBlock.repoUrl = repoMatch[0];
      }
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  // Match blocks to discovered repos where possible
  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    const matchingRepo = b.repoUrl || discoveredRepos[idx]?.url;

    // Detect technologies used in this project
    const techs: string[] = [];
    for (const t of TECH_TAXONOMY_V3_9) {
      const candidates = [t.name, ...(t.aliases || [])];
      for (const cand of candidates) {
        if (cand.length <= 2 && !t.requiresBoundary) continue;
        if (new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(cand)}(?![a-zA-Z0-9])`, "i").test(b.description + " " + b.title)) {
          techs.push(t.name);
          break;
        }
      }
    }

    const valRes = ExtractionValidator.validateProjectClaim(b.title, b.lines[0] || b.title);
    if (valRes.valid) {
      projects.push({
        title: valRes.normalizedValue,
        description: b.description.slice(0, 300),
        technologies: techs,
        repositoryUrl: matchingRepo || undefined,
        sourceSpan: (b.lines[0] || b.title).slice(0, 250),
      });
    }

    if (projects.length >= 8) break;
  }

  return projects;
}

// ============================================================================
// 6. EXPERIENCE EXTRACTOR
// ============================================================================

export function extractExperience(lines: string[]): ResumeInterpretationOutput["experience"] {
  const experiences: ResumeInterpretationOutput["experience"] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 5 || /^[•\-*]/.test(line)) continue;

    const parts = line.split(/[—–|,]|\sat\s|\s-\s/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const role = parts[0];
      const company = parts[1];

      // Date in line or next line
      const dateMatch = line.match(/\b(?:20\d\d|present|current|intern|full[- ]time)\b/i);

      experiences.push({
        role: role.slice(0, 80),
        company: company.slice(0, 80),
        duration: dateMatch ? dateMatch[0] : undefined,
        highlights: [],
        sourceSpan: line.slice(0, 250),
      });

      if (experiences.length >= 5) break;
    }
  }

  return experiences;
}

// ============================================================================
// 7. CERTIFICATIONS EXTRACTOR
// ============================================================================

export function extractCertifications(lines: string[]): ResumeInterpretationOutput["certifications"] {
  const certs: ResumeInterpretationOutput["certifications"] = [];

  for (const line of lines) {
    if (line.length < 5) continue;
    const cleaned = line.replace(/^[•\-*–—\d.]+\s*/, "").trim();
    const parts = cleaned.split(/\sby\s|\sfrom\s|[—–|-]/i).map((p) => p.trim()).filter(Boolean);

    const name = parts[0] || cleaned;
    const issuer = parts[1] || undefined;
    const yearMatch = cleaned.match(/\b(20\d\d)\b/);

    certs.push({
      name: name.slice(0, 100),
      issuer: issuer ? issuer.slice(0, 80) : undefined,
      year: yearMatch ? yearMatch[1] : undefined,
      sourceSpan: line.slice(0, 250),
    });

    if (certs.length >= 6) break;
  }

  return certs;
}

// ============================================================================
// 8. CANONICAL ZERO-LLM EXTRACTION ENGINE
// ============================================================================

export class DeterministicResumeExtractionEngine {
  /**
   * Main entrypoint to extract structured data from raw document text and links.
   * STRICT ZERO-LLM: No AI endpoints, prompt templates, or router dependencies.
   */
  public static extract(
    text: string,
    options: {
      extraHyperlinks?: string[];
      documentId?: string;
    } = {}
  ): DeterministicExtractionResult {
    const rawText = text || "";
    const extraHyperlinks = options.extraHyperlinks || [];

    // Step 1: Section segmentation
    const { sectionMap } = segmentSections(rawText);
    const sectionsFound = Object.keys(sectionMap).filter((k) => sectionMap[k].length > 0);

    // Step 2: Digital Footprint discovery
    const footprints: DiscoveredFootprintsSummary = discoverDigitalFootprints(rawText, extraHyperlinks);

    // Step 3: Field-level extractions
    const personal = extractPersonalDetails(sectionMap.header || [], rawText);
    const educationEntries = extractEducationEntries(sectionMap.education || []);
    const skills = extractSkills(sectionMap.skills || [], rawText);
    const projects = extractProjects(sectionMap.projects || [], footprints.repositories);
    const experience = extractExperience(sectionMap.experience || []);
    const certifications = extractCertifications(sectionMap.certifications || []);

    // Step 4: Pick best academic profile
    const primaryEdu = educationEntries[0];

    // Step 5: Build structured output
    const structured: ResumeInterpretationOutput = {
      education: educationEntries.map((e) => ({
        institution: e.institution,
        degree: e.degree,
        fieldOfStudy: e.specialization,
        graduationYear: e.graduationYear,
        sourceSpan: e.sourceSpan,
      })),
      skills,
      projects,
      experience,
      certifications,
    };

    // Step 6: Build structured candidate ledger
    const candidates: StructuredExtractionCandidate[] = [];
    let candIdx = 0;

    const addCandidate = (
      category: StructuredExtractionCandidate["category"],
      value: string,
      sourceSpan: string,
      ruleId: string,
      confidence: number
    ) => {
      candidates.push({
        candidateId: `${category}_${candIdx++}`,
        category,
        value,
        sourceSpan,
        ruleId,
        parserVersion: "v3.9-zero-llm",
        confidenceScore: confidence,
      });
    };

    if (personal.fullName) {
      addCandidate("profile", personal.fullName, personal.fullName, "name_positional_v3_9", 1.0);
    }
    if (primaryEdu) {
      addCandidate("education", `${primaryEdu.degree} · ${primaryEdu.institution}`, primaryEdu.sourceSpan, "edu_dictionary_v3_9", 1.0);
    }
    for (const s of skills) {
      addCandidate("skill", s.name, s.sourceSpan, "skill_taxonomy_v3_9", 1.0);
    }
    for (const p of projects) {
      addCandidate("project", p.title, p.sourceSpan, "project_block_v3_9", 0.95);
    }
    for (const e of experience) {
      addCandidate("experience", `${e.role} · ${e.company}`, e.sourceSpan, "exp_role_company_v3_9", 0.9);
    }
    for (const c of certifications) {
      addCandidate("certification", c.name, c.sourceSpan, "cert_line_v3_9", 0.9);
    }
    for (const [platform, url] of Object.entries(footprints.profiles)) {
      if (url) {
        addCandidate("profile", `${platform}: ${url}`, url, "footprint_url_v3_9", 1.0);
      }
    }

    return {
      extractedProfile: {
        fullName: personal.fullName,
        email: personal.email,
        mobile: personal.mobile,
        degree: primaryEdu?.degree,
        specialization: primaryEdu?.specialization,
        institution: primaryEdu?.institution,
        currentYear: primaryEdu?.currentYear,
        expectedGraduationYear: primaryEdu?.expectedGraduationYear,
        gpa: primaryEdu?.gpa,
      },
      discoveredProfiles: footprints.profiles,
      discoveredRepositories: footprints.repositories,
      structured,
      candidates,
      sectionMap,
      documentId: options.documentId,
      metadata: {
        engine: "DeterministicResumeExtractionEngine",
        version: "3.9.0",
        llmUsed: false,
        totalChars: rawText.length,
        linesCount: rawText.split(/\r?\n/).length,
        sectionsFound,
      },
    };
  }
}
