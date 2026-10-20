"use client";

/**
 * Project Evidence Ledger (Tasks 2.5.1–2.5.5, 2.2.4): every project from every
 * source, each in or out of the portfolio, editable in place, with an
 * optional AI description (portfolio projects only), a preview image or a
 * generated tile, and chosen card chips. A second tab lists publications from
 * a verified research ID. Talks only to /api/student/projects/* and
 * /api/student/publications.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArrowClockwise, Check, DownloadSimple, Image as ImageIcon, PencilSimple, Plus, Sparkle, Star, FolderSimple, BookOpen } from "@phosphor-icons/react/dist/ssr";
import type { Ledger, LedgerProject, LedgerPublication } from "@/lib/services/project-ledger-service";
import { HIGHLIGHT_OPTIONS, type HighlightOption } from "@/lib/domain/project-ledger";
import { requestJson, describeError } from "@/lib/client/api";
import { PageFrame } from "@/components/layout/StudentShell";
import { Button, buttonClass } from "@/components/ui/Button";
import { Checkbox, TextAreaField, TextField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { EvidenceStrip } from "@/components/ui/EvidenceStrip";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/StatusChip";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast, useConfirm } from "@/components/ui/Feedback";
import { sourceLabel } from "@/components/review/EntryList";
import { cn } from "@/lib/client/cn";
import { GitHubIntelligenceDashboard } from "@/components/github/GitHubIntelligenceDashboard";

const CHIP_LABEL: Record<HighlightOption, string> = { stars: "Stars", forks: "Forks", languages: "Languages", role: "My role" };

async function send<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await requestJson<T>(url, { method, json: body });
  if (!res.ok) throw new Error(describeError(res.error));
  return res.data;
}

export function ProjectLedgerView() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("projects");
  const [source, setSource] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyIncluded, setOnlyIncluded] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await requestJson<Ledger>("/api/student/projects/ledger", { cache: "no-store" });
    if (res.ok) { setLedger(res.data); setError(null); } else setError(describeError(res.error));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const replace = (p: LedgerProject) => setLedger((l) => l && ({ ...l, projects: l.projects.some((x) => x.id === p.id) ? l.projects.map((x) => (x.id === p.id ? { ...x, ...p, contribution: x.contribution } : x)) : [p, ...l.projects] }));
  const drop = (id: string) => setLedger((l) => l && ({ ...l, projects: l.projects.filter((x) => x.id !== id) }));
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (ledger?.projects ?? []).filter((p) => (!source || p.sources.includes(source)) && (!onlyIncluded || p.portfolioIncluded) && (!q || p.title.toLowerCase().includes(q) || p.technologies.some((t) => t.toLowerCase().includes(q))));
  }, [ledger, source, query, onlyIncluded]);

  if (error && !ledger) return <PageFrame title="Projects"><Banner kind="danger" title="Your projects didn't load" action={<Button size="sm" variant="secondary" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={() => void load()}>Try again</Button>}>{error}</Banner></PageFrame>;
  if (!ledger) {
    return (
      <LoadingRegion label="Loading your projects" className="mx-auto w-full max-w-[1240px] px-4 pt-7 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-60" /><Skeleton className="mt-2 h-4 w-72" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-80 rounded-[var(--radius-panel)]" />)}</div>
      </LoadingRegion>
    );
  }
  const included = ledger.projects.filter((p) => p.portfolioIncluded).length;

  return (
    <PageFrame
      eoraId="eora-projects-header"
      title="Project evidence ledger"
      description={<><span className="font-mono text-text-primary tabular">{included}</span> of <span className="font-mono tabular">{ledger.projects.length}</span> projects in your portfolio.</>}
      actions={<>
        <a className={buttonClass("ghost", "sm")} href="/api/student/projects/export" target="_blank" rel="noopener noreferrer"><DownloadSimple size={16} aria-hidden="true" />Export portfolio</a>
        {tab === "projects" && <Button variant="primary" size="sm" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setAdding(true)} data-eora-id="eora-add-project-btn">Add project</Button>}
      </>}
    >
      <Tabs label="Ledger sections" idBase="ledger" value={tab} onChange={setTab} className="mb-4 border-b border-border-medium"
        items={[
          { id: "projects", label: "Projects", badge: <span className="font-mono text-2xs text-text-muted tabular">{ledger.projects.length}</span> },
          { id: "github_intel", label: "GitHub Intelligence", badge: <span className="font-mono text-2xs text-champagne tabular">Live</span> },
          { id: "publications", label: "Research and publications", badge: <span className="font-mono text-2xs text-text-muted tabular">{ledger.publications.length}</span> },
        ]} />

      {tab === "projects" ? (
        <section aria-label="Projects" role="tabpanel" id="ledger-panel-projects" aria-labelledby="ledger-tab-projects">
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div role="group" aria-label="Filter by source" className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={source === null} onClick={() => setSource(null)} className={chip(source === null)}>All</button>
              {Object.entries(ledger.counts.bySource).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                <button key={s} type="button" aria-pressed={source === s} onClick={() => setSource(source === s ? null : s)} className={chip(source === s)}>{sourceLabel(s)} <span className="font-mono text-2xs tabular">{n}</span></button>
              ))}
            </div>
            <TextField label="Search projects" labelHidden type="search" placeholder="Search name or technology" value={query} onChange={(e) => setQuery(e.target.value)} wrapperClassName="ml-auto w-full sm:w-64" />
            <button type="button" aria-pressed={onlyIncluded} onClick={() => setOnlyIncluded((v) => !v)} className={cn(chip(onlyIncluded), "min-h-11")}>Portfolio only</button>
          </div>

          {adding && <AddProjectForm onCancel={() => setAdding(false)} onSaved={(p) => { replace(p); setAdding(false); toast.success(`${p.title} added`); }} />}

          {visible.length === 0 ? (
            ledger.projects.length === 0 ? (
              <EmptyState icon={FolderSimple} title="No projects linked yet" actions={<><Button variant="primary" size="sm" onClick={() => setAdding(true)}>Add manually</Button><Link className={buttonClass("ghost", "sm")} href="/student/connections">Connect GitHub</Link></>}>
                Projects are the strongest evidence you can show. Connect GitHub or Kaggle, upload your CV, or add one yourself.
              </EmptyState>
            ) : <p className="rounded-lg border border-dashed border-border-medium px-4 py-6 text-sm text-text-muted">No projects match these filters.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-eora-id="eora-projects-list">
              {visible.map((p) => <ProjectCard key={p.id} project={p} onChange={replace} onArchived={drop} />)}
            </ul>
          )}
        </section>
      ) : tab === "github_intel" ? (
        <section aria-label="GitHub Intelligence" role="tabpanel" id="ledger-panel-github" aria-labelledby="ledger-tab-github">
          <GitHubIntelligenceDashboard />
        </section>
      ) : (
        <Publications ledger={ledger} onChange={(pubs) => setLedger({ ...ledger, publications: pubs })} />
      )}
    </PageFrame>
  );
}

const chip = (on: boolean) =>
  cn(
    "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm transition-all duration-150 pointer-coarse:min-h-11",
    on ? "border-soft-amber bg-soft-amber/15 text-text-primary font-medium shadow-[0_0_12px_rgba(196,138,90,0.2)]" : "border-border-medium text-text-muted hover:border-champagne/40 hover:text-text-primary",
  );

/** A calm generated tile when there is no preview image: initials and stack, no invented imagery. */
function Tile({ project }: { project: LedgerProject }) {
  const stack = project.technologies.slice(0, 3).join(" · ") || "Project";
  return (
    <div role="img" aria-label={`${project.title}: ${stack}`} className="flex h-full flex-col justify-end gap-1 bg-gradient-to-br from-deep-espresso to-obsidian p-4">
      <span className="font-display text-3xl font-semibold tracking-tight text-champagne">{project.title.trim().slice(0, 2).toUpperCase()}</span>
      <span className="truncate font-mono text-xs text-text-muted">{stack}</span>
    </div>
  );
}

