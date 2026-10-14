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
import { structureResumeText, RESUME_PROMPT_VERSION } from "@/lib/resume/structure";

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
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    if (!url.hostname.includes(".")) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function linkType(url: string, claimed: ResumeLink["type"]): ResumeLink["type"] {
  const host = new URL(url).hostname.replace(/^www\./, "");
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
  for (const l of x.links) {
    const url = normalizeUrl(l.url);
    if (!url || projectLinks.has(url) || links.some((e) => e.url.toLowerCase() === url.toLowerCase())) continue;
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
    const line = lines.find((l) => (token ? token.test(l.toLowerCase()) : l.toLowerCase().includes(n)));
    if (line) {
      const t = line.trim();
      if (t.length <= 300) return t.length >= 3 ? t : null;
      const i = t.toLowerCase().indexOf(n);
      return t.slice(Math.max(0, i - 100), i + n.length + 100).trim();
    }
  }
  return null;
}

const year = (s: string | null) => s?.match(/\b(19|20)\d{2}\b/g)?.pop();

export function toInterpretation(r: ResumeExtraction, sourceText: string): ResumeInterpretationOutput {
  const lines = sourceText.split("\n");
  const out: ResumeInterpretationOutput = { education: [], experience: [], projects: [], skills: [], certifications: [], achievements: [] };

  for (const e of r.education) {
    const span = evidenceLine(lines, e.institution, e.degree);
    if (!span) continue;
    out.education.push({
      institution: e.institution,
      degree: e.degree || e.field_of_study || "",
      fieldOfStudy: e.field_of_study || undefined,
      startDate: e.start_date || undefined,
      endDate: e.end_date || undefined,
      graduationYear: year(e.end_date),
      gpa: e.grade && !/%/.test(e.grade) ? e.grade : undefined,
      percentage: e.grade && /%/.test(e.grade) ? e.grade : undefined,
      academicLevel: e.level,
      sourceSpan: span,
    });
  }
  for (const e of r.experience) {
    const span = evidenceLine(lines, e.company, e.role);
    if (!span) continue;
    out.experience.push({
      company: e.company,
      role: e.role,
      type: e.type,
      startDate: e.start_date || undefined,
      endDate: e.end_date || undefined,
      duration: [e.start_date, e.end_date].filter(Boolean).join(" – ") || undefined,
      highlights: e.description,
      technologies: [],
      sourceSpan: span,
    });
  }
  for (const p of r.projects) {
    const span = evidenceLine(lines, p.name);
    if (!span) continue;
    out.projects.push({ title: p.name, description: p.description, technologies: p.tech_stack, repositoryUrl: p.repository || p.link || undefined, sourceSpan: span });
  }
  for (const s of r.skills) {
    const span = evidenceLine(lines, s);
    if (span) out.skills.push({ name: s, category: "other", proficiencyHint: "unknown", sourceSpan: span });
  }
  for (const c of r.certifications) {
    const span = evidenceLine(lines, c.name);
    if (span) out.certifications.push({ name: c.name, issuer: c.issuer || undefined, year: year(c.date), sourceSpan: span });
  }
  for (const a of r.achievements) {
    const span = evidenceLine(lines, a, a.slice(0, 40));
    if (!span) continue;
    const category = /patent/i.test(a) ? "patent" : /publi|journal|conference|paper/i.test(a) ? "publication" : /hackathon/i.test(a) ? "hackathon" : "award";
    out.achievements.push({ title: a, category, description: "", sourceSpan: span });
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
    mobile: r.phone || undefined,
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
  const base = { provider: "groq", promptVersion: RESUME_PROMPT_VERSION, truncated: false };
  try {
    const { data, model, truncated } = await structureResumeText(resumeText, personId);
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
    };
  }
}
