"use client";

/**
 * /student/skills: the map, a searchable ledger where every skill shows its
 * evidence, and the editor for skills no source has picked up yet
 * (Tasks 2.2.3, 2.4.1). Writes go to /api/student/skills and reload in place.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowClockwise, EyeSlash, Graph, Plus, X } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { PageFrame } from "@/components/layout/StudentShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button, IconButton, LinkButton } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { EvidenceLegend, EvidenceStrip } from "@/components/ui/EvidenceStrip";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Feedback";
import { cn } from "@/lib/client/cn";
import { skillStrip } from "@/lib/client/evidence";
import { SkillsMap, type MapSkill } from "./SkillsMap";

type SkillItem = {
  name: string; category: string; state: string; level?: string; goalRelevance?: string; isGoalPrerequisite?: boolean;
  evidenceCount: number; relatedProjects?: { id: string; title: string }[]; whyTathastuThinksThis?: string; conciseExplanation?: string;
};
type IntelligenceSkill = {
  name: string; category: string; level: string; isGoalPrerequisite: boolean; observations: { source: string }[];
  dimensions: { demonstratedApplication: { projects: { id: string; title: string }[] } };
  sevenQuestions: MapSkill["sevenQuestions"] & { whatIsTheVerificationStatus?: { status?: "Pending" | "Corroborated" | "Verified" } };
};
type StudentSkill = { name: string; proficiency: "beginner" | "intermediate" | "advanced" | null; evidenceId: string };
type SkillsData = {
  skills: SkillItem[];
  intelligenceSkills?: IntelligenceSkill[];
  missingGoalSkills?: { name: string; category: string; relevance: string; suggestedTask: string }[];
  targetRole?: string; activeGoal: string;
  stats: { totalSkills?: number; evidencedSkills?: number; demonstratedSkills: number; verifiedSkills: number; totalProjects: number; totalEvidence: number; goalPrerequisitesMet?: number; goalPrerequisitesTotal?: number };
  studentSkills?: StudentSkill[]; hiddenSkills?: string[];
};

const toMapSkill = (s: IntelligenceSkill): MapSkill => ({
  name: s.name, category: s.category, level: s.level, isGoalPrerequisite: s.isGoalPrerequisite,
  verificationStatus: s.sevenQuestions?.whatIsTheVerificationStatus?.status,
  observations: s.observations ?? [], projects: s.dimensions?.demonstratedApplication?.projects ?? [], sevenQuestions: s.sevenQuestions,
});

const LEVELS = [["", "Not set"], ["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]] as const;

async function sendSkillEdit(method: "POST" | "PATCH" | "DELETE", body: { name: string; proficiency?: string | null; hidden?: boolean }) {
  const res = method === "DELETE"
    ? await requestJson(`/api/student/skills?name=${encodeURIComponent(body.name)}`, { method })
    : await requestJson("/api/student/skills", { method, json: body });
  if (!res.ok) throw new Error(describeError(res.error));
}

export function SkillsView() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await requestJson<SkillsData>("/api/student/skills", { cache: "no-store" });
    if (res.ok) { setData(res.data); setError(null); } else setError(describeError(res.error));
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error && !data) {
    return <PageFrame title="Skills"><Banner kind="danger" title="Your skills didn't load" action={<Button size="sm" variant="secondary" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={() => void load()}>Try again</Button>}>{error}</Banner></PageFrame>;
  }
  if (!data) return <SkillsSkeleton />;

  const s = data.stats;
  return (
    <PageFrame
      eoraId="eora-skills-overview"
      title="Skills"
      description={<>Measured against <span className="text-ink">{data.targetRole || data.activeGoal}</span>. Each skill shows what backs it; nothing counts as verified until faculty verify it.</>}
    >
      <dl data-eora-id="eora-skill-verification" className="mb-5 grid grid-cols-2 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-4" style={{ gap: 1 }}>
        {([["Skills", s.totalSkills ?? data.skills.length], ["Shown in projects", s.demonstratedSkills], ["Verified", s.verifiedSkills], ["Core skills met", s.goalPrerequisitesTotal ? `${s.goalPrerequisitesMet ?? 0}/${s.goalPrerequisitesTotal}` : "None set"]] as const).map(([l, v]) => (
          <div key={l} className="bg-surface px-4 py-3.5"><dt className="text-xs text-muted">{l}</dt><dd className="mt-1 font-mono text-xl font-semibold tabular">{v}</dd></div>
        ))}
      </dl>

      {data.skills.length === 0 && !(data.missingGoalSkills?.length) ? (
        <EmptyState icon={Graph} title="No skills yet" actions={<LinkButton href="/student/projects" variant="primary" size="sm">Add a project</LinkButton>}>
          Add a skill below, confirm skills from your CV, or add a project; each skill then shows the evidence behind it.
        </EmptyState>
      ) : (
        <SkillsMap
          goal={data.targetRole || data.activeGoal}
          skills={(data.intelligenceSkills ?? []).map(toMapSkill)}
          gaps={(data.missingGoalSkills ?? []).filter((g) => g.relevance === "required_core").map((g) => ({ name: g.name, suggestedTask: g.suggestedTask }))}
        />
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <Ledger data={data} reload={load} />
        <SkillEditorPanel studentSkills={data.studentSkills ?? []} hiddenSkills={data.hiddenSkills ?? []} onChanged={load} />
      </div>
    </PageFrame>
  );
}

function SkillsSkeleton() {
  return (
    <LoadingRegion label="Loading your skills" className="mx-auto w-full max-w-[1240px] px-4 pt-7 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-40" /><Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-20 rounded-[var(--radius-panel)]" />
      <Skeleton className="mt-5 h-[420px] rounded-[var(--radius-panel)]" />
    </LoadingRegion>
  );
}

function Ledger({ data, reload }: { data: SkillsData; reload: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [onlyGoal, setOnlyGoal] = useState(false);
  const cats = useMemo(() => ["All", ...Array.from(new Set(data.skills.map((s) => s.category))).sort()], [data.skills]);
  const list = data.skills.filter((s) => (cat === "All" || s.category === cat) && (!onlyGoal || s.isGoalPrerequisite) && (!q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase())));
  const hide = async (name: string) => {
    try {
      await sendSkillEdit("PATCH", { name, hidden: true });
      await reload();
      toast.undo(`${name} hidden from your skills`, () => void sendSkillEdit("PATCH", { name, hidden: false }).then(reload).catch((e) => toast.error("Couldn't show it again", e.message)));
    } catch (e) { toast.error(`${name} wasn't hidden`, e instanceof Error ? e.message : undefined); }
  };

  return (
    <Panel aria-labelledby="ledger-title" data-eora-id="eora-skills-list">
      <PanelHeader id="ledger-title" title="Skill ledger" actions={<EvidenceLegend tiers={["verified", "corroborated", "evidenced", "gap"]} />} />
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <TextField label="Search skills" labelHidden type="search" placeholder="Search skills" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField label="Category" labelHidden value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c} value={c}>{c === "All" ? "All categories" : c}</option>)}</SelectField>
        <button type="button" aria-pressed={onlyGoal} onClick={() => setOnlyGoal((v) => !v)}
          className={cn("min-h-11 cursor-pointer rounded-[var(--radius-control)] border px-3 text-sm", onlyGoal ? "border-signal bg-signal-tint text-ink" : "border-line text-muted hover:text-ink")}>
          Core for my role
        </button>
      </div>
      {list.length === 0 ? <p className="py-6 text-sm text-muted">{data.skills.length === 0 ? "No skills yet. Add one on this page, or confirm skills from your CV and projects." : "No skills match. Clear the search or filters."}</p> : (
        <ul className="divide-y divide-line border-t border-line">
          {list.map((s) => {
            const intel = data.intelligenceSkills?.find((i) => i.name === s.name);
            const v = skillStrip(s.state, s.evidenceCount, (intel?.observations ?? []).map((o) => o.source));
            return (
              <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_9rem_auto]">
                <div className="min-w-0">
                  <Link href={`/student/skills/${encodeURIComponent(s.name)}`} className="block truncate font-medium hover:text-signal">{s.name}</Link>
                  <p className="truncate text-xs text-muted">{s.category}{s.isGoalPrerequisite ? " · core for your role" : ""}</p>
                </div>
                <EvidenceStrip className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" label={`${s.name} evidence`} showCounts segments={[{ tier: v.tier, count: v.count, label: "evidence items" }]} />
                <span className="hidden text-xs text-muted sm:block">{v.label}</span>
                <IconButton label={`Hide ${s.name}`} className="row-start-1 col-start-2 sm:row-auto sm:col-auto" onClick={() => void hide(s.name)}><EyeSlash size={16} aria-hidden="true" /></IconButton>
              </li>
            );
          })}
        </ul>
      )}
      {data.missingGoalSkills && data.missingGoalSkills.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-sm font-medium">Core for your role, not shown yet</p>
          <ul className="flex flex-col gap-2">
            {data.missingGoalSkills.map((g) => (
              <li key={g.name} className="flex flex-wrap items-start gap-2 text-sm">
                <StatusChip tone="gap">{g.name}</StatusChip>
                <span className="min-w-0 flex-1 basis-56 text-muted">{g.suggestedTask}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function SkillEditorPanel({ studentSkills, hiddenSkills, onChanged }: { studentSkills: StudentSkill[]; hiddenSkills: string[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (key: string, work: () => Promise<unknown>, done: string) => {
    setBusy(key); setErr(null);
    try { await work(); await onChanged(); toast.success(done); }
    catch (e) { toast.error("Your skills weren't saved", e instanceof Error ? e.message : undefined); }
    finally { setBusy(null); }
  };
  return (
    <Panel aria-labelledby="your-skills-title" data-testid="skill-editor">
      <PanelHeader id="your-skills-title" title="Skills you add" description="For skills no source has picked up yet. They read as your word until a project, assessment or reviewer backs them." />
      <form noValidate className="grid gap-3" onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) { setErr("Enter a skill name."); return; }
        void run("add", async () => { await sendSkillEdit("POST", { name: n, proficiency: level || null }); setName(""); setLevel(""); }, `${n} added`);
      }}>
        <TextField label="Skill" maxLength={60} placeholder="e.g. FastAPI" value={name} error={err} onChange={(e) => { setName(e.target.value); setErr(null); }} />
        <SelectField label="Your level" value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectField>
        <Button type="submit" variant="secondary" className="justify-self-start" loading={busy === "add"} loadingLabel="Adding…" icon={<Plus size={16} aria-hidden="true" />}>Add skill</Button>
      </form>
      {studentSkills.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {studentSkills.map((s) => (
            <li key={s.evidenceId} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1 basis-24 font-medium">{s.name}</span>
              <SelectField label={`Your level for ${s.name}`} labelHidden wrapperClassName="w-36" value={s.proficiency ?? ""} disabled={busy !== null}
                onChange={(e) => void run(s.name, () => sendSkillEdit("PATCH", { name: s.name, proficiency: e.target.value || null }), `Level for ${s.name} saved`)}>
                {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SelectField>
              <IconButton label={`Remove ${s.name}`} disabled={busy !== null} onClick={() => void run(s.name, () => sendSkillEdit("DELETE", { name: s.name }), `${s.name} removed`)}><X size={16} aria-hidden="true" /></IconButton>
            </li>
          ))}
        </ul>
      )}
      {hiddenSkills.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs text-muted">Hidden from your skills</p>
          <div className="flex flex-wrap gap-1.5">
            {hiddenSkills.map((h) => <Button key={h} size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(h, () => sendSkillEdit("PATCH", { name: h, hidden: false }), `${h} is shown again`)}>Show {h}</Button>)}
          </div>
        </div>
      )}
      {studentSkills.length === 0 && hiddenSkills.length === 0 && <Tag className="mt-4">Nothing added by you yet</Tag>}
    </Panel>
  );
}
