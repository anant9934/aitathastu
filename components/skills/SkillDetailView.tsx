"use client";

/**
 * One skill, explained (/student/skills/[skill]): the seven Tathastu
 * questions, every observation with its source, the projects that show it,
 * and a form to record what you personally did with it (stored as your own
 * statement, never as third-party proof).
 */
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowClockwise, ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { usePerson360 } from "@/lib/client/use-person360";
import { PageFrame } from "@/components/layout/StudentShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button, LinkButton } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { EvidenceStrip } from "@/components/ui/EvidenceStrip";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Feedback";
import { sourceLabel } from "@/components/review/EntryList";
import type { DrawerSkill } from "./SkillDetailPanel";

type Detail = {
  name: string; category: string; state: string; level: string; isGoalPrerequisite: boolean; evidenceCount: number;
  conciseExplanation?: string; whatToImprove?: string;
  relatedProjects: { id: string; title: string; repositoryUrl?: string | null; description?: string }[];
  observations: { id: string; source: string; sourceType?: string; sourceReference?: string; observedAt?: string; summary?: string }[];
  learningPath: { title: string; source: string; type: string }[];
  sevenQuestions?: DrawerSkill["sevenQuestions"];
  personalContribution?: { confirmed?: boolean; projectTitle?: string; componentDescription?: string } | null;
};

const STATE_TONE: Record<string, "verified" | "evidenced" | "neutral"> = { Verified: "verified", Demonstrated: "evidenced", "Evidence available": "evidenced" };

