"use client";

/**
 * LinkedIn: extract the student's public profile from its URL.
 *
 * One URL field and one action at a time (Extract, Refresh, or Retry), with
 * progress while the server-side job runs, what was saved per section, and the
 * saved details. The job lives on the server, so leaving and coming back shows
 * the same state. When extraction isn't configured on this server, the profile
 * link can still be saved on its own.
 *
 * No LinkedIn password, session or data export is ever asked for.
 * This step is optional; onboarding and scoring work without it.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { LinkedinLogo, MagnifyingGlass, ArrowsClockwise, CheckCircle, WarningCircle, Spinner, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError, waitPhrase } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { Banner } from "@/components/ui/Banner";

type Kind = "experience" | "education" | "skill" | "language" | "certification" | "course" | "project" | "publication" | "volunteering" | "honor" | "link";
type State = "not_connected" | "ready" | "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";
type JobView = {
  id: string; state: State; trigger: "initial" | "refresh" | "retry"; step: "waiting" | "starting" | "extracting" | "saving" | "done";
  attempt: number; maxAttempts: number; retryAt: string | null; profileUrl: string; message: string | null;
  counts: Partial<Record<Kind, number>>; unavailableSections: Kind[];
};
type SavedRecord = { kind: Kind; data: Record<string, unknown>; missing: boolean };
type Snapshot = {
  configured: boolean; notConfiguredMessage?: string; state: State; profileUrl: string | null; lastSuccessfulAt: string | null;
  job: JobView | null; profile: { fullName: string | null; headline: string | null; location: string | null; about: string | null } | null;
  counts: Record<Kind, number> | null; records: SavedRecord[];
};

const SECTIONS: Array<{ kind: Kind; label: string }> = [
  { kind: "experience", label: "Experience" }, { kind: "education", label: "Education" }, { kind: "skill", label: "Skills" },
  { kind: "language", label: "Languages" }, { kind: "certification", label: "Certifications" }, { kind: "course", label: "Courses" },
  { kind: "project", label: "Projects" }, { kind: "publication", label: "Publications" }, { kind: "volunteering", label: "Volunteering" },
  { kind: "honor", label: "Honors & awards" }, { kind: "link", label: "Websites" },
];
const STEP_TEXT: Record<JobView["step"], string> = {
  waiting: "Waiting to start…", starting: "Contacting the extraction service…", extracting: "Reading your public profile…", saving: "Saving what was found…", done: "",
};
const ACTIVE = (s: State | undefined) => s === "queued" || s === "running";
const s = (v: unknown) => (typeof v === "string" ? v : "");

function recordLine(r: SavedRecord): { title: string; detail: string } {
  const d = r.data;
  const dates = [s(d.startDate), d.current ? "Present" : s(d.endDate)].filter(Boolean).join(" – ");
  switch (r.kind) {
    case "experience": return { title: `${s(d.title)} · ${s(d.company)}`, detail: [dates, s(d.location)].filter(Boolean).join(" · ") };
    case "education": return { title: s(d.institution), detail: [s(d.degree), s(d.fieldOfStudy), dates].filter(Boolean).join(" · ") };
    case "certification": case "course": return { title: s(d.name), detail: [s(d.issuer), s(d.issueDate)].filter(Boolean).join(" · ") };
    case "language": return { title: s(d.name), detail: s(d.proficiency) };
    case "volunteering": return { title: [s(d.role), s(d.organization)].filter(Boolean).join(" · "), detail: dates };
    case "link": return { title: s(d.url), detail: s((d.website as Record<string, unknown> | undefined)?.title) };
    case "skill": return { title: s(d.name), detail: "" };
    default: return { title: s(d.title), detail: [s(d.publisher) || s(d.issuer) || s(d.organization), s(d.date)].filter(Boolean).join(" · ") };
  }
}

export function LinkedInConnect({ onSettled }: { onSettled?: (state: string) => void }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkSaved, setLinkSaved] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDelay = useRef(2500);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const wasActive = useRef(false);

  const load = useCallback(async () => {
    const res = await requestJson<Snapshot>("/api/student/linkedin/extract", { cache: "no-store" });
    if (!res.ok) { setLoadError(describeError(res.error)); return null; }
    setLoadError(null);
    setSnap(res.data);
    setUrl((u) => u || res.data.profileUrl || "");
    const active = ACTIVE(res.data.job?.state);
    if (wasActive.current && !active && (res.data.state === "succeeded" || res.data.state === "partial")) onSettledRef.current?.("succeeded");
    wasActive.current = active;
    return res.data;
  }, []);

  const schedule = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(async () => {
      const data = await load();
      if (data && ACTIVE(data.job?.state)) {
        pollDelay.current = Math.min(8000, pollDelay.current * 1.4);
        schedule();
      }
    }, pollDelay.current);
  }, [load]);

  useEffect(() => {
    void load().then((data) => { if (data && ACTIVE(data.job?.state)) schedule(); });
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [load, schedule]);

  const act = useCallback(async (action: "start" | "retry" | "refresh") => {
    setActionError(null);
    const value = url.trim();
    if (action === "start" && !value) { setUrlError("Enter your LinkedIn profile URL."); return; }
    setBusy(true);
    const res = await requestJson<{ job: JobView }>("/api/student/linkedin/extract", { method: "POST", json: { action, ...(value ? { profileUrl: value } : {}) } });
    setBusy(false);
    if (!res.ok) {
      if (res.error.code === "invalid_url") setUrlError(res.error.message);
      else setActionError(res.error.kind === "rate_limited" && res.error.code !== "cooldown" && res.error.code !== "daily_limit" ? `Too many attempts. Try again ${waitPhrase(res.error.retryAfter)}.` : describeError(res.error));
      void load();
      return;
    }
    wasActive.current = true;
    pollDelay.current = 2500;
    setSnap((prev) => (prev ? { ...prev, state: res.data.job.state, job: res.data.job } : prev));
    schedule();
  }, [url, load, schedule]);

  const cancel = useCallback(async () => {
    setBusy(true);
    const res = await requestJson("/api/student/linkedin/extract", { method: "DELETE" });
    setBusy(false);
    if (!res.ok && res.status !== 409) setActionError(describeError(res.error));
    void load();
  }, [load]);

  const saveLinkOnly = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    if (!url.trim()) { setUrlError("Enter your LinkedIn profile URL."); return; }
    setBusy(true);
    const res = await requestJson("/api/student/linkedin", { method: "POST", json: { profileUrl: url.trim(), consent: true } });
    setBusy(false);
    if (!res.ok) { setUrlError(describeError(res.error)); return; }
    setLinkSaved(true);
    onSettledRef.current?.("succeeded");
    void load();
  }, [url, load]);

  const job = snap?.job ?? null;
  const state: State | undefined = snap?.state;
  const active = ACTIVE(job?.state);
  const hasProfile = Boolean(snap?.profile);
  const normalized = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
  const sameUrl = Boolean(snap?.profileUrl && normalized(url) === normalized(snap.profileUrl));
  const primary: { action: "start" | "retry" | "refresh"; label: string; icon: React.ReactNode } =
    hasProfile && sameUrl ? { action: "refresh", label: "Refresh profile", icon: <ArrowsClockwise size={16} aria-hidden="true" /> }
      : (state === "failed" || state === "cancelled") && sameUrl ? { action: "retry", label: "Retry extraction", icon: <ArrowsClockwise size={16} aria-hidden="true" /> }
      : { action: "start", label: "Extract LinkedIn Profile", icon: <MagnifyingGlass size={16} aria-hidden="true" /> };

  const chip = !snap ? null
    : active ? <StatusChip tone="busy" icon={null}>{job?.state === "queued" ? "Queued" : "Extracting"}</StatusChip>
    : state === "succeeded" ? <StatusChip tone="verified" icon={CheckCircle}>Extracted</StatusChip>
    : state === "partial" ? <StatusChip tone="warning" icon={null}>Partly extracted</StatusChip>
    : state === "failed" ? <StatusChip tone="danger" icon={null}>Failed</StatusChip>
    : state === "cancelled" ? <StatusChip tone="neutral" icon={null}>Cancelled</StatusChip>
    : state === "ready" || linkSaved ? <StatusChip tone="corroborated" icon={null}>Profile linked</StatusChip>
    : <StatusChip tone="neutral" icon={null}>Optional</StatusChip>;

  const counts = snap?.counts;
  const unavailable = new Set(job && !active ? job.unavailableSections : []);
  const records = snap?.records ?? [];

  return (
    <section aria-labelledby="li-title" className="rounded-card border border-border-medium bg-bg-elevated p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <LinkedinLogo size={22} aria-hidden="true" className="text-champagne" />
        <h3 id="li-title" className="font-display text-base font-semibold text-text-primary">LinkedIn</h3>
        {chip}
      </div>
      <p className="mt-2 max-w-[62ch] text-sm text-text-muted">
        Reads your public profile: roles, education, skills, certifications and more. No password or data export needed. Skipping is always fine.
      </p>

      {loadError && !snap && <div className="mt-3"><Banner kind="danger">{loadError}</Banner></div>}

      {snap && (
        <form
          className="mt-4 grid max-w-xl gap-3"
          noValidate
          onSubmit={(e) => { if (snap.configured) { e.preventDefault(); void act(primary.action); } else void saveLinkOnly(e); }}
        >
          <TextField
            label="LinkedIn profile URL"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://www.linkedin.com/in/your-name"
            value={url}
            disabled={active}
            error={urlError}
            hint="Your public profile address, from linkedin.com/in/…"
            onChange={(e) => { setUrl(e.target.value); setUrlError(null); setActionError(null); }}
          />
          {!snap.configured && (
            <Banner kind="info">{snap.notConfiguredMessage ?? "LinkedIn extraction isn't available on this server yet."}</Banner>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {snap.configured ? (
              active ? (
                <>
                  <Button type="button" variant="primary" loading loadingLabel="Extracting…" disabled>{primary.label}</Button>
                  <Button type="button" variant="ghost" onClick={() => void cancel()} disabled={busy}>Cancel</Button>
                </>
              ) : (
                <Button type="submit" variant={primary.action === "refresh" ? "secondary" : "primary"} icon={primary.icon} loading={busy} loadingLabel="Starting…">
                  {primary.label}
                </Button>
              )
            ) : (
              <Button type="submit" variant="secondary" loading={busy} loadingLabel="Saving…" disabled={linkSaved && sameUrl}>
                {linkSaved || state === "ready" ? "Link saved" : "Save profile link"}
              </Button>
            )}
          </div>
        </form>
      )}

      {actionError && <div className="mt-3 max-w-xl"><Banner kind="danger">{actionError}</Banner></div>}

      {active && job && (
        <p aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-text-primary">
          <Spinner size={14} aria-hidden="true" className="shrink-0 animate-spin" />
          <span>
            {job.retryAt ? `${job.message ?? "Retrying automatically."} Next attempt ${formatDate(job.retryAt, true)}.` : STEP_TEXT[job.step]}
            {job.attempt > 1 && ` (attempt ${job.attempt} of ${job.maxAttempts})`}
          </span>
        </p>
      )}

      {!active && job?.state === "failed" && job.message && (
        <div className="mt-3 max-w-xl"><Banner kind="warning">{job.message}{hasProfile ? " Your previously extracted profile is unchanged." : ""}</Banner></div>
      )}
      {!active && job?.state === "partial" && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-warning">
          <WarningCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          Some sections weren&apos;t available from your public profile; everything that was is saved below.
        </p>
      )}

      {snap?.lastSuccessfulAt && (
        <p className="mt-3 text-xs text-text-muted">Last extracted {formatDate(snap.lastSuccessfulAt, true)}</p>
      )}

      {counts && (
        <div className="mt-3">
          {snap?.profile && (snap.profile.fullName || snap.profile.headline) && (
            <p className="text-sm text-text-primary">
              <span className="font-semibold">{snap.profile.fullName}</span>
              {snap.profile.headline && <span className="text-text-muted"> · {snap.profile.headline}</span>}
            </p>
          )}
          <ul aria-label="Saved from LinkedIn" className="mt-2 flex flex-wrap gap-1.5">
            {SECTIONS.map(({ kind, label }) => (
              <li key={kind} className={`rounded-full border px-2.5 py-0.5 text-xs ${counts[kind] ? "border-border-medium text-text-primary" : "border-line-soft text-text-muted"}`}>
                {label} {counts[kind] ? <span className="font-semibold tabular-nums">{counts[kind]}</span> : unavailable.has(kind) ? "· not available" : "· none"}
              </li>
            ))}
          </ul>
          {records.length > 0 && (
            <div className="mt-3">
              <Button variant="ghost" size="sm" aria-expanded={showDetails} aria-controls="li-details" icon={<CaretDown size={14} aria-hidden="true" className={showDetails ? "rotate-180" : ""} />} onClick={() => setShowDetails((v) => !v)}>
                {showDetails ? "Hide saved details" : "Show saved details"}
              </Button>
              {showDetails && (
                <div id="li-details" className="mt-2 grid gap-3">
                  {SECTIONS.filter(({ kind }) => records.some((r) => r.kind === kind)).map(({ kind, label }) => (
                    <div key={kind} className="min-w-0">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</h4>
                      <ul className="mt-1 grid gap-1">
                        {records.filter((r) => r.kind === kind).map((r, i) => {
                          const line = recordLine(r);
                          return (
                            <li key={`${kind}-${i}`} className="min-w-0 text-sm text-text-primary">
                              <span className="break-words">{line.title}</span>
                              {line.detail && <span className="text-text-muted"> · {line.detail}</span>}
                              {r.missing && <span className="ml-1 text-xs text-text-muted">(no longer on your profile)</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                  <p className="text-xs text-text-muted">Roles and education appear in your review as suggestions; nothing counts until you confirm it.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
