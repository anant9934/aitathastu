/**
 * Evidence behind each skill during onboarding, from what the person has
 * actually confirmed or what a source actually reported for that skill. A
 * linked GitHub account or an education entry is not evidence of every skill
 * (the Phase 2 skills map claimed both; logged as P4-29).
 */
import type { EvidenceSegment, EvidenceTier } from "@/components/ui/EvidenceStrip";
import type { OnboardingData } from "./types";

export type SkillEvidenceItem = { kind: "project" | "source" | "cv"; source: string; title: string; detail?: string; url?: string };

export type SkillEvidence = { skill: string; items: SkillEvidenceItem[]; sources: string[]; tier: EvidenceTier };

const lc = (s: string) => s.trim().toLowerCase();

export function skillEvidence(data: OnboardingData, skills: string[]): SkillEvidence[] {
  return skills.map((skill) => {
    const key = lc(skill);
    const items: SkillEvidenceItem[] = [];
    for (const p of data.projects) {
      if (p.status !== "confirmed") continue;
      if (p.technologies?.some((t) => lc(t) === key)) {
        items.push({ kind: "project", source: p.sources?.[0] ?? "manual", title: p.title, detail: p.url ? "Repository linked" : undefined, url: p.url });
      }
    }
    for (const c of data.techCandidates) {
      if (c.status === "rejected" || lc(c.name) !== key) continue;
      items.push({ kind: "source", source: c.source, title: `Found in ${c.source}`, detail: c.sourceFile });
    }
    for (const r of data.resumeReviewed) {
      if (r.category === "skill" && lc(r.value) === key) items.push({ kind: "cv", source: "resume", title: "Listed in your CV", detail: r.sourceSpan !== r.value ? r.sourceSpan : undefined });
    }
    const sources = Array.from(new Set(items.map((i) => (i.kind === "cv" ? "resume" : i.source))));
    // Nothing is "verified" during onboarding: verification is a faculty review step.
    const tier: EvidenceTier = sources.length >= 2 ? "corroborated" : sources.length === 1 ? "evidenced" : "gap";
    return { skill, items, sources, tier };
  });
}

export function evidenceSegments(e: SkillEvidence): EvidenceSegment[] {
  if (!e.items.length) return [{ tier: "gap", count: 0 }];
  return [{ tier: e.tier, count: e.items.length, label: `item${e.items.length === 1 ? "" : "s"} from ${e.sources.length} source${e.sources.length === 1 ? "" : "s"}` }];
}
