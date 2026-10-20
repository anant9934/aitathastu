/**
 * AI TATHASTU — RESUME EXTRACTION SERVICE
 *
 * reading-order text (lib/resume/layout.ts)  ->  one schema-constrained LLM call
 * (lib/resume/structure.ts)  ->  sanity checks  ->  the shapes the rest of the
 * pipeline consumes (ResumeInterpretationOutput for candidates/Person 360,
 * extractedProfile + typed links for onboarding).
 *
 * The sanity pass only cleans and checks the model's output (glyphs, URL/email
 * shape, link typing by domain, de-duplication, grounding in the source text).
 * It never extracts fields itself.
 */

import { ResumeInterpretationSchema, type ResumeInterpretationOutput } from "../intelligence/schemas";
import { LINK_TYPES, type ResumeExtraction } from "@/lib/resume/schema";
import { structureResumeText, RESUME_PROMPT_VERSION, ResumeStructuringError } from "@/lib/resume/structure";
import { extractResumeDeterministic, type ExtractionContext } from "@/lib/resume/deterministic-extractor";
import type { ExtractionQuality } from "../intelligence/schemas";
import { ResumeDeduplicationEngine } from "@/lib/resume/deduplication-engine";
import { discoverFootprintsFromResume } from "./digital-footprint-discovery";
import { CvQualityEvaluator, type SourceCoverageReport } from "@/lib/resume/quality-evaluator";
import type { ExtractorProfileV2 } from "./extractor-service-client";

export type ResumeLink = { type: (typeof LINK_TYPES)[number]; url: string };

export interface ExtractedProfile {
  fullName?: string;
  email?: string;
  mobile?: string;
  location?: string;
  degree?: string;
  specialization?: string;
  institution?: string;
  expectedGraduationYear?: number;
  gpa?: string;
}

export interface ResumeExtractionResult {
  success: boolean;
  extracted: ResumeInterpretationOutput | null;
  /** Cleaned model output, kept as-is for review and export. */
  resume?: ResumeExtraction;
  extractedProfile?: ExtractedProfile;
  links?: ResumeLink[];
  discoveredProfiles?: Partial<Record<string, string>>;
  provider: string;
  modelUsed: string;
  promptVersion: string;
  latencyMs: number;
  truncated: boolean;
  error?: string;
  /** Document-level quality from the deterministic engine. */
  quality?: ExtractionQuality;
  /** Why structuring failed, when it did: "quota" lets ingestion say so plainly. */
  errorKind?: "not_configured" | "quota" | "provider" | "invalid_output";
}

const GLYPHS = /[-�​-‍﻿•●○◦▪▫■□◆◇►▶▸▹➢➤✓✔☐☑]/gu;

