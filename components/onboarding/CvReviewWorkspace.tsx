"use client";

/**
 * The fixed-schema CV review: ten sections, every supported field shown (empty
 * when the CV did not contain it), repeatable records the student can add,
 * edit and remove, and the mandatory profile fields checked only when saving.
 * For each value it keeps apart where it came from, how sure the extractor
 * was, whether it passed checks, whether anyone verified it, and the CV text
 * it was read from (shown only for values actually read from the CV).
 */

import React, { useMemo, useState } from "react";
import { Plus, Trash, ArrowCounterClockwise, WarningCircle, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { ResumeIngestion } from "@/lib/client/onboarding/use-resume-ingestion";
import {
  RECORD_TYPES, SECTIONS, isChanged, isUserItem, summarize, validateValue,
  type FieldDef, type Problem, type RecordType, type SectionDef, type SectionId, type SingleDef, type WsItem,
} from "@/lib/resume/review-workspace";
import { ISSUE_TEXT, SECTION_LABEL, STATUS } from "@/components/onboarding/ReviewFlags";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/lib/client/cn";

const SOURCE_TEXT: Record<WsItem["source"], string> = {
  cv: "Read from your CV",
  derived: "Worked out from your CV",
  ai: "Suggested by AI from your CV",
  user: "Added by you",
  none: "Not found in your CV",
};

const inputClass =
  "w-full min-h-10 rounded-[var(--radius-control)] border border-input-border bg-input-background px-3 text-sm text-input-foreground placeholder:text-input-placeholder " +
  "focus-visible:outline-none focus-visible:border-focus-ring focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] aria-invalid:border-danger";

function problemFor(problems: Problem[], itemId: string, field: string) {
  return problems.find((p) => p.itemId === itemId && p.field === field)?.message;
}

function Control({ def, id, value, onChange, error, required }: { def: FieldDef; id: string; value: string; onChange: (v: string) => void; error?: string | null; required?: boolean }) {
  const common = { id, value, "aria-invalid": Boolean(error) || undefined, "aria-required": required || undefined, "aria-describedby": error ? `${id}-err` : undefined };
  if (def.kind === "select") {
    return (
      <select {...common} className={cn(inputClass, "cursor-pointer")} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {def.options?.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
      </select>
    );
  }
  if (def.kind === "textarea" || def.kind === "list") {
    return (
      <textarea
        {...common}
        rows={def.kind === "list" ? 3 : 2}
        placeholder={def.kind === "list" ? "One per line" : def.placeholder}
        className={cn(inputClass, "py-2 leading-normal resize-y")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      {...common}
      type={def.kind === "email" ? "email" : def.kind === "url" || def.kind === "github" ? "url" : def.kind === "phone" ? "tel" : "text"}
      inputMode={def.kind === "phone" ? "tel" : undefined}
      autoComplete="off"
      placeholder={def.placeholder}
      className={inputClass}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FieldRow({ def, item, keyName, problems, onChange, required, problemField }: { def: FieldDef; item: WsItem; keyName: string; problems: Problem[]; onChange: (v: string) => void; required?: boolean; problemField?: string }) {
  const id = `ws-${item.id}-${keyName}`;
  const value = item.values[keyName] ?? "";
  const flagged = problemFor(problems, item.id, problemField ?? keyName);
  const live = item.selected ? validateValue(def.kind, value) : null;
  const error = flagged ?? live;
  const extracted = (item.original[keyName] ?? "").trim();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-text-primary">
        {def.label}
        {required && <span className="ml-0.5 text-accent-warm" aria-label="required">*</span>}
        {!extracted && item.source !== "user" && !value && <span className="ml-1.5 font-normal text-text-dim">· not in CV</span>}
        {extracted && value.trim() !== extracted && <span className="ml-1.5 font-normal text-text-dim">· edited</span>}
      </label>
      <Control def={def} id={id} value={value} onChange={onChange} error={error} required={required} />
      {error && (
        <p id={`${id}-err`} role="alert" className="flex items-start gap-1 text-[11px] text-danger">
          <WarningCircle size={13} weight="bold" aria-hidden="true" className="mt-px shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Source, confidence, checks, verification and evidence: five separate facts, never merged. */
function ItemMeta({ item }: { item: WsItem }) {
  const changed = isChanged(item);
  const status = item.extractorStatus && !changed ? STATUS[item.extractorStatus] : undefined;
  const issues = changed ? [] : item.issues.map((i) => ISSUE_TEXT[i]).filter(Boolean);
  const verification = item.saved === "confirmed" ? (changed ? "Confirmed by you, with your edit" : "Confirmed by you")
    : item.issues.includes("second_model_agreed") ? "A second AI model agreed; not confirmed by you yet"
    : "Not verified yet";
  const ev = item.evidence;
  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-border-subtle pt-2 text-[11px] text-text-muted">
      <dl className="flex flex-wrap gap-x-3 gap-y-0.5">
        <div className="flex gap-1"><dt className="text-text-dim">Source</dt><dd>{SOURCE_TEXT[item.source]}</dd></div>
        {item.confidence && item.source !== "user" && <div className="flex gap-1"><dt className="text-text-dim">Confidence</dt><dd className="capitalize">{item.confidence}</dd></div>}
        {item.source !== "user" && item.source !== "none" && (
          <div className="flex gap-1">
            <dt className="text-text-dim">Checks</dt>
            <dd className={cn(status?.tone === "danger" ? "text-danger" : status ? "text-warning" : undefined)}>{changed ? "Edited by you" : status ? status.label : "Passed"}</dd>
          </div>
        )}
        <div className="flex gap-1"><dt className="text-text-dim">Verification</dt><dd>{verification}</dd></div>
      </dl>
      {issues.length > 0 && (
        <ul className="list-disc pl-4">{issues.map((t) => <li key={t}>{t}</li>)}</ul>
      )}
      {ev?.text && (
        <details className="group">
          <summary className="cursor-pointer select-none text-text-dim hover:text-text-muted">
            Where this is in your CV{typeof ev.page === "number" ? ` · page ${ev.page}` : ""}{ev.section && SECTION_LABEL[ev.section] ? ` · ${SECTION_LABEL[ev.section]}` : ""}
          </summary>
          <blockquote className="mt-1 break-words border-l-2 border-border-medium pl-2 italic text-text-muted">&ldquo;{ev.text}&rdquo;</blockquote>
        </details>
      )}
    </div>
  );
}

function SaveToggle({ item, onChange, label }: { item: WsItem; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-text-muted">
      <input
        type="checkbox"
        className="size-4 cursor-pointer rounded-[4px] accent-accent-warm"
        checked={item.selected}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span aria-hidden="true">Save</span>
    </label>
  );
}

function SingleField({ def, items, cv, problems }: { def: SingleDef; items: WsItem[]; cv: ResumeIngestion; problems: Problem[] }) {
  const visible = items.filter((i) => !i.removed);
  const sectionProblem = problems.find((p) => p.field === def.key && !visible.some((i) => i.id === p.itemId));
  return (
    <div className="flex flex-col gap-2">
      {visible.map((item, n) => {
        const fieldDef = { ...def, label: n > 0 ? `${def.label} ${n + 1}` : def.label };
        return (
          <div key={item.id} className={cn("rounded-lg border p-3", item.selected ? "border-border-medium bg-bg-surface/40" : "border-border-subtle")}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <FieldRow def={fieldDef} item={item} keyName="value" problemField={def.key} problems={problems} required={def.mandatory}
                  onChange={(v) => cv.ws.setValue(item.id, "value", v)} />
              </div>
              <div className="flex flex-col items-end gap-2 pt-5">
                <SaveToggle item={item} label={`Save ${fieldDef.label}`} onChange={(v) => cv.ws.setSelected(item.id, v)} />
                {isUserItem(item) && item.source === "user" && def.repeatable && (
                  <button type="button" onClick={() => cv.ws.remove(item.id)} className="text-[11px] text-text-dim hover:text-danger">Remove</button>
                )}
              </div>
            </div>
            {(item.source !== "none" || item.saved) && <ItemMeta item={item} />}
          </div>
        );
      })}
      {sectionProblem && <p role="alert" className="text-[11px] text-danger">{sectionProblem.message}</p>}
      {def.repeatable && (
        <button type="button" onClick={() => cv.ws.addSingle(def.key)} className="self-start text-xs font-medium text-accent-warm hover:underline">
          <Plus size={12} weight="bold" className="mr-1 inline" aria-hidden="true" />Add {def.label.toLowerCase()}
        </button>
      )}
    </div>
  );
}

function RecordCard({ item, cv, problems, isCurrent }: { item: WsItem; cv: ResumeIngestion; problems: Problem[]; isCurrent: boolean }) {
  const type = RECORD_TYPES[item.kind as RecordType];
  const title = summarize(item.kind, item.values) || `New ${type.label.toLowerCase()}`;
  const extracted = !isUserItem(item);
  const status = item.values.status;
  if (item.removed && extracted) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border-subtle px-3 py-2 text-xs text-text-dim">
        <span className="min-w-0 truncate line-through">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          Marked not right
          <button type="button" onClick={() => cv.ws.restore(item.id)} className="inline-flex items-center gap-1 font-medium text-accent-warm hover:underline">
            <ArrowCounterClockwise size={12} aria-hidden="true" />Undo
          </button>
        </span>
      </li>
    );
  }
  return (
    <li className={cn("rounded-lg border p-3 sm:p-4", item.selected ? "border-border-medium bg-bg-surface/40" : "border-border-subtle", isCurrent && "border-accent-warm/70")}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-text-primary">{title}</p>
          {item.kind === "education" && (
            <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-text-muted">
              <input type="radio" name="current-education" checked={isCurrent} onChange={() => cv.ws.setCurrentEducation(item.id)} className="accent-accent-warm" />
              Current education {isCurrent && <span className="text-accent-warm">(all fields required)</span>}
            </label>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SaveToggle item={item} label={`Save ${title}`} onChange={(v) => cv.ws.setSelected(item.id, v)} />
          <button type="button" onClick={() => cv.ws.remove(item.id)} className="inline-flex items-center gap-1 text-[11px] text-text-dim hover:text-danger" aria-label={`${extracted ? "Mark not right" : "Remove"}: ${title}`}>
            <Trash size={13} aria-hidden="true" />{extracted ? "Not right" : "Remove"}
          </button>
        </div>
      </div>
      {problemFor(problems, item.id, "currentEducation") && (
        <p role="alert" className="mb-3 flex items-start gap-1 text-[11px] text-danger">
          <WarningCircle size={13} weight="bold" aria-hidden="true" className="mt-px shrink-0" />
          {problemFor(problems, item.id, "currentEducation")}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {type.fields.map((def) => {
          const label = item.kind === "education" && def.key === "endDate"
            ? status === "Pursuing" ? "Expected passing-out date" : status === "Graduated" ? "Passing-out date" : def.label
            : def.label;
          const required = isCurrent && ["degree", "institution", "fieldOfStudy", "startDate", "status", "endDate"].includes(def.key);
          return (
            <div key={def.key} className={cn((def.kind === "textarea" || def.kind === "list") && "sm:col-span-2")}>
              <FieldRow def={{ ...def, label }} item={item} keyName={def.key} problems={problems} required={required}
                onChange={(v) => cv.ws.setValue(item.id, def.key, v)} />
            </div>
          );
        })}
      </div>
      <ItemMeta item={item} />
    </li>
  );
}

function SkillChip({ item, cv, problems }: { item: WsItem; cv: ResumeIngestion; problems: Problem[] }) {
  const id = `ws-${item.id}-name`;
  const error = problemFor(problems, item.id, "name");
  const status = item.extractorStatus ? STATUS[item.extractorStatus] : undefined;
  if (item.removed) return null;
  return (
    <li className={cn("flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1.5", item.selected ? "border-accent-warm/60 bg-bg-surface" : "border-border-subtle")}
      title={[SOURCE_TEXT[item.source], status?.label, item.evidence?.text ? `“${item.evidence.text}”` : null].filter(Boolean).join(" · ")}>
      <input type="checkbox" className="size-3.5 cursor-pointer accent-accent-warm" checked={item.selected} onChange={(e) => cv.ws.setSelected(item.id, e.target.checked)} aria-label={`Save skill ${item.values.name}`} />
      <label htmlFor={id} className="sr-only">Skill</label>
      <input id={id} value={item.values.name ?? ""} onChange={(e) => cv.ws.setValue(item.id, "name", e.target.value)} aria-invalid={Boolean(error) || undefined}
        size={Math.max(4, Math.min(28, (item.values.name ?? "").length + 1))}
        className="min-w-0 bg-transparent text-xs text-text-primary focus-visible:outline-none" />
      {status && <span className={cn("size-1.5 rounded-full", status.tone === "danger" ? "bg-danger" : "bg-warning")} aria-label={status.label} />}
      {isUserItem(item) && (
        <button type="button" onClick={() => cv.ws.remove(item.id)} className="text-text-dim hover:text-danger" aria-label={`Remove ${item.values.name || "skill"}`}>
          <Trash size={12} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

function Section({ section, cv, problems }: { section: SectionDef; cv: ResumeIngestion; problems: Problem[] }) {
  const items = cv.workspace.items.filter((i) => i.section === section.id);
  const sectionProblems = problems.filter((p) => p.section === section.id);
  const orphan = sectionProblems.filter((p) => p.itemId === null && !section.singles.some((s) => s.key === p.field));
  const saved = items.filter((i) => i.selected && !i.removed).length;
  return (
    <section id={`cv-ws-${section.id}`} aria-labelledby={`cv-ws-${section.id}-title`} className="scroll-mt-24 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={`cv-ws-${section.id}-title`} className="font-display text-sm font-bold text-text-primary sm:text-base">{section.title}</h3>
        <span className="font-mono text-[11px] tabular text-text-muted">{saved} to save</span>
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="quiet" onClick={() => cv.ws.setSection(section.id, true)}>Tick all</Button>
          <Button size="sm" variant="ghost" onClick={() => cv.ws.setSection(section.id, false)}>Clear</Button>
        </span>
      </div>
      <p className="mb-3 text-xs text-text-muted">{section.description}</p>
      {orphan.map((p) => <p key={p.field} role="alert" className="mb-3 rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">{p.message}</p>)}

      {section.singles.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {section.singles.map((def) => (
            <div key={def.key} className={cn((def.kind === "textarea" || def.repeatable) && "lg:col-span-2")}>
              <SingleField def={def} items={items.filter((i) => i.kind === "single" && i.field === def.key)} cv={cv} problems={problems} />
            </div>
          ))}
        </div>
      )}

      {section.recordTypes.map((type) => {
        const def = RECORD_TYPES[type];
        const rows = items.filter((i) => i.kind === type);
        const shown = rows.filter((i) => !(i.removed && isUserItem(i)));
        return (
          <div key={type} className="mb-4 last:mb-0">
            {section.recordTypes.length > 1 && <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{def.label}s</h4>}
            {shown.length === 0 && <p className="mb-2 text-xs text-text-dim">Nothing found in your CV.</p>}
            {type === "skill" ? (
              <ul className="mb-2 flex flex-wrap gap-2">{shown.map((i) => <SkillChip key={i.id} item={i} cv={cv} problems={problems} />)}</ul>
            ) : (
              <ul className="mb-2 flex flex-col gap-3">
                {shown.map((i) => <RecordCard key={i.id} item={i} cv={cv} problems={problems} isCurrent={cv.workspace.currentEducationId === i.id} />)}
              </ul>
            )}
            <Button size="sm" variant="ghost" icon={<Plus size={14} weight="bold" />} onClick={() => cv.ws.add(type)}>{def.addLabel}</Button>
          </div>
        );
      })}
    </section>
  );
}

export function CvReviewWorkspace({ cv, onSave, reviewError }: { cv: ResumeIngestion; onSave: () => void; reviewError: string | null }) {
  const [active, setActive] = useState<SectionId>("identity");
  const problems = cv.problems;
  const counts = useMemo(() => Object.fromEntries(SECTIONS.map((s) => [s.id, problems.filter((p) => p.section === s.id).length])), [problems]);
  const status = cv.state === "SAVING" ? "saving" : cv.reviewSaved && !cv.dirty ? "saved" : cv.dirty ? "unsaved" : "review";
  const go = (id: SectionId) => {
    setActive(id);
    document.getElementById(`cv-ws-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <section aria-labelledby="cv-review-title" className="rounded-card border border-border-medium bg-bg-elevated shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-medium px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 id="cv-review-title" className="font-display text-base font-bold text-text-primary sm:text-lg">Review your CV details</h2>
          <p className="text-xs text-text-muted sm:text-sm">
            From {cv.fileName}. Check each section, fix or fill in anything, and tick what to save. Fields marked <span className="text-accent-warm">*</span> are needed to finish your profile.
          </p>
        </div>
        <StatusChip tone={status === "saved" ? "verified" : status === "unsaved" ? "warning" : status === "saving" ? "busy" : "neutral"} icon={status === "review" ? null : undefined}>
          {status === "saved" ? "Saved to profile" : status === "unsaved" ? "Unsaved changes" : status === "saving" ? "Saving…" : "Not saved yet"}
        </StatusChip>
      </div>

      {cv.advice && <p className="border-b border-border-medium px-4 py-3 text-xs text-text-muted sm:px-5">{cv.advice}</p>}

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="CV review sections" className="sticky top-0 z-10 border-b border-border-medium bg-bg-elevated lg:top-4 lg:self-start lg:border-b-0 lg:border-r">
          <ol className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:overflow-visible lg:py-4">
            {SECTIONS.map((s, n) => (
              <li key={s.id} className="shrink-0">
                <button type="button" onClick={() => go(s.id)} aria-current={active === s.id ? "true" : undefined}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs", active === s.id ? "bg-bg-surface text-text-primary" : "text-text-muted hover:text-text-primary")}>
                  <span className="font-mono text-[10px] text-text-dim">{n + 1}</span>
                  <span className="whitespace-nowrap lg:whitespace-normal">{s.title}</span>
                  {counts[s.id] > 0 && <span className="ml-auto rounded-full bg-danger-bg px-1.5 text-[10px] font-semibold text-danger" aria-label={`${counts[s.id]} to fix`}>{counts[s.id]}</span>}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0 divide-y divide-border-medium">
          {SECTIONS.map((s) => <Section key={s.id} section={s} cv={cv} problems={problems} />)}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-medium bg-bg-elevated p-4 sm:flex-row sm:items-center sm:px-5" aria-live="polite">
        <div className="min-w-0 flex-1 text-xs">
          {reviewError ? (
            <p className="flex items-start gap-1.5 text-danger"><WarningCircle size={15} weight="bold" className="mt-px shrink-0" aria-hidden="true" />{reviewError}</p>
          ) : status === "saved" ? (
            <p className="flex items-center gap-1.5 text-verified"><CheckCircle size={15} weight="bold" aria-hidden="true" />Your reviewed details are saved.</p>
          ) : status === "unsaved" ? (
            <p className="text-text-muted">You have unsaved changes.</p>
          ) : (
            <p className="text-text-muted">Nothing is saved until you choose Save.</p>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={onSave} loading={cv.state === "SAVING"} icon={cv.reviewSaved && cv.dirty ? <ArrowCounterClockwise size={14} /> : undefined} className="font-semibold">
          Save reviewed details
        </Button>
      </div>
    </section>
  );
}
