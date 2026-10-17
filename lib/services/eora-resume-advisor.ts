/**
 * AI TATHASTU — EORA RESUME REVIEW ADVISOR
 *
 * Implements EORA-guided review experience for Schema v2.0 resume extractions.
 * - Explains what was extracted deterministically.
 * - Flags uncertain fields (heuristic confidence < 0.75).
 * - Identifies missing graduation dates or institutions.
 * - Points out discovered digital profiles (GitHub, LinkedIn, Portfolio).
 * - Never hallucinates or fabricates missing information.
 */

import type { ExtractorProfileV2 } from "./extractor-service-client";

export interface EoraReviewGuidance {
  primaryMessage: string;
  mood: "CHEERFUL" | "THINKING" | "REASSURING" | "CELEBRATING" | "FOCUSED";
  stats: {
    totalFieldsExtracted: number;
    groupsFound: number;
    uncertainCount: number;
    missingCriticalDates: number;
    discoveredPlatforms: string[];
  };
  fieldAdviceList: Array<{
    group: string;
    recordId: string;
    field: string;
    currentValue: string;
    confidence: number;
    suggestion: string;
    severity: "info" | "warning" | "needs_confirmation";
  }>;
  suggestedNextStep: string;
}

export class EoraResumeAdvisor {
  static analyzeProfile(profile: ExtractorProfileV2): EoraReviewGuidance {
    let totalFields = 0;
    let groupsFound = 0;
    let uncertainCount = 0;
    let missingCriticalDates = 0;
    const discoveredPlatforms: string[] = [];
    const fieldAdviceList: EoraReviewGuidance["fieldAdviceList"] = [];

    // Analyze Groups
    for (const [groupKey, records] of Object.entries(profile.groups)) {
      if (groupKey === "extraction_metadata") continue;
      if (records && records.length > 0) {
        groupsFound++;
      }

      for (const rec of records) {
        if (rec.record_state === "rejected") continue;

        for (const [fieldKey, field] of Object.entries(rec.fields)) {
          totalFields++;

          // 1. Check for low confidence or uncertain state
          if (field.confidence < 0.75 || field.review_state === "uncertain") {
            uncertainCount++;
            fieldAdviceList.push({
              group: groupKey,
              recordId: rec.record_id,
              field: fieldKey,
              currentValue: field.value,
              confidence: field.confidence,
              suggestion: `This was detected with moderate confidence (${Math.round(field.confidence * 100)}%). Please confirm or correct it.`,
              severity: "needs_confirmation",
            });
          }

          // 2. Critical Education Checks
          if (groupKey === "education") {
            if (fieldKey === "expected_graduation" && (!field.value || field.value.trim() === "")) {
              missingCriticalDates++;
              fieldAdviceList.push({
                group: groupKey,
                recordId: rec.record_id,
                field: fieldKey,
                currentValue: "",
                confidence: field.confidence,
                suggestion: "Your graduation year wasn't clearly stated. Adding it helps calculate placement eligibility.",
                severity: "warning",
              });
            }
          }
        }
      }
    }

    // Check digital footprint platform discoveries
    const footprintRecords = profile.groups.digital_footprint || [];
    for (const fp of footprintRecords) {
      const platform = fp.fields.platform?.value;
      if (platform && !discoveredPlatforms.includes(platform)) {
        discoveredPlatforms.push(platform);
      }
    }

    // Compose primary EORA message
    let primaryMessage: string;
    let mood: EoraReviewGuidance["mood"] = "CHEERFUL";
    let suggestedNextStep = "Review and confirm your extracted details.";

    const eduCount = (profile.groups.education || []).filter((r) => r.record_state !== "rejected").length;
    const projCount = (profile.groups.projects || []).filter((r) => r.record_state !== "rejected").length;
    const expCount =
      (profile.groups.experience || []).filter((r) => r.record_state !== "rejected").length +
      (profile.groups.internships || []).filter((r) => r.record_state !== "rejected").length;
    const skillCount = (profile.groups.skills || []).filter((r) => r.record_state !== "rejected").length;
    const certCount = (profile.groups.certifications || []).filter((r) => r.record_state !== "rejected").length;

    const parts: string[] = [];
    if (eduCount > 0) parts.push(`${eduCount} education record${eduCount > 1 ? "s" : ""}`);
    if (projCount > 0) parts.push(`${projCount} project${projCount > 1 ? "s" : ""}`);
    if (expCount > 0) parts.push(`${expCount} experience position${expCount > 1 ? "s" : ""}`);
    if (skillCount > 0) parts.push(`${skillCount} skill${skillCount > 1 ? "s" : ""}`);
    if (certCount > 0) parts.push(`${certCount} certification${certCount > 1 ? "s" : ""}`);

    if (totalFields === 0) {
      primaryMessage = "I couldn't detect clear sections in this document. You can retry with a sharper PDF or enter details directly.";
      mood = "REASSURING";
      suggestedNextStep = "Try uploading an uncompressed digital PDF or enter details manually.";
    } else if (parts.length > 0) {
      primaryMessage = `Found ${parts.slice(0, 3).join(", ")}${parts.length > 3 ? `, and ${parts.slice(3).join(", ")}` : ""}. Please review and approve before saving.`;
      mood = uncertainCount > 0 ? "THINKING" : "CHEERFUL";
      suggestedNextStep = uncertainCount > 0 ? "Review highlighted items below." : "Review and confirm your details.";
    } else {
      primaryMessage = `Extracted ${totalFields} fields across ${groupsFound} sections. Please review before saving.`;
      mood = "CHEERFUL";
      suggestedNextStep = "Confirm your details to link them directly to your Person 360 profile.";
    }

    return {
      primaryMessage,
      mood,
      stats: {
        totalFieldsExtracted: totalFields,
        groupsFound,
        uncertainCount,
        missingCriticalDates,
        discoveredPlatforms,
      },
      fieldAdviceList,
      suggestedNextStep,
    };
  }
}
