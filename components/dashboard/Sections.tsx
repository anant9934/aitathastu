"use client";

/**
 * One adapter per DashboardLayout section id (P4-24): the dashboard renders
 * exactly the sections the composer chose, in its order, instead of the old
 * per-purpose cards. Each adapter has its own empty state that says what
 * belongs there and the one action that fills it.
 */
import React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChatsCircle, Exam, FolderSimple, Graph, Path, PlugsConnected, Timer, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { ComposedDashboardViewModel } from "@/lib/domain/personalization-engine";
import type { DashboardLayout, DashboardSection } from "@/lib/domain/dashboard-layout";
import { skillStrip, tierView, type SkillsEvidenceIndex } from "@/lib/client/evidence";
import { EvidenceLegend, EvidenceStrip } from "@/components/ui/EvidenceStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { SourceMark } from "@/components/connections/SourceMark";
import { cn } from "@/lib/client/cn";
import { sourceLabel } from "@/components/review/EntryList";

type Model = ComposedDashboardViewModel;

export function SectionFrame({ section, children, action, description }: { section: DashboardSection; children: React.ReactNode; action?: React.ReactNode; description?: React.ReactNode }) {
  return (
    <section id={`sec-${section.id}`} aria-labelledby={`sec-${section.id}-title`} className="scroll-mt-28 lg:scroll-mt-16">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={`sec-${section.id}-title`} className={cn("font-display font-bold text-text-primary", section.emphasis === "primary" ? "text-xl sm:text-2xl" : "text-lg")}>{section.title}</h2>
          {description && <p className="mt-1 max-w-[68ch] text-sm text-text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SkillsSection({ model, index }: { model: Model; index: SkillsEvidenceIndex | null }) {
  const prereqs = model.growthSection.rolePrerequisites;
  const nodes = model.skillMap.nodes;
  // Competency bubbles: one per area, sized by how many skills it holds.
  const areas = Object.entries(nodes.reduce<Record<string, { n: number; shown: number }>>((acc, n) => {
    const a = (acc[n.category] ??= { n: 0, shown: 0 });
    a.n += 1;
    if (tierView(n.tier).tier !== "gap") a.shown += 1;
    return acc;
  }, {})).sort((a, b) => b[1].n - a[1].n);
  const max = Math.max(1, ...areas.map(([, v]) => v.n));

  if (!prereqs.length && !nodes.length) {
    return (
      <EmptyState icon={Graph} title="No skills to measure yet" actions={<LinkButton href="/student/skills" variant="primary" size="sm">Add skills</LinkButton>}>
        Confirm skills from your CV or add your own. Each one then shows the evidence behind it.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="rounded-card border border-border-medium bg-bg-elevated p-4 sm:p-5">
        <h3 className="font-display text-sm font-semibold text-text-primary">By area</h3>
        <p className="mt-1 text-xs text-text-muted">Bubble size is the number of skills in that area; the filled part is how many have evidence.</p>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-3" aria-label="Skill areas">
          {areas.map(([area, v]) => {
            const size = 64 + Math.round((v.n / max) * 56);
            const pct = Math.round((v.shown / v.n) * 100);
            return (
              <li key={area} className="flex flex-col items-center gap-1.5" style={{ width: Math.max(size, 84) }}>
                <span
                  role="img"
                  aria-label={`${area}: ${v.shown} of ${v.n} skills with evidence`}
                  className={cn("relative grid place-items-center overflow-hidden rounded-full", v.shown === 0 ? "border border-dashed border-gap" : "border border-border-medium")}
                  style={{ width: size, height: size, background: v.shown === 0 ? "transparent" : `conic-gradient(var(--evidenced) ${pct * 3.6}deg, var(--deep-espresso) 0)` }}
                >
                  <span className="grid size-[calc(100%-8px)] place-items-center rounded-full bg-bg-elevated">
                    <span className="font-mono text-base font-semibold tabular text-text-primary">{v.shown}<span className="text-text-muted">/{v.n}</span></span>
                  </span>
                </span>
                <span className="text-center text-xs leading-tight text-text-muted">{area}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="rounded-card border border-border-medium bg-bg-elevated p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-text-primary">Core skills for {model.targetRole}</h3>
          <span className="text-xs text-text-muted"><span className="font-mono text-text-primary tabular">{model.growthSection.coveredPrerequisites.length}</span> of {prereqs.length} shown</span>
        </div>
        <ul className="mt-4 flex flex-col gap-3.5" data-eora-id="eora-skills-overview">
          {prereqs.map((p) => {
            // Same evidence model and counts as the skills page; the engine tier only when that data is unavailable.
            const known = index?.[p.name.toLowerCase()];
            const engine = tierView(p.tier);
            const v = known ? skillStrip(known.state, known.evidenceCount, known.sources) : { tier: engine.tier, count: engine.tier === "gap" ? 0 : p.evidenceCount ?? 0, label: engine.label };
            return (
              <li key={p.name} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_9rem]">
                <Link href={`/student/skills/${encodeURIComponent(p.name)}`} className="truncate text-sm font-medium text-text-primary hover:text-accent-warm-bright">{p.name}</Link>
                <EvidenceStrip showCounts label={`${p.name} evidence`} segments={[{ tier: v.tier, count: v.count, label: "evidence items" }]} />
                <span className="col-start-2 whitespace-nowrap text-xs text-text-muted sm:col-start-auto">{v.label}</span>
              </li>
            );
          })}
        </ul>
        {model.growthSection.skillGaps.length > 0 && (
          <div className="mt-5 border-t border-border-subtle pt-4">
            <p className="mb-2 text-xs font-medium text-text-dim">Gaps to close</p>
            <ul className="flex flex-col gap-2">
              {model.growthSection.skillGaps.slice(0, 3).map((g) => (
                <li key={g.title} className="flex items-start gap-2 text-sm">
                  <StatusChip tone={g.urgency === "critical" ? "warning" : "gap"} size="sm">{g.urgency === "critical" ? "Needed" : "Useful"}</StatusChip>
                  <span><span className="font-medium text-text-primary">{g.title}.</span> <span className="text-text-muted">{g.explanation}</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function PortfolioSection({ model }: { model: Model }) {
  const items = model.evidenceSection.cardsData.recentProjects.items;
  if (!items.length) {
    return (
      <EmptyState icon={FolderSimple} title="No projects linked yet" actions={<><LinkButton href="/student/projects" variant="primary" size="sm">Add a project</LinkButton><LinkButton href="/student/connections" variant="ghost" size="sm">Connect GitHub</LinkButton></>}>
        Projects are the strongest evidence you can show. Add one by hand, or connect GitHub and confirm what you built.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2" data-eora-id="eora-projects-list">
      {items.slice(0, 4).map((p) => (
        <li key={p.id}>
          <Link href={`/student/projects/${p.id}`} className="flex h-full min-w-0 flex-col gap-2 rounded-card border border-border-medium bg-bg-elevated p-4 transition-all duration-240 hover:border-accent-warm hover:shadow-warm">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-text-primary">{p.title}</span>
              <StatusChip tone={p.status === "confirmed" ? "evidenced" : "neutral"} size="sm">{p.status === "confirmed" ? "Confirmed" : p.status}</StatusChip>
            </div>
            {p.description && <p className="line-clamp-2 text-sm text-text-muted">{p.description}</p>}
            <EvidenceStrip
              className="mt-auto pt-1"
              label={`${p.title} sources`}
              segments={[{ tier: p.sources.length >= 2 ? "corroborated" : "evidenced", count: Math.max(1, p.sources.length), label: `source${p.sources.length === 1 ? "" : "s"}` }]}
            />
            <div className="flex flex-wrap gap-1.5">
              {p.sources.map((s) => <Tag key={s}>{sourceLabel(s)}</Tag>)}
              {p.technologies.slice(0, 3).map((t) => <Tag key={t} mono>{t}</Tag>)}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RoadmapSection({ model }: { model: Model }) {
  const ms = model.growthSection.provisionalRoadmapMilestones;
  const learning = model.growthSection.recommendedLearning;
  if (!ms.length && !learning.length) {
    return <EmptyState icon={Path} title="Your roadmap starts with your target role" actions={<LinkButton href="/student/roadmap" variant="primary" size="sm">Open roadmap</LinkButton>}>Pick a target role and confirm a few skills; the roadmap orders what to learn and build next.</EmptyState>;
  }
  return (
    <div className="rounded-card border border-border-medium bg-bg-elevated p-4 sm:p-5" data-eora-id="eora-roadmap-milestones">
      <ol className="relative flex flex-col gap-4">
        {ms.map((m, i) => (
          <li key={`${m.title}-${i}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
            <span aria-hidden="true" className={cn("mt-1 grid size-5 place-items-center rounded-full border text-2xs font-mono",
              m.status === "completed" ? "border-verified bg-verified text-espresso font-bold" : m.status === "in_progress" ? "border-accent-warm-bright text-accent-warm-bright font-semibold" : "border-border-medium text-text-dim")}>
              {i + 1}
            </span>
            <div>
              <p className="flex flex-wrap items-center gap-2 font-medium text-text-primary">
                {m.title.replace(/^Stage \d+:\s*/, "")}
                <StatusChip size="sm" tone={m.status === "completed" ? "verified" : m.status === "in_progress" ? "signal" : "neutral"} icon={null}>
                  {m.status === "completed" ? "Done" : m.status === "in_progress" ? "Now" : "Next"}
                </StatusChip>
              </p>
              {/* The engine fills unscheduled stages with one template line; show it once, not per stage. */}
              {(!/^Review evidence for /.test(m.description) || i === 0) && <p className="mt-0.5 text-sm text-text-muted">{m.description.replace(/^Review evidence for .+? and choose/, "Review your evidence for each stage and choose")}</p>}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 border-t border-border-subtle pt-3">
        <LinkButton href="/student/roadmap" variant="quiet" size="sm">Open the full roadmap<ArrowRight size={16} aria-hidden="true" /></LinkButton>
      </div>
    </div>
  );
}

function FootprintSection({ layout }: { layout: DashboardLayout }) {
  if (!layout.footprint.length) {
    return <EmptyState icon={PlugsConnected} title="No sources ranked for your priorities" actions={<LinkButton href="/student/connections" variant="primary" size="sm">Open connections</LinkButton>}>Connect the accounts that show your work; they&apos;re ranked here by what matters to you.</EmptyState>;
  }
  return (
    <ul className="divide-y divide-border-subtle rounded-card border border-border-medium bg-bg-elevated">
      {layout.footprint.map((c) => (
        <li key={c.source} data-source={c.source} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <SourceMark id={c.source} size="sm" />
          <div className="min-w-0 flex-1 basis-48">
            <p className="font-medium text-text-primary">{c.label}</p>
            <p className="text-xs text-text-muted">{c.headline ?? (c.reason.includes(":") ? `${c.reason.split(":")[0]}.` : c.reason)}</p>
          </div>
          {c.connected
            ? <StatusChip tone="verified">Connected</StatusChip>
            : <LinkButton href={c.href} variant="secondary" size="sm">Connect</LinkButton>}
        </li>
      ))}
    </ul>
  );
}

function PracticeSection({ layout }: { layout: DashboardLayout }) {
  const practice = layout.footprint.filter((f) => f.source === "leetcode" || f.source === "hackerrank");
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-card border border-border-medium bg-bg-elevated p-4">
        <p className="mb-2 font-display text-sm font-semibold text-text-primary">Coding practice</p>
        {practice.some((p) => p.connected) ? (
          <ul className="flex flex-col gap-2 text-sm">{practice.map((p) => <li key={p.source} className="flex justify-between gap-2"><span className="text-text-primary">{p.label}</span><span className="text-text-muted">{p.headline ?? (p.connected ? "Connected" : "Not connected")}</span></li>)}</ul>
        ) : (
          <p className="text-sm text-text-muted">Connect LeetCode or HackerRank to count your practice. <Link href="/student/connections" className="text-accent-warm hover:text-accent-warm-bright">Connect</Link></p>
        )}
      </div>
      {/* Assessments and interviews adapters (Task 3.1.3). */}
      <div className="grid gap-3">
        <Link href="/student/assessments" className="flex items-center gap-3 rounded-card border border-border-medium bg-bg-elevated p-4 transition-all duration-240 hover:border-accent-warm hover:shadow-warm">
          <Exam size={20} aria-hidden="true" className="text-accent-warm" />
          <span className="flex-1"><span className="block text-sm font-medium text-text-primary">Assessments</span><span className="text-xs text-text-muted">Scores and topic results with their evidence</span></span>
          <ArrowRight size={16} aria-hidden="true" className="text-text-dim" />
        </Link>
        <Link href="/student/interviews" className="flex items-center gap-3 rounded-card border border-border-medium bg-bg-elevated p-4 transition-all duration-240 hover:border-accent-warm hover:shadow-warm">
          <ChatsCircle size={20} aria-hidden="true" className="text-accent-warm" />
          <span className="flex-1"><span className="block text-sm font-medium text-text-primary">Interview practice</span><span className="text-xs text-text-muted">Rubric ratings from mock interviews</span></span>
          <ArrowRight size={16} aria-hidden="true" className="text-text-dim" />
        </Link>
      </div>
    </div>
  );
}

function PublicationsSection({ model }: { model: Model }) {
  const items = model.evidenceSection.cardsData.publications.items;
  if (!items.length) return <EmptyState icon={BookOpen} title="No publications linked" actions={<LinkButton href="/student/connections" variant="primary" size="sm">Connect ORCID</LinkButton>}>Papers come from your ORCID iD or DOI matches, never guessed from your name.</EmptyState>;
  return (
    <ul className="divide-y divide-border-subtle rounded-card border border-border-medium bg-bg-elevated">
      {items.map((p) => (
        <li key={p.id} className="px-4 py-3">
          {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-text-primary hover:text-accent-warm-bright">{p.title}</a> : <span className="font-medium text-text-primary">{p.title}</span>}
          <p className="text-xs text-text-muted">{[p.publisher, p.year].filter(Boolean).join(" · ")}</p>
        </li>
      ))}
    </ul>
  );
}

function JourneySection({ model }: { model: Model }) {
  const rec = model.journeyRecords;
  if (!rec.length) return <EmptyState icon={Timer} title="Your journey starts here">Milestones appear as you add evidence: CV uploaded, project confirmed, skill verified.</EmptyState>;
  return (
    <ol className="rounded-card border border-border-medium bg-bg-elevated p-4 sm:p-5" data-eora-id="eora-journey-timeline">
      {rec.slice(-6).reverse().map((r, i) => (
        <li key={`${r.title}-${i}`} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
          <span aria-hidden="true" className={cn("mt-1.5 size-2.5 rounded-full", r.status === "completed" ? "bg-verified" : r.status === "active" ? "bg-accent-warm-bright" : "bg-border-medium")} />
          <div><p className="text-sm font-medium text-text-primary">{r.title}</p><p className="font-mono text-2xs text-text-muted tabular">{r.subtitle}</p></div>
        </li>
      ))}
      <li className="pt-2"><LinkButton href="/student/journey" variant="quiet" size="sm">See your full journey<ArrowRight size={16} aria-hidden="true" /></LinkButton></li>
    </ol>
  );
}

function EcosystemSection({ model, kind }: { model: Model; kind: "opportunities" | "people" }) {
  const e = model.ecosystemSection;
  const items = kind === "opportunities"
    ? [...e.internships.map((i) => ({ id: i.id, title: i.title, sub: `${i.company} · ${i.location}` })), ...e.relevantOpportunities.map((o) => ({ id: o.id, title: o.title, sub: o.description }))]
    : [...e.recommendedMentors.map((m) => ({ id: m.id, title: m.name, sub: m.title })), ...e.peopleYouShouldKnow.map((p) => ({ id: p.id, title: p.name, sub: p.subtitle }))];
  if (!items.length) {
    return (
      <EmptyState icon={UsersThree} title={kind === "opportunities" ? "No openings connected yet" : "No people connected yet"}>
        {e.subtitle} When real {kind === "opportunities" ? "openings" : "mentors and peers"} are available they appear here, matched to your evidence. We don&apos;t show sample listings.
      </EmptyState>
    );
  }
  return <ul className="divide-y divide-border-subtle rounded-card border border-border-medium bg-bg-elevated">{items.map((i) => <li key={i.id} className="px-4 py-3"><p className="font-medium text-text-primary">{i.title}</p><p className="text-xs text-text-muted">{i.sub}</p></li>)}</ul>;
}

export function DashboardSectionView({ section, model, layout, index = null }: { section: DashboardSection; model: Model; layout: DashboardLayout; index?: SkillsEvidenceIndex | null }) {
  switch (section.id) {
    case "skill_gaps":
      return <SectionFrame section={section} action={<EvidenceLegend tiers={["verified", "corroborated", "evidenced", "gap"]} />}><SkillsSection model={model} index={index} /></SectionFrame>;
    case "portfolio":
      return <SectionFrame section={section} action={<LinkButton href="/student/projects" variant="quiet" size="sm">Project ledger<ArrowRight size={16} aria-hidden="true" /></LinkButton>}><PortfolioSection model={model} /></SectionFrame>;
    case "roadmap":
      return <SectionFrame section={section}><RoadmapSection model={model} /></SectionFrame>;
    case "footprint":
      return <SectionFrame section={section} description="Ordered by your priorities: the sources that matter most for your #1 priority come first.">{<FootprintSection layout={layout} />}</SectionFrame>;
    case "practice":
      return <SectionFrame section={section}><PracticeSection layout={layout} /></SectionFrame>;
    case "publications":
      return <SectionFrame section={section}><PublicationsSection model={model} /></SectionFrame>;
    case "journey":
      return <SectionFrame section={section}><JourneySection model={model} /></SectionFrame>;
    case "opportunities":
    case "people":
      return <SectionFrame section={section}><EcosystemSection model={model} kind={section.id} /></SectionFrame>;
    default:
      return null;
  }
}
