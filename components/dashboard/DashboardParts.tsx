"use client";

/**
 * Dashboard building blocks: the stat row, the priority hero (shaped by the
 * #1 priority, Task 2.3.1) and next actions with their "why".
 */
import React, { useState } from "react";
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
    <dl data-eora-id="eora-evidence-panel" className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line lg:grid-cols-4" style={{ gap: 1 }}>
      {list.map((c) => {
        const numeric = typeof c.value === "number" || /^\d/.test(String(c.value));
        return (
          <div key={c.id} className="flex min-w-0 flex-col gap-1 bg-surface px-4 py-4">
            <dt className="truncate text-xs text-muted">{c.label.replace(/\b(\w)(\w*)/g, (m, a, b, i) => (i === 0 ? m : a.toLowerCase() + b))}</dt>
            <dd className={cn("truncate font-semibold", numeric ? "font-mono text-2xl tabular" : "text-lg")}>{c.value}</dd>
            <dd className="text-xs text-muted">{c.subtext}</dd>
            <dd className="mt-1"><span className="text-2xs text-muted">{PROVENANCE[c.provenance]}</span></dd>
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
          <span className="mt-0.5 font-mono text-xs text-muted tabular">{i + 1}</span>
          <span className="text-ink">{t}</span>
        </li>
      ))}
    </ol>
  ) : <p className="text-sm text-muted">{empty}</p>;

const gaps = (g: string[]) =>
  g.length > 0 && (
    <div className="mt-4">
      <p className="mb-2 text-xs text-muted">Skills to show next</p>
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
            <p className="text-sm text-muted"><span className="font-medium text-ink">No score yet.</span> {hero.note}</p>
          ) : (
            <p className="flex items-baseline gap-2"><span className="font-mono text-3xl font-semibold tabular">{hero.readiness}</span><span className="text-sm text-muted">/ 100 · {hero.note}</span></p>
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
          <div><dt className="text-xs text-muted">In your portfolio</dt><dd className="mt-1 font-mono text-3xl font-semibold tabular">{hero.portfolioCount}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-muted">Last worked on</dt><dd className="mt-1"><Link href={`/student/projects/${latest.id}`} className="line-clamp-2 font-medium hover:text-signal">{latest.title}</Link></dd></div>
        </dl>
      ) : <p className="text-sm text-muted">No projects yet. Add one, or connect GitHub to bring yours in.</p>;
      break;
    }
    case "learning_path":
      body = <>{list(hero.nextSteps, "Your roadmap suggests next steps once your skills are in.")}{gaps(hero.gaps)}</>;
      break;
    case "research_profile":
      body = hero.hasResearchId
        ? <p className="flex items-baseline gap-2"><span className="font-mono text-3xl font-semibold tabular">{hero.publications}</span><span className="text-sm text-muted">publication{hero.publications === 1 ? "" : "s"} from your research ID</span></p>
        : <p className="text-sm text-muted">Connect an ORCID or Semantic Scholar ID to bring in your papers. Nothing is guessed from your name.</p>;
      break;
    case "network":
      body = <p className="text-sm text-muted">{hero.linkedinConnected ? "LinkedIn is connected." : "LinkedIn isn't connected; it's optional."} <span className="font-mono text-ink tabular">{hero.sharedProjects}</span> project{hero.sharedProjects === 1 ? "" : "s"} on GitHub others can see.</p>;
      break;
  }
  return (
    <section aria-labelledby="hero-title" data-hero-kind={hero.kind} data-eora-id="eora-active-goal" className="flex min-w-0 flex-col rounded-[var(--radius-panel)] border border-line bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="hero-title" className="text-lg font-semibold">{hero.title}</h2>
        <Tag>Your #1 priority</Tag>
      </div>
      <div className="flex-1">{body}</div>
      <div className="mt-5">
        <LinkButton href={hero.cta.href} variant="primary" size="sm">{hero.cta.label}<ArrowRight size={16} aria-hidden="true" /></LinkButton>
      </div>
    </section>
  );
}

export function NextActions({ actions }: { actions: NextBestAction[] }) {
  const [why, setWhy] = useState<string | null>(null);
  const top = actions.filter((a) => a.isEligible).slice(0, 4);
  return (
    <section aria-labelledby="next-title" data-eora-id="eora-next-actions" className="flex min-w-0 flex-col rounded-[var(--radius-panel)] border border-line bg-surface p-4 sm:p-5">
      <h2 id="next-title" className="mb-3 text-lg font-semibold">Next steps</h2>
      {top.length === 0 ? (
        <p className="text-sm text-muted">Nothing pressing. Add a project or connect an account to get suggestions.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {top.map((a, i) => (
            <li key={a.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 font-mono text-xs text-muted tabular">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={a.destinationUrl} className="group inline-flex items-start gap-1 font-medium text-ink hover:text-signal">
                    {a.title}<ArrowRight size={14} aria-hidden="true" className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">{a.description}</p>
                  <button type="button" aria-expanded={why === a.id} onClick={() => setWhy(why === a.id ? null : a.id)}
                    className="mt-1.5 inline-flex min-h-8 cursor-pointer items-center gap-1 text-xs text-muted hover:text-ink pointer-coarse:min-h-11">
                    <Info size={14} aria-hidden="true" />Why this
                    <CaretDown size={12} aria-hidden="true" className={cn("transition-transform", why === a.id && "rotate-180")} />
                  </button>
                  {why === a.id && (
                    <dl className="mt-2 grid gap-1.5 rounded-[var(--radius-control)] border border-line bg-raised/40 p-3 text-xs">
                      <div><dt className="inline text-muted">Goal: </dt><dd className="inline text-ink">{a.whyAmISeeingThis.goalRelevance}</dd></div>
                      <div><dt className="inline text-muted">Based on: </dt><dd className="inline text-ink">{a.whyAmISeeingThis.evidenceContext}</dd></div>
                      <div><dt className="inline text-muted">Result: </dt><dd className="inline text-ink">{a.whyAmISeeingThis.actionOutcome}</dd></div>
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
