"use client";

/**
 * Skills review (Task 2.1.4): confirmed skills and suggestions from sources,
 * each renamable in place. Accepting adds to the confirmed list; rejecting
 * leaves a hidden tombstone so the next sync does not suggest it again.
 */
import React, { useEffect, useRef, useState } from "react";
import { Check, PencilSimple, Plus, X } from "@phosphor-icons/react/dist/ssr";
import { editEntry, isRejected, rejectEntry, replaceEntry } from "@/lib/review/entry-edits";
import { fromSource } from "@/lib/review/source-actions";
import { Button, IconButton } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusChip";
import { sourceLabel } from "./EntryList";
import type { TechCandidate } from "@/lib/client/onboarding/types";

const lc = (s: string) => s.trim().toLowerCase();

export function SkillReview({ skills, candidates, onSkillsChange, onCandidatesChange, sourceFilter }: {
  skills: string[];
  candidates: TechCandidate[];
  onSkillsChange: (next: string[]) => void;
  onCandidatesChange: (next: TechCandidate[]) => void;
  sourceFilter?: string | null;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const has = (name: string, except?: string) => skills.some((s) => lc(s) === lc(name) && lc(s) !== lc(except ?? "\u0000"));
  const suggestions = candidates.filter((c) => !isRejected("techCandidates", c) && !has(c.name) && (!sourceFilter || fromSource(c, sourceFilter)));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    if (has(name)) { setError(`${name} is already in your skills.`); return; }
    onSkillsChange([...skills, name]);
    setDraft("");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <form noValidate onSubmit={add} className="flex items-start gap-2">
        <TextField
          wrapperClassName="flex-1"
          label="Add a skill"
          value={draft}
          placeholder="e.g. PyTorch"
          error={error}
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
        />
        <Button type="submit" variant="secondary" className="mt-7" disabled={!draft.trim()} icon={<Plus size={16} aria-hidden="true" />}>Add</Button>
      </form>

      <section aria-labelledby="skills-confirmed">
        <h4 id="skills-confirmed" className="mb-2 text-sm font-semibold">Your skills <span className="font-mono tabular text-muted">{skills.length}</span></h4>
        {skills.length === 0 ? (
          <p className="text-sm text-muted">No confirmed skills yet. Accept a suggestion below or add your own.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <li key={s}>
                {editing === `skill:${s}` ? (
                  <RenameForm initial={s} clash={(v) => has(v, s)} onCancel={() => setEditing(null)}
                    onSave={(v) => { onSkillsChange(skills.map((x) => (x === s ? v : x))); setEditing(null); }} />
                ) : (
                  <span className="inline-flex h-9 items-center gap-1 rounded-full border border-verified/40 bg-verified-bg pl-3 pr-1 text-sm text-ink">
                    <Check size={14} weight="bold" aria-hidden="true" className="text-verified" />
                    <span className="mr-0.5">{s}</span>
                    <IconButton label={`Rename ${s}`} className="size-7 pointer-coarse:size-9" onClick={() => setEditing(`skill:${s}`)}><PencilSimple size={14} aria-hidden="true" /></IconButton>
                    <IconButton label={`Remove ${s}`} className="size-7 text-muted hover:text-danger pointer-coarse:size-9" onClick={() => onSkillsChange(skills.filter((x) => x !== s))}><X size={14} aria-hidden="true" /></IconButton>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {suggestions.length > 0 && (
        <section aria-labelledby="skills-suggested">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 id="skills-suggested" className="text-sm font-semibold">Found in your sources <span className="font-mono tabular text-muted">{suggestions.length}</span></h4>
            {suggestions.length > 1 && (
              <Button size="sm" variant="ghost" icon={<Check size={16} aria-hidden="true" />}
                onClick={() => onSkillsChange([...skills, ...Array.from(new Set(suggestions.map((c) => c.name))).filter((n) => !has(n))])}>
                Accept all {suggestions.length}
              </Button>
            )}
          </div>
          <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
            {suggestions.map((c) => {
              const id = `cand:${c.originKey ?? c.name}:${c.source}`;
              return (
                <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                  {editing === id ? (
                    <RenameForm initial={c.name} clash={(v) => has(v)} onCancel={() => setEditing(null)}
                      onSave={(v) => { onCandidatesChange(replaceEntry("techCandidates", candidates, c, editEntry("techCandidates", c, { name: v }))); setEditing(null); }} />
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 basis-32 font-medium">{c.name}</span>
                      <Tag>From {sourceLabel(c.source)}{c.sourceFile ? ` · ${c.sourceFile}` : ""}{c.editedFields?.length ? " · edited" : ""}</Tag>
                      <span className="flex gap-1">
                        <Button size="sm" variant="primary" aria-label={`Accept ${c.name}`} icon={<Check size={16} aria-hidden="true" />} onClick={() => onSkillsChange([...skills, c.name])}>Accept</Button>
                        <IconButton label={`Rename ${c.name}`} onClick={() => setEditing(id)}><PencilSimple size={16} aria-hidden="true" /></IconButton>
                        <IconButton label={`Reject ${c.name}`} className="text-muted hover:text-danger" onClick={() => onCandidatesChange(replaceEntry("techCandidates", candidates, c, rejectEntry("techCandidates", c)))}><X size={16} aria-hidden="true" /></IconButton>
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function RenameForm({ initial, clash, onSave, onCancel }: { initial: string; clash: (v: string) => boolean; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.select(); }, []);
  return (
    <form
      noValidate
      className="flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) { setError("A skill needs a name."); return; }
        if (clash(v)) { setError(`${v} is already in your skills.`); return; }
        onSave(v);
      }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
    >
      <TextField ref={input} label="Skill name" labelHidden value={value} error={error} onChange={(e) => { setValue(e.target.value); setError(null); }} wrapperClassName="w-48" />
      <Button type="submit" size="sm" variant="primary" className="min-h-11">Save</Button>
      <Button size="sm" variant="ghost" className="min-h-11" onClick={onCancel}>Cancel</Button>
    </form>
  );
}
