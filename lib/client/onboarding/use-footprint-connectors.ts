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

export type FootprintStatus = "not_connected" | "linked" | "detected" | "connected" | "imported" | "importing" | "failed";

export type DiscoveredCandidates = ReturnType<typeof normalizeImportCandidates>;

type ConnectorRow = { provider: string; status: string; profileUrl: string | null; lastSyncedAt: string | null };

export function useFootprintConnectors({
  initialProfiles,
  discoveredResumeProfiles,
  onProfilesChange,
  onCandidatesDiscovered,
}: {
  initialProfiles: Partial<Record<string, string>>;
  discoveredResumeProfiles: Partial<Record<string, string>>;
  onProfilesChange: (profiles: Partial<Record<string, string>>) => void;
  onCandidatesDiscovered: (candidates: DiscoveredCandidates, provider: string) => void;
}) {
  const merged = { ...discoveredResumeProfiles, ...initialProfiles };
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

  // What the server already knows (e.g. after a refresh or a GitHub OAuth round trip).
  useEffect(() => {
    let cancelled = false;
    void requestJson<{ connectors: ConnectorRow[] }>("/api/student/connections", { cache: "no-store" }).then((r) => {
      if (cancelled || !r.ok || !Array.isArray(r.data?.connectors)) return;
      const found: Record<string, string> = {};
      const next: Record<string, FootprintStatus> = {};
      for (const c of r.data.connectors) {
        if (c.status === "not_connected" || !c.profileUrl || !PLATFORMS.some((p) => p.id === c.provider)) continue;
        found[c.provider] = c.profileUrl;
        next[c.provider] = c.status === "reference_only" ? "linked" : c.status === "detected" ? "detected" : c.lastSyncedAt ? "imported" : "connected";
      }
      if (Object.keys(found).length) {
        setProfiles((p) => ({ ...found, ...p }));
        setStatuses((s) => ({ ...next, ...s }));
      }
    });
    return () => { cancelled = true; };
  }, []);

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
    setStatuses((s) => ({ ...s, [provider]: !imported ? "linked" : d.connectionStatus === "detected" ? "detected" : "imported" }));
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
