"use client";

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Briefcase,
  CalendarDots,
  ChalkboardTeacher,
  ClipboardText,
  Code,
  Flask,
  Microscope,
  Plus,
  TreeStructure,
  UsersThree,
  X,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { PURPOSES, validPurposeIds, type WorkspaceRole } from "@/lib/domain/adaptive-workspace";
import { IconButton } from "@/components/ui/Button";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";

const ICONS: Record<string, Icon> = {
  learning: BookOpen,
  jobs: Briefcase,
  people: UsersThree,
  collaboration: TreeStructure,
  projects: Code,
  research_events: Flask,
  teaching: ChalkboardTeacher,
  assessments: ClipboardText,
  mentorship: UsersThree,
  research: Microscope,
  meetings: CalendarDots,
};

const RANKS = ["Primary Focus", "Secondary Goal", "Tertiary Priority"];

/** Ranked purposes: the first one shapes the dashboard's hero and sections. */
export function PrioritiesStep({
  role,
  initial,
  saving,
  guide,
  onBack,
  onContinue,
}: {
  role: WorkspaceRole;
  initial: string[];
  saving: boolean;
  guide: React.ReactNode;
  onBack: () => void;
  onContinue: (ranked: string[]) => void;
}) {
  const [ranked, setRanked] = useState<string[]>(() =>
    validPurposeIds(role, initial.map((id) => (id === "network" ? "people" : id)))
  );
  const [notice, setNotice] = useState<string | null>(null);
  const options = PURPOSES[role];
  const title = (id: string) => options.find((o) => o.id === id)?.title ?? id;

  const toggle = (id: string) => {
    setNotice(null);
    if (ranked.includes(id)) {
      setRanked(ranked.filter((x) => x !== id));
      return;
    }
    if (ranked.length === 3) {
      setNotice("You can rank up to three priorities. Remove one to add another.");
      return;
    }
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
    if (!ranked.length) {
      setNotice("Choose at least one priority. Your first choice shapes your dashboard.");
      return;
    }
    onContinue(ranked);
  };
  useEoraStepEvents({ onNext: next, onBack });

  return (
    <>
      <StepHeader
        title="What do you want from AI Tathastu first?"
        description="Choose up to three priorities in order of importance. Your first choice directly shapes your initial workspace dashboard and recommendations."
        guide={guide}
      />

      <div
        data-eora-id="eora-priorities"
        className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 items-start"
      >
        {/* Left: Options Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                  "group relative flex min-h-28 cursor-pointer flex-col justify-between rounded-card border p-4 text-left transition-all duration-200 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-accent-warm focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
                  on
                    ? "border-accent-warm-bright bg-accent-warm-bright/10 text-text-primary shadow-[0_0_24px_rgba(196,138,90,0.16)] ring-1 ring-accent-warm-bright"
                    : "border-border-medium bg-bg-elevated text-text-primary hover:border-accent-warm hover:bg-bg-elevated/80",
                )}
              >
                <div>
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-md border transition-colors",
                        on
                          ? "border-accent-warm-bright/50 bg-accent-warm-bright/15 text-accent-warm-bright"
                          : "border-border-medium bg-deep-espresso text-text-dim",
                      )}
                    >
                      <Glyph size={20} weight={on ? "fill" : "regular"} aria-hidden="true" />
                    </span>
                    {on ? (
                      <span
                        className="grid size-6 place-items-center rounded-full bg-accent-warm-bright font-mono text-xs font-bold text-espresso shadow-sm"
                        aria-hidden="true"
                      >
                        {rank + 1}
                      </span>
                    ) : (
                      <span className="grid size-6 place-items-center rounded-full border border-border-medium bg-bg-primary text-text-dim group-hover:border-accent-warm group-hover:text-text-primary transition-colors">
                        <Plus size={14} aria-hidden="true" />
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-display font-semibold text-text-primary group-hover:text-text-primary transition-colors">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-xs text-text-muted leading-relaxed line-clamp-2">
                    {p.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Ranking Order Panel */}
        <section
          aria-labelledby="ranked-title"
          className="rounded-card border border-border-medium bg-bg-elevated p-5 shadow-card lg:sticky lg:top-24"
        >
          <div className="flex items-center gap-2 border-b border-border-medium pb-3">
            <Sparkle size={16} weight="fill" className="text-accent-warm" />
            <h2 id="ranked-title" className="font-display text-sm font-bold text-text-primary uppercase tracking-wider">
              Priority Ranking
            </h2>
          </div>

          <p className="mt-2 text-xs text-text-muted leading-relaxed">
            Your <strong className="text-text-primary">#1 choice</strong> becomes your dashboard hero. Reorder with arrows or click cards to adjust.
          </p>

          <ol className="mt-4 flex flex-col gap-2.5">
            {RANKS.map((rankName, i) => {
              const id = ranked[i];
              return (
                <li
                  key={rankName}
                  className={cn(
                    "flex min-h-12 items-center gap-2.5 rounded-lg border px-3 py-2 transition-all",
                    id
                      ? "border-accent-warm/40 bg-deep-espresso/80 text-text-primary shadow-sm"
                      : "border-dashed border-border-medium bg-bg-surface/30 text-text-dim",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold",
                      id ? "bg-accent-warm text-espresso" : "bg-bg-primary text-text-dim border border-border-medium",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-text-dim">
                      {rankName}
                    </p>
                    <p className={cn("truncate text-sm", id ? "font-semibold text-text-primary" : "text-text-dim")}>
                      {id ? title(id) : "Optional priority"}
                    </p>
                  </div>
                  {id && (
                    <div className="flex items-center gap-0.5">
                      <IconButton
                        label={`Move ${title(id)} up`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        className="size-7"
                      >
                        <ArrowUp size={13} aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Move ${title(id)} down`}
                        disabled={i === ranked.length - 1}
                        onClick={() => move(i, 1)}
                        className="size-7"
                      >
                        <ArrowDown size={13} aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Remove ${title(id)}`}
                        onClick={() => toggle(id)}
                        className="size-7 text-danger hover:bg-danger/10"
                      >
                        <X size={13} aria-hidden="true" />
                      </IconButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {notice && (
        <p role="alert" className="mt-4 text-sm font-medium text-warning">
          {notice}
        </p>
      )}

      <StepFooter onBack={onBack} onNext={next} saving={saving} />
    </>
  );
}
