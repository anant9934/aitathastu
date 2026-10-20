"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  BookOpen,
  Brain,
  Certificate,
  ChartBar,
  Code,
  CodeSimple,
  DevToLogo,
  GithubLogo,
  Globe,
  GraduationCap,
  LinkedinLogo,
  PencilSimple,
  Plus,
  ShieldCheck,
  StackOverflowLogo,
  TerminalWindow,
  Trash,
  X,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { requestJson, describeError } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Dialog } from "@/components/ui/Overlay";
import { StepHeader, StepFooter } from "../OnboardingShell";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import type { OnboardingFlow } from "@/lib/client/onboarding/use-onboarding-flow";
import type { DiscoveredCandidates } from "@/lib/client/onboarding/use-footprint-connectors";
import { normalizeImportCandidates } from "@/lib/onboarding-import-candidates";
import {
  discoverFootprintsFromResume,
  type FootprintProvider,
} from "@/lib/services/digital-footprint-discovery";
import { isSafePublicUrl } from "@/lib/connectors/portfolio/url-check";
import { isValidOrcidChecksum } from "@/lib/services/digital-footprint-registry";
import { cn } from "@/lib/client/cn";

export const ORDERED_PROVIDERS: FootprintProvider[] = [
  "github",
  "linkedin",
  "leetcode",
  "kaggle",
  "huggingface",
  "hackerrank",
  "hackerearth",
  "codechef",
  "stackoverflow",
  "devto",
  "google_scholar",
  "orcid",
  "portfolio",
];

export interface ProviderMeta {
  name: string;
  placeholder: string;
  hint: string;
  category: string;
  supportsFetch: boolean;
}

export const PROVIDER_METADATA: Record<FootprintProvider, ProviderMeta> = {
  github: {
    name: "GitHub",
    placeholder: "username or https://github.com/...",
    hint: "Repositories, languages, dependency manifests, and code activity.",
    category: "Code & Projects",
    supportsFetch: true,
  },
  linkedin: {
    name: "LinkedIn",
    placeholder: "https://linkedin.com/in/username",
    hint: "Verified identity reference and professional experience.",
    category: "Professional",
    supportsFetch: false,
  },
  leetcode: {
    name: "LeetCode",
    placeholder: "username or https://leetcode.com/...",
    hint: "Solved algorithmic problems, contest rating, and skill badges.",
    category: "Problem Solving",
    supportsFetch: true,
  },
  kaggle: {
    name: "Kaggle",
    placeholder: "username or https://kaggle.com/...",
    hint: "Competitions, notebooks, published datasets, and medals.",
    category: "Data Science",
    supportsFetch: true,
  },
  huggingface: {
    name: "Hugging Face",
    placeholder: "username or https://huggingface.co/...",
    hint: "Open models, datasets, Spaces demos, and AI/ML experiments.",
    category: "AI & Models",
    supportsFetch: true,
  },
  hackerrank: {
    name: "HackerRank",
    placeholder: "username or profile URL",
    hint: "Verified algorithmic skill certificates and contest ranks.",
    category: "Problem Solving",
    supportsFetch: true,
  },
  hackerearth: {
    name: "HackerEarth",
    placeholder: "username or profile URL",
    hint: "Hackathons, challenges, and public coding ratings.",
    category: "Problem Solving",
    supportsFetch: false,
  },
  codechef: {
    name: "CodeChef",
    placeholder: "username or profile URL",
    hint: "Competitive programming stars and division ratings.",
    category: "Problem Solving",
    supportsFetch: false,
  },
  stackoverflow: {
    name: "Stack Overflow",
    placeholder: "user ID or profile URL",
    hint: "Technical answers, reputation score, and topic badges.",
    category: "Technical Writing",
    supportsFetch: true,
  },
  devto: {
    name: "DEV Community",
    placeholder: "username or profile URL",
    hint: "Published engineering articles, tutorials, and discussions.",
    category: "Technical Writing",
    supportsFetch: true,
  },
  google_scholar: {
    name: "Google Scholar",
    placeholder: "citations user ID or profile URL",
    hint: "Public citation index reference and publication links.",
    category: "Research",
    supportsFetch: false,
  },
  orcid: {
    name: "ORCID",
    placeholder: "0000-0002-1825-0097 or profile URL",
    hint: "Academic publications, journal papers, and research DOIs.",
    category: "Research",
    supportsFetch: true,
  },
  portfolio: {
    name: "Portfolio Website",
    placeholder: "https://yourportfolio.dev",
    hint: "Personal projects, demo links, and bio (SSRF-protected).",
    category: "Portfolio",
    supportsFetch: true,
  },
};

