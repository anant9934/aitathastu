"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Check,
  CheckCircle,
  Code,
  Globe,
  PencilSimple,
  Plus,
  ShieldCheck,
  Sparkle,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { Button } from "@/lib/../components/ui/Button";
import { StatusChip, type Tone } from "@/components/ui/StatusChip";
import { StepHeader, StepFooter } from "../OnboardingShell";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import type { OnboardingFlow } from "@/lib/client/onboarding/use-onboarding-flow";
import {
  discoverFootprintsFromResume,
  type DiscoveredFootprint,
  type FootprintProvider,
} from "@/lib/services/digital-footprint-discovery";
import { isSafePublicUrl } from "@/lib/connectors/portfolio/url-check";
import { isValidOrcidChecksum } from "@/lib/services/digital-footprint-registry";

interface FootprintCardState {
  id: string;
  provider: FootprintProvider;
  displayName: string;
  url: string;
  username: string;
  sourceText: string;
  method: string;
  status: "detected" | "confirmed" | "importing" | "imported" | "failed" | "skipped";
  summary?: string;
  candidateCount?: number;
  error?: string;
  isCustom?: boolean;
}

const PROVIDER_METADATA: Record<
  FootprintProvider,
  { name: string; placeholder: string; hint: string; category: string }
> = {
  github: {
    name: "GitHub",
    placeholder: "username or https://github.com/username",
    hint: "Repositories, languages, dependency manifests, and code activity.",
    category: "Code & Projects",
  },
  huggingface: {
    name: "Hugging Face",
    placeholder: "username or https://huggingface.co/username",
    hint: "Open models, datasets, Spaces demos, and AI/ML experiments.",
    category: "AI & Models",
  },
  leetcode: {
    name: "LeetCode",
    placeholder: "username or https://leetcode.com/username",
    hint: "Solved algorithmic problems, contest rating, and skill badges.",
    category: "Problem Solving",
  },
  kaggle: {
    name: "Kaggle",
    placeholder: "username or https://kaggle.com/username",
    hint: "Competitions, notebooks, published datasets, and medals.",
    category: "Data Science",
  },
  hackerrank: {
    name: "HackerRank",
    placeholder: "username or https://hackerrank.com/profile/username",
    hint: "Verified algorithmic skill certificates and contest ranks.",
    category: "Problem Solving",
  },
  hackerearth: {
    name: "HackerEarth",
    placeholder: "username or https://hackerearth.com/@username",
    hint: "Hackathons, challenges, and public coding ratings.",
    category: "Problem Solving",
  },
  codechef: {
    name: "CodeChef",
    placeholder: "username or https://codechef.com/users/username",
    hint: "Competitive programming stars and division ratings.",
    category: "Problem Solving",
  },
  linkedin: {
    name: "LinkedIn",
    placeholder: "https://linkedin.com/in/username",
    hint: "Verified identity reference and professional experience.",
    category: "Professional",
  },
  orcid: {
    name: "ORCID",
    placeholder: "0000-0002-1825-0097 or https://orcid.org/...",
    hint: "Academic publications, journal papers, and research DOIs.",
    category: "Research",
  },
  google_scholar: {
    name: "Google Scholar",
    placeholder: "https://scholar.google.com/citations?user=...",
    hint: "Public citation index reference and publication links.",
    category: "Research",
  },
  stackoverflow: {
    name: "Stack Overflow",
    placeholder: "user ID or https://stackoverflow.com/users/...",
    hint: "Technical answers, reputation score, and topic badges.",
    category: "Technical Writing",
  },
  devto: {
    name: "DEV Community",
    placeholder: "username or https://dev.to/username",
    hint: "Published engineering articles, tutorials, and discussions.",
    category: "Technical Writing",
  },
  portfolio: {
    name: "Portfolio Website",
    placeholder: "https://yourportfolio.dev",
    hint: "Personal projects, demo links, and bio (SSRF-protected).",
    category: "Portfolio",
  },
};

