"use client";

/**
 * EORA grounded chat (Task 1.4.3, BUG #4). Questions go to POST /api/eora/chat
 * (RAG over the person's own data). Replies render as safe markdown (no
 * innerHTML), with the sources used and the action the server proposes.
 */
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PaperPlaneRight } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { Drawer } from "@/components/ui/Overlay";
import { Button, buttonClass } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

type Source = { title: string; url?: string | null; provider?: string | null };
type Action = { label: string; destinationUrl?: string | null; contextReason?: string };
type Turn = { role: "user"; text: string } | { role: "eora"; text: string; sources: Source[]; action?: Action | null } | { role: "error"; text: string };

function Markdown({ text }: { text: string }) {
  const inline = (s: string, key: string) => {
    const parts: React.ReactNode[] = [];
    const re = /\*\*([^*]+)\*\*|`([^`]+)`|(?:\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let last = 0, m: RegExpExecArray | null, i = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      const k = `${key}-${i++}`;
      if (m[1]) parts.push(<strong key={k} className="font-semibold">{m[1]}</strong>);
      else if (m[2]) parts.push(<code key={k} className="rounded-[4px] border border-line bg-raised px-1 font-mono text-[0.9em]">{m[2]}</code>);
      else if (m[3] || m[4]) parts.push(<em key={k}>{m[3] || m[4]}</em>);
      else parts.push(<a key={k} href={m[6]} target="_blank" rel="noopener noreferrer" className="link">{m[5]}</a>);
      last = re.lastIndex;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  };
  return (
    <>
      {text.trim().split(/\n{2,}/).map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return <ul key={bi} className="mb-2 list-disc pl-5">{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""), `${bi}-${li}`)}</li>)}</ul>;
        }
        return <p key={bi} className="mb-2">{inline(lines.join(" "), String(bi))}</p>;
      })}
    </>
  );
}

export function EoraChat({ open, seed, onClose }: { open: boolean; seed: { text: string; nonce: number } | null; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sent = useRef<number | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const ask = async (q0: string) => {
    const q = q0.trim();
    if (!q || busy) return;
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    const res = await requestJson<{ reply?: string; referencedSources?: Source[]; proposedAction?: Action | null }>("/api/eora/chat", { method: "POST", json: { message: q } });
    setBusy(false);
    if (!res.ok) {
      const text = res.error.kind === "rate_limited" ? `EORA needs a short break. ${describeError(res.error)}` : describeError(res.error);
      setTurns((t) => [...t, { role: "error", text }]);
      return;
    }
    setTurns((t) => [...t, { role: "eora", text: String(res.data.reply || ""), sources: Array.isArray(res.data.referencedSources) ? res.data.referencedSources : [], action: res.data.proposedAction ?? null }]);
  };

  useEffect(() => {
    // Nonce, not text: asking the same question twice sends it twice.
    if (open && seed && sent.current !== seed.nonce) { sent.current = seed.nonce; void ask(seed.text); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [turns, busy]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Ask EORA"
      description="Answers come from your own profile data, with the sources shown."
      initialFocus={field}
      footer={
        <form onSubmit={(e) => { e.preventDefault(); const q = input; setInput(""); void ask(q); }} className="flex w-full items-end gap-2">
          <label htmlFor="eora-chat-input" className="sr-only">Your question</label>
          <textarea
            id="eora-chat-input"
            ref={field}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            placeholder="Which of my projects best shows Python?"
            className="min-h-11 min-w-0 flex-1 resize-none rounded-[var(--radius-control)] border border-line-strong bg-canvas px-3 py-2 text-base focus-visible:border-focus focus-visible:outline-none"
          />
          <Button type="submit" variant="primary" disabled={busy || !input.trim()} icon={<PaperPlaneRight size={16} aria-hidden="true" />}>Ask</Button>
        </form>
      }
    >
      <div ref={list} aria-live="polite" className="flex flex-col gap-4 text-sm">
        {turns.length === 0 && !busy && <p className="text-muted">Ask about your skills, projects or next steps.</p>}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <p key={i} className="ml-8 rounded-[var(--radius-control)] border border-line bg-raised px-3 py-2">{t.text}</p>
          ) : t.role === "error" ? (
            <p key={i} role="alert" className="text-danger">{t.text}</p>
          ) : (
            <div key={i}>
              <Markdown text={t.text} />
              {t.sources.length > 0 && (
                <div className="mt-1 flex flex-col gap-1.5">
                  <span className="text-xs text-muted">Based on</span>
                  {t.sources.slice(0, 4).map((s, si) => {
                    const inner = <><span className="font-medium">{s.title}</span>{s.provider && <span className="text-muted"> · {s.provider}</span>}</>;
                    const cls = "block rounded-[var(--radius-control)] border border-line px-3 py-2";
                    return s.url ? <a key={si} href={s.url} target={s.url.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className={`${cls} hover:border-line-strong`}>{inner}</a> : <div key={si} className={cls}>{inner}</div>;
                  })}
                </div>
              )}
              {t.action?.destinationUrl && (
                <Link href={t.action.destinationUrl} onClick={onClose} title={t.action.contextReason} className={buttonClass("primary", "sm", "mt-3")}>{t.action.label}</Link>
              )}
            </div>
          ),
        )}
        {busy && <p className="flex items-center gap-2 text-muted"><Spinner size={16} />EORA is looking through your profile…</p>}
      </div>
    </Drawer>
  );
}
