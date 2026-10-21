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
  /** Field-level values from the review workspace (canonical keys, see FIELD_MAP). */
  fields?: Record<string, string>;
};

/** Review-workspace field -> Schema v2 field(s), per candidate category. */
const FIELD_MAP: Record<string, Record<string, string[]>> = {
  education: { degree: ["qualification", "degree_title"], institution: ["institution"], fieldOfStudy: ["specialization"], endDate: ["expected_graduation"] },
  experience: { company: ["organization"], role: ["job_title"] },
  project: { title: ["title"], description: ["description"], technologies: ["technologies"], repositoryUrl: ["github_url"], demoUrl: ["demo_url"] },
  skill: { name: ["canonical_name"] },
  certification: { name: ["title"] },
  achievement: { title: ["name"] },
  leadership: { role: ["role"], organization: ["organization"] },
  research: { title: ["title"] },
  publication: { title: ["title"] },
  digitalFootprint: { value: ["normalized_url", "original_url"], url: ["normalized_url", "original_url"], platform: ["platform"] },
  summary: { value: ["professional_summary"] },
};

function setField(record: ExtractorRecord, key: string, value: string, create: boolean) {
  const now = new Date().toISOString();
  const f = record.fields[key];
  if (!f) {
    if (!create || !value) return;
    // Typed in by the student: no evidence, because the CV did not contain it.
    record.fields[key] = { value, original_value: "", evidence: [], confidence: 1, confidence_kind: "heuristic", review_state: "student_confirmed", history: [{ action: "add", actor: "student", timestamp: now, previous_value: null, new_value: value, previous_state: "extracted" }] };
    return;
  }
  if (f.value === value) return;
  f.history.push({ action: f.value ? "correct" : "add", actor: "student", timestamp: now, previous_value: f.value, new_value: value, previous_state: f.review_state });
  // Evidence stays only while it still supports the value: a value the student typed
  // that is not in the cited CV text (or filled a blank) carries none.
  const norm = (t: string) => t.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  if (!(f.value ?? "").trim() || !f.evidence.some((e) => norm(e.snippet ?? "").includes(norm(value)))) f.evidence = [];
  f.value = value;
  f.review_state = "student_confirmed";
}

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
): {
  profile: ExtractorProfileV2;
  confirmed: number;
  rejected: number;
  pending: number;
  domainCandidatesCount: number;
  recordConfirmed: number;
  recordRejected: number;
  prunedRecords: number;
  unknown: string[];
} {
  const next: ExtractorProfileV2 = structuredClone(profile);
  const byRecord = new Map<ExtractorRecord, ReviewDecision>();
  const unknown: string[] = [];

  // Exclude onboarding profile candidate IDs (e.g. profile_fullName) to obtain pure domain candidates
  const domainKnownIds = new Set(
    Array.from(knownCandidateIds).filter((id) => !id.startsWith("profile_"))
  );

  const decisionMap = new Map<string, ReviewDecision>();
  for (const d of decisions) {
    if (!knownCandidateIds.has(d.candidateId)) {
      unknown.push(d.candidateId);
      continue;
    }
    decisionMap.set(d.candidateId, d);

    const parsed = parseCandidateId(d.candidateId);
    if (!parsed) continue;

    const groupConfig = CATEGORY_GROUPS[parsed.category];
    if (!groupConfig) continue;

    const record = next.groups[groupConfig[0]]?.[parsed.index];
    if (record) {
      byRecord.set(record, d);
    }
  }

  // 1. Candidate-level accounting
  let confirmedCandidates = 0;
  let rejectedCandidates = 0;
  let pendingCandidates = 0;

  for (const candId of domainKnownIds) {
    const dec = decisionMap.get(candId);
    if (!dec) {
      pendingCandidates++;
    } else if (dec.state === "confirmed") {
      confirmedCandidates++;
    } else if (dec.state === "rejected") {
      rejectedCandidates++;
    }
  }

  // 2. Profile record-level state updates
  let recordConfirmed = 0;
  let recordRejected = 0;
  let prunedRecords = 0;

  for (const [category, [group, valueFields]] of Object.entries(CATEGORY_GROUPS)) {
    const records = next.groups[group] || [];
    records.forEach((record, idx) => {
      if (record.record_state === "independently_verified") return;
      const candId = `${category}_${idx}`;
      const decision = decisionMap.get(candId) || byRecord.get(record);

      if (!decision) {
        record.record_state = "rejected";
        recordRejected++;
        if (!domainKnownIds.has(candId)) {
          prunedRecords++;
        }
        return;
      }

      if (decision.state === "rejected") {
        record.record_state = "rejected";
        recordRejected++;
        return;
      }

      record.record_state = "student_confirmed";
      recordConfirmed++;
      if (decision.fields) {
        // Field-level edits go to their own fields; the one-line summary is not written anywhere.
        const map = FIELD_MAP[category] ?? {};
        for (const [k, v] of Object.entries(decision.fields)) {
          const value = k === "technologies" ? v.split(/\n+|\s*,\s*/).map((x) => x.trim()).filter(Boolean).join(", ") : k === "endDate" ? (v.match(/\b(19|20)\d{2}\b/)?.[0] ?? v).trim() : v.trim();
          (map[k] ?? []).forEach((target, n) => setField(record, target, value, n === 0));
        }
        return;
      }
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
    });
  }

  return {
    profile: next,
    confirmed: confirmedCandidates,
    rejected: rejectedCandidates,
    pending: pendingCandidates,
    domainCandidatesCount: domainKnownIds.size,
    recordConfirmed,
    recordRejected,
    prunedRecords,
    unknown,
  };
}
