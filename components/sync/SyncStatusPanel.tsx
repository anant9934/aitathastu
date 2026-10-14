"use client";

/**
 * Per-source sync status with plain-language failures and a Retry action
 * (Task 1.9.4). Reads GET /api/student/sync-status (DB only, never syncs);
 * Retry posts to /api/student/sync-status/retry. States follow
 * docs/ONBOARDING_SYNC_STATE_MACHINE.md; every state shows an icon and a
 * word, never colour alone.
 */
import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock, KeyRound, RefreshCw, XCircle } from "lucide-react";

type SourceStatus = {
  source: string;
  state: string;
  reason?: string | null;
  canRetry: boolean;
  action?: "retry" | "reconnect";
  reconnectUrl?: string | null;
  attempts?: number;
  maxAttempts?: number;
  nextAutomaticRetryAt?: string | null;
  finishedAt?: string | null;
};
type StatusResponse = { sources: SourceStatus[]; aggregate: { status: string; headline: string } };

const LABELS: Record<string, string> = {
  resume: "CV", github: "GitHub", linkedin: "LinkedIn", scholar: "Research papers",
  kaggle: "Kaggle", leetcode: "LeetCode", hackerrank: "HackerRank",
};

const STATE_VIEW: Record<string, { label: string; tone: "ok" | "busy" | "warn" | "bad" | "idle"; Icon: typeof Circle }> = {
  succeeded: { label: "Up to date", tone: "ok", Icon: CheckCircle2 },
  partial: { label: "Mostly imported", tone: "warn", Icon: AlertTriangle },
  queued: { label: "Waiting to start", tone: "busy", Icon: Clock },
  running: { label: "Importing", tone: "busy", Icon: RefreshCw },
  awaiting_user: { label: "Needs your code", tone: "warn", Icon: KeyRound },
  failed: { label: "Will retry", tone: "warn", Icon: AlertTriangle },
  timed_out: { label: "Timed out, will retry", tone: "warn", Icon: AlertTriangle },
  dead_letter: { label: "Didn't work", tone: "bad", Icon: XCircle },
  skipped_optional: { label: "Skipped, optional", tone: "idle", Icon: Circle },
  not_started: { label: "Not connected, optional", tone: "idle", Icon: Circle },
};

const TONE: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "var(--mint)", fg: "#1f6b4a" },
  busy: { bg: "var(--amber)", fg: "#8a5a00" },
  warn: { bg: "var(--amber)", fg: "#8a5a00" },
  bad: { bg: "#FDEBEC", fg: "#9F2F2D" },
  idle: { bg: "var(--ivory)", fg: "var(--muted)" },
};

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export function SyncStatusPanel({ showNotStarted = false }: { showNotStarted?: boolean }) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/student/sync-status", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 401 ? "Sign in to see your data sources." : "We couldn't load sync status.");
      setData(await res.json());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "We couldn't load sync status.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Poll only while something is in flight; stop once everything settles.
  const inFlight = data?.sources.some((s) => ["queued", "running", "awaiting_user"].includes(s.state));
  useEffect(() => {
    if (!inFlight) return;
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [inFlight, load]);

  const retry = async (source: string) => {
    setRetrying(source);
    setRetryError((e) => ({ ...e, [source]: "" }));
    try {
      const res = await fetch("/api/student/sync-status/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRetryError((e) => ({ ...e, [source]: body.error || "Retry didn't start. Try again in a minute." }));
      }
      await load();
    } finally {
      setRetrying(null);
    }
  };

  if (loadError) {
    return (
      <section style={panel} aria-labelledby="sync-status-title">
        <h2 id="sync-status-title" style={title}>Your data sources</h2>
        <p role="alert" style={{ margin: 0, color: "#9F2F2D", fontSize: 14 }}>
          {loadError} <button type="button" onClick={() => void load()} style={linkButton}>Try again</button>
        </p>
      </section>
    );
  }
  if (!data) {
    return (
      <section style={panel} aria-busy="true" aria-labelledby="sync-status-title">
        <h2 id="sync-status-title" style={title}>Your data sources</h2>
        <div style={{ height: 96, borderRadius: 8, background: "var(--ivory)" }} />
      </section>
    );
  }

  const rows = data.sources.filter((s) => showNotStarted || s.state !== "not_started");

  return (
    <section style={panel} aria-labelledby="sync-status-title">
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <h2 id="sync-status-title" style={title}>Your data sources</h2>
        <p aria-live="polite" style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>{data.aggregate.headline}</p>
      </header>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: "var(--muted)" }}>
          Nothing connected yet. Every source is optional; connect any of them whenever you like.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((s) => {
            const view = STATE_VIEW[s.state] ?? STATE_VIEW.not_started;
            const tone = TONE[view.tone];
            const busy = retrying === s.source;
            return (
              <li key={s.source} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "4px 12px", padding: "14px 0", borderTop: "1px solid var(--line)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 650, fontSize: 15 }}>{LABELS[s.source] ?? s.source}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 10px", borderRadius: 9999, background: tone.bg, color: tone.fg, fontSize: 12, fontWeight: 650 }}>
                    <view.Icon aria-hidden="true" className={s.state === "running" ? "w-3.5 h-3.5 animate-spin motion-reduce:animate-none" : "w-3.5 h-3.5"} />
                    {view.label}
                  </span>
                  {s.state === "succeeded" && s.finishedAt && <span style={{ fontSize: 13, color: "var(--muted)" }}>{when(s.finishedAt)}</span>}
                </div>
                <div style={{ gridRow: "span 2", alignSelf: "center" }}>
                  {s.canRetry && s.action === "reconnect" && s.reconnectUrl ? (
                    <a href={s.reconnectUrl} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 88, padding: "0 16px", borderRadius: 8, background: "var(--ink)", color: "#fff", fontSize: 14, fontWeight: 650 }}>
                      Reconnect
                    </a>
                  ) : s.canRetry && (
                    <button
                      type="button"
                      onClick={() => void retry(s.source)}
                      disabled={busy}
                      aria-label={`Retry ${LABELS[s.source] ?? s.source}`}
                      style={{ minHeight: 44, minWidth: 88, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--white)", color: "var(--ink)", fontSize: 14, fontWeight: 650, opacity: busy ? 0.5 : 1, cursor: busy ? "default" : "pointer" }}
                    >
                      {busy ? "Retrying…" : "Retry"}
                    </button>
                  )}
                </div>
                {(s.reason || retryError[s.source]) && (
                  <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", maxWidth: "62ch" }}>
                    {s.reason}
                    {s.state === "failed" && s.nextAutomaticRetryAt ? ` Next automatic try: ${when(s.nextAutomaticRetryAt)}.` : ""}
                    {retryError[s.source] && <span role="alert" style={{ display: "block", color: "#9F2F2D" }}>{retryError[s.source]}</span>}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const panel: React.CSSProperties = { background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, padding: "20px 24px" };
const title: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 680, letterSpacing: "-0.02em" };
const linkButton: React.CSSProperties = { background: "none", border: 0, padding: 0, color: "var(--violet)", fontWeight: 650, textDecoration: "underline" };
