"use client";

/**
 * Digital-account linking and import (logic from the Phase 2 Screen 6;
 * presentation is new). Statuses are honest: a typed username whose public
 * data we read is "found, not verified" until GitHub OAuth proves ownership.
 *
 * Fixed while rebuilding (logged as P4-27): a failed disconnect used to be
 * swallowed, so the card said "disconnected" while the server kept the link.
 * The card now rolls back and says so.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson, describeError } from "@/lib/client/api";
import { normalizeImportCandidates } from "@/lib/onboarding-import-candidates";
import { PLATFORMS } from "./platforms";

export type FootprintStatus = "not_connected" | "linked" | "detected" | "connected" | "imported" | "partial" | "importing" | "failed" | "revoked";

export type DiscoveredCandidates = ReturnType<typeof normalizeImportCandidates>;

type ConnectorRow = { provider: string; status: string; profileUrl: string | null; lastSyncedAt: string | null };
type SyncRunRow = { provider: string; status: string; recordsFetched?: number | null; startedAt?: string };

/** Status of a saved connection from what the server recorded, never from a timestamp alone. */
export function statusFromServer(c: ConnectorRow, latestRun?: SyncRunRow): FootprintStatus {
  if (c.status === "reference_only" || c.status === "unavailable") return "linked";
  if (c.status === "detected") return "detected";
  if (c.status === "revoked") return "revoked";
  if (c.status === "syncing") return "importing";
  if (c.status === "needs_attention" || c.status === "error") return "failed";
  if (latestRun?.status === "queued" || latestRun?.status === "running") return "importing";
  if (latestRun?.status === "failed") return "failed";
  if (latestRun?.status === "partial") return "partial";
  if (latestRun?.status === "completed") return Number(latestRun.recordsFetched) > 0 ? "imported" : c.status === "connected" ? "connected" : "linked";
  return c.status === "connected" ? "connected" : "linked";
}

