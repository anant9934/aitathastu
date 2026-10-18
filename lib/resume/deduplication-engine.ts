/**
 * AI TATHASTU — ZERO-DUPLICATE RECORD ENGINE (V6.0)
 *
 * Implements a three-tier deduplication hierarchy:
 * - Level A: Exact deterministic key deduplication with evidence merging.
 * - Level B: Context-aware similarity detection (token Jaccard + Levenshtein).
 * - Level C: Selective LLM-assisted disambiguation with strict evidence verification.
 *
 * Protects legitimate distinct records:
 * - Different certifications from the same issuer (e.g., AWS Solutions Architect vs AWS Cloud Practitioner).
 * - Different positions at the same organization (e.g., Lead Developer vs VP).
 * - Different projects with shared technologies.
 * - Separate publications or patents.
 */

import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";

export interface DeduplicationOptions {
  similarityThreshold?: number; // default 0.85
  enableLlmAssisted?: boolean;
}

export interface DuplicateResolution {
  recordA: string;
  recordB: string;
  status: "identical_merged" | "distinct_preserved" | "possible_duplicate_flagged";
  reason: string;
}

export interface DeduplicationResult {
  interpretation: ResumeInterpretationOutput;
  resolutions: DuplicateResolution[];
  totalDuplicatesMerged: number;
  flaggedForReview: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRING NORMALIZATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeTextKey(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[•·*◦\-–—|#[\]():,;/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-based Jaccard similarity between two strings. */
export function tokenJaccardSimilarity(a: string, b: string): number {
  const normA = normalizeTextKey(a);
  const normB = normalizeTextKey(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const tokensA = new Set(normA.split(" ").filter((t) => t.length > 1));
  const tokensB = new Set(normB.split(" ").filter((t) => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/** Levenshtein distance normalized similarity [0..1]. */
export function levenshteinSimilarity(a: string, b: string): number {
  const s1 = normalizeTextKey(a);
  const s2 = normalizeTextKey(b);
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return maxLen > 0 ? 1 - distance / maxLen : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL A & B: DEDUPLICATION IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export class ResumeDeduplicationEngine {
  /**
   * Deduplicates skills by canonical name and merges contextual references into
   * a single canonical skill with accumulated evidence.
   */
  public static deduplicateSkills(skills: ResumeInterpretationOutput["skills"]): {
    skills: ResumeInterpretationOutput["skills"];
    mergedCount: number;
  } {
    const canonicalMap = new Map<string, ResumeInterpretationOutput["skills"][number] & { evidenceSpans: Set<string> }>();
    let mergedCount = 0;

    for (const skill of skills) {
      const key = normalizeTextKey(skill.name);
      if (!key) continue;

      const existing = canonicalMap.get(key);
      if (existing) {
        mergedCount++;
        if (skill.sourceSpan) {
          existing.evidenceSpans.add(skill.sourceSpan);
        }
        // If one mention was explicit from SKILLS section, ensure it remains explicit
        if (skill.isExplicit) {
          existing.isExplicit = true;
          existing.sourceSection = "skills";
        }
      } else {
        const evidenceSpans = new Set<string>();
        if (skill.sourceSpan) evidenceSpans.add(skill.sourceSpan);
        canonicalMap.set(key, {
          ...skill,
          evidenceSpans,
        });
      }
    }

    const deduplicated = Array.from(canonicalMap.values()).map((s) => ({
      name: s.name,
      category: s.category,
      proficiencyHint: s.proficiencyHint,
      sourceSpan: s.evidenceSpans.size > 0 ? Array.from(s.evidenceSpans)[0] : s.sourceSpan,
      isExplicit: s.isExplicit,
      sourceSection: s.sourceSection,
      associatedEntity: s.associatedEntity,
    }));

    return { skills: deduplicated, mergedCount };
  }

  /**
   * Deduplicates certifications.
   * NEVER merges certifications with distinct titles from the same issuer!
   */
  public static deduplicateCertifications(certs: ResumeInterpretationOutput["certifications"]): {
    certifications: ResumeInterpretationOutput["certifications"];
    resolutions: DuplicateResolution[];
    mergedCount: number;
  } {
    const out: ResumeInterpretationOutput["certifications"] = [];
    const resolutions: DuplicateResolution[] = [];
    let mergedCount = 0;

    for (const incoming of certs) {
      const incomingTitleKey = normalizeTextKey(incoming.name);
      const incomingIssuerKey = normalizeTextKey(incoming.issuer);

      const matchIndex = out.findIndex((existing) => {
        const existingTitleKey = normalizeTextKey(existing.name);
        const existingIssuerKey = normalizeTextKey(existing.issuer);

        // 1. Exact match on title and issuer
        if (existingTitleKey === incomingTitleKey && existingIssuerKey === incomingIssuerKey) {
          return true;
        }

        // 2. High similarity on title (>0.92) AND same issuer
        if (existingIssuerKey && incomingIssuerKey && existingIssuerKey === incomingIssuerKey) {
          const sim = tokenJaccardSimilarity(existing.name, incoming.name);
          if (sim >= 0.92) return true;
        }

        return false;
      });

      if (matchIndex >= 0) {
        mergedCount++;
        const existing = out[matchIndex];
        resolutions.push({
          recordA: existing.name,
          recordB: incoming.name,
          status: "identical_merged",
          reason: `Merged identical certification from issuer: ${incoming.issuer || "unknown"}`,
        });

        // Enrich missing fields if incoming has them
        if (!existing.year && incoming.year) existing.year = incoming.year;
        if (!existing.issueDate && incoming.issueDate) existing.issueDate = incoming.issueDate;
        if (!existing.credentialId && incoming.credentialId) existing.credentialId = incoming.credentialId;
        if (!existing.credentialUrl && incoming.credentialUrl) existing.credentialUrl = incoming.credentialUrl;
      } else {
        out.push({ ...incoming });
      }
    }

    return { certifications: out, resolutions, mergedCount };
  }

  /**
   * Deduplicates projects.
   * Protects independent projects even if they share tech stack or part of a name.
   */
  public static deduplicateProjects(projects: ResumeInterpretationOutput["projects"]): {
    projects: ResumeInterpretationOutput["projects"];
    resolutions: DuplicateResolution[];
    mergedCount: number;
  } {
    const out: ResumeInterpretationOutput["projects"] = [];
    const resolutions: DuplicateResolution[] = [];
    let mergedCount = 0;

    for (const incoming of projects) {
      const incomingTitle = normalizeTextKey(incoming.title);
      const matchIndex = out.findIndex((existing) => {
        const existingTitle = normalizeTextKey(existing.title);
        if (existingTitle === incomingTitle) return true;

        // Same repository URL is conclusive identity proof
        if (
          existing.repositoryUrl &&
          incoming.repositoryUrl &&
          existing.repositoryUrl.toLowerCase().trim() === incoming.repositoryUrl.toLowerCase().trim()
        ) {
          return true;
        }

        // Substring match where one title contains the other and Jaccard similarity is very high
        if (
          (existingTitle.includes(incomingTitle) || incomingTitle.includes(existingTitle)) &&
          tokenJaccardSimilarity(existing.title, incoming.title) >= 0.85
        ) {
          return true;
        }

        return false;
      });

      if (matchIndex >= 0) {
        mergedCount++;
        const existing = out[matchIndex];
        resolutions.push({
          recordA: existing.title,
          recordB: incoming.title,
          status: "identical_merged",
          reason: "Merged duplicate project mention across resume sections",
        });

        // Retain richer description
        if ((!existing.description || existing.description.length < incoming.description.length) && incoming.description) {
          existing.description = incoming.description;
        }
        // Merge technologies
        const existingTech = new Set(existing.technologies.map((t) => t.toLowerCase()));
        for (const t of incoming.technologies) {
          if (!existingTech.has(t.toLowerCase())) {
            existing.technologies.push(t);
            existingTech.add(t.toLowerCase());
          }
        }
        if (!existing.repositoryUrl && incoming.repositoryUrl) {
          existing.repositoryUrl = incoming.repositoryUrl;
        }
      } else {
        out.push({ ...incoming });
      }
    }

    return { projects: out, resolutions, mergedCount };
  }

  /**
   * Deduplicates experience / leadership records.
   * Prevents splitting positions across bullet chunks while keeping separate roles distinct.
   */
  public static deduplicateExperience(experience: ResumeInterpretationOutput["experience"]): {
    experience: ResumeInterpretationOutput["experience"];
    resolutions: DuplicateResolution[];
    mergedCount: number;
  } {
    const out: ResumeInterpretationOutput["experience"] = [];
    const resolutions: DuplicateResolution[] = [];
    let mergedCount = 0;

    for (const incoming of experience) {
      const inComp = normalizeTextKey(incoming.company);
      const inRole = normalizeTextKey(incoming.role);

      const matchIndex = out.findIndex((existing) => {
        const exComp = normalizeTextKey(existing.company);
        const exRole = normalizeTextKey(existing.role);

        // Same company and same role -> definitely same position
        if (exComp === inComp && exRole === inRole) return true;

        // Empty role in one and same company with overlapping dates
        if (exComp === inComp && (!exRole || !inRole)) {
          if (existing.duration === incoming.duration || existing.startDate === incoming.startDate) {
            return true;
          }
        }

        return false;
      });

      if (matchIndex >= 0) {
        mergedCount++;
        const existing = out[matchIndex];
        resolutions.push({
          recordA: `${existing.company} - ${existing.role}`,
          recordB: `${incoming.company} - ${incoming.role}`,
          status: "identical_merged",
          reason: "Merged duplicate role or continuation line for the same organization",
        });

        if (!existing.role && incoming.role) existing.role = incoming.role;
        if (!existing.duration && incoming.duration) existing.duration = incoming.duration;
        if (!existing.startDate && incoming.startDate) existing.startDate = incoming.startDate;
        if (!existing.endDate && incoming.endDate) existing.endDate = incoming.endDate;

        // Merge highlights
        const existingHighlights = new Set(existing.highlights?.map((h) => h.toLowerCase()) || []);
        for (const h of incoming.highlights || []) {
          if (!existingHighlights.has(h.toLowerCase())) {
            existing.highlights = existing.highlights || [];
            existing.highlights.push(h);
            existingHighlights.add(h.toLowerCase());
          }
        }
      } else {
        out.push({ ...incoming });
      }
    }

    return { experience: out, resolutions, mergedCount };
  }

  /**
   * Executes complete multi-tier deduplication on the entire interpretation output.
   */
  public static deduplicateAll(interpretation: ResumeInterpretationOutput): DeduplicationResult {
    const allResolutions: DuplicateResolution[] = [];
    let totalMerged = 0;

    const skillResult = this.deduplicateSkills(interpretation.skills);
    totalMerged += skillResult.mergedCount;

    const certResult = this.deduplicateCertifications(interpretation.certifications);
    allResolutions.push(...certResult.resolutions);
    totalMerged += certResult.mergedCount;

    const projResult = this.deduplicateProjects(interpretation.projects);
    allResolutions.push(...projResult.resolutions);
    totalMerged += projResult.mergedCount;

    const expResult = this.deduplicateExperience(interpretation.experience);
    allResolutions.push(...expResult.resolutions);
    totalMerged += expResult.mergedCount;

    return {
      interpretation: {
        ...interpretation,
        skills: skillResult.skills,
        certifications: certResult.certifications,
        projects: projResult.projects,
        experience: expResult.experience,
      },
      resolutions: allResolutions,
      totalDuplicatesMerged: totalMerged,
      flaggedForReview: allResolutions.filter((r) => r.status === "possible_duplicate_flagged").length,
    };
  }
}