function tidy(v: string | null | undefined, max = 300): string {
  return (v ?? "")
    .replace(GLYPHS, " ")
    .replace(/^[\s\-–—*·|:]+|[\s|,;:·]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const DOMAIN_TYPES: Array<[RegExp, ResumeLink["type"]]> = [
  [/(^|\.)github\.com$/i, "github"],
  [/(^|\.)linkedin\.com$/i, "linkedin"],
  [/(^|\.)leetcode\.(com|cn)$/i, "leetcode"],
  [/(^|\.)kaggle\.com$/i, "kaggle"],
  [/(^|\.)huggingface\.co$/i, "huggingface"],
  [/^scholar\.google\./i, "google_scholar"],
  [/(^|\.)orcid\.org$/i, "orcid"],
  [/(^|\.)stackoverflow\.com$/i, "stackoverflow"],
  [/(^|\.)codechef\.com$/i, "codechef"],
  [/(^|\.)hackerrank\.com$/i, "hackerrank"],
  [/(^|\.)dev\.to$/i, "devto"],
];

function normalizeUrl(raw: string | null | undefined): string | null {
  let u = tidy(raw, 500).replace(/^<|>$/g, "");
  if (!u || /^mailto:/i.test(u) || /@/.test(u.split("/")[0])) return null;
  // Fix OCR typos in TLD (e.g. linkedin.comy -> linkedin.com)
  u = u.replace(/\.comy(?=\/|$)/gi, ".com").replace(/\.coim(?=\/|$)/gi, ".com").replace(/\.con(?=\/|$)/gi, ".com");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    if (!url.hostname.includes(".")) return null;
    const h = url.hostname.toLowerCase().replace(/^www\./, "");
    if (/^(?:b|m)\.(?:tech|sc|com|e|arch)$/i.test(h)) return null;
    if (h.split(".").length === 2 && h.split(".")[0].length <= 1) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function linkType(url: string, claimed: ResumeLink["type"]): ResumeLink["type"] {
  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "other";
  }
  const known = DOMAIN_TYPES.find(([re]) => re.test(host));
  if (known) return known[1];
  // A claimed site type whose domain does not match is wrong; personal domains are portfolios.
  return claimed === "other" || claimed === "portfolio" ? claimed : "portfolio";
}

/** Cleans and checks model output. Drops entries missing their identifying field. */
export function sanitizeResumeExtraction(x: ResumeExtraction): { resume: ResumeExtraction; links: ResumeLink[] } {
  const email = tidy(x.email).replace(/^mailto:/i, "");
  const phone = tidy(x.phone);

  const projects = x.projects
    .map((p) => ({
      name: tidy(p.name, 200),
      description: tidy(p.description, 1000),
      link: normalizeUrl(p.link),
      repository: normalizeUrl(p.repository),
      tech_stack: dedupe(p.tech_stack.map((t) => tidy(t, 50))),
    }))
    .filter((p) => p.name);
  const projectLinks = new Set(projects.flatMap((p) => [p.link, p.repository]).filter(Boolean));

  const links: ResumeLink[] = [];
  /** Strip www. prefix for dedup key so that www.github.com and github.com collapse. */
  const dedupeKey = (u: string) => u.toLowerCase().replace(/^(https?:\/\/)www\./, "$1");
  for (const l of x.links) {
    const url = normalizeUrl(l.url);
    if (!url || projectLinks.has(url) || links.some((e) => dedupeKey(e.url) === dedupeKey(url))) continue;
    links.push({ type: linkType(url, l.type), url });
  }

  const resume: ResumeExtraction = {
    name: tidy(x.name, 80) || null,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    phone: (phone.match(/\d/g) || []).length >= 7 ? phone : null,
    location: tidy(x.location, 120) || null,
    links,
    education: x.education
      .map((e) => ({
        institution: tidy(e.institution, 200),
        degree: tidy(e.degree, 100) || null,
        field_of_study: tidy(e.field_of_study, 100) || null,
        level: e.level,
        start_date: tidy(e.start_date, 30) || null,
        end_date: tidy(e.end_date, 30) || null,
        grade: tidy(e.grade, 30).replace(/^(c?gpa|cpi|sgpa|percentage|grade|score)\s*[:\-]\s*/i, "").slice(0, 20) || null,
      }))
      .filter((e) => e.institution),
    experience: x.experience
      .map((e) => ({
        company: tidy(e.company, 150),
        role: tidy(e.role, 150),
        type: e.type,
        location: tidy(e.location, 120) || null,
        start_date: tidy(e.start_date, 30) || null,
        end_date: tidy(e.end_date, 30) || null,
        description: e.description.map((d) => tidy(d, 500)).filter(Boolean),
      }))
      .filter((e) => e.company && e.role),
    projects,
    skills: dedupe(x.skills.map((s) => tidy(s, 100)).filter((s) => s.length <= 60 && s.split(" ").length <= 6)),
    certifications: x.certifications
      .map((c) => ({ name: tidy(c.name, 200), issuer: tidy(c.issuer, 150) || null, date: tidy(c.date, 20) || null }))
      .filter((c) => c.name),
    achievements: dedupe(x.achievements.map((a) => tidy(a, 250))),
  };
  return { resume, links };
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const k = v.toLowerCase();
    if (!v || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * The source line that contains `needle`, used as the claim's evidence span.
 * Returns null when the value does not appear in the document: such a claim is
 * ungrounded and is not offered for review.
 */
function evidenceLine(lines: string[], ...needles: Array<string | null | undefined>): string | null {
  for (const needle of needles) {
    const n = needle?.trim().toLowerCase();
    if (!n) continue;
    // Short names ("C", "R", "Go") must match as a whole token, not a substring.
    const token = n.length < 3 ? new RegExp(`(^|[^a-z0-9+#])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+#]|$)`) : null;
    const nn = normalizeForGrounding(n).trim();
    const line =
      lines.find((l) => (token ? token.test(l.toLowerCase()) : l.toLowerCase().includes(n))) ??
      // OCR spacing / punctuation differences: same normalisation as isGrounded.
      (nn.length >= 3 ? lines.find((l) => normalizeForGrounding(l).includes(nn)) : undefined);
    if (line) {
      const t = line.trim();
      if (t.length <= 300) return t.length >= 3 ? t : null;
      const i = t.toLowerCase().indexOf(n);
      return t.slice(Math.max(0, i - 100), i + n.length + 100).trim();
    }
  }
  return null;
}

/**
 * Fuzzy containment for grounding (Task 1.1.3): case, punctuation and spacing
 * differences (OCR "Anna  University," vs "Anna University") do not matter;
 * "+" and "#" are kept so C++ / C# stay distinct. Short values (< 3 chars)
 * must match a whole token.
 */
export function normalizeForGrounding(text: string): string {
  return ` ${text.toLowerCase().replace(/https?:\/\/(www\.)?/g, "").replace(/[^a-z0-9+#]+/g, " ").trim()} `;
}
export function isGrounded(normalizedSource: string, value: string | null | undefined): boolean {
  const v = normalizeForGrounding(value || "").trim();
  if (!v) return false;
  return normalizedSource.includes(` ${v} `) || (v.length >= 3 && normalizedSource.includes(v));
}

const year = (s: string | null) => s?.match(/\b(19|20)\d{2}\b/g)?.pop();

/** Model output never counts as checked: it is marked "llm" and held for the student's review. */
const LLM_REVIEW = (issues: string[] = []) => ({
  status: "needs_review" as const, confidence: 0.6, issues: ["model_extracted", ...issues], fields: {},
});

export function toInterpretation(r: ResumeExtraction, sourceText: string): ResumeInterpretationOutput {
  const lines = sourceText.split("\n");
  const norm = normalizeForGrounding(sourceText);
  const grounded = (v: string | null | undefined) => isGrounded(norm, v);
  // A model value the document does not contain is dropped (a field) or the record is skipped (its key).
  const keep = (v: string | null | undefined) => (v && grounded(v) ? v : undefined);
  const out: ResumeInterpretationOutput = { education: [], experience: [], projects: [], skills: [], certifications: [], achievements: [] };

  for (const e of r.education) {
    // The institution must be in the document; a degree or field that is not is dropped, not trusted.
    if (!grounded(e.institution)) continue;
    const span = evidenceLine(lines, e.institution, e.degree);
    if (!span) continue;
    const degree = grounded(e.degree) ? e.degree : null;
    const field = grounded(e.field_of_study) ? e.field_of_study : null;
    const end = keep(e.end_date);
    const grade = keep(e.grade);
    out.education.push({
      institution: e.institution,
      degree: degree || "",
      fieldOfStudy: field || undefined,
      startDate: keep(e.start_date),
      endDate: end,
      graduationYear: year(end ?? null),
      gpa: grade && !/%/.test(grade) ? grade : undefined,
      percentage: grade && /%/.test(grade) ? grade : undefined,
      academicLevel: e.level,
      sourceSpan: span,
      provenance: "llm",
      review: LLM_REVIEW(e.start_date && !keep(e.start_date) || e.end_date && !end ? ["ungrounded_date_dropped"] : []),
    });
  }
  for (const e of r.experience) {
    if (!grounded(e.company)) continue;
    const span = evidenceLine(lines, e.company, e.role);
    if (!span) continue;
    const start = keep(e.start_date), end = /^(present|current|ongoing|now)$/i.test(e.end_date ?? "") ? "Present" : keep(e.end_date);
    const role = keep(e.role) ?? "";
    out.experience.push({
      company: e.company,
      role,
      type: e.type,
      startDate: start,
      endDate: end,
      duration: [start, end].filter(Boolean).join(" – ") || undefined,
      highlights: e.description.filter((d) => grounded(d.slice(0, 60))),
      technologies: [],
      sourceSpan: span,
      provenance: "llm",
      review: LLM_REVIEW(role ? [] : ["missing_title"]),
    });
  }
  for (const p of r.projects) {
    if (!grounded(p.name)) continue;
    const span = evidenceLine(lines, p.name);
    if (!span) continue;
    // A repository or tech the document never mentions is a fabrication: drop it.
    const repositoryUrl = [p.repository, p.link].find((u) => grounded(u)) || undefined;
    out.projects.push({ title: p.name, description: grounded(p.description.slice(0, 60)) ? p.description : "", technologies: p.tech_stack.filter(grounded), repositoryUrl, sourceSpan: span, provenance: "llm", review: LLM_REVIEW() });
  }
  for (const s of r.skills) {
    if (!grounded(s)) continue;
    const span = evidenceLine(lines, s);
    if (span) out.skills.push({ name: s, category: "other", proficiencyHint: "unknown", sourceSpan: span, provenance: "llm" });
  }
  for (const c of r.certifications) {
    const span = evidenceLine(lines, c.name);
    if (span) out.certifications.push({ name: c.name, issuer: keep(c.issuer), year: year(keep(c.date) ?? null), sourceSpan: span, provenance: "llm", review: LLM_REVIEW() });
  }
  for (const a of r.achievements) {
    const span = evidenceLine(lines, a, a.slice(0, 40));
    if (!span) continue;
    const category = /patent/i.test(a) ? "patent" : /publi|journal|conference|paper/i.test(a) ? "publication" : /hackathon/i.test(a) ? "hackathon" : "award";
    out.achievements.push({ title: a, category, description: "", sourceSpan: span, provenance: "llm", review: LLM_REVIEW() });
  }
  return out;
}

/** The degree onboarding asks about: the highest non-school entry, else the first. */
export function primaryEducation(r: ResumeExtraction) {
  const rank = { doctorate: 4, postgraduate: 3, undergraduate: 2, diploma: 1, other: 0, high_school: -1 } as const;
  return [...r.education].sort((a, b) => rank[b.level] - rank[a.level])[0];
}

export function toExtractedProfile(r: ResumeExtraction): ExtractedProfile {
  const edu = primaryEducation(r);
  const grad = edu ? year(edu.end_date) : undefined;
  return {
    fullName: r.name || undefined,
    email: r.email || undefined,
    mobile: undefined,
    location: r.location || undefined,
    institution: edu?.institution,
    degree: edu?.degree || undefined,
    specialization: edu?.field_of_study || undefined,
    expectedGraduationYear: grad ? Number(grad) : undefined,
    gpa: edu?.grade || undefined,
  };
}

/** Primary entry point: reading-order text in, structured + validated resume out. */
export async function extractResumeStructured(resumeText: string, personId?: string): Promise<ResumeExtractionResult> {
  const startTime = Date.now();
  let base = { provider: "unknown", promptVersion: RESUME_PROMPT_VERSION, truncated: false };
  try {
    const { data, model, provider, truncated } = await structureResumeText(resumeText, personId);
    base = { ...base, provider };
    const { resume, links } = sanitizeResumeExtraction(data);
    const validated = ResumeInterpretationSchema.safeParse(toInterpretation(resume, resumeText));
    if (!validated.success) {
      return { ...base, success: false, extracted: null, modelUsed: model, latencyMs: Date.now() - startTime, error: validated.error.issues[0]?.message };
    }
    return {
      ...base,
      success: true,
      extracted: validated.data,
      resume,
      extractedProfile: toExtractedProfile(resume),
      links,
      discoveredProfiles: Object.fromEntries(links.filter((l) => l.type !== "other").map((l) => [l.type, l.url])),
      modelUsed: model,
      latencyMs: Date.now() - startTime,
      truncated,
    };
  } catch (err) {
    return {
      ...base,
      success: false,
      extracted: null,
      modelUsed: "",
      latencyMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : "Structured extraction could not be completed.",
      errorKind: err instanceof ResumeStructuringError ? err.kind : undefined,
    };
  }
}

/**
 * Tier 1 Deterministic Baseline: executes pure TypeScript regex & dictionary
 * extraction without contacting any external model or incurring quota costs.
 */
export function extractResumeDeterministicResult(
  text: string,
  hyperlinks: string[] = [],
  ctx: ExtractionContext = {}
): ResumeExtractionResult {
  const startTime = Date.now();
  const det = extractResumeDeterministic(text, hyperlinks, ctx);
  const validated = ResumeInterpretationSchema.safeParse(det.interpretation);
  if (!validated.success) {
    return {
      success: false,
      extracted: null,
      provider: "deterministic-engine",
      modelUsed: "rules-v1",
      promptVersion: "v1",
      latencyMs: Date.now() - startTime,
      truncated: false,
      error: validated.error.issues[0]?.message || "Deterministic schema validation failed",
    };
  }

  // Combine discovered footprints — deduplicate across both sources
  const fps = discoverFootprintsFromResume({ text, hyperlinks });
  const linkKey = (url: string) =>
    url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\/(?:www\.)?/, "").replace(/^leetcode\.com\/u\//, "leetcode.com/");
  const links: ResumeLink[] = [];
  const seenLinkUrls = new Set<string>();
  for (const l of det.links) {
    const key = linkKey(l.url);
    if (seenLinkUrls.has(key)) continue;
    seenLinkUrls.add(key);
    links.push(l);
  }
  // The engine's links (header/contact area and profile URLs) come first; the
  // discovery pass may add other known profile providers, never guessed portfolios.
  const discoveredProfiles: Record<string, string> = {};
  for (const l of links) if (l.type !== "other" && !discoveredProfiles[l.type]) discoveredProfiles[l.type] = l.url;
  for (const fp of fps) {
    if (!fp.normalizedUrl || fp.provider === "portfolio") continue;
    const key = linkKey(fp.normalizedUrl);
    if (!seenLinkUrls.has(key)) {
      seenLinkUrls.add(key);
      links.push({ type: linkType(fp.normalizedUrl, "portfolio"), url: fp.normalizedUrl });
    }
    if (!discoveredProfiles[fp.provider]) discoveredProfiles[fp.provider] = fp.normalizedUrl;
  }

  return {
    success: true,
    extracted: validated.data,
    extractedProfile: det.profile,
    links,
    discoveredProfiles,
    quality: det.quality,
    provider: "deterministic-engine",
    modelUsed: "rules-v3",
    promptVersion: "cv-extract/3.0",
    latencyMs: Date.now() - startTime,
    truncated: false,
  };
}

/**
 * Adapts Render's Schema v2.0 profile.json into Vercel's ResumeExtractionResult.
 * Preserves evidence snippets, job ownership, and verified deterministic extraction
 * so scanned CVs processed by Render PyMuPDF/Tesseract avoid redundant re-parsing.
 */
export function adaptRenderProfileToInterpretation(
  renderProfile: ExtractorProfileV2 | null | undefined,
  rawText: string = ""
): ResumeExtractionResult {
  const startTime = Date.now();
  const text = rawText || "";
  const lines = text ? text.split("\n") : [];
  const norm = text ? normalizeForGrounding(text) : "";
  const grounded = (v: string | null | undefined) => !norm || isGrounded(norm, v);

  if (!renderProfile || !renderProfile.groups) {
    return {
      success: false,
      extracted: null,
      provider: "render-ocr",
      modelUsed: "render-deterministic-v2",
      promptVersion: "render-v2",
      latencyMs: 0,
      truncated: false,
      error: "Render profile is empty or missing groups",
    };
  }

  const groups = renderProfile.groups;
  const span = (snippet: string | undefined | null, fallback: string | undefined | null): string => {
    if (snippet && snippet.trim().length >= 3) {
      return snippet.trim().slice(0, 300);
    }
    const ev = evidenceLine(lines, fallback);
    if (ev && ev.length >= 3) return ev.slice(0, 300);
    const fb = (fallback || "").trim();
    return fb.length >= 3 ? fb.slice(0, 300) : "Document evidence";
  };

  // 1. Identity & Contact
  const idRec = groups.identity?.[0]?.fields || {};
  const fullName = tidy(idRec.full_name?.value, 80) || null;

  let email: string | null = null;
  let location: string | null = tidy(idRec.location?.value, 120) || null;

  for (const c of groups.contact || []) {
    const f = c.fields;
    if (!email && f.email?.value) {
      const rawEmail = tidy(f.email.value).replace(/^mailto:/i, "");
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        email = rawEmail;
      }
    }
    if (!location && f.location?.value) {
      location = tidy(f.location.value, 120) || null;
    }
  }

  // 2. Education
  const education: ResumeInterpretationOutput["education"] = [];
  const rawEducation = groups.education || [];
  for (const rec of rawEducation) {
    const f = rec.fields;
    const institution = tidy(f.institution?.value || f.university?.value || f.board?.value, 200);
    const instSnippet = f.institution?.evidence?.[0]?.snippet;
    const isInstGrounded = !norm || grounded(institution) || (instSnippet && isGrounded(norm, instSnippet)) || (institution && isGrounded(norm, institution.split(",")[0]));
    if (!institution || !isInstGrounded) continue;

    const degree = tidy(f.degree_title?.value || f.qualification?.value, 100);
    const fieldOfStudy = tidy(f.specialization?.value || f.department?.value, 100) || undefined;
    const startDate = tidy(f.start_date?.value, 30) || undefined;
    const endDate = tidy(f.end_date?.value, 30) || undefined;
    const isOngoing = Boolean((endDate && /(?:present|current|ongoing)/i.test(endDate)) || (!endDate && startDate));
    const graduationYear = tidy(f.expected_graduation?.value, 20) || (!isOngoing && endDate ? year(endDate) : undefined);
    const grade = tidy(f.grade?.value, 30);
    const gpa = grade && !/%/.test(grade) ? grade.replace(/^(c?gpa|cpi|sgpa)\s*[:\-]\s*/i, "").slice(0, 20) : undefined;
    const percentage = grade && /%/.test(grade) ? grade.slice(0, 20) : undefined;
    const sourceSpan = span(f.institution?.evidence?.[0]?.snippet || f.degree_title?.evidence?.[0]?.snippet, institution);

    education.push({
      institution,
      degree: degree || fieldOfStudy || "",
      fieldOfStudy,
      startDate,
      endDate,
      graduationYear,
      gpa,
      percentage,
      sourceSpan,
    });
  }

  // 3. Experience, Internships & Leadership
  const experience: ResumeInterpretationOutput["experience"] = [];
  const expRecords = [...(groups.experience || []), ...(groups.internships || []), ...(groups.leadership || [])];
  for (const rec of expRecords) {
    const f = rec.fields;
    const company = tidy(f.organization?.value || f.provider?.value || f.program?.value, 150);
    if (!company || !grounded(company)) continue;

    const role = tidy(f.job_title?.value || f.role?.value, 150) || "";
    const isIntern = /\b(?:intern|internship|trainee|apprentice)\b/i.test(f.employment_type?.value || role || f.program?.value || "");
    const isFounder = /\b(?:founder|co-founder|coo|ceo|president|vice president|vp)\b/i.test(role);
    const isLeadership = isFounder || Boolean(groups.leadership?.includes(rec)) || /\b(?:lead|advisor|coordinator|director|head)\b/i.test(role);
    const expType = isFounder ? "founder" : isLeadership ? "leadership" : isIntern ? "internship" : "employment";
    const startDate = tidy(f.start_date?.value, 30) || undefined;
    const endDate = tidy(f.end_date?.value, 30) || undefined;
    const duration = tidy(f.duration?.value, 100) || ([startDate, endDate].filter(Boolean).join(" – ") || undefined);

    const highlights: string[] = [];
    if (f.responsibility?.value) highlights.push(tidy(f.responsibility.value, 500));
    if (f.contribution?.value) highlights.push(tidy(f.contribution.value, 500));
    if (f.outcome?.value) highlights.push(tidy(f.outcome.value, 500));

    const techStr = f.technologies?.value || f.skills?.value || "";
    const technologies = techStr ? dedupe(techStr.split(/[,;|]/).map((t) => tidy(t, 50)).filter(Boolean)) : [];
    const sourceSpan = span(f.organization?.evidence?.[0]?.snippet || f.job_title?.evidence?.[0]?.snippet, company);

    experience.push({
      company,
      role,
      type: expType,
      startDate,
      endDate,
      duration,
      highlights,
      technologies,
      sourceSpan,
    });
  }

  // 4. Projects
  const projects: ResumeInterpretationOutput["projects"] = [];
  for (const rec of groups.projects || []) {
    const f = rec.fields;
    const title = tidy(f.title?.value, 200);
    if (!title || !grounded(title)) continue;

    const description = tidy(f.description?.value || f.contribution?.value || f.outcome?.value, 1000);
    const techStr = f.technologies?.value || "";
    const technologies = techStr ? dedupe(techStr.split(/[,;|]/).map((t) => tidy(t, 50)).filter(Boolean)) : [];
    const repositoryUrl = normalizeUrl(f.github_url?.value || f.demo_url?.value || f.evidence_url?.value) || "";
    const sourceSpan = span(f.title?.evidence?.[0]?.snippet, title);

    projects.push({
      title,
      description,
      technologies,
      repositoryUrl,
      sourceSpan,
    });
  }

  // 5. Skills (Preserve explicit skills; project-only technologies belong to contextual project technologies)
  const skills: ResumeInterpretationOutput["skills"] = [];
  for (const rec of groups.skills || []) {
    const f = rec.fields;
    const sectionsFound = (f.sections_found?.value || "").toLowerCase();
    if (sectionsFound && sectionsFound !== "skills" && sectionsFound.includes("project")) {
      continue;
    }
    const name = tidy(f.canonical_name?.value || f.original_wording?.value, 100);
    const orig = tidy(f.original_wording?.value, 100);
    const skillSnippet = f.canonical_name?.evidence?.[0]?.snippet || f.original_wording?.evidence?.[0]?.snippet;
    const isSkillGrounded = !norm || grounded(name) || (orig && grounded(orig)) || (skillSnippet && isGrounded(norm, skillSnippet));
    if (!name || !isSkillGrounded) continue;

    const cat = (f.category?.value || "").toLowerCase();
    const validCats = ["language", "framework", "library", "tool", "concept", "other"] as const;
    const category = validCats.includes(cat as any) ? (cat as any) : "other";
    const sourceSpan = span(f.canonical_name?.evidence?.[0]?.snippet, name);

    skills.push({
      name,
      category,
      proficiencyHint: "unknown",
      sourceSpan,
    });
  }

  // 6. Certifications
  const certifications: ResumeInterpretationOutput["certifications"] = [];
  for (const rec of groups.certifications || []) {
    const f = rec.fields;
    const rawName = tidy(f.title?.value || f.name?.value, 200);
    const name = rawName.replace(/^[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘'’"©®¢~§°+]+|[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘'’"©®¢~§°+]+$/g, "").trim();
    if (!name || !grounded(name)) continue;

    const issuer = tidy(f.issuer?.value || f.organization?.value, 150)?.replace(/[\s,‘'’"`]+$/, "").replace(/\s+[‘'’"]?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b.*$/i, "").trim() || undefined;
    const yr = year(f.issue_date?.value || f.date?.value || null);
    const sourceSpan = span(f.title?.evidence?.[0]?.snippet || f.name?.evidence?.[0]?.snippet, name);

    certifications.push({
      name,
      issuer,
      year: yr,
      sourceSpan,
    });
  }

  // 7. Achievements, Books & Patents
  const achievements: ResumeInterpretationOutput["achievements"] = [];
  const achRecords = [...(groups.awards || []), ...(groups.research || []), ...(groups.books_patents || [])];
  for (const rec of achRecords) {
    const f = rec.fields;
    const rawTitle = tidy(f.name?.value || f.title?.value, 250);
    const title = rawTitle.replace(/^[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘'’"©®¢~§°+]+|[•·*◦\-–—»«›‹\u2022\u2023\u25cf\u25cb\u25b8\u25aa\u25ab|#\s‘'’"©®¢~§°+]+$/g, "").trim();
    if (!title || !grounded(title.slice(0, 40))) continue;

    const typeVal = (f.type?.value || "").toLowerCase();
    const isPatent = typeVal === "patent" || /patent/i.test(title);
    const isBook = typeVal === "book" || /book/i.test(title);
    const isPub = typeVal === "publication" || Boolean(groups.research?.includes(rec)) || /publi|journal|paper/i.test(title);
    const category = isPatent ? "patent" : isBook ? "book" : isPub ? "publication" : "award";
    const sourceSpan = span(f.name?.evidence?.[0]?.snippet || f.title?.evidence?.[0]?.snippet, title);

    achievements.push({
      title,
      category,
      description: tidy(f.event?.value || f.venue?.value || f.outcome?.value, 500),
      sourceSpan,
    });
  }

  // 8. Digital Footprint Links & Dedicated Footprints
  const links: ResumeLink[] = [];
  const digitalFootprints: NonNullable<ResumeInterpretationOutput["digitalFootprints"]> = [];
  for (const rec of groups.digital_footprint || []) {
    const f = rec.fields;
    const u = normalizeUrl(f.normalized_url?.value || f.original_url?.value);
    if (!u) continue;
    if (/^https?:\/\/(?:www\.)?github\.com(?:\/github)?\/?$/i.test(u) || /^https?:\/\/(?:www\.)?linkedin\.com(?:\/in|\/pub)?\/?$/i.test(u)) {
      continue;
    }
    links.push({
      type: linkType(u, "portfolio"),
      url: u,
    });
    const platform = tidy(f.platform?.value, 50) || (u.includes("github.com") ? "GitHub" : u.includes("linkedin.com") ? "LinkedIn" : "Portfolio");
    const handle = u.includes("github.com/") ? u.split("github.com/")[1]?.split("/")[0] : u.includes("linkedin.com/in/") ? u.split("linkedin.com/in/")[1]?.split("/")[0] : undefined;
    digitalFootprints.push({
      platform,
      url: u,
      handle: handle ? handle.replace(/^@/, "") : undefined,
      type: u.includes("github.com") ? "profile" : u.includes("linkedin.com") ? "profile" : "portfolio",
      discoveryMethod: "ocr",
      sourceSpan: span(f.original_url?.evidence?.[0]?.snippet, u),
    });
  }
  for (const c of groups.contact || []) {
    if (c.fields.website?.value) {
      const u = normalizeUrl(c.fields.website.value);
      if (u) {
        // If this URL is actually a LinkedIn or GitHub profile that we already have, ignore duplicate
        const isKnownProfile = (u.includes("linkedin.com") && digitalFootprints.some((df) => df.platform === "LinkedIn")) ||
          (u.includes("github.com") && digitalFootprints.some((df) => df.platform === "GitHub"));
        if (!isKnownProfile && !links.some((l) => l.url.toLowerCase() === u.toLowerCase()) && !digitalFootprints.some((df) => df.url.toLowerCase() === u.toLowerCase())) {
          links.push({
            type: linkType(u, "portfolio"),
            url: u,
          });
          digitalFootprints.push({
            platform: "Portfolio",
            url: u,
            type: "portfolio",
            discoveryMethod: "ocr",
            sourceSpan: span(c.fields.website?.evidence?.[0]?.snippet, u),
          });
        }
      }
    }
  }

  const interpreted: ResumeInterpretationOutput = {
    education,
    experience,
    projects,
    skills,
    certifications,
    achievements,
    digitalFootprints,
  };

  const parsed = ResumeInterpretationSchema.safeParse(interpreted);
  if (!parsed.success) {
    return {
      success: false,
      extracted: null,
      provider: "render-ocr",
      modelUsed: "render-deterministic-v2",
      promptVersion: "render-v2",
      latencyMs: Date.now() - startTime,
      truncated: false,
      error: parsed.error.issues[0]?.message || "Schema validation failed",
    };
  }

  let phone: string | undefined = undefined;
  for (const c of groups.contact || []) {
    if (c.fields.phone?.value) {
      phone = tidy(c.fields.phone.value);
      break;
    }
  }
  if (!phone && text) {
    const phoneMatch = text.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
    if (phoneMatch) phone = phoneMatch[0].trim();
  }

  const firstEdu = education[0];
  const extractedProfile: ExtractedProfile = {
    fullName: fullName || undefined,
    email: email || undefined,
    mobile: phone || undefined,
    location: location || undefined,
    institution: firstEdu?.institution,
    degree: firstEdu?.degree,
    specialization: firstEdu?.fieldOfStudy,
    expectedGraduationYear: firstEdu?.graduationYear ? Number(firstEdu.graduationYear) : undefined,
    gpa: firstEdu?.gpa,
  };

  const discoveredProfiles = Object.fromEntries(
    links.filter((l) => l.type !== "other").map((l) => [l.type, l.url])
  );

  return {
    success: true,
    extracted: parsed.data,
    extractedProfile,
    links,
    discoveredProfiles,
    provider: "render-ocr",
    modelUsed: "render-deterministic-v2",
    promptVersion: "render-v2",
    latencyMs: Date.now() - startTime,
    truncated: false,
  };
}

export interface EnrichmentDecisionOptions {
  consent?: boolean;
  aiFeatureEnabled?: boolean;
  quotaAllowed?: boolean;
  rawText?: string;
  sourceReport?: SourceCoverageReport;
}

export interface EnrichmentDecision {
  shouldEnrich: boolean;
  reason: string;
}

/**
 * Determines whether optional AI enrichment should be invoked.
 *
 * Enrichment is skipped when:
 * 1. AI is disabled via environment variables (CORE_DISABLE_LIVE_LLM)
 * 2. User has explicitly declined AI consent
 * 3. Daily or monthly quota is exhausted
 * 4. Deterministic baseline already captures high-coverage structured data with no critical gaps
 */
export function shouldEnrichWithLLM(
  baseline: ResumeInterpretationOutput | null | undefined,
  options: EnrichmentDecisionOptions = {}
): EnrichmentDecision {
  if (process.env.CORE_DISABLE_LIVE_LLM === "true") {
    return { shouldEnrich: false, reason: "ai_disabled_by_env" };
  }

  if (options.consent === false) {
    return { shouldEnrich: false, reason: "user_consent_declined" };
  }

  if (options.quotaAllowed === false) {
    return { shouldEnrich: false, reason: "quota_exhausted_or_unavailable" };
  }

  if (!baseline) {
    return { shouldEnrich: true, reason: "missing_deterministic_baseline" };
  }

  // 1. Source coverage evaluation if rawText is provided
  if (options.rawText) {
    const report = options.sourceReport || CvQualityEvaluator.evaluateSourceCoverage(baseline, options.rawText);
    if (!report.isSufficient || report.criticalGaps.length > 0) {
      return {
        shouldEnrich: true,
        reason: report.criticalGaps[0] || "source_coverage_gap",
      };
    }
  }

  const eduCount = baseline.education?.length ?? 0;
  const skillCount = baseline.skills?.length ?? 0;
  const projCount = baseline.projects?.length ?? 0;
  const expCount = baseline.experience?.length ?? 0;

  // 2. Do not suppress recovery if projects are present but lack technologies
  if (projCount > 0 && baseline.projects.some((p) => !p.technologies || p.technologies.length === 0)) {
    return { shouldEnrich: true, reason: "project_technologies_sparse" };
  }

  // 3. Do not suppress recovery if composite blob claims remain
  if (baseline.achievements?.some((a) => a.title.length > 150 || /^(?:leadership|publications)\s*:/i.test(a.title))) {
    return { shouldEnrich: true, reason: "composite_claims_need_structuring" };
  }

  // If education is present, 5+ skills are extracted, and 2+ projects (or 1 project + 1 experience)
  // are extracted with detailed descriptions and verified technologies, deterministic coverage is sufficient.
  const hasSubstantialProjects = projCount >= 2 || (projCount >= 1 && expCount >= 1);
  const descriptionsAreDetailed = projCount > 0 && baseline.projects.every((p) => (p.description?.trim().length ?? 0) >= 25);

  if (eduCount >= 1 && skillCount >= 5 && hasSubstantialProjects && descriptionsAreDetailed) {
    return { shouldEnrich: false, reason: "deterministic_coverage_sufficient" };
  }

  return { shouldEnrich: true, reason: "sparse_or_complex_sections" };
}

/**
 * Additively merges optional LLM enrichment into a deterministic baseline.
 * Deterministic facts (name, email, phone, links, verified skills) always take precedence.
 * Inferred AI items are strictly grounded against document text and marked unverified.
 */
export function mergeExtractionOutputs(
  baseline: ResumeInterpretationOutput,
  enriched: ResumeInterpretationOutput | null | undefined,
  rawText: string
): ResumeInterpretationOutput {
  if (!enriched) return baseline;
  if (!baseline) return enriched;

  const norm = normalizeForGrounding(rawText);
  const grounded = (v: string | null | undefined) => isGrounded(norm, v);

  // 1. Education (Deterministic deduplication & precedence)
  const mergedEduRaw = [...baseline.education];
  for (const enEdu of enriched.education || []) {
    if (grounded(enEdu.institution)) mergedEduRaw.push(enEdu);
  }
  const education = ResumeDeduplicationEngine.deduplicateEducation(mergedEduRaw).education;

  // 2. Experience (Deterministic deduplication & precedence)
  const mergedExpRaw = [...baseline.experience];
  for (const enExp of enriched.experience || []) {
    if (grounded(enExp.company)) mergedExpRaw.push(enExp);
  }
  const experience = ResumeDeduplicationEngine.deduplicateExperience(mergedExpRaw).experience;

  // 3. Projects (Deterministic precedence)
  const projects = [...baseline.projects];
  for (const enProj of enriched.projects || []) {
    const normTitle = normalizeForGrounding(enProj.title).trim();
    const existing = projects.find((b) => normalizeForGrounding(b.title).trim() === normTitle);
    if (existing) {
      if ((!existing.description || existing.description.length < 25) && enProj.description) {
        existing.description = enProj.description;
      }
      const existingTech = new Set(existing.technologies.map((t) => t.toLowerCase()));
      for (const t of enProj.technologies || []) {
        if (!existingTech.has(t.toLowerCase()) && grounded(t)) {
          existing.technologies.push(t);
        }
      }
      if (!existing.repositoryUrl && enProj.repositoryUrl && grounded(enProj.repositoryUrl)) {
        existing.repositoryUrl = enProj.repositoryUrl;
      }
    } else if (grounded(enProj.title)) {
      projects.push(enProj);
    }
  }

  // 4. Skills (Start with deterministic, add non-duplicate grounded AI skills)
  const skills = [...baseline.skills];
  const seenSkills = new Set(skills.map((s) => s.name.toLowerCase()));
  for (const enSkill of enriched.skills || []) {
    const key = enSkill.name.toLowerCase();
    if (!seenSkills.has(key) && grounded(enSkill.name)) {
      seenSkills.add(key);
      skills.push({
        ...enSkill,
        proficiencyHint: "unknown",
      });
    }
  }

  // 5. Certifications
  const mergedCertsRaw = [...baseline.certifications];
  for (const enCert of enriched.certifications || []) {
    if (grounded(enCert.name)) mergedCertsRaw.push(enCert);
  }
  const certifications = ResumeDeduplicationEngine.deduplicateCertifications(mergedCertsRaw).certifications;

  // 6. Achievements
  const mergedAchRaw = [...baseline.achievements];
  for (const enAch of enriched.achievements || []) {
    if (grounded(enAch.title.slice(0, 40))) mergedAchRaw.push(enAch);
  }
  const achievements = ResumeDeduplicationEngine.deduplicateAchievements(mergedAchRaw).achievements;

  // 7. Leadership
  const mergedLeadRaw = [...(baseline.leadership || [])];
  for (const enLead of enriched.leadership || []) {
    if (grounded(enLead.organization)) mergedLeadRaw.push(enLead);
  }
  const leadership = ResumeDeduplicationEngine.deduplicateLeadership(mergedLeadRaw).leadership;

  // 8. Research
  const research = [...(baseline.research || [])];
  const seenRes = new Set(research.map((r) => r.title.toLowerCase()));
  for (const enRes of enriched.research || []) {
    const key = enRes.title.toLowerCase();
    if (!seenRes.has(key) && grounded(enRes.title.slice(0, 40))) {
      seenRes.add(key);
      research.push(enRes);
    }
  }

  // 9. Hackathons
  const hackathons = [...(baseline.hackathons || [])];
  const seenHack = new Set(hackathons.map((h) => h.event.toLowerCase()));
  for (const enHack of enriched.hackathons || []) {
    const key = enHack.event.toLowerCase();
    if (!seenHack.has(key) && grounded(enHack.event)) {
      seenHack.add(key);
      hackathons.push(enHack);
    }
  }

  // 10. Training
  const training = [...(baseline.training || [])];
  const seenTrain = new Set(training.map((t) => t.title.toLowerCase()));
  for (const enTrain of enriched.training || []) {
    const key = enTrain.title.toLowerCase();
    if (!seenTrain.has(key) && grounded(enTrain.title)) {
      seenTrain.add(key);
      training.push(enTrain);
    }
  }

  // 11. Volunteering
  const volunteering = [...(baseline.volunteering || [])];
  const seenVol = new Set(volunteering.map((v) => `${v.role.toLowerCase()}:${v.organization.toLowerCase()}`));
  for (const enVol of enriched.volunteering || []) {
    const key = `${enVol.role.toLowerCase()}:${enVol.organization.toLowerCase()}`;
    if (!seenVol.has(key) && grounded(enVol.organization)) {
      seenVol.add(key);
      volunteering.push(enVol);
    }
  }

  // 12. Languages
  const languages = [...(baseline.languages || [])];
  const seenLang = new Set(languages.map((l) => l.language.toLowerCase()));
  for (const enLang of enriched.languages || []) {
    const key = enLang.language.toLowerCase();
    if (!seenLang.has(key) && grounded(enLang.language)) {
      seenLang.add(key);
      languages.push(enLang);
    }
  }

  // 13. Digital Footprints
  const digitalFootprints = [...(baseline.digitalFootprints || [])];
  const seenFps = new Set(digitalFootprints.map((df) => df.url.toLowerCase()));
  for (const enDf of enriched.digitalFootprints || []) {
    const key = enDf.url.toLowerCase();
    if (!seenFps.has(key) && grounded(enDf.url)) {
      seenFps.add(key);
      digitalFootprints.push(enDf);
    }
  }

  // 14. Additional
  const additional = [...(baseline.additional || [])];
  for (const enAdd of enriched.additional || []) {
    if (grounded(enAdd.content.slice(0, 40))) {
      additional.push(enAdd);
    }
  }

  // 15. Summary
  const summary = baseline.summary || enriched.summary;

  // 16. Personal
  const personal = baseline.personal || enriched.personal;

  const rawParsed = ResumeInterpretationSchema.parse({
    personal,
    summary,
    education,
    experience,
    projects,
    skills,
    certifications,
    achievements,
    leadership,
    research,
    hackathons,
    training,
    volunteering,
    languages,
    digitalFootprints,
    additional,
  });

  const deduped = ResumeDeduplicationEngine.deduplicateAll(rawParsed);
  return deduped.interpretation;
}

/** Combines baseline and optional enrichment into a unified ResumeExtractionResult. */
export function mergeExtractionResults(
  baseline: ResumeExtractionResult,
  enriched: ResumeExtractionResult | null | undefined,
  rawText: string
): ResumeExtractionResult {
  if (!enriched || !enriched.success || !enriched.extracted) {
    return baseline;
  }

  const mergedInterpretation = mergeExtractionOutputs(
    baseline.extracted || { education: [], experience: [], projects: [], skills: [], certifications: [], achievements: [] },
    enriched.extracted,
    rawText
  );

  const bProf = baseline.extractedProfile || {};
  const eProf = enriched.extractedProfile || {};
  const mergedProfile: ExtractedProfile = {
    fullName: bProf.fullName || eProf.fullName,
    email: bProf.email || eProf.email,
    mobile: bProf.mobile || eProf.mobile,
    location: bProf.location || eProf.location,
    institution: bProf.institution || eProf.institution,
    degree: bProf.degree || eProf.degree,
    specialization: bProf.specialization || eProf.specialization,
    expectedGraduationYear: bProf.expectedGraduationYear || eProf.expectedGraduationYear,
    gpa: bProf.gpa || eProf.gpa,
  };

  const seenUrls = new Set<string>();
  const mergedLinks: ResumeLink[] = [];
  for (const l of [...(baseline.links || []), ...(enriched.links || [])]) {
    const u = l.url.toLowerCase().replace(/\/$/, "");
    if (/^https?:\/\/(?:www\.)?github\.com(?:\/github)?$/i.test(u) || /^https?:\/\/(?:www\.)?linkedin\.com(?:\/in|\/pub)?$/i.test(u)) {
      continue;
    }
    if (!seenUrls.has(u)) {
      seenUrls.add(u);
      mergedLinks.push(l);
    }
  }

  const mergedDiscoveredProfiles: Record<string, string | undefined> = {
    ...(enriched.discoveredProfiles || {}),
    ...(baseline.discoveredProfiles || {}),
  };
  for (const [k, v] of Object.entries(mergedDiscoveredProfiles)) {
    if (v && (/^https?:\/\/(?:www\.)?github\.com(?:\/github)?\/?$/i.test(v) || /^https?:\/\/(?:www\.)?linkedin\.com(?:\/in|\/pub)?\/?$/i.test(v))) {
      delete mergedDiscoveredProfiles[k];
    }
  }

  return {
    success: true,
    extracted: mergedInterpretation,
    resume: enriched.resume || baseline.resume,
    extractedProfile: mergedProfile,
    links: mergedLinks,
    discoveredProfiles: mergedDiscoveredProfiles,
    provider: `${baseline.provider}+${enriched.provider}`,
    modelUsed: `${baseline.modelUsed}+${enriched.modelUsed}`,
    promptVersion: enriched.promptVersion || baseline.promptVersion,
    latencyMs: baseline.latencyMs + enriched.latencyMs,
    truncated: baseline.truncated || enriched.truncated,
  };
}

