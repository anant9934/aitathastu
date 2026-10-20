"use client";

/**
 * LinkedIn verification-code relay (Task 1.6.8). Shown only while the import
 * waits on LinkedIn's SMS or email check. A modal is justified: a live sign-in
 * is blocked on this one input. "Skip LinkedIn" (or Esc) ends it with no penalty.
 */
import React, { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { requestJson, describeError } from "@/lib/client/api";

export function OtpDialog({ secondsLeft, onSubmitted, onSkip }: { secondsLeft: number; onSubmitted: () => void; onSkip: () => void }) {
  const [left, setLeft] = useState(secondsLeft);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const expired = left === 0;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(code)) { setError("Enter the numbers from the message, without spaces."); return; }
    setBusy(true);
    setError(null);
    const res = await requestJson("/api/student/linkedin/otp", { method: "POST", json: { code } });
    setBusy(false);
    if (!res.ok) { setError(describeError(res.error)); return; }
    onSubmitted();
  };

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <Dialog
      open
      onClose={onSkip}
      size="sm"
      title="Enter the code LinkedIn sent you"
      initialFocus={input}
      description={expired
        ? "The 60-second window has closed. Skip LinkedIn for now and try again later."
        : <>Check your SMS or email. Time left: <span aria-live="polite" className="font-mono tabular text-text-primary">{mm}:{ss}</span></>}
      footer={
        <>
          <Button variant="ghost" onClick={onSkip}>Skip LinkedIn</Button>
          <Button variant="primary" type="submit" form="otp-form" disabled={expired || !code} loading={busy} loadingLabel="Checking…">Submit code</Button>
        </>
      }
    >
      <form id="otp-form" onSubmit={submit} noValidate>
        <TextField
          ref={input}
          label="Verification code"
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(null); }}
          inputMode="numeric"
          autoComplete="one-time-code"
          disabled={expired || busy}
          error={error}
          className="font-mono text-xl tracking-[0.3em] tabular"
        />
        <p className="mt-3 text-xs text-text-muted">Skipping never affects your profile or onboarding.</p>
      </form>
    </Dialog>
  );
}
