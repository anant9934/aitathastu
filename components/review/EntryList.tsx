"use client";

/**
 * Field-level review (Task 2.1.4): every entry from every source can be edited
 * in place, accepted, rejected (with undo) or added by hand. All mutations go
 * through lib/review/entry-edits so edits keep their import key and rejections
 * stay as hidden tombstones; a late scraper write can neither duplicate an
 * edit nor bring a rejection back. The parent owns and persists the list.
 */
import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowCounterClockwise, Check, PencilSimple, Plus, X } from "@phosphor-icons/react/dist/ssr";
import { fromSource } from "@/lib/review/source-actions";
import { editEntry, entryKey, isRejected, rejectEntry, replaceEntry, setAccepted, type ReviewableEntry, type ReviewField } from "@/lib/review/entry-edits";
import { Button } from "@/components/ui/Button";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { cn } from "@/lib/client/cn";

export type ReviewFieldSpec = {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "lines" | "list";
  required?: boolean;
  placeholder?: string;
  /** Spans both columns of the edit grid. */
  wide?: boolean;
};

type Entry = ReviewableEntry & { source?: string; sources?: string[] };

const SOURCE_LABELS: Record<string, string> = {
  resume: "CV", resume_extracted: "CV", github: "GitHub", linkedin: "LinkedIn", scholar: "Scholar", orcid: "ORCID",
  kaggle: "Kaggle", leetcode: "LeetCode", hackerrank: "HackerRank", huggingface: "Hugging Face", portfolio: "Portfolio",
  stackoverflow: "Stack Overflow", devto: "DEV", google_scholar: "Google Scholar", manual: "You",
  self_reported: "You", project: "Your projects", imported: "An import", institutional: "Your institution", eris: "ERIS", faculty: "Faculty review",
};
export const sourceLabel = (s?: string) => (s ? SOURCE_LABELS[s.toLowerCase()] ?? s.replace(/^Source:\s*/i, "") : "Imported");

const toInput = (spec: ReviewFieldSpec, v: unknown) =>
  Array.isArray(v) ? v.join(spec.kind === "list" ? ", " : "\n") : typeof v === "string" || typeof v === "number" ? String(v) : "";
const fromInput = (spec: ReviewFieldSpec, v: string): unknown => {
  if (spec.kind === "list") return v.split(",").map((s) => s.trim()).filter(Boolean);
  if (spec.kind === "lines") return v.split("\n").map((s) => s.trim()).filter(Boolean);
  return v.trim() || undefined;
};

