"use client";

/**
 * One project (/student/projects/[id]): what it is, what you personally did
 * (editable, stored as your own statement), its links and stack, and the
 * evidence records it produced.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise, ArrowLeft, ArrowSquareOut, PencilSimple, Trash } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { VERIFICATION_VIEW, type EvidenceItem } from "@/lib/client/use-person360";
import { PageFrame } from "@/components/layout/StudentShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button, LinkButton } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { EvidenceStrip } from "@/components/ui/EvidenceStrip";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast, useConfirm } from "@/components/ui/Feedback";
import { sourceLabel } from "@/components/review/EntryList";

type Project = {
  id: string; title: string; summary: string; description: string; category: string; status: string;
  repositoryUrl: string | null; demoUrl: string | null; technologies: string[]; sources: string[];
  links: { label?: string; url: string }[]; contributionRoles: string[]; contributionNote: string;
  aiDetails: Record<string, unknown>; createdAt: string; updatedAt: string;
};

export function ProjectDetailView({ id }: { id: string }) {
  const [p, setP] = useState<Project | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();
  const load = useCallback(async () => {
    const res = await requestJson<{ project: Project; evidence: EvidenceItem[] }>(`/api/student/projects/${id}`, { cache: "no-store" });
    if (res.ok) { setP(res.data.project); setEvidence(res.data.evidence ?? []); setError(null); } else setError(describeError(res.error));
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const back = <LinkButton href="/student/projects" variant="ghost" size="sm" icon={<ArrowLeft size={16} aria-hidden="true" />}>All projects</LinkButton>;
  if (error && !p) return <PageFrame title="Project" actions={back}><Banner kind="danger" title="This project didn't load" action={<Button size="sm" variant="secondary" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={() => void load()}>Try again</Button>}>{error}</Banner></PageFrame>;
  if (!p) return <LoadingRegion label="Loading project" className="mx-auto w-full max-w-[1240px] px-4 pt-7 sm:px-6 lg:px-8"><Skeleton className="h-8 w-72" /><Skeleton className="mt-6 h-64 rounded-[var(--radius-panel)]" /></LoadingRegion>;

  const remove = async () => {
    const ok = await confirm({ title: `Delete ${p.title}?`, body: "The project and the evidence it produced are removed from your profile. This can't be undone.", confirmLabel: "Delete project", destructive: true });
    if (!ok) return;
    const res = await requestJson(`/api/student/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("The project wasn't deleted", describeError(res.error)); return; }
    toast.success(`${p.title} deleted`);
    router.push("/student/projects");
  };

  return (
    <PageFrame
      eoraId="eora-project-detail-hero"
      title={p.title}
      description={<>{p.category} · updated <span className="font-mono tabular">{formatDate(p.updatedAt)}</span></>}
      actions={<>{back}<StatusChip tone={p.status === "confirmed" ? "evidenced" : "neutral"}>{p.status === "confirmed" ? "Confirmed" : p.status}</StatusChip></>}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel aria-labelledby="ov-title">
            <PanelHeader id="ov-title" title="Overview" actions={!editing && <Button size="sm" variant="secondary" icon={<PencilSimple size={16} aria-hidden="true" />} onClick={() => setEditing(true)}>Edit</Button>} />
            {editing ? <EditProject p={p} onDone={async () => { setEditing(false); await load(); }} onCancel={() => setEditing(false)} /> : (
              <>
                <p className="max-w-[68ch] whitespace-pre-line text-sm text-text-primary">{p.summary || p.description || "No description yet."}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">{p.technologies.map((t) => <Tag key={t} mono>{t}</Tag>)}</div>
                {(p.repositoryUrl || p.demoUrl || p.links.length > 0) && (
                  <ul className="mt-4 flex flex-col gap-1.5 border-t border-border-medium pt-3 text-sm">
                    {[p.repositoryUrl && { label: "Repository", url: p.repositoryUrl }, p.demoUrl && { label: "Demo", url: p.demoUrl }, ...p.links].filter(Boolean).map((l) => {
                      const link = l as { label?: string; url: string };
                      return <li key={link.url}><span className="mr-2 text-xs text-text-muted">{link.label ?? "Link"}</span><a className="inline-flex items-center gap-1 break-all text-champagne hover:underline" href={link.url} target="_blank" rel="noopener noreferrer">{link.url}<ArrowSquareOut size={12} aria-hidden="true" /></a></li>;
                    })}
                  </ul>
                )}
              </>
            )}
          </Panel>
          <Panel aria-labelledby="mine-title" data-eora-id="eora-project-detail-contribution">
            <PanelHeader id="mine-title" title="What you did" description="Your own statement. It makes the project stronger evidence; it isn't third-party proof." />
            {p.contributionNote ? <blockquote className="border-l-2 border-soft-amber pl-3 text-sm italic text-text-primary">{p.contributionNote}</blockquote> : <p className="text-sm text-text-muted">Not added yet. Use Edit to say which parts you built.</p>}
            {p.contributionRoles.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{p.contributionRoles.map((r) => <Tag key={r}>{r}</Tag>)}</div>}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel aria-labelledby="src-title" data-eora-id="eora-project-detail-findings">
            <PanelHeader id="src-title" title="Where it came from" />
            <EvidenceStrip className="mb-3" showCounts label={`${p.title} sources`} segments={[{ tier: p.sources.length >= 2 ? "corroborated" : "evidenced", count: Math.max(1, p.sources.length), label: "sources" }]} />
            <div className="flex flex-wrap gap-1.5">{p.sources.map((s) => <Tag key={s}>{sourceLabel(s)}</Tag>)}</div>
          </Panel>
          <Panel aria-labelledby="pev-title">
            <PanelHeader id="pev-title" title="Evidence records" />
            {evidence.length === 0 ? <p className="text-sm text-text-muted">No evidence records yet.</p> : (
              <ul className="divide-y divide-border-medium">
                {evidence.map((e) => {
                  const v = VERIFICATION_VIEW[e.verificationStatus] ?? VERIFICATION_VIEW.unverified;
                  return <li key={e.id} className="py-2.5 first:pt-0"><p className="text-sm font-medium">{e.subject}</p><p className="text-xs text-muted">{e.interpretation}</p><StatusChip tone={v.tone} size="sm" className="mt-1.5">{v.label}</StatusChip></li>;
                })}
              </ul>
            )}
          </Panel>
          <Panel aria-labelledby="del-title">
            <PanelHeader id="del-title" title="Remove" level={3} />
            <Button variant="danger" size="sm" icon={<Trash size={16} aria-hidden="true" />} onClick={() => void remove()}>Delete project</Button>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}

function EditProject({ p, onDone, onCancel }: { p: Project; onDone: () => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState({ title: p.title, summary: p.summary || p.description, technologies: p.technologies.join(", "), repositoryUrl: p.repositoryUrl ?? "", demoUrl: p.demoUrl ?? "", contributionNote: p.contributionNote, contributionRoles: p.contributionRoles.join(", ") });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.title.trim()) { setErr("A project needs a name."); return; }
    setBusy(true); setErr(null);
    const res = await requestJson(`/api/student/projects/${p.id}`, { method: "PUT", json: {
      title: v.title.trim(), summary: v.summary, technologies: v.technologies.split(",").map((t) => t.trim()).filter(Boolean),
      repositoryUrl: v.repositoryUrl || null, demoUrl: v.demoUrl || null, contributionNote: v.contributionNote,
      contributionRoles: v.contributionRoles.split(",").map((t) => t.trim()).filter(Boolean),
    } });
    setBusy(false);
    if (!res.ok) { setErr(describeError(res.error)); return; }
    toast.success("Project saved");
    await onDone();
  };
  return (
    <form noValidate onSubmit={save} className="grid gap-3" onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}>
      <TextField label="Name" required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus />
      <TextAreaField label="Description" rows={4} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} />
      <TextField label="Technologies" hint="Separate with commas." value={v.technologies} onChange={(e) => setV({ ...v, technologies: e.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Repository link" type="url" value={v.repositoryUrl} onChange={(e) => setV({ ...v, repositoryUrl: e.target.value })} />
        <TextField label="Demo link" type="url" value={v.demoUrl} onChange={(e) => setV({ ...v, demoUrl: e.target.value })} />
      </div>
      <TextAreaField label="What you personally did" rows={3} value={v.contributionNote} onChange={(e) => setV({ ...v, contributionNote: e.target.value })} />
      <TextField label="Your roles" hint="Separate with commas, e.g. Model training, API" value={v.contributionRoles} onChange={(e) => setV({ ...v, contributionRoles: e.target.value })} />
      {err && <Banner kind="danger">{err}</Banner>}
      <div className="flex gap-2"><Button type="submit" variant="primary" size="sm" loading={busy} loadingLabel="Saving…">Save</Button><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}
