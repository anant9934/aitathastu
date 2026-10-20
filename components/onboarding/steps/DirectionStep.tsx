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

export function DirectionStep({
  initialRole,
  saving,
  guide,
  onBack,
  onContinue,
}: {
  initialRole: string;
  saving: boolean;
  guide: React.ReactNode;
  onBack: () => void;
  onContinue: (role: AimlRoleDefinition) => void;
}) {
  const [selected, setSelected] = useState<string>(() =>
    AIML_ROLE_CATALOG.find(
      (r) => r.title.toLowerCase() === initialRole.toLowerCase() || r.id === initialRole
    )?.id ?? ""
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const roles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...AIML_ROLE_CATALOG]
      .filter(
        (r) =>
          (category === "all" || r.category === category) &&
          (!q ||
            r.title.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.corePrerequisites.some((p) => p.toLowerCase().includes(q)))
      )
      .sort((a, b) => Number(b.popular) - Number(a.popular) || a.sortOrder - b.sortOrder);
  }, [query, category]);

  const cardRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const handleCardSelect = (rId: string) => {
    setSelected(rId);
    setError(null);
    cardRefs.current[rId]?.focus();
  };

  const handleCardKeyDown = (e: React.KeyboardEvent, index: number, rId: string) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleCardSelect(rId);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      if (roles.length > 0) {
        const nextIndex = (index + 1) % roles.length;
        handleCardSelect(roles[nextIndex].id);
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (roles.length > 0) {
        const prevIndex = (index - 1 + roles.length) % roles.length;
        handleCardSelect(roles[prevIndex].id);
      }
    }
  };

  const role = AIML_ROLE_CATALOG.find((r) => r.id === selected);
  const next = () => {
    if (!role) {
      setError("Choose the role you're aiming for. Pick \"Still exploring\" if you're not sure yet.");
      return;
    }
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

      <div data-eora-id="eora-ai-direction" className="mt-6 flex flex-col gap-5">
        {/* Search and Category Filter Toolbar */}
        <div className="flex flex-col gap-3 rounded-card border border-border-medium bg-bg-elevated p-3.5 sm:p-4 shadow-card md:flex-row md:items-center md:justify-between">
          <div className="relative min-w-0 flex-1 max-w-md">
            <TextField
              label="Search roles"
              labelHidden
              type="search"
              placeholder="Search roles or skills, e.g. RAG, PyTorch, MLOps"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div
            role="group"
            aria-label="Filter by category"
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]"
          >
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "min-h-8 shrink-0 cursor-pointer rounded-full border px-3 text-xs font-medium transition-all pointer-coarse:min-h-10",
                  category === c.id
                    ? "border-accent-warm-bright bg-accent-warm-bright/15 text-text-primary font-semibold shadow-sm"
                    : "border-border-medium text-text-muted hover:border-accent-warm hover:text-text-primary hover:bg-bg-surface",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Adaptive 3-to-4 Column Grid */}
        <div
          role="radiogroup"
          aria-label="Target role"
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4"
        >
          {roles.length === 0 && (
            <div className="col-span-full rounded-card border border-dashed border-border-medium bg-bg-elevated px-5 py-8 text-center text-sm text-text-muted">
              No role matches &ldquo;{query}&rdquo;. Try a skill name like Python or PyTorch, or clear the search.
            </div>
          )}

          {roles.map((r, i) => {
            const checked = r.id === selected;
            return (
              <button
                type="button"
                key={r.id}
                ref={(el) => { cardRefs.current[r.id] = el; }}
                role="radio"
                tabIndex={checked || (!selected && i === 0) ? 0 : -1}
                aria-checked={checked}
                onClick={() => handleCardSelect(r.id)}
                onKeyDown={(e) => handleCardKeyDown(e, i, r.id)}
                className={cn(
                  "group relative flex cursor-pointer flex-col justify-between rounded-card border p-4 sm:p-5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent-warm focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary shadow-card min-h-[160px]",
                  checked
                    ? "border-accent-warm-bright bg-accent-warm-bright/10 text-text-primary shadow-[0_0_24px_rgba(196,138,90,0.15)] ring-1 ring-accent-warm-bright"
                    : "border-border-medium bg-bg-elevated text-text-primary hover:border-accent-warm hover:bg-bg-elevated/80",
                )}
              >
                <div className="w-full">
                  <div className="flex items-start justify-between gap-2.5">
                    <span className="font-display text-base font-bold text-text-primary group-hover:text-accent-warm-bright transition-colors">
                      {r.title}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-all",
                        checked
                          ? "border-accent-warm-bright bg-accent-warm-bright text-espresso"
                          : "border-border-medium bg-bg-primary",
                      )}
                    >
                      {checked && <Check size={12} weight="bold" />}
                    </span>
                  </div>

                  <span className="mt-1 inline-block text-2xs font-semibold uppercase tracking-wider text-text-dim">
                    {r.categoryLabel}
                  </span>

                  <p className="mt-2 text-xs text-text-muted leading-relaxed line-clamp-3">
                    {r.description}
                  </p>
                </div>

                <div className="mt-4 w-full border-t border-border-medium/60 pt-3">
                  {checked ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-2xs font-semibold text-accent-warm uppercase tracking-wider">
                        Core skills:
                      </span>
                      {r.corePrerequisites.map((p) => (
                        <Tag key={p}>{p}</Tag>
                      ))}
                    </div>
                  ) : (
                    <span className="text-2xs text-text-dim">
                      {r.corePrerequisites.length} core prerequisites
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>

      <StepFooter onBack={onBack} onNext={next} saving={saving} />
    </>
  );
}
