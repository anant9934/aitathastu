/**
 * Applies a student's review decisions to a stored Schema v2 profile.
 *
 * The review UI lists every candidate claim with a checkbox. Before this
 * existed, unchecked candidates were simply not sent, and the importer took
 * everything not explicitly "rejected", so deselected skills still landed in
 * Person 360. Now each candidate gets an explicit decision. Records in the
 * reviewable groups end up either student_confirmed (possibly with a
 * corrected value) or rejected, and the importer only takes confirmed ones.
 */

import type { ExtractorProfileV2, ExtractorRecord } from "./extractor-service-client";

export type ReviewDecision = {
  candidateId: string;
  state: "confirmed" | "rejected";
  /** Present when the student edited the wording. */
  correctedValue?: string;
};

/** candidate category -> [profile group, primary field that holds the candidate's value] */
const CATEGORY_GROUPS: Record<string, [string, string[]]> = {
  skill: ["skills", ["canonical_name", "original_wording"]],
  project: ["projects", ["title"]],
  education: ["education", ["degree_title", "qualification"]],
  experience: ["experience", ["job_title", "organization"]],
  certification: ["certifications", ["title"]],
  achievement: ["awards", ["name"]],
  leadership: ["leadership", ["role", "organization"]],
  research: ["research", ["title"]],
  publication: ["books_patents", ["title"]],
  digitalFootprint: ["digital_footprint", ["normalized_url", "original_url"]],
  summary: ["summary", ["professional_summary"]],
};

export const REVIEWABLE_GROUPS = Object.values(CATEGORY_GROUPS).map(([g]) => g);

export function parseCandidateId(candidateId: string): { category: string; index: number } | null {
  const m = /^([a-zA-Z]+)_(\d+)$/.exec(candidateId);
  if (!m || !(m[1] in CATEGORY_GROUPS)) return null;
  return { category: m[1], index: Number(m[2]) };
}

export function applyReviewDecisions(
  profile: ExtractorProfileV2,
  knownCandidateIds: Set<string>,
  decisions: ReviewDecision[]
): { profile: ExtractorProfileV2; confirmed: number; rejected: number; unknown: string[] } {
  const next: ExtractorProfileV2 = structuredClone(profile);
  const byRecord = new Map<ExtractorRecord, ReviewDecision>();
  const unknown: string[] = [];

  for (const d of decisions) {
    if (!knownCandidateIds.has(d.candidateId)) {
      unknown.push(d.candidateId);
      continue;
    }
    const parsed = parseCandidateId(d.candidateId);
    if (!parsed) continue;

    const groupConfig = CATEGORY_GROUPS[parsed.category];
    if (!groupConfig) continue;

    const record = next.groups[groupConfig[0]]?.[parsed.index];
    if (record) {
      byRecord.set(record, d);
    }
  }

  let confirmed = 0;
  let rejected = 0;
  for (const [category, [group, valueFields]] of Object.entries(CATEGORY_GROUPS)) {
    void category;
    for (const record of next.groups[group] || []) {
      if (record.record_state === "independently_verified") continue;
      const decision = byRecord.get(record);
      // No decision = the student never confirmed it: treat as rejected.
      if (!decision || decision.state === "rejected") {
        record.record_state = "rejected";
        rejected++;
        continue;
      }
      record.record_state = "student_confirmed";
      confirmed++;
      const corrected = decision.correctedValue?.trim();
      const key = valueFields.find((k) => record.fields[k]);
      if (corrected && key && record.fields[key].value !== corrected) {
        const f = record.fields[key];
        f.history.push({
          action: "correct",
          actor: "student",
          timestamp: new Date().toISOString(),
          previous_value: f.value,
          new_value: corrected,
          previous_state: f.review_state,
        });
        f.value = corrected;
        f.review_state = "student_confirmed";
      }
    }
  }
  return { profile: next, confirmed, rejected, unknown };
}
