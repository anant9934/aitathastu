"use client";

/**
 * Roadmap, journey, assessments and interviews (Task 3.1.3). Each is its own
 * route for deep links and also summarised on the dashboard.
 */
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowClockwise, ArrowRight, ChatsCircle, Exam, Path, Timer } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { usePerson360 } from "@/lib/client/use-person360";
import { PageFrame } from "@/components/layout/StudentShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Meter } from "@/components/ui/EvidenceStrip";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/client/cn";

function useJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await requestJson<T>(url, { cache: "no-store" });
    if (res.ok) { setData(res.data); setError(null); } else setError(describeError(res.error));
  }, [url]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, load };
}

function Loading({ label }: { label: string }) {
  return (
    <LoadingRegion label={label} className="mx-auto w-full max-w-[880px] px-4 pt-7 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-48" /><Skeleton className="mt-2 h-4 w-72" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="mt-4 h-28 rounded-[var(--radius-panel)]" />)}
    </LoadingRegion>
  );
}
const Failed = ({ title, error, retry }: { title: string; error: string; retry: () => void }) => (
  <PageFrame title={title} width="narrow"><Banner kind="danger" title={`Your ${title.toLowerCase()} didn't load`} action={<Button size="sm" variant="secondary" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={retry}>Try again</Button>}>{error}</Banner></PageFrame>
);

type Action = { actionType: string; title: string; description: string; reason?: string; sourcePlatform: string; destinationUrl?: string };
type Stage = { stageNumber: number; title: string; description: string; requiredSkills: string[]; status: "completed" | "in_progress" | "locked"; recommendedActions: Action[] };
type RoadmapData = { roadmap: { goal: string; targetRole?: string; totalStages: number; currentStageIndex: number; stages: Stage[] } };

