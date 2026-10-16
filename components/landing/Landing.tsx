/**
 * Public landing (Persuade). The first viewport demonstrates the mechanism:
 * a profile where every skill shows what backs it. The example is labelled as
 * an example; there are no invented numbers, testimonials or partners
 * (docs/ECOSYSTEM_LANDING_COPY_MAP.md).
 */
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle, FileText, PencilSimple, ShieldCheck, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LinkButton } from "@/components/ui/Button";
import { EvidenceLegend, EvidenceStrip, type EvidenceSegment } from "@/components/ui/EvidenceStrip";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { SourceMark } from "@/components/connections/SourceMark";
import { SkillsMap } from "@/components/skills/SkillsMap";
import { LANDING_EXAMPLE } from "@/lib/client/skills-map-data";

const EXAMPLE: { skill: string; segments: EvidenceSegment[]; note: string }[] = [
  { skill: "PyTorch", segments: [{ tier: "verified", count: 1, label: "verified by faculty" }, { tier: "corroborated", count: 3, label: "from 2 sources" }], note: "Faculty review · GitHub · CV" },
  { skill: "Retrieval (RAG)", segments: [{ tier: "corroborated", count: 2, label: "from 2 sources" }], note: "GitHub repo · project note" },
  { skill: "SQL", segments: [{ tier: "evidenced", count: 2, label: "from 1 source" }], note: "CV · one project" },
  { skill: "MLOps", segments: [{ tier: "gap", count: 0 }], note: "Needed for your target role; nothing shows it yet" },
];

const STEPS = [
  { icon: FileText, title: "We read what you already have", body: "Your CV and the accounts you choose: GitHub, Kaggle, LeetCode, ORCID, LinkedIn and more. Every source is optional, and slow imports finish in the background." },
  { icon: PencilSimple, title: "You confirm or correct every item", body: "Nothing reaches your profile until you accept it. Edit anything; your edit always wins over a source." },
  { icon: Sparkle, title: "You see what's proven and what's next", body: "Each skill shows the evidence behind it, measured against the role you're aiming for, with the next useful step." },
];

