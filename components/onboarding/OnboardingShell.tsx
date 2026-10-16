"use client";

/**
 * The frame every onboarding step sits in (Task 2.1 rebuilt on Direction B).
 * Mobile-first: one column, a compact "Step n of N" with a bar, and a footer
 * that sticks to the bottom on phones. The step number comes only from
 * lib/onboarding-step-registry (P4-13). A failed save keeps the step in place
 * and says exactly what happened, with Retry (P4-20).
 */
import React from "react";
import { ArrowLeft, ArrowRight, Check, CloudCheck, CloudSlash, CloudArrowUp } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { onboardingSteps, stepForScreen, type OnboardingRole } from "@/lib/onboarding-step-registry";
import type { SaveState } from "@/lib/client/onboarding/use-onboarding-flow";
import { cn } from "@/lib/client/cn";

export function SaveIndicator({ save }: { save: SaveState }) {
  if (save.saving) return <span className="inline-flex items-center gap-1.5 text-xs text-text-muted" role="status"><CloudArrowUp size={16} aria-hidden="true" />Saving…</span>;
  if (save.error) return <span className="inline-flex items-center gap-1.5 text-xs text-danger"><CloudSlash size={16} aria-hidden="true" />Not saved</span>;
  if (save.lastSavedAt) return <span className="inline-flex items-center gap-1.5 text-xs text-text-muted"><CloudCheck size={16} aria-hidden="true" />Saved</span>;
  return null;
}

export function Stepper({ screen, role, done }: { screen: number; role: OnboardingRole; done: Set<number> }) {
  const steps = onboardingSteps(role);
  const pos = stepForScreen(screen, role);
  if (!pos) return null;
  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="flex gap-1.5" aria-hidden="true">
        {steps.map((s, i) => {
          const state = i + 1 < pos.number || done.has(s.screen) ? "done" : i + 1 === pos.number ? "current" : "todo";
          return (
            <li
              key={s.id}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                state === "done"
                  ? "bg-gradient-to-r from-champagne to-soft-amber shadow-[0_0_8px_rgba(244,154,71,0.5)]"
                  : state === "current"
                  ? "bg-accent-warm shadow-[0_0_6px_rgba(201,164,109,0.4)]"
                  : "bg-border-subtle",
              )}
            />
          );
        })}
      </ol>
      <p className="mt-2.5 flex items-baseline justify-between gap-3 text-xs text-text-muted">
        <span>
          <span className="font-bold text-warm-ivory">Step {pos.number} of {pos.total}</span>
          <span className="mx-2 text-text-dim" aria-hidden="true">·</span>
          <span className="font-medium text-text-primary">{pos.step.shortLabel}</span>
        </span>
        <span className="hidden font-mono text-text-dim sm:inline">
          {steps.filter((s, i) => i + 1 < pos.number || done.has(s.screen)).length} of {pos.total} completed
        </span>
      </p>
    </nav>
  );
}

export function OnboardingShell({
  screen,
  role,
  done,
  save,
  onRetrySave,
  children,
  width = "default",
  headerExtra,
}: {
  screen: number;
  role: OnboardingRole;
  done: Set<number>;
  save: SaveState;
  onRetrySave: () => void;
  children: React.ReactNode;
  width?: "default" | "wide";
  headerExtra?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-primary text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-medium bg-bg-primary/95 backdrop-blur-md supports-[backdrop-filter]:bg-bg-primary/80">
        <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-3 px-4 sm:px-6">
          <Logo href="/" />
          <div className="flex items-center gap-3">
            <SaveIndicator save={save} />
            {headerExtra}
            <ThemeToggle compact />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <div className={cn("mx-auto flex w-full flex-1 flex-col px-4 pt-5 sm:px-6 sm:pt-8", width === "wide" ? "max-w-[1120px]" : "max-w-[760px]")}>
          <Stepper screen={screen} role={role} done={done} />
          {save.error && (
            <Banner
              kind="danger"
              className="mt-4"
              title={save.error.kind === "rate_limited" ? "Saving is paused for a moment" : "Your last change wasn't saved"}
              action={<Button size="sm" variant="secondary" onClick={onRetrySave} loading={save.saving} loadingLabel="Retrying…">Retry now</Button>}
            >
              {save.message}
            </Banner>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

/** Heading block for a step: title, one line of purpose, and EORA's guide under it. */
export function StepHeader({ title, description, guide, eoraId }: { title: React.ReactNode; description?: React.ReactNode; guide?: React.ReactNode; eoraId?: string }) {
  return (
    <div className="mt-6 flex flex-col gap-3 sm:mt-8" data-eora-id={eoraId}>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-warm-ivory sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-[62ch] text-base text-text-muted leading-relaxed">{description}</p>}
      </div>
      {guide}
    </div>
  );
}

/**
 * Back / Next. On phones it sticks to the bottom edge; Next shows its saving
 * state and the step only moves once the save has landed (P4-20).
 */
export function StepFooter({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  saving,
  secondary,
  backLabel = "Back",
  nextId,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  saving?: boolean;
  secondary?: React.ReactNode;
  backLabel?: string;
  nextId?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-border-medium bg-bg-primary/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:mt-10 sm:border-t sm:border-border-subtle sm:bg-transparent sm:px-0 sm:py-5 sm:backdrop-blur-none">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" onClick={onBack} icon={<ArrowLeft size={18} aria-hidden="true" />} disabled={saving}>
            <span className="max-sm:sr-only">{backLabel}</span>
          </Button>
        )}
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
          {secondary}
          {onNext && (
            <Button
              id={nextId}
              variant="primary"
              onClick={onNext}
              disabled={nextDisabled}
              loading={saving}
              loadingLabel="Saving…"
              className="flex-1 sm:flex-none sm:min-w-36"
            >
              {nextLabel}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DoneMark() {
  return <Check size={16} weight="bold" aria-hidden="true" />;
}
