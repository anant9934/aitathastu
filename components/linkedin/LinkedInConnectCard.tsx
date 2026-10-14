"use client";

/**
 * Optional LinkedIn connection (Tasks 1.6.1, 1.6.8). Framed as recommended,
 * never required: "Skip — I'll do this later" is always one click, and no
 * step, score or feature depends on the result.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { OtpRelayModal } from "@/components/auth/OtpRelayModal";

type Status = { state: string; challengeSecondsLeft?: number | null; error?: string | null };
const ACTIVE = ["queued", "running", "awaiting_user"];

export function LinkedInConnectCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idem = useRef<string>("");

  const poll = useCallback(async () => {
    const res = await fetch("/api/student/linkedin", { cache: "no-store" });
    if (res.ok) setStatus(await res.json());
  }, []);
  useEffect(() => { void poll(); }, [poll]);
  const active = Boolean(status && ACTIVE.includes(status.state));
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => void poll(), 1500);
    return () => clearInterval(id);
  }, [active, poll]);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consent) { setError("Tick the box to let us sign in for you, or skip LinkedIn."); return; }
    setBusy(true);
    idem.current ||= crypto.randomUUID();
    try {
      const res = await fetch("/api/student/linkedin", {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idem.current },
        body: JSON.stringify({ email, password, consent }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || "LinkedIn couldn't be connected right now."); return; }
      setPassword("");
      setOpen(false);
      setStatus(body);
    } finally {
      setBusy(false);
      idem.current = "";
    }
  };
  const skip = async () => {
    const res = await fetch("/api/student/linkedin/skip", { method: "POST" });
    if (res.ok) setStatus(await res.json());
    setOpen(false);
  };

  const s = status?.state ?? "not_started";
  const line =
    s === "succeeded" ? "Imported. Your LinkedIn roles and schools are waiting for review on your profile."
    : s === "running" || s === "queued" ? "Signing in to LinkedIn…"
    : s === "awaiting_user" ? "LinkedIn wants a verification code."
    : s === "skipped_optional" ? "Skipped. You can connect LinkedIn any time."
    : s === "dead_letter" || s === "failed" || s === "timed_out" ? status?.error || "That didn't work."
    : null;

  return (
    <section aria-labelledby="li-title" style={{ background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <h2 id="li-title" style={{ margin: 0, fontSize: 18, fontWeight: 680, letterSpacing: "-0.02em" }}>LinkedIn</h2>
        <span style={{ padding: "2px 10px", borderRadius: 9999, background: "var(--ivory)", border: "1px solid var(--line)", color: "var(--muted)", fontSize: 12, fontWeight: 650 }}>Optional</span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--muted)", maxWidth: "62ch" }}>
        Recommended, not required. It adds your work history and education so collaborators and mentors can find you. Everything else works without it.
      </p>
      {line && <p aria-live="polite" style={{ margin: "10px 0 0", fontSize: 15, color: s === "dead_letter" ? "#9F2F2D" : "var(--ink)" }}>{line}</p>}

      {!open && !active && s !== "succeeded" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          <button type="button" onClick={() => setOpen(true)} style={primary}>Connect LinkedIn</button>
          {s !== "skipped_optional" && <button type="button" onClick={() => void skip()} style={secondary}>Skip — I&apos;ll do this later</button>}
        </div>
      )}

      {open && (
        <form onSubmit={connect} style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 420 }} noValidate>
          <div>
            <label htmlFor="li-email" style={label}>LinkedIn email</label>
            <input id="li-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
          </div>
          <div>
            <label htmlFor="li-password" style={label}>LinkedIn password</label>
            <input id="li-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={field} />
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "var(--ink)" }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
            <span>Sign in to LinkedIn for me once to read my own profile. My password is stored encrypted, and disconnecting erases it. LinkedIn may text or email me a code.</span>
          </label>
          {error && <p role="alert" style={{ margin: 0, fontSize: 14, color: "#9F2F2D" }}>{error}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button type="submit" disabled={busy || !email || !password} style={{ ...primary, opacity: busy || !email || !password ? 0.5 : 1 }}>{busy ? "Starting…" : "Connect"}</button>
            <button type="button" onClick={() => void skip()} style={secondary}>Skip — I&apos;ll do this later</button>
          </div>
        </form>
      )}

      {s === "awaiting_user" && (
        <OtpRelayModal secondsLeft={status?.challengeSecondsLeft ?? 60} onSubmitted={() => void poll()} onSkip={() => void skip()} />
      )}
    </section>
  );
}

const primary: React.CSSProperties = { minHeight: 44, padding: "0 18px", borderRadius: 8, border: 0, background: "var(--violet)", color: "#fff", fontSize: 15, fontWeight: 650 };
const secondary: React.CSSProperties = { minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--white)", color: "var(--ink)", fontSize: 15, fontWeight: 650 };
const label: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 650, marginBottom: 6 };
const field: React.CSSProperties = { width: "100%", minHeight: 44, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 16, background: "var(--white)", color: "var(--ink)" };
