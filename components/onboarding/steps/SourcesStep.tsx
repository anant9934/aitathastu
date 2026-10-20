"use client";

/**
 * Connect your sources (screen 5.5). Replaces the separate "Let's discover
 * what you've built" (5.5) and "Your accounts" (6) screens, which offered the
 * same platforms twice with different statuses; GitHub sign-in, private
 * repositories, exports and LinkedIn existed only on the second one.
 *
 * Order on the page: what happened on a GitHub round trip, links found in the
 * CV (each waits for the student's confirmation), then every source grouped
 * by what it is for. Everything is optional and nothing reaches the profile
 * until it is accepted on Review.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, CheckCircle, FileText, Info, PencilSimple, X } from "@phosphor-icons/react/dist/ssr";
import { useFootprintConnectors } from "@/lib/client/onboarding/use-footprint-connectors";
import { PLATFORMS, platformById } from "@/lib/client/onboarding/platforms";
import type { OnboardingFlow } from "@/lib/client/onboarding/use-onboarding-flow";
import type { DiscoveredCandidates } from "@/lib/client/onboarding/use-footprint-connectors";
import { ConnectorList, type ConnectorApi } from "@/components/connections/ConnectorList";
import { LinkedInConnect } from "@/components/connections/LinkedInConnect";
import { GitHubConnectCard } from "@/components/connections/GitHubConnectCard";
import { SourceMark } from "@/components/connections/SourceMark";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { useConfirm } from "@/components/ui/Feedback";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { SOURCES_SCREEN } from "@/lib/onboarding-step-registry";
import { StepFooter, StepHeader } from "../OnboardingShell";

const RETURN_MESSAGES: Record<string, { kind: "success" | "warning" | "danger"; title: string; body: string }> = {
  github_connected: { kind: "success", title: "GitHub account confirmed", body: "Choose the repositories to import in the GitHub card below. Nothing is imported until you do." },
  github_app_installed: { kind: "success", title: "Repository access granted", body: "The repositories you shared on GitHub are listed in the GitHub card below. Choose which to import." },
  github_cancelled: { kind: "warning", title: "GitHub sign-in was cancelled", body: "Nothing changed and your progress is saved. You can try again, import public repositories only, or continue without GitHub." },
  github_authorization_failed: { kind: "warning", title: "GitHub didn't authorize AI Tathastu", body: "Some GitHub accounts can't authorize apps. You can import public repositories only from the GitHub card below; private repositories won't be connected." },
  github_app_approval_pending: { kind: "warning", title: "Waiting for an organization owner", body: "GitHub sent the request to the organization's owner. Once they approve, choose “Sync authorized repositories”. Public repositories still work meanwhile." },
  github_app_setup_cancelled: { kind: "warning", title: "Repository access wasn't granted", body: "Nothing changed. Public repositories still work; you can grant private access later." },
  github_app_account_mismatch: { kind: "danger", title: "That GitHub App install is for a different account", body: "Install it on the same GitHub account you linked here, or change the linked account first." },
  github_app_read_permissions_missing: { kind: "danger", title: "The app is missing read access", body: "Approve the requested read-only permissions on GitHub, then try again." },
  github_app_state_expired: { kind: "warning", title: "That request expired", body: "Start the repository-access step again; requests are valid for 10 minutes." },
  github_app_not_configured: { kind: "warning", title: "Private repositories aren't available yet", body: "Only public repositories can be read on this server. You can continue." },
  github_signin_unavailable: { kind: "warning", title: "GitHub sign-in isn't available right now", body: "Link GitHub by username to read public repositories, or continue without it." },
  github_unavailable: { kind: "warning", title: "GitHub is unavailable right now", body: "Try again later, or continue without it." },
};
const GENERIC_GITHUB_FAILURE = { kind: "danger" as const, title: "GitHub didn't connect", body: "Nothing changed and your progress is saved. Try again, or continue without GitHub." };

/** Reads (once) and clears the outcome GitHub's redirect left in the URL. */
function useReturnNotice() {
  const [notice] = useState(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const success = params.get("success");
    const code = error || success;
    if (!code) return null;
    return { code, ...(RETURN_MESSAGES[code] ?? (error ? GENERIC_GITHUB_FAILURE : { kind: "success" as const, title: "", body: "" })) };
  });
  useEffect(() => {
    if (!notice) return;
    const url = new URL(window.location.href);
    ["error", "success", "sync"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(window.history.state, "", url.toString());
  }, [notice]);
  const [open, setOpen] = useState(Boolean(notice?.title));
  return { notice: open ? notice : null, dismiss: () => setOpen(false) };
}

