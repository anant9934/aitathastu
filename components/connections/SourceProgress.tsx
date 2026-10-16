"use client";

/**
 * Live per-source import progress (Tasks 1.9.4, 2.1.3, 2.1.10). Segments fill
 * only when a source really settles; there are no timers faking progress.
 * `onReadyToReview` fires once, when CV and GitHub have settled or after
 * `timeoutMs`, whichever is first; slower sources keep importing.
 */
import React, { useEffect, useRef, useState } from "react";
import { ArrowClockwise, ArrowSquareOut, Key } from "@phosphor-icons/react/dist/ssr";
import { ACTIVE, IN_FLIGHT, SOURCE_LABELS, syncHeadline, useSyncStatus, type SourceStatus } from "@/lib/client/use-sync-status";
import { requestJson, describeError } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { StatusChip, type Tone } from "@/components/ui/StatusChip";
import { Button, buttonClass } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Skeleton, LoadingRegion } from "@/components/ui/Skeleton";
import { cn } from "@/lib/client/cn";
import { OtpDialog } from "./OtpDialog";

const STATE_VIEW: Record<string, { label: string; tone: Tone }> = {
  succeeded: { label: "Done", tone: "verified" },
  partial: { label: "Mostly imported", tone: "warning" },
  queued: { label: "Waiting to start", tone: "busy" },
  running: { label: "Importing", tone: "busy" },
  awaiting_user: { label: "Needs your code", tone: "warning" },
  failed: { label: "Will retry", tone: "warning" },
  timed_out: { label: "Timed out, will retry", tone: "warning" },
  dead_letter: { label: "Didn't work", tone: "danger" },
  skipped_optional: { label: "Skipped", tone: "neutral" },
  not_started: { label: "Not connected", tone: "neutral" },
};

const STAGE_LABELS: Record<string, string> = {
  awaiting_extractor: "waking up the document reader",
  acquire: "receiving your file", parse: "reading the pages", extract: "pulling out details",
  validate: "checking what we found", normalize: "tidying details", merge: "combining sources",
  review: "ready for your review", persist: "saving",
};

const SEGMENT: Record<Tone, string> = {
  verified: "bg-verified", warning: "bg-warning", danger: "bg-danger", busy: "bg-line-strong/50 animate-pulse motion-reduce:animate-none",
  neutral: "bg-line", corroborated: "bg-corroborated", evidenced: "bg-evidenced", gap: "bg-line", signal: "bg-signal",
};

const when = (iso?: string | null) =>
  iso ? formatDate(iso, true) : "";

