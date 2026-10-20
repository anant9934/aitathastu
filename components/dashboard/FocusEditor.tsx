"use client";

/**
 * "What this dashboard is built around" (Task 2.2.1): target role and ranked
 * priorities, saved in place with PATCH /api/workspace/preferences. Saves are
 * optimistic and roll back with a plain message if they fail; the dashboard
 * reshapes without a page reload.
 */
import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "@phosphor-icons/react/dist/ssr";
import { AIML_ROLE_CATALOG } from "@/lib/domain/aiml-role-taxonomy";
import { PURPOSES } from "@/lib/domain/adaptive-workspace";
import { IconButton, Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { toast } from "@/components/ui/Feedback";
import { cn } from "@/lib/client/cn";

export function FocusEditor({ targetRole, purposes, onSave }: {
  targetRole: string;
  purposes: string[];
  onSave: (patch: { targetRole?: string; purposes?: string[] }) => Promise<void>;
}) {
  const registry = PURPOSES.student;
  const [role, setRole] = useState(() => AIML_ROLE_CATALOG.find((r) => r.title === targetRole)?.id ?? "");
  const [ranked, setRanked] = useState(purposes);
  const [busy, setBusy] = useState(false);
  const key = purposes.join();
  useEffect(() => { setRanked(key ? key.split(",") : []); }, [key]);
  useEffect(() => { const id = AIML_ROLE_CATALOG.find((r) => r.title === targetRole)?.id; if (id) setRole(id); }, [targetRole]);

  const title = (id: string) => registry.find((p) => p.id === id)?.title ?? id;
  const commit = async (patch: { targetRole?: string; purposes?: string[] }, rollback: () => void, done: string) => {
    setBusy(true);
    try { await onSave(patch); toast.success(done); }
    catch (e) { rollback(); toast.error("That change wasn't saved", `${e instanceof Error ? e.message : "Try again."} Your previous choice is back.`); }
    finally { setBusy(false); }
  };
  const move = (i: number, dir: number) => {
    const j = i + dir; if (j < 0 || j >= ranked.length) return;
    const prev = ranked; const next = [...ranked]; [next[i], next[j]] = [next[j], next[i]];
    setRanked(next);
    void commit({ purposes: next }, () => setRanked(prev), `Priorities saved. ${title(next[0])} now leads your dashboard.`);
  };

  return (
    <div className="flex flex-col gap-6" aria-busy={busy}>
      <SelectField
        label="Target role"
        value={role}
        disabled={busy}
        hint="Your skills and gaps are measured against this role."
        onChange={(e) => { const prev = role; setRole(e.target.value); void commit({ targetRole: e.target.value }, () => setRole(prev), "Target role saved. Your dashboard now follows it."); }}
      >
        {!role && <option value="">Choose a role</option>}
        {AIML_ROLE_CATALOG.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
      </SelectField>

      <div>
        <p id="focus-priorities" className="text-sm font-medium text-text-primary">Priorities, most important first</p>
        <p className="mt-0.5 text-xs text-text-muted">The first one decides what your dashboard opens with.</p>
        <ol aria-labelledby="focus-priorities" className="mt-3 flex flex-col gap-1.5">
          {ranked.map((id, i) => (
            <li key={id} className={cn("flex min-h-12 items-center gap-2 rounded-md border px-3 transition-colors", i === 0 ? "border-accent-warm-bright/50 bg-accent-warm-bright/10 text-text-primary" : "border-border-medium bg-bg-elevated text-text-primary")}>
              <span className="w-4 font-mono text-xs text-text-muted tabular">{i + 1}</span>
              <span className={cn("flex-1 text-sm", i === 0 ? "font-semibold text-text-primary" : "text-text-primary")}>{title(id)}</span>
              <IconButton label={`Move ${title(id)} up`} disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} aria-hidden="true" /></IconButton>
              <IconButton label={`Move ${title(id)} down`} disabled={busy || i === ranked.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} aria-hidden="true" /></IconButton>
              <IconButton label={`Remove ${title(id)}`} disabled={busy || ranked.length <= 1} onClick={() => {
                const prev = ranked; const next = ranked.filter((p) => p !== id); setRanked(next);
                void commit({ purposes: next }, () => setRanked(prev), "Priority removed.");
              }}><X size={16} aria-hidden="true" /></IconButton>
            </li>
          ))}
        </ol>
        {ranked.length < 3 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {registry.filter((p) => !ranked.includes(p.id)).map((p) => (
              <Button key={p.id} size="sm" variant="ghost" disabled={busy} icon={<Plus size={14} aria-hidden="true" />} onClick={() => {
                const prev = ranked; const next = [...ranked, p.id]; setRanked(next);
                void commit({ purposes: next }, () => setRanked(prev), "Priority added.");
              }}>{p.title}</Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
