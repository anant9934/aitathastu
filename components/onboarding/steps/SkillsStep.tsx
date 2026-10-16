"use client";

import React, { useMemo, useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { AIML_ROLE_CATALOG } from "@/lib/domain/aiml-role-taxonomy";
import { candidateNames } from "@/lib/onboarding-import-candidates";
import type { OnboardingData } from "@/lib/client/onboarding/types";
import { evidenceSegments, skillEvidence } from "@/lib/client/onboarding/skill-evidence";
import { EvidenceLegend, EvidenceStrip } from "@/components/ui/EvidenceStrip";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { sourceLabel } from "@/components/review/EntryList";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";

const TIER_WORD = { corroborated: "2+ sources", evidenced: "1 source", gap: "Your word only", verified: "Verified" } as const;

export function SkillsStep({ data, saving, guide, onBack, onContinue }: { data: OnboardingData; saving: boolean; guide: React.ReactNode; onBack: () => void; onContinue: () => void }) {
  const skills = candidateNames(data.skills);
  const evidence = useMemo(() => skillEvidence(data, skills).sort((a, b) => b.items.length - a.items.length || a.skill.localeCompare(b.skill)), [data, skills]);
  const [open, setOpen] = useState<string | null>(null);
  const role = AIML_ROLE_CATALOG.find((r) => r.id === data.targetRoleId || r.title === data.targetRole);
  const has = (s: string) => skills.some((x) => x.toLowerCase() === s.toLowerCase());
  useEoraStepEvents({ onNext: onContinue, onBack });

  return (
    <>
      <StepHeader
        title="Your skills, and what backs them"
        description="Each skill shows the evidence behind it. A skill with nothing behind it is still yours; it just reads as your word until a project or source shows it."
        guide={guide}
        eoraId="eora-skills-map"
      />

      {role && (
        <section aria-labelledby="role-fit" className="mt-6 rounded-[var(--radius-panel)] border border-line bg-surface p-4 sm:p-5">
          <h2 id="role-fit" className="text-base font-semibold">Core skills for {role.title}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {role.corePrerequisites.map((p) => (
              <li key={p}>{has(p) ? <StatusChip tone="evidenced">{p}</StatusChip> : <StatusChip tone="gap">{p}</StatusChip>}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            <span className="font-mono text-ink tabular">{role.corePrerequisites.filter(has).length}</span> of <span className="font-mono tabular">{role.corePrerequisites.length}</span> in your skills. Gaps become your first roadmap steps.
          </p>
        </section>
      )}

      <section aria-labelledby="skill-list" className="mt-4 rounded-[var(--radius-panel)] border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id="skill-list" className="text-base font-semibold">All your skills <span className="font-mono text-muted tabular">{skills.length}</span></h2>
          <EvidenceLegend tiers={["corroborated", "evidenced", "gap"]} />
        </div>
        {skills.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No skills confirmed yet. Go back to the review step to accept skills from your sources or add your own.</p>
        ) : (
          <ul className="divide-y divide-line">
            {evidence.map((e) => {
              const expanded = open === e.skill;
              return (
                <li key={e.skill}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : e.skill)}
                    className="grid w-full cursor-pointer grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-raised/40 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_7rem_auto]"
                  >
                    <span className="truncate font-medium">{e.skill}</span>
                    <EvidenceStrip segments={evidenceSegments(e)} label={`${e.skill} evidence`} />
                    <span className="hidden text-xs text-muted sm:block">{TIER_WORD[e.tier]}</span>
                    <CaretDown size={16} aria-hidden="true" className={cn("text-muted transition-transform", expanded && "rotate-180")} />
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4">
                      {e.items.length === 0 ? (
                        <p className="text-sm text-muted">Nothing backs this yet. Add a project that uses {e.skill}, or connect an account that shows it.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {e.items.map((it, i) => (
                            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                              <Tag>{it.kind === "cv" ? "CV" : sourceLabel(it.source)}</Tag>
                              <span className="text-ink">{it.kind === "project" ? `Project: ${it.title}` : it.title}</span>
                              {it.detail && <span className="min-w-0 break-all font-mono text-2xs text-muted">{it.detail}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <StepFooter onBack={onBack} onNext={onContinue} saving={saving} />
    </>
  );
}
