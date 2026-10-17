"use client";

/**
 * Onboarding orchestrator: owns the flow state (lib/client/onboarding) and
 * renders one step at a time inside the shell. Every forward move goes through
 * flow.commit, which saves first and moves only on success (P4-20).
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { useOnboardingFlow } from "@/lib/client/onboarding/use-onboarding-flow";
import { useResumeIngestion } from "@/lib/client/onboarding/use-resume-ingestion";
import { applyResumeReview } from "@/lib/client/onboarding/apply-resume";
import { applyDiscoveredCandidates } from "@/lib/client/onboarding/apply-candidates";
import type { DiscoveredCandidates } from "@/lib/client/onboarding/use-footprint-connectors";
import type { AimlRoleDefinition } from "@/lib/domain/aiml-role-taxonomy";
import { screenNumberToOnboardingStep } from "@/lib/eora/context";
import { WELCOME_SCREEN } from "@/lib/onboarding-step-registry";
import { useEoraSafe } from "@/lib/client/eora/provider";
import { EoraGuideLine } from "@/components/eora/EoraGuideLine";
import { openEoraChat } from "@/components/eora/EoraCompanion";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Skeleton, LoadingRegion } from "@/components/ui/Skeleton";
import { Logo } from "@/components/ui/Logo";
import { OnboardingShell, type OnboardingShellWidth } from "./OnboardingShell";
import { WelcomeStep } from "./steps/WelcomeStep";
import { RoleStep } from "./steps/RoleStep";
import { DirectionStep } from "./steps/DirectionStep";
import { PrioritiesStep } from "./steps/PrioritiesStep";
import { CvStep } from "./steps/CvStep";
import { FootprintIntelligenceStep } from "./steps/FootprintIntelligenceStep";
import { DetailsStep } from "./steps/DetailsStep";
import { AccountsStep } from "./steps/AccountsStep";
import { ImportStep } from "./steps/ImportStep";
import { ReviewStep } from "./steps/ReviewStep";
import { SkillsStep } from "./steps/SkillsStep";
import { ProjectsStep } from "./steps/ProjectsStep";
import { FinishStep } from "./steps/FinishStep";
import { FacultyStep } from "./steps/FacultyStep";

export function OnboardingApp() {
  const flow = useOnboardingFlow();
  const eora = useEoraSafe();
  const { screen, data, save } = flow;
  const role = data.role === "faculty" ? "faculty" : "student";

  // EORA follows the step (one registry for numbers, P4-13).
  const setStep = eora?.setOnboardingStep;
  useEffect(() => { if (flow.load === "ready") setStep?.(screenNumberToOnboardingStep(screen)); }, [screen, flow.load, setStep]);
  useEffect(() => () => setStep?.("none"), [setStep]);

  // A new step starts at the top, and focus moves to the main region for screen readers.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [screen]);

  const saving = save.saving;
  const guide = <EoraGuideLine onAsk={openEoraChat} />;

  // EORA celebrates each milestone once, however many imports or saves follow.
  const githubSignalFiredRef = useRef(false);
  const onCandidates = useCallback((c: DiscoveredCandidates, provider: string) => {
    const { next, patch, newProjects } = applyDiscoveredCandidates(flow.dataRef.current, c, provider);
    flow.setData(next);
    flow.autosave(patch);
    if (provider === "github" && newProjects > 0 && !githubSignalFiredRef.current) {
      githubSignalFiredRef.current = true;
      eora?.signalSuccess("projects_discovered");
    }
  }, [flow, eora]);

  if (flow.load === "loading") {
    return (
      <div className="min-h-dvh bg-canvas">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center px-4 sm:px-6"><Logo /></div>
        <LoadingRegion label="Loading your saved progress" className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 pt-8 sm:px-6">
          <Skeleton className="h-1" />
          <Skeleton className="mt-6 h-9 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="mt-4 h-40" />
        </LoadingRegion>
      </div>
    );
  }

  if (flow.load === "error") {
    return (
      <div className="min-h-dvh bg-canvas">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center px-4 sm:px-6"><Logo /></div>
        <div className="mx-auto max-w-[640px] px-4 pt-10 sm:px-6">
          <Banner
            kind="danger"
            title="Your saved progress didn't load"
            action={<Button variant="secondary" size="sm" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={flow.retryLoad}>Try again</Button>}
          >
            Nothing will be saved until it loads, so your earlier answers can&apos;t be overwritten. Check your connection and try again.
          </Banner>
        </div>
      </div>
    );
  }

  if (screen === WELCOME_SCREEN) {
    return (
      <OnboardingShell screen={screen} role={role} done={new Set()} save={save} onRetrySave={() => void flow.retrySave()} width="balanced">
        <WelcomeStep
          initialName={data.name}
          saving={saving}
          onSkip={() => void flow.commit({}, 3)}
          onContinue={(name) => {
            flow.setData((d) => ({ ...d, name, academic: { ...d.academic, fullName: d.academic.fullName || name } }));
            void flow.commit({ name }, 3);
          }}
        />
      </OnboardingShell>
    );
  }

  const shell = (children: React.ReactNode, width: OnboardingShellWidth = "balanced") => (
    <OnboardingShell screen={screen} role={role} done={flow.completedScreens()} save={save} onRetrySave={() => void flow.retrySave()} width={width}>
      {children}
    </OnboardingShell>
  );

  switch (screen) {
    case 3:
      return shell(
        <RoleStep
          initialRole={data.role}
          saving={saving}
          guide={guide}
          onBack={() => flow.goBack(WELCOME_SCREEN)}
          onContinue={(r) => {
            const changed = r !== data.role;
            flow.setData((d) => ({ ...d, role: r, ...(changed ? { priorities: [], primaryPriority: undefined } : {}) }));
            void flow.commit({ role: r, ...(changed ? { priorities: [], primaryPriority: null } : {}) }, r === "faculty" ? 3.5 : 3.2);
          }}
        />,
        "balanced",
      );
    case 3.2:
      return shell(
        <DirectionStep
          initialRole={data.targetRoleId || data.targetRole}
          saving={saving}
          guide={guide}
          onBack={() => flow.goBack(3)}
          onContinue={(r: AimlRoleDefinition) => {
            flow.setData((d) => ({ ...d, targetRole: r.title, targetRoleId: r.id }));
            void flow.commit({ targetRole: r.title, targetRoleId: r.id }, 3.5);
          }}
        />,
        "workspace",
      );
    case 3.5:
      return shell(
        <PrioritiesStep
          role={role}
          initial={data.priorities}
          saving={saving}
          guide={guide}
          onBack={() => flow.goBack(role === "faculty" ? 3 : 3.2)}
          onContinue={(ranked) => {
            flow.setData((d) => ({ ...d, priorities: ranked, primaryPriority: ranked[0] }));
            void flow.commit({ priorities: ranked, primaryPriority: ranked[0] }, role === "faculty" ? 3.7 : 5);
          }}
        />,
        "balanced",
      );
    case 3.7:
      return shell(
        <FacultyStep
          initial={{ name: data.name || data.academic.fullName, institution: data.academic.institution, department: data.academic.department, email: data.academic.email, password: "" }}
          isAuthenticated={flow.isAuthenticated}
          submitting={flow.submitting}
          guide={guide}
          onBack={() => flow.goBack(3.5)}
          onSubmit={async (d) => {
            const r = await flow.finishFaculty(d);
            if (r.ok) window.location.assign("/faculty");
            return r;
          }}
        />,
        "balanced",
      );
    case 5:
      return shell(<CvStepContainer flow={flow} guide={guide} />, "balanced");
    case 5.5:
      return shell(<FootprintIntelligenceStep flow={flow} guide={guide} onCandidates={onCandidates} />, "workspace");
    case 4:
      return shell(
        <DetailsStep
          initial={data.academic}
          isAuthenticated={flow.isAuthenticated}
          fromCv={data.extractedResumeFields}
          saving={saving}
          guide={guide}
          onBack={() => flow.goBack(flow.prevBefore(4))}
          onContinue={async (a) => {
            // Bind first, while the old institution can still find its education entry (P4-16).
            flow.setInstitution(a.institution);
            const prev = flow.dataRef.current;
            const bound = { ...prev, academic: { ...prev.academic, ...a }, name: a.fullName };
            flow.setData(bound);
            const next = flow.nextAfter(4, bound);
            const ok = await flow.commit({
              name: a.fullName, degree: a.degree, specialization: a.department, institution: a.institution,
              year: a.currentYear, expectedGraduationYear: a.expectedGraduationYear,
              ...(!flow.isAuthenticated && a.email && a.password ? { email: a.email, password: a.password } : {}),
            }, next);
            if (ok && !flow.isAuthenticated && a.email && a.password) flow.setIsAuthenticated(true);
          }}
        />,
        "balanced",
      );
    case 6:
      return shell(
        <AccountsStep
          profiles={data.profiles}
          discovered={data.discoveredResumeProfiles}
          saving={saving}
          guide={guide}
          onProfilesChange={(p) => { flow.setData((d) => ({ ...d, profiles: p })); flow.autosave({ profiles: p }); }}
          onCandidates={onCandidates}
          onBack={() => flow.goBack(flow.prevBefore(6))}
          onContinue={() => void flow.commit({ profiles: flow.dataRef.current.profiles }, flow.nextAfter(6))}
        />,
        "balanced",
      );
    case 7:
      return shell(<ImportStep saving={saving} guide={guide} onBack={() => flow.goBack(flow.prevBefore(7))} onContinue={() => void flow.commit({}, flow.nextAfter(7))} />, "balanced");
    case 8:
      return shell(<ReviewStep flow={flow} guide={guide} onBack={() => flow.goBack(flow.prevBefore(8))} onContinue={() => void flow.commit({}, flow.nextAfter(8))} />, "review");
    case 9:
      return shell(<SkillsStep data={data} saving={saving} guide={guide} onBack={() => flow.goBack(flow.prevBefore(9))} onContinue={() => void flow.commit({}, flow.nextAfter(9))} />, "workspace");
    case 10:
      return shell(
        <ProjectsStep
          projects={data.projects}
          saving={saving}
          guide={guide}
          onChange={(next) => { flow.setData((d) => ({ ...d, projects: next })); flow.autosave({ projects: next }); }}
          onChangeSoon={(next) => { flow.setData((d) => ({ ...d, projects: next })); flow.autosaveSoon({ projects: next }); }}
          onBack={() => flow.goBack(flow.prevBefore(10))}
          onContinue={() => void flow.commit({ projects: flow.dataRef.current.projects }, 11)}
        />,
        "workspace",
      );
    case 11:
    default:
      return shell(
        <FinishStep
          data={data}
          guide={guide}
          submitting={flow.submitting}
          onBack={() => flow.goBack(flow.prevBefore(11))}
          onFinish={async () => {
            const r = await flow.finish();
            if (r.ok) {
              eora?.signalSuccess("onboarding_complete", data.name || data.academic.fullName);
              window.location.assign("/student");
            }
            return r;
          }}
        />,
        "balanced",
      );
  }
}

function CvStepContainer({ flow, guide }: { flow: ReturnType<typeof useOnboardingFlow>; guide: React.ReactNode }) {
  const eora = useEoraSafe();
  const speak = eora?.speak;
  const resumeSignalFiredRef = useRef(false);
  const cv = useResumeIngestion({
    initialFileName: flow.data.resumeFileName,
    initialDocumentId: flow.data.pendingResumeDocumentId,
    ensureSession: flow.ensureSession,
    onDocumentStored: (documentId, fileName) => {
      flow.setData((d) => ({ ...d, pendingResumeDocumentId: documentId }));
      flow.autosave({ resumeDocumentId: documentId, resumeFileName: fileName });
    },
    onExtractionReady: () => eora?.signalSuccess("extraction_completed"),
    onSpeak: speak ? (text) => speak(text) : undefined,
  });

  return (
    <CvStep
      cv={cv}
      saving={flow.save.saving}
      guide={guide}
      onBack={() => flow.goBack(3.5)}
      onSaveReview={() => cv.saveReview(async (fileName, claims, extra) => {
        const { next, patch } = applyResumeReview(flow.dataRef.current, fileName, claims, extra);
        const result = await flow.persist(patch);
        if (!result.ok) return false;
        flow.setData(next);
        if (!resumeSignalFiredRef.current) {
          resumeSignalFiredRef.current = true;
          eora?.signalSuccess("resume_uploaded");
        }
        return true;
      })}
      onContinue={() => void flow.commit({}, flow.nextAfter(5))}
      onSkip={() => void flow.commit({ resume: "skipped" }, flow.nextAfter(5))}
    />
  );
}
