"use client";

import React, { useMemo, useState } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { AIML_ROLE_CATALOG, type AimlRoleDefinition } from "@/lib/domain/aiml-role-taxonomy";
import { TextField } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusChip";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "engineering", label: "Engineering" },
  { id: "research", label: "Research" },
  { id: "data_product", label: "Data and product" },
  { id: "exploration", label: "Still exploring" },
];

export function DirectionStep({ initialRole, saving, guide, onBack, onContinue }: {
  initialRole: string;
  saving: boolean;
  guide: React.ReactNode;
  onBack: () => void;
  onContinue: (role: AimlRoleDefinition) => void;
}) {
  const [selected, setSelected] = useState<string>(() =>
    AIML_ROLE_CATALOG.find((r) => r.title.toLowerCase() === initialRole.toLowerCase() || r.id === initialRole)?.id ?? "");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const roles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...AIML_ROLE_CATALOG]
      .filter((r) => (category === "all" || r.category === category) && (!q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.corePrerequisites.some((p) => p.toLowerCase().includes(q))))
      .sort((a, b) => Number(b.popular) - Number(a.popular) || a.sortOrder - b.sortOrder);
  }, [query, category]);

  const role = AIML_ROLE_CATALOG.find((r) => r.id === selected);
  const next = () => {
    if (!role) { setError("Choose the role you're aiming for. Pick \"Still exploring\" if you're not sure yet."); return; }
    onContinue(role);
  };
  useEoraStepEvents({ onNext: next, onBack });

  return (
    <>
      <StepHeader
        title="Where are you heading in AI and ML?"
        description="Pick the role you're working toward. We use it to show which skills you've already proven and which ones are still gaps. You can change it any time."
        guide={guide}
      />
      <div data-eora-id="eora-ai-direction" className="mt-6 flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <TextField
            label="Search roles"
            labelHidden
            type="search"
            placeholder="Search roles or skills, e.g. RAG, PyTorch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div role="group" aria-label="Filter by area" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "min-h-9 shrink-0 cursor-pointer rounded-full border px-3 text-sm transition-colors pointer-coarse:min-h-11",
                  category === c.id ? "border-accent-warm-bright bg-accent-warm-bright/10 text-warm-ivory font-medium" : "border-border-medium text-text-muted hover:text-text-primary hover:bg-deep-espresso/50",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div role="radiogroup" aria-label="Target role" className="flex flex-col gap-2">
          {roles.length === 0 && <p className="rounded-card border border-dashed border-border-medium bg-bg-elevated px-4 py-5 text-sm text-text-muted">No role matches &ldquo;{query}&rdquo;. Try a skill name, or clear the search.</p>}
          {roles.map((r) => {
            const checked = r.id === selected;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => { setSelected(r.id); setError(null); }}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-card border p-4 text-left transition-all duration-200",
                  checked ? "border-accent-warm-bright bg-accent-warm-bright/10 shadow-[0_0_20px_rgba(244,154,71,0.15)]" : "border-border-medium bg-bg-elevated hover:border-accent-warm",
                )}
              >
                <span aria-hidden="true" className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", checked ? "border-accent-warm-bright bg-accent-warm-bright text-obsidian" : "border-border-medium")}>
                  {checked && <Check size={12} weight="bold" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-display font-semibold text-text-primary">{r.title}</span>
                    <span className="text-xs text-text-dim">{r.categoryLabel}</span>
                  </span>
                  <span className="mt-1 block text-sm text-text-muted">{r.description}</span>
                  {checked && (
                    <span className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs text-text-muted">Core skills:</span>
                      {r.corePrerequisites.map((p) => <Tag key={p}>{p}</Tag>)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
      <StepFooter onBack={onBack} onNext={next} saving={saving} />
    </>
  );
}
