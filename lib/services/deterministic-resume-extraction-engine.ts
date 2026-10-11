/**
 * AI TATHASTU — DETERMINISTIC RESUME EXTRACTION ENGINE V4.0 (V5.0.4 Release)
 *
 * CRITICAL ARCHITECTURAL DECISION: STRICT ZERO-LLM RESUME EXTRACTION.
 * No generative LLM API calls, no multimodal LLM, no prompt router.
 * Pure deterministic document parsing, section recognition, regex heuristics,
 * versioned technology dictionaries, and structured validation.
 *
 * V5.0.4 CHANGES:
 *  - 8-pass deterministic architecture with expanded section registry
 *  - Education grouping fix: bullet-after-bullet institution→degree now groups correctly
 *  - Experience Format C: unbulleted org header → bulleted role
 *  - Experience Format D: Dataset A "Role\nDate Company City, State" pattern
 *  - Name disambiguation: occupational title words blocked from name extraction
 *  - Expanded DEGREE_PATTERNS: BSN, ADN, AA, AS, BA, BS, BCom, MCom, Intermediate, Matriculation
 *  - Expanded INSTITUTION_KEYWORDS: Complex, Residential, Vidyalaya, etc.
 *  - Domain skills tokenization from explicit non-tech skills sections
 *  - Full provenance: ruleId, confidenceScore, sourceSpan, candidateId
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
  startDate?: string;
  endDate?: string;
  currentYear?: string;
  expectedGraduationYear?: number;
  graduationYear?: string;
  gpa?: string;
  percentage?: string;
  academicLevel?: "undergraduate" | "postgraduate" | "doctorate" | "diploma" | "high_school" | "other";
  sourceSpan: string;
}

export interface StructuredExtractionCandidate {
  candidateId: string;
  category: "education" | "experience" | "project" | "skill" | "certification" | "research" | "profile" | "achievement";
  value: string;
  sourceSpan: string;
  ruleId: string;
  parserVersion: "v4.0-zero-llm";
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
    version: "4.0.0";
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
    pattern: /^(summary|professional summary|executive summary|about|about me|profile|biography|objective|career objective|personal profile)$/i,
  },
  {
    id: "education",
    canonicalName: "Education",
    pattern: /^(education|academics|academic background|qualifications|academic qualifications|education\s*&\s*qualifications|educational background|education\s+and\s+training|education\s*[\/&]\s*training|education\s+history)$/i,
  },
  {
    id: "skills",
    canonicalName: "Technical Skills",
    pattern: /^(technical skills|skills|special skills|skills summary|skills\s*&\s*tools|core competencies|key competencies|key skills|skills\s*&\s*technologies|technical competencies|technical proficiencies|areas of expertise|expertise|technologies|tools\s*&\s*technologies|technical summary)$/i,
  },
  {
    id: "projects",
    canonicalName: "Projects",
    pattern: /^(projects|key projects|academic projects|personal projects|technical projects|selected projects|selected projects\s*&\s*client work|projects\s*&\s*client work|client work|software projects)$/i,
  },
  {
    id: "experience",
    canonicalName: "Experience",
    pattern: /^(experience|work experience|professional experience|experience\s*&\s*leadership|leadership\s*&\s*experience|leadership|employment|employment history|work history|relevant experience|internships|internship experience|teaching experience|operational experience)$/i,
  },
  {
    id: "certifications",
    canonicalName: "Certifications",
    pattern: /^(certifications|certificates|licenses|courses\s*&\s*certifications|certifications\s*&\s*licenses)$/i,
  },
  {
    id: "achievements",
    canonicalName: "Achievements",
    pattern: /^(achievements|awards|honors|awards\s*&\s*achievements|achievements\s*&\s*awards|accomplishments|honors\s*&\s*awards|honors\s*&\s*scholarships|publications\s*&\s*awards|publications\s*&\s*honors|patents\s*&\s*honors|certifications\s*&\s*awards)$/i,
  },
  {
    id: "research",
    canonicalName: "Research & Publications",
    pattern: /^(research|publications|papers|research papers|patents|selected publications|research\s*&\s*publications|research\s*,\s*patents\s*&\s*books|research\s*&\s*patents|patents\s*&\s*books|books\s*&\s*publications|patents\s*&\s*inventions|publications\s*&\s*patents|patents\s*&\s*publications)$/i,
  },
  {
    id: "profiles",
    canonicalName: "Digital Profiles",
    pattern: /^(links|profiles|online profiles|socials|web presence|digital footprints)$/i,
  },
];

function cleanLineForHeaderMatch(line: string): string {
  let cleaned = line
    .replace(/^[*_#:\-•—–~`‘'“"\\=\s]+|[*_#:\-•—–~`‘'“"\\=\s]+$/g, "")
    .replace(/[:|]+$/, "")
    .trim();

  // Normalize track-spaced small caps: "S ELECTED P ROJECTS & C LIENT W ORK" -> "SELECTED PROJECTS & CLIENT WORK"
  cleaned = cleaned.replace(/\b([A-Za-z])\s+([A-Za-z]{2,})\b/g, "$1$2");
  // Normalize fully spaced letters: "E D U C A T I O N" -> "EDUCATION"
  cleaned = cleaned.replace(/\b([A-Za-z]\s+){2,}[A-Za-z]\b/g, (m) => m.replace(/\s+/g, ""));
  // Normalize punctuation spacing
  cleaned = cleaned.replace(/\s*,\s*/g, ", ");
  cleaned = cleaned.replace(/\s*&\s*/g, " & ");

  return cleaned.trim();
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

  // 3. Name candidate: check top 6 lines of document before any section
  // V5.0.4: occupational title words must not be extracted as names
  const OCCUPATIONAL_TITLE_WORDS = /\b(?:NURSE|NURSING|REP|OFFICER|TECHNICIAN|ENGINEER|MANAGER|ASSISTANT|SPECIALIST|DEVELOPER|DIRECTOR|CONSULTANT|ANALYST|ARCHITECT|DESIGNER|COORDINATOR|SUPERVISOR|ADMINISTRATOR|ACCOUNTANT|TEACHER|PROFESSOR|PHYSICIAN|THERAPIST|COUNSELOR|SECRETARY|PROGRAMMER|SCIENTIST|RESEARCHER|INTERN|ASSOCIATE|EXECUTIVE|PRESIDENT|DRIVER|OPERATOR|MECHANIC|PLANNER|SCHEDULER|AGENT|BROKER|AUDITOR|TRAINER|CHEF|COOK|PHARMACIST|TECHNOLOGIST|RADIOLOGIST|PATHOLOGIST|PEDIATRICIAN|SURGEON|DENTIST|ATTORNEY|PARALEGAL|INSPECTOR|INVESTIGATOR|SOCIAL WORKER|PUBLIC RELATIONS|CUSTOMER SERVICE|PATIENT ACCESS|CLAIMS|BILLING)\b/i;

  let fullName = "";
  for (const line of headerLines.slice(0, 6)) {
    // Support names sharing the line with contact details (e.g. "Alex Morgan Email: alex@example.test")
    const beforeContact = line
      .split(/\b(?:Email|Mail|Phone|Mobile|Tel|LinkedIn|Github|Portfolio)\b|[:|•–—\-]|\b[a-zA-Z0-9._%+-]+@/i)[0]
      .trim();
    const cleaned = (beforeContact || line).replace(/[*_#:`]/g, "").trim();
    if (!cleaned || /\d/.test(cleaned)) continue;
    if (/curriculum|resume|vitae|contact|phone|email|profile|github|linkedin|portfolio/i.test(cleaned)) continue;
    // V5.0.4: Skip lines that are occupational job titles (all-caps or mixed)
    if (OCCUPATIONAL_TITLE_WORDS.test(cleaned)) continue;

    const words = cleaned.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && cleaned.length >= 4 && cleaned.length <= 45) {
      // Must look like a name (letters, hyphens, periods, spaces)
      if (/^[\p{L}.''\- ]+$/u.test(cleaned)) {
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

const DEGREE_PATTERNS: Array<{
  regex: RegExp;
  name: string;
  level: "undergraduate" | "postgraduate" | "doctorate" | "diploma" | "high_school" | "other";
}> = [
  // Doctorate
  { regex: /\b(Ph\.?\s*D\.?|Doctor\s+of\s+Philosophy|D\.?\s*Sc\.?)\b/i, name: "Ph.D.", level: "doctorate" },
  // Postgraduate
  { regex: /\b(M\.?\s*Tech(?:\.|nology)?(?:\s+in\s+[^,–—\n]+)?)\b/i, name: "M.Tech", level: "postgraduate" },
  { regex: /\b(Master\s+of\s+(?:Technology|Science|Engineering|Computer\s+Applications|Business\s+Administration|Commerce|Arts|Fine\s+Arts|Nursing|Laws))(?:\s+in\s+[^,–—\n]+)?\b/i, name: "Master's", level: "postgraduate" },
  { regex: /\b(M\.?\s*S\.?c?\.?|M\.?C\.?A\.?|M\.?B\.?A\.?|M\.?Com\.?|M\.?A\.?(?=\s|$|,)|M\.?\s*N\.?|M\.?\s*S\.?N\.?)\b/i, name: "M.Sc", level: "postgraduate" },
  // Undergraduate
  { regex: /\b(B\.?\s*Tech(?:\.|nology)?(?:\s+in\s+[^,–—\n]+)?)\b/i, name: "B.Tech", level: "undergraduate" },
  { regex: /\b(B\.?\s*E\.?(?:\s+in\s+[^,–—\n]+)?)\b/i, name: "B.E.", level: "undergraduate" },
  { regex: /\b(Bachelor\s+of\s+(?:Technology|Science|Engineering|Computer\s+Applications|Arts|Commerce|Nursing|Laws|Social\s+Work))(?:\s+in\s+[^,–—\n]+)?\b/i, name: "Bachelor's", level: "undergraduate" },
  { regex: /\b(B\.?S\.?[Nc]?\.?|B\.?C\.?A\.?|B\.?B\.?A\.?|B\.?Com\.?|B\.?A\.?(?=\s|$|,)|A\.?D\.?N\.?|A\.?A\.?S?\.?(?=\s|$|,)|B\.?S\.?N\.?)\b/i, name: "B.Sc", level: "undergraduate" },
  // Diploma
  { regex: /\b(Diploma(?:\s+in\s+[^,–—\n]+)?|Polytechnic|Post\s*Graduate\s*Diploma(?:\s+in\s+[^,–—\n]+)?)\b/i, name: "Diploma", level: "diploma" },
  // High School (Senior)
  { regex: /\b(Senior\s+Secondary(?:\s*\([^)]+\))?|Class\s*(?:XII|12(?:th)?)|Intermediate(?:\s+(?:Science|Commerce|Arts|PCM|PCB|PCMB))?|CBSE\s*\(?Class\s*XII\)?|ICSE\s*\(?Class\s*XII\)?|Higher\s+Secondary|12th\s+Grade|Plus\s+Two|HSC)\b/i, name: "Senior Secondary (Class XII)", level: "high_school" },
  // High School (Junior)
  { regex: /\b(Secondary\s+School(?:\s*\([^)]+\))?|Class\s*(?:X(?!I)|10(?:th)?)|Matriculation|CBSE\s*\(?Class\s*X\)?|ICSE\s*\(?Class\s*X\)?|High\s+School\s+Diploma|10th\s+Grade|SSC(?=\s|$|,))\b/i, name: "Secondary (Class X)", level: "high_school" },
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
  "Public School",
  "Vidya Mandir",
  "Central School",
  "Kendriya Vidyalaya",
  "Junior College",
  "Inter College",
  "DPS",
  "DAV",
  // V5.0.4 additions — genuine institution identifiers only
  "Complex",
  "Residential",
  "Vidyalaya",
  "Gyan Bharti",
  "Navodaya",
  "Montessori",
  "Convent",
];

export function extractEducationEntries(lines: string[]): ExtractedAcademicInfo[] {
  const entries: ExtractedAcademicInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line || line.length < 5) continue;

    // Look for degree match
    let detectedDegree = "";
    let detectedLevel: ExtractedAcademicInfo["academicLevel"] = undefined;
    for (const deg of DEGREE_PATTERNS) {
      const match = line.match(deg.regex);
      if (match) {
        detectedDegree = match[1] || deg.name;
        detectedLevel = deg.level;
        break;
      }
    }

    // Look for institution match
    let detectedInst = "";
    for (const inst of INSTITUTION_KEYWORDS) {
      if (new RegExp(`\\b${escapeRegex(inst)}\\b`, "i").test(line)) {
        detectedInst = inst;
        break;
      }
    }

    // If degree or institution found, build entry with lookahead
    if (detectedDegree || detectedInst) {
      const blockLines = [line];
      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const nextLine = lines[j]?.trim();
        if (!nextLine || nextLine.length < 3) continue;

        const isNewBullet = /^[•*–—\-]\s*[A-Za-z]/.test(nextLine);
        const nextHasDegree = DEGREE_PATTERNS.some((d) => d.regex.test(nextLine));
        // Strip degree terms so that phrases like "Secondary School" or "High School Diploma" are not mistaken for an institution name
        const lineWithoutDegree = nextLine.replace(/\b(?:Secondary\s+School|Senior\s+Secondary(?:\s+School)?|High\s+School\s+Diploma|Bachelor|Master|Doctor)\b/gi, "");
        const nextHasInst = INSTITUTION_KEYWORDS.some((inst) => new RegExp(`\\b${escapeRegex(inst)}\\b`, "i").test(lineWithoutDegree));

        // V5.0.4 FIX: Bullet-after-bullet institution→degree grouping
        // If current line has institution (no degree) and NEXT line is a bullet with a degree but NO institution
        // → group them into one entry (e.g. "• Indian Institute of Technology Delhi" + "  M.Tech | 2022-2024")
        if (detectedInst && !detectedDegree && nextHasDegree && !nextHasInst) {
          const nextClean = nextLine.replace(/^[•*–—\-◦]\s*/, "").trim();
          blockLines.push(nextClean);
          const degMatch = DEGREE_PATTERNS.find((d) => d.regex.test(nextLine));
          if (degMatch) {
            detectedDegree = nextLine.match(degMatch.regex)?.[1] || degMatch.name;
            detectedLevel = degMatch.level;
          }
          i = j; // advance outer loop
          continue;
        }

        // If next line is a new bullet with its own institution → new entry, stop grouping
        if (isNewBullet && nextHasInst) break;
        // If next line has both degree AND institution → it is a new standalone record, stop grouping
        if (nextHasDegree && nextHasInst) break;
        // If next bullet has only a degree and we already have a degree → new record, stop
        if (isNewBullet && nextHasDegree && detectedDegree) break;

        // Non-bulleted next line with only a degree and we had an institution → group them
        if (!isNewBullet && detectedInst && !detectedDegree && nextHasDegree) {
          blockLines.push(nextLine);
          const degMatch = DEGREE_PATTERNS.find((d) => d.regex.test(nextLine));
          if (degMatch) {
            detectedDegree = nextLine.match(degMatch.regex)?.[1] || degMatch.name;
            detectedLevel = degMatch.level;
          }
          i = j;
          continue;
        }

        // If next line has neither a new degree nor a new institution, it is metadata (dates/GPA/spec)
        if (!nextHasDegree && !nextHasInst) {
          blockLines.push(nextLine);
          i = j;
          continue;
        }

        break;
      }

      const combinedBlock = blockLines.join(", ");

      // Look for dates
      const yearRange = combinedBlock.match(
        /\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?20\d\d)\s*[-–—to]+\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:20\d\d|present|expected|current))\b/i
      );
      const singleYear = combinedBlock.match(/\b(20\d\d)\b/);
      const startDate = yearRange ? yearRange[1].trim() : undefined;
      const endDate = yearRange ? yearRange[2].trim() : undefined;
      const gradYearStr = endDate || (singleYear ? singleYear[1] : undefined);
      const gradYearNum = gradYearStr && /^\d{4}$/.test(gradYearStr) ? parseInt(gradYearStr, 10) : undefined;

      // Look for GPA / CGPA
      const gpaMatch =
        combinedBlock.match(/\b(?:CGPA|GPA|Score)\s*[:=\-]?\s*([0-9.]+(?:\s*\/\s*[0-9.]+)?)/i) ||
        combinedBlock.match(/\b([0-9]\.[0-9]{1,2}\s*\/\s*(?:10|4(?:\.0)?))\b/);
      const gpa = gpaMatch ? gpaMatch[1] : undefined;

      // Look for Percentage
      const pctMatch = combinedBlock.match(/\b(?:Percentage|Score)?\s*[:=\-]?\s*([0-9]{1,2}(?:\.[0-9]{1,2})?%)(?:\s|$|[,;|])/i);
      const percentage = pctMatch ? pctMatch[1] : undefined;

      // Specialization
      const specMatch =
        combinedBlock.match(/(?:B\.Tech|Degree|Engineering|Secondary|Senior\s+Secondary)\s*[,;\-–—]?\s*([A-Za-z\s&()]*?(?:Computer Science|AI|Machine Learning|Data Science|Information Technology|Science|PCM|Commerce|Arts)[A-Za-z\s&()]*?)(?:[;,\-–—]|\s+Aug|\s+20\d\d|$)/i) ||
        combinedBlock.match(/\b(?:in|major in|specialization in)\s+([A-Za-z\s&()]{4,50})(?:[,–—;\n]|$)/i);
      const specialization = specMatch ? specMatch[1].trim() : undefined;

      const rawInst = detectedInst
        ? (blockLines[0].split(/[,–—|]/).find((p) => new RegExp(escapeRegex(detectedInst), "i").test(p))?.trim() || detectedInst)
        : (blockLines[0].split(/[,–—|]/)[0]?.trim() || "University");
      const institution = rawInst.replace(/^[•*–—\-]\s*/, "").trim();

      const degree = detectedDegree || (detectedLevel === "high_school" ? "High School" : "Bachelor's Degree");

      // Current Year inference (for ongoing college)
      let currentYear = "";
      if (yearRange && /present|current/i.test(yearRange[2])) {
        const startYear = parseInt(yearRange[1].slice(-4), 10);
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
        startDate,
        endDate,
        currentYear,
        expectedGraduationYear: gradYearNum,
        graduationYear: gradYearStr,
        gpa,
        percentage,
        academicLevel: detectedLevel,
        sourceSpan: combinedBlock.slice(0, 250),
      });

      if (entries.length >= 6) break;
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
  { name: "Artificial Intelligence", category: "concept", aliases: ["ai"], requiresBoundary: true },
  { name: "Deep Learning", category: "concept" },
  { name: "Machine Learning", category: "concept", aliases: ["ml"], requiresBoundary: true },
  { name: "Computer Vision", category: "concept", aliases: ["cv"] },
  { name: "Natural Language Processing", category: "concept", aliases: ["nlp"] },
  { name: "Reinforcement Learning", category: "concept", aliases: ["rl"] },
  { name: "Data Structures & Algorithms", category: "concept", aliases: ["dsa"] },
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * V5.0.4: Domain skills tokenizer.
 * Extracts non-tech domain keywords from skills sections for categories like Healthcare,
 * Sales, Agriculture, Legal, etc., where the TECH_TAXONOMY may find nothing.
 */