function ProjectCard({ project, onChange, onArchived }: { project: LedgerProject; onChange: (p: LedgerProject) => void; onArchived: (id: string) => void }) {
  const [mode, setMode] = useState<"view" | "edit" | "chips">("view");
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  const patch = async (body: Record<string, unknown>, what: string, done?: string) => {
    setBusy(what);
    try {
      const { project: next } = await send<{ project: LedgerProject }>(`/api/student/projects/${project.id}/ledger`, "PATCH", body);
      onChange(next);
      if (done) toast.success(done);
      return true;
    } catch (e) { toast.error(`${project.title}: not saved`, (e as Error).message); return false; }
    finally { setBusy(null); }
  };
  const enhance = async () => {
    setBusy("ai");
    try {
      const res = await send<{ project: LedgerProject; reused?: boolean }>(`/api/student/projects/${project.id}/enhance`, "POST");
      onChange(res.project);
      toast.success(res.reused ? "Kept the description written a few minutes ago" : "AI description added", "Edit it any time.");
    } catch (e) { toast.error("No AI description this time", (e as Error).message); } finally { setBusy(null); }
  };
  const checkPreview = async () => {
    setBusy("preview");
    try {
      const { project: next } = await send<{ project: LedgerProject }>(`/api/student/projects/${project.id}/preview`, "POST");
      onChange(next);
      toast.info(next.metadata.preview?.kind === "image" ? "Found a preview image on your demo site" : "No preview image found; showing a generated tile");
    } catch (e) { toast.error("Preview check failed", (e as Error).message); } finally { setBusy(null); }
  };
  const archive = async () => {
    const ok = await confirm({ title: `Archive ${project.title}?`, body: "It leaves your ledger and portfolio. Its evidence stays in your history.", confirmLabel: "Archive", destructive: true });
    if (ok && (await patch({ status: "archived", portfolioIncluded: false }, "archive", `${project.title} archived`))) onArchived(project.id);
  };
  const preview = project.metadata.preview;

  return (
    <li className={cn("flex min-w-0 flex-col overflow-hidden rounded-card border bg-bg-elevated transition-colors shadow-card", project.portfolioIncluded ? "border-champagne/40" : "border-border-medium")}>
      <div className="relative aspect-[2/1] border-b border-border-medium">
        {preview?.kind === "image"
          // eslint-disable-next-line @next/next/no-img-element -- og:image from the student's own site; any domain.
          ? <img src={preview.imageUrl} alt={`Preview of ${project.title}`} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          : <Tile project={project} />}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/student/projects/${project.id}`} className="min-w-0 break-words font-display font-medium text-text-primary hover:text-soft-amber">{project.title}</Link>
          <button
            type="button"
            role="switch"
            aria-checked={project.portfolioIncluded}
            aria-label={`${project.title} in portfolio`}
            disabled={busy === "include"}
            onClick={() => void patch({ portfolioIncluded: !project.portfolioIncluded }, "include")}
            className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs text-text-muted disabled:opacity-50"
          >
            <span aria-hidden="true" className={cn("relative h-5 w-9 rounded-full border transition-colors", project.portfolioIncluded ? "border-soft-amber bg-soft-amber" : "border-border-medium bg-deep-espresso")}>
              <span className={cn("absolute top-0.5 size-3.5 rounded-full transition-transform duration-150", project.portfolioIncluded ? "translate-x-4 bg-cream" : "translate-x-0.5 bg-text-muted")} />
            </span>
            {project.portfolioIncluded ? "In portfolio" : "Not included"}
          </button>
        </div>

        {mode === "edit" ? (
          <EditForm project={project} saving={busy === "edit"} onCancel={() => setMode("view")} onSave={async (b) => { if (await patch(b, "edit", "Saved")) setMode("view"); }} />
        ) : mode === "chips" ? (
          <ChipPicker project={project} saving={busy === "chips"} onCancel={() => setMode("view")} onSave={async (h, role) => { if (await patch({ highlight: h, role }, "chips", "Card chips saved")) setMode("view"); }} />
        ) : (
          <>
            <p className="line-clamp-3 text-sm text-text-muted">{project.summary || project.description || "No description yet."}</p>
            <EvidenceStrip label={`${project.title} sources`} segments={[{ tier: project.sources.length >= 2 ? "corroborated" : "evidenced", count: Math.max(1, project.sources.length), label: `source${project.sources.length === 1 ? "" : "s"}` }]} />
            <div className="flex flex-wrap gap-1.5">
              {project.sources.map((s) => <Tag key={s}>From {sourceLabel(s)}</Tag>)}
              {project.metadata.isFork && <Tag>Fork</Tag>}
              {project.technologies.slice(0, 5).map((t) => <Tag key={t} mono>{t}</Tag>)}
            </div>
            {project.highlights.length > 0 && (
              <p className="flex flex-wrap gap-3 text-xs text-text-muted" aria-label="Shown on your portfolio card">
                {project.highlights.map((h) => <span key={h.key} className="inline-flex items-center gap-1">{h.key === "stars" && <Star size={12} aria-hidden="true" className="text-soft-amber" />}{h.label}</span>)}
              </p>
            )}
            <div className="mt-auto flex flex-wrap gap-1 border-t border-border-medium pt-3">
              <Button size="sm" variant="ghost" icon={<PencilSimple size={16} aria-hidden="true" />} onClick={() => setMode("edit")} aria-label={`Edit ${project.title}`}>Edit</Button>
              <Button size="sm" variant="ghost" icon={<Sparkle size={16} aria-hidden="true" />} onClick={() => void enhance()} disabled={!project.portfolioIncluded} loading={busy === "ai"} loadingLabel="Writing…"
                title={project.portfolioIncluded ? undefined : "AI descriptions are written only for portfolio projects"}>Describe with AI</Button>
              <Button size="sm" variant="ghost" icon={<Check size={16} aria-hidden="true" />} onClick={() => setMode("chips")}>Card chips</Button>
              {project.demoUrl && <Button size="sm" variant="ghost" icon={<ImageIcon size={16} aria-hidden="true" />} loading={busy === "preview"} loadingLabel="Checking…" onClick={() => void checkPreview()}>Preview</Button>}
              <Button size="sm" variant="ghost" className="ml-auto text-text-muted hover:text-danger" icon={<Archive size={16} aria-hidden="true" />} loading={busy === "archive"} onClick={() => void archive()} aria-label={`Archive ${project.title}`}>Archive</Button>
            </div>
            {!project.portfolioIncluded && <p className="text-2xs text-text-muted">AI descriptions are written only for projects in your portfolio.</p>}
          </>
        )}
      </div>
    </li>
  );
}

function EditForm({ project, onSave, onCancel, saving }: { project: LedgerProject; onSave: (b: Record<string, unknown>) => void; onCancel: () => void; saving: boolean }) {
  const [v, setV] = useState({ title: project.title, summary: project.summary, technologies: project.technologies.join(", "), repositoryUrl: project.repositoryUrl ?? "", demoUrl: project.demoUrl ?? "" });
  const [err, setErr] = useState<string | null>(null);
  return (
    <form noValidate className="grid gap-3" onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} onSubmit={(e) => {
      e.preventDefault();
      if (!v.title.trim()) { setErr("A project needs a name."); return; }
      onSave({ title: v.title, summary: v.summary, technologies: v.technologies.split(",").map((t) => t.trim()).filter(Boolean), repositoryUrl: v.repositoryUrl, demoUrl: v.demoUrl });
    }}>
      <TextField label="Name" required value={v.title} error={err} autoFocus onChange={(e) => { setV({ ...v, title: e.target.value }); setErr(null); }} />
      <TextAreaField label="Description" value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} />
      <TextField label="Technologies" hint="Separate with commas." value={v.technologies} onChange={(e) => setV({ ...v, technologies: e.target.value })} />
      <TextField label="Repository link" type="url" inputMode="url" placeholder="https://github.com/…" value={v.repositoryUrl} onChange={(e) => setV({ ...v, repositoryUrl: e.target.value })} />
      <TextField label="Demo link" type="url" inputMode="url" placeholder="https://…" value={v.demoUrl} onChange={(e) => setV({ ...v, demoUrl: e.target.value })} />
      <div className="flex gap-2"><Button type="submit" size="sm" variant="primary" loading={saving} loadingLabel="Saving…">Save</Button><Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

function ChipPicker({ project, onSave, onCancel, saving }: { project: LedgerProject; onSave: (h: HighlightOption[], role: string) => void; onCancel: () => void; saving: boolean }) {
  const [chosen, setChosen] = useState<HighlightOption[]>(project.metadata.highlight ?? []);
  const [role, setRole] = useState(project.metadata.role ?? "");
  const available: Record<HighlightOption, string | null> = {
    stars: project.metadata.stars !== undefined ? String(project.metadata.stars) : null,
    forks: project.metadata.forks !== undefined ? String(project.metadata.forks) : null,
    languages: (project.metadata.languages?.length ? project.metadata.languages : project.technologies).slice(0, 4).join(", ") || null,
    role: role.trim() || null,
  };
  return (
    <fieldset className="grid gap-2.5">
      <legend className="mb-1 text-sm font-medium">Show on your portfolio card</legend>
      {HIGHLIGHT_OPTIONS.map((h) => (
        <Checkbox key={h} checked={chosen.includes(h)} disabled={!available[h] && h !== "role"} onChange={(e) => setChosen(e.target.checked ? [...chosen, h] : chosen.filter((x) => x !== h))}
          label={<>{CHIP_LABEL[h]} <span className="text-muted">{available[h] ? `(${available[h]})` : h === "role" ? "" : "(not available)"}</span></>} />
      ))}
      <TextField label="My role on this project" placeholder="e.g. Sole developer" value={role} onChange={(e) => setRole(e.target.value)} />
      <div className="flex gap-2"><Button size="sm" variant="primary" loading={saving} loadingLabel="Saving…" onClick={() => onSave(chosen, role)}>Save chips</Button><Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </fieldset>
  );
}

function AddProjectForm({ onSaved, onCancel }: { onSaved: (p: LedgerProject) => void; onCancel: () => void }) {
  const [v, setV] = useState({ title: "", summary: "", technologies: "", repositoryUrl: "", demoUrl: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <form noValidate aria-label="Add a project" className="mb-5 grid gap-3 rounded-card border border-soft-amber/40 bg-bg-elevated p-4 shadow-card sm:grid-cols-2" onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} onSubmit={async (e) => {
      e.preventDefault();
      if (!v.title.trim()) { setErr("A project needs a name."); return; }
      setSaving(true); setErr(null);
      try { const { project } = await send<{ project: LedgerProject }>("/api/student/projects/ledger", "POST", { ...v, technologies: v.technologies.split(",").map((t) => t.trim()).filter(Boolean) }); onSaved(project); }
      catch (error) { setErr((error as Error).message); } finally { setSaving(false); }
    }}>
      <p className="font-display text-sm font-semibold text-text-primary sm:col-span-2">Add a project</p>
      <TextField wrapperClassName="sm:col-span-2" label="Name" required autoFocus value={v.title} error={err} onChange={(e) => setV({ ...v, title: e.target.value })} />
      <TextAreaField wrapperClassName="sm:col-span-2" label="What it does" rows={2} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} />
      <TextField wrapperClassName="sm:col-span-2" label="Technologies" hint="Separate with commas." value={v.technologies} onChange={(e) => setV({ ...v, technologies: e.target.value })} />
      <TextField label="Repository link" type="url" inputMode="url" value={v.repositoryUrl} onChange={(e) => setV({ ...v, repositoryUrl: e.target.value })} />
      <TextField label="Demo link" type="url" inputMode="url" value={v.demoUrl} onChange={(e) => setV({ ...v, demoUrl: e.target.value })} />
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" variant="primary" size="sm" loading={saving} loadingLabel="Adding…" icon={<Plus size={16} aria-hidden="true" />} data-eora-id="eora-project-save-btn">Add to ledger</Button><Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

function Publications({ ledger, onChange }: { ledger: Ledger; onChange: (p: LedgerPublication[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState({ title: "", venue: "", year: "", url: "" });
  const [err, setErr] = useState<string | null>(null);
  const toggle = async (p: LedgerPublication) => {
    try {
      await send("/api/student/publications", "PATCH", { id: p.id, portfolioIncluded: !p.portfolioIncluded });
      onChange(ledger.publications.map((x) => (x.id === p.id ? { ...x, portfolioIncluded: !x.portfolioIncluded } : x)));
    } catch (e) { toast.error("Not saved", (e as Error).message); }
  };
  return (
    <section aria-label="Research and publications" role="tabpanel" id="ledger-panel-publications" aria-labelledby="ledger-tab-publications" className="flex flex-col gap-4">
      {!ledger.hasResearchId && (
        <Banner kind="info" title="Optional: add a research ID" action={<Link className={buttonClass("secondary", "sm")} href="/student/profile">Add research ID</Link>}>
          We only list papers attributed to an ORCID or Semantic Scholar ID you verify; we never guess from your name.
        </Banner>
      )}
      <div><Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setAdding(true)}>Add a citation yourself</Button></div>
      {adding && (
        <form noValidate className="grid gap-3 rounded-card border border-soft-amber/40 bg-bg-elevated p-4 shadow-card sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault();
          if (!v.title.trim()) { setErr("A publication needs a title."); return; }
          try {
            const { publication } = await send<{ publication: { id: string; subject: string } }>("/api/student/publications", "POST", { ...v, year: Number(v.year) || null });
            onChange([{ id: publication.id, title: publication.subject, year: Number(v.year) || null, venue: v.venue || null, coAuthors: [], citationCount: null, doi: null, url: v.url || null, source: "manual", editable: true, portfolioIncluded: false }, ...ledger.publications]);
            setAdding(false); setV({ title: "", venue: "", year: "", url: "" }); setErr(null);
            toast.success("Citation added");
          } catch (error) { setErr((error as Error).message); }
        }}>
          <TextField wrapperClassName="sm:col-span-2" label="Title" required autoFocus value={v.title} error={err} onChange={(e) => setV({ ...v, title: e.target.value })} />
          <TextField label="Journal, conference or site" value={v.venue} onChange={(e) => setV({ ...v, venue: e.target.value })} />
          <TextField label="Year" inputMode="numeric" value={v.year} onChange={(e) => setV({ ...v, year: e.target.value })} />
          <TextField wrapperClassName="sm:col-span-2" label="Link" type="url" inputMode="url" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} />
          <div className="flex gap-2 sm:col-span-2"><Button type="submit" size="sm" variant="primary">Add citation</Button><Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div>
        </form>
      )}
      {ledger.publications.length === 0 ? (
        <EmptyState icon={BookOpen} title="No publications yet">Add a research ID on your profile, or add a citation yourself.</EmptyState>
      ) : (
        <ul className="divide-y divide-border-medium rounded-card border border-border-medium bg-bg-elevated shadow-card">
          {ledger.publications.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 basis-64">
                <p className="font-display font-medium text-text-primary">{p.title}</p>
                <p className="text-xs text-text-muted">{[p.venue, p.year].filter(Boolean).join(" · ")}{p.coAuthors.length ? ` · with ${p.coAuthors.slice(0, 4).join(", ")}` : ""}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Tag>{p.source === "scholar" ? "From your research ID" : "Added by you"}</Tag>
                  {p.citationCount !== null && <Tag mono>{p.citationCount} citation{p.citationCount === 1 ? "" : "s"}</Tag>}
                  {p.doi ? <a className="text-xs text-champagne hover:underline" href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer">DOI {p.doi}</a> : p.url ? <a className="text-xs text-champagne hover:underline" href={p.url} target="_blank" rel="noopener noreferrer">Link</a> : null}
                </div>
              </div>
              <Checkbox checked={p.portfolioIncluded} onChange={() => void toggle(p)} label="In portfolio" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
