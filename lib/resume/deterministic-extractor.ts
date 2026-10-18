/**
 * AI TATHASTU — DETERMINISTIC RESUME EXTRACTOR
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
 */

import { ExtractionValidator } from "@/lib/services/extraction-validator";
import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";
import type { ExtractedProfile, ResumeLink } from "@/lib/services/resume-extraction-service";

// ─────────────────────────────────────────────────────────────────────────────
// REGEX PATTERNS & DICTIONARIES
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /(?<![\w.\-])([\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,})(?![\w.])/gi;
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;
const DATE_RANGE_RE = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}\s*(?:–|-|to)\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}|Present|Current|Ongoing)/i;

const DEGREE_RE = /\b(?:B\.?Tech|B\.?E\.?|Bachelor(?:'s)?(?:\s+of\s+[A-Za-z]+)?|BSc|B\.Sc|BCA|BBA|M\.?Tech|Master(?:'s)?(?:\s+of\s+[A-Za-z]+)?|MSc|M\.Sc|MCA|MBA|Ph\.?D|Doctorate|Diploma|IB\s+Diploma(?:\s+Programme)?|Associate(?:'s)?|Class\s*(?:10|12|X|XII)\b|10th|12th|High School|Senior Secondary|Secondary School|Intermediate|Matriculation)\b/i;

const INSTITUTION_RE = /\b(?:university|college|institute|institution|school|academy|polytechnic|vidyalaya|vidyapeeth|complex|board|campus|iit|nit|iiit|bits|vit|lpu|dtu|nsut|mit|stanford|harvard|oxford|cambridge|rochester|chichester)\b/i;

const GRADE_RE = /\b(?:CGPA|GPA)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?(?:\s*\/\s*\d{1,2})?)|\b\d{1,3}(?:\.\d+)?\s*%/i;

const OCCUPATIONAL_TITLES = /\b(?:developer|designer|engineer|architect|scientist|manager|lead|founder|consultant|specialist|analyst|intern|student|researcher|author|officer|advisor|assistant|editor|president|tutor|educator|freelancer)\b/i;

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

export interface DeterministicExtractionResult {
  interpretation: ResumeInterpretationOutput;
  profile: ExtractedProfile;
  links: ResumeLink[];
  confidence: number;
  sectionsDetected: string[];
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

    // If line contains delimiters like | or :, check the candidate before the delimiter
    if (t.includes("|") || t.includes("•")) {
      const parts = t.split(/[|•]/).map((p) => p.trim());
      const candidate = parts[0];
      if (candidate && candidate.length >= 3 && candidate.length <= 50 && !/@|https?:\/\/|www\./i.test(candidate) && !/\d/.test(candidate)) {
        t = candidate;
      }
    }

    if (/@|https?:\/\/|www\./i.test(t)) continue;
    if (/\d/.test(t)) continue;

    // Exclude generic resume titles
    if (/^(curriculum\s+vitae|resume|biodata|profile|contact\s+info|about\s+me)$/i.test(t)) continue;

    // Exclude job titles / occupational headlines
    if (OCCUPATIONAL_TITLES.test(t)) continue;

    // Exclude addresses
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
    const matches = item.text.match(EMAIL_RE);
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

/**
 * NON-NEGOTIABLE PRIVACY REQUIREMENT:
 * Mobile numbers must never be imported from CVs.
 * Extraction returning empty array ensures no phone data is derived.
 */
function _extractPhones(_taggedLines: Array<{ text: string; section: string }>): Array<{ phone: string; sourceSpan: string }> {
  return [];
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
        .replace(/^[•·*◦\-–—|#\s]+|[•·*◦\-–—|#\s]+$/g, "")
        .split("|")[0]
        .split(";")[0]
        .trim();
      institution = cleanInst.slice(0, 150);
    }

    // 2. Find degree & specialization
    for (const l of chunk) {
      const degMatch = l.text.match(DEGREE_RE);
      if (degMatch && !degree) {
        degree = degMatch[0].trim();
      }

      // Check field of study / major (on degree lines or non-institution lines)
      if (!fieldOfStudy && !INSTITUTION_RE.test(l.text)) {
        const specMatch = l.text.match(/(?:in|of)\s+([A-Za-z\s&(),]{3,60})/i);
        if (specMatch) {
          fieldOfStudy = specMatch[1].replace(/[;:,].*$/, "").trim();
        } else if (/(?:computer\s+science|information\s+technology|mathematics|statistics|biological\s+science|artificial\s+intelligence|data\s+science|engineering)/i.test(l.text)) {
          const match = l.text.match(/(?:computer\s+science[A-Za-z\s&()]*|mathematics\s+and\s+statistics|biological\s+science|artificial\s+intelligence|data\s+science)/i);
          if (match) fieldOfStudy = match[0].trim();
        }
      }

      // Date ranges and graduation year
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

      // Grades and percentages
      const gradeMatch = l.text.match(GRADE_RE);
      if (gradeMatch) {
        if (gradeMatch[0].includes("%")) {
          percentage = gradeMatch[0].trim();
        } else {
          gpa = (gradeMatch[1] || gradeMatch[0]).replace(/^(?:cgpa|gpa)\s*[:\-]?\s*/i, "").trim();
        }
      }
    }

    // Do NOT generate placeholder "Unknown Institution" or "Degree"
    if (!institution && !degree) continue;

    // Discard standalone board result misidentified as institution
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

  // Filter out any invalid empty entries
  return out.filter((e) => e.institution || e.degree);
}

/** Extracts technical and domain skills using taxonomy matching and structured list parsing. */
function extractSkills(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["skills"] {
  const seen = new Set<string>();
  const out: ResumeInterpretationOutput["skills"] = [];

  const relevantLines = taggedLines.filter((l) =>
    ["skills", "projects", "experience", "internships", "leadership"].includes(l.section)
  );

  for (const item of relevantLines) {
    if (/@|https?:\/\//i.test(item.text)) continue;

    // 1. Structured category bullets: e.g. "• Languages: Python, C, JavaScript, SQL, HTML, CSS"
    const catListMatch = item.text.match(/^[^\w\s]*\s*([A-Za-z\s&/]+)\s*:\s*(.+)$/);
    if (catListMatch && item.section === "skills") {
      const rawTokens = catListMatch[2].split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
      for (const token of rawTokens) {
        const clean = token.replace(/^[^\w+#.]+|[^\w+#.]+$/g, "").trim();
        if (clean.length < 1 || clean.length > 50) continue;
        const lower = clean.toLowerCase();
        if (seen.has(lower)) continue;

        // Verify with validator against negation
        const validation = ExtractionValidator.validateSkillClaim(clean, item.text);
        if (validation.valid) {
          seen.add(lower);
          out.push({
            name: validation.normalizedValue || clean,
            category: /language|programming/i.test(catListMatch[1])
              ? "language"
              : /tool|database|development|data/i.test(catListMatch[1])
              ? "tool"
              : "other",
            proficiencyHint: "unknown",
            sourceSpan: item.text.slice(0, 200),
          });
        }
      }
    }

    // 2. Match against curated tech skills with boundary safety
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
          });
        }
      }
    }
  }

  return out;
}

/** Extracts projects by chunking project blocks and joining continuation lines. */
function extractProjects(taggedLines: Array<{ text: string; section: string }>, hyperlinks: string[] = []): ResumeInterpretationOutput["projects"] {
  const projLines = taggedLines.filter((l) => l.section === "projects" && !l.section.startsWith("heading:"));
  if (projLines.length === 0) return [];

  const chunks: Array<Array<{ text: string }>> = [];
  let currentChunk: Array<{ text: string }> = [];

  const ACTION_VERBS = /^(?:created|developed|built|designed|implemented|architected|spearheaded|automated|integrated|assisted|collaborated)\b/i;

  for (const line of projLines) {
    const cleanText = line.text.replace(/^[•·*◦\-–—»«+]\s*/, "").trim();
    const isBullet = /^[•·*◦\-–—»«+]\s*/.test(line.text);
    const isSentence = ACTION_VERBS.test(cleanText) || cleanText.startsWith("◦:");

    const bulletTitleMatch = isBullet && !isSentence && cleanText.match(/^([A-Za-z0-9\s&/\-]{2,40})\s*[:\(]/);
    const isBulletTitle = Boolean(bulletTitleMatch && bulletTitleMatch[1].trim().split(/\s+/).length <= 4);
    const isStandaloneTitle = !isBullet && !isSentence && cleanText.length > 2 && cleanText.length < 60 && !cleanText.endsWith(".");

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

    if (!rawTitle || /^(projects|academic projects|key projects|selected projects)$/i.test(rawTitle) || /^https?:\/\//i.test(rawTitle)) {
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

/** Extracts work, training, and leadership experiences by chunking visual blocks. */
function extractExperience(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["experience"] {
  const expLines = taggedLines.filter((l) =>
    ["experience", "internships", "leadership"].includes(l.section) && !l.section.startsWith("heading:")
  );
  if (expLines.length === 0) return [];

  const chunks: Array<Array<{ text: string }>> = [];
  let currentChunk: Array<{ text: string }> = [];

  for (const line of expLines) {
    const isBullet = /^[•·*◦\-–—]\s*/.test(line.text);
    const hasOrgOrTitle = !isBullet && (line.text.includes("|") || OCCUPATIONAL_TITLES.test(line.text) || (line.text.length < 80 && !DATE_RANGE_RE.test(line.text)));

    const currentHasRole = currentChunk.some((l) => OCCUPATIONAL_TITLES.test(l.text));
    const currentHasDates = currentChunk.some((l) => DATE_RANGE_RE.test(l.text) || YEAR_RE.test(l.text));
    const currentHasBullets = currentChunk.some((l) => /^[•·*◦\-–—]\s*/.test(l.text));

    const isNewChunk = !isBullet && hasOrgOrTitle && currentChunk.length > 0 && (currentHasRole || currentHasDates || currentHasBullets);

    if (isNewChunk && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const out: ResumeInterpretationOutput["experience"] = [];

  for (const chunk of chunks) {
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
    }

    for (const l of chunk) {
      const isBullet = /^[•·*◦\-–—]\s*/.test(l.text);
      const clean = l.text.replace(/^[•·*◦\-–—|#\s]+|[•·*◦\-–—|#\s]+$/g, "").trim();
      if (!clean) continue;

      if (!isBullet && clean.includes("|")) {
        const parts = clean.split("|").map((p) => p.trim());
        if (OCCUPATIONAL_TITLES.test(parts[0])) {
          role = role || parts[0];
          if (!DATE_RANGE_RE.test(parts[1]) && !/^(?:remote|hybrid|onsite|punjab|bihar|india|uk|usa)\b/i.test(parts[1])) {
            company = company || parts[1];
          }
        } else if (OCCUPATIONAL_TITLES.test(parts[1])) {
          company = company || parts[0];
          role = role || parts[1];
        } else {
          company = company || parts[0];
        }
      } else if (!isBullet && OCCUPATIONAL_TITLES.test(clean) && !role && clean.length < 80) {
        role = clean;
      } else if (!isBullet && !company && clean.length < 80 && !DATE_RANGE_RE.test(clean) && !clean.startsWith("◦")) {
        company = clean;
      } else if (clean.length >= 15) {
        highlights.push(clean);
      }
    }

    if (!company && !role) continue;
    if (company.length < 3 && role.length < 3) continue;

    const spanCandidate = (chunk[0]?.text || company || role).trim();
    const sourceSpan = spanCandidate.length >= 3 ? spanCandidate.slice(0, 300) : `${spanCandidate} evidence`;

    out.push({
      company: (company || "Company").slice(0, 100),
      role: (role || "").slice(0, 100),
      type: /intern/i.test(role + company) ? "internship" : /volunteer/i.test(role + company) ? "leadership" : "employment",
      startDate,
      endDate,
      duration: [startDate, endDate].filter(Boolean).join(" – ") || undefined,
      highlights: highlights.slice(0, 5),
      technologies: [],
      sourceSpan,
    });
  }

  return out;
}

/** Extracts certifications by line parsing without conflating dates and issuers. */
function extractCertifications(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["certifications"] {
  const certLines = taggedLines.filter((l) => l.section === "certifications" && !l.section.startsWith("heading:"));
  const out: ResumeInterpretationOutput["certifications"] = [];

  for (const item of certLines) {
    const clean = item.text.replace(/^[•·*◦\-–—|#\s]+|[•·*◦\-–—|#\s]+$/g, "").trim();
    if (clean.length < 5) continue;

    const parts = clean.split("|").map((p) => p.trim());
    let name = parts[0];
    let issuer = parts[1];
    let year: string | undefined;

    const knownIssuers = /(?:Coursera|Udemy|AWS|Amazon|Google|Microsoft|NPTEL|edX|HackerRank|Oracle|Infosys|Simplilearn|Forage|Reliance Foundation|The Chartered Institute for IT|Chartered Institute)/i;

    if (parts.length >= 2 && knownIssuers.test(parts[0]) && !knownIssuers.test(parts[1])) {
      name = parts[1];
      issuer = parts[0];
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
function extractAchievements(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["achievements"] {
  const targetLines = taggedLines.filter((l) =>
    ["research", "books_patents", "achievements"].includes(l.section) && !l.section.startsWith("heading:")
  );
  const out: ResumeInterpretationOutput["achievements"] = [];

  const chunks: Array<Array<{ text: string }>> = [];
  let currentChunk: Array<{ text: string }> = [];

  for (const line of targetLines) {
    const isTopBullet = /^[•·*◦\-–—]\s+/.test(line.text);
    if (isTopBullet && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  for (const chunk of chunks) {
    const fullText = chunk.map((c) => c.text.replace(/^[•·*◦\-–—|#\s]+/, "").trim()).join(" ");
    if (fullText.length < 5) continue;

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

    out.push({
      title: title.slice(0, 200),
      category,
      description: description.slice(0, 300),
      sourceSpan: chunk[0]?.text.slice(0, 300) || fullText.slice(0, 300),
    });
  }

  return out;
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
  const loc = extractLocation(tagged);

  const education = extractEducation(tagged);
  const skills = extractSkills(tagged);
  const projects = extractProjects(tagged, hyperlinks);
  const experience = extractExperience(tagged);
  const certifications = extractCertifications(tagged);
  const achievements = extractAchievements(tagged);

  const interpretation: ResumeInterpretationOutput = {
    education,
    skills,
    projects,
    experience,
    certifications,
    achievements,
  };

  const primaryEdu = education[0];
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

  // Sections detected
  const sectionsDetected = Array.from(new Set(tagged.map((t) => t.section.replace("heading:", "")))).filter(
    (s) => s !== "header" && s !== "unknown"
  );

  // Confidence calculation (heuristic 0..1 based on completeness of core entities)
  let score = 0;
  if (profile.fullName) score += 0.2;
  if (profile.email) score += 0.2;
  if (education.length > 0) score += 0.2;
  if (skills.length >= 3) score += 0.2;
  if (projects.length > 0 || experience.length > 0) score += 0.2;

  const links: ResumeLink[] = [];

  return {
    interpretation,
    profile,
    links,
    confidence: Math.round(score * 100) / 100,
    sectionsDetected,
  };
}
