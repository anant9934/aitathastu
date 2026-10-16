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
        {linkedCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border-medium bg-bg-elevated px-4 py-3 shadow-card">
            <p className="text-sm text-text-muted"><span className="font-mono text-warm-ivory tabular">{linkedCount}</span> linked. Importing reads each one now.</p>
            <Button size="sm" variant="secondary" icon={<ArrowsClockwise size={16} aria-hidden="true" />} loading={Boolean(api.busy)} loadingLabel="Importing…" onClick={() => void api.importAllLinked()}>
              Import from all linked
            </Button>
          </div>
        )}
        <ConnectorList api={api} returnTo="/onboarding" />
        <LinkedInConnect />
      </div>
      <StepFooter onBack={onBack} onNext={onContinue} saving={saving} nextLabel={linkedCount ? "Continue" : "Skip for now"} />
    </>
  );
}
