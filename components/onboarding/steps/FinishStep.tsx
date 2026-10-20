"use client";

import React, { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { candidateNames } from "@/lib/onboarding-import-candidates";
import type { OnboardingData } from "@/lib/client/onboarding/types";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { StepFooter, StepHeader } from "../OnboardingShell";
import { EioraVisual } from "@/components/eora/EioraVisual";

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

      <div className="mt-6 flex flex-col gap-6">
        {submitting ? (
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-3xl border border-[#D4AF37]/30 bg-bg-elevated/90 backdrop-blur-md shadow-2xl text-center">
            <div className="relative mb-6">
              <EioraVisual state="extracting" size={160} interactive={false} />
            </div>
            <span className="font-mono text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
              Personalization Synthesis Active
            </span>
            <h3 className="font-editorial text-3xl sm:text-4xl font-normal text-text-primary mt-2">
              Generating your tailored intelligence dashboard…
            </h3>
            <p className="mt-2 text-sm text-text-muted max-w-md font-sans leading-relaxed">
              Eiora is pulling your confirmed projects, skills, and target objective into an active skill graph and configuring your 5 ecosystem worlds.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-2xs text-[#5A5852]">
              <span className="rounded-full bg-[#141413] text-[#D4AF37] px-3 py-1 border border-[#D4AF37]/30">
                Avasar Opportunities: Configured
              </span>
              <span className="rounded-full bg-[#141413] text-[#D4AF37] px-3 py-1 border border-[#D4AF37]/30">
                Collaborate Squads: Ready
              </span>
              <span className="rounded-full bg-[#141413] text-[#D4AF37] px-3 py-1 border border-[#D4AF37]/30">
                Adaptive Roadmap: Generated
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Stat Cards Grid: 6 Real Metrics */}
            <dl
              data-eora-id="eora-onboarding-finish"
              className="grid grid-cols-2 sm:grid-cols-3 gap-3.5"
            >
              {rows.map(([label, n, unit]) => (
                <div
                  key={label}
                  className="flex flex-col justify-between rounded-card border border-line-soft bg-bg-surface p-4 sm:p-5 shadow-card transition-all hover:border-champagne/30"
                >
                  <dt className="text-xs font-medium text-text-muted">{label}</dt>
                  <dd className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-semibold text-text-primary tabular">
                      {n}
                    </span>
                    <span className="text-xs font-mono text-text-dim">{unit}</span>
                  </dd>
                </div>
              ))}
            </dl>

            {/* Target Role & Roadmap Callout */}
            {data.targetRole && (
              <div className="flex items-center gap-3.5 rounded-card border border-champagne/30 bg-bg-surface p-4 sm:p-5 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-champagne/15 text-champagne border border-champagne/30 font-display font-semibold text-base shrink-0">
                  🎯
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-text-muted font-mono uppercase tracking-wider">Target Objective</p>
                  <p className="text-sm sm:text-base font-display font-semibold text-text-primary truncate">
                    {data.targetRole}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Your workspace dashboard will automatically tailor projects and roadmaps to bridge any identified skill gaps.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <Banner
            kind="danger"
            title="Your workspace wasn't created"
            action={<Button size="sm" variant="secondary" onClick={() => void go()} loading={submitting}>Try again</Button>}
          >
            {error}
          </Banner>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        saving={false}
        secondary={
          <Button
            variant="primary"
            onClick={() => void go()}
            loading={submitting}
            loadingLabel="Creating your workspace…"
            className="flex-1 sm:flex-none sm:min-w-56 shadow-lg shadow-champagne/10 text-sm font-semibold"
          >
            Open my workspace <ArrowRight size={18} aria-hidden="true" />
          </Button>
        }
      />
    </>
  );
}
