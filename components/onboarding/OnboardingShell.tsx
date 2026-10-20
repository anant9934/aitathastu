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

export type OnboardingShellWidth =
  | "default"
  | "wide"
  | "focused"
  | "balanced"
  | "workspace"
  | "review";

const WIDTH_CLASSES: Record<OnboardingShellWidth, string> = {
  focused: "max-w-3xl",
  default: "max-w-5xl",
  balanced: "max-w-5xl",
  workspace: "max-w-6xl xl:max-w-7xl",
  wide: "max-w-6xl xl:max-w-7xl",
  review: "max-w-7xl 2xl:max-w-[1400px]",
};

interface StageGroup {
  name: string;
  screens: number[];
}

const STUDENT_STAGES: StageGroup[] = [
  { name: "Direction & Role", screens: [3, 3.2, 3.5] },
  { name: "CV & Discovery", screens: [5, 5.5] },
  { name: "Profile & Review", screens: [4, 6, 7, 8] },
  { name: "Skills & Workspace", screens: [9, 10, 11] },
];

const FACULTY_STAGES: StageGroup[] = [
  { name: "Role & Focus", screens: [3, 3.5] },
  { name: "Institutional Setup", screens: [3.7] },
];

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

  const stages = role === "faculty" ? FACULTY_STAGES : STUDENT_STAGES;
  const stageIndex = stages.findIndex((st) => st.screens.includes(screen));
  const currentStage = stageIndex >= 0 ? stages[stageIndex] : null;
  const stageNumber = stageIndex + 1;
  const totalStages = stages.length;

  return (
    <nav
      aria-label={`Onboarding progress: Stage ${stageNumber} of ${totalStages}, Step ${pos.number} of ${pos.total}`}
      className="w-full"
    >
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {currentStage && (
            <span className="inline-flex items-center rounded-full bg-accent-warm/15 px-2.5 py-0.5 text-2xs font-semibold text-accent-warm border border-accent-warm/30 uppercase tracking-wider">
              Stage {stageNumber} of {totalStages}: {currentStage.name}
            </span>
          )}
          <span className="font-medium text-text-primary text-sm">
            Step {pos.number} of {pos.total}
            <span className="mx-2 text-text-dim" aria-hidden="true">·</span>
            <span className="text-text-primary">{pos.step.shortLabel}</span>
          </span>
        </div>
        <span className="hidden font-mono text-xs text-text-dim sm:inline">
          {steps.filter((s, i) => i + 1 < pos.number || done.has(s.screen)).length} of {pos.total} completed
        </span>
      </div>
      <ol className="flex gap-1.5" aria-hidden="true">
        {steps.map((s, i) => {
          const state = i + 1 < pos.number || done.has(s.screen) ? "done" : i + 1 === pos.number ? "current" : "todo";
          return (
            <li
              key={s.id}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                state === "done"
                  ? "bg-gradient-to-r from-champagne to-soft-amber shadow-[0_0_8px_rgba(196,138,90,0.5)]"
                  : state === "current"
                  ? "bg-accent-warm shadow-[0_0_6px_rgba(196,138,90,0.4)]"
                  : "bg-border-subtle",
              )}
            />
          );
        })}
      </ol>
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
  width?: OnboardingShellWidth;
  headerExtra?: React.ReactNode;
}) {
  const widthClass = WIDTH_CLASSES[width] || WIDTH_CLASSES.default;

  return (
    <div className="flex min-h-dvh flex-col bg-bg-primary text-text-primary">
      {/* Accessible Skip Navigation Link */}
      <a
        href="#onboarding-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent-warm focus:px-4 focus:py-2 focus:text-espresso focus:font-bold focus:shadow-xl focus:outline-none"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-20 border-b border-border-medium bg-bg-primary/95 backdrop-blur-md supports-[backdrop-filter]:bg-bg-primary/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl 2xl:max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Logo href="/" />
          <div className="flex items-center gap-3">
            <SaveIndicator save={save} />
            {headerExtra}
            <ThemeToggle compact />
          </div>
        </div>
      </header>

      <main id="onboarding-main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <div className={cn("mx-auto flex w-full flex-1 flex-col px-4 pt-5 pb-20 sm:px-6 sm:pt-8 sm:pb-12 lg:px-8", widthClass)}>
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

/** Heading block for a step: responsive desktop side-by-side EORA placement. */
export function StepHeader({
  title,
  description,
  guide,
  eoraId,
  badge,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  guide?: React.ReactNode;
  eoraId?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-col gap-4 sm:mt-7" data-eora-id={eoraId}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 flex-1">
          {badge && <div className="mb-2">{badge}</div>}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl lg:text-3.5xl">
                {title}
              </h1>
              {description && (
                <p className="mt-2 max-w-[68ch] text-sm text-text-muted leading-relaxed sm:text-base">
                  {description}
                </p>
              )}
            </div>
            {actions && <div className="shrink-0 sm:pt-1">{actions}</div>}
          </div>
        </div>
        {guide && (
          <div className="w-full lg:w-80 xl:w-96 lg:shrink-0">
            {guide}
          </div>
        )}
      </div>
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
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border-medium bg-bg-primary/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:mt-12 sm:border-t sm:border-border-subtle sm:bg-transparent sm:px-0 sm:py-5 sm:backdrop-blur-none">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button
            variant="ghost"
            onClick={onBack}
            icon={<ArrowLeft size={18} aria-hidden="true" />}
            disabled={saving}
          >
            <span>{backLabel}</span>
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
              className="flex-1 sm:flex-none sm:min-w-40 font-semibold"
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
