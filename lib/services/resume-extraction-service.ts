/**
 * AI TATHASTU — RESUME EXTRACTION SERVICE
 *
 * Wires the IntelligenceRouter to the PROFILE_EXTRACT task.
 * Produces structured, Zod-validated extraction candidates from resume text.
 * Every extracted item carries source provenance for the student to confirm/reject.
 *
 * Pipeline:
 *   Raw Text → Prompt Defense → LLM (PROFILE_EXTRACT) → Zod Validation
 *   → Evidence Candidates → Optional DB Persist
 */

import { defaultIntelligenceRouter } from "../intelligence/router";
import { ResumeInterpretationSchema, type ResumeInterpretationOutput } from "../intelligence/schemas";
import { sanitizeTextForPrompt, wrapUntrustedContent } from "../intelligence/prompt-defense";

// Limit text sent to LLM — protect cost and prevent prompt injection via large resumes
const MAX_RESUME_TEXT_CHARS = 6000;

const SYSTEM_PROMPT = `You are a resume parser for an AI/ML student intelligence platform.
Extract ONLY information explicitly stated in the provided resume text.
Return a strict JSON object matching the required schema.

Rules:
- Do NOT invent, infer, or add information not in the text.
- Do NOT add skills or certifications you think the person "should" have.
- If a field is absent from the text, return an empty array or omit optional fields.
- Technologies: normalize names (e.g. "tensorflow" → "TensorFlow", "pytorch" → "PyTorch").
- Every item needs sourceSpan: a short verbatim excerpt from the resume proving the claim.
- Skills category: "language" for programming languages, "framework" for ML/web frameworks, "library" for libraries, "tool" for dev tools, "concept" for ML concepts.
- Proficiency hints: only if the resume explicitly states "expert", "proficient", "familiar with", etc.
- URLs: only include if explicitly present in the resume text.`;

function buildPrompt(resumeText: string): string {
  const safe = sanitizeTextForPrompt(resumeText).slice(0, MAX_RESUME_TEXT_CHARS);
  return `Extract structured information from this resume text. Return ONLY valid JSON matching the schema.

RESUME TEXT:
${wrapUntrustedContent("resume", safe)}

Required JSON schema:
{
  "education": [{ "institution": string, "degree": string, "fieldOfStudy"?: string, "graduationYear"?: string, "sourceSpan": string }],
  "experience": [{ "company": string, "role": string, "duration"?: string, "highlights": string[], "sourceSpan": string }],
  "projects": [{ "title": string, "description": string, "technologies": string[], "repositoryUrl"?: string, "sourceSpan": string }],
  "skills": [{ "name": string, "category": "language"|"framework"|"library"|"tool"|"concept"|"other", "proficiencyHint": "beginner"|"intermediate"|"advanced"|"unknown", "sourceSpan": string }],
  "certifications": [{ "name": string, "issuer"?: string, "year"?: string, "sourceSpan": string }]
}

Return ONLY the JSON object, no markdown, no explanation.`;
}

export interface ResumeExtractionResult {
  success: boolean;
  extracted: ResumeInterpretationOutput | null;
  provider: string;
  modelUsed: string;
  fallbackUsed: boolean;
  latencyMs: number;
  error?: string;
  truncated: boolean;
}

const normalizeMention = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
const aliases: Record<string, string[]> = {
  scikitlearn: ["sklearn"],
  pytorch: ["torch"],
};

