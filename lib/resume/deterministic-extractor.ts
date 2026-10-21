/**
 * AI TATHASTU — DETERMINISTIC RESUME EXTRACTOR
 *
 * Zero-LLM extraction for text-layer PDFs, DOCX and OCR text. The work is done
 * by lib/resume/extract/engine.ts (sections, entries, typed records, dates,
 * validation); this module maps its records onto ResumeInterpretationOutput,
 * the shape the review, draft and Person 360 code consume.
 *
 * Nothing is invented: a field the document does not state stays empty and its
 * record is marked needs_review. Every record keeps its source span, page and
 * line range, and a review status with the issues that caused it.
 */

import type { ResumeInterpretationOutput, ExtractionQuality } from "@/lib/intelligence/schemas";
import type { ExtractedProfile, ResumeLink } from "@/lib/services/resume-extraction-service";
import type { LayoutLineMeta } from "./layout";
import { CvQualityEvaluator, type SourceCoverageReport } from "./quality-evaluator";
import { extractCv, EXTRACTION_SCHEMA_VERSION, type ExtractedCv, type ExtractMethod, type Evidence, type Review } from "./extract/engine";
import type { NormDate } from "./extract/dates";
import { buildPersonalDetails, type PersonalDetails } from "./extract/personal-details";

// Legacy line tagger (kept for scripts that inspect section tagging).
const HAS_YEAR = /\b(?:19|20)\d{2}\b/;
const MONTH_SRC = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?";
const DATE_POINT_SRC = `(?:${MONTH_SRC}\\s*['’]?\\s*(?:(?:19|20)\\d{2}|\\d{2}\\b)|(?:0?[1-9]|1[0-2])[/.](?:19|20)\\d{2}|(?:19|20)\\d{2})`;
const DATE_END_SRC = `(?:${DATE_POINT_SRC}|Present|Current|Ongoing|Now|Till\\s+date|To\\s+date)`;
const DATE_RANGE_SRC = `(${DATE_POINT_SRC})\\s*(?:–|—|-|\\bto\\b|\\btill\\b|\\buntil\\b)\\s*(${DATE_END_SRC})`;
const DATE_RANGE_RE = new RegExp(DATE_RANGE_SRC, "i");
const DEGREE_RE = /\b(?:B\.?Tech|B\.?E\.?|Bachelor(?:'s)?(?:\s+of\s+[A-Za-z]+)?|BSc|B\.Sc|BCA|BBA|M\.?Tech|Master(?:'s)?(?:\s+of\s+[A-Za-z]+)?|MSc|M\.Sc|MCA|MBA|Ph\.?D|Doctorate|Diploma|IB\s+Diploma(?:\s+Programme)?|Associate(?:'s)?|Class\s*(?:10|12|X|XII)\b|10th|12th|High School|Senior Secondary|Secondary School|Intermediate|Matriculation)\b/i;
const INSTITUTION_RE = /\b(?:university|college|institute|institution|school|academy|polytechnic|vidyalaya|vidyapeeth|complex|board|campus|iit|nit|iiit|bits|vit|lpu|dtu|nsut|mit|stanford|harvard|oxford|cambridge|rochester|chichester)\b/i;
const OCCUPATIONAL_TITLES = /\b(?:developer|designer|engineer|architect|scientist|manager|lead|founder|co-founder|consultant|specialist|analyst|intern|student|researcher|author|officer|advisor|assistant|associate|director|coordinator|executive|editor|president|vice president|vp|coo|ceo|cto|tutor|educator|freelancer|fellow|instructor|trainee|apprentice|programmer|administrator|member|volunteer|mentor|head|representative|ambassador|technician)\b/i;

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
  personalDetails: PersonalDetails;
  profile: ExtractedProfile;
  links: ResumeLink[];
  confidence: number;
  sectionsDetected: string[];
  sourceGraph?: CvSourceGraph;
  coverageReport?: SourceCoverageReport;
  quality: ExtractionQuality;
  engine: ExtractedCv;
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

    // Prefix/suffix matches only for heading-shaped lines: "Research Assistant — IIT Delhi"
    // or "Projects Manager, Acme" are content lines, not section headings.
    const headingShaped =
      cleanHeading.split(/\s+/).length <= 4 &&
      !/\d/.test(cleanHeading) &&
      !/[|@—–]|\s-\s/.test(cleanHeading) &&
      !/[.!?]$/.test(cleanHeading);
    if (cleanHeading.length <= 40 && headingShaped) {
      const isHonorsLine =
        currentSection === "education" &&
        /\b(?:first|second|upper|lower|class|with|distinction|cum laude|merit)\b/i.test(cleanHeading);

      if (!isHonorsLine) {
        for (const [sectionKey, aliases] of Object.entries(SECTION_HEADINGS)) {
          for (const a of aliases) {
            const prefixed = cleanHeading.startsWith(a + " ");
            const suffixed = cleanHeading.endsWith(" " + a);
            const remainder = prefixed ? cleanHeading.slice(a.length) : suffixed ? cleanHeading.slice(0, -a.length) : "";
            if ((prefixed || suffixed) && OCCUPATIONAL_TITLES.test(remainder)) continue;
            if (cleanHeading === a || prefixed || suffixed) {
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

const BODY_SECTIONS = new Set(["education", "experience", "internships", "skills", "projects"]);

/**
 * CVs with no recognisable section headings leave every line in "header", so
 * nothing past name and email was extracted. Only in that case, classify body
 * lines by content; description lines inherit the previous line's section.
 */
export function retagHeadinglessBody(tagged: Array<{ text: string; section: string }>): Array<{ text: string; section: string }> {
  if (tagged.some((t) => BODY_SECTIONS.has(t.section.replace("heading:", "")))) return tagged;
  let current: string | null = null;
  return tagged.map((t, i) => {
    if (i === 0 || t.section !== "header") return t;
    const text = t.text;
    if (/@|https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|io|dev|in|me)\/|\+\d|\b\d{5}\s?\d{5}\b/i.test(text)) {
      current = null;
      return t;
    }
    let section: string | null = null;
    if (DEGREE_RE.test(text) || (INSTITUTION_RE.test(text) && HAS_YEAR.test(text))) section = "education";
    else if (OCCUPATIONAL_TITLES.test(text) && (DATE_RANGE_RE.test(text) || HAS_YEAR.test(text) || /\s(?:at|@)\s/i.test(text))) section = "experience";
    else if (/^(?:proficient|skilled|experienced)\s+(?:in|with)\b|^(?:skills|tools|technologies|tech\s*stack|languages)\s*:/i.test(text)) section = "skills";
    if (section) {
      current = section;
      return { ...t, section };
    }
    return current && current !== "education" ? { ...t, section: current } : t;
  });
}


export interface ExtractionContext {
  lines?: LayoutLineMeta[];
  method?: ExtractMethod;
  pageQuality?: Record<number, number>;
  pageCount?: number;
  now?: Date;
}

const span = (e: Evidence, fallback: string) => {
  const t = (e.text || fallback || "").replace(/^- /, "").replace(/\s- /g, " ").trim().slice(0, 300);
  return t.length >= 3 ? t : `${fallback}`.padEnd(3, " ").slice(0, 300);
};
const rawDate = (d?: NormDate) => (d ? (d.present ? "Present" : d.raw.replace(/^(?:expected|exp\.?)\s*:?\s*/i, "").replace(/\s*\((?:expected|exp\.?)\)\s*$/i, "")) : undefined);
const durationOf = (s?: NormDate, e?: NormDate, current?: boolean) =>
  [rawDate(s), current && !e ? "Present" : rawDate(e)].filter(Boolean).join(" – ") || undefined;

const PLATFORM: Array<[RegExp, string, "profile" | "portfolio"]> = [
  [/github\.com/i, "GitHub", "profile"], [/linkedin\.com/i, "LinkedIn", "profile"], [/leetcode\.c(?:om|n)/i, "LeetCode", "profile"],
  [/kaggle\.com/i, "Kaggle", "profile"], [/huggingface\.co/i, "Hugging Face", "profile"], [/scholar\.google\./i, "Google Scholar", "profile"],
  [/orcid\.org/i, "ORCID", "profile"], [/stackoverflow\.com/i, "Stack Overflow", "profile"], [/behance\.net/i, "Behance", "profile"],
  [/dribbble\.com/i, "Dribbble", "profile"], [/medium\.com/i, "Medium", "profile"],
];

function linkType(url: string): ResumeLink["type"] {
  const h = url.toLowerCase();
  if (h.includes("github.com")) return "github";
  if (h.includes("linkedin.com")) return "linkedin";
  if (/leetcode\.c/.test(h)) return "leetcode";
  if (h.includes("kaggle.com")) return "kaggle";
  if (h.includes("huggingface.co")) return "huggingface";
  if (h.includes("scholar.google.")) return "google_scholar";
  if (h.includes("orcid.org")) return "orcid";
  if (h.includes("stackoverflow.com")) return "stackoverflow";
  return "portfolio";
}

function textQuality(cv: ExtractedCv, text: string, method: ExtractMethod, pageQuality?: Record<number, number>): ExtractionQuality["textQuality"] {
  const chars = text.replace(/\s/g, "").length;
  const q = pageQuality ? Object.values(pageQuality) : [];
  const meanQ = q.length ? q.reduce((a, b) => a + b, 0) / q.length : 1;
  if (chars < 40 || (method === "ocr" && meanQ < 0.45)) return "unreadable";
  if (chars < 250 || (method === "ocr" && meanQ < 0.65)) return "poor";
  if (!cv.sections.length || (method === "ocr" && meanQ < 0.8)) return "limited";
  return "good";
}

/** Maps engine records to the interpretation shape (plus their review/evidence metadata). */
export function toInterpretation(cv: ExtractedCv): ResumeInterpretationOutput {
  const meta = (r: { evidence: Evidence; review?: Review }) => ({ evidence: r.evidence, ...(r.review ? { review: r.review } : {}), provenance: "deterministic" as const });
  const experience = (list: ExtractedCv["experience"]) => list.map((r) => ({
    company: r.organization, role: r.title, type: r.type,
    startDate: rawDate(r.start), endDate: r.current ? "Present" : rawDate(r.end),
    duration: durationOf(r.start, r.end, r.current), highlights: r.highlights.map((h) => h.slice(0, 500)).slice(0, 12),
    technologies: r.technologies.slice(0, 30), sourceSpan: span(r.evidence, r.organization || r.title),
    dates: { ...(r.start ? { start: r.start } : {}), ...(r.end ? { end: r.end } : {}) }, current: r.current, location: r.location, ...meta(r),
  }));
  return {
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    personal: {
      fullName: cv.personal.fullName?.value,
      email: cv.personal.emails[0]?.value,
      phone: cv.personal.phones[0]?.value,
      title: cv.personal.headline?.value.slice(0, 150),
      location: cv.personal.location?.value,
      links: cv.personal.links.map((l) => l.url),
      sourceSpan: (cv.personal.fullName?.evidence.text ?? cv.personal.emails[0]?.evidence.text)?.slice(0, 300),
    },
    summary: cv.summary ? { text: cv.summary.text, headline: cv.personal.headline?.value.slice(0, 200), sourceSpan: span(cv.summary.evidence, cv.summary.text) } : undefined,
    education: cv.education.map((r) => ({
      institution: r.institution, degree: r.degree, fieldOfStudy: r.fieldOfStudy,
      startDate: rawDate(r.start), endDate: rawDate(r.end), graduationYear: r.end?.value?.slice(0, 4),
      gpa: r.grade && r.grade.kind !== "percentage" ? r.grade.raw.slice(0, 20) : undefined,
      percentage: r.grade?.kind === "percentage" ? r.grade.raw.slice(0, 20) : undefined,
      grade: r.grade, academicLevel: r.level, sourceSpan: span(r.evidence, r.institution || r.degree),
      dates: { ...(r.start ? { start: r.start } : {}), ...(r.end ? { end: r.end } : {}) }, current: r.current, location: r.location, ...meta(r),
    })),
    experience: experience(cv.experience),
    leadership: cv.leadership.map((r) => ({
      organization: r.organization, role: r.title,
      type: (r.type === "founder" ? "founder" : "leadership") as "founder" | "leadership",
      startDate: rawDate(r.start), endDate: r.current ? "Present" : rawDate(r.end), duration: durationOf(r.start, r.end, r.current),
      responsibilities: r.highlights.map((h) => h.slice(0, 500)).slice(0, 12), sourceSpan: span(r.evidence, r.organization || r.title),
      dates: { ...(r.start ? { start: r.start } : {}), ...(r.end ? { end: r.end } : {}) }, current: r.current, location: r.location, ...meta(r),
    })),
    volunteering: cv.volunteering.map((r) => ({
      organization: r.organization, role: r.title, dates: durationOf(r.start, r.end, r.current),
      responsibilities: r.highlights.map((h) => h.slice(0, 500)).slice(0, 12), sourceSpan: span(r.evidence, r.organization || r.title),
      dateRange: { ...(r.start ? { start: r.start } : {}), ...(r.end ? { end: r.end } : {}) }, current: r.current, location: r.location, ...meta(r),
    })),
    projects: cv.projects.map((r) => ({
      title: r.name, description: r.description.slice(0, 1000), technologies: r.technologies.slice(0, 30),
      repositoryUrl: r.repositoryUrl ?? "", ...(r.demoUrl ? { demoUrl: r.demoUrl } : {}),
      sourceSpan: span(r.evidence, r.name), ...meta(r),
    })),
    skills: cv.skills.map((s) => ({
      name: s.name, originalName: s.original, category: s.category, proficiencyHint: "unknown" as const,
      sourceSpan: span(s.evidence, s.original).slice(0, 200), isExplicit: true, sourceSection: "skills", group: s.group?.slice(0, 60),
      evidence: s.evidence, provenance: "deterministic" as const,
    })),
    certifications: cv.certifications.map((r) => ({
      name: r.name, issuer: r.issuer, year: r.issued?.value?.slice(0, 4), issueDate: rawDate(r.issued), expiryDate: rawDate(r.expires),
      credentialId: r.credentialId, credentialUrl: r.credentialUrl, status: r.status, sourceSpan: span(r.evidence, r.name),
      dates: { ...(r.issued ? { issued: r.issued } : {}), ...(r.expires ? { expires: r.expires } : {}) }, ...meta(r),
    })),
    achievements: cv.awards.map((a) => ({
      title: a.title, category: a.category, issuer: a.issuer, date: rawDate(a.date), description: "",
      sourceSpan: span(a.evidence, a.title), ...(a.date ? { dates: { issued: a.date } } : {}), ...meta(a),
    })),
    research: cv.publications.map((p) => ({
      title: p.title, type: p.type === "journal" ? "journal" : p.type, publisher: p.venue, date: rawDate(p.date), description: "",
      sourceSpan: span(p.evidence, p.title), ...(p.date ? { dates: { issued: p.date } } : {}), ...meta(p),
    })),
    hackathons: [],
    training: [],
    languages: cv.languages.map((l) => ({ language: l.language, proficiency: l.proficiency, sourceSpan: span(l.evidence, l.language), evidence: l.evidence })),
    digitalFootprints: cv.personal.links.flatMap((l) => {
      const p = PLATFORM.find(([re]) => re.test(l.url));
      try {
        const u = new URL(l.url);
        return [{
          platform: p?.[1] ?? "Portfolio", url: l.url, handle: u.pathname.split("/").filter(Boolean).pop() || u.hostname,
          type: p?.[2] ?? "portfolio", discoveryMethod: "cv_source", sourceSpan: span(l.evidence, l.url),
        }];
      } catch {
        return [];
      }
    }),
    additional: [
      ...cv.memberships.map((m) => ({ heading: m.heading || "Professional Memberships", content: m.content, suggestedCategory: "membership", sourceSpan: span(m.evidence, m.content), evidence: m.evidence })),
      ...cv.other.map((o) => ({ heading: o.heading.slice(0, 100), content: o.content, sourceSpan: span(o.evidence, o.content), evidence: o.evidence })),
    ],
  };
}

/**
 * Extracts a ResumeInterpretationOutput and ExtractedProfile entirely
 * deterministically, without calling any external model.
 */
export function extractResumeDeterministic(sourceText: string, hyperlinks: string[] = [], ctx: ExtractionContext = {}): DeterministicExtractionResult {
  const method = ctx.method ?? "text";
  const cv = extractCv(sourceText, { hyperlinks, lines: ctx.lines, method, pageQuality: ctx.pageQuality, now: ctx.now });
  const interpretation = toInterpretation(cv);
  const primary = [...cv.education].sort((a, b) => rank(b.level) - rank(a.level))[0];
  const profile: ExtractedProfile = {
    fullName: cv.personal.fullName?.value,
    email: cv.personal.emails[0]?.value,
    mobile: cv.personal.phones[0]?.value,
    location: cv.personal.location?.value,
    institution: primary?.institution || undefined,
    degree: primary?.degree || undefined,
    specialization: primary?.fieldOfStudy,
    expectedGraduationYear: primary?.end?.value ? Number(primary.end.value.slice(0, 4)) : undefined,
    gpa: primary?.grade && primary.grade.kind !== "percentage" ? primary.grade.value : undefined,
  };
  const links: ResumeLink[] = cv.personal.links.map((l) => ({ type: linkType(l.url), url: l.url }));
  const records = [...cv.education, ...cv.experience, ...cv.leadership, ...cv.volunteering, ...cv.projects, ...cv.certifications];
  const confidence = records.length ? Math.round((records.reduce((s, r) => s + r.review.confidence, 0) / records.length) * 100) / 100 : 0;
  const quality: ExtractionQuality = {
    schemaVersion: EXTRACTION_SCHEMA_VERSION, method, textQuality: textQuality(cv, sourceText, method, ctx.pageQuality),
    pageCount: ctx.pageCount ?? Math.max(1, ...(ctx.lines ?? []).map((l) => l.page)), warnings: cv.warnings,
    sections: cv.sections.map((s) => ({ section: s.section, heading: s.heading.slice(0, 80), page: s.page })),
  };
  return {
    interpretation, profile, links, confidence, personalDetails: buildPersonalDetails(cv, ctx.now ?? new Date()),
    sectionsDetected: [...new Set(cv.sections.map((s) => s.section))],
    sourceGraph: buildSourceGraph(cv),
    coverageReport: CvQualityEvaluator.evaluateSourceCoverage(interpretation, sourceText),
    quality, engine: cv,
  };
}

function rank(level: string) {
  return ({ doctorate: 4, postgraduate: 3, undergraduate: 2, diploma: 1, other: 0, high_school: -1 } as Record<string, number>)[level] ?? 0;
}

function buildSourceGraph(cv: ExtractedCv): CvSourceGraph {
  const blocks: CvGraphBlock[] = cv.sections.map((s, i) => ({
    blockId: `section_${i + 1}`, pageNumber: s.page, section: s.section, originalText: s.heading, normalizedText: s.heading,
    method: "native", readingOrder: i + 1, confidence: 1,
  }));
  return { documentId: "", blocks, totalBlocks: blocks.length, sectionsFound: [...new Set(cv.sections.map((s) => s.section))] };
}