export function SkillDetailView({ skill }: { skill: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await requestJson<Detail>(`/api/student/skills/${encodeURIComponent(skill)}`, { cache: "no-store" });
    if (res.ok) { setD(res.data); setError(null); } else setError(describeError(res.error));
  }, [skill]);
  useEffect(() => { void load(); }, [load]);

  const back = <LinkButton href="/student/skills" variant="ghost" size="sm" icon={<ArrowLeft size={16} aria-hidden="true" />}>All skills</LinkButton>;
  if (error && !d) return <PageFrame title={skill} actions={back}><Banner kind="danger" title="This skill didn't load" action={<Button size="sm" variant="secondary" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={() => void load()}>Try again</Button>}>{error}</Banner></PageFrame>;
  if (!d) return <LoadingRegion label="Loading skill" className="mx-auto w-full max-w-[1240px] px-4 pt-7 sm:px-6 lg:px-8"><Skeleton className="h-8 w-48" /><Skeleton className="mt-6 h-72 rounded-[var(--radius-panel)]" /></LoadingRegion>;

  const q = d.sevenQuestions;
  const sources = Array.from(new Set(d.observations.map((o) => o.source)));
  return (
    <PageFrame
      title={d.name}
      eoraId="eora-skill-detail-card"
      description={d.conciseExplanation}
      actions={<>{back}<StatusChip tone={STATE_TONE[d.state] ?? "neutral"}>{d.state === "Claimed" ? "Your word only" : d.state}</StatusChip></>}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel aria-labelledby="ev-title" data-eora-id="eora-skill-detail-evidence">
            <PanelHeader id="ev-title" title="Evidence" description={`${d.observations.length} observation${d.observations.length === 1 ? "" : "s"} from ${sources.length} source${sources.length === 1 ? "" : "s"}.`} />
            <EvidenceStrip className="mb-4" showCounts label={`${d.name} evidence`} segments={[{ tier: d.state === "Verified" ? "verified" : sources.length >= 2 && d.state !== "Claimed" ? "corroborated" : d.state === "Claimed" ? "gap" : "evidenced", count: d.state === "Claimed" ? 0 : d.observations.length, label: "observations" }]} />
            <ul className="divide-y divide-line border-t border-line">
              {d.observations.map((o) => (
                <li key={o.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3">
                  <Tag>{sourceLabel(o.source)}</Tag>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-sm text-ink">{o.summary}</p>
                    {o.sourceReference && (/^https?:\/\//.test(o.sourceReference)
                      ? <a href={o.sourceReference} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 break-all text-xs">{o.sourceReference}<ArrowSquareOut size={12} aria-hidden="true" /></a>
                      : <p className="break-all font-mono text-2xs text-muted">{o.sourceReference}</p>)}
                  </div>
                  {o.observedAt && <span className="font-mono text-2xs text-muted tabular">{formatDate(o.observedAt)}</span>}
                </li>
              ))}
            </ul>
          </Panel>
          {q && (
            <Panel aria-labelledby="q-title">
              <PanelHeader id="q-title" title="Why Tathastu thinks this" />
              <dl className="grid gap-4 sm:grid-cols-2">
                {([
                  ["What it is", q.whatIsThisSkill?.definition],
                  ["How it relates to your goal", q.howDoesItRelateToGoal?.explanation],
                  ["Where you used it", q.howWasItUsed?.projects?.join(", ") || q.howWasItUsed?.usageSummary],
                  ["What you did yourself", q.whatDidStudentPersonallyContribute?.hasContribution ? q.whatDidStudentPersonallyContribute.statement : "Not confirmed yet."],
                  ["Verification", [q.whatIsTheVerificationStatus?.status, q.whatIsTheVerificationStatus?.tierLabel].filter(Boolean).join(" · ") || "Not verified"],
                  ["What to prove next", q.whatShouldStudentLearnOrProveNext?.action || q.whatShouldStudentLearnOrProveNext?.suggestedTask || d.whatToImprove],
                ] as const).map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 text-sm text-ink">{v || "Nothing recorded yet."}</dd></div>
                ))}
              </dl>
              {(q.whatEvidenceIsMissing?.missingPoints?.length ?? 0) > 0 && (
                <div className="mt-4 border-t border-line pt-3"><p className="text-xs text-muted">What&apos;s missing</p><ul className="mt-1 list-disc pl-5 text-sm">{q.whatEvidenceIsMissing!.missingPoints!.map((m) => <li key={m}>{m}</li>)}</ul></div>
              )}
            </Panel>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel aria-labelledby="proj-title" data-eora-id="eora-skill-detail-projects">
            <PanelHeader id="proj-title" title="Projects that show it" />
            {d.relatedProjects.length ? (
              <ul className="flex flex-col gap-2">
                {d.relatedProjects.map((p) => (
                  <li key={p.id}><Link href={`/student/projects/${p.id}`} className="block rounded-[var(--radius-control)] border border-line px-3 py-2.5 hover:border-line-strong"><span className="text-sm font-medium">{p.title}</span>{p.description && <span className="mt-0.5 block text-xs text-muted">{p.description}</span>}</Link></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No project shows this yet.</p>}
          </Panel>
          <ContributionForm skill={d.name} onSaved={load} />
          {d.learningPath.length > 0 && (
            <Panel aria-labelledby="lp-title" data-eora-id="eora-skill-detail-learning">
              <PanelHeader id="lp-title" title="Ways to strengthen it" />
              <ul className="flex flex-col gap-2">{d.learningPath.map((l) => <li key={l.title} className="flex items-start justify-between gap-2 text-sm"><span>{l.title}<span className="block text-xs text-muted">{l.source}</span></span><Tag>{l.type}</Tag></li>)}</ul>
            </Panel>
          )}
        </div>
      </div>
    </PageFrame>
  );
}

function ContributionForm({ skill, onSaved }: { skill: string; onSaved: () => Promise<void> }) {
  const { data } = usePerson360();
  const projects = data?.projects ?? [];
  const [projectId, setProjectId] = useState("");
  const [role, setRole] = useState("Core developer");
  const [parts, setParts] = useState("");
  const [challenges, setChallenges] = useState("");
  const [type, setType] = useState("solo");
  const [comfort, setComfort] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) { setErr("Choose the project where you used it."); return; }
    setBusy(true); setErr(null);
    const res = await requestJson(`/api/student/skills/${encodeURIComponent(skill)}/contribution`, { method: "POST", json: { projectId, roleInProject: role, codebaseParts: parts, challengesSolved: challenges, projectType: type, liveComfortLevel: comfort } });
    setBusy(false);
    if (!res.ok) { setErr(describeError(res.error)); return; }
    toast.success("Contribution recorded", "Saved as your own statement, not as third-party proof.");
    setParts(""); setChallenges("");
    await onSaved();
  };
  return (
    <Panel aria-labelledby="contrib-title" data-eora-id="eora-contribution-note">
      <PanelHeader id="contrib-title" title={`What you did with ${skill}`} description="Recorded as your statement. It strengthens the evidence; it doesn't verify it." />
      {projects.length === 0 ? <p className="text-sm text-muted">Add a project first, then come back to say what you did in it.</p> : (
        <form noValidate onSubmit={submit} className="grid gap-3">
          <SelectField label="Project" value={projectId} error={err && !projectId ? err : null} onChange={(e) => { setProjectId(e.target.value); setErr(null); }}>
            <option value="">Choose a project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </SelectField>
          <TextField label="Your role" value={role} onChange={(e) => setRole(e.target.value)} />
          <TextAreaField label="Which parts you built" rows={2} value={parts} onChange={(e) => setParts(e.target.value)} placeholder="e.g. the training loop and data loaders" />
          <TextAreaField label="A problem you solved (optional)" rows={2} value={challenges} onChange={(e) => setChallenges(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Project type" value={type} onChange={(e) => setType(e.target.value)}><option value="solo">Solo</option><option value="team">Team</option><option value="forked">Forked and extended</option></SelectField>
            <SelectField label="Could you explain it live?" value={comfort} onChange={(e) => setComfort(e.target.value)}><option value="high">Yes, confidently</option><option value="medium">With notes</option><option value="developing">Still practising</option></SelectField>
          </div>
          {err && projectId && <Banner kind="danger">{err}</Banner>}
          <Button type="submit" variant="primary" className="justify-self-start" loading={busy} loadingLabel="Saving…">Record contribution</Button>
        </form>
      )}
    </Panel>
  );
}
