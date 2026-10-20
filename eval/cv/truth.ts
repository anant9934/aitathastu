/**
 * Ground truth for the CV evaluation set.
 *
 * Synthetic documents: the hand-written spec in eval/cv/specs IS the ground
 * truth (the renderer only lays it out), so truth is derived from it here.
 * Real documents: hand-annotated files in private-fixtures/ground-truth use
 * the Truth shape directly and never leave that git-ignored folder.
 */

import fs from "node:fs";
import path from "node:path";

export type TruthDate = string | null; // "YYYY" or "YYYY-MM"

export interface Truth {
  id: string;
  personal: { fullName: string; emails: string[]; phones: string[]; location?: string; links: string[] };
  education: Array<{ institution: string; degree?: string; fieldOfStudy?: string; start?: TruthDate; end?: TruthDate; current?: boolean; grade?: string; level?: string }>;
  experience: Array<{ organization: string; title: string; type?: string; start?: TruthDate; end?: TruthDate; current?: boolean; invalidDates?: boolean }>;
  projects: Array<{ name: string; technologies: string[]; url?: string }>;
  skills: string[];
  certifications: Array<{ name: string; issuer?: string; date?: TruthDate; dateAmbiguous?: boolean; credentialId?: string }>;
  awards: Array<{ title: string; category: "award" | "hackathon" }>;
  publications: Array<{ title: string }>;
  volunteering: Array<{ organization: string; role: string; start?: TruthDate; end?: TruthDate; current?: boolean }>;
  languages: string[];
  memberships: string[];
  /** Contact details that appear in the document but belong to someone else (references). */
  forbidden: { emails: string[]; phones: string[] };
}

export interface Spec {
  id: string;
  description: string;
  tags: string[];
  variants: string[];
  person: { name: string; email?: string; phone?: string; location?: string; links?: Array<{ url: string }> };
  sections: Array<Record<string, any>>;
}

/** CV_EVAL_SET=holdout selects the held-out set, which is never used while tuning the extractor. */
export const EVAL_SET = process.env.CV_EVAL_SET === "holdout" ? "holdout" : "dev";
const SET_DIR = path.join(process.cwd(), EVAL_SET === "holdout" ? "eval/cv/holdout" : "eval/cv");
export const SPEC_DIR = path.join(SET_DIR, "specs");
export const FIXTURE_DIR = path.join(SET_DIR, "fixtures");
export const PRIVATE_TRUTH_DIR = path.join(process.cwd(), "private-fixtures/ground-truth");

export function loadSpecs(): Spec[] {
  return fs.readdirSync(SPEC_DIR).filter((f) => f.endsWith(".json")).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(SPEC_DIR, f), "utf8")) as Spec);
}

export function truthFromSpec(spec: Spec): Truth {
  const t: Truth = {
    id: spec.id,
    personal: {
      fullName: spec.person.name,
      emails: spec.person.email ? [spec.person.email] : [],
      phones: spec.person.phone ? [spec.person.phone] : [],
      location: spec.person.location,
      links: (spec.person.links || []).map((l) => l.url),
    },
    education: [], experience: [], projects: [], skills: [], certifications: [], awards: [],
    publications: [], volunteering: [], languages: [], memberships: [],
    forbidden: { emails: [], phones: [] },
  };
  for (const sec of spec.sections) {
    const items: any[] = sec.items || [];
    switch (sec.kind) {
      case "education":
        for (const e of items) t.education.push({
          institution: e.institution, degree: e.degree, fieldOfStudy: e.field, start: e.start ?? null,
          end: e.end ?? null, current: Boolean(e.current), grade: e.grade?.value, level: e.level,
        });
        break;
      case "experience":
        for (const x of items) t.experience.push({
          organization: x.organization, title: x.title, type: x.type, start: x.start ?? null,
          end: x.current && !x.end ? null : x.end ?? null, current: Boolean(x.current), invalidDates: Boolean(x.expectInvalidDates),
        });
        break;
      case "projects":
        for (const p of items) t.projects.push({ name: p.name, technologies: p.technologies || [], url: p.url });
        break;
      case "skills":
        for (const g of sec.groups || []) for (const s of g.items) if (!t.skills.some((x) => x.toLowerCase() === s.toLowerCase())) t.skills.push(s);
        break;
      case "certifications":
        for (const c of items) if (c.duplicateOf === undefined) t.certifications.push({
          name: c.name, issuer: c.issuer, date: c.date ?? null, dateAmbiguous: Boolean(c.dateAmbiguous), credentialId: c.credentialId,
        });
        break;
      case "awards":
        for (const a of items) t.awards.push({ title: a.title, category: a.category === "hackathon" ? "hackathon" : "award" });
        break;
      case "publications":
        for (const p of items) t.publications.push({ title: p.title });
        break;
      case "volunteering":
        for (const v of items) t.volunteering.push({ organization: v.organization, role: v.role, start: v.start ?? null, end: v.current ? null : v.end ?? null, current: Boolean(v.current) });
        break;
      case "languages":
        for (const l of items) t.languages.push(l.language);
        break;
      case "memberships":
        for (const m of items) t.memberships.push(m.title);
        break;
      case "references":
        for (const r of items) {
          if (r.email) t.forbidden.emails.push(r.email);
          if (r.phone) t.forbidden.phones.push(r.phone);
        }
        break;
    }
  }
  return t;
}

/** Hand-annotated truth for private real documents, keyed by file name. */
export function loadPrivateTruth(): Map<string, Truth> {
  const out = new Map<string, Truth>();
  if (!fs.existsSync(PRIVATE_TRUTH_DIR)) return out;
  for (const f of fs.readdirSync(PRIVATE_TRUTH_DIR).filter((f) => f.endsWith(".json"))) {
    const t = JSON.parse(fs.readFileSync(path.join(PRIVATE_TRUTH_DIR, f), "utf8")) as Truth & { file: string };
    out.set(t.file, t);
  }
  return out;
}
