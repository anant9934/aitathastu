"use client";

/**
 * One editable profile value (Task 2.1.4): shows the value, edits in place,
 * saves on Enter, cancels on Esc. Validation runs on save; the error sits under
 * the input.
 */
import React, { useEffect, useRef, useState } from "react";
import { PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusChip";

export function InlineField({ label, value, onSave, type = "text", placeholder, required, validate, source, eoraId }: {
  label: string;
  value?: string;
  onSave: (next: string) => void | Promise<void>;
  type?: "text" | "email" | "tel" | "number";
  placeholder?: string;
  required?: boolean;
  validate?: (v: string) => string | null;
  /** Where the current value came from, e.g. "CV". */
  source?: string;
  eoraId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);

  const close = () => { setEditing(false); setError(null); requestAnimationFrame(() => trigger.current?.focus()); };
  const save = () => {
    const v = draft.trim();
    const problem = required && !v ? `${label} is required.` : validate?.(v) ?? null;
    if (problem) { setError(problem); input.current?.focus(); return; }
    if (v !== (value ?? "")) void onSave(v);
    close();
  };

  if (editing) {
    return (
      <form
        noValidate
        data-eora-id={eoraId}
        className="flex min-w-0 flex-col gap-2"
        onSubmit={(e) => { e.preventDefault(); save(); }}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); close(); } }}
      >
        <TextField ref={input} label={label} required={required} type={type} value={draft} placeholder={placeholder} error={error}
          onChange={(e) => { setDraft(e.target.value); setError(null); }} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="primary">Save</Button>
          <Button size="sm" variant="ghost" onClick={close}>Cancel</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1" data-eora-id={eoraId}>
      <span className="text-xs text-muted">{label}{required && <span aria-hidden="true"> *</span>}</span>
      <div className="flex min-h-11 items-center gap-2">
        <span className={value ? "min-w-0 break-words text-base text-ink" : "text-sm text-warning"}>
          {value || (required ? "Not added yet (needed)" : "Not added")}
        </span>
        <Button ref={trigger} size="sm" variant="quiet" aria-label={`${value ? "Edit" : "Add"} ${label}`} icon={<PencilSimple size={15} aria-hidden="true" />}
          onClick={() => { setDraft(value ?? ""); setEditing(true); }}>
          {value ? "Edit" : "Add"}
        </Button>
      </div>
      {source && value ? <Tag className="self-start">From {source}</Tag> : null}
    </div>
  );
}
