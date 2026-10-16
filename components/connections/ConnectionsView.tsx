"use client";

/**
 * /student/connections: live import status per source (with retry and
 * reconnect), every account connector, the optional LinkedIn import, and the
 * recent sync history. Same connector list as onboarding.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { useFootprintConnectors } from "@/lib/client/onboarding/use-footprint-connectors";
import { PageFrame } from "@/components/layout/StudentShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { toast } from "@/components/ui/Feedback";
import { SourceProgress } from "./SourceProgress";
import { ConnectorList } from "./ConnectorList";
import { LinkedInConnect } from "./LinkedInConnect";
import { sourceLabel } from "@/components/review/EntryList";

type SyncRun = { id: string; provider: string; status: string; startedAt?: string; completedAt?: string | null; recordsFetched?: number | null; recordsChanged?: number | null; errorMessage?: string | null };

export function ConnectionsView() {
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const api = useFootprintConnectors({ initialProfiles: {}, discoveredResumeProfiles: {}, onProfilesChange: () => void loadRuns(), onCandidatesDiscovered: () => undefined });
  const loadRuns = useCallback(async () => {
    const res = await requestJson<{ recentSyncRuns?: SyncRun[] }>("/api/student/connections", { cache: "no-store" });
    setRuns(res.ok ? res.data.recentSyncRuns ?? [] : []);
  }, []);
  useEffect(() => { void loadRuns(); }, [loadRuns]);

  const syncGithub = async () => {
    setSyncing(true);
    const res = await requestJson<{ recordsFetched?: number; recordsChanged?: number }>("/api/student/connections/github/sync", { method: "POST" });
    setSyncing(false);
    if (!res.ok) { toast.error("GitHub didn't sync", describeError(res.error)); return; }
    toast.success("GitHub synced", `${res.data.recordsFetched ?? 0} repositories read, ${res.data.recordsChanged ?? 0} updated.`);
    await loadRuns();
  };

  return (
    <PageFrame
      title="Connections"
      description="Every account is optional. We read public data only, and imported items stay suggestions until you confirm them."
      actions={api.profiles.github ? <Button variant="secondary" size="sm" icon={<ArrowsClockwise size={16} aria-hidden="true" />} loading={syncing} loadingLabel="Syncing…" onClick={() => void syncGithub()}>Sync GitHub now</Button> : undefined}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel aria-labelledby="accts-title">
            <PanelHeader id="accts-title" title="Accounts" />
            <ConnectorList api={api} returnTo="/student/connections" />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel aria-labelledby="status-title" data-eora-id="eora-sync-history">
            <PanelHeader id="status-title" title="Import status" description="Live from the server. Failed imports retry on their own; you can retry now." />
            <SourceProgress variant="manage" />
          </Panel>
          <LinkedInConnect />
          <Panel aria-labelledby="hist-title">
            <PanelHeader id="hist-title" title="Recent syncs" />
            {!runs ? <p className="text-sm text-muted">Loading…</p> : runs.length === 0 ? <p className="text-sm text-muted">No syncs yet. They appear here after an account imports.</p> : (
              <ul className="divide-y divide-line">
                {runs.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="min-w-20 text-sm font-medium">{sourceLabel(r.provider)}</span>
                    <StatusChip size="sm" tone={r.status === "completed" || r.status === "succeeded" ? "verified" : r.status === "failed" ? "danger" : "busy"}>{r.status}</StatusChip>
                    {typeof r.recordsFetched === "number" && <span className="font-mono text-2xs text-muted tabular">{r.recordsFetched} read · {r.recordsChanged ?? 0} changed</span>}
                    {r.startedAt && <span className="ml-auto font-mono text-2xs text-muted tabular">{formatDate(r.startedAt, true)}</span>}
                    {r.errorMessage && <p className="w-full text-xs text-danger">{r.errorMessage}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