export function PlatformIcon({ provider, size = 18 }: { provider: FootprintProvider; size?: number }) {
  switch (provider) {
    case "github":
      return <GithubLogo size={size} weight="bold" aria-hidden="true" />;
    case "linkedin":
      return <LinkedinLogo size={size} weight="bold" aria-hidden="true" />;
    case "leetcode":
      return <Code size={size} weight="bold" aria-hidden="true" />;
    case "kaggle":
      return <ChartBar size={size} weight="bold" aria-hidden="true" />;
    case "huggingface":
      return <Brain size={size} weight="bold" aria-hidden="true" />;
    case "hackerrank":
      return <Certificate size={size} weight="bold" aria-hidden="true" />;
    case "hackerearth":
      return <TerminalWindow size={size} weight="bold" aria-hidden="true" />;
    case "codechef":
      return <CodeSimple size={size} weight="bold" aria-hidden="true" />;
    case "stackoverflow":
      return <StackOverflowLogo size={size} weight="bold" aria-hidden="true" />;
    case "devto":
      return <DevToLogo size={size} weight="bold" aria-hidden="true" />;
    case "google_scholar":
      return <GraduationCap size={size} weight="bold" aria-hidden="true" />;
    case "orcid":
      return <BookOpen size={size} weight="bold" aria-hidden="true" />;
    case "portfolio":
      return <Globe size={size} weight="bold" aria-hidden="true" />;
    default:
      return <Globe size={size} weight="bold" aria-hidden="true" />;
  }
}

export function normalizeProviderUrl(provider: FootprintProvider, rawInput: string): string {
  const clean = rawInput.trim();
  if (provider === "portfolio") {
    return clean.startsWith("http://") || clean.startsWith("https://") ? clean : `https://${clean}`;
  }
  if (provider === "orcid") {
    const id = clean.replace(/^(?:https?:\/\/)?orcid\.org\//i, "").trim();
    return `https://orcid.org/${id}`;
  }
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }
  const handle = clean.replace(/^@/, "");
  switch (provider) {
    case "github":
      return `https://github.com/${handle}`;
    case "linkedin":
      return `https://linkedin.com/in/${handle}`;
    case "leetcode":
      return `https://leetcode.com/u/${handle}`;
    case "kaggle":
      return `https://kaggle.com/${handle}`;
    case "huggingface":
      return `https://huggingface.co/${handle}`;
    case "hackerrank":
      return `https://www.hackerrank.com/profile/${handle}`;
    case "hackerearth":
      return `https://hackerearth.com/@${handle}`;
    case "codechef":
      return `https://www.codechef.com/users/${handle}`;
    case "stackoverflow":
      return `https://stackoverflow.com/users/${handle}`;
    case "devto":
      return `https://dev.to/${handle}`;
    case "google_scholar":
      return `https://scholar.google.com/citations?user=${handle}`;
    default:
      return `https://${provider}.com/${handle}`;
  }
}

