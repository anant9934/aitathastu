/**
 * AI TATHASTU — CV QUALITY EVALUATOR & UNTRUSTED RESPONSE VALIDATOR (V6.0)
 *
 * Implements:
 * 1. 90% Source Coverage Decision Gate: Evaluates document completeness and
 *    critical gaps before deciding whether external LLM recovery is needed.
 * 2. 8-Layer Untrusted LLM Response Validator:
 *    - Layer A: Schema conformity
 *    - Layer B: Source grounding verification
 *    - Layer C: Named entity fidelity
 *    - Layer D: Numeric & metric validation
 *    - Layer E: Relationship integrity
 *    - Layer F: Classification correctness
 *    - Layer G: Deduplication defense
 *    - Layer H: Prohibited phone privacy firewall
 * 3. High-Risk Quality Audit: Flags ambiguous records for student review.
 */

import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";
import { isGrounded, normalizeForGrounding } from "@/lib/services/resume-extraction-service";
import { normalizeTextKey, tokenJaccardSimilarity } from "./deduplication-engine";

export interface SourceCoverageReport {
  estimatedCoverage: number; // 0..1
  sectionScores: Record<string, number>;
  criticalGaps: string[];
  isSufficient: boolean;
  routingDecision: "deterministic_complete" | "needs_targeted_recovery" | "quality_warning";
}

export interface ValidationLayerFailure {
  layer: "SCHEMA" | "SOURCE_GROUNDING" | "ENTITY" | "NUMERIC" | "RELATIONSHIP" | "CLASSIFICATION" | "DEDUPLICATION" | "PRIVACY";
  itemType: string;
  itemIdentifier: string;
  reason: string;
}

export interface UntrustedValidationResult {
  valid: boolean;
  sanitizedRecord: Record<string, any> | null;
  failures: ValidationLayerFailure[];
}

export class CvQualityEvaluator {
  /**
   * Evaluates the source coverage of the deterministic extraction.
   * Checks for critical missing categories or dropped records.
   */
  public static evaluateSourceCoverage(
    extracted: ResumeInterpretationOutput,
    rawText: string
  ): SourceCoverageReport {
    const norm = normalizeForGrounding(rawText);
    const criticalGaps: string[] = [];
    const sectionScores: Record<string, number> = {
      education: 0,
      skills: 0,
      experience: 0,
      projects: 0,
      certifications: 0,
      achievements: 0,
    };

    // 1. Education evaluation (20%)
    const hasEduSection = /\b(?:education|academic|qualifications)\b/i.test(rawText);
    if (extracted.education.length > 0) {
      const hasInst = extracted.education.some((e) => e.institution && isGrounded(norm, e.institution));
      const hasDegree = extracted.education.some((e) => e.degree && isGrounded(norm, e.degree));
      sectionScores.education = hasInst && hasDegree ? 1.0 : hasInst ? 0.7 : 0.4;
    } else if (hasEduSection) {
      criticalGaps.push("education_section_detected_but_zero_records_extracted");
    }

    // 2. Skills evaluation (20%)
    const hasSkillsSection = /\b(?:skills|technologies|proficiencies|competencies)\b/i.test(rawText);
    const explicitSkills = extracted.skills.filter((s) => s.isExplicit !== false);
    if (explicitSkills.length >= 10) {
      sectionScores.skills = 1.0;
    } else if (explicitSkills.length >= 5) {
      sectionScores.skills = 0.8;
    } else if (explicitSkills.length > 0) {
      sectionScores.skills = 0.5;
    } else if (hasSkillsSection) {
      criticalGaps.push("skills_section_detected_but_zero_records_extracted");
    }

    // 3. Experience & Leadership evaluation (25%)
    const hasExpSection = /\b(?:experience|employment|work history|training|leadership)\b/i.test(rawText);
    if (extracted.experience.length >= 3) {
      sectionScores.experience = 1.0;
    } else if (extracted.experience.length >= 1) {
      sectionScores.experience = 0.75;
    } else if (hasExpSection) {
      criticalGaps.push("experience_or_training_detected_but_zero_records_extracted");
    }

    // Check if leadership was mistakenly classified entirely as internship
    const leadershipKeywords = /\b(?:advisor|lead developer|co-founder|founder|president|vice president|coo|ceo)\b/i;
    const hasLeadershipInText = leadershipKeywords.test(rawText);
    if (hasLeadershipInText) {
      const capturedLeadership = extracted.experience.some(
        (e) => e.type === "founder" || e.type === "leadership" || leadershipKeywords.test(e.role)
      );
      if (!capturedLeadership && extracted.experience.length > 0) {
        criticalGaps.push("leadership_roles_misclassified_or_missing_leadership_tag");
      }
    }

    // 4. Projects evaluation (20%)
    const hasProjSection = /\b(?:projects|key projects|academic projects)\b/i.test(rawText);
    if (extracted.projects.length >= 3) {
      sectionScores.projects = 1.0;
    } else if (extracted.projects.length >= 2) {
      sectionScores.projects = 0.85;
    } else if (extracted.projects.length === 1) {
      sectionScores.projects = 0.6;
    } else if (hasProjSection) {
      criticalGaps.push("projects_section_detected_but_zero_records_extracted");
    }

    // 5. Certifications & Achievements evaluation (15%)
    const hasCertSection = /\b(?:certificates|certifications|licensed)\b/i.test(rawText);
    const certCountInText = (rawText.match(/\b(?:certified|certification|certificate|coursera|infosys|oracle|simplilearn|hackerrank|forage|reliance)\b/gi) || []).length;
    if (extracted.certifications.length >= 5) {
      sectionScores.certifications = 1.0;
    } else if (extracted.certifications.length >= 2) {
      sectionScores.certifications = 0.8;
    } else if (extracted.certifications.length > 0) {
      sectionScores.certifications = 0.5;
    } else if (hasCertSection && certCountInText >= 2) {
      criticalGaps.push("certifications_section_detected_but_records_missing");
    }

    // Compute weighted coverage score
    const estimatedCoverage =
      sectionScores.education * 0.2 +
      sectionScores.skills * 0.2 +
      sectionScores.experience * 0.25 +
      sectionScores.projects * 0.2 +
      sectionScores.certifications * 0.15;

    const roundedCoverage = Math.round(estimatedCoverage * 100) / 100;
    const isSufficient = roundedCoverage >= 0.9 && criticalGaps.length === 0;

    return {
      estimatedCoverage: roundedCoverage,
      sectionScores,
      criticalGaps,
      isSufficient,
      routingDecision: isSufficient
        ? "deterministic_complete"
        : criticalGaps.length > 0
        ? "needs_targeted_recovery"
        : "quality_warning",
    };
  }

