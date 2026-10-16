"use client";

import React, { useState } from "react";
import { ArrowSquareOut, CaretDown, Check, GitFork, Plus, Star, X } from "@phosphor-icons/react/dist/ssr";
import type { ProjectEntry } from "@/lib/client/onboarding/types";
import { requestJson, describeError } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextAreaField, TextField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { sourceLabel } from "@/components/review/EntryList";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";
import { FolderSimple } from "@phosphor-icons/react/dist/ssr";

export function ProjectsStep({ projects, saving, guide, onChange, onChangeSoon, onBack, onContinue }: {
  projects: ProjectEntry[];
  saving: boolean;
  guide: React.ReactNode;
  /** Immediate save (status changes, adds). */
  onChange: (next: ProjectEntry[]) => void;
  /** Debounced save (typing). */
  onChangeSoon: (next: ProjectEntry[]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const visible = projects.filter((p) => p.status !== "removed" && p.status !== "rejected");
  const [open, setOpen] = useState<string | null>(visible.find((p) => p.status === "candidate")?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", tech: "" });
  const [formError, setFormError] = useState<string | null>(null);
  useEoraStepEvents({ onNext: onContinue, onBack });

  const update = (id: string, patch: Partial<ProjectEntry>, soon = false) => {
    const next = projects.map((p) => (p.id === id ? { ...p, ...patch } : p));
    (soon ? onChangeSoon : onChange)(next);
  };

  const add = () => {
    if (!form.title.trim()) { setFormError("Give the project a name."); return; }
    const p: ProjectEntry = {
      id: `proj_manual_${Date.now()}`, title: form.title.trim(), description: form.description.trim(),
      technologies: form.tech.split(",").map((t) => t.trim()).filter(Boolean), sources: ["manual"], status: "confirmed", contribution: [], contributionNote: "",
    };
    onChange([p, ...projects]);
    setForm({ title: "", description: "", tech: "" });
    setAdding(false);
    setOpen(p.id);
  };

  const pending = visible.filter((p) => p.status === "candidate").length;

  return (
    <>
      <StepHeader
        title="Confirm your projects"
        description="Projects are the strongest evidence of what you can build. For imported repositories, say what you personally did; that is what makes it your evidence."
        guide={guide}
        eoraId="eora-github-projects"
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted">
          <span className="font-mono text-warm-ivory tabular">{visible.length - pending}</span> confirmed
          {pending > 0 && <>, <span className="font-mono text-soft-amber tabular">{pending}</span> waiting for you</>}
        </p>
        <Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setAdding(true)} data-eora-id="eora-add-project-trigger">Add a project</Button>
      </div>

      {adding && (
        <form noValidate onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-3 grid gap-3 rounded-card border border-soft-amber/40 bg-bg-elevated p-4 shadow-card">
          <TextField label="Project name" required value={form.title} error={formError} onChange={(e) => { setForm({ ...form, title: e.target.value }); setFormError(null); }} autoFocus />
          <TextAreaField label="What it does" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextField label="Tech stack" hint="Separate with commas." value={form.tech} onChange={(e) => setForm({ ...form, tech: e.target.value })} />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm">Add project</Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {visible.length === 0 && !adding ? (
        <EmptyState
          className="mt-4"
          icon={FolderSimple}
          title="No projects yet"
          actions={<Button variant="primary" onClick={() => setAdding(true)} icon={<Plus size={16} aria-hidden="true" />}>Add a project</Button>}
        >
          Add something you built, or go back and connect GitHub to bring your repositories in.
        </EmptyState>
      ) : (
        <ul className="mt-4 flex flex-col gap-2" data-eora-id="eora-projects-list">
          {visible.map((p) => (
            <ProjectRow key={p.id} p={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} update={update} />
          ))}
        </ul>
      )}

      <StepFooter onBack={onBack} onNext={onContinue} saving={saving} nextLabel={pending ? `Continue (${pending} left unconfirmed)` : "Continue"} />
    </>
  );
}

function ProjectRow({ p, open, onToggle, update }: { p: ProjectEntry; open: boolean; onToggle: () => void; update: (id: string, patch: Partial<ProjectEntry>, soon?: boolean) => void }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const fromGithub = p.sources.includes("github");
  const needsNote = fromGithub && !p.contributionNote.trim();
  const repo = p.url ? /^https:\/\/github\.com\/([^/]+)\/([^/?#]+)\/?$/i.exec(p.url) : null;

  const interpret = async () => {
    if (!repo || !consent) return;
    setBusy(true);
    setMsg(null);
    const res = await requestJson<{ interpretation?: { projectPurpose: string; detectedTechnologies: string[]; uncertaintyNotes?: string[] } }>("/api/student/projects/interpret", {
      method: "POST", json: { repoFullName: `${repo[1]}/${repo[2]}`, aiConsent: true },
    });
    setBusy(false);
    if (!res.ok || !res.data?.interpretation) { setMsg({ kind: "danger", text: res.ok ? "No reading came back for this repository. Try again later." : describeError(res.error) }); return; }
    const r = res.data.interpretation;
    update(p.id, { description: r.projectPurpose, aiPurpose: r.projectPurpose, technologies: Array.from(new Set([...(p.technologies || []), ...r.detectedTechnologies])), uncertaintyNotes: r.uncertaintyNotes });
    setMsg({ kind: "success", text: "Reading added for your review. It describes the repository, not your personal part in it." });
  };

  return (
    <li className={cn("rounded-card border bg-bg-elevated transition-colors shadow-card", p.status === "confirmed" ? "border-border-medium" : "border-champagne/40")}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display font-medium text-warm-ivory">{p.title}</span>
            {p.isFork && <Tag><GitFork size={12} aria-hidden="true" className="mr-1" />Fork</Tag>}
            {typeof p.stars === "number" && p.stars > 0 && <span className="inline-flex items-center gap-1 font-mono text-2xs text-text-muted tabular"><Star size={12} aria-hidden="true" className="text-soft-amber" />{p.stars}</span>}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{p.description || "No description yet."}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.sources.map((s) => <Tag key={s}>From {sourceLabel(s)}</Tag>)}
            {p.technologies.slice(0, 4).map((t) => <Tag key={t} mono>{t}</Tag>)}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {p.status === "confirmed" ? <StatusChip tone="verified" icon={Check}>Confirmed</StatusChip> : <StatusChip tone="signal">To review</StatusChip>}
          <CaretDown size={16} aria-hidden="true" className={cn("text-text-muted transition-transform duration-200", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border-medium px-4 py-4">
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-start text-sm text-champagne hover:underline">
              {p.url.replace(/^https?:\/\//, "")}<ArrowSquareOut size={14} aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          <TextAreaField
            data-eora-id="eora-contribution-note"
            label="What did you personally work on?"
            hint={fromGithub ? "Needed before you confirm an imported repository." : "Optional, but it makes the project stronger evidence."}
            value={p.contributionNote}
            onChange={(e) => update(p.id, { contributionNote: e.target.value }, true)}
          />
          {repo && (
            <div className="flex flex-col gap-2 rounded-lg border border-border-medium bg-bg-surface/50 p-3.5">
              <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label="Let AI read this repository to suggest a description" description="It reads public files only and may be wrong. You review the result." />
              <Button size="sm" variant="secondary" className="self-start" disabled={!consent} loading={busy} loadingLabel="Reading…" onClick={() => void interpret()}>Suggest a description</Button>
              {p.uncertaintyNotes?.length ? <p className="text-xs text-text-muted">Not sure about: {p.uncertaintyNotes.join("; ")}</p> : null}
            </div>
          )}
          {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
          <div className="flex flex-wrap gap-2">
            {p.status !== "confirmed" ? (
              <Button variant="primary" size="sm" disabled={needsNote} icon={<Check size={16} aria-hidden="true" />} onClick={() => update(p.id, { status: "confirmed" })}>
                Confirm project
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => update(p.id, { status: "candidate" })}>Mark as not confirmed</Button>
            )}
            <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-bg" icon={<X size={16} aria-hidden="true" />} onClick={() => update(p.id, { status: "removed" })}>
              Not mine, remove
            </Button>
            {needsNote && p.status !== "confirmed" && <p className="w-full text-xs text-text-muted">Add what you did above to confirm this repository.</p>}
          </div>
        </div>
      )}
    </li>
  );
}