export function validateProviderInput(
  provider: FootprintProvider,
  rawVal: string
): { valid: boolean; error?: string; normalizedUrl?: string } {
  const trimmed = rawVal.trim();
  if (!trimmed) {
    return { valid: false, error: "Please enter a username or profile URL." };
  }

  // SSRF check for portfolio
  if (provider === "portfolio") {
    const urlToCheck = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
    const check = isSafePublicUrl(urlToCheck);
    if (!check.safe) {
      return { valid: false, error: check.reason || "Invalid or restricted URL." };
    }
    return { valid: true, normalizedUrl: urlToCheck };
  }

  // ORCID checksum check
  if (provider === "orcid") {
    const cleanId = trimmed.replace(/^(?:https?:\/\/)?orcid\.org\//i, "").trim();
    if (!isValidOrcidChecksum(cleanId)) {
      return { valid: false, error: "Invalid ORCID format. Must follow ISO 7064 Mod 11,2 checksum." };
    }
    return { valid: true, normalizedUrl: `https://orcid.org/${cleanId}` };
  }

  // LinkedIn domain validation
  if (provider === "linkedin" && (trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
    if (!/linkedin\.com\/(?:in|pub)\/[a-zA-Z0-9_\-\.%]+/i.test(trimmed)) {
      return { valid: false, error: "Please enter a valid LinkedIn URL (linkedin.com/in/...)." };
    }
  }

  // GitHub domain validation
  if (provider === "github" && (trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
    if (!/github\.com\/[a-zA-Z0-9_\-\.]+/i.test(trimmed)) {
      return { valid: false, error: "Please enter a valid GitHub URL (github.com/...)." };
    }
  }

  const normalized = normalizeProviderUrl(provider, trimmed);
  return { valid: true, normalizedUrl: normalized };
}

export interface DetectedCandidate {
  url: string;
  provenance: string;
}

export function FootprintIntelligenceStep({
  flow,
  guide,
  onCandidates,
}: {
  flow: OnboardingFlow;
  guide: React.ReactNode;
  onCandidates?: (c: DiscoveredCandidates, provider: string) => void;
}) {
  const { data, setData, autosave, commit, goBack, prevBefore, nextAfter, save } = flow;
  const { resumeReviewed, discoveredResumeProfiles, pendingResumeDocumentId, profiles, dismissedFootprintProviders } = data;

  // Input state for empty/unlinked cards
  const [inputs, setInputs] = useState<Partial<Record<FootprintProvider, string>>>({});
  // Editing state: which card is in edit mode and its current draft value
  const [editingProvider, setEditingProvider] = useState<FootprintProvider | null>(null);
  const [editValues, setEditValues] = useState<Partial<Record<FootprintProvider, string>>>({});
  // Status and feedback per card
  const [errors, setErrors] = useState<Partial<Record<FootprintProvider, string>>>({});
  const [syncingProviders, setSyncingProviders] = useState<Partial<Record<FootprintProvider, boolean>>>({});
  const [summaries, setSummaries] = useState<Partial<Record<FootprintProvider, string>>>({});
  // "imported" only when the source returned reviewable records; a saved URL or an empty/rate-limited fetch is "linked".
  const [importOutcomes, setImportOutcomes] = useState<Partial<Record<FootprintProvider, "imported" | "partial" | "linked">>>({});
  // Batch sync
  const [syncingAll, setSyncingAll] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Set of dismissed providers
  const dismissedSet = useMemo(
    () => new Set(dismissedFootprintProviders || []),
    [dismissedFootprintProviders]
  );

  // Derive detected candidates from CV
  const detectedCandidates = useMemo(() => {
    const candidates: Partial<Record<FootprintProvider, DetectedCandidate>> = {};

    // 1. From deterministic CV parsing on reviewed spans
    if (resumeReviewed && resumeReviewed.length > 0) {
      const cvText = resumeReviewed.map((r) => r.sourceSpan).join("\n");
      const discoveredFromText = discoverFootprintsFromResume({
        text: cvText,
        documentId: pendingResumeDocumentId || undefined,
      });

      for (const df of discoveredFromText) {
        if (!dismissedSet.has(df.provider) && !candidates[df.provider] && df.provider in PROVIDER_METADATA) {
          candidates[df.provider] = {
            url: df.normalizedUrl,
            provenance: `Detected via ${df.discoveryMethod.replace("_", " ")}`,
          };
        }
      }
    }

    // 2. From data.discoveredResumeProfiles
    if (discoveredResumeProfiles) {
      for (const [provider, url] of Object.entries(discoveredResumeProfiles)) {
        const p = provider as FootprintProvider;
        if (url && !dismissedSet.has(p) && !candidates[p] && p in PROVIDER_METADATA) {
          candidates[p] = {
            url,
            provenance: "Detected from CV",
          };
        }
      }
    }

    return candidates;
  }, [resumeReviewed, discoveredResumeProfiles, pendingResumeDocumentId, dismissedSet]);

  // Count unconfirmed CV-detected cards for batch sync
  const unconfirmedDetectedProviders = useMemo(() => {
    return ORDERED_PROVIDERS.filter((provider) => {
      const isSaved = Boolean(profiles?.[provider]);
      const hasDetected = Boolean(detectedCandidates[provider]);
      return !isSaved && hasDetected;
    });
  }, [profiles, detectedCandidates]);

  // In-flight sync generation token per provider to prevent race conditions
  const syncTokensRef = useRef<Partial<Record<FootprintProvider, number>>>({});

  // Execute sync / fetch for a given provider
  const runSync = useCallback(
    async (provider: FootprintProvider, url: string): Promise<boolean> => {
      const syncToken = (syncTokensRef.current[provider] || 0) + 1;
      syncTokensRef.current[provider] = syncToken;

      setSyncingProviders((prev) => ({ ...prev, [provider]: true }));
      setErrors((prev) => ({ ...prev, [provider]: undefined }));

      try {
        await flow.ensureSession();

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
            provider,
            identifier: url,
            consent: true,
          },
        });

        // Guard against race conditions: abort if user removed account or restarted sync while in-flight
        if (syncTokensRef.current[provider] !== syncToken) {
          return false;
        }
        if ((flow.dataRef.current.dismissedFootprintProviders || []).includes(provider)) {
          return false;
        }

        if (!res.ok) {
          const errMsg = describeError(res.error);
          setErrors((prev) => ({ ...prev, [provider]: errMsg }));
          return false;
        }

        const d = res.data;
        const count = d?.candidateCount ?? 0;
        const summaryText =
          d?.summary ||
          (count > 0 ? `${count} items discovered for review` : "Profile linked successfully");

        setSummaries((prev) => ({ ...prev, [provider]: summaryText }));
        const outcome = count > 0 ? (d?.partial ? "partial" : "imported") : "linked";
        setImportOutcomes((prev) => ({ ...prev, [provider]: outcome }));

        // Apply discovered candidate projects/skills to onboarding draft if present
        if (d?.candidates && onCandidates) {
          try {
            const normalized = normalizeImportCandidates(d.candidates);
            onCandidates(normalized, provider);
          } catch {
            // Non-blocking normalization
          }
        }

        // Update draft profiles & remove from discoveredResumeProfiles
        const nextProfiles = {
          ...flow.dataRef.current.profiles,
          [provider]: url,
        };
        const nextDiscovered = { ...flow.dataRef.current.discoveredResumeProfiles };
        delete nextDiscovered[provider];

        setData((prev) => ({
          ...prev,
          profiles: nextProfiles,
          discoveredResumeProfiles: nextDiscovered,
        }));
        autosave({ profiles: nextProfiles, discoveredResumeProfiles: nextDiscovered });

        return true;
      } catch (err: unknown) {
        if (syncTokensRef.current[provider] !== syncToken) return false;
        const errorMsg = err instanceof Error ? err.message : "Sync failed.";
        setErrors((prev) => ({ ...prev, [provider]: errorMsg }));
        return false;
      } finally {
        if (syncTokensRef.current[provider] === syncToken) {
          setSyncingProviders((prev) => ({ ...prev, [provider]: false }));
        }
      }
    },
    [flow, setData, autosave, onCandidates]
  );

  // Manual link action on empty card
  const handleLink = async (provider: FootprintProvider) => {
    const raw = (inputs[provider] || "").trim();
    const validation = validateProviderInput(provider, raw);
    if (!validation.valid || !validation.normalizedUrl) {
      setErrors((prev) => ({ ...prev, [provider]: validation.error || "Invalid input." }));
      return;
    }

    const url = validation.normalizedUrl;
    setErrors((prev) => ({ ...prev, [provider]: undefined }));

    // Un-dismiss if previously dismissed
    if (dismissedSet.has(provider)) {
      const nextDismissed = (data.dismissedFootprintProviders || []).filter((p) => p !== provider);
      setData((prev) => ({ ...prev, dismissedFootprintProviders: nextDismissed }));
      autosave({ dismissedFootprintProviders: nextDismissed });
    }

    const success = await runSync(provider, url);
    if (success) {
      setInputs((prev) => ({ ...prev, [provider]: "" }));
    }
  };

  // Confirm detected CV candidate
  const handleConfirmCandidate = async (provider: FootprintProvider) => {
    const candidate = detectedCandidates[provider];
    if (!candidate) return;
    await runSync(provider, candidate.url);
  };

  // Start inline editing
  const startEditing = (provider: FootprintProvider, initialValue: string) => {
    setEditingProvider(provider);
    setEditValues((prev) => ({ ...prev, [provider]: initialValue }));
    setErrors((prev) => ({ ...prev, [provider]: undefined }));
  };

  // Cancel inline editing
  const cancelEditing = (provider: FootprintProvider) => {
    setEditingProvider(null);
    setErrors((prev) => ({ ...prev, [provider]: undefined }));
    setEditValues((prev) => ({ ...prev, [provider]: undefined }));
  };

  // Save inline editing
  const [savingEdit, setSavingEdit] = useState(false);

  const handleSaveEdit = async (provider: FootprintProvider) => {
    const raw = (editValues[provider] || "").trim();
    const validation = validateProviderInput(provider, raw);
    if (!validation.valid || !validation.normalizedUrl) {
      setErrors((prev) => ({ ...prev, [provider]: validation.error || "Invalid input." }));
      return;
    }

    const url = validation.normalizedUrl;
    setErrors((prev) => ({ ...prev, [provider]: undefined }));
    setSavingEdit(true);

    const isSaved = Boolean(profiles?.[provider]);

    try {
      if (isSaved) {
        // Update saved profile
        const nextProfiles = {
          ...flow.dataRef.current.profiles,
          [provider]: url,
        };
        setData((prev) => ({ ...prev, profiles: nextProfiles }));
        const res = await flow.persist({ profiles: nextProfiles });
        if (!res.ok) {
          setErrors((prev) => ({ ...prev, [provider]: describeError(res.error) }));
          return;
        }
      } else {
        // Update detected candidate
        const nextDiscovered = {
          ...flow.dataRef.current.discoveredResumeProfiles,
          [provider]: url,
        };
        setData((prev) => ({ ...prev, discoveredResumeProfiles: nextDiscovered }));
        const res = await flow.persist({ discoveredResumeProfiles: nextDiscovered });
        if (!res.ok) {
          setErrors((prev) => ({ ...prev, [provider]: describeError(res.error) }));
          return;
        }
      }

      setEditingProvider(null);
    } finally {
      setSavingEdit(false);
    }
  };

  // Remove / Dismiss candidate or saved profile
  const handleRemove = async (provider: FootprintProvider) => {
    // 0. Invalidate any in-flight sync request token
    syncTokensRef.current[provider] = (syncTokensRef.current[provider] || 0) + 1;
    setSyncingProviders((prev) => ({ ...prev, [provider]: false }));

    // 1. Mark as dismissed in draft so reload does not restore CV candidate
    const nextDismissed = Array.from(new Set([...(data.dismissedFootprintProviders || []), provider]));

    // 2. Clear from profiles & discoveredResumeProfiles
    const nextProfiles = { ...flow.dataRef.current.profiles };
    delete nextProfiles[provider];

    const nextDiscovered = { ...flow.dataRef.current.discoveredResumeProfiles };
    delete nextDiscovered[provider];

    // Clean up any unconfirmed candidate items previously imported from this provider
    const nextProjects = (flow.dataRef.current.projects || []).filter(
      (p) => !(p.status === "candidate" && (p.sources || []).includes(provider))
    );
    const nextTech = (flow.dataRef.current.techCandidates || []).filter(
      (t) => t.source !== provider
    );
    const nextExp = (flow.dataRef.current.experiences || []).filter(
      (e) => !(e.status === "candidate" && e.source === provider)
    );
    const nextAch = (flow.dataRef.current.achievements || []).filter(
      (a) => !(a.status === "candidate" && a.source === provider)
    );
    const nextEdu = (flow.dataRef.current.education || []).filter(
      (e) => !(e.status === "candidate" && e.source === provider)
    );

    setData((prev) => ({
      ...prev,
      profiles: nextProfiles,
      discoveredResumeProfiles: nextDiscovered,
      dismissedFootprintProviders: nextDismissed,
      projects: nextProjects,
      techCandidates: nextTech,
      experiences: nextExp,
      achievements: nextAch,
      education: nextEdu,
    }));

    // 3. Wait for successful persistence
    await flow.persist({
      profiles: { [provider]: "" },
      discoveredResumeProfiles: { [provider]: "" },
      dismissedFootprintProviders: nextDismissed,
      projects: nextProjects,
      techCandidates: nextTech,
      experiences: nextExp,
      achievements: nextAch,
      education: nextEdu,
    });

    // 4. Clear local states
    setInputs((prev) => ({ ...prev, [provider]: "" }));
    setErrors((prev) => ({ ...prev, [provider]: undefined }));
    setSummaries((prev) => ({ ...prev, [provider]: undefined }));
    setImportOutcomes((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
    if (editingProvider === provider) {
      setEditingProvider(null);
    }

    // 5. Safely disconnect on backend (non-destructive)
    try {
      await requestJson(`/api/student/connections?provider=${encodeURIComponent(provider)}`, {
        method: "DELETE",
      });
    } catch {
      // Non-blocking disconnect cleanup
    }
  };

  // Batch sync all detected candidates
  const handleSyncAll = async () => {
    setSyncingAll(true);
    for (const provider of unconfirmedDetectedProviders) {
      const candidate = detectedCandidates[provider];
      if (candidate) {
        await runSync(provider, candidate.url);
      }
    }
    setSyncingAll(false);
  };

  // Navigation handlers
  const onNext = async () => {
    await commit({ profiles: flow.dataRef.current.profiles }, nextAfter(5.5));
  };

  const onSkip = async () => {
    await commit({}, nextAfter(5.5));
  };

  const onBack = () => {
    goBack(prevBefore(5.5));
  };

  useEoraStepEvents({ onNext, onBack });

  return (
    <>
      <StepHeader
        title="Let's discover what you've built."
        description="Your CV tells us about you. Your projects, code, research, and professional profiles can help us understand your experience in more detail."
        guide={guide}
      />

      <div className="mt-8 flex flex-col gap-8">
        {/* ONE UNIFIED DIGITAL FOOTPRINT SECTION */}
        <section aria-labelledby="heading-digital-footprint" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-3">
            <div>
              <h2 id="heading-digital-footprint" className="font-display text-lg font-medium text-text-primary">
                Your Digital Footprint
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Review profiles found in your CV or add the platforms where you build and learn.
              </p>
            </div>

            {unconfirmedDetectedProviders.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<ArrowsClockwise size={15} aria-hidden="true" />}
                loading={syncingAll}
                loadingLabel="Syncing all…"
                onClick={() => setShowBatchModal(true)}
              >
                Confirm & Sync All ({unconfirmedDetectedProviders.length})
              </Button>
            )}
          </div>

          {/* RESPONSIVE UNIFIED GRID: ADAPTIVE 1 TO 4 COLUMNS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {ORDERED_PROVIDERS.map((provider) => {
              const meta = PROVIDER_METADATA[provider];
              const savedUrl = profiles?.[provider] || "";
              const isLinked = Boolean(savedUrl);
              const detected = detectedCandidates[provider];
              const isDetected = !isLinked && Boolean(detected);
              const isEditing = editingProvider === provider;
              const isSyncing = Boolean(syncingProviders[provider]);
              const cardError = errors[provider];
              const summary = summaries[provider];
              const outcome = importOutcomes[provider];

              return (
                <div
                  key={provider}
                  data-testid={`card-${provider}`}
                  className={cn(
                    "flex flex-col justify-between rounded-card border p-4 transition-all duration-200 shadow-card min-h-[170px]",
                    isLinked
                      ? "border-champagne/40 bg-bg-surface"
                      : isDetected
                      ? "border-soft-amber/40 bg-bg-surface hover:border-soft-amber/60"
                      : "border-line-soft bg-bg-surface hover:border-champagne/30"
                  )}
                >
                  {/* Card Header: Platform Icon + Title + StatusChip */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-sm shrink-0 transition-colors",
                          isLinked
                            ? "bg-champagne/15 text-champagne border border-champagne/30"
                            : isDetected
                            ? "bg-soft-amber/15 text-soft-amber border border-soft-amber/30"
                            : "bg-deep-espresso text-champagne border border-line-soft"
                        )}
                        aria-hidden="true"
                      >
                        <PlatformIcon provider={provider} size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-display text-sm font-medium text-text-primary leading-tight truncate">
                            {meta.name}
                          </h3>
                        </div>
                        <p className="text-[11px] text-text-dim truncate leading-snug">
                          {meta.category}
                        </p>
                      </div>
                    </div>

                    {/* Status Chip */}
                    <div className="shrink-0">
                      {isSyncing ? (
                        <StatusChip tone="busy">Fetching…</StatusChip>
                      ) : cardError ? (
                        <StatusChip tone="danger">Needs attention</StatusChip>
                      ) : isLinked ? (
                        outcome === "imported" ? (
                          <StatusChip tone="verified">Imported</StatusChip>
                        ) : outcome === "partial" ? (
                          <StatusChip tone="warning">Partly imported</StatusChip>
                        ) : (
                          <StatusChip tone="corroborated">Saved</StatusChip>
                        )
                      ) : isDetected ? (
                        <StatusChip tone="warning">Found in CV</StatusChip>
                      ) : null}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="mt-3 flex-1 flex flex-col justify-end">
                    {isEditing ? (
                      /* ==================================================== */
                      /* INLINE EDIT MODE (PART D)                            */
                      /* ==================================================== */
                      <div className="flex flex-col gap-2">
                        <div>
                          <label htmlFor={`edit-input-${provider}`} className="sr-only">
                            Edit {meta.name} identifier
                          </label>
                          <input
                            id={`edit-input-${provider}`}
                            type="text"
                            value={editValues[provider] ?? ""}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, [provider]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleSaveEdit(provider);
                              } else if (e.key === "Escape") {
                                cancelEditing(provider);
                              }
                            }}
                            className="w-full rounded-sm border border-champagne/40 bg-deep-espresso px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-dim focus:border-champagne focus:outline-none"
                            placeholder={meta.placeholder}
                            autoFocus
                          />
                          {cardError && (
                            <p className="mt-1 text-xs text-danger font-mono">{cardError}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelEditing(provider)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            loading={savingEdit}
                            disabled={savingEdit}
                            onClick={() => handleSaveEdit(provider)}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : isLinked ? (
                      /* ==================================================== */
                      /* STATE 4 — SAVED ACCOUNT                             */
                      /* ==================================================== */
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2 rounded-sm bg-deep-espresso/60 px-2.5 py-1.5 border border-line-soft text-xs">
                          <a
                            href={savedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-xs text-champagne hover:underline truncate min-w-0 max-w-[260px] sm:max-w-[320px]"
                            title={savedUrl}
                          >
                            <span className="truncate">{savedUrl}</span>
                            <ArrowSquareOut size={12} className="shrink-0 opacity-70" aria-hidden="true" />
                          </a>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditing(provider, savedUrl)}
                              className="text-text-muted hover:text-text-primary transition-colors p-1"
                              aria-label={`Edit ${meta.name} profile URL`}
                              title="Edit profile"
                            >
                              <PencilSimple size={13} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(provider)}
                              className="text-text-dim hover:text-danger transition-colors p-1"
                              aria-label={`Remove ${meta.name} profile`}
                              title="Remove profile"
                            >
                              <Trash size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {cardError ? (
                          <p className="text-xs text-danger font-mono truncate" title={cardError}>
                            {cardError}
                          </p>
                        ) : summary ? (
                          <p className="text-[11px] text-soft-amber font-mono truncate" title={summary}>
                            {summary}
                          </p>
                        ) : !meta.supportsFetch ? (
                          <p className="text-[11px] text-text-dim truncate">
                            Saved — automatic fetch unavailable
                          </p>
                        ) : null}

                        {meta.supportsFetch && (
                          <div className="flex items-center justify-end pt-1">
                            <Button
                              size="sm"
                              variant={cardError ? "secondary" : "ghost"}
                              loading={isSyncing}
                              loadingLabel="Refreshing…"
                              disabled={isSyncing}
                              icon={<ArrowsClockwise size={12} aria-hidden="true" />}
                              onClick={() => runSync(provider, savedUrl)}
                            >
                              {cardError ? "Retry" : "Refresh Data"}
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : isDetected && detected ? (
                      /* ==================================================== */
                      /* STATE 2 — PROFILE FOUND IN CV (REVIEW PENDING)       */
                      /* ==================================================== */
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2 rounded-sm bg-deep-espresso/60 px-2.5 py-1.5 border border-soft-amber/30 text-xs">
                          <a
                            href={detected.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-xs text-champagne hover:underline truncate min-w-0 max-w-[260px] sm:max-w-[320px]"
                            title={detected.url}
                          >
                            <span className="truncate">{detected.url}</span>
                            <ArrowSquareOut size={12} className="shrink-0 opacity-70" aria-hidden="true" />
                          </a>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditing(provider, detected.url)}
                              className="text-text-muted hover:text-text-primary transition-colors p-1"
                              aria-label={`Edit detected ${meta.name} profile URL`}
                              title="Edit candidate"
                            >
                              <PencilSimple size={13} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(provider)}
                              className="text-text-dim hover:text-danger transition-colors p-1"
                              aria-label={`Dismiss ${meta.name} candidate`}
                              title="Dismiss candidate"
                            >
                              <X size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <p className="text-[11px] text-text-dim truncate" title={detected.provenance}>
                          {detected.provenance}
                        </p>

                        {cardError && (
                          <p className="text-xs text-danger font-mono truncate" title={cardError}>
                            {cardError}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleRemove(provider)}
                            className="text-xs text-text-dim hover:text-danger transition-colors"
                          >
                            Dismiss
                          </button>
                          <Button
                            size="sm"
                            variant="primary"
                            loading={isSyncing}
                            loadingLabel="Connecting…"
                            disabled={isSyncing}
                            onClick={() => handleConfirmCandidate(provider)}
                          >
                            {meta.supportsFetch ? "Confirm & Fetch" : "Confirm & Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ==================================================== */
                      /* STATE 1 — NO PROFILE FOUND IN CV (CLEAN INPUT)       */
                      /* ==================================================== */
                      <div className="flex flex-col gap-2">
                        <div>
                          <label htmlFor={`input-${provider}`} className="sr-only">
                            {meta.name} handle or profile URL
                          </label>
                          <input
                            id={`input-${provider}`}
                            type="text"
                            value={inputs[provider] ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInputs((prev) => ({ ...prev, [provider]: val }));
                              if (errors[provider]) {
                                setErrors((prev) => ({ ...prev, [provider]: undefined }));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleLink(provider);
                              }
                            }}
                            placeholder={meta.placeholder}
                            disabled={isSyncing}
                            className={cn(
                              "w-full rounded-sm border bg-deep-espresso px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-dim transition-colors focus:border-champagne focus:outline-none",
                              cardError ? "border-danger" : "border-line-medium"
                            )}
                          />
                          {cardError && (
                            <p className="mt-1 text-xs text-danger font-mono">{cardError}</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <p className="text-[11px] text-text-dim truncate min-w-0 max-w-[160px] sm:max-w-[220px]" title={meta.hint}>
                            {meta.hint}
                          </p>
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<Plus size={13} aria-hidden="true" />}
                            loading={isSyncing}
                            loadingLabel="Linking…"
                            disabled={isSyncing}
                            onClick={() => handleLink(provider)}
                          >
                            Link Account
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION C — Personal Websites & Research Identifiers */}
        <section aria-labelledby="heading-other-evidence" className="flex flex-col gap-3">
          <div className="rounded-card border border-line-soft bg-bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-deep-espresso text-soft-amber shrink-0">
                <Globe size={20} aria-hidden="true" />
              </span>
              <div>
                <h3 id="heading-other-evidence" className="font-display text-sm font-medium text-text-primary">
                  Personal Websites & Research Identifiers
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  You can connect your portfolio or ORCID identifier at any time. Our SSRF protection ensures only safe, public HTTPS endpoints are queried.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION D — Data Privacy & Ethical Acquisition Guarantee */}
        <section aria-labelledby="heading-consent" className="rounded-card border border-border-subtle bg-deep-espresso/40 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-champagne shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-text-muted">
              <h4 id="heading-consent" className="font-medium text-text-primary mb-1">
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

      {/* Batch Sync Authorization Dialog */}
      <Dialog
        open={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="Authorize Digital Footprint Sync"
        description="Review the platforms discovered in your CV before public data retrieval begins."
        size="md"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <Link
              href="/privacy/digital-sources"
              target="_blank"
              className="text-xs text-accent-warm underline hover:text-accent-warm-bright"
            >
              Digital Sources Notice
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowBatchModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={syncingAll}
                loadingLabel="Syncing all…"
                onClick={async () => {
                  setShowBatchModal(false);
                  await handleSyncAll();
                }}
              >
                Authorize and fetch ({unconfirmedDetectedProviders.length})
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4 text-xs text-text-muted">
          <p>
            You are authorizing AI Tathastu to query public metadata from the following student-confirmed profile links.
            Each provider will be independently authorized:
          </p>
          <div className="max-h-60 overflow-y-auto space-y-2 rounded-md border border-border-medium bg-bg-surface p-3">
            {unconfirmedDetectedProviders.map((prov) => {
              const meta = PROVIDER_METADATA[prov];
              const cand = detectedCandidates[prov];
              return (
                <div key={prov} className="flex flex-col gap-0.5 border-b border-border-subtle/40 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">{meta.name}</span>
                    <span className="font-mono text-2xs text-text-dim truncate max-w-[200px]">{cand?.url}</span>
                  </div>
                  <span className="text-2xs text-text-muted">{meta.hint}</span>
                </div>
              );
            })}
          </div>
          <p className="text-2xs text-text-dim">
            Guarantees: We only read public profiles and permitted APIs. No passwords or private tokens are accessed. Imported entries remain review candidates until you accept them into your profile.
          </p>
        </div>
      </Dialog>
    </>
  );
}
