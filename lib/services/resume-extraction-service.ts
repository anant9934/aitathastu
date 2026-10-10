/**
 * AI TATHASTU — RESUME EXTRACTION SERVICE V3.9
 *
 * CRITICAL ARCHITECTURAL DECISION: STRICT ZERO-LLM RESUME EXTRACTION.
 * Generative LLMs (Gemini, Groq, Cerebras, SambaNova, Mistral, OpenRouter) are strictly FORBIDDEN.
 * This service directly invokes the DeterministicResumeExtractionEngine.
 *
 * No calls to lib/intelligence/router.ts or model endpoints.
 */

import { ResumeInterpretationSchema, type ResumeInterpretationOutput } from "../intelligence/schemas";
import {
  DeterministicResumeExtractionEngine,
  type DeterministicExtractionResult,
} from "./deterministic-resume-extraction-engine";

export interface ResumeExtractionResult {
  success: boolean;
  extracted: ResumeInterpretationOutput | null;
  provider: string;
  modelUsed: string;
  fallbackUsed: boolean;
  latencyMs: number;
  error?: string;
  truncated: boolean;
  // V3.9 zero-LLM metadata & discovered profiles
  extractedProfile?: DeterministicExtractionResult["extractedProfile"];
  discoveredProfiles?: DeterministicExtractionResult["discoveredProfiles"];
  discoveredRepositories?: DeterministicExtractionResult["discoveredRepositories"];
  candidates?: DeterministicExtractionResult["candidates"];
}

/**
 * Backward-compatible helper that delegates to DeterministicResumeExtractionEngine.
 */
export function buildDeterministicExtraction(
  resumeText: string,
  extraHyperlinks?: string[]
): ResumeInterpretationOutput {
  const result = DeterministicResumeExtractionEngine.extract(resumeText, { extraHyperlinks });
  return result.structured;
}

/**
 * Backward-compatible grounding helper that verifies items exist verbatim in source.
 */
export function groundResumeInterpretation(
  data: ResumeInterpretationOutput,
  resumeText: string
): ResumeInterpretationOutput {
  const lowerSource = resumeText.toLowerCase();
  return {
    education: data.education.filter((e) => lowerSource.includes(e.institution.toLowerCase()) || lowerSource.includes(e.degree.toLowerCase())),
    skills: data.skills.filter((s) => lowerSource.includes(s.name.toLowerCase())),
    projects: data.projects.filter((p) => lowerSource.includes(p.title.toLowerCase())),
    experience: data.experience.filter((ex) => lowerSource.includes(ex.company.toLowerCase()) || lowerSource.includes(ex.role.toLowerCase())),
    certifications: data.certifications.filter((c) => lowerSource.includes(c.name.toLowerCase())),
  };
}

/**
 * Primary Resume Extraction entrypoint.
 * ZERO-LLM: Fully deterministic execution.
 */
export async function extractResumeStructured(
  resumeText: string,
  _personId?: string,
  extraHyperlinks?: string[]
): Promise<ResumeExtractionResult> {
  const startTime = Date.now();

  try {
    const result = DeterministicResumeExtractionEngine.extract(resumeText, {
      extraHyperlinks,
    });

    const validated = ResumeInterpretationSchema.safeParse(result.structured);
    if (!validated.success) {
      return {
        success: false,
        extracted: null,
        provider: "deterministic-engine",
        modelUsed: "v3.9-zero-llm",
        fallbackUsed: false,
        latencyMs: Date.now() - startTime,
        truncated: false,
        error: "Structured extraction did not pass validation.",
      };
    }

    return {
      success: true,
      extracted: validated.data,
      provider: "deterministic-engine",
      modelUsed: "v3.9-zero-llm",
      fallbackUsed: false,
      latencyMs: Date.now() - startTime,
      truncated: false,
      extractedProfile: result.extractedProfile,
      discoveredProfiles: result.discoveredProfiles,
      discoveredRepositories: result.discoveredRepositories,
      candidates: result.candidates,
    };
  } catch {
    return {
      success: false,
      extracted: null,
      provider: "deterministic-engine",
      modelUsed: "v3.9-zero-llm",
      fallbackUsed: false,
      latencyMs: Date.now() - startTime,
      truncated: false,
      error: "Structured extraction could not be completed.",
    };
  }
}