export function extractDomainSkills(
  skillLines: string[],
  seenNames: Set<string>
): ResumeInterpretationOutput["skills"] {
  if (skillLines.length === 0) return [];
  const results: ResumeInterpretationOutput["skills"] = [];

  // Domain keywords that are worth preserving as skills in non-tech resumes
  const DOMAIN_SKILL_PATTERNS: Array<{ regex: RegExp; category: "other" }> = [
    { regex: /\b(patient\s+(?:care|assessment|education|advocacy)|clinical\s+documentation|ehr|emr|epic|cerner|hipaa|infection\s+control|medication\s+administration|triage|phlebotomy|ecg|ekg|cpr|bls|acls|pals)\b/i, category: "other" },
    { regex: /\b(microsoft\s+office|ms\s+office|microsoft\s+word|microsoft\s+excel|microsoft\s+powerpoint|quickbooks|sap|oracle|erp|crm|salesforce|tableau|power\s+bi)\b/i, category: "other" },
    { regex: /\b(supply\s+chain|inventory\s+management|procurement|logistics|warehousing|operations\s+management|lean|six\s+sigma|kaizen|agile|scrum|pmp|iso)\b/i, category: "other" },
    { regex: /\b(accounting|bookkeeping|auditing|tax\s+preparation|financial\s+analysis|budget(?:ing)?|forecasting|accounts\s+payable|accounts\s+receivable|gaap|ifrs)\b/i, category: "other" },
    { regex: /\b(crop\s+management|soil\s+testing|pest\s+management|irrigation|horticulture|agronomy|farm\s+management|organic\s+farming|precision\s+agriculture)\b/i, category: "other" },
    { regex: /\b(legal\s+research|contract\s+drafting|litigation|compliance|regulatory|due\s+diligence|legal\s+writing|case\s+management|e-discovery)\b/i, category: "other" },
    { regex: /\b(social\s+media\s+(?:marketing|management)|seo|sem|google\s+analytics|content\s+(?:creation|marketing|strategy)|brand\s+management|digital\s+marketing|email\s+marketing|ppc|copywriting)\b/i, category: "other" },
  ];

  const skillText = skillLines.join(" ");

  for (const { regex, category } of DOMAIN_SKILL_PATTERNS) {
    const globalRegex = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
    let match: RegExpExecArray | null;
    while ((match = globalRegex.exec(skillText)) !== null) {
      const found = match[1]?.trim() || match[0].trim();
      const key = found.toLowerCase();
      if (found.length >= 3 && found.length <= 60 && !seenNames.has(key)) {
        seenNames.add(key);
        results.push({
          name: found,
          category,
          proficiencyHint: "unknown",
          sourceSpan: found,
        });
      }
    }
  }

  // Fallback: tokenize comma/semicolon/bullet delimited skills section
  // Only when tech taxonomy found nothing meaningful
  if (seenNames.size < 3 && skillLines.length > 0) {
    const tokens = skillText
      .split(/[,;•\n\r\t|]+/)
      .map((t) => t.replace(/^[\s*–\-•◦]+|[\s*–\-•◦]+$/g, "").trim())
      .filter((t) => t.length >= 3 && t.length <= 40 && /[a-zA-Z]/.test(t) && !/^[\d\s]+$/.test(t));
    for (const tok of tokens) {
      const key = tok.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        results.push({
          name: tok,
          category: "other",
          proficiencyHint: "unknown",
          sourceSpan: tok,
        });
        if (results.length >= 20) break;
      }
    }
  }

  return results;
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
        proficiencyHint: "unknown",
        sourceSpan: matchedSpan,
      });
    }
  }

  // V5.0.4: Supplement with domain skills if tech taxonomy found few results
  if (skillLines.length > 0) {
    const domainSkills = extractDomainSkills(skillLines, seen);
    results.push(...domainSkills);
  }

  return results;
}

