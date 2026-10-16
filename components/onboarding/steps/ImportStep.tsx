"use client";

import React from "react";
import { SourceProgress } from "@/components/connections/SourceProgress";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { StepFooter, StepHeader } from "../OnboardingShell";

/**
 * Live import progress (Tasks 2.1.3, 2.1.10). Moves to review on its own once
 * the CV and GitHub settle (or after 8 s); slower sources keep importing and
 * appear on the review screens.
 */
export function ImportStep({ saving, guide, onBack, onContinue }: { saving: boolean; guide: React.ReactNode; onBack: () => void; onContinue: () => void }) {
  useEoraStepEvents({ onNext: onContinue, onBack });
  return (
    <>
      <StepHeader
        title="Importing what we found"
        description="Nothing is added to your profile until you confirm it on the next screens. Slow sources keep going in the background."
        guide={guide}
        eoraId="eora-ai-analysis"
      />
      <div className="mt-6 rounded-[var(--radius-panel)] border border-line bg-surface p-4 sm:p-5">
        <SourceProgress variant="full" onReadyToReview={() => onContinue()} />
      </div>
      <StepFooter onBack={onBack} onNext={onContinue} saving={saving} nextLabel="Review what we found" />
    </>
  );
}
