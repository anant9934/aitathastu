"use client";

/**
 * Optional ORCID iD / Semantic Scholar author ID (Task 1.6.2). Papers are
 * imported only for the exact ID entered here, never matched by name; leaving
 * it empty means no publication import ever runs.
 */
import React, { useState } from "react";

type Kind = "orcid" | "semantic_scholar";

export function ResearchIdField() {
  const [kind, setKind] = useState<Kind>("orcid");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/student/research-id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, value }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || "That ID couldn't be saved."); return; }
      const state = body.sync?.state;
      setDone(state === "succeeded" || state === "partial" ? `Saved ${body.id}. Papers linked to it are imported.` : `Saved ${body.id}. ${body.sync?.error || "We'll import your papers shortly."}`);
    } finally {
      setBusy(false);
    }
  };

  const hint = kind === "orcid" ? "16 characters, like 0000-0002-1825-0097" : "The number at the end of your Semantic Scholar author page URL";
  return (
    <section aria-labelledby="rid-title" style={{ background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <h2 id="rid-title" style={{ margin: 0, fontSize: 18, fontWeight: 680, letterSpacing: "-0.02em" }}>Research papers</h2>
        <span style={{ padding: "2px 10px", borderRadius: 9999, background: "var(--ivory)", border: "1px solid var(--line)", color: "var(--muted)", fontSize: 12, fontWeight: 650 }}>Optional</span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--muted)", maxWidth: "62ch" }}>
        Have publications? Add your research ID and we import only the papers linked to that exact ID. We never search by your name, so nobody else&apos;s work ends up on your profile.
      </p>
      <form onSubmit={save} style={{ marginTop: 14, display: "grid", gap: 10, maxWidth: 460 }} noValidate>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 16 }}>
          <legend style={{ fontSize: 14, fontWeight: 650, marginBottom: 6 }}>ID type</legend>
          {([["orcid", "ORCID iD"], ["semantic_scholar", "Semantic Scholar author ID"]] as const).map(([k, l]) => (
            <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, fontSize: 15 }}>
              <input type="radio" name="rid-kind" checked={kind === k} onChange={() => setKind(k)} style={{ width: 18, height: 18 }} /> {l}
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="rid-value" style={{ display: "block", fontSize: 14, fontWeight: 650, marginBottom: 6 }}>{kind === "orcid" ? "ORCID iD" : "Author ID"}</label>
          <input id="rid-value" value={value} onChange={(e) => setValue(e.target.value)} aria-describedby="rid-hint" aria-invalid={Boolean(error)}
            inputMode={kind === "semantic_scholar" ? "numeric" : "text"} autoComplete="off" spellCheck={false}
            style={{ width: "100%", minHeight: 44, padding: "0 12px", borderRadius: 8, border: `1px solid ${error ? "#9F2F2D" : "var(--line)"}`, fontSize: 16, fontVariantNumeric: "tabular-nums", background: "var(--white)", color: "var(--ink)" }} />
          <p id="rid-hint" style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>{hint}</p>
        </div>
        {error && <p role="alert" style={{ margin: 0, fontSize: 14, color: "#9F2F2D" }}>{error}</p>}
        {done && <p aria-live="polite" style={{ margin: 0, fontSize: 14, color: "#1f6b4a" }}>{done}</p>}
        <div>
          <button type="submit" disabled={busy || !value.trim()}
            style={{ minHeight: 44, padding: "0 18px", borderRadius: 8, border: 0, background: "var(--violet)", color: "#fff", fontSize: 15, fontWeight: 650, opacity: busy || !value.trim() ? 0.5 : 1 }}>
            {busy ? "Importing…" : "Save and import"}
          </button>
        </div>
      </form>
    </section>
  );
}
