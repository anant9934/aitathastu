"use client";

/**
 * Optional LinkedIn sign-in import (Tasks 1.6.1, 1.6.8, 2.1.6). Recommended,
 * never required: skipping is always one click and nothing depends on it.
 * Consent comes first; the fields stay disabled until it is given. The import
 * is unproven against real LinkedIn (P4-9) and the worker can be asleep
 * (about a minute to wake), so every state says what is happening.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeSlash, LinkedinLogo, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { Banner } from "@/components/ui/Banner";
import { OtpDialog } from "./OtpDialog";

type Status = { state: string; challengeSecondsLeft?: number | null; error?: string | null };
const ACTIVE = ["queued", "running", "awaiting_user"];
const SLOW_AFTER_S = 10;

export function LinkedInConnect({ onSettled }: { onSettled?: (state: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);
  const idem = useRef("");

  const poll = useCallback(async () => {
    const res = await requestJson<Status>("/api/student/linkedin", { cache: "no-store" });
    // A network blip keeps the last known state; the next poll retries.
    if (res.ok) setStatus(res.data);
  }, []);
  useEffect(() => { void poll(); }, [poll]);

  const s = status?.state ?? "not_started";
  const active = ACTIVE.includes(s);
  useEffect(() => {
    if (!active) { setWaited(0); return; }
    const id = setInterval(() => { void poll(); setWaited((n) => n + 1.5); }, 1500);
    return () => clearInterval(id);
  }, [active, poll]);
  useEffect(() => {
    if (["succeeded", "skipped_optional", "dead_letter"].includes(s)) onSettled?.(s);
  }, [s, onSettled]);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consent) { setError("Tick the box first, or skip LinkedIn."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter the email you use to sign in to LinkedIn."); return; }
    if (!password) { setError("Enter your LinkedIn password."); return; }
    setBusy(true);
    idem.current ||= crypto.randomUUID();
    const res = await requestJson<Status>("/api/student/linkedin", {
      method: "POST",
      headers: { "Idempotency-Key": idem.current },
      json: { email: email.trim(), password, consent },
    });
    setBusy(false);
    idem.current = "";
    if (!res.ok) { setError(`${describeError(res.error)} You can skip LinkedIn and connect it later.`); return; }
    setPassword("");
    setOpen(false);
    setStatus(res.data);
  };

  const skip = async () => {
    const res = await requestJson<Status>("/api/student/linkedin/skip", { method: "POST" });
    setStatus(res.ok ? res.data : { state: "skipped_optional" });
    setOpen(false);
  };

  const failed = s === "dead_letter" || s === "failed" || s === "timed_out";
  const line =
    s === "succeeded" ? "Imported. Your LinkedIn roles and schools are waiting for your review."
    : s === "queued" || s === "running"
      ? waited >= SLOW_AFTER_S
        ? "Still signing in. Our sign-in service may be waking up, which can take up to a minute. Keep going; it finishes in the background."
        : "Signing in to LinkedIn…"
    : s === "awaiting_user" ? "LinkedIn sent you a verification code. Enter it to continue."
    : s === "skipped_optional" ? "Skipped. Connect LinkedIn any time from Connections."
    : failed ? `${status?.error || "That didn't work."} Your password was not kept.`
    : null;

  return (
    <section aria-labelledby="li-title" className="rounded-[var(--radius-panel)] border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <LinkedinLogo size={22} aria-hidden="true" className="text-muted" />
        <h3 id="li-title" className="text-base font-semibold">LinkedIn sign-in import</h3>
        <StatusChip tone="neutral" icon={null}>Optional</StatusChip>
      </div>
      <p className="mt-2 max-w-[62ch] text-sm text-muted">
        Adds your work history and education. Everything else works without it, and onboarding finishes either way.
      </p>
      {line && (
        <p aria-live="polite" className={failed ? "mt-3 text-sm text-danger" : "mt-3 text-sm text-ink"}>{line}</p>
      )}

      {!open && !active && s !== "succeeded" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { setOpen(true); setError(null); }}>{failed ? "Try again" : "Connect LinkedIn"}</Button>
          {s !== "skipped_optional" && <Button variant="ghost" onClick={() => void skip()}>Skip for now</Button>}
        </div>
      )}
      {active && s !== "awaiting_user" && waited >= SLOW_AFTER_S && (
        <div className="mt-4"><Button variant="ghost" onClick={() => void skip()}>Cancel and skip LinkedIn</Button></div>
      )}

      {open && (
        <form onSubmit={connect} noValidate className="mt-4 grid max-w-md gap-4">
          <div className="grid gap-3 rounded-[var(--radius-control)] border border-line bg-canvas/50 p-3.5">
            <Checkbox
              checked={consent}
              onChange={(e) => { setConsent(e.target.checked); setError(null); }}
              label={<><span className="font-medium">Sign in to LinkedIn for me once, to read my own profile.</span> LinkedIn may text or email me a code; I&apos;ll have 60 seconds to enter it here.</>}
            />
            <p className="flex items-start gap-2 text-xs text-muted">
              <LockSimple size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              Your password is encrypted (AES-256-GCM), used only to sign in for you, never shown or shared, discarded if sign-in fails, and erased when you disconnect.
            </p>
          </div>
          <fieldset disabled={!consent} className="grid min-w-0 gap-3">
            <legend className="sr-only">LinkedIn sign-in details</legend>
            {!consent && <p className="text-xs text-muted">Tick the box above to enter your LinkedIn details.</p>}
            <TextField label="LinkedIn email" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="flex items-end gap-2">
              <TextField
                wrapperClassName="flex-1"
                label="LinkedIn password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                variant="secondary"
                className="w-11 px-0"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </Button>
            </div>
          </fieldset>
          {error && <Banner kind="danger">{error}</Banner>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={!consent} loading={busy} loadingLabel="Starting…">Connect</Button>
            <Button variant="ghost" onClick={() => void skip()}>Skip for now</Button>
          </div>
        </form>
      )}

      {s === "awaiting_user" && <OtpDialog secondsLeft={status?.challengeSecondsLeft ?? 60} onSubmitted={() => void poll()} onSkip={() => void skip()} />}
    </section>
  );
}
