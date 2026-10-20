"use client";

import React from "react";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { useFootprintConnectors, type DiscoveredCandidates } from "@/lib/client/onboarding/use-footprint-connectors";
import { ConnectorList } from "@/components/connections/ConnectorList";
import { LinkedInConnect } from "@/components/connections/LinkedInConnect";
import { Button } from "@/components/ui/Button";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { StepFooter, StepHeader } from "../OnboardingShell";

export function AccountsStep({ profiles, discovered, saving, guide, onProfilesChange, onCandidates, onBack, onContinue }: {
  profiles: Partial<Record<string, string>>;
  discovered: Partial<Record<string, string>>;
  saving: boolean;
  guide: React.ReactNode;
  onProfilesChange: (p: Partial<Record<string, string>>) => void;
  onCandidates: (c: DiscoveredCandidates, provider: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const api = useFootprintConnectors({ initialProfiles: profiles, discoveredResumeProfiles: discovered, onProfilesChange, onCandidatesDiscovered: onCandidates });
  const linkedCount = Object.values(api.profiles).filter(Boolean).length;
  useEoraStepEvents({ onNext: onContinue, onBack });

  return (
    <>
      <StepHeader
        title="Connect the accounts that show your work"
        description="Every account is optional. We read public data only, and everything we find waits for your review on the next screens."
        guide={guide}
      />
      <div data-eora-id="eora-digital-footprints" className="mt-6 flex flex-col gap-6">
        {linkedCount > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-card border border-champagne/30 bg-bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-champagne/15 text-champagne border border-champagne/30 font-mono font-semibold text-sm">
                {linkedCount}
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {linkedCount} {linkedCount === 1 ? "account" : "accounts"} ready to sync
                </p>
                <p className="text-xs text-text-muted">
                  Importing reads public repositories, papers, and activity to corroborate skills.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={<ArrowsClockwise size={16} aria-hidden="true" />}
              loading={Boolean(api.busy)}
              loadingLabel="Importing…"
              onClick={() => void api.importAllLinked()}
              className="shrink-0"
            >
              Import from all linked
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-card border border-line-soft bg-bg-surface/50 px-4 py-3 text-xs text-text-muted">
            <span className="h-2 w-2 rounded-full bg-soft-amber shrink-0" aria-hidden="true" />
            <p>
              <strong className="text-text-primary font-medium">Read-only & Private:</strong> We only inspect public activity (repositories, commits, publications). No write permissions or passwords are ever accessed.
            </p>
          </div>
        )}
        <ConnectorList api={api} returnTo="/onboarding" />
        <LinkedInConnect />
      </div>
      <StepFooter onBack={onBack} onNext={onContinue} saving={saving} nextLabel={linkedCount ? "Continue" : "Skip for now"} />
    </>
  );
}