export function SourceProgress({
  variant = "full",
  primarySources = ["resume", "github"],
  timeoutMs = 8000,
  onReadyToReview,
  showNotStarted = false,
}: {
  variant?: "full" | "summary" | "manage";
  primarySources?: string[];
  timeoutMs?: number;
  onReadyToReview?: (why: "primary_settled" | "timeout") => void;
  /** Also list sources that were never connected (connections page). */
  showNotStarted?: boolean;
}) {
  const { data, error, reload } = useSyncStatus();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [otpSeconds, setOtpSeconds] = useState<number | null>(null);
  const fired = useRef(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!onReadyToReview) return;
    const id = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(id);
  }, [timeoutMs, onReadyToReview]);

  // A pending LinkedIn code holds the move: leaving would strand the 60 s window.
  const primarySettled = Boolean(data) && data!.sources.filter((s) => primarySources.includes(s.source)).every((s) => !ACTIVE.has(s.state));
  const awaitingUser = Boolean(data?.sources.some((s) => s.state === "awaiting_user"));
  useEffect(() => {
    if (fired.current || !onReadyToReview || awaitingUser || otpSeconds !== null) return;
    if (!primarySettled && !timedOut) return;
    fired.current = true;
    onReadyToReview(primarySettled ? "primary_settled" : "timeout");
  }, [primarySettled, timedOut, awaitingUser, otpSeconds, onReadyToReview]);

  const act = async (source: string, run: () => ReturnType<typeof requestJson>) => {
    setBusy(source);
    setActionError((e) => ({ ...e, [source]: "" }));
    const res = await run();
    if (!res.ok) setActionError((e) => ({ ...e, [source]: describeError(res.error) }));
    await reload();
    setBusy(null);
  };
  const retry = (source: string) => act(source, () => requestJson("/api/student/sync-status/retry", { method: "POST", json: { source } }));
  const skipLinkedIn = () => { setOtpSeconds(null); return act("linkedin", () => requestJson("/api/student/linkedin/skip", { method: "POST" })); };
  const openOtp = async () => {
    const res = await requestJson<{ challengeSecondsLeft?: number }>("/api/student/linkedin", { cache: "no-store" });
    setOtpSeconds(res.ok && typeof res.data?.challengeSecondsLeft === "number" ? res.data.challengeSecondsLeft : 60);
  };

  const all = data?.sources ?? [];
  const requested = all.filter((s) => s.state !== "not_started");
  const rows = showNotStarted ? all : requested;
  const notConnected = all.filter((s) => s.state === "not_started");
  const settled = requested.filter((s) => !IN_FLIGHT.has(s.state)).length;

  if (variant === "summary" && data && requested.length === 0 && !error) return null;

  return (
    <div className="flex flex-col gap-3">
      {variant === "full" && (
        <p className="text-base font-medium" aria-live="polite">
          {!data ? "Checking on your imports…" : requested.length === 0 ? "Nothing is importing. You can review and add details yourself." : syncHeadline(requested)}
        </p>
      )}
      {error && <Banner kind="warning">{error}</Banner>}

      {!data ? (
        <LoadingRegion label="Loading import status" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)}
        </LoadingRegion>
      ) : (
        <>
          {variant === "full" && requested.length > 0 && (
            <div
              role="progressbar"
              aria-label="Sources finished"
              aria-valuemin={0}
              aria-valuemax={requested.length}
              aria-valuenow={settled}
              aria-valuetext={`${settled} of ${requested.length} sources finished`}
              className="flex h-2 gap-1"
            >
              {requested.map((s) => {
                const view = STATE_VIEW[s.state] ?? STATE_VIEW.queued;
                return <span key={s.source} className={cn("h-full flex-1 rounded-full", SEGMENT[view.tone])} />;
              })}
            </div>
          )}

          {rows.length > 0 && (
            <ul className={cn("divide-y divide-border-medium rounded-lg border border-border-medium", variant === "summary" ? "bg-bg-elevated shadow-card" : "bg-bg-surface/50")}>
              {rows.map((s) => (
                <SourceRow
                  key={s.source}
                  s={s}
                  variant={variant}
                  busy={busy === s.source}
                  error={actionError[s.source]}
                  onRetry={() => void retry(s.source)}
                  onOtp={() => void openOtp()}
                  onSkipLinkedIn={() => void skipLinkedIn()}
                />
              ))}
            </ul>
          )}

          {variant === "full" && notConnected.length > 0 && (
            <p className="text-sm text-muted">
              Not connected: {notConnected.map((s) => SOURCE_LABELS[s.source] ?? s.source).join(", ")}. All optional; add any of them later from Connections.
            </p>
          )}
        </>
      )}

      {otpSeconds !== null && (
        <OtpDialog secondsLeft={otpSeconds} onSubmitted={() => { setOtpSeconds(null); void reload(); }} onSkip={() => void skipLinkedIn()} />
      )}
    </div>
  );
}

function SourceRow({ s, variant, busy, error, onRetry, onOtp, onSkipLinkedIn }: {
  s: SourceStatus;
  variant: "full" | "summary" | "manage";
  busy: boolean;
  error?: string;
  onRetry: () => void;
  onOtp: () => void;
  onSkipLinkedIn: () => void;
}) {
  const view = STATE_VIEW[s.state] ?? STATE_VIEW.queued;
  const label = SOURCE_LABELS[s.source] ?? s.source;
  const detail = s.state === "running" && s.stage ? STAGE_LABELS[s.stage] : s.found;
  const showReason = variant !== "summary" && (s.reason || error);
  return (
    <li data-source={s.source} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
      <span className="min-w-[6.5rem] font-medium">{label}</span>
      <span className="flex min-w-0 flex-1 basis-40 flex-wrap items-center gap-2">
        <StatusChip tone={view.tone}>{view.label}</StatusChip>
        {detail && <span className="min-w-0 truncate text-sm text-muted">{detail}</span>}
        {variant === "manage" && s.state === "succeeded" && s.finishedAt && (
          <span className="font-mono text-2xs tabular text-muted">{when(s.finishedAt)}</span>
        )}
      </span>
      <span className="flex flex-wrap gap-2">
        {s.source === "linkedin" && s.state === "awaiting_user" && (
          <>
            <Button size="sm" variant="primary" icon={<Key size={16} aria-hidden="true" />} onClick={onOtp}>Enter code</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onSkipLinkedIn}>Skip LinkedIn</Button>
          </>
        )}
        {s.canRetry && s.action === "reconnect" && s.reconnectUrl ? (
          <a className={buttonClass("secondary", "sm")} href={s.reconnectUrl}>
            <ArrowSquareOut size={16} aria-hidden="true" /> Reconnect
          </a>
        ) : s.canRetry ? (
          <Button size="sm" variant="secondary" loading={busy} loadingLabel="Retrying…" onClick={onRetry} aria-label={`Retry ${label}`} icon={<ArrowClockwise size={16} aria-hidden="true" />}>
            Retry
          </Button>
        ) : null}
      </span>
      {showReason && (
        <p className="w-full max-w-[68ch] text-sm text-muted">
          {s.reason}
          {s.state === "failed" && s.nextAutomaticRetryAt ? ` Next automatic try: ${when(s.nextAutomaticRetryAt)}.` : ""}
          {error && <span role="alert" className="block text-danger">{error}</span>}
        </p>
      )}
    </li>
  );
}