const PRODUCTS = [
  { name: "AI Tathastu Core", body: "Your verified skills profile, project ledger and roadmap.", available: true },
  { name: "EORA", body: "Your guide, in English and Hinglish, answering from your own profile.", available: true },
  { name: "Learn", body: "Learning paths shaped by your gaps.", available: false },
  { name: "Collaborate", body: "Find people to build with.", available: false },
  { name: "Meet", body: "Mentors and peers.", available: false },
  { name: "ERIS", body: "Institutional assessments that count as evidence.", available: false },
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <a href="#how" className="hidden min-h-10 items-center rounded-[var(--radius-control)] px-3 text-sm text-muted hover:text-ink sm:inline-flex">How it works</a>
          <a href="#ecosystem" className="hidden min-h-10 items-center rounded-[var(--radius-control)] px-3 text-sm text-muted hover:text-ink sm:inline-flex">Ecosystem</a>
          <ThemeToggle compact />
          <LinkButton href="/sign-in" variant="ghost" size="sm">Sign in</LinkButton>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        {/* First viewport: the mechanism, demonstrated. */}
        <section aria-labelledby="hero-title" data-eora-id="eora-landing-hero" className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-4 pb-16 pt-8 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-16 lg:pb-24">
          <div className="min-w-0">
            <h1 id="hero-title" className="text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              One honest picture of what you can do in AI and ML.
            </h1>
            <p className="mt-5 max-w-[52ch] text-lg text-muted">
              AI Tathastu turns your CV, GitHub and other profiles into a skills profile where every claim shows its evidence, then tells you the next useful step toward the role you want.
            </p>
            <div className="mt-8 flex flex-wrap gap-3" data-eora-id="eora-landing-cta">
              <LinkButton href="/onboarding" variant="primary" className="min-h-12 px-5 text-base">Get started<ArrowRight size={18} aria-hidden="true" /></LinkButton>
              <LinkButton href="/sign-in" variant="secondary" className="min-h-12 px-5 text-base">I have an account</LinkButton>
            </div>
            <p className="mt-4 text-sm text-muted">Nothing reaches your profile until you confirm it.</p>
          </div>

          <figure className="min-w-0 rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-raise)]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Skills for Machine Learning Engineer</p>
                <p className="text-xs text-muted">What backs each one</p>
              </div>
              <Tag>Example profile</Tag>
            </div>
            <ul className="divide-y divide-line">
              {EXAMPLE.map((e) => (
                <li key={e.skill} className="px-4 py-3.5">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="font-medium">{e.skill}</span>
                    {e.segments[0].tier === "gap" ? <StatusChip tone="gap" size="sm">Gap</StatusChip> : e.segments[0].tier === "verified" ? <StatusChip tone="verified" size="sm">Verified</StatusChip> : null}
                  </div>
                  <EvidenceStrip segments={e.segments} label={`${e.skill} evidence`} showCounts />
                  <p className="mt-1.5 text-xs text-muted">{e.note}</p>
                </li>
              ))}
            </ul>
            <figcaption className="border-t border-line px-4 py-3"><EvidenceLegend /></figcaption>
          </figure>
        </section>

        {/* The skills map, shown with fixed example data (no account, no API calls). */}
        <section id="map" aria-labelledby="map-demo-title" data-eora-id="eora-landing-map" className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center lg:gap-12">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">Skills map</p>
              <h2 id="map-demo-title" className="mt-2 max-w-[18ch] text-3xl font-semibold tracking-[-0.025em]">See how your skills connect to the role you want</h2>
              <p className="mt-4 max-w-[46ch] text-muted">Your target role sits in the middle. Your skills sit around it, grouped by kind, and each one links out to what backs it: a repository, a paper, an assessment or a faculty review. A gap is drawn as a gap.</p>
              <p className="mt-4 text-sm text-muted">Hover a skill to see what backs it.</p>
            </div>
            <figure className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <figcaption className="text-sm font-medium">Skills map for {LANDING_EXAMPLE.goal}</figcaption>
                <Tag>Example profile</Tag>
              </div>
              <SkillsMap mode="demo" goal={LANDING_EXAMPLE.goal} skills={LANDING_EXAMPLE.skills} gaps={LANDING_EXAMPLE.gaps} className="shadow-[var(--shadow-raise)]" />
            </figure>
          </div>
        </section>

        <section id="how" aria-labelledby="how-title" data-eora-id="eora-landing-features" className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="how-title" className="max-w-[24ch] text-3xl font-semibold tracking-[-0.025em]">From scattered evidence to a profile you can stand behind</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
              {STEPS.map((s, i) => (
                <li key={s.title} className="border-t border-line-strong/60 pt-5">
                  <p className="flex items-center gap-2 font-mono text-sm text-muted"><span className="tabular">{i + 1}</span><s.icon size={18} aria-hidden="true" /></p>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="sources-title" className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
            <div>
              <h2 id="sources-title" className="text-3xl font-semibold tracking-[-0.025em]">Bring what shows your work</h2>
              <p className="mt-3 max-w-[48ch] text-muted">Public data only, read with your consent. LinkedIn comes from your own data export or an optional sign-in you approve; Google Scholar is never scraped, and papers are matched to your research ID, never guessed from your name.</p>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm">
                {["Every source is optional; skipping never blocks you", "Imported items are suggestions until you accept them", "Your edit always wins over any source", "Status is shown honestly: done, still importing, or failed with a way to retry"].map((t) => (
                  <li key={t} className="flex items-start gap-2"><CheckCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-verified" />{t}</li>
                ))}
              </ul>
            </div>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Sources you can connect">
              {["resume", "github", "linkedin", "kaggle", "leetcode", "hackerrank", "huggingface", "orcid", "google_scholar", "stackoverflow", "devto", "portfolio"].map((id) => (
                <li key={id} className="flex flex-col items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-2 py-4 text-center">
                  <SourceMark id={id} />
                  <span className="text-xs text-muted">{{ resume: "CV", github: "GitHub", linkedin: "LinkedIn", kaggle: "Kaggle", leetcode: "LeetCode", hackerrank: "HackerRank", huggingface: "Hugging Face", orcid: "ORCID", google_scholar: "Scholar", stackoverflow: "Stack Overflow", devto: "DEV", portfolio: "Portfolio" }[id]}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="ecosystem" aria-labelledby="eco-title" className="border-t border-line">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-end">
              <div>
                <h2 id="eco-title" className="text-3xl font-semibold tracking-[-0.025em]">One ecosystem, built in the open</h2>
                <p className="mt-3 max-w-[56ch] text-muted">Core and EORA are available today. The rest are in development and labelled that way.</p>
              </div>
              <div className="relative hidden h-52 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface lg:block">
                <Image src="/assets/eora/waving.png" alt="EORA waving" fill sizes="224px" className="object-contain object-bottom" />
              </div>
            </div>
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {PRODUCTS.map((p) => (
                <li key={p.name} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4">
                  <span className="w-44 font-medium">{p.name}</span>
                  <span className="min-w-0 flex-1 basis-56 text-sm text-muted">{p.body}</span>
                  {p.available ? <StatusChip tone="verified">Available</StatusChip> : <StatusChip tone="neutral" icon={null}>In development</StatusChip>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cta-title" className="border-t border-line bg-surface">
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-6 px-4 py-14 sm:px-6">
            <div>
              <h2 id="cta-title" className="text-2xl font-semibold tracking-[-0.02em]">Start with what you have</h2>
              <p className="mt-1 text-muted">A CV is enough. EORA walks you through the rest.</p>
            </div>
            <LinkButton href="/onboarding" variant="primary" className="min-h-12 px-5 text-base">Get started<ArrowRight size={18} aria-hidden="true" /></LinkButton>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:px-6">
        <span className="flex flex-col gap-1"><span className="text-ink">You imagine. AI makes it happen.</span><span className="inline-flex items-center gap-2"><ShieldCheck size={16} aria-hidden="true" />Your data is yours: export it, or delete your account any time.</span></span>
        <span className="inline-flex gap-4"><Link href="/sign-in" className="hover:text-ink">Sign in</Link><Link href="/sign-up" className="hover:text-ink">Create account</Link><a href="#how" className="hover:text-ink">How it works</a></span>
      </footer>
    </div>
  );
}

