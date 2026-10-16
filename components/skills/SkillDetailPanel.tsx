"use client";

/**
 * Detail for a node on the skills map (Task 2.4.1). For a skill it answers the
 * seven Tathastu questions from its own evidence; for a source it lists the
 * skills it backs; for a gap it says plainly that nothing shows it yet.
 */
import React from "react";
import Link from "next/link";
import { ArrowRight, X } from "@phosphor-icons/react/dist/ssr";
import { sourceLabel, type GraphNode, type GraphStatus } from "@/lib/domain/skills-graph-layout";
import { IconButton } from "@/components/ui/Button";
import { StatusChip, type Tone } from "@/components/ui/StatusChip";

export type DrawerSkill = {
  name: string;
  level: string;
  sevenQuestions?: {
    whatIsThisSkill?: { definition?: string };
    whereWasItObserved?: { sources?: string[] };
    whatIsTheVerificationStatus?: { status?: string; tierLabel?: string | null };
    howDoesItRelateToGoal?: { explanation?: string };
    howWasItUsed?: { usageSummary?: string; projects?: string[] };
    whatDidStudentPersonallyContribute?: { hasContribution?: boolean; statement?: string };
    whatEvidenceIsMissing?: { missingPoints?: string[] };
    whatShouldStudentLearnOrProveNext?: { action?: string; suggestedTask?: string; href?: string };
  };
};
export type DrawerGap = { name: string; suggestedTask: string };

export const STATUS_TEXT: Record<GraphStatus, string> = {
  verified: "Verified", corroborated: "Corroborated", evidenced: "Evidenced", claimed: "Your word only", gap: "Gap: not shown yet",
};
const STATUS_TONE: Record<GraphStatus, Tone> = { verified: "verified", corroborated: "corroborated", evidenced: "evidenced", claimed: "neutral", gap: "gap" };

export function SkillDetailPanel({ node, skill, gap, linkedSkills, onClose }: { node: GraphNode; skill?: DrawerSkill; gap?: DrawerGap; linkedSkills: string[]; onClose: () => void }) {
  const q = skill?.sevenQuestions;
  const row = (n: number, title: string, body: React.ReactNode) => (
    <li className="border-t border-border-subtle py-3 first:border-0 first:pt-0">
      <h3 className="text-xs font-medium text-text-muted"><span className="mr-1.5 font-mono tabular">{n}</span>{title}</h3>
      <div className="mt-1 text-sm text-text-primary">{body}</div>
    </li>
  );
  return (
    <aside aria-labelledby="node-title" data-testid="skill-drawer" data-eora-id="eora-skill-detail-card" className="min-w-0 rounded-card border border-border-medium bg-bg-elevated p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-text-muted">{node.kind === "skill" ? "Skill" : node.kind === "evidence" ? "Evidence source" : "Your target role"}</p>
          <h2 id="node-title" className="break-words font-display text-lg font-semibold text-text-primary">{node.fullLabel}</h2>
          {node.status && <StatusChip tone={STATUS_TONE[node.status]} className="mt-1.5"><span data-testid="drawer-status">{STATUS_TEXT[node.status]}</span></StatusChip>}
        </div>
        <IconButton label="Close details" onClick={onClose}><X size={16} aria-hidden="true" /></IconButton>
      </div>

      {node.kind === "skill" && node.status === "gap" && (
        <ol className="flex flex-col">
          {row(1, "Status", "Your target role needs this and nothing connected shows it yet. That doesn't mean you lack it.")}
          {row(2, "How to show it", gap?.suggestedTask ?? "Add a project that uses it, take an assessment, or add it yourself on this page.")}
        </ol>
      )}
      {node.kind === "skill" && node.status !== "gap" && q && (
        <ol className="flex flex-col">
          {row(1, "What it is", q.whatIsThisSkill?.definition || skill?.name)}
          {row(2, "Where it was seen", q.whereWasItObserved?.sources?.length ? [...new Set(q.whereWasItObserved.sources.map(sourceLabel))].join(", ") : "Only your own claim so far.")}
          {row(3, "How verified", `${[q.whatIsTheVerificationStatus?.status, q.whatIsTheVerificationStatus?.tierLabel].filter(Boolean).join(" · ") || "Not verified"} · level: ${skill?.level}`)}
          {row(4, "Why it matters for your goal", q.howDoesItRelateToGoal?.explanation || "Not tied to your target role.")}
          {row(5, "Where you used it", q.howWasItUsed?.projects?.length ? q.howWasItUsed.projects.join(", ") : q.howWasItUsed?.usageSummary || "No project shows it yet.")}
          {row(6, "What you did yourself", q.whatDidStudentPersonallyContribute?.hasContribution ? q.whatDidStudentPersonallyContribute.statement : "You haven't confirmed a personal contribution yet.")}
          {row(7, "What to prove next", <>
            {q.whatShouldStudentLearnOrProveNext?.action || q.whatShouldStudentLearnOrProveNext?.suggestedTask || "Keep building with it."}
            {(q.whatEvidenceIsMissing?.missingPoints?.length ?? 0) > 0 && <ul className="mt-1.5 list-disc pl-5 text-text-muted">{q.whatEvidenceIsMissing!.missingPoints!.slice(0, 3).map((m) => <li key={m}>{m}</li>)}</ul>}
          </>)}
        </ol>
      )}
      {node.kind === "skill" && (
        <Link href={`/student/skills/${encodeURIComponent(node.fullLabel)}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-warm transition-colors hover:text-accent-warm-bright">Full explanation<ArrowRight size={14} aria-hidden="true" /></Link>
      )}
      {linkedSkills.length > 0 && (
        <div className="mt-4 border-t border-border-subtle pt-3">
          <h3 className="text-xs font-medium text-text-muted">{node.kind === "evidence" ? "Skills it backs" : node.kind === "goal" ? "Skills on your map" : "Backed by"}</h3>
          <p className="mt-1 text-sm text-text-primary">{linkedSkills.join(", ")}</p>
        </div>
      )}
    </aside>
  );
}
