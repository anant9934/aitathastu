"use client";

/**
 * EORA grounded chat (Task 1.4.3, BUG #4). Free-form questions go to
 * POST /api/eora/chat (RAG over the student's own data) instead of the static
 * dialogue table. Renders the reply as safe markdown (no innerHTML), the
 * sources it drew on, and the action the server proposes.
 */
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Source = { title: string; url?: string | null; provider?: string | null };
type Action = { label: string; destinationUrl?: string | null; contextReason?: string };
type Turn =
  | { role: "user"; text: string }
  | { role: "eora"; text: string; sources: Source[]; action?: Action | null }
  | { role: "error"; text: string };

/** Paragraphs, "- " lists, **bold** and [text](https://url). Everything else is plain text. */
function Markdown({ text }: { text: string }) {
  const inline = (s: string, key: string) => {
    const parts: React.ReactNode[] = [];
    // **bold**, `code`, *italic* / _italic_, [text](https://url)
    const re = /\*\*([^*]+)\*\*|`([^`]+)`|(?:\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let last = 0, m: RegExpExecArray | null, i = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      const k = `${key}-${i++}`;
      if (m[1]) parts.push(<strong key={k}>{m[1]}</strong>);
      else if (m[2]) parts.push(<code key={k} style={{ padding: "1px 5px", borderRadius: 4, background: "var(--ivory)", border: "1px solid var(--line)", fontSize: "0.9em" }}>{m[2]}</code>);
      else if (m[3] || m[4]) parts.push(<em key={k}>{m[3] || m[4]}</em>);
      else parts.push(<a key={k} href={m[6]} target="_blank" rel="noopener noreferrer" style={{ color: "var(--violet)", textDecoration: "underline", textUnderlineOffset: 3 }}>{m[5]}</a>);
      last = re.lastIndex;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  };
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return <ul key={bi} style={{ margin: "0 0 8px", paddingLeft: 20 }}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""), `${bi}-${li}`)}</li>)}</ul>;
        }
        return <p key={bi} style={{ margin: "0 0 8px" }}>{inline(lines.join(" "), String(bi))}</p>;
      })}
    </>
  );
}

export function EoraChatDrawer({ open, seed, onClose }: { open: boolean; seed: { text: string; nonce: number } | null; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sentSeed = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/eora/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTurns((t) => [...t, { role: "error", text: body.error || (res.status === 429 ? "EORA needs a short break. Try again in a minute." : "EORA couldn't answer that right now.") }]);
      } else {
        setTurns((t) => [...t, { role: "eora", text: String(body.reply || ""), sources: Array.isArray(body.referencedSources) ? body.referencedSources : [], action: body.proposedAction ?? null }]);
      }
    } catch {
      setTurns((t) => [...t, { role: "error", text: "You seem to be offline. Check your connection and ask again." }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Nonce, not text: asking the same question twice must send it twice.
    if (open && seed && sentSeed.current !== seed.nonce) { sentSeed.current = seed.nonce; void ask(seed.text); }
    if (open) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [turns, busy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <aside role="dialog" aria-modal="false" aria-labelledby="eora-chat-title"
      style={{ position: "fixed", zIndex: 950, right: 16, bottom: 16, top: 16, width: "min(420px, calc(100vw - 32px))", display: "flex", flexDirection: "column", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 12px 32px rgba(23, 22, 38, 0.12)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
        <h2 id="eora-chat-title" style={{ margin: 0, fontSize: 17, fontWeight: 680 }}>Ask EORA</h2>
        <button type="button" onClick={onClose} aria-label="Close chat" style={{ minHeight: 44, minWidth: 44, border: 0, background: "transparent", color: "var(--muted)", fontSize: 22, lineHeight: 1 }}>×</button>
      </header>
      <div ref={listRef} aria-live="polite" style={{ flex: 1, overflowY: "auto", padding: "14px 18px", fontSize: 15, lineHeight: 1.55 }}>
        {turns.length === 0 && <p style={{ margin: 0, color: "var(--muted)" }}>Ask about your skills, projects or next steps. EORA answers from your own profile data and shows where each answer came from.</p>}
        {turns.map((t, i) => t.role === "user" ? (
          <p key={i} style={{ margin: "0 0 12px 32px", padding: "8px 12px", borderRadius: 8, background: "var(--ivory)", border: "1px solid var(--line)" }}>{t.text}</p>
        ) : t.role === "error" ? (
          <p key={i} role="alert" style={{ margin: "0 0 12px", color: "#9F2F2D" }}>{t.text}</p>
        ) : (
          <div key={i} style={{ margin: "0 0 14px" }}>
            <Markdown text={t.text} />
            {t.sources.length > 0 && (
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Based on</span>
                {t.sources.slice(0, 4).map((s, si) => {
                  const inner = <><span style={{ fontWeight: 650 }}>{s.title}</span>{s.provider && <span style={{ color: "var(--muted)" }}> · {s.provider}</span>}</>;
                  const style: React.CSSProperties = { display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, color: "var(--ink)" };
                  return s.url ? <a key={si} href={s.url} target={s.url.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" style={style}>{inner}</a> : <div key={si} style={style}>{inner}</div>;
                })}
              </div>
            )}
            {t.action?.destinationUrl && (
              <Link href={t.action.destinationUrl} onClick={onClose} title={t.action.contextReason}
                style={{ display: "inline-flex", alignItems: "center", minHeight: 44, marginTop: 10, padding: "0 16px", borderRadius: 8, background: "var(--violet)", color: "#fff", fontSize: 14, fontWeight: 650 }}>
                {t.action.label}
              </Link>
            )}
          </div>
        ))}
        {busy && <p style={{ margin: 0, color: "var(--muted)" }}>EORA is looking through your profile…</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const q = input; setInput(""); void ask(q); }} style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
        <label htmlFor="eora-chat-input" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Your question</label>
        <textarea id="eora-chat-input" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value.slice(0, 2000))} rows={2}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          placeholder="Which of my projects best shows Python?"
          style={{ flex: 1, resize: "none", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 15, fontFamily: "inherit", color: "var(--ink)" }} />
        <button type="submit" disabled={busy || !input.trim()} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: 0, background: "var(--violet)", color: "#fff", fontWeight: 650, opacity: busy || !input.trim() ? 0.5 : 1 }}>Ask</button>
      </form>
    </aside>
  );
}