export function RoadmapView() {
  const { data, error, load } = useJson<RoadmapData>("/api/student/roadmap");
  if (error && !data) return <Failed title="Roadmap" error={error} retry={() => void load()} />;
  if (!data) return <Loading label="Loading your roadmap" />;
  const r = data.roadmap;
  return (
    <PageFrame width="narrow" eoraId="eora-roadmap-header" title="Roadmap" description={<>Toward <span className="text-ink">{r.targetRole || r.goal}</span>. Stage <span className="font-mono tabular">{Math.min(r.currentStageIndex + 1, r.totalStages)}</span> of <span className="font-mono tabular">{r.totalStages}</span>.</>}>
      {r.stages.length === 0 ? (
        <EmptyState icon={Path} title="No roadmap yet" actions={<Link className="link text-sm" href="/student">Set a target role</Link>}>Choose a target role and confirm a few skills; the roadmap orders what to learn and build next.</EmptyState>
      ) : (
        <ol className="flex flex-col gap-4" data-eora-id="eora-roadmap-milestones">
          {r.stages.map((s) => (
            <li key={s.stageNumber}>
              <Panel as="section" aria-labelledby={`stage-${s.stageNumber}`} className={cn(s.status === "in_progress" && "border-signal/50")} data-eora-id={s.status === "in_progress" ? "eora-roadmap-next" : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-2xs text-muted tabular">Stage {s.stageNumber}</p>
                    <h2 id={`stage-${s.stageNumber}`} className="text-lg font-semibold">{s.title.replace(/^Stage \d+:\s*/, "")}</h2>
                  </div>
                  <StatusChip tone={s.status === "completed" ? "verified" : s.status === "in_progress" ? "signal" : "neutral"} icon={null}>{s.status === "completed" ? "Done" : s.status === "in_progress" ? "Now" : "Later"}</StatusChip>
                </div>
                <p className="mt-1.5 text-sm text-muted">{s.description}</p>
                {s.requiredSkills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{s.requiredSkills.map((k) => <Tag key={k} mono>{k}</Tag>)}</div>}
                {s.status !== "locked" && s.recommendedActions.length > 0 && (
                  <ul className="mt-4 divide-y divide-line border-t border-line">
                    {s.recommendedActions.map((a) => (
                      <li key={a.title} className="flex items-start gap-3 py-3">
                        <Tag className="mt-0.5 shrink-0">{a.actionType}</Tag>
                        <div className="min-w-0 flex-1">
                          {a.destinationUrl ? <Link href={a.destinationUrl} className="inline-flex items-center gap-1 font-medium hover:text-signal">{a.title}<ArrowRight size={14} aria-hidden="true" /></Link> : <p className="font-medium">{a.title}</p>}
                          <p className="text-sm text-muted">{a.description}</p>
                          {a.reason && <p className="mt-1 text-xs text-muted">Why: {a.reason}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </li>
          ))}
        </ol>
      )}
    </PageFrame>
  );
}

export function JourneyView() {
  const { data, error, reload } = usePerson360();
  if (error && !data) return <Failed title="Journey" error={error} retry={() => void reload()} />;
  if (!data) return <Loading label="Loading your journey" />;
  const events = [...data.journeySummary].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return (
    <PageFrame width="narrow" title="Journey" description="Every milestone, newest first.">
      {events.length === 0 ? <EmptyState icon={Timer} title="No milestones yet">Milestones appear as you add evidence: CV uploaded, project confirmed, skill verified.</EmptyState> : (
        <Panel as="ol" data-eora-id="eora-journey-timeline" className="flex flex-col">
          {events.map((e, i) => (
            <li key={e.id} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3">
              <span className="flex flex-col items-center" aria-hidden="true">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-verified" />
                {i < events.length - 1 && <span className="w-px flex-1 bg-line" />}
              </span>
              <div className="pb-5">
                <p className="font-medium">{e.title}</p>
                {e.description && <p className="mt-0.5 text-sm text-muted">{e.description}</p>}
                <p className="mt-1 font-mono text-2xs text-muted tabular">{formatDate(e.timestamp, true)}</p>
              </div>
            </li>
          ))}
        </Panel>
      )}
    </PageFrame>
  );
}

type Attempt = { id: string; assessmentTitle: string; assessmentType: string; completedAt: string; rubricVersion?: string; topics?: { id: string; topicLabel: string; value: number; maxValue?: number; measurementType?: string }[] };

export function AssessmentsView() {
  const { data, error, load } = useJson<{ assessments: Attempt[] }>("/api/student/assessments");
  if (error && !data) return <Failed title="Assessments" error={error} retry={() => void load()} />;
  if (!data) return <Loading label="Loading assessments" />;
  return (
    <PageFrame width="narrow" title="Assessments" description="A result is evidence from one attempt, not a permanent label.">
      {data.assessments.length === 0 ? (
        <EmptyState icon={Exam} title="No assessment results yet">Results from partner assessments appear here with their topic scores once you take one. Nothing is shown until a real attempt is recorded.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-4" data-eora-id="eora-assessments-list">
          {data.assessments.map((a) => (
            <li key={a.id}>
              <Panel as="section" aria-labelledby={`as-${a.id}`}>
                <PanelHeader id={`as-${a.id}`} title={a.assessmentTitle} description={<>{a.assessmentType} · <span className="font-mono tabular">{formatDate(a.completedAt)}</span>{a.rubricVersion ? ` · rubric ${a.rubricVersion}` : ""}</>} />
                <ul className="flex flex-col gap-3" data-eora-id="eora-assessments-scores">
                  {(a.topics ?? []).map((t) => (
                    <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                      <span className="text-sm">{t.topicLabel}</span>
                      <span className="font-mono text-sm tabular">{t.value}{t.maxValue ? `/${t.maxValue}` : ""}{t.measurementType === "rubric_level" ? " level" : ""}</span>
                      {t.maxValue ? <Meter className="col-span-2" value={(t.value / t.maxValue) * 100} label={`${t.topicLabel} ${t.value} of ${t.maxValue}`} tone="verified" /> : null}
                    </li>
                  ))}
                </ul>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}

type Session = { id: string; completedAt: string; targetRole?: string; rubricVersion?: string; dimensions?: { id: string; dimensionLabel: string; value: number; scaleMax: number; explanation?: string }[] };

export function InterviewsView() {
  const { data, error, load } = useJson<{ interviews: Session[] }>("/api/student/interviews");
  if (error && !data) return <Failed title="Interviews" error={error} retry={() => void load()} />;
  if (!data) return <Loading label="Loading interview practice" />;
  return (
    <PageFrame width="narrow" title="Interview practice" description="Feedback describes one session, not you. Tathastu never infers emotion or personality.">
      {data.interviews.length === 0 ? (
        <EmptyState icon={ChatsCircle} title="No practice sessions yet">When you complete a mock interview, its rubric feedback on technical reasoning and communication appears here.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-4" data-eora-id="eora-interviews-list">
          {data.interviews.map((s) => (
            <li key={s.id}>
              <Panel as="section" aria-labelledby={`iv-${s.id}`}>
                <PanelHeader id={`iv-${s.id}`} title={s.targetRole ? `${s.targetRole} practice` : "Practice session"} description={<span className="font-mono tabular">{formatDate(s.completedAt)}</span>} />
                <ul className="flex flex-col gap-4">
                  {(s.dimensions ?? []).map((d) => (
                    <li key={d.id}>
                      <div className="flex justify-between gap-2 text-sm"><span>{d.dimensionLabel}</span><span className="font-mono tabular">{d.value}/{d.scaleMax}</span></div>
                      <Meter className="mt-1.5" value={(Number(d.value) / (Number(d.scaleMax) || 5)) * 100} label={`${d.dimensionLabel} ${d.value} of ${d.scaleMax}`} />
                      {d.explanation && <p className="mt-1.5 text-xs text-muted">{d.explanation}</p>}
                    </li>
                  ))}
                </ul>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