export function FootprintIntelligenceStep({
  flow,
  guide,
}: {
  flow: OnboardingFlow;
  guide: React.ReactNode;
}) {
  const { data, setData, autosave, commit, goBack, prevBefore, nextAfter, save } = flow;
  const [items, setItems] = useState<FootprintCardState[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [selectedNewProvider, setSelectedNewProvider] = useState<FootprintProvider>("github");
  const [newInput, setNewInput] = useState("");
  const [newInputError, setNewInputError] = useState("");
  const [importingAll, setImportingAll] = useState(false);

  // Initialize discovered footprints from CV + draft
  useEffect(() => {
    const discoveredList: FootprintCardState[] = [];
    const seenProviders = new Set<string>();

    // 1. Run deterministic discovery on any CV text/hyperlinks already processed
    if (data.resumeReviewed && data.resumeReviewed.length > 0) {
      const cvText = data.resumeReviewed.map((r) => r.sourceSpan).join("\n");
      const discoveredFromText = discoverFootprintsFromResume({
        text: cvText,
        documentId: data.pendingResumeDocumentId || undefined,
      });

      for (const df of discoveredFromText) {
        if (!seenProviders.has(df.provider)) {
          seenProviders.add(df.provider);
          discoveredList.push({
            id: `cv_${df.provider}_${Date.now()}`,
            provider: df.provider,
            displayName: PROVIDER_METADATA[df.provider]?.name || df.provider,
            url: df.normalizedUrl,
            username: df.candidateUsername,
            sourceText: df.originalSourceText,
            method: df.discoveryMethod.replace("_", " "),
            status: "detected",
          });
        }
      }
    }

    // 2. Add any items previously saved in data.discoveredResumeProfiles
    if (data.discoveredResumeProfiles) {
      for (const [provider, url] of Object.entries(data.discoveredResumeProfiles)) {
        if (url && !seenProviders.has(provider) && provider in PROVIDER_METADATA) {
          seenProviders.add(provider);
          const p = provider as FootprintProvider;
          discoveredList.push({
            id: `disc_${p}_${Date.now()}`,
            provider: p,
            displayName: PROVIDER_METADATA[p]?.name || p,
            url,
            username: url.split("/").pop() || url,
            sourceText: "Discovered during CV parsing",
            method: "resume link",
            status: data.profiles?.[p as keyof typeof data.profiles] ? "confirmed" : "detected",
          });
        }
      }
    }

    // 3. Add any items already confirmed in data.profiles
    if (data.profiles) {
      for (const [provider, val] of Object.entries(data.profiles)) {
        if (val && !seenProviders.has(provider) && provider in PROVIDER_METADATA) {
          seenProviders.add(provider);
          const p = provider as FootprintProvider;
          discoveredList.push({
            id: `prof_${p}_${Date.now()}`,
            provider: p,
            displayName: PROVIDER_METADATA[p]?.name || p,
            url: val,
            username: val.split("/").pop() || val,
            sourceText: "Added profile",
            method: "profile link",
            status: "confirmed",
            isCustom: true,
          });
        }
      }
    }

    setItems(discoveredList);
  }, [data.resumeReviewed, data.discoveredResumeProfiles, data.pendingResumeDocumentId, data.profiles]);

  // Sync candidate trigger
  const runSync = useCallback(
    async (item: FootprintCardState): Promise<boolean> => {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "importing", error: undefined } : i))
      );

      try {
        const res = await requestJson<{
          success?: boolean;
          acquisitionStatus?: string;
          candidateCount?: number;
          recordsCreated?: number;
          summary?: string;
          error?: string;
          partial?: boolean;
          candidates?: {
            projects?: unknown[];
            skills?: unknown[];
            experiences?: unknown[];
            educations?: unknown[];
            achievements?: unknown[];
          };
        }>("/api/student/footprints/sync", {
          method: "POST",
          json: {
            provider: item.provider,
            identifier: item.url || item.username,
            consent: true,
          },
        });

        if (!res.ok) {
          const errMsg = describeError(res.error);
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: "failed", error: errMsg } : i))
          );
          return false;
        }

        const d = res.data;
        const count = d?.candidateCount ?? 0;
        const summaryText =
          d?.summary ||
          (count > 0 ? `${count} items discovered for review` : "Profile linked successfully");

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "imported",
                  candidateCount: count,
                  summary: summaryText,
                  error: undefined,
                }
              : i
          )
        );

        // Update draft profiles
        const nextProfiles = {
          ...flow.dataRef.current.profiles,
          [item.provider]: item.url,
        };
        setData((prev) => ({
          ...prev,
          profiles: nextProfiles,
        }));
        autosave({ profiles: nextProfiles });

        return true;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Sync failed.";
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "failed", error: errorMsg } : i))
        );
        return false;
      }
    },
    [flow, setData, autosave]
  );

  const handleConfirm = async (item: FootprintCardState) => {
    await runSync(item);
  };

  const handleRemove = (id: string, provider: FootprintProvider) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const nextProfiles = { ...flow.dataRef.current.profiles };
    delete nextProfiles[provider as keyof typeof nextProfiles];
    setData((prev) => ({ ...prev, profiles: nextProfiles }));
    autosave({ profiles: nextProfiles });
  };

  const handleSaveEdit = (id: string) => {
    if (!editUrl.trim()) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              url: editUrl.trim(),
              username: editUrl.trim().split("/").pop() || editUrl.trim(),
              status: "detected",
            }
          : i
      )
    );
    setEditingId(null);
    setEditUrl("");
  };

  const handleAddNew = () => {
    setNewInputError("");
    const val = newInput.trim();
    if (!val) {
      setNewInputError("Please enter a username or URL.");
      return;
    }

    // SSRF Check for Portfolio
    if (selectedNewProvider === "portfolio") {
      const urlToCheck = val.startsWith("http") ? val : `https://${val}`;
      const check = isSafePublicUrl(urlToCheck);
      if (!check.safe) {
        setNewInputError(check.reason || "Invalid or restricted URL.");
        return;
      }
    }

    // ORCID Checksum Check
    if (selectedNewProvider === "orcid") {
      const cleanId = val.replace(/^(?:https?:\/\/)?orcid\.org\//i, "").trim();
      if (!isValidOrcidChecksum(cleanId)) {
        setNewInputError("Invalid ORCID format. Must follow ISO 7064 Mod 11,2 checksum.");
        return;
      }
    }

    const newItem: FootprintCardState = {
      id: `manual_${selectedNewProvider}_${Date.now()}`,
      provider: selectedNewProvider,
      displayName: PROVIDER_METADATA[selectedNewProvider].name,
      url: val.startsWith("http") || selectedNewProvider === "orcid" ? val : `https://${selectedNewProvider}.com/${val}`,
      username: val.split("/").pop() || val,
      sourceText: "Manually added account",
      method: "manual entry",
      status: "detected",
      isCustom: true,
    };

    setItems((prev) => [...prev, newItem]);
    setNewInput("");
    void runSync(newItem);
  };

  const handleImportAll = async () => {
    setImportingAll(true);
    for (const item of items) {
      if (item.status === "detected" || item.status === "failed") {
        await runSync(item);
      }
    }
    setImportingAll(false);
  };

  const cvDetectedItems = useMemo(() => items.filter((i) => !i.isCustom), [items]);
  const customItems = useMemo(() => items.filter((i) => i.isCustom), [items]);

  const onNext = async () => {
    const profilesPayload: Record<string, string> = {};
    for (const item of items) {
      if (item.status === "confirmed" || item.status === "imported") {
        profilesPayload[item.provider] = item.url;
      }
    }
    await commit({ profiles: profilesPayload }, nextAfter(5.5));
  };

  const onSkip = async () => {
    await commit({}, nextAfter(5.5));
  };

  const onBack = () => {
    goBack(prevBefore(5.5));
  };

  useEoraStepEvents({ onNext, onBack });

  const toneForStatus = (status: FootprintCardState["status"]): Tone => {
    switch (status) {
      case "imported":
        return "verified";
      case "confirmed":
        return "corroborated";
      case "importing":
        return "busy";
      case "failed":
        return "danger";
      case "detected":
      default:
        return "evidenced";
    }
  };

  return (
    <>
      <StepHeader
        title="Let's discover what you've built."
        description="Your CV tells us about you. Your projects, code, research, and professional profiles can help us understand your experience in more detail."
        guide={guide}
      />

      <div className="mt-8 flex flex-col gap-8">
        {/* SECTION A — Found in your CV */}
        <section aria-labelledby="heading-found-in-cv" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-2">
            <div>
              <h2 id="heading-found-in-cv" className="font-display text-lg font-medium text-warm-ivory">
                Found in your CV
              </h2>
              <p className="text-xs text-text-muted">
                Profile links and identifiers detected automatically from your document text and hyperlinks.
              </p>
            </div>
            {cvDetectedItems.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<ArrowsClockwise size={16} aria-hidden="true" />}
                loading={importingAll}
                loadingLabel="Syncing all…"
                onClick={handleImportAll}
              >
                Confirm & Sync All
              </Button>
            )}
          </div>

          {cvDetectedItems.length === 0 ? (
            <div className="rounded-card border border-border-subtle bg-bg-surface p-5 text-center shadow-card">
              <p className="text-sm text-text-muted">
                No external profile links were detected in your CV. You can connect accounts manually below, or skip this step.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {cvDetectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-card border border-line-soft bg-bg-surface p-4 shadow-card transition-all hover:border-champagne/30"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-deep-espresso text-champagne">
                          <Code size={18} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="font-display text-sm font-medium text-warm-ivory">
                            {item.displayName}
                          </p>
                          <p className="text-xs text-text-dim">via {item.method}</p>
                        </div>
                      </div>
                      <StatusChip tone={toneForStatus(item.status)}>
                        {item.status === "importing"
                          ? "Importing…"
                          : item.status === "imported"
                          ? "Imported"
                          : item.status === "failed"
                          ? "Needs attention"
                          : "Found in CV"}
                      </StatusChip>
                    </div>

                    {editingId === item.id ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="w-full rounded-sm border border-champagne/40 bg-deep-espresso px-3 py-1.5 text-xs text-warm-ivory focus:outline-none"
                          placeholder="Update profile URL"
                        />
                        <Button size="sm" variant="primary" onClick={() => handleSaveEdit(item.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-champagne hover:underline"
                        >
                          <span className="truncate max-w-[220px]">{item.url}</span>
                          <ArrowSquareOut size={12} aria-hidden="true" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditUrl(item.url);
                          }}
                          className="text-text-muted hover:text-warm-ivory"
                          aria-label={`Edit ${item.displayName} URL`}
                        >
                          <PencilSimple size={14} aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    {item.summary && (
                      <p className="mt-1 text-xs text-soft-amber font-mono">{item.summary}</p>
                    )}
                    {item.error && (
                      <p className="mt-1 text-xs text-danger font-mono">{item.error}</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3">
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id, item.provider)}
                      className="inline-flex items-center gap-1 text-xs text-text-dim hover:text-danger"
                    >
                      <Trash size={14} aria-hidden="true" />
                      <span>Remove</span>
                    </button>

                    <Button
                      size="sm"
                      variant={item.status === "imported" ? "ghost" : "primary"}
                      loading={item.status === "importing"}
                      onClick={() => handleConfirm(item)}
                    >
                      {item.status === "imported"
                        ? "Refresh Data"
                        : item.status === "failed"
                        ? "Retry Import"
                        : "Confirm & Fetch"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION B — Add more accounts */}
        <section aria-labelledby="heading-add-accounts" className="flex flex-col gap-4">
          <div className="border-b border-line-soft pb-2">
            <h2 id="heading-add-accounts" className="font-display text-lg font-medium text-warm-ivory">
              Add more accounts
            </h2>
            <p className="text-xs text-text-muted">
              Connect external programming platforms, research archives, or developer profiles.
            </p>
          </div>

          <div className="rounded-card border border-border-subtle bg-bg-surface p-4 sm:p-5 shadow-card">
            <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
              <div>
                <label htmlFor="new-provider-select" className="sr-only">
                  Select Platform
                </label>
                <select
                  id="new-provider-select"
                  value={selectedNewProvider}
                  onChange={(e) => setSelectedNewProvider(e.target.value as FootprintProvider)}
                  className="w-full rounded-sm border border-line-medium bg-deep-espresso px-3 py-2 text-sm text-warm-ivory focus:border-champagne focus:outline-none"
                >
                  {Object.entries(PROVIDER_METADATA).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="new-provider-input" className="sr-only">
                  Profile handle or URL
                </label>
                <input
                  id="new-provider-input"
                  type="text"
                  value={newInput}
                  onChange={(e) => setNewInput(e.target.value)}
                  placeholder={PROVIDER_METADATA[selectedNewProvider].placeholder}
                  className="w-full rounded-sm border border-line-medium bg-deep-espresso px-3 py-2 text-sm text-warm-ivory focus:border-champagne focus:outline-none placeholder:text-text-dim"
                />
                <p className="mt-1 text-xs text-text-dim">
                  {PROVIDER_METADATA[selectedNewProvider].hint}
                </p>
                {newInputError && (
                  <p className="mt-1 text-xs text-danger">{newInputError}</p>
                )}
              </div>

              <div>
                <Button
                  size="md"
                  variant="primary"
                  icon={<Plus size={16} aria-hidden="true" />}
                  onClick={handleAddNew}
                >
                  Link Account
                </Button>
              </div>
            </div>

            {customItems.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 border-t border-line-soft pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Manually Linked Accounts
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {customItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-sm border border-line-soft bg-deep-espresso/60 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-medium text-warm-ivory">{item.displayName}:</span>
                        <span className="font-mono text-champagne truncate">{item.url}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusChip tone={toneForStatus(item.status)}>
                          {item.status === "imported" ? "Imported" : "Linked"}
                        </StatusChip>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id, item.provider)}
                          className="text-text-dim hover:text-danger"
                          aria-label={`Remove ${item.displayName}`}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION C — Other Evidence & Portfolio */}
        <section aria-labelledby="heading-other-evidence" className="flex flex-col gap-3">
          <div className="rounded-card border border-line-soft bg-bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-deep-espresso text-soft-amber">
                <Globe size={20} aria-hidden="true" />
              </span>
              <div>
                <h3 id="heading-other-evidence" className="font-display text-sm font-medium text-warm-ivory">
                  Personal Websites & Research Identifiers
                </h3>
                <p className="text-xs text-text-muted">
                  You can connect your portfolio or ORCID identifier at any time. Our SSRF protection ensures only safe, public HTTPS endpoints are queried.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION D — Consent & Safety */}
        <section aria-labelledby="heading-consent" className="rounded-card border border-border-subtle bg-deep-espresso/40 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-champagne shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-text-muted">
              <h4 id="heading-consent" className="font-medium text-warm-ivory mb-1">
                Data Privacy & Ethical Acquisition Guarantee
              </h4>
              <p>
                AI Tathastu only queries permitted public APIs and static web endpoints with your consent. We never ask for your passwords, automate private logins, bypass CAPTCHAs, or retain private codebases. Every piece of imported data remains an unverified candidate until you review and confirm it.
              </p>
            </div>
          </div>
        </section>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        saving={save.saving}
        nextLabel="Continue to details"
        secondary={
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip for now
          </Button>
        }
      />
    </>
  );
}
