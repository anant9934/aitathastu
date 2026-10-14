/**
 * The one resume structuring schema. Used as the strict JSON schema of the LLM
 * call and, as zod, to validate what comes back. Every field holds only its own
 * value; nullable instead of optional because strict structured output
 * requires every key to be present.
 */

import { z } from "zod";

export const LINK_TYPES = [
  "github", "linkedin", "portfolio", "leetcode", "kaggle", "huggingface", "google_scholar",
  "orcid", "stackoverflow", "codechef", "hackerrank", "devto", "other",
] as const;

const nstr = z.string().nullable();

export const ResumeExtractionSchema = z.object({
  name: nstr,
  email: nstr,
  phone: nstr,
  location: nstr,
  links: z.array(z.object({ type: z.enum(LINK_TYPES), url: z.string() })),
  education: z.array(z.object({
    institution: z.string(),
    degree: nstr,
    field_of_study: nstr,
    level: z.enum(["high_school", "diploma", "undergraduate", "postgraduate", "doctorate", "other"]),
    start_date: nstr,
    end_date: nstr,
    grade: nstr,
  })),
  experience: z.array(z.object({
    company: z.string(),
    role: z.string(),
    type: z.enum(["employment", "internship", "freelance", "leadership", "volunteering", "other"]),
    location: nstr,
    start_date: nstr,
    end_date: nstr,
    description: z.array(z.string()),
  })),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    /** Live/demo URL. */
    link: nstr,
    /** Source repository URL. */
    repository: nstr,
    tech_stack: z.array(z.string()),
  })),
  skills: z.array(z.string()),
  certifications: z.array(z.object({ name: z.string(), issuer: nstr, date: nstr })),
  achievements: z.array(z.string()),
});

export type ResumeExtraction = z.infer<typeof ResumeExtractionSchema>;

// JSON Schema for strict structured output (all keys required, no extras).
const s = { type: "string" } as const;
const ns = { type: ["string", "null"] } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const arr = (items: unknown) => ({ type: "array", items });

export const RESUME_EXTRACTION_JSON_SCHEMA = obj({
  name: ns,
  email: ns,
  phone: ns,
  location: ns,
  links: arr(obj({ type: { type: "string", enum: [...LINK_TYPES] }, url: s })),
  education: arr(obj({
    institution: s,
    degree: ns,
    field_of_study: ns,
    level: { type: "string", enum: ["high_school", "diploma", "undergraduate", "postgraduate", "doctorate", "other"] },
    start_date: ns,
    end_date: ns,
    grade: ns,
  })),
  experience: arr(obj({
    company: s,
    role: s,
    type: { type: "string", enum: ["employment", "internship", "freelance", "leadership", "volunteering", "other"] },
    location: ns,
    start_date: ns,
    end_date: ns,
    description: arr(s),
  })),
  projects: arr(obj({ name: s, description: s, link: ns, repository: ns, tech_stack: arr(s) })),
  skills: arr(s),
  certifications: arr(obj({ name: s, issuer: ns, date: ns })),
  achievements: arr(s),
});
