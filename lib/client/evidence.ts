/**
 * The engine's evidence tiers in the person's words, mapped onto the four
 * visual tiers of the evidence strip. Nothing is shown as verified unless an
 * institution verified it.
 */
import type { EvidenceTier } from "@/components/ui/EvidenceStrip";

export type EngineTier = "institutionally_verified" | "demonstrated" | "source_detected" | "student_reported" | "insufficient_evidence";

export const TIER_VIEW: Record<EngineTier, { tier: EvidenceTier; label: string }> = {
  institutionally_verified: { tier: "verified", label: "Verified" },
  demonstrated: { tier: "evidenced", label: "Shown in projects" },
  source_detected: { tier: "evidenced", label: "Found in a source" },
  student_reported: { tier: "gap", label: "Your word only" },
  insufficient_evidence: { tier: "gap", label: "Not shown yet" },
};

export function tierView(t?: string) {
  return TIER_VIEW[(t as EngineTier) ?? "insufficient_evidence"] ?? TIER_VIEW.insufficient_evidence;
}

/**
 * One rule for a skill's strip everywhere (dashboard, skills page): verified
 * if an institution verified it; corroborated when two or more independent
 * sources (not your own claim) show it; evidenced with one; otherwise your
 * word only.
 */
export function skillStrip(state: string | undefined, evidenceCount: number, observationSources: string[]): { tier: EvidenceTier; count: number; label: string } {
  const independent = new Set(observationSources.filter((s) => s !== "self_reported" && s !== "manual"));
  if (state === "Verified") return { tier: "verified", count: Math.max(1, evidenceCount), label: "Verified" };
  if (state === "Demonstrated" || state === "Evidence available") {
    return independent.size >= 2
      ? { tier: "corroborated", count: evidenceCount, label: `${independent.size} sources` }
      : { tier: "evidenced", count: evidenceCount, label: state === "Demonstrated" ? "Shown in projects" : "Found in a source" };
  }
  return { tier: "gap", count: 0, label: state === "Claimed" ? "Your word only" : "Not shown yet" };
}

export type SkillsEvidenceIndex = Record<string, { state: string; evidenceCount: number; sources: string[] }>;