export function SourcesStep({ flow, guide, onCandidates }: {
  flow: OnboardingFlow;
  guide: React.ReactNode;
  onCandidates: (c: DiscoveredCandidates, provider: string) => void;
}) {
  const { data, setData, autosave, commit, goBack, prevBefore, nextAfter, save } = flow;
  const { notice, dismiss } = useReturnNotice();

  // The draft merges `profiles` key by key, so a removal must be written as "".
  const onProfilesChange = useCallback((next: Partial<Record<string, string>>) => {
    const before = flow.dataRef.current.profiles;
    const removed = Object.keys(before).filter((k) => before[k] && !next[k]);
    setData((d) => ({ ...d, profiles: next }));
    autosave({ profiles: { ...next, ...Object.fromEntries(removed.map((k) => [k, ""])) } });
  }, [flow.dataRef, setData, autosave]);

  const api = useFootprintConnectors({
    initialProfiles: data.profiles,
    discoveredResumeProfiles: data.discoveredResumeProfiles,
    onProfilesChange,
    onCandidatesDiscovered: onCandidates,
    autoLinkDiscovered: false,
    autoImportGitHub: false,
  });

  /** Disconnecting also drops review candidates that only came from that source. */
  const removeCandidatesFrom = useCallback((provider: string) => {
    const d = flow.dataRef.current;
    const patch = {
      projects: d.projects.filter((p) => !(p.status === "candidate" && (p.sources || []).length === 1 && p.sources?.[0] === provider)),
      techCandidates: (d.techCandidates || []).filter((t) => t.source !== provider),
      experiences: d.experiences.filter((e) => !(e.status === "candidate" && e.source === provider)),
      achievements: d.achievements.filter((a) => !(a.status === "candidate" && a.source === provider)),
      education: d.education.filter((e) => !(e.status === "candidate" && e.source === provider)),
    };
    setData((prev) => ({ ...prev, ...patch }));
    autosave(patch);
  }, [flow.dataRef, setData, autosave]);

  const connectorApi: ConnectorApi = useMemo(() => ({
    ...api,
    importFrom: async (provider, identifier, upload) => {
      if (!(await flow.ensureSession())) return false;
      return api.importFrom(provider, identifier, upload);
    },
    disconnect: async (provider) => {
      const problem = await api.disconnect(provider);
      if (!problem) removeCandidatesFrom(provider);
      return problem;
    },
  }), [api, flow, removeCandidatesFrom]);

  // Links the CV named that the student hasn't confirmed or dismissed yet.
  const dismissed = useMemo(() => new Set(data.dismissedFootprintProviders || []), [data.dismissedFootprintProviders]);
  // A GitHub link from the CV is handled by the GitHub card, so there is one GitHub experience.
  const cvGitHub = String(data.discoveredResumeProfiles.github || "");
  const cvLogin = cvGitHub.match(/github\.com\/([A-Za-z0-9-]{1,39})/i)?.[1] ?? null;
  const found = Object.entries(data.discoveredResumeProfiles)
    .filter(([id, url]) => id !== "github" && url && !api.profiles[id] && !dismissed.has(id) && platformById(id))
    .map(([id, url]) => ({ id, url: String(url) }));

  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [batch, setBatch] = useState(false);
  const confirm = useConfirm();

  /** Confirms every CV-found link at once, after one explicit authorization. */
  const confirmAllFound = async () => {
    const ok = await confirm({
      title: `Read ${found.length} profiles from your CV?`,
      body: `We'll read public data from ${found.map(({ id }) => platformById(id)!.name).join(", ")}. Only confirm accounts that are yours; everything found waits for your review.`,
      confirmLabel: "Yes, they're mine",
    });
    if (!ok) return;
    setBatch(true);
    for (const { id, url } of found) await connectorApi.importFrom(id, url);
    setBatch(false);
  };

  /** Re-reads every source already added (the former "Import from all linked"). */
  const refreshAll = async () => {
    if (!(await flow.ensureSession())) return;
    setBatch(true);
    await api.importAllLinked();
    setBatch(false);
  };

  const dismissFound = (id: string) => {
    const nextDismissed = Array.from(new Set([...(data.dismissedFootprintProviders || []), id]));
    setData((d) => {
      const discovered = { ...d.discoveredResumeProfiles };
      delete discovered[id];
      return { ...d, discoveredResumeProfiles: discovered, dismissedFootprintProviders: nextDismissed };
    });
    autosave({ discoveredResumeProfiles: { [id]: "" }, dismissedFootprintProviders: nextDismissed });
  };

  const saveEdit = () => {
    if (!editing) return;
    const value = editing.value.trim();
    if (!value) return;
    setData((d) => ({ ...d, discoveredResumeProfiles: { ...d.discoveredResumeProfiles, [editing.id]: value } }));
    autosave({ discoveredResumeProfiles: { [editing.id]: value } });
    setEditing(null);
  };

  const leaveGuard = useCallback(() => flow.persist({ currentScreen: SOURCES_SCREEN }), [flow]);
  // The verified GitHub account becomes the draft's GitHub profile, the same as any other linked source.
  const linkGitHubProfile = useCallback((url: string) => {
    if (flow.dataRef.current.profiles.github === url) return;
    setData((d) => ({ ...d, profiles: { ...d.profiles, github: url } }));
    autosave({ profiles: { github: url } });
  }, [flow.dataRef, setData, autosave]);
  const linkedCount = PLATFORMS.filter((p) => api.profiles[p.id] || (p.id === "github" && data.profiles.github)).length;
  const onNext = () => void commit({}, nextAfter(SOURCES_SCREEN));
  const onBack = () => goBack(prevBefore(SOURCES_SCREEN));
  useEoraStepEvents({ onNext, onBack });

  return (
    <>
      <StepHeader
        title="Connect the sources that show your work"
        description="All optional. Each source says what it can add and how it connects. Nothing reaches your profile until you accept it on the review step."
        guide={guide}
        eoraId="eora-digital-footprints"
      />

      <div className="mt-6 flex flex-col gap-8">
        {notice && (
          <Banner kind={notice.kind} title={notice.title} action={<Button size="sm" variant="ghost" onClick={dismiss}>Dismiss</Button>}>
            {notice.body}
          </Banner>
        )}

        <details className="group rounded-card border border-line-soft bg-bg-surface/50 px-4 py-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-text-primary">
            <Info size={16} aria-hidden="true" className="text-text-warm" />
            What linking, signing in and importing mean
          </summary>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-text-muted">
            <li><span className="text-text-primary">Linked:</span> we saved the address. Nothing was read from it.</li>
            <li><span className="text-text-primary">Imported:</span> we read public data and found items for you to review. <span className="text-text-primary">Partly imported</span> means some of it couldn&apos;t be read.</li>
            <li><span className="text-text-primary">Connected:</span> you signed in, so the account is confirmed as yours.</li>
            <li>We never ask for a password, session cookie or access token in a text box.</li>
          </ul>
        </details>

        {found.length > 0 && (
          <section aria-labelledby="found-title">
            <h2 id="found-title" className="flex items-center gap-2 font-display text-base font-semibold text-text-primary">
              <FileText size={18} aria-hidden="true" className="text-text-warm" />
              Found in your CV
            </h2>
            <div className="mb-3 mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-text-muted">Confirm each one is yours before we read it. Fix it if the CV had a typo.</p>
              {found.length > 1 && (
                <Button size="sm" variant="secondary" loading={batch} loadingLabel="Reading…" onClick={() => void confirmAllFound()}>
                  Confirm all {found.length}
                </Button>
              )}
            </div>
            <ul className="divide-y divide-border-medium rounded-card border border-border-medium bg-bg-elevated shadow-card">
              {found.map(({ id, url }) => {
                const p = platformById(id)!;
                const isEditing = editing?.id === id;
                const busy = api.busy === id;
                return (
                  <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                    <SourceMark id={id} />
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {p.name} <StatusChip tone="warning">Not confirmed</StatusChip>
                      </p>
                      {isEditing ? (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <TextField
                            label={`${p.name} profile`}
                            value={editing.value}
                            autoFocus
                            onChange={(e) => setEditing({ id, value: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditing(null); }}
                          />
                          <Button size="sm" variant="secondary" onClick={saveEdit}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <p className="mt-0.5 break-all text-sm text-text-muted">{url}</p>
                      )}
                      {api.errors[id] && <p role="alert" className="mt-1 text-sm text-danger">{api.errors[id]}</p>}
                    </div>
                    {!isEditing && (
                      <div className="flex w-full flex-wrap items-center justify-end gap-2 min-[480px]:w-auto">
                        <Button size="sm" variant="ghost" icon={<X size={16} aria-hidden="true" />} onClick={() => dismissFound(id)} disabled={busy}>
                          Not mine
                        </Button>
                        <Button size="sm" variant="ghost" icon={<PencilSimple size={16} aria-hidden="true" />} onClick={() => setEditing({ id, value: url })} disabled={busy}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<CheckCircle size={16} aria-hidden="true" />}
                          loading={busy}
                          loadingLabel="Reading…"
                          onClick={() => void connectorApi.importFrom(id, url)}
                        >
                          {p.type === "REFERENCE_ONLY" || p.type === "EXPORT_REQUIRED" ? "Yes, link it" : "Yes, import it"}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="sources-title" className="flex flex-col gap-6">
          <div>
            <h2 id="sources-title" className="font-display text-base font-semibold text-text-primary">
              {linkedCount ? `Your sources · ${linkedCount} added` : "Add a source"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-text-muted">Open a source to see exactly what it reads and how it connects. You can add more later from Connections.</p>
              {linkedCount > 1 && (
                <Button size="sm" variant="ghost" icon={<ArrowsClockwise size={16} aria-hidden="true" />} loading={batch} loadingLabel="Importing…" onClick={() => void refreshAll()}>
                  Import from all added
                </Button>
              )}
            </div>
          </div>
          <ConnectorList
            api={connectorApi}
            grouped
            exclude={["linkedin", "github"]}
            groupSlots={{
              development: (
                <div data-testid="card-github">
                  <GitHubConnectCard
                    returnTo="/onboarding"
                    beforeLeave={leaveGuard}
                    cvLogin={cvLogin}
                    authorizationFailed={notice?.code === "github_cancelled" || notice?.code === "github_authorization_failed"}
                    onCandidates={onCandidates}
                    onProfileLinked={linkGitHubProfile}
                    onPublicOnly={(username) => connectorApi.importFrom("github", username)}
                  />
                </div>
              ),
            }}
          />
          <LinkedInConnect />
        </section>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        saving={save.saving}
        nextLabel={linkedCount ? "Continue" : "Skip for now"}
      />
    </>
  );
}
