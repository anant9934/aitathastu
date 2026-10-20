"use client";

/**
 * Digital-account connectors (onboarding step and /student/connections).
 * Each row is in normal flow and wraps on narrow screens, so the action can
 * never sit on top of the platform name (P4-17). The connect form opens in a
 * portalled drawer, positioned against the viewport (P4-18).
 */
import React, { useEffect, useRef, useState } from "react";
import { ArrowClockwise, ArrowSquareOut, CheckCircle, FileArrowUp, Plugs, ShieldCheck, Trash } from "@phosphor-icons/react/dist/ssr";
import { PLATFORMS, PLATFORM_GROUPS, platformById } from "@/lib/client/onboarding/platforms";
import type { FootprintStatus } from "@/lib/client/onboarding/use-footprint-connectors";
import { readExportFile } from "@/lib/client/onboarding/use-footprint-connectors";
import { Button, buttonClass } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { TextField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { StatusChip, Tag, type Tone } from "@/components/ui/StatusChip";
import { useConfirm, toast } from "@/components/ui/Feedback";
import { SourceMark } from "./SourceMark";
import { GitHubPrivateAccessControls } from "./GitHubPrivateAccessControls";
import { leaveAfter } from "./leave-after";

export const STATUS_VIEW: Record<FootprintStatus, { label: string; tone: Tone }> = {
  not_connected: { label: "Not connected", tone: "neutral" },
  linked: { label: "Linked", tone: "signal" },
  detected: { label: "Found, not verified", tone: "warning" },
  connected: { label: "Connected", tone: "verified" },
  imported: { label: "Imported", tone: "verified" },
  partial: { label: "Partly imported", tone: "warning" },
  importing: { label: "Importing", tone: "busy" },
  failed: { label: "Import failed", tone: "danger" },
  revoked: { label: "Access revoked", tone: "danger" },
};

export type ConnectorApi = {
  profiles: Partial<Record<string, string>>;
  statuses: Record<string, FootprintStatus>;
  summaries: Record<string, { text: string; partial: boolean; at: string }>;
  errors: Record<string, string>;
  busy: string | null;
  fromCv: Set<string>;
  importFrom: (provider: string, identifier: string, upload?: { name: string; content: string } | null) => Promise<boolean>;
  disconnect: (provider: string) => Promise<string | null>;
};

export function ConnectorList({ api, returnTo, eoraId = "eora-connections-grid", grouped = false, exclude = [], beforeLeave }: {
  api: ConnectorApi;
  returnTo: string;
  eoraId?: string;
  /** Awaited before leaving for GitHub (sign-in or app install). */
  beforeLeave?: () => Promise<unknown>;
  /** Group rows by what each source is for (onboarding) instead of linked / available. */
  grouped?: boolean;
  exclude?: string[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = PLATFORMS.filter((p) => !exclude.includes(p.id));
  const linked = shown.filter((p) => api.profiles[p.id]);
  const rest = shown.filter((p) => !api.profiles[p.id]);

  const row = (id: string) => {
    const p = platformById(id)!;
    const status = api.statuses[id] ?? (api.profiles[id] ? "linked" : "not_connected");
    const view = STATUS_VIEW[status];
    const connected = Boolean(api.profiles[id]);
    const summary = api.summaries[id];
    return (
      <li key={id} data-eora-id={id === "github" ? "eora-connection-github" : undefined} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
        <SourceMark id={id} />
        <div className="min-w-0 flex-1 basis-40">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{p.name}</span>
            {api.fromCv.has(id) && connected && <Tag>From your CV</Tag>}
          </p>
          <p className="mt-0.5 break-words text-sm text-muted">{summary?.text ?? (connected ? api.profiles[id] : p.capability)}</p>
          {!connected && <p className="mt-0.5 text-xs text-text-muted">How it connects: {p.method}</p>}
        </div>
        <div className="flex w-full items-center justify-between gap-2 min-[480px]:w-auto min-[480px]:justify-end">
          <StatusChip tone={view.tone}>{view.label}</StatusChip>
          <Button size="sm" variant="secondary" loading={api.busy === id} loadingLabel="Working…" onClick={() => setOpenId(id)}>
            {status === "failed" ? "Retry" : status === "revoked" ? "Reconnect" : connected ? "Manage" : "Connect"}
          </Button>
        </div>
      </li>
    );
  };

  if (grouped) {
    return (
      <div data-eora-id={eoraId} className="flex flex-col gap-6">
        {PLATFORM_GROUPS.map((g) => {
          const rows = shown.filter((p) => p.group === g.id);
          if (!rows.length) return null;
          return (
            <section key={g.id} aria-labelledby={`group-${g.id}`}>
              <h3 id={`group-${g.id}`} className="font-display text-sm font-semibold text-text-primary">{g.name}</h3>
              <p className="mb-2 text-xs text-text-muted">{g.purpose}</p>
              <ul className="divide-y divide-border-medium rounded-card border border-border-medium bg-bg-elevated shadow-card">{rows.map((p) => row(p.id))}</ul>
            </section>
          );
        })}
        {openId && <ConnectorDrawer id={openId} api={api} returnTo={returnTo} beforeLeave={beforeLeave} onClose={() => setOpenId(null)} />}
      </div>
    );
  }

  return (
    <div data-eora-id={eoraId} className="flex flex-col gap-5">
      {linked.length > 0 && (
        <section aria-labelledby="linked-title">
          <h3 id="linked-title" className="mb-2 font-display text-sm font-semibold text-text-primary">Linked <span className="font-mono text-text-muted tabular">{linked.length}</span></h3>
          <ul className="divide-y divide-border-medium rounded-card border border-border-medium bg-bg-elevated shadow-card">{linked.map((p) => row(p.id))}</ul>
        </section>
      )}
      <section aria-labelledby="available-title">
        <h3 id="available-title" className="mb-2 font-display text-sm font-semibold text-text-primary">{linked.length ? "More you can add" : "Available"} <span className="font-mono text-text-muted tabular">{rest.length}</span></h3>
        <ul className="divide-y divide-border-medium rounded-card border border-border-medium bg-bg-elevated shadow-card">{rest.map((p) => row(p.id))}</ul>
      </section>
      {openId && <ConnectorDrawer id={openId} api={api} returnTo={returnTo} beforeLeave={beforeLeave} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ConnectorDrawer({ id, api, returnTo, beforeLeave, onClose }: { id: string; api: ConnectorApi; returnTo: string; beforeLeave?: () => Promise<unknown>; onClose: () => void }) {
  const p = platformById(id)!;
  const [value, setValue] = useState(api.profiles[id] && !String(api.profiles[id]).startsWith("Archive:") ? String(api.profiles[id]) : "");
  const [upload, setUpload] = useState<{ name: string; content: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const status = api.statuses[id] ?? (api.profiles[id] ? "linked" : "not_connected");
  const connected = Boolean(api.profiles[id]);
  const busy = api.busy === id;
  const summary = api.summaries[id];
  const error = api.errors[id];

  // Close once an import lands successfully (the previous version closed on a stale flag).
  const [done, setDone] = useState(false);
  useEffect(() => { if (done) { const t = setTimeout(onClose, 1200); return () => clearTimeout(t); } }, [done, onClose]);

  const run = async () => {
    const ok = await api.importFrom(id, value, upload);
    if (ok) { setDone(true); toast.success(`${p.name} ${upload ? "export imported" : "linked"}`, "Anything we found is waiting for your review."); }
  };
  const remove = async () => {
    const ok = await confirm({
      title: `Disconnect ${p.name}?`,
      body: "We stop reading this account. Details you already confirmed on your profile stay until you remove them.",
      confirmLabel: "Disconnect",
      destructive: true,
    });
    if (!ok) return;
    const problem = await api.disconnect(id);
    if (problem) toast.error(`${p.name} is still connected`, problem);
    else { toast.success(`${p.name} disconnected`); onClose(); }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={p.name}
      description={p.capability}
      initialFocus={input}
      headerActions={<StatusChip tone={STATUS_VIEW[status].tone}>{STATUS_VIEW[status].label}</StatusChip>}
      footer={
        <>
          {connected && <Button variant="danger" className="mr-auto" icon={<Trash size={16} aria-hidden="true" />} onClick={() => void remove()}>Disconnect</Button>}
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" loading={busy} loadingLabel="Importing…" onClick={() => void run()} icon={connected ? <ArrowClockwise size={16} aria-hidden="true" /> : <Plugs size={16} aria-hidden="true" />}>
            {upload ? "Import file" : connected ? "Refresh" : p.actionLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {summary && (
          <Banner kind={summary.partial ? "warning" : "success"} title={summary.partial ? "Partly imported" : "Last import"}>
            {summary.text} · {summary.at}
          </Banner>
        )}
        {done && <Banner kind="success">Done. Closing…</Banner>}
        {error && <Banner kind="danger" title="That didn't work">{error}</Banner>}

        {id === "github" && (
          <div className="rounded-lg border border-border-medium bg-bg-surface/50 p-3.5 text-sm">
            <p className="font-medium text-text-primary">Three levels of GitHub access</p>
            <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-text-muted">
              <li><span className="text-text-primary">Username:</span> reads your public repositories. It does not prove the account is yours or reach private repositories.</li>
              <li><span className="text-text-primary">Sign in with GitHub:</span> confirms the account is yours. It asks only to read your public profile (<code className="font-mono text-xs">read:user</code>), still public repositories only.</li>
              <li><span className="text-text-primary">Install the GitHub App:</span> on GitHub you choose exactly which repositories, including private ones, we may read. Access is read-only and you can revoke it in GitHub settings.</li>
            </ol>
            {status !== "connected" && (
              <>
                {status === "detected" && <p className="mt-2 text-text-muted">We read this account&apos;s public repositories, but haven&apos;t confirmed it&apos;s yours.</p>}
                <a className={buttonClass("secondary", "sm", "mt-3")} href={`/api/auth/github/start?returnTo=${encodeURIComponent(returnTo)}`} onClick={leaveAfter(beforeLeave)}>
                  <ArrowSquareOut size={16} aria-hidden="true" /> Sign in with GitHub
                </a>
                <p className="mt-2 text-xs text-text-muted">You&apos;ll leave this page for GitHub and come back here. Your progress is saved.</p>
              </>
            )}
          </div>
        )}

        {id === "github" && connected && <GitHubPrivateAccessControls returnTo={returnTo} beforeLeave={beforeLeave} />}

        <TextField
          ref={input}
          label={p.type === "EXPORT_REQUIRED" ? `${p.name} profile (optional with an export)` : `${p.name} username or profile link`}
          placeholder={p.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void run(); } }}
        />

        {p.supportsExportUpload && (
          <div>
            <input ref={fileInput} type="file" accept=".csv,.json,.zip" className="sr-only" tabIndex={-1} aria-hidden="true"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try { setUpload(await readExportFile(file)); setFileError(null); } catch (err) { setFileError(err instanceof Error ? err.message : "That file couldn't be read."); }
              }} />
            <Button variant="secondary" icon={<FileArrowUp size={16} aria-hidden="true" />} onClick={() => fileInput.current?.click()}>
              {upload ? `Using ${upload.name}` : "Upload an export (.zip, .csv or .json)"}
            </Button>
            {upload && <Button variant="ghost" size="sm" className="ml-2" onClick={() => setUpload(null)}>Remove file</Button>}
            {fileError && <p role="alert" className="mt-2 text-sm text-danger">{fileError}</p>}
          </div>
        )}

        <div className="grid gap-4 border-t border-border-medium pt-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-display text-sm font-medium text-text-primary"><CheckCircle size={16} aria-hidden="true" className="text-champagne" />What we read</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">{p.dataCollected.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-display text-sm font-medium text-text-primary"><ShieldCheck size={16} aria-hidden="true" className="text-champagne" />Our promises</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">{p.guarantees.map((g) => <li key={g}>{g}</li>)}</ul>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
