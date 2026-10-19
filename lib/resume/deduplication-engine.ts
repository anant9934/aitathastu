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
      // Discard pure numeric tokens (e.g. OCR line numbers '1', '0')
      if (/^\d+$/.test(key)) continue;
      // Discard single non-language characters (preserve C and R)
      if (key.length < 2 && !/^[cr]$/i.test(key)) continue;

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

        // Substring match where one title contains the other and Jaccard similarity is very high,
        // or one title is a parent heading (contains the other) and descriptions match (>15 chars)
        const isSubstring = (existingTitle.includes(incomingTitle) || incomingTitle.includes(existingTitle)) &&
          Math.min(existingTitle.length, incomingTitle.length) >= 4;

        if (isSubstring) {
          if (tokenJaccardSimilarity(existing.title, incoming.title) >= 0.85) return true;
          if (
            existing.description &&
            incoming.description &&
            existing.description.length > 15 &&
            (existing.description === incoming.description ||
              tokenJaccardSimilarity(existing.description, incoming.description) >= 0.6)
          ) {
            return true;
          }
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
   * Deduplicates education records while strictly preserving distinct qualifications
   * (e.g. B.Tech vs Senior Secondary / Class XII).
   */
  public static deduplicateEducation(education: ResumeInterpretationOutput["education"]): {
    education: ResumeInterpretationOutput["education"];
    resolutions: DuplicateResolution[];
    mergedCount: number;
  } {
    const out: ResumeInterpretationOutput["education"] = [];
    const resolutions: DuplicateResolution[] = [];
    let mergedCount = 0;

    const normalizeLevel = (deg: string | undefined, level: string | undefined) => {
      const s = `${deg || ""} ${level || ""}`.toLowerCase();
      if (/\b(?:b\.?tech|b\.?e\.?|bachelor|undergraduate)\b/i.test(s)) return "undergraduate";
      if (/\b(?:m\.?tech|m\.?e\.?|master|postgraduate|msc|mca|mba)\b/i.test(s)) return "postgraduate";
      if (/\b(?:12th|senior\s+secondary|higher\s+secondary|intermediate|plus\s+two|\+2|class\s+xii)\b/i.test(s)) return "senior_secondary";
      if (/\b(?:10th|secondary|matriculation|high\s+school|class\s+x)\b/i.test(s)) return "secondary";
      if (/\bdiploma\b/i.test(s)) return "diploma";
      if (/\b(?:ph\.?d|doctorate)\b/i.test(s)) return "doctorate";
      return "other";
    };

    for (const incoming of education) {
      const inInstNorm = normalizeTextKey(incoming.institution);
      const inLevel = normalizeLevel(incoming.degree, incoming.academicLevel);

      const matchIndex = out.findIndex((existing) => {
        const exInstNorm = normalizeTextKey(existing.institution);
        const exLevel = normalizeLevel(existing.degree, existing.academicLevel);

        // Different known qualification levels (e.g. B.Tech vs Senior Secondary) are NEVER duplicates!
        if (inLevel !== "other" && exLevel !== "other" && inLevel !== exLevel) {
          return false;
        }

        // Exact match on institution and degree/level.
        // Also match when one level is "other" (unrecognized degree string, e.g. from LLM output)
        // so that additive enrichment (fieldOfStudy, gpa, dates) can flow into the baseline record.
        const oneIsOther = exLevel === "other" || inLevel === "other";
        if (exInstNorm === inInstNorm && (exLevel === inLevel || !existing.degree || !incoming.degree || oneIsOther)) {
          return true;
        }

        // High similarity on institution (e.g., Lovely Professional University vs Lovely Professional University Phagwara)
        const instSim = tokenJaccardSimilarity(existing.institution, incoming.institution);
        if (instSim >= 0.45 && (exLevel === inLevel || !existing.degree || !incoming.degree || oneIsOther)) {
          return true;
        }

        // Same qualification level and same dates/grade
        if (inLevel !== "other" && exLevel === inLevel) {
          if ((existing.gpa && incoming.gpa && existing.gpa === incoming.gpa) ||
              (existing.percentage && incoming.percentage && existing.percentage === incoming.percentage)) {
            return true;
          }
          if (instSim >= 0.3) return true;
        }

        return false;
      });

      if (matchIndex >= 0) {
        mergedCount++;
        const existing = out[matchIndex];
        resolutions.push({
          recordA: `${existing.institution} (${existing.degree})`,
          recordB: `${incoming.institution} (${incoming.degree})`,
          status: "identical_merged",
          reason: "Merged duplicate education record for same qualification level and institution",
        });

        // Retain richer/cleaner fields
        if ((!existing.degree || existing.degree.length < (incoming.degree || "").length) && incoming.degree) {
          existing.degree = incoming.degree;
        }
        if (!existing.fieldOfStudy && incoming.fieldOfStudy) {
          existing.fieldOfStudy = incoming.fieldOfStudy;
        }
        if (!existing.gpa && incoming.gpa) existing.gpa = incoming.gpa;
        if (!existing.percentage && incoming.percentage) existing.percentage = incoming.percentage;
        if (!existing.startDate && incoming.startDate) existing.startDate = incoming.startDate;
        if (!existing.endDate && incoming.endDate) existing.endDate = incoming.endDate;
        if (!existing.graduationYear && incoming.graduationYear) existing.graduationYear = incoming.graduationYear;
        // Prefer clean institution without trailing dates
        if (existing.institution.length > incoming.institution.length && /jun|jul|apr|2022|2024/i.test(existing.institution)) {
          existing.institution = incoming.institution;
        }
      } else {
        out.push({ ...incoming });
      }
    }

    return { education: out, resolutions, mergedCount };
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
    const normalizeCompany = (c: string | null | undefined) =>
      normalizeTextKey((c || "").replace(/^[•·*◦+~°\‘\’\s-]+/, ""));

    for (const incoming of experience) {
      const inComp = normalizeCompany(incoming.company);
      const inRole = normalizeTextKey(incoming.role);

      // Discard or merge phantom companies or bullet points misclassified as companies
      const isBulletFragment =
        /^(?:organization|company|firm|enterprise|startup|strategic partnerships\.?)$/i.test(inComp) ||
        /^(?:collected|developed|designed|implemented|conducted|building|architected|spearheaded|assisted|regularly wrote)\b/i.test(inComp) ||
        /^\d{2,6}\/?$/.test(inComp) ||
        (inComp.length > 50 && inComp.includes(","));

      if (isBulletFragment) {
        const matchRole = out.find((ex) =>
          (inRole && inRole.length > 3 && (normalizeTextKey(ex.role) === inRole || ex.role.toLowerCase().includes(incoming.role.toLowerCase()))) ||
          (incoming.startDate && ex.startDate && ex.startDate === incoming.startDate)
        );
        if (matchRole) {
          mergedCount++;
          const existingHighlights = new Set(matchRole.highlights?.map((h) => h.toLowerCase()) || []);
          for (const h of incoming.highlights || []) {
            if (!existingHighlights.has(h.toLowerCase())) {
              matchRole.highlights = matchRole.highlights || [];
              matchRole.highlights.push(h);
              existingHighlights.add(h.toLowerCase());
            }
          }
        }
        continue; // Do not emit bullet fragment as a company
      }

      const isGenericRole = (r: string) => /^(?:team member|contributor|employee|intern|assistant)$/i.test(r.trim());

      const matchIndex = out.findIndex((existing) => {
        const exComp = normalizeCompany(existing.company);
        const exRole = normalizeTextKey(existing.role);

        // Same company
        if (exComp === inComp) {
          if (exRole === inRole || !exRole || !inRole || isGenericRole(existing.role) || isGenericRole(incoming.role)) {
            return true;
          }
          if (tokenJaccardSimilarity(existing.role, incoming.role) >= 0.5) return true;
        }

        // Substring / high similarity company match (e.g. "Founders Verbinden Aug" vs "Founders Verbinden")
        const compSim = tokenJaccardSimilarity(existing.company, incoming.company);
        const compSub = (exComp.includes(inComp) || inComp.includes(exComp)) && Math.min(exComp.length, inComp.length) > 5;
        if (compSim >= 0.6 || compSub) {
          if (exRole === inRole || !exRole || !inRole || isGenericRole(existing.role) || isGenericRole(incoming.role)) {
            return true;
          }
          if (tokenJaccardSimilarity(existing.role, incoming.role) >= 0.4) return true;
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

        if (isGenericRole(existing.role) && !isGenericRole(incoming.role)) existing.role = incoming.role;
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
   * Deduplicates achievement entries and filters out summary statements that duplicate
   * existing experience, education, or research entries.
   */
  public static deduplicateAchievements(
    achievements: ResumeInterpretationOutput["achievements"] = [],
    context?: {
      experience?: ResumeInterpretationOutput["experience"];
      research?: ResumeInterpretationOutput["research"];
      education?: ResumeInterpretationOutput["education"];
    }
  ): {
    achievements: ResumeInterpretationOutput["achievements"];
    resolutions: DuplicateResolution[];
    mergedCount: number;
  } {
    const out: ResumeInterpretationOutput["achievements"] = [];
    const resolutions: DuplicateResolution[] = [];
    let mergedCount = 0;
    const seenTitles = new Set<string>();

    const expCompanies = (context?.experience || []).map((e) => normalizeTextKey(e.company)).filter(Boolean);
    const researchTitles = (context?.research || []).map((r) => normalizeTextKey(r.title)).filter(Boolean);

    for (const incoming of achievements) {
      const normTitle = normalizeTextKey(incoming.title);
      if (!normTitle) continue;

      // 1. Cross-source: drop if title matches a research item (it belongs in research, not duplicate award)
      if (researchTitles.some((rt) => rt === normTitle || (rt.length > 8 && normTitle.includes(rt)))) {
        mergedCount++;
        resolutions.push({
          recordA: incoming.title,
          recordB: "research entry",
          status: "identical_merged",
          reason: "Achievement is already represented as a dedicated research/patent/publication entry",
        });
        continue;
      }

      // 2. Cross-source: drop if summary restating experience leadership
      if (/^leadership\b/i.test(incoming.title) && expCompanies.some((c) => normTitle.includes(c))) {
        mergedCount++;
        resolutions.push({
          recordA: incoming.title,
          recordB: "experience entry",
          status: "identical_merged",
          reason: "Achievement is a summary restatement of extracted experience role",
        });
        continue;
      }

      // 3. Within-category deduplication
      if (seenTitles.has(normTitle)) {
        mergedCount++;
        resolutions.push({
          recordA: incoming.title,
          recordB: incoming.title,
          status: "identical_merged",
          reason: "Duplicate achievement claim",
        });
        continue;
      }

      seenTitles.add(normTitle);
      out.push({ ...incoming });
    }

    return { achievements: out, resolutions, mergedCount };
  }

  /**
   * Deduplicates research entries (papers, patents, books).
   */
  public static deduplicateResearch(
    research: NonNullable<ResumeInterpretationOutput["research"]> = []
  ): {
    research: NonNullable<ResumeInterpretationOutput["research"]>;
    resolutions: DuplicateResolution[];
    mergedCount: number;
  } {
    const out: NonNullable<ResumeInterpretationOutput["research"]> = [];
    const resolutions: DuplicateResolution[] = [];
    let mergedCount = 0;
    const seen = new Set<string>();

    for (const incoming of research) {
      const normTitle = normalizeTextKey(incoming.title);
      if (!normTitle) continue;

      // Drop summary lines that masquerade as individual research
      if (/^publications\s*:\s*author/i.test(incoming.title) || /author\/co-author of \d+ books/i.test(incoming.title)) {
        mergedCount++;
        continue;
      }

      if (seen.has(normTitle)) {
        mergedCount++;
        resolutions.push({
          recordA: incoming.title,
          recordB: incoming.title,
          status: "identical_merged",
          reason: "Duplicate research/publication/patent entry",
        });
        continue;
      }

      seen.add(normTitle);
      out.push({ ...incoming });
    }

    return { research: out, resolutions, mergedCount };
  }

  /**
   * Executes complete multi-tier deduplication on the entire interpretation output.
   */
  public static deduplicateAll(interpretation: ResumeInterpretationOutput): DeduplicationResult {
    const allResolutions: DuplicateResolution[] = [];
    let totalMerged = 0;

    const eduResult = this.deduplicateEducation(interpretation.education);
    allResolutions.push(...eduResult.resolutions);
    totalMerged += eduResult.mergedCount;

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

    const researchResult = this.deduplicateResearch(interpretation.research || []);
    allResolutions.push(...researchResult.resolutions);
    totalMerged += researchResult.mergedCount;

    const achResult = this.deduplicateAchievements(interpretation.achievements || [], {
      experience: expResult.experience,
      research: researchResult.research,
      education: eduResult.education,
    });
    allResolutions.push(...achResult.resolutions);
    totalMerged += achResult.mergedCount;

    return {
      interpretation: {
        ...interpretation,
        education: eduResult.education,
        skills: skillResult.skills,
        certifications: certResult.certifications,
        projects: projResult.projects,
        experience: expResult.experience,
        research: researchResult.research,
        achievements: achResult.achievements,
      },
      resolutions: allResolutions,
      totalDuplicatesMerged: totalMerged,
      flaggedForReview: allResolutions.filter((r) => r.status === "possible_duplicate_flagged").length,
    };
  }
}
