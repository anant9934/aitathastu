"use client";

/**
 * Per-source review (Task 2.1.5): pick a source to see only what it
 * contributed, then accept it all, remove it, or (GitHub) exclude forks. Bulk
 * actions touch only that source's entries, report what they kept and why,
 * and undo in one step.
 */
import React, { useState } from "react";
import { ArrowCounterClockwise, Check, GitFork, X } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/client/cn";
import { sourceLabel } from "./EntryList";

export type SourceActionSummary = { label: string; changed: number; keptShared: number; keptEdited: number };

export function SourceFilter({ counts, active, onSelect, forkCount, onAcceptAll, onRemove, onExcludeForks, onUndo }: {
  counts: Record<string, number>;
  active: string | null;
  onSelect: (source: string | null) => void;
  forkCount: number;
  onAcceptAll: (source: string) => SourceActionSummary;
  onRemove: (source: string) => SourceActionSummary;
  onExcludeForks: () => SourceActionSummary;
  onUndo: () => void;
}) {
  const [last, setLast] = useState<SourceActionSummary | null>(null);
  const sources = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (sources.length < 2) return null;
  const run = (fn: () => SourceActionSummary) => setLast(fn());

  const chip = (pressed: boolean) =>
    cn(
      "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm transition-all duration-150 pointer-coarse:min-h-11",
      pressed ? "border-soft-amber bg-soft-amber/15 text-warm-ivory font-medium shadow-[0_0_12px_rgba(244,154,71,0.2)]" : "border-border-medium text-text-muted hover:border-champagne/40 hover:text-warm-ivory",
    );

  return (
    <section aria-label="Review by source" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span id="src-label" className="text-sm text-text-muted">Show</span>
        <div role="group" aria-labelledby="src-label" className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(active === null)} aria-pressed={active === null} onClick={() => onSelect(null)}>All sources</button>
          {sources.map(([s, n]) => (
            <button key={s} type="button" className={chip(active === s)} aria-pressed={active === s} onClick={() => { onSelect(active === s ? null : s); setLast(null); }}>
              {sourceLabel(s)} <span className="font-mono text-2xs tabular">{n}</span>
            </button>
          ))}
        </div>
      </div>
      {active && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-medium bg-bg-elevated px-3.5 py-2.5 shadow-card">
          <span className="mr-auto text-sm text-text-muted">Showing only items from <span className="font-medium text-warm-ivory">{sourceLabel(active)}</span>.</span>
          <Button size="sm" variant="primary" icon={<Check size={16} aria-hidden="true" />} onClick={() => run(() => onAcceptAll(active))}>Accept all from {sourceLabel(active)}</Button>
          {active === "github" && forkCount > 0 && (
            <Button size="sm" variant="secondary" icon={<GitFork size={16} aria-hidden="true" />} onClick={() => run(onExcludeForks)}>Exclude forks ({forkCount})</Button>
          )}
          <Button size="sm" variant="danger" icon={<X size={16} aria-hidden="true" />} onClick={() => run(() => onRemove(active))}>Remove {sourceLabel(active)}&apos;s items</Button>
        </div>
      )}
      {last && (
        <p role="status" className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span>
            {last.label}: {last.changed === 0 ? "nothing to change" : `${last.changed} item${last.changed === 1 ? "" : "s"}`}.
            {last.keptShared > 0 && ` ${last.keptShared} kept because another source also has ${last.keptShared === 1 ? "it" : "them"}.`}
            {last.keptEdited > 0 && ` ${last.keptEdited} kept because you edited ${last.keptEdited === 1 ? "it" : "them"}.`}
          </span>
          {last.changed > 0 && (
            <Button size="sm" variant="quiet" icon={<ArrowCounterClockwise size={16} aria-hidden="true" />} onClick={() => { onUndo(); setLast(null); }}>Undo</Button>
          )}
        </p>
      )}
    </section>
  );
}
