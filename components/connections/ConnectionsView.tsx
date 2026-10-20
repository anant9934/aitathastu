"use client";

/**
 * /student/connections: live import status per source (with retry and
 * reconnect), every account connector, the optional LinkedIn import, the
 * recent sync history, and a global footprint overview summary panel.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
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

type ConnectorRow = {
  provider: string;
  status: string;
  lastSyncedAt?: string | null;
  profileUrl?: string | null;
};
type SyncRun = { id: string; provider: string; status: string; startedAt?: string; completedAt?: string | null; recordsFetched?: number | null; recordsChanged?: number | null; errorMessage?: string | null };

function FootprintOverview({ connectors, runs }: { connectors: ConnectorRow[]; runs: SyncRun[] | null }) {
  const connected = connectors.filter((c) => c.status !== "not_connected" && c.status !== "disconnected");
  const synced = connectors.filter((c) => c.lastSyncedAt);
  const needsAttention = connectors.filter((c) => c.status === "needs_attention" || c.status === "unavailable");
  const totalRecords = useMemo(() => {
    if (!runs) return null;
    return runs.reduce((sum, r) => sum + (r.recordsFetched ?? 0), 0);
  }, [runs]);
  const lastSync = useMemo(() => {
    const dates = connectors.filter((c) => c.lastSyncedAt).map((c) => c.lastSyncedAt as string);
    if (!dates.length) return null;
    return dates.sort().reverse()[0];
  }, [connectors]);

  if (!connected.length) return null;

  return (
    <Panel aria-labelledby="overview-title" className="mb-1">
      <PanelHeader id="overview-title" title="Footprint overview" description="Aggregated across all your connected sources." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="rounded-md border border-line-soft bg-bg-surface px-3 py-2.5">
          <p className="font-mono text-xl font-semibold text-champagne tabular">{connected.length}</p>
          <p className="text-xs text-muted mt-0.5">Connected</p>
        </div>
        <div className="rounded-md border border-line-soft bg-bg-surface px-3 py-2.5">
          <p className="font-mono text-xl font-semibold text-verified tabular">{synced.length}</p>
          <p className="text-xs text-muted mt-0.5">Synced</p>
        </div>
        <div className="rounded-md border border-line-soft bg-bg-surface px-3 py-2.5">
          <p className="font-mono text-xl font-semibold text-warm-ivory tabular">{totalRecords ?? "—"}</p>
          <p className="text-xs text-muted mt-0.5">Records read</p>
        </div>
        <div className="rounded-md border border-line-soft bg-bg-surface px-3 py-2.5">
          {needsAttention.length > 0 ? (
            <>
              <p className="font-mono text-xl font-semibold text-warning tabular">{needsAttention.length}</p>
              <p className="text-xs text-muted mt-0.5 flex items-center gap-1"><WarningCircle size={11} className="text-warning" aria-hidden="true" />Needs attention</p>
            </>
          ) : (
            <>
              <p className="font-mono text-xl font-semibold text-verified tabular">0</p>
              <p className="text-xs text-muted mt-0.5 flex items-center gap-1"><CheckCircle size={11} className="text-verified" aria-hidden="true" />All healthy</p>
            </>
          )}
        </div>
      </div>
      {lastSync && (
        <p className="mt-2 text-2xs text-muted">Last synced: {formatDate(lastSync, true)}</p>
      )}
    </Panel>
  );
}

export function ConnectionsView() {
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const api = useFootprintConnectors({ initialProfiles: {}, discoveredResumeProfiles: {}, onProfilesChange: () => void loadRuns(), onCandidatesDiscovered: () => undefined });
  const loadRuns = useCallback(async () => {
    const res = await requestJson<{ connectors?: ConnectorRow[]; recentSyncRuns?: SyncRun[] }>("/api/student/connections", { cache: "no-store" });
    if (res.ok) {
      setConnectors(res.data.connectors ?? []);
      setRuns(res.data.recentSyncRuns ?? []);
    } else {
      setRuns([]);
    }
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
      <FootprintOverview connectors={connectors} runs={runs} />
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
