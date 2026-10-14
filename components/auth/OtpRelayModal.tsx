"use client";

/**
 * LinkedIn verification-code relay (Task 1.6.8). Shown only while the import
 * is paused on LinkedIn's SMS/email check; the code goes to
 * POST /api/student/linkedin/otp and on to the waiting browser session.
 * The window is 60 s; "Skip LinkedIn" (or Esc) ends it with no penalty.
 * A modal is justified here: a live login is blocked on this one input.
 */
import React, { useEffect, useRef, useState } from "react";

export function OtpRelayModal({ secondsLeft, onSubmitted, onSkip }: {
  /** From the server's challengeSecondsLeft; the countdown runs locally from it. */
  secondsLeft: number;
  onSubmitted: () => void;
  onSkip: () => void;
}) {
  const [left, setLeft] = useState(secondsLeft);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      if (e.key === "Tab" && dialog.current) {
        // Keep focus inside the dialog.
        const f = dialog.current.querySelectorAll<HTMLElement>("input, button:not([disabled])");
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const expired = left === 0;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(code)) { setError("Enter the numbers from the message, without spaces."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/student/linkedin/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || "That code didn't go through. Try again."); return; }
      onSubmitted();
    } finally {
      setBusy(false);
    }
  };
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div role="presentation" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 16, background: "rgba(23, 22, 38, 0.5)" }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="otp-title" aria-describedby="otp-desc"
        style={{ width: "min(100%, 420px)", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, padding: "24px 24px 20px", boxShadow: "0 12px 32px rgba(23, 22, 38, 0.12)" }}>
        <h2 id="otp-title" style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 680, letterSpacing: "-0.02em" }}>Enter the code LinkedIn sent you</h2>
        <p id="otp-desc" style={{ margin: "0 0 18px", fontSize: 15, color: "var(--muted)" }}>
          {expired
            ? "The 60-second window has closed. You can skip LinkedIn now and try again tomorrow."
            : <>Check your SMS or email. Time left: <span aria-live="polite" style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink)", fontWeight: 650 }}>{mm}:{ss}</span></>}
        </p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="otp-code" style={{ display: "block", fontSize: 14, fontWeight: 650, marginBottom: 6 }}>Verification code</label>
          <input id="otp-code" ref={input} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric" autoComplete="one-time-code" disabled={expired || busy}
            aria-invalid={Boolean(error)} aria-describedby={error ? "otp-error" : undefined}
            style={{ width: "100%", minHeight: 48, padding: "0 14px", borderRadius: 8, border: `1px solid ${error ? "#9F2F2D" : "var(--line)"}`, fontSize: 20, letterSpacing: "0.2em", fontVariantNumeric: "tabular-nums", background: "var(--white)", color: "var(--ink)" }} />
          {error && <p id="otp-error" role="alert" style={{ margin: "6px 0 0", fontSize: 14, color: "#9F2F2D" }}>{error}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
            <button type="submit" disabled={expired || busy || !code}
              style={{ minHeight: 44, padding: "0 18px", borderRadius: 8, border: 0, background: "var(--violet)", color: "#fff", fontSize: 15, fontWeight: 650, opacity: expired || busy || !code ? 0.5 : 1 }}>
              {busy ? "Checking…" : "Submit code"}
            </button>
            <button type="button" onClick={onSkip}
              style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--white)", color: "var(--ink)", fontSize: 15, fontWeight: 650 }}>
              Skip LinkedIn
            </button>
          </div>
        </form>
        <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--muted)" }}>Skipping never affects your profile or onboarding.</p>
      </div>
    </div>
  );
}
