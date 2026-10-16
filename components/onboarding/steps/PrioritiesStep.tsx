"use client";

import React, { useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Briefcase, CalendarDots, ChalkboardTeacher, ClipboardText, Code, Flask, Microscope, Plus, TreeStructure, UsersThree, X } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { PURPOSES, validPurposeIds, type WorkspaceRole } from "@/lib/domain/adaptive-workspace";
import { IconButton } from "@/components/ui/Button";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";

const ICONS: Record<string, Icon> = {
  learning: BookOpen, jobs: Briefcase, people: UsersThree, collaboration: TreeStructure, projects: Code, research_events: Flask,
  teaching: ChalkboardTeacher, assessments: ClipboardText, mentorship: UsersThree, research: Microscope, meetings: CalendarDots,
};
const RANKS = ["First", "Second", "Third"];

/** Ranked purposes: the first one shapes the dashboard's hero and sections. */
export function PrioritiesStep({ role, initial, saving, guide, onBack, onContinue }: {
  role: WorkspaceRole;
  initial: string[];
  saving: boolean;
  guide: React.ReactNode;
  onBack: () => void;
  onContinue: (ranked: string[]) => void;
}) {
  const [ranked, setRanked] = useState<string[]>(() => validPurposeIds(role, initial.map((id) => (id === "network" ? "people" : id))));
  const [notice, setNotice] = useState<string | null>(null);
  const options = PURPOSES[role];
  const title = (id: string) => options.find((o) => o.id === id)?.title ?? id;

  const toggle = (id: string) => {
    setNotice(null);
    if (ranked.includes(id)) { setRanked(ranked.filter((x) => x !== id)); return; }
    if (ranked.length === 3) { setNotice("You can rank up to three. Remove one to add another."); return; }
    setRanked([...ranked, id]);
  };
  const move = (i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= ranked.length) return;
    const next = [...ranked];
    [next[i], next[j]] = [next[j], next[i]];
    setRanked(next);
  };
  const next = () => {
    if (!ranked.length) { setNotice("Choose at least one. Your first choice shapes your dashboard."); return; }
    onContinue(ranked);
  };
  useEoraStepEvents({ onNext: next, onBack });

  return (
    <>
      <StepHeader
        title="What do you want from AI Tathastu first?"
        description="Choose up to three, most important first. Your first choice decides what your dashboard opens with; you can reorder later."
        guide={guide}
      />
      <div data-eora-id="eora-priorities" className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {options.map((p) => {
            const rank = ranked.indexOf(p.id);
            const on = rank >= 0;
            const Glyph = ICONS[p.id] ?? Code;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                aria-label={`${p.title}${on ? `, ranked ${RANKS[rank].toLowerCase()}` : ""}`}
                onClick={() => toggle(p.id)}
                className={cn(
                  "relative flex min-h-24 cursor-pointer flex-col items-start gap-2 rounded-card border p-4 text-left transition-all duration-200",
                  on ? "border-accent-warm-bright bg-accent-warm-bright/10 text-warm-ivory shadow-[0_0_20px_rgba(244,154,71,0.15)]" : "border-border-medium bg-bg-elevated text-text-primary hover:border-accent-warm",
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <Glyph size={22} weight={on ? "fill" : "regular"} aria-hidden="true" className={on ? "text-accent-warm-bright" : "text-text-dim"} />
                  {on ? (
                    <span className="grid size-6 place-items-center rounded-full bg-accent-warm-bright font-mono text-xs font-bold text-obsidian tabular" aria-hidden="true">{rank + 1}</span>
                  ) : (
                    <Plus size={16} aria-hidden="true" className="text-text-dim" />
                  )}
                </span>
                <span className="font-display font-semibold text-text-primary">{p.title}</span>
                <span className="text-xs text-text-muted">{p.description}</span>
              </button>
            );
          })}
        </div>

        <section aria-labelledby="ranked-title" className="self-start rounded-card border border-border-medium bg-bg-elevated p-4">
          <h2 id="ranked-title" className="font-display text-sm font-semibold text-text-primary">Your order</h2>
          <ol className="mt-3 flex flex-col gap-2">
            {RANKS.map((rank, i) => {
              const id = ranked[i];
              return (
                <li key={rank} className={cn("flex min-h-12 items-center gap-2 rounded-md border px-2.5 transition-colors", id ? "border-border-medium bg-deep-espresso" : "border-dashed border-border-medium text-text-dim")}>
                  <span className="w-5 font-mono text-xs text-text-dim tabular">{i + 1}</span>
                  <span className={cn("min-w-0 flex-1 truncate text-sm", id ? "font-medium text-text-primary" : "text-text-dim")}>{id ? title(id) : "Optional"}</span>
                  {id && (
                    <span className="flex">
                      <IconButton label={`Move ${title(id)} up`} disabled={i === 0} onClick={() => move(i, -1)} className="size-8 pointer-coarse:size-10"><ArrowUp size={14} aria-hidden="true" /></IconButton>
                      <IconButton label={`Move ${title(id)} down`} disabled={i === ranked.length - 1} onClick={() => move(i, 1)} className="size-8 pointer-coarse:size-10"><ArrowDown size={14} aria-hidden="true" /></IconButton>
                      <IconButton label={`Remove ${title(id)}`} onClick={() => toggle(id)} className="size-8 pointer-coarse:size-10"><X size={14} aria-hidden="true" /></IconButton>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
      {notice && <p role="alert" className="mt-4 text-sm text-warning">{notice}</p>}
      <StepFooter onBack={onBack} onNext={next} saving={saving} />
    </>
  );
}
