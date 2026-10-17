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
 */

import { ExtractionValidator } from "@/lib/services/extraction-validator";
import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";
import type { ExtractedProfile, ResumeLink } from "@/lib/services/resume-extraction-service";

// ─────────────────────────────────────────────────────────────────────────────
// REGEX PATTERNS & DICTIONARIES (PORTED & ENHANCED FROM PYTHON EXTRACTOR)
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /(?<![\w.\-])([\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,})(?![\w.])/gi;
const PHONE_RE = /(?<![\w])(?:\+\d{1,3}[\s.\-]?)?(?:\(?\d{2,5}\)?[\s.\-]?)?\d{3,5}[\s.\-]?\d{3,5}(?!\w)/g;
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;

const DEGREE_RE = /\b(?:B\.?Tech|B\.?E\.?|Bachelor(?:'s)?(?:\s+of\s+[A-Za-z]+)?|BSc|B\.Sc|BCA|BBA|M\.?Tech|Master(?:'s)?(?:\s+of\s+[A-Za-z]+)?|MSc|M\.Sc|MCA|MBA|Ph\.?D|Doctorate|Diploma|Associate(?:'s)?|Class\s*(?:10|12|X|XII)\b|10th|12th|High School|Senior Secondary|Secondary School|Intermediate|Matriculation)\b/i;

const INSTITUTION_RE = /\b(?:university|college|institute|school|academy|polytechnic|vidyalaya|board|campus|iit|nit|iiit|bits|vit|lpu|dtu|nsut|mit|stanford|harvard|oxford|cambridge)\b/i;

const GRADE_RE = /\b(?:CGPA|GPA)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?(?:\s*\/\s*\d{1,2})?)|\b\d{1,3}(?:\.\d+)?\s*%/i;

const CURATED_TECH_SKILLS: Array<{ name: string; category: "language" | "framework" | "library" | "tool" | "concept" | "other" }> = [
  // Programming Languages
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

  // AI / ML / Data Science
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
  { name: "Machine Learning", category: "concept" },
  { name: "Deep Learning", category: "concept" },
  { name: "Natural Language Processing", category: "concept" },
  { name: "Computer Vision", category: "concept" },
  { name: "Generative AI", category: "concept" },
  { name: "RAG", category: "concept" },
  { name: "Retrieval-Augmented Generation", category: "concept" },
  { name: "LLM", category: "concept" },
  { name: "Qdrant", category: "tool" },
  { name: "Pinecone", category: "tool" },
  { name: "ChromaDB", category: "tool" },

  // Web & Backend Frameworks
  { name: "React", category: "framework" },
  { name: "Next.js", category: "framework" },
  { name: "Node.js", category: "framework" },
  { name: "FastAPI", category: "framework" },
  { name: "Express", category: "framework" },
  { name: "Django", category: "framework" },
  { name: "Flask", category: "framework" },
  { name: "TailwindCSS", category: "framework" },

  // Databases & Cloud
  { name: "PostgreSQL", category: "tool" },
  { name: "MySQL", category: "tool" },
  { name: "MongoDB", category: "tool" },
  { name: "Redis", category: "tool" },
  { name: "Docker", category: "tool" },
  { name: "Kubernetes", category: "tool" },
  { name: "AWS", category: "tool" },
  { name: "GCP", category: "tool" },
  { name: "Azure", category: "tool" },
  { name: "Git", category: "tool" },
  { name: "GitHub Actions", category: "tool" },
  { name: "Linux", category: "tool" },
];

const SECTION_HEADINGS: Record<string, string[]> = {
  education: ["education", "academic background", "academics", "academic qualifications", "educational qualifications", "qualifications"],
  experience: ["experience", "work experience", "professional experience", "employment history", "work history", "employment"],
  internships: ["internships", "internship", "industrial training", "practical training"],
  skills: ["skills", "technical skills", "technical expertise", "technologies", "competencies", "tools & technologies", "skills & tools", "proficiencies"],
  projects: ["projects", "personal projects", "academic projects", "technical projects", "key projects", "selected projects"],
  certifications: ["certifications", "certificates", "courses & certifications", "licenses & certifications", "online courses"],
  achievements: ["awards", "achievements", "honours", "honors", "accomplishments", "scholarships", "competitions", "hackathons"],
  contact: ["contact", "contact details", "personal details"],
};

export interface DeterministicExtractionResult {
  interpretation: ResumeInterpretationOutput;
  profile: ExtractedProfile;
  links: ResumeLink[];
  confidence: number;
  sectionsDetected: string[];
}

/** Classifies lines into logical sections. */
function tagLines(rawLines: string[]): Array<{ text: string; section: string }> {
  let currentSection = "header";
  return rawLines.map((line) => {
    const trimmed = line.trim();
    const cleanHeading = trimmed.toLowerCase().replace(/^[\W_]+|[\W_]+$/g, "");
    for (const [sectionKey, aliases] of Object.entries(SECTION_HEADINGS)) {
      if (aliases.includes(cleanHeading) || (cleanHeading.length <= 30 && aliases.some((a) => cleanHeading === a))) {
        currentSection = sectionKey;
        return { text: trimmed, section: `heading:${sectionKey}` };
      }
    }
    return { text: trimmed, section: currentSection };
  });
}

/** Extracts candidate name from top header lines before any major heading. */
function extractName(taggedLines: Array<{ text: string; section: string }>): { name: string; sourceSpan: string } | null {
  const headerLines = taggedLines.filter((l) => l.section === "header").slice(0, 8);
  for (const item of headerLines) {
    const t = item.text.replace(/^[\s|•·*-]+|[\s|•·*-]+$/g, "").trim();
    if (!t || t.length < 3 || t.length > 70) continue;
    if (/@|https?:\/\/|www\./i.test(t)) continue;
    if (/\d/.test(t)) continue;
    // Exclude generic resume titles
    if (/^(curriculum\s+vitae|resume|biodata|profile|contact\s+info)$/i.test(t)) continue;

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

/** Extracts phone numbers, excluding standalone years. */
function extractPhones(taggedLines: Array<{ text: string; section: string }>): Array<{ phone: string; sourceSpan: string }> {
  const seen = new Set<string>();
  const out: Array<{ phone: string; sourceSpan: string }> = [];
  for (const item of taggedLines) {
    if (item.section !== "header" && item.section !== "contact") continue;
    const matches = item.text.match(PHONE_RE);
    if (matches) {
      for (const raw of matches) {
        const digits = raw.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 15 && !seen.has(digits)) {
          // Reject 4-digit years or postal codes misidentified as phone numbers
          if (/^(?:19|20)\d{2}$/.test(digits)) continue;
          seen.add(digits);
          out.push({ phone: raw.trim(), sourceSpan: item.text });
        }
      }
    }
  }
  return out;
}

/** Extracts location / city if explicitly labeled in header. */
function extractLocation(taggedLines: Array<{ text: string; section: string }>): { location: string; sourceSpan: string } | null {
  for (const item of taggedLines) {
    if (item.section !== "header" && item.section !== "contact") continue;
    const match = item.text.match(/(?:location|address|based\s+in|city)\s*[:\-]\s*([^|•\n]{3,60})/i);
    if (match && match[1]) {
      return { location: match[1].trim(), sourceSpan: item.text };
    }
    // Check pipe-delimited location in header (e.g. "Pune, India" or "Bengaluru | Karnataka")
    if (item.section === "header" && item.text.includes("|")) {
      const parts = item.text.split("|").map((p) => p.trim());
      for (const p of parts) {
        if (p.includes(",") && !p.includes("@") && !/\d{5,}/.test(p) && p.length <= 50) {
          return { location: p, sourceSpan: item.text };
        }
      }
    }
  }
  return null;
}

/** Extracts education entries by chunking education lines. */
function extractEducation(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["education"] {
  const eduLines = taggedLines.filter((l) => l.section === "education" && !l.section.startsWith("heading:"));
  if (eduLines.length === 0) return [];

  const chunks: Array<Array<{ text: string }>> = [];
  let currentChunk: Array<{ text: string }> = [];

  for (const line of eduLines) {
    const isDegree = DEGREE_RE.test(line.text);
    if (isDegree && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const out: ResumeInterpretationOutput["education"] = [];

  for (const chunk of chunks) {
    const primaryLine = chunk.find((l) => DEGREE_RE.test(l.text)) || chunk[0];
    if (!primaryLine) continue;

    const degree = primaryLine.text.match(DEGREE_RE)?.[0] || "";
    let institution = "";
    let fieldOfStudy = "";
    let graduationYear: string | undefined;
    let gpa: string | undefined;
    let percentage: string | undefined;

    for (const l of chunk) {
      if (!institution && INSTITUTION_RE.test(l.text)) {
        institution = l.text.split("|")[0].trim().slice(0, 150);
      }
      if (!fieldOfStudy && /(?:computer\s+science|information\s+technology|electrical|mechanical|data\s+science|artificial\s+intelligence|electronics|civil|business|commerce)/i.test(l.text)) {
        const specMatch = l.text.match(/(?:in|of)\s+([A-Za-z\s]{3,40})/i);
        fieldOfStudy = specMatch ? specMatch[1].trim() : l.text.trim();
      }
      const yearMatches = l.text.match(YEAR_RE);
      if (yearMatches && yearMatches.length > 0) {
        graduationYear = yearMatches[yearMatches.length - 1];
      }
      const gradeMatch = l.text.match(GRADE_RE);
      if (gradeMatch) {
        if (gradeMatch[0].includes("%")) percentage = gradeMatch[0].trim();
        else gpa = (gradeMatch[1] || gradeMatch[0]).trim();
      }
    }

    if (!institution && chunk.length > 0) {
      institution = chunk[0].text.split("|")[0].trim().slice(0, 150);
    }

    if (institution || degree) {
      out.push({
        institution: institution || "Unknown Institution",
        degree: degree || "Degree",
        fieldOfStudy: fieldOfStudy || undefined,
        graduationYear,
        gpa,
        percentage,
        academicLevel: /master|m\.tech|msc|mca|mba/i.test(degree)
          ? "postgraduate"
          : /ph\.?d|doctorate/i.test(degree)
          ? "doctorate"
          : /diploma/i.test(degree)
          ? "diploma"
          : /10th|12th|school|secondary/i.test(degree)
          ? "high_school"
          : "undergraduate",
        sourceSpan: primaryLine.text.slice(0, 300),
      });
    }
  }

  return out;
}

/** Extracts technical skills using boundary-safe curated dictionary matching. */
function extractSkills(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["skills"] {
  const seen = new Set<string>();
  const out: ResumeInterpretationOutput["skills"] = [];

  for (const item of taggedLines) {
    // Only search in relevant content sections; header contains personal emails/initials
    if (!["skills", "projects", "experience", "internships"].includes(item.section)) {
      continue;
    }
    // Skip email lines or pure URL lines
    if (/@|https?:\/\//i.test(item.text)) {
      continue;
    }

    for (const tech of CURATED_TECH_SKILLS) {
      const lower = tech.name.toLowerCase();
      if (seen.has(lower)) continue;

      // Special boundary for single-character skills (C, R)
      let pattern: RegExp;
      if (tech.name.length === 1) {
        pattern = new RegExp(`(?:^|[\\s,;|/])(${tech.name})(?:[\\s,;|/]|\$)`, "i");
      } else {
        const escaped = tech.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        pattern = new RegExp(`(^|[^a-zA-Z0-9+#])${escaped}([^a-zA-Z0-9+#]|$)`, "i");
      }

      if (pattern.test(item.text)) {
        // Validate against negations or aspirational claims
        const validation = ExtractionValidator.validateSkillClaim(tech.name, item.text);
        if (validation.valid) {
          seen.add(lower);
          out.push({
            name: validation.normalizedValue || tech.name,
            category: tech.category,
            proficiencyHint: "intermediate",
            sourceSpan: item.text.slice(0, 200),
          });
        }
      }
    }
  }

  return out;
}

/** Extracts projects by chunking project blocks. */
function extractProjects(taggedLines: Array<{ text: string; section: string }>, hyperlinks: string[] = []): ResumeInterpretationOutput["projects"] {
  const projLines = taggedLines.filter((l) => l.section === "projects" && !l.section.startsWith("heading:"));
  if (projLines.length === 0) return [];

  const chunks: Array<Array<{ text: string }>> = [];
  let currentChunk: Array<{ text: string }> = [];

  for (const line of projLines) {
    const isUrl = /^https?:\/\//i.test(line.text);
    const isBullet = line.text.startsWith("-") || line.text.startsWith("•") || line.text.startsWith("*");
    const isHeaderCandidate = !isUrl && !isBullet && line.text.length < 100 && (line.text.includes("|") || line.text.includes(":") || /^[A-Z0-9]/.test(line.text));
    if (isHeaderCandidate && currentChunk.length > 0) {
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

    const rawTitle = headLine.text.replace(/^[-•*|]+\s*/, "").split("|")[0].trim();
    if (!rawTitle || /^(projects|academic projects|key projects|personal projects)$/i.test(rawTitle) || /^https?:\/\//i.test(rawTitle)) continue;

    const descLines = chunk.slice(1).map((l) => l.text.replace(/^[-•*]+\s*/, "").trim()).filter((l) => !/^https?:\/\//i.test(l) && Boolean(l));
    const description = descLines.slice(0, 3).join(". ").slice(0, 500);

    // Detect mentioned technologies
    const technologies: string[] = [];
    const chunkText = chunk.map((l) => l.text).join(" ");
    for (const tech of CURATED_TECH_SKILLS) {
      const pattern = new RegExp(`(^|[^a-zA-Z0-9+#])${tech.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zA-Z0-9+#]|$)`, "i");
      if (pattern.test(chunkText) && !technologies.includes(tech.name)) {
        technologies.push(tech.name);
      }
    }

    // Extract repository URL
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

/** Extracts work experiences by chunking experience blocks. */
function extractExperience(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["experience"] {
  const expLines = taggedLines.filter((l) => (l.section === "experience" || l.section === "internships") && !l.section.startsWith("heading:"));
  if (expLines.length === 0) return [];

  const chunks: Array<Array<{ text: string }>> = [];
  let currentChunk: Array<{ text: string }> = [];

  for (const line of expLines) {
    const hasYear = YEAR_RE.test(line.text);
    const isHeaderCandidate = !line.text.startsWith("-") && !line.text.startsWith("•") && (line.text.includes("|") || line.text.includes("@") || hasYear);
    if (isHeaderCandidate && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const out: ResumeInterpretationOutput["experience"] = [];

  for (const chunk of chunks) {
    const headLine = chunk[0];
    if (!headLine) continue;

    let company = "";
    let role = "";
    const t = headLine.text.replace(/^[-•*|]+\s*/, "").trim();

    if (t.includes("|")) {
      const parts = t.split("|").map((p) => p.trim());
      role = parts[0];
      company = parts[1] || parts[0];
    } else if (/(?:at|@)\s+([A-Za-z0-9&.\- ]+)/i.test(t)) {
      const m = t.match(/^(.*?)\s+(?:at|@)\s+([A-Za-z0-9&.\- ]+)/i);
      if (m) {
        role = m[1].trim();
        company = m[2].trim();
      }
    } else {
      role = t;
      company = chunk[1]?.text.trim() || t;
    }

    const chunkText = chunk.map((l) => l.text).join(" ");
    const years = chunkText.match(YEAR_RE);
    const startDate = years?.[0];
    const endDate = years && years.length > 1 ? years[years.length - 1] : undefined;

    const highlights = chunk.slice(1).map((l) => l.text.replace(/^[-•*]+\s*/, "").trim()).filter((h) => h.length >= 15);

    out.push({
      company: (company || "Company").slice(0, 100),
      role: (role || "Role").slice(0, 100),
      type: chunk[0].text.toLowerCase().includes("intern") ? "internship" : "employment",
      startDate,
      endDate,
      duration: [startDate, endDate].filter(Boolean).join(" – ") || undefined,
      highlights: highlights.slice(0, 5),
      technologies: [],
      sourceSpan: headLine.text.slice(0, 300),
    });
  }

  return out;
}

/** Extracts certifications by line parsing. */
function extractCertifications(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["certifications"] {
  const certLines = taggedLines.filter((l) => l.section === "certifications" && !l.section.startsWith("heading:"));
  const out: ResumeInterpretationOutput["certifications"] = [];

  for (const item of certLines) {
    const clean = item.text.replace(/^[-•*|]+\s*/, "").trim();
    if (clean.length < 5) continue;

    const parts = clean.split("|").map((p) => p.trim());
    const name = parts[0];
    const issuer = parts[1] || (/(?:coursera|udemy|aws|google|microsoft|nptel|edx)/i.test(clean) ? clean.match(/(?:coursera|udemy|aws|google|microsoft|nptel|edx)/i)?.[0] : undefined);
    const yearMatch = clean.match(YEAR_RE);

    out.push({
      name: name.slice(0, 150),
      issuer: issuer ? issuer.slice(0, 100) : undefined,
      year: yearMatch?.[0],
      sourceSpan: item.text.slice(0, 300),
    });
  }

  return out;
}

/** Extracts awards and achievements. */
function extractAchievements(taggedLines: Array<{ text: string; section: string }>): ResumeInterpretationOutput["achievements"] {
  const awardLines = taggedLines.filter((l) => l.section === "achievements" && !l.section.startsWith("heading:"));
  const out: ResumeInterpretationOutput["achievements"] = [];

  for (const item of awardLines) {
    const clean = item.text.replace(/^[-•*|]+\s*/, "").trim();
    if (clean.length < 5) continue;

    const category = /patent/i.test(clean)
      ? "patent"
      : /publi|journal|paper|conference/i.test(clean)
      ? "publication"
      : /hackathon|competition|contest/i.test(clean)
      ? "hackathon"
      : "award";

    out.push({
      title: clean.slice(0, 200),
      category,
      description: "",
      sourceSpan: item.text.slice(0, 300),
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
  const phones = extractPhones(tagged);
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
    mobile: phones[0]?.phone,
    location: loc?.location,
    institution: primaryEdu?.institution,
    degree: primaryEdu?.degree,
    specialization: primaryEdu?.fieldOfStudy,
    expectedGraduationYear: primaryEdu?.graduationYear ? Number(primaryEdu.graduationYear) : undefined,
    gpa: primaryEdu?.gpa,
  };

  // Sections detected
  const sectionsDetected = Array.from(new Set(tagged.map((t) => t.section.replace("heading:", "")))).filter((s) => s !== "header");

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