function hasMention(text: string, value: string): boolean {
  const normalized = normalizeMention(text);
  const target = normalizeMention(value);
  if (!target) return false;
  if (target.length < 4) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\W)${escaped}(?=$|\\W)`, "i").test(text);
  }
  return [target, ...(aliases[target] || [])].some((name) => normalized.includes(name));
}

export function groundResumeInterpretation(data: ResumeInterpretationOutput, resumeText: string): ResumeInterpretationOutput {
  const source = sanitizeTextForPrompt(resumeText).slice(0, MAX_RESUME_TEXT_CHARS).replace(/\s+/g, " ").toLowerCase();
  const grounded = <T extends { sourceSpan: string }>(items: T[]): T[] => items.filter((item) =>
    source.includes(sanitizeTextForPrompt(item.sourceSpan).replace(/\s+/g, " ").toLowerCase())
  );
  return {
    education: grounded(data.education).filter((item) =>
      hasMention(source, item.degree) && hasMention(source, item.institution) &&
      (hasMention(item.sourceSpan, item.degree) || hasMention(item.sourceSpan, item.institution))
    ).map((item) => ({
      ...item,
      fieldOfStudy: item.fieldOfStudy && hasMention(source, item.fieldOfStudy) ? item.fieldOfStudy : undefined,
      graduationYear: item.graduationYear && hasMention(source, item.graduationYear) ? item.graduationYear : undefined,
    })),
    experience: grounded(data.experience).filter((item) =>
      hasMention(source, item.company) && hasMention(source, item.role) &&
      (hasMention(item.sourceSpan, item.company) || hasMention(item.sourceSpan, item.role))
    ).map((item) => ({
      ...item,
      duration: item.duration && hasMention(source, item.duration) ? item.duration : undefined,
      highlights: item.highlights.filter((highlight) => hasMention(source, highlight)),
    })),
    projects: grounded(data.projects).filter((item) =>
      hasMention(item.sourceSpan, item.title) && (!item.repositoryUrl || source.includes(item.repositoryUrl.toLowerCase()))
    ).map((item) => ({
      ...item,
      technologies: item.technologies.filter((technology) => hasMention(source, technology)),
    })),
    skills: grounded(data.skills).filter((item) => hasMention(item.sourceSpan, item.name)),
    certifications: grounded(data.certifications).filter((item) => hasMention(item.sourceSpan, item.name)).map((item) => ({
      ...item,
      issuer: item.issuer && hasMention(source, item.issuer) ? item.issuer : undefined,
      year: item.year && hasMention(source, item.year) ? item.year : undefined,
    })),
  };
}

export async function extractResumeStructured(
  resumeText: string,
  personId?: string
): Promise<ResumeExtractionResult> {
  const truncated = resumeText.length > MAX_RESUME_TEXT_CHARS;

  try {
    const response = await defaultIntelligenceRouter.complete({
      task: "PROFILE_EXTRACT",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildPrompt(resumeText),
      personId,
      temperature: 0.1, // Low temperature for factual extraction
      maxTokens: 2000,
      promptVersion: "v1",
    });

    if (response.fallbackUsed) {
      return { success: false, extracted: null, provider: response.provider, modelUsed: response.modelUsed, fallbackUsed: true, latencyMs: response.latencyMs ?? 0, error: "AI interpretation is temporarily unavailable. Enter details manually.", truncated };
    }

    // Parse JSON from LLM response — strip any markdown fences
    let rawJson = response.content.trim();
    if (rawJson.startsWith("```")) {
      rawJson = rawJson.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return {
        success: false,
        extracted: null,
        provider: response.provider,
        modelUsed: response.modelUsed,
        fallbackUsed: response.fallbackUsed,
        latencyMs: response.latencyMs ?? 0,
        error: "LLM returned malformed JSON. Using manual entry.",
        truncated,
      };
    }

    const validated = ResumeInterpretationSchema.safeParse(parsed);
    if (!validated.success) {
      return { success: false, extracted: null, provider: response.provider, modelUsed: response.modelUsed, fallbackUsed: false, latencyMs: response.latencyMs ?? 0, error: "AI extraction did not pass validation. Enter details manually.", truncated };
    }

    const extracted = groundResumeInterpretation(validated.data, resumeText);

    return {
      success: true,
      extracted,
      provider: response.provider,
      modelUsed: response.modelUsed,
      fallbackUsed: response.fallbackUsed,
      latencyMs: response.latencyMs ?? 0,
      truncated,
    };
  } catch (err) {
    return {
      success: false,
      extracted: null,
      provider: "error",
      modelUsed: "none",
      fallbackUsed: false,
      latencyMs: 0,
      error: err instanceof Error ? err.message : "Extraction failed",
      truncated,
    };
  }
}
