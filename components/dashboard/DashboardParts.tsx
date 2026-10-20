"use client";

/**
 * Dashboard building blocks: the stat row, the priority hero (shaped by the
 * #1 priority, Task 2.3.1) and next actions with their "why".
 */
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CaretDown, Info } from "@phosphor-icons/react/dist/ssr";
import type { ComposedDashboardViewModel, NextBestAction } from "@/lib/domain/personalization-engine";
import type { HeroWidget } from "@/lib/domain/dashboard-layout";
import { LinkButton } from "@/components/ui/Button";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { cn } from "@/lib/client/cn";

type Card = ComposedDashboardViewModel["summaryCards"][number];

const PROVENANCE: Record<Card["provenance"], string> = {
  actual_records: "From your records",
  verified_ledger: "From the evidence ledger",
  provisional: "Provisional",
  unavailable: "Not available yet",
};

/** Four headline numbers, each with where it comes from. */
export function StatRow({ cards }: { cards: Card[] }) {
  const pick = ["card_evidence", "card_skills", "card_projects", "card_readiness"]
    .map((id) => cards.find((c) => c.id === id))
    .filter(Boolean) as Card[];
  const list = pick.length >= 3 ? pick : cards.slice(0, 4);
  return (
    <dl data-eora-id="eora-evidence-panel" className="grid grid-cols-2 overflow-hidden rounded-card border border-border-medium bg-border-medium lg:grid-cols-4" style={{ gap: 1 }}>
      {list.map((c) => {
        const numeric = typeof c.value === "number" || /^\d/.test(String(c.value));
        return (
          <div key={c.id} className="flex min-w-0 flex-col gap-1 bg-bg-elevated px-4 py-4">
            <dt className="truncate text-xs font-medium text-text-dim">{c.label.replace(/\b(\w)(\w*)/g, (m, a, b, i) => (i === 0 ? m : a.toLowerCase() + b))}</dt>
            <dd className={cn("truncate", numeric ? "font-display text-2xl sm:text-3xl font-bold text-text-primary tabular" : "text-lg font-semibold text-text-primary")}>{c.value}</dd>
            <dd className="text-xs text-text-muted">{c.subtext}</dd>
            <dd className="mt-1"><span className="font-mono text-2xs uppercase tracking-wider text-text-dim">{PROVENANCE[c.provenance]}</span></dd>
          </div>
        );
      })}
    </dl>
  );
}

const list = (items: string[], empty: string) =>
  items.length ? (
    <ol className="flex flex-col gap-2">
      {items.map((t, i) => (
        <li key={`${t}-${i}`} className="flex items-start gap-3 text-sm">
          <span className="mt-0.5 font-mono text-xs text-text-muted tabular">{i + 1}</span>
          <span className="text-text-primary">{t}</span>
        </li>
      ))}
    </ol>
  ) : <p className="text-sm text-text-muted">{empty}</p>;

const gaps = (g: string[]) =>
  g.length > 0 && (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-text-dim">Skills to show next</p>
      <div className="flex flex-wrap gap-1.5">{g.map((s) => <StatusChip key={s} tone="gap">{s}</StatusChip>)}</div>
    </div>
  );