// ============================================================================
// 5. PROJECTS EXTRACTOR
// ============================================================================

export function extractProjects(
  projectLines: string[],
  discoveredRepos: Array<{ url: string; owner: string; repo: string }>,
  rawText?: string
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
    const bulletProjectMatch = line.match(/^[•\-*–—]\s*([^:(]+?)(?:\s*\(([^)]+)\))?\s*:\s*(.*)/);
    const isBullet = (/^[•\-*–—]\s*/.test(line) || /^\d+\.\s*/.test(line)) && !isNumberedTitle;
    const isBareBulletTitle = isBullet && !bulletProjectMatch && line.length <= 80 && !line.endsWith(".");
    const hasRepo = /github\.com\/[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+/i.test(line);
    const isUrl = /^https?:\/\//i.test(line) || /^github\.com\//i.test(line);

    // Case 1: Bulleted project format: • Project Title (Domain): Description
    if (bulletProjectMatch) {
      if (currentBlock) blocks.push(currentBlock);
      const titleClean = bulletProjectMatch[1].trim();
      const domain = bulletProjectMatch[2]?.trim();
      const descInit = bulletProjectMatch[3].trim();
      currentBlock = {
        title: titleClean,
        description: domain ? `(${domain}) ${descInit}` : descInit,
        lines: [line],
      };
      if (hasRepo) {
        const repoMatch = line.match(/https?:\/\/github\.com\/[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+/i);
        if (repoMatch) currentBlock.repoUrl = repoMatch[0];
      }
    }
    // Case 2: Numbered title or short distinct header line
    else if ((isBareBulletTitle || isNumberedTitle || (!isBullet && !currentBlock)) && !isUrl && line.length <= 80 && !line.endsWith(".")) {
      if (currentBlock) blocks.push(currentBlock);
      const titleClean = line.replace(/^(?:\d+[\.)]|[•\-*–—])\s+/, "").replace(/^[*_#:\s]+|[*_#:\s]+$/g, "");
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

  // Fallback: If no projects found in explicit project section, scan rawText for explicit 'Projects: ...' or 'Project: ...' lines
  if (projects.length === 0 && rawText) {
    const rawLines = rawText.split("\n");
    for (const rLine of rawLines) {
      const match = rLine.match(/^\s*(?:•\s*|-+\s*)?(?:Projects?|Personal\s+Projects?)\s*:\s*(.+)$/i);
      if (match && match[1] && match[1].trim().length > 5) {
        const fullContent = match[1].trim();
        // Extract title: before '-' or ':' or '(' or up to 60 chars
        const titleMatch = fullContent.match(/^([^—–\-:(]+)/);
        const titleClean = (titleMatch ? titleMatch[1] : fullContent).trim();
        const valRes = ExtractionValidator.validateProjectClaim(titleClean, rLine);
        if (valRes.valid) {
          projects.push({
            title: valRes.normalizedValue,
            description: fullContent.slice(0, 300),
            technologies: [],
            sourceSpan: rLine.trim().slice(0, 250),
          });
          if (projects.length >= 5) break;
        }
      }
    }
  }

  return projects;
}

// ============================================================================
// 6. EXPERIENCE EXTRACTOR
// ============================================================================

// ============================================================================
// 6. EXPERIENCE EXTRACTOR
// ============================================================================

function detectExperienceTechs(text: string): string[] {
  const techs: string[] = [];
  for (const t of TECH_TAXONOMY_V3_9) {
    const candidates = [t.name, ...(t.aliases || [])];
    for (const cand of candidates) {
      if (cand.length <= 2 && !t.requiresBoundary) continue;
      if (new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(cand)}(?![a-zA-Z0-9])`, "i").test(text)) {
        techs.push(t.name);
        break;
      }
    }
  }
  return techs;
}

function classifyExperienceRoleType(roleStr: string, descStr: string): "employment" | "internship" | "freelance" | "founder" | "leadership" | "volunteering" | "other" {
  const rLower = roleStr.toLowerCase();
  if (/\b(?:intern|internship|trainee|apprentice)\b/i.test(rLower)) return "internship";
  if (/\b(?:co-founder|founder|founding|co-founding|ceo|cto|coo)\b/i.test(rLower)) return "founder";
  if (/\b(?:freelance|contractor|consultant)\b/i.test(rLower)) return "freelance";
  if (/\b(?:volunteer|volunteering|community\s+organizer|ngo|mentor)\b/i.test(rLower)) return "volunteering";
  if (/\b(?:president|vice\s+president|director|chair|head\s+of)\b/i.test(rLower)) return "leadership";
  if (/\b(?:engineer|developer|scientist|analyst|architect|manager|specialist|officer|associate|member|programmer|designer)\b/i.test(rLower)) return "employment";

  const combined = (roleStr + " " + descStr).toLowerCase();
  if (/\b(?:intern|internship|trainee|apprentice)\b/i.test(combined)) return "internship";
  if (/\b(?:co-founder|founder|founding|co-founding)\b/i.test(combined)) return "founder";
  if (/\b(?:freelance|contractor|consultant)\b/i.test(combined)) return "freelance";
  if (/\b(?:volunteer|volunteering|community\s+organizer|ngo|mentor)\b/i.test(combined)) return "volunteering";
  if (/\b(?:president|vice\s+president|director|chair|head\s+of)\b/i.test(combined)) return "leadership";
  return "employment";
}

/**
 * V5.0.4: Experience extractor with 4 format patterns:
 *   A: Bulleted inline (• Company Role Date or • Company) then sub-bullets for highlights
 *   B: Plain "Role at Company" or "Role | Company | Date"
 *   C: Unbulleted org header (e.g. "Founders Verbinden Remote") → bulleted role on next line
 *   D: Dataset A pattern: "Role Title" on line 1, "Date Company City, State" on line 2
 */
export function extractExperience(
  lines: string[],
  projectTitles: string[] = []
): ResumeInterpretationOutput["experience"] {
  const experiences: ResumeInterpretationOutput["experience"] = [];
  const lowerProjectTitles = new Set(projectTitles.map((p) => p.toLowerCase().trim()));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line || line.length < 3) continue;

    // Check if line is a section header (e.g., "WORK EXPERIENCE", "EXPERIENCE")
    if (ExtractionValidator.isHeadingOrNonProject(line)) continue;

    // Ignore lines that match a known project title
    const lineWithoutBullet = line.replace(/^[•*–—\-◦\d.]+\s*/, "").trim();
    if (lowerProjectTitles.has(lineWithoutBullet.toLowerCase())) continue;

    // ─────────────────────────────────────────────────────────────────────────
    // FORMAT C (V5.0.4): Unbulleted organization header → bulleted/dated role on next line
    // Example:
    //   "Founders Verbinden Remote"
    //   "• President Aug. 2025 – Present"
    //   "◦ Lead an entrepreneurship and technology ecosystem..."
    // ─────────────────────────────────────────────────────────────────────────
    if (!/^[•*–—\-◦\d.]/.test(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim() || "";
      const nextIsBulletedRole = /^[•*–—\-]\s*[A-Z]/.test(nextLine);
      // Check if next line is a bulleted line that contains a role keyword or date
      const nextHasRoleOrDate = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\d\d|President|Intern|Engineer|Founder|Developer|Lead|Manager|Director|Officer|Analyst|Consultant|Architect|Researcher|Scientist|Volunteer|Mentor|Chair|Head|Resident|Freelance)\b/i.test(nextLine);

      if (nextIsBulletedRole && nextHasRoleOrDate && !ExtractionValidator.isHeadingOrNonProject(line)) {
        // line is the organization/company name, nextLine is the role
        const company = line.replace(/\s+(?:Remote|Onsite|Hybrid|[A-Z][a-z]+,?\s*[A-Z]{2})\s*$/i, "").trim();
        if (lowerProjectTitles.has(company.toLowerCase())) {
          continue;
        }

        let roleText = nextLine.replace(/^[•*–—\-]\s*/, "").trim();
        let duration: string | undefined;
        let startDate: string | undefined;
        let endDate: string | undefined;

        const inlineDateMatch = roleText.match(
          /\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?\d{4})\s*[-–—to]+\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:\d{4}|Present|Current))\b/i
        );
        if (inlineDateMatch) {
          duration = inlineDateMatch[0];
          startDate = inlineDateMatch[1].trim();
          endDate = inlineDateMatch[2].trim();
          roleText = roleText.replace(inlineDateMatch[0], "").replace(/[,|–—\-]+$/, "").trim();
        }

        const highlights: string[] = [];
        let k = i + 2;
        while (k < lines.length) {
          const kLine = lines[k]?.trim() || "";
          if (/^[•*–—\-]\s*[A-Z]/.test(kLine)) break;
          if (ExtractionValidator.isHeadingOrNonProject(kLine)) break;
          // Stop if unbulleted non-trivial line is a new org header (peek: next line is a bulleted role)
          if (kLine.length > 3 && !/^[◦\-*•:\u000e\s]/.test(kLine)) {
            const peek = lines[k + 1]?.trim() || "";
            const peekIsRole = /^[•*–—\-]\s*[A-Z]/.test(peek) &&
              /\b(?:Intern|Engineer|Founder|Developer|Lead|Manager|Director|Officer|Analyst|Consultant|President|Researcher|Scientist|Volunteer|Mentor|Chair|Head|Resident|Freelance|Trainee)\b/i.test(peek);
            if (peekIsRole) break;
          }
          const hl = kLine.replace(/^[\u000e:◦\-*•\s]+/, "").trim();
          if (hl.length > 5 && !lowerProjectTitles.has(hl.toLowerCase())) {
            highlights.push(hl);
          }
          k++;
        }

        const sourceSpan = (line + " " + nextLine).slice(0, 250);
        const combinedText = `${roleText} ${company} ${highlights.join(" ")}`;
        const roleType = classifyExperienceRoleType(roleText, combinedText);
        const techs = detectExperienceTechs(combinedText);

        experiences.push({
          company: company.slice(0, 80),
          role: (roleText || "Member").slice(0, 80),
          type: roleType,
          duration,
          startDate,
          endDate,
          highlights: highlights.slice(0, 5),
          technologies: techs,
          sourceSpan,
        });
        i = k - 1; // advance past consumed lines
        if (experiences.length >= 8) break;
        continue;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FORMAT D (V5.0.4): Dataset A two-line pattern
    // Line 1: Role title (no bullet, no date, no company)
    // Line 2: "Month Year to Month Year Company Name ï¼ City , State"
    // ─────────────────────────────────────────────────────────────────────────
    if (!/^[•*–—\-◦\d.]/.test(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim() || "";
      // Detect Dataset A date pattern: "August 2008 to April 2014 Company Name"
      const datasetADateMatch = nextLine.match(
        /^((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})\s+to\s+((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|Present|Current)\s+(.{3,60}?)(?:\s+ï¼|\s+\|\s+|\s+-\s+|,\s+[A-Z]{2}\b|$)/i
      );

      if (datasetADateMatch && !ExtractionValidator.isHeadingOrNonProject(line) && line.length > 3 && line.length < 80) {
        // Check that line looks like a role (not another date line or heading)
        const looksLikeRole = !/^\d{4}/.test(line) && !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(line);
        if (looksLikeRole) {
          const role = line.trim();
          const startDate = datasetADateMatch[1]?.trim();
          const endDate = datasetADateMatch[2]?.trim();
          const companyRaw = datasetADateMatch[3]?.trim() || "";
          const company = companyRaw.replace(/\s+(?:Company Name|ï¼|\|.*)/i, "").trim();
          const duration = `${startDate} – ${endDate}`;

          if (!lowerProjectTitles.has(company.toLowerCase())) {
            const combinedText = `${role} ${company}`;
            const roleType = classifyExperienceRoleType(role, combinedText);
            const techs = detectExperienceTechs(combinedText);

            // Look for highlights on subsequent lines
            const highlights: string[] = [];
            let k = i + 2;
            while (k < lines.length) {
              const hl = (lines[k]?.trim() || "").replace(/^[•◦\-*\s]+/, "").trim();
              // Stop at next date-line or role pattern
              if (/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}/i.test(hl)) break;
              if (ExtractionValidator.isHeadingOrNonProject(hl)) break;
              // Stop if next line is a Dataset A date line ("Month Year to Month Year ...")
              const peekDatasetA = lines[k + 1]?.trim() || "";
              if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s+to\b/i.test(peekDatasetA)) break;
              if (hl.length > 10) highlights.push(hl);
              k++;
              if (highlights.length >= 4) break;
            }

            experiences.push({
              company: company.slice(0, 80),
              role: role.slice(0, 80),
              type: roleType,
              duration,
              startDate,
              endDate,
              highlights: highlights.slice(0, 4),
              technologies: techs,
              sourceSpan: (line + " " + nextLine).slice(0, 250),
            });
            i = k - 1;
            if (experiences.length >= 8) break;
            continue;
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FORMAT A: Line starts with bullet and is a company/role header
    // ─────────────────────────────────────────────────────────────────────────
    // Format A: Line starts with bullet and is a company header (e.g. "• Founders Verbinden Remote President Aug. 2025 – Present" or "• Tathastu AI Labs")
    if (/^[•*–—\-«‹+]\s*[A-Za-z]/.test(line)) {
      let lineText = line.replace(/^[•*–—\-«‹+]\s*/, "").trim();
      let duration: string | undefined;
      let startDate: string | undefined;
      let endDate: string | undefined;
      let company = "";
      let role = "";
      const highlights: string[] = [];
      let sourceSpan = line;

      // Check for inline date in this line
      const inlineDateMatch = lineText.match(
        /\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?\d{4})\s*[-–—to]+\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:\d{4}|Present|Current))\b/i
      );
      if (inlineDateMatch) {
        duration = inlineDateMatch[0];
        startDate = inlineDateMatch[1].trim();
        endDate = inlineDateMatch[2].trim();
        lineText = lineText.replace(inlineDateMatch[0], "").trim();
      }

      // Strip location tokens (Remote, Onsite, Hybrid, city/state like "City, ST")
      lineText = lineText.replace(/\s+(?:Remote|Onsite|Hybrid|[A-Z][a-z]+,\s*[A-Z]{2})\b/g, " ").trim();

      // Check if role keyword is inside lineText
      const roleKeywordsRegex = /\b(?:(?:Senior|Junior|Principal|Staff|Lead|Associate)\s+)?(?:President|Vice\s+President|Co-Founder|Founder(?:\s*(?:&|\/)\s*(?:CEO|Builder))?|CEO|CTO|COO|Chief\s+[A-Za-z]+|(?:Backend|Frontend|Full[- ]?Stack|Software|ML|AI|Data|Cloud|DevOps|Systems|Platform)\s+Engineer(?:\s+Intern)?|Data\s+Scientist|Research\s+(?:Scientist|Intern)|Resident|Intern|Lead|Developer|Consultant|Freelancer|Builder|Mentor|Teacher)\b/i;
      const roleMatches = [...lineText.matchAll(new RegExp(roleKeywordsRegex.source, "gi"))];
      // Pick the last matching role token (roles typically follow the organization name in inline headers)
      const bestRoleMatch = roleMatches.length > 0 ? roleMatches[roleMatches.length - 1] : null;

      if (bestRoleMatch && bestRoleMatch.index !== undefined) {
        company = lineText.slice(0, bestRoleMatch.index).replace(/[,|–—\-]+$/, "").trim();
        role = lineText.slice(bestRoleMatch.index).replace(/^[,|–—\-]+/, "").trim();
      } else {
        company = lineText;
      }

      // Check next line for Role and Dates if not found inline
      if (!role && i + 1 < lines.length && !/^[•*]/.test(lines[i + 1].trim())) {
        const next = lines[i + 1].trim();
        if (!ExtractionValidator.isHeadingOrNonProject(next) && !next.startsWith(":") && !next.startsWith("\u000e")) {
          const nextDateMatch = next.match(
            /\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?\d{4})\s*[-–—to]+\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:\d{4}|Present|Current))\b/i
          );
          if (nextDateMatch) {
            duration = nextDateMatch[0];
            startDate = nextDateMatch[1].trim();
            endDate = nextDateMatch[2].trim();
            role = next.replace(nextDateMatch[0], "").trim().replace(/[-–—,|;]$/, "").trim();
          } else {
            role = next;
          }
          sourceSpan += " " + next;
          i++; // advance past next line
        }
      }

      // Check subsequent lines for highlights (e.g. lines starting with ◦ or - or : or indented)
      while (
        i + 1 < lines.length &&
        !/^[•*–—\-]\s*[A-Z]/.test(lines[i + 1].trim()) &&
        !ExtractionValidator.isHeadingOrNonProject(lines[i + 1].trim())
      ) {
        const nextSubLine = lines[i + 1].trim();
        // Stop if this unbulleted line is actually a new company/org header (next line is a bulleted role or date)
        if (nextSubLine.length > 3 && !/^[◦\-*•:\u000e\s]/.test(nextSubLine)) {
          const peek = lines[i + 2]?.trim() || "";
          const peekIsRole = /^[•*–—\-]\s*[A-Z]/.test(peek) &&
            /\b(?:Intern|Engineer|Founder|Developer|Lead|Manager|Director|Officer|Analyst|Consultant|President|Researcher|Scientist|Volunteer|Mentor|Chair|Head|Resident|Freelance|Trainee|CTO|CEO|COO)\b/i.test(peek);
          if (peekIsRole) break;
        }
        const cleanedHl = nextSubLine.replace(/^[\u000e:◦\-*•\s]+/, "").trim();
        if (cleanedHl.length > 5 && !lowerProjectTitles.has(cleanedHl.toLowerCase())) {
          highlights.push(cleanedHl);
        }
        i++;
      }

      if (company && !lowerProjectTitles.has(company.toLowerCase())) {
        const combinedText = `${role} ${company} ${highlights.join(" ")}`;
        const roleType = classifyExperienceRoleType(role, combinedText);
        const techs = detectExperienceTechs(combinedText);

        experiences.push({
          company: company.slice(0, 80),
          role: (role || "Member").slice(0, 80),
          type: roleType,
          duration,
          startDate,
          endDate,
          highlights: highlights.slice(0, 5),
          technologies: techs,
          sourceSpan: sourceSpan.slice(0, 250),
        });
      }
      if (experiences.length >= 8) break;
      continue;
    }

    // Format B: Inline "Role at Company" or "Role, Company" or "Company | Role | Dates"
    const dateMatch = line.match(
      /\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?\d{4})\s*[-–—to]+\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:\d{4}|Present|Current))\b/i
    );
    const lineWithoutDates = dateMatch ? line.replace(dateMatch[0], "").trim() : line;
    const parts = lineWithoutDates.split(/[—–|,]|\sat\s|\s-\s/i).map((p) => p.trim()).filter(Boolean);

    if (parts.length >= 2) {
      let role = parts[0];
      let company = parts[1];

      // Disambiguate if first part looks like company and second part looks like role
      if (/\b(?:Labs|Inc|Corp|LLC|Technologies|Solutions|AI|Startup|Verbinden|University|Studio)\b/i.test(parts[0]) &&
          /\b(?:Intern|Engineer|Developer|Lead|Founder|Manager|Analyst)\b/i.test(parts[1])) {
        company = parts[0];
        role = parts[1];
      }

      if (lowerProjectTitles.has(company.toLowerCase())) continue;

      const highlights: string[] = [];
      // Look ahead for bulleted highlights
      let lookahead = i + 1;
      while (lookahead < lines.length && /^[◦\-•*]/.test(lines[lookahead].trim())) {
        const hl = lines[lookahead].trim().replace(/^[◦\-•*:\s]+/, "").trim();
        if (hl) highlights.push(hl);
        lookahead++;
      }
      if (lookahead > i + 1) i = lookahead - 1;

      const combinedText = `${role} ${company} ${highlights.join(" ")}`;
      const roleType = classifyExperienceRoleType(role, combinedText);
      const techs = detectExperienceTechs(combinedText);

      experiences.push({
        role: role.slice(0, 80),
        company: company.slice(0, 80),
        type: roleType,
        duration: dateMatch ? dateMatch[0] : undefined,
        startDate: dateMatch ? dateMatch[1].trim() : undefined,
        endDate: dateMatch ? dateMatch[2].trim() : undefined,
        highlights: highlights.slice(0, 5),
        technologies: techs,
        sourceSpan: line.slice(0, 250),
      });

      if (experiences.length >= 8) break;
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

    if (certs.length >= 8) break;
  }

  return certs;
}

// ============================================================================
// 8. ACHIEVEMENTS & RESEARCH EXTRACTOR
// ============================================================================

export function extractAchievements(
  lines: string[],
  researchLines: string[] = [],
  rawText: string = ""
): ResumeInterpretationOutput["achievements"] {
  const achievements: ResumeInterpretationOutput["achievements"] = [];
  const combined = [...lines, ...researchLines];

  for (const line of combined) {
    if (!line || line.trim().length < 4) continue;
    const cleaned = line.replace(/^[•\-*–—\d.]+\s*/, "").trim();
    if (ExtractionValidator.isSectionHeading(cleaned)) continue;

    let category: "patent" | "publication" | "book" | "award" | "hackathon" | "honor" = "award";
    let subType: string = "award";
    let status: string = "awarded";

    // Classify named distinctions as honors; ordinary awards retain the award category.
    if (/\b(?:honor|best\s*paper|paper\s*award|scholarship|gold\s*medalist|distinction|rank\s*\d|dean's\s*list|fellowship)\b/i.test(cleaned)) {
      category = "honor";
      subType = "award";
      status = "awarded";
    }
    else if (/\baward\b/i.test(cleaned)) {
      category = "award";
      subType = "award";
      status = "awarded";
    }
    // 2. Patents (distinguish application vs granted)
    else if (/\b(?:patent|patent\s*application|patent\s*granted|indian\s*patent|us\s*patent|appl\.?\s*no|application\s*no)\b/i.test(cleaned)) {
      category = "patent";
      if (/\b(?:granted|grant|issued|patent\s*no)\b/i.test(cleaned)) {
        subType = "patent_granted";
        status = "granted";
      } else {
        subType = "patent_application";
        status = "application";
      }
    }
    // 3. Books (distinguish co-author vs author)
    else if (/\b(?:book|book\s*chapter|isbn|monograph|co-authored\s*book|author)\b/i.test(cleaned)) {
      category = "book";
      if (/\b(?:co-author|co-authored|contributing\s*author)\b/i.test(cleaned)) {
        subType = "book_coauthor";
      } else {
        subType = "book";
      }
      status = "published";
    }
    // 4. Publications / Research Papers (distinguish published vs manuscript/under review)
    else if (/\b(?:publication|research\s*paper|published\s*in|conference|journal|ieee|springer|acm|arxiv|doi|proceedings|manuscript|under\s*review)\b/i.test(cleaned)) {
      category = "publication";
      if (/\b(?:manuscript|under\s*review|submitted|preprint|working\s*paper|draft)\b/i.test(cleaned)) {
        subType = "manuscript";
        status = "under_review";
      } else {
        subType = "published_paper";
        status = "published";
      }
    }
    // 5. Hackathons & Competitions
    else if (/\b(?:hackathon|smart\s*india|finalist|contest|competition|codechef|leetcode|kaggle|winner|runner-up)\b/i.test(cleaned)) {
      category = "hackathon";
      subType = "hackathon";
      status = "awarded";
    }

    const dateMatch = cleaned.match(/\b(20\d\d)\b/);

    // Clean title by stripping leading tags like "Patent:", "Book:", "Paper:"
    const titleClean = cleaned
      .replace(/^(?:patent|book|paper|publication|honor|award|hackathon|competition|research\s*paper)\s*[:—–\-|]\s*/i, "")
      .replace(/\s*[:|—–.\-]?\s*\b(?:Co[- ]?inventor|Co[- ]?author|Author|Applicant|Application\s+no|Published|Accepted|ISBN).*$/i, "")
      .trim()
      .replace(/[:.\s—–\-]+$/, "")
      .slice(0, 150);

    // Reject standalone names like "Book" or "Patent"
    if (/^(?:book|books|patent|patents|publication|publications|paper|papers)$/i.test(titleClean)) {
      continue;
    }

    // Issuer extraction
    let issuer: string | undefined;
    if (category === "patent") {
      if (/indian\s*patent/i.test(cleaned)) issuer = "Indian Patent Office";
      else if (/us\s*patent|uspto/i.test(cleaned)) issuer = "United States Patent and Trademark Office (USPTO)";
      else issuer = "Patent Office";
    } else if (category === "publication") {
      if (/ieee/i.test(cleaned)) issuer = "IEEE";
      else if (/springer/i.test(cleaned)) issuer = "Springer";
      else if (/acm/i.test(cleaned)) issuer = "ACM";
      else if (/arxiv/i.test(cleaned)) issuer = "arXiv";
    }

    achievements.push({
      title: titleClean || cleaned.slice(0, 150),
      category,
      subType,
      status,
      issuer,
      date: dateMatch ? dateMatch[1] : undefined,
      description: cleaned.slice(0, 350),
      sourceSpan: line.slice(0, 250),
    });

    if (achievements.length >= 12) break;
  }

  // Fallback: If no achievements found yet, scan rawText for explicit patents or papers
  if (achievements.length === 0 && rawText) {
    const patentRegex = /(?:Indian\s+Patent\s+Application|Patent\s+Application|Patent\s+Granted|Patent)[\s:]+([^\n\r.]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = patentRegex.exec(rawText)) !== null) {
      if (match[1] && match[1].trim().length > 4) {
        const isGranted = /granted/i.test(match[0]);
        achievements.push({
          title: match[1].trim().slice(0, 150),
          category: "patent",
          subType: isGranted ? "patent_granted" : "patent_application",
          status: isGranted ? "granted" : "application",
          issuer: /indian/i.test(match[0]) ? "Indian Patent Office" : undefined,
          description: match[0].trim().slice(0, 350),
          sourceSpan: match[0].trim().slice(0, 250),
        });
        if (achievements.length >= 5) break;
      }
    }

    // Also scan for prominent standalone honors: Dean's List, Cum Laude, Magna Cum Laude, Employee of the Month
    if (achievements.length === 0) {
      const honorRegex = /\b(?:Dean's\s+List|Cum\s+Laude|Magna\s+Cum\s+Laude|Summa\s+Cum\s+Laude|Employee\s+of\s+the\s+(?:Month|Year)|Gold\s+Medalist|First\s+Rank)\b/gi;
      let honorMatch: RegExpExecArray | null;
      while ((honorMatch = honorRegex.exec(rawText)) !== null) {
        achievements.push({
          title: honorMatch[0],
          category: "honor",
          subType: "award",
          status: "awarded",
          description: honorMatch[0],
          sourceSpan: honorMatch[0],
        });
        if (achievements.length >= 3) break;
      }
    }
  }

  return achievements;
}

// ============================================================================
// 9. CANONICAL ZERO-LLM EXTRACTION ENGINE
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
    const projects = extractProjects(sectionMap.projects || [], footprints.repositories, rawText);
    const experience = extractExperience(sectionMap.experience || [], projects.map((p) => p.title));
    const certifications = extractCertifications(sectionMap.certifications || []);
    const achievements = extractAchievements(sectionMap.achievements || [], sectionMap.research || [], rawText);

    // Step 4: Pick best primary academic profile
    const primaryEdu = educationEntries[0];

    // Step 5: Build structured output
    const structured: ResumeInterpretationOutput = {
      education: educationEntries.map((e) => ({
        institution: e.institution,
        degree: e.degree,
        fieldOfStudy: e.specialization,
        startDate: e.startDate,
        endDate: e.endDate,
        graduationYear: e.graduationYear,
        gpa: e.gpa,
        percentage: e.percentage,
        academicLevel: e.academicLevel,
        sourceSpan: e.sourceSpan,
      })),
      skills,
      projects,
      experience,
      certifications,
      achievements,
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
        parserVersion: "v4.0-zero-llm",
        confidenceScore: confidence,
      });
    };

    if (personal.fullName) {
      addCandidate("profile", personal.fullName, personal.fullName, "name_positional_v3_9", 1.0);
    }
    for (const edu of educationEntries) {
      addCandidate("education", `${edu.degree} · ${edu.institution}`, edu.sourceSpan, "edu_dictionary_v3_9", 1.0);
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
    for (const a of achievements) {
      addCandidate("achievement", `${a.title} (${a.category})`, a.sourceSpan, "ach_line_v4_4", 0.9);
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
        version: "4.0.0",
        llmUsed: false,
        totalChars: rawText.length,
        linesCount: rawText.split(/\r?\n/).length,
        sectionsFound,
      },
    };
  }
}
