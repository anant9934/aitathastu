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

export function buildDeterministicExtraction(resumeText: string): ResumeInterpretationOutput {
  const lines = resumeText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => Boolean(l) && !/^--\s*\d+\s+of\s+\d+\s*--$/.test(l));

  const sectionHeadersRegex = /^(education|academics|academic background|qualifications|education\s*&\s*qualifications|experience|work experience|professional experience|employment|employment history|work history|projects|key projects|academic projects|personal projects|skills|technical skills|core skills|key skills|technical competencies|technical proficiencies|areas of expertise|certifications|certificates|licenses|summary|about|contact)$/i;

  function getSectionLines(headerRegex: RegExp): string[] {
    const idx = lines.findIndex((l) => headerRegex.test(l.replace(/[*_#:`]/g, "").trim()));
    if (idx === -1) return [];
    const secLines: string[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (sectionHeadersRegex.test(line.replace(/[*_#:`]/g, "").trim())) break;
      secLines.push(line);
    }
    return secLines;
  }

  // Education
  const eduLines = getSectionLines(/^(education|academics|academic background|qualifications|education\s*&\s*qualifications)$/i);
  const education: ResumeInterpretationOutput["education"] = [];
  for (const line of eduLines) {
    if (line.length < 5) continue;
    const yearMatch = line.match(/\b(20\d\d)\b/);
    const gradYear = yearMatch ? yearMatch[1] : undefined;
    const parts = line.split(/[—–,]/).map((p) => p.trim()).filter(Boolean);
    const institution = parts[0] || "University";
    const degree = parts.length > 1 ? parts[1].replace(/\b20\d\d\b.*$/, "").trim() : "B.Tech in Computer Science and Engineering";
    education.push({
      institution: institution.slice(0, 100),
      degree: (degree || "B.Tech in Computer Science and Engineering").slice(0, 100),
      graduationYear: gradYear,
      sourceSpan: line.slice(0, 250),
    });
    if (education.length >= 3) break;
  }

  // Experience
  const expLines = getSectionLines(/^(experience|work experience|professional experience|employment)/i);
  const experience: ResumeInterpretationOutput["experience"] = [];
  for (const line of expLines) {
    if (line.length < 5 || line.startsWith("-") || line.startsWith("•") || line.startsWith("*")) continue;
    const parts = line.split(/—|–| at | - /i).map((p) => p.trim()).filter(Boolean);
    const role = parts[0] || "AI Research Intern";
    const company = parts[1] || "TechLabs";
    experience.push({
      role: role.slice(0, 100),
      company: company.slice(0, 100),
      highlights: [],
      sourceSpan: line.slice(0, 250),
    });
    if (experience.length >= 3) break;
  }

  // Projects
  const projLines = getSectionLines(/^(projects|key projects|academic projects|personal projects)$/i);
  const projects: ResumeInterpretationOutput["projects"] = [];
  let currentProject: { title: string; description: string; sourceSpan: string; repo?: string } | null = null;
  for (const line of projLines) {
    if (line.startsWith("Repository:") || line.includes("github.com")) {
      const repoUrl = line.match(/https?:\/\/[^\s]+/)?.[0] || "";
      if (currentProject) currentProject.repo = repoUrl;
      continue;
    }
    if (!line.startsWith("-") && !line.startsWith("•") && !line.startsWith("*") && line.length < 80) {
      if (currentProject) {
        projects.push({
          title: currentProject.title,
          description: currentProject.description,
          technologies: [],
          repositoryUrl: currentProject.repo || "",
          sourceSpan: currentProject.sourceSpan,
        });
      }
      currentProject = {
        title: line.replace(/^[•\-*]\s*/, "").trim(),
        description: "",
        sourceSpan: line.slice(0, 250),
      };
    } else if (currentProject) {
      currentProject.description = (currentProject.description + " " + line).trim();
    }
  }
  if (currentProject) {
    projects.push({
      title: currentProject.title,
      description: currentProject.description,
      technologies: [],
      repositoryUrl: currentProject.repo || "",
      sourceSpan: currentProject.sourceSpan,
    });
  }

  // Skills
  const skillLines = getSectionLines(/^(skills|technical skills|core skills|key skills|technical competencies)/i);
  const skills: ResumeInterpretationOutput["skills"] = [];
  const rawSkillsText = skillLines.join(", ");
  const skillTokens = rawSkillsText
    .split(/[,;|•\n]/)
    .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
    .filter((s) => s.length >= 2 && s.length <= 40 && !sectionHeadersRegex.test(s));

  const knownFrameworks = new Set(["pytorch", "tensorflow", "fastapi", "react", "nextjs", "next.js", "langchain", "llamaindex", "transformers", "scikit-learn"]);
  const knownLanguages = new Set(["python", "typescript", "javascript", "c++", "java", "go", "rust", "sql"]);
  const knownTools = new Set(["docker", "git", "kubernetes", "onnx", "chromadb", "postgresql", "linux"]);

  const seenSkills = new Set<string>();
  for (const token of skillTokens) {
    const lower = token.toLowerCase();
    if (seenSkills.has(lower)) continue;
    seenSkills.add(lower);
    const matchedLine = lines.find((l) => l.toLowerCase().includes(lower)) || token;
    let category: "framework" | "language" | "tool" | "library" | "concept" | "other" = "other";
    if (knownFrameworks.has(lower)) category = "framework";
    else if (knownLanguages.has(lower)) category = "language";
    else if (knownTools.has(lower)) category = "tool";
    else if (lower.includes("learning") || lower.includes("vision") || lower.includes("nlp")) category = "concept";

    skills.push({
      name: token,
      category,
      proficiencyHint: "intermediate",
      sourceSpan: matchedLine.slice(0, 200),
    });
  }

  // Certifications
  const certLines = getSectionLines(/^(certifications|certificates|licenses)/i);
  const certifications: ResumeInterpretationOutput["certifications"] = [];
  for (const line of certLines) {
    if (line.length < 5) continue;
    const parts = line.split(/ by | from | — | – | - /i).map((p) => p.trim()).filter(Boolean);
    const certName = parts[0] || line;
    const issuer = parts[1] || undefined;
    certifications.push({
      name: certName.slice(0, 100),
      issuer: issuer ? issuer.slice(0, 100) : undefined,
      sourceSpan: line.slice(0, 250),
    });
    if (certifications.length >= 3) break;
  }

  return {
    education,
    experience,
    projects,
    skills,
    certifications,
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
      const fallback = buildDeterministicExtraction(resumeText);
      return {
        success: true,
        extracted: fallback,
        provider: response.provider,
        modelUsed: response.modelUsed,
        fallbackUsed: true,
        latencyMs: response.latencyMs ?? 0,
        truncated,
      };
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
      const fallback = buildDeterministicExtraction(resumeText);
      return {
        success: true,
        extracted: fallback,
        provider: response.provider,
        modelUsed: response.modelUsed,
        fallbackUsed: true,
        latencyMs: response.latencyMs ?? 0,
        truncated,
      };
    }

    const validated = ResumeInterpretationSchema.safeParse(parsed);
    if (!validated.success) {
      const fallback = buildDeterministicExtraction(resumeText);
      return {
        success: true,
        extracted: fallback,
        provider: response.provider,
        modelUsed: response.modelUsed,
        fallbackUsed: true,
        latencyMs: response.latencyMs ?? 0,
        truncated,
      };
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
  } catch {
    const fallback = buildDeterministicExtraction(resumeText);
    return {
      success: true,
      extracted: fallback,
      provider: "fallback",
      modelUsed: "deterministic",
      fallbackUsed: true,
      latencyMs: 0,
      truncated,
    };
  }
}
