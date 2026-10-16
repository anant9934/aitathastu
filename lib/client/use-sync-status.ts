"use client";

/**
 * Live per-source import status from GET /api/student/sync-status (Tasks
 * 1.9.4, 2.1.3, 2.1.10). Real backend states only; polls while anything is
 * in flight and stops once everything settles.
 */
import { useCallback, useEffect, useState } from "react";
import { requestJson, describeError } from "./api";

export type SourceStatus = {
  source: string;
  state: string;
  stage?: string;
  reason?: string | null;
  found?: string | null;
  canRetry: boolean;
  action?: "retry" | "reconnect";
  reconnectUrl?: string | null;
  attempts?: number;
  maxAttempts?: number;
  nextAutomaticRetryAt?: string | null;
  finishedAt?: string | null;
};

export type SyncStatusResponse = { sources: SourceStatus[]; aggregate: { status: string; headline: string } };

export const SOURCE_LABELS: Record<string, string> = {
  resume: "CV", github: "GitHub", linkedin: "LinkedIn", scholar: "Research papers",
  kaggle: "Kaggle", leetcode: "LeetCode", hackerrank: "HackerRank",
};

export const IN_FLIGHT = new Set(["queued", "running", "awaiting_user"]);
export const ACTIVE = new Set(["queued", "running"]);

export function useSyncStatus({ intervalMs = 2000 }: { intervalMs?: number } = {}) {
  const [data, setData] = useState<SyncStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await requestJson<SyncStatusResponse>("/api/student/sync-status", { cache: "no-store" });
    if (res.ok) { setData(res.data); setError(null); return; }
    if (res.error.kind === "unauthorized") { setData({ sources: [], aggregate: { status: "not_started", headline: "" } }); return; }
    setError(`${describeError(res.error)} Your imports keep running; we'll check again.`);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const inFlight = !data || data.sources.some((s) => IN_FLIGHT.has(s.state));
  useEffect(() => {
    if (!inFlight && !error) return;
    const id = setInterval(() => void load(), intervalMs);
    return () => clearInterval(id);
  }, [inFlight, error, load, intervalMs]);

  return { data, error, reload: load };
}

/** The aggregate line in the person's words (the server names sources by ID). */
export function syncHeadline(requested: SourceStatus[]) {
  const names = (list: SourceStatus[]) => list.map((s) => SOURCE_LABELS[s.source] ?? s.source).join(" and ");
  const waiting = requested.filter((s) => s.state === "awaiting_user");
  const active = requested.filter((s) => ACTIVE.has(s.state));
  const settled = requested.length - waiting.length - active.length;
  if (waiting.length) return `${names(waiting)} needs a verification code to continue.`;
  if (active.length) return `${settled} of ${requested.length} sources done, ${active.length} still importing.`;
  const issues = requested.filter((s) => ["failed", "timed_out", "dead_letter", "partial"].includes(s.state)).length;
  return issues ? `${requested.length - issues} of ${requested.length} sources imported; ${issues} need attention.` : `All ${requested.length} sources imported.`;
}