/** The hero changes shape with the #1 priority; it is the layout's own widget, not a reordered card. */
export function PriorityHero({ hero }: { hero: HeroWidget }) {
  let body: React.ReactNode;
  switch (hero.kind) {
    case "readiness":
      body = (
        <>
          {hero.readiness === null ? (
            <p className="text-sm text-text-muted"><span className="font-medium text-text-primary">No score yet.</span> {hero.note}</p>
          ) : (
            <p className="flex items-baseline gap-2"><span className="font-display text-3xl font-bold text-text-primary tabular">{hero.readiness}</span><span className="text-sm text-text-muted">/ 100 · {hero.note}</span></p>
          )}
          {gaps(hero.gaps)}
        </>
      );
      break;
    case "project_workbench": {
      // The portfolio section below lists the projects; the hero says where you stand and what to open next.
      const latest = hero.projects[0];
      body = hero.projects.length ? (
        <dl className="grid grid-cols-2 gap-4">
          <div><dt className="text-xs font-medium text-text-dim">In your portfolio</dt><dd className="mt-1 font-display text-3xl font-bold text-text-primary tabular">{hero.portfolioCount}</dd></div>
          <div className="min-w-0"><dt className="text-xs font-medium text-text-dim">Last worked on</dt><dd className="mt-1"><Link href={`/student/projects/${latest.id}`} className="line-clamp-2 font-medium text-text-primary hover:text-accent-warm-bright">{latest.title}</Link></dd></div>
        </dl>
      ) : <p className="text-sm text-text-muted">No projects yet. Add one, or connect GitHub to bring yours in.</p>;
      break;
    }
    case "learning_path":
      body = <>{list(hero.nextSteps, "Your roadmap suggests next steps once your skills are in.")}{gaps(hero.gaps)}</>;
      break;
    case "research_profile":
      body = hero.hasResearchId
        ? <p className="flex items-baseline gap-2"><span className="font-display text-3xl font-bold text-text-primary tabular">{hero.publications}</span><span className="text-sm text-text-muted">publication{hero.publications === 1 ? "" : "s"} from your research ID</span></p>
        : <p className="text-sm text-text-muted">Connect an ORCID or Semantic Scholar ID to bring in your papers. Nothing is guessed from your name.</p>;
      break;
    case "network":
      body = <p className="text-sm text-text-muted">{hero.linkedinConnected ? "LinkedIn is connected." : "LinkedIn isn't connected; it's optional."} <span className="font-mono text-text-primary tabular">{hero.sharedProjects}</span> project{hero.sharedProjects === 1 ? "" : "s"} on GitHub others can see.</p>;
      break;
  }

  const spotlightInfo = useMemo(() => {
    switch (hero.kind) {
      case "readiness":
        return { portal: "Avasar Spotlight", desc: "Matched Roles & Internships", accent: "#D4AF37" };
      case "project_workbench":
      case "network":
        return { portal: "Collaborate Spotlight", desc: "Peer Matches & Active Builds", accent: "#E05A47" };
      case "learning_path":
        return { portal: "Learn Spotlight", desc: "Personalized Roadmap & Modules", accent: "#C48A5A" };
      case "research_profile":
        return { portal: "Research Ledger", desc: "Citations & Methodology Proof", accent: "#4CD3E3" };
      default:
        return { portal: "Priority Focus", desc: "Active Milestone", accent: "#D4AF37" };
    }
  }, [hero.kind]);

  return (
    <section
      aria-labelledby="hero-title"
      data-hero-kind={hero.kind}
      data-eora-id="eora-active-goal"
      className="flex min-w-0 flex-col rounded-card border border-[#D4AF37]/30 bg-bg-elevated/90 backdrop-blur-md p-5 shadow-card transition-all hover:border-[#D4AF37]/50"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#141413] dark:bg-white/10 px-2.5 py-0.5 border border-border-medium">
            <span className="size-1.5 rounded-full animate-ping" style={{ backgroundColor: spotlightInfo.accent }} />
            <span className="font-mono text-2xs uppercase tracking-wider font-bold" style={{ color: spotlightInfo.accent }}>
              {spotlightInfo.portal}
            </span>
          </span>
          <span className="hidden sm:inline font-mono text-3xs text-text-muted">· {spotlightInfo.desc}</span>
        </div>
        <Tag>Your #1 priority</Tag>
      </div>
      <h2 id="hero-title" className="font-editorial text-2xl font-bold text-text-primary mb-3">{hero.title}</h2>
      <div className="flex-1">{body}</div>
      <div className="mt-5 pt-3 border-t border-border-subtle">
        <LinkButton href={hero.cta.href} variant="primary" size="sm">{hero.cta.label}<ArrowRight size={16} aria-hidden="true" /></LinkButton>
      </div>
    </section>
  );
}

export function NextActions({ actions }: { actions: NextBestAction[] }) {
  const [why, setWhy] = useState<string | null>(null);
  const top = actions.filter((a) => a.isEligible).slice(0, 4);
  return (
    <section aria-labelledby="next-title" data-eora-id="eora-next-actions" className="flex min-w-0 flex-col rounded-card border border-border-medium bg-bg-elevated p-4 sm:p-5">
      <h2 id="next-title" className="mb-3 font-display text-lg font-bold text-text-primary">Next steps</h2>
      {top.length === 0 ? (
        <p className="text-sm text-text-muted">Nothing pressing. Add a project or connect an account to get suggestions.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border-subtle">
          {top.map((a, i) => (
            <li key={a.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 font-mono text-xs text-text-muted tabular">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={a.destinationUrl} className="group inline-flex items-start gap-1 font-medium text-text-primary hover:text-accent-warm-bright">
                    {a.title}<ArrowRight size={14} aria-hidden="true" className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                  <p className="mt-0.5 text-sm text-text-muted">{a.description}</p>
                  <button type="button" aria-expanded={why === a.id} onClick={() => setWhy(why === a.id ? null : a.id)}
                    className="mt-1.5 inline-flex min-h-8 cursor-pointer items-center gap-1 text-xs text-text-muted hover:text-text-primary pointer-coarse:min-h-11">
                    <Info size={14} aria-hidden="true" />Why this
                    <CaretDown size={12} aria-hidden="true" className={cn("transition-transform", why === a.id && "rotate-180")} />
                  </button>
                  {why === a.id && (
                    <dl className="mt-2 grid gap-1.5 rounded-md border border-border-medium bg-deep-espresso/50 p-3 text-xs">
                      <div><dt className="inline text-text-dim">Goal: </dt><dd className="inline text-text-primary">{a.whyAmISeeingThis.goalRelevance}</dd></div>
                      <div><dt className="inline text-text-dim">Based on: </dt><dd className="inline text-text-primary">{a.whyAmISeeingThis.evidenceContext}</dd></div>
                      <div><dt className="inline text-text-dim">Result: </dt><dd className="inline text-text-primary">{a.whyAmISeeingThis.actionOutcome}</dd></div>
                    </dl>
                  )}
                </div>
                <Tag className="shrink-0">{a.actionType}</Tag>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