export function useFootprintConnectors({
  initialProfiles,
  discoveredResumeProfiles,
  onProfilesChange,
  onCandidatesDiscovered,
  autoLinkDiscovered = true,
}: {
  initialProfiles: Partial<Record<string, string>>;
  discoveredResumeProfiles: Partial<Record<string, string>>;
  onProfilesChange: (profiles: Partial<Record<string, string>>) => void;
  onCandidatesDiscovered: (candidates: DiscoveredCandidates, provider: string) => void;
  /** false: CV-found links wait for the student to confirm them instead of being linked on sight. */
  autoLinkDiscovered?: boolean;
}) {
  const merged = autoLinkDiscovered ? { ...discoveredResumeProfiles, ...initialProfiles } : { ...initialProfiles };
  const [profiles, setProfiles] = useState<Partial<Record<string, string>>>(merged);
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const [statuses, setStatuses] = useState<Record<string, FootprintStatus>>(() =>
    Object.fromEntries(Object.entries(merged).filter(([, v]) => v).map(([k]) => [k, "linked" as FootprintStatus])));
  const [summaries, setSummaries] = useState<Record<string, { text: string; partial: boolean; at: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const fromCv = new Set(Object.keys(discoveredResumeProfiles).filter((k) => discoveredResumeProfiles[k]));

  // CV links are registered as references (not scraped) the first time we see them.
  useEffect(() => {
    if (!autoLinkDiscovered) return;
    const toRegister = Object.entries(discoveredResumeProfiles).filter(([id, url]) => url && PLATFORMS.some((p) => p.id === id));
    if (!toRegister.length) return;
    let cancelled = false;
    (async () => {
      for (const [provider, identifier] of toRegister) {
        if (cancelled) return;
        await requestJson("/api/student/footprints/sync", { method: "POST", json: { provider, identifier, consent: true, referenceOnly: true } });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, []);

  // After a GitHub OAuth redirect (?success=github_connected), auto-trigger
  // a footprint import so the draft's projects list is populated without the
  // user having to manually click "Import". Fires at most once per page load.
  const autoImportGitHubRef = useRef(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("success") === "github_connected"
  );

  // What the server already knows (e.g. after a refresh or a GitHub OAuth round trip).
  useEffect(() => {
    let cancelled = false;
    void requestJson<{ connectors: ConnectorRow[]; recentSyncRuns?: SyncRunRow[] }>("/api/student/connections", { cache: "no-store" }).then((r) => {
      if (cancelled || !r.ok || !Array.isArray(r.data?.connectors)) return;
      const runs = Array.isArray(r.data.recentSyncRuns) ? r.data.recentSyncRuns : [];
      const found: Record<string, string> = {};
      const next: Record<string, FootprintStatus> = {};
      for (const c of r.data.connectors) {
        if (c.status === "not_connected" || !c.profileUrl || !PLATFORMS.some((p) => p.id === c.provider)) continue;
        found[c.provider] = c.profileUrl;
        next[c.provider] = statusFromServer(c, runs.find((run) => run.provider === c.provider));
      }
      if (Object.keys(found).length) {
        setProfiles((p) => ({ ...found, ...p }));
        // The server's record beats the draft's "linked" guess; only an import already running stays as is.
        setStatuses((s) => {
          const merged = { ...s, ...next };
          for (const [k, v] of Object.entries(s)) if (v === "importing") merged[k] = v;
          return merged;
        });
      }
    });
    return () => { cancelled = true; };
  }, []);

  // importFrom is defined below (useCallback); we capture it via ref so the
  // auto-import effect doesn't need to list it in its deps array (avoiding a
  // temporal dead zone: the deps array is evaluated before the useCallback runs).
  const importFromRef = useRef<((provider: string, identifier: string) => Promise<boolean>) | null>(null);

  const importFrom = useCallback(async (provider: string, identifier: string, upload?: { name: string; content: string } | null): Promise<boolean> => {
    const value = identifier.trim();
    if (!value && !upload) { setErrors((e) => ({ ...e, [provider]: "Add a username or profile link first." })); return false; }
    setBusy(provider);
    setErrors((e) => ({ ...e, [provider]: "" }));
    const before = statuses[provider];
    setStatuses((s) => ({ ...s, [provider]: "importing" }));
    const job = await requestJson<{ jobId?: string }>("/api/student/processing-jobs", { method: "POST", json: { sourceId: provider } });
    if (!job.ok || !job.data?.jobId) {
      setStatuses((s) => ({ ...s, [provider]: before ?? "not_connected" }));
      setErrors((e) => ({ ...e, [provider]: job.ok ? "The import didn't start. Try again." : describeError(job.error) }));
      setBusy(null);
      return false;
    }
    const res = await requestJson<{ acquisitionStatus?: string; candidateCount?: number; connectionStatus?: string; partial?: boolean; summary?: string; candidates?: unknown }>(
      "/api/student/footprints/sync",
      { method: "POST", json: { provider, jobId: job.data.jobId, identifier: value, exportFilename: upload?.name, exportContent: upload?.content, consent: true } },
    );
    setBusy(null);
    if (!res.ok) {
      setStatuses((s) => ({ ...s, [provider]: "failed" }));
      setErrors((e) => ({ ...e, [provider]: describeError(res.error) }));
      return false;
    }
    const d = res.data;
    const imported = d.acquisitionStatus !== "MANUAL_PROFILE_REFERENCE" && Number(d.candidateCount) > 0;
    setStatuses((s) => ({ ...s, [provider]: !imported ? "linked" : d.connectionStatus === "detected" ? "detected" : d.partial ? "partial" : "imported" }));
    setSummaries((m) => ({
      ...m,
      [provider]: {
        text: d.summary || (imported ? `${d.candidateCount} items ready for your review` : "Profile linked; nothing was imported from it"),
        partial: Boolean(d.partial),
        at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    }));
    const nextProfiles = { ...profilesRef.current, [provider]: upload ? `Archive: ${upload.name}` : value };
    setProfiles(nextProfiles);
    onProfilesChange(nextProfiles);
    if (d.candidates) onCandidatesDiscovered(normalizeImportCandidates(d.candidates), provider);
    return true;
  }, [statuses, onProfilesChange, onCandidatesDiscovered]);

  const disconnect = useCallback(async (provider: string): Promise<string | null> => {
    const prevProfiles = profilesRef.current;
    const prevStatus = statuses[provider];
    const nextProfiles = { ...prevProfiles };
    delete nextProfiles[provider];
    setProfiles(nextProfiles);
    setStatuses((s) => ({ ...s, [provider]: "not_connected" }));
    setBusy(provider);
    const res = await requestJson(`/api/student/connections?provider=${encodeURIComponent(provider)}`, { method: "DELETE" });
    setBusy(null);
    // 404: nothing was stored server-side yet (a link typed but never imported); local removal is the whole job.
    if (!res.ok && res.error.kind !== "not_found") {
      setProfiles(prevProfiles);
      setStatuses((s) => ({ ...s, [provider]: prevStatus ?? "linked" }));
      return `${describeError(res.error)} The account is still connected.`;
    }
    onProfilesChange(nextProfiles);
    return null;
  }, [statuses, onProfilesChange]);

  const importAllLinked = useCallback(async () => {
    for (const [provider, value] of Object.entries(profilesRef.current)) {
      if (!value || value.startsWith("Archive:") || !PLATFORMS.some((p) => p.id === provider)) continue;
      await importFrom(provider, value);
    }
  }, [importFrom]);

  // Keep the ref in sync so the auto-import effect can call the latest version
  // without listing importFrom in its deps array (which would cause a TDZ error
  // since importFrom is defined after the effect that references it).
  importFromRef.current = importFrom;

  // Auto-import after OAuth: once profiles are available and the flag is set,
  // trigger a footprint import to merge project candidates into the onboarding
  // draft. The ref guard ensures it fires at most once per page load.
  useEffect(() => {
    if (!autoImportGitHubRef.current) return;
    const githubProfile = profiles["github"];
    if (!githubProfile || String(githubProfile).startsWith("Archive:")) return;
    autoImportGitHubRef.current = false;
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("success");
        window.history.replaceState(null, "", url.toString());
      } catch { /* non-fatal */ }
    }
    void importFromRef.current?.("github", githubProfile);
  }, [profiles]); // importFrom intentionally excluded: accessed via ref to avoid TDZ

  return { profiles, statuses, summaries, errors, setErrors, busy, fromCv, importFrom, disconnect, importAllLinked };
}

/** Reads an export file for upload: zip as base64, text formats as text. */
export function readExportFile(file: File): Promise<{ name: string; content: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isZip = file.name.toLowerCase().endsWith(".zip");
    reader.onerror = () => reject(new Error("That file couldn't be read. Try downloading the export again."));
    reader.onload = (e) => {
      const result = String(e.target?.result ?? "");
      resolve({ name: file.name, content: isZip ? (result.includes(",") ? result.split(",")[1] : result) : result });
    };
    if (isZip) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}