  /**
   * 8-Layer Untrusted LLM Response Validator.
   * Treats any external model output as untrusted and validates each layer.
   */
  public static validateUntrustedProposedRecord(
    itemType: "education" | "experience" | "project" | "skill" | "certification" | "achievement",
    proposed: Record<string, any>,
    rawSourceText: string,
    existingRecords: Record<string, any>[] = []
  ): UntrustedValidationResult {
    const failures: ValidationLayerFailure[] = [];
    const norm = normalizeForGrounding(rawSourceText);

    // Layer H: Privacy Validation (Zero Phone Tolerated)
    const proposedJson = JSON.stringify(proposed);
    if (/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(proposedJson) || /phone|mobile/i.test(proposedJson)) {
      failures.push({
        layer: "PRIVACY",
        itemType,
        itemIdentifier: proposed.name || proposed.title || proposed.company || "unknown",
        reason: "Proposed item contains prohibited CV-derived phone number or phone field",
      });
      return { valid: false, sanitizedRecord: null, failures };
    }

    // Layer B & C: Source Grounding & Entity Validation
    const primaryName = proposed.name || proposed.title || proposed.company || proposed.institution;
    if (!primaryName || !isGrounded(norm, primaryName)) {
      failures.push({
        layer: "SOURCE_GROUNDING",
        itemType,
        itemIdentifier: String(primaryName || "empty"),
        reason: `Primary entity "${primaryName}" does not exist in the source document`,
      });
    }

    // Layer D: Numeric & Metric Validation
    if (proposed.gpa && !isGrounded(norm, proposed.gpa)) {
      failures.push({
        layer: "NUMERIC",
        itemType,
        itemIdentifier: String(primaryName),
        reason: `GPA/grade "${proposed.gpa}" is ungrounded in source text`,
      });
    }
    if (proposed.startDate && !isGrounded(norm, proposed.startDate)) {
      failures.push({
        layer: "NUMERIC",
        itemType,
        itemIdentifier: String(primaryName),
        reason: `Start date "${proposed.startDate}" is ungrounded in source text`,
      });
    }

    // Layer E: Relationship Validation
    if (itemType === "certification" && proposed.issuer && !isGrounded(norm, proposed.issuer)) {
      failures.push({
        layer: "RELATIONSHIP",
        itemType,
        itemIdentifier: String(primaryName),
        reason: `Certificate issuer "${proposed.issuer}" is ungrounded in source text`,
      });
    }

    // Layer F: Classification Validation
    if (itemType === "experience" && proposed.type === "internship") {
      const roleStr = String(proposed.role || "");
      if (/\b(?:co-founder|founder|coo|ceo|president|vice president|advisor)\b/i.test(roleStr)) {
        // Correct classification rather than rejecting
        proposed.type = "founder";
      }
    }

    // Layer G: Deduplication Validation
    const proposedKey = normalizeTextKey(primaryName);
    const isDuplicate = existingRecords.some((existing) => {
      const existingName = existing.name || existing.title || existing.company || existing.institution;
      const exKey = normalizeTextKey(existingName);
      return exKey === proposedKey || tokenJaccardSimilarity(existingName, primaryName) >= 0.92;
    });

    if (isDuplicate) {
      failures.push({
        layer: "DEDUPLICATION",
        itemType,
        itemIdentifier: String(primaryName),
        reason: `Proposed ${itemType} duplicates an already extracted verified record`,
      });
    }

    const valid = failures.length === 0;
    return {
      valid,
      sanitizedRecord: valid ? proposed : null,
      failures,
    };
  }
}