export function EntryList<T extends Entry>({
  field, entries, onChange, fields, title, subtitle, meta, noun, emptyText, sourceFilter, eoraId,
}: {
  field: ReviewField;
  entries: T[];
  onChange: (next: T[]) => void;
  fields: ReviewFieldSpec[];
  title: (e: T) => string;
  subtitle?: (e: T) => string | undefined;
  meta?: (e: T) => (string | undefined)[];
  /** Singular, lower case: "education entry", "role", "project". */
  noun: string;
  emptyText: string;
  /** Show only entries this source contributed (Task 2.1.5). */
  sourceFilter?: string | null;
  eoraId?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [undo, setUndo] = useState<{ key: string; prev: T } | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const keyOf = (e: T, i: number) => `${entryKey(field, e)}|${i}`;

  const inScope = (e: T) => !sourceFilter || fromSource(e, sourceFilter);
  const visible = entries.filter((e) => !isRejected(field, e) && inScope(e));
  const rejected = entries.filter((e) => isRejected(field, e));

  const commit = (target: T, next: T) => onChange(replaceEntry(field, entries, target, next));
  const reject = (e: T, k: string) => { setUndo({ key: k, prev: e }); commit(e, rejectEntry(field, e)); };
  const restore = (e: T, prev?: T) => commit(e, prev ?? ({ ...e, status: "candidate" } as T));
  const pending = visible.filter((e) => e.status !== "confirmed");

  return (
    <div className="flex flex-col gap-3" data-eora-id={eoraId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted">
          <span className="font-mono tabular text-warm-ivory">{visible.length - pending.length}</span> confirmed
          {pending.length > 0 && <>, <span className="font-mono tabular text-soft-amber">{pending.length}</span> waiting for you</>}
        </p>
        <div className="flex flex-wrap gap-2">
          {pending.length > 1 && (
            <Button size="sm" variant="ghost" icon={<Check size={16} aria-hidden="true" />}
              onClick={() => onChange(entries.map((e) => (pending.includes(e) ? setAccepted(e, true) : e)))}>
              Accept all {pending.length}
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => { setAdding(true); setEditing(null); }}>
            Add {noun}
          </Button>
        </div>
      </div>

      {adding && (
        <EntryForm
          heading={`New ${noun}`}
          fields={fields}
          initial={{} as T}
          onCancel={() => setAdding(false)}
          onSave={(values) => {
            onChange([{ ...values, status: "confirmed", source: "manual", sources: ["manual"] } as T, ...entries]);
            setAdding(false);
          }}
        />
      )}

      {visible.length === 0 && !adding && (
        <p className="rounded-lg border border-dashed border-border-medium px-4 py-5 text-sm text-text-muted">
          {sourceFilter ? `Nothing from ${sourceLabel(sourceFilter)} in this section.` : emptyText}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {entries.map((e, i) => {
          const k = keyOf(e, i);
          if (!inScope(e)) return null;
          if (isRejected(field, e)) {
            return undo?.key === k ? (
              <li key={k} aria-live="polite" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border-medium px-4 py-2 text-sm text-text-muted">
                <span>Rejected &ldquo;{title(e)}&rdquo;. It won&apos;t be added to your profile.</span>
                <Button size="sm" variant="quiet" icon={<ArrowCounterClockwise size={16} aria-hidden="true" />} onClick={() => { restore(e, undo.prev); setUndo(null); }}>
                  Undo
                </Button>
              </li>
            ) : null;
          }
          if (editing === k) {
            return (
              <li key={k}>
                <EntryForm
                  heading={`Edit ${noun}`}
                  fields={fields}
                  initial={e}
                  onCancel={() => setEditing(null)}
                  onSave={(values) => { commit(e, editEntry(field, e, values as Partial<T>)); setEditing(null); }}
                />
              </li>
            );
          }
          const confirmed = e.status === "confirmed";
          const sources = (e.sources?.length ? e.sources : [e.source]).filter(Boolean) as string[];
          const chips = (meta?.(e) ?? []).filter(Boolean) as string[];
          return (
            <li
              key={k}
              className={cn(
                "rounded-lg border bg-bg-elevated px-4 py-3.5 transition-colors shadow-card",
                confirmed ? "border-border-medium" : "border-champagne/40 bg-bg-surface/50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="break-words font-display text-base font-medium text-warm-ivory">{title(e)}</h4>
                  {subtitle?.(e) && <p className="mt-0.5 break-words text-sm text-text-muted">{subtitle(e)}</p>}
                </div>
                {confirmed ? <StatusChip tone="verified" icon={Check}>Confirmed</StatusChip> : <StatusChip tone="signal">Suggested</StatusChip>}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {sources.map((s) => <Tag key={s}>From {sourceLabel(s)}</Tag>)}
                {chips.map((c) => <Tag key={c}>{c}</Tag>)}
                {e.editedFields?.length ? <Tag className="border-soft-amber/40 text-soft-amber">Edited by you</Tag> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={confirmed ? "secondary" : "primary"}
                  aria-pressed={confirmed}
                  icon={<Check size={16} aria-hidden="true" />}
                  onClick={() => commit(e, setAccepted(e, !confirmed))}
                >
                  {confirmed ? "Accepted" : "Accept"}
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Edit ${title(e)}`} icon={<PencilSimple size={16} aria-hidden="true" />} onClick={() => { setEditing(k); setAdding(false); }}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-bg" aria-label={`Reject ${title(e)}`} icon={<X size={16} aria-hidden="true" />} onClick={() => reject(e, k)}>
                  Reject
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {rejected.length > 0 && (
        <div>
          <Button size="sm" variant="quiet" aria-expanded={showRejected} onClick={() => setShowRejected((v) => !v)}>
            {showRejected ? "Hide" : "Show"} {rejected.length} rejected
          </Button>
          {showRejected && (
            <ul className="mt-2 divide-y divide-border-medium rounded-lg border border-border-medium">
              {rejected.map((e, i) => (
                <li key={keyOf(e, i)} className="flex items-center justify-between gap-2 px-4 py-1.5 text-sm text-text-muted">
                  <span className="min-w-0 truncate">{title(e)}</span>
                  <Button size="sm" variant="quiet" onClick={() => restore(e)}>Restore</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function EntryForm<T extends Entry>({ heading, fields, initial, onSave, onCancel }: {
  heading: string;
  fields: ReviewFieldSpec[];
  initial: T;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, toInput(f, (initial as Record<string, unknown>)[f.key])])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.querySelector<HTMLElement>("input, textarea")?.focus(); }, []);

  const save = () => {
    const missing = Object.fromEntries(fields.filter((f) => f.required && !values[f.key]?.trim()).map((f) => [f.key, `Add ${f.label.toLowerCase()} to save.`]));
    setErrors(missing);
    if (Object.keys(missing).length) {
      form.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    onSave(Object.fromEntries(fields.map((f) => [f.key, fromInput(f, values[f.key] ?? "")])));
  };

  return (
    <form
      ref={form}
      noValidate
      aria-label={heading}
      onSubmit={(ev) => { ev.preventDefault(); save(); }}
      onKeyDown={(ev) => { if (ev.key === "Escape") { ev.preventDefault(); onCancel(); } }}
      className="rounded-card border border-soft-amber/40 bg-bg-elevated p-4 shadow-card"
    >
      <p className="mb-3 font-display text-sm font-semibold text-text-primary">{heading}</p>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {fields.map((f) => {
          const common = {
            label: <>{f.label}</>,
            required: f.required,
            value: values[f.key] ?? "",
            placeholder: f.placeholder,
            error: errors[f.key],
            hint: f.kind === "list" ? "Separate with commas." : f.kind === "lines" ? "One per line." : undefined,
            wrapperClassName: f.wide || f.kind === "textarea" || f.kind === "lines" ? "sm:col-span-2" : undefined,
          };
          const onChangeValue = (v: string) => setValues((cur) => ({ ...cur, [f.key]: v }));
          return f.kind === "textarea" || f.kind === "lines" ? (
            <TextAreaField key={`${id}-${f.key}`} {...common} onChange={(e) => onChangeValue(e.target.value)} />
          ) : (
            <TextField key={`${id}-${f.key}`} {...common} onChange={(e) => onChangeValue(e.target.value)} />
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="sm" icon={<Check size={16} aria-hidden="true" />}>Save</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
