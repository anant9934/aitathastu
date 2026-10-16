"use client";

import React, { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { candidateNames } from "@/lib/onboarding-import-candidates";
import type { OnboardingData } from "@/lib/client/onboarding/types";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { StepFooter, StepHeader } from "../OnboardingShell";

/** The last step: what goes onto the profile, then one honest attempt to save it all. */
export function FinishStep({ data, guide, submitting, onBack, onFinish }: {
  data: OnboardingData;
  guide: React.ReactNode;
  submitting: boolean;
  onBack: () => void;
  onFinish: () => Promise<{ ok: boolean; message?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const confirmed = <T extends { status?: string }>(l: T[]) => l.filter((e) => e.status === "confirmed").length;
  const rows: [string, number, string][] = [
    ["Skills", candidateNames(data.skills).length, "confirmed"],
    ["Projects", confirmed(data.projects), "confirmed"],
    ["Education", confirmed(data.education), "entries"],
    ["Experience", confirmed(data.experiences), "roles"],
    ["Achievements", confirmed(data.achievements), "items"],
    ["Linked accounts", Object.values(data.profiles).filter(Boolean).length, "sources"],
  ];
  const go = async () => {
    setError(null);
    const r = await onFinish();
    if (!r.ok) setError(r.message ?? "Your workspace couldn't be created. Nothing was lost; try again.");
  };
  useEoraStepEvents({ onNext: () => void go(), onBack, enabled: !submitting });

  return (
    <>
      <StepHeader
        title="Ready to build your workspace"
        description="This is what goes onto your profile. You can edit any of it later, and your edits always win over a source."
        guide={guide}
      />
      <dl data-eora-id="eora-onboarding-finish" className="mt-6 grid grid-cols-2 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-3 [&>div]:bg-surface" style={{ gap: 1 }}>
        {rows.map(([label, n, unit]) => (
          <div key={label} className="px-4 py-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-semibold tabular">{n}</span>
              <span className="text-xs text-muted">{unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      {data.targetRole && (
        <p className="mt-4 text-sm text-muted">Your dashboard will measure progress toward <span className="text-ink">{data.targetRole}</span>.</p>
      )}
      {error && (
        <Banner kind="danger" className="mt-4" title="Your workspace wasn't created" action={<Button size="sm" variant="secondary" onClick={() => void go()} loading={submitting}>Try again</Button>}>
          {error}
        </Banner>
      )}
      <StepFooter onBack={onBack} saving={false} secondary={
        <Button variant="primary" onClick={() => void go()} loading={submitting} loadingLabel="Creating your workspace…" className="flex-1 sm:flex-none sm:min-w-48">
          Open my workspace <ArrowRight size={18} aria-hidden="true" />
        </Button>
      } />
    </>
  );
}
