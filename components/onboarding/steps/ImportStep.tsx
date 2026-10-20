"use client";

import React from "react";
import { SourceProgress } from "@/components/connections/SourceProgress";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { StepFooter, StepHeader } from "../OnboardingShell";
import { GeminiThinkingStream } from "../GeminiThinkingStream";

/**
 * Live import progress (Tasks 2.1.3, 2.1.10). Moves to review on its own once
 * the CV and GitHub settle (or after 8 s); slower sources keep importing and
 * appear on the review screens.
 */
export function ImportStep({ saving, guide, onBack, onContinue, autoAdvance = true }: { saving: boolean; guide: React.ReactNode; onBack: () => void; onContinue: () => void; autoAdvance?: boolean }) {
  useEoraStepEvents({ onNext: onContinue, onBack });
  return (
    <>
      <StepHeader
        title="Importing what we found"
        description="Nothing is added to your profile until you confirm it on the next screens. Slow sources keep going in the background."
        guide={guide}
        eoraId="eora-ai-analysis"
      />
      <div className="mt-6 flex flex-col gap-4">
        <div className="rounded-card border border-line-soft bg-bg-surface p-5 sm:p-6 shadow-card">
          <SourceProgress variant="full" onReadyToReview={autoAdvance ? () => onContinue() : undefined} />
        </div>

        <GeminiThinkingStream />

        <div className="flex items-center gap-2.5 rounded-card border border-line-soft bg-bg-surface/40 px-4 py-3 text-xs text-text-muted">
          <span className="flex h-2 w-2 rounded-full bg-verified shrink-0 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
          <p>
            {autoAdvance
              ? "When your CV and GitHub finish, you'll move to the review step automatically. Slower sources keep going in the background."
              : "Sources keep importing in the background. Continue to the review step when you're ready."}
          </p>
        </div>
      </div>
      <StepFooter onBack={onBack} onNext={onContinue} saving={saving} nextLabel="Review what we found" />
    </>
  );
}
