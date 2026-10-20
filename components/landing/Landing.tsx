/**
 * AI TATHASTU — LANDING PAGE
 *
 * Warm Editorial Futurism Rebuild (Phase 4):
 * - Dual-mode: 75-second GSAP/RAF cinematic storytelling sequence with Skip Intro & reduced-motion support
 * - Living 3D Eiora Companion with reactive liquid-glass canvas & live speech
 * - Accessible Sticky Header with Responsive Mobile Navigation Drawer (Escape key, focus trap, aria-expanded)
 * - Interactive Hero with live persona toggles (Builder | Researcher | Learner)
 * - Verified Trust & Credibility Bar (GitHub, LinkedIn, Kaggle, LeetCode, ORCID, Hugging Face, DPDP 2023)
 * - Narrative Problem Transformation (The Resume Paradox vs The Verified Evidence Standard)
 * - Interactive Product Experience Preview (4 interactive tabs: Person 360, Skill Graph, Project Ledger, Roadmap)
 * - 5-World Ecosystem Bento Grid (Avasar, Collaborate, Learn, Meet, Iris) with tour targets
 * - 4-Stage "How It Works" Journey matching the 11-step onboarding pipeline
 * - Footprint-to-Graph Visualizer (GitHub, LeetCode, ORCID, Kaggle, Resume)
 * - Editorial "Wall of Proof" magazine testimonials
 * - Accessible FAQ Accordion with smooth state transitions
 * - High-Contrast Magnetic Final CTA (#141413 & #D4AF37)
 * - Architectural 5-Column Footer with live ecosystem status indicator & DPDP legal bar
 * - Strictly preserves all existing auth props, links, Eora tour targets, and openEoraChat bindings
 */
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  Code,
  Cpu,
  Eye,
  FileText,
  GraduationCap,
  Play,
  Pause,
  RocketLaunch,
  Sparkle,
  TerminalWindow,
  UsersThree,
  VideoCamera,
  X,
  List,
  ShieldCheck,
  Check,
} from "@phosphor-icons/react/dist/ssr";
import { openEoraChat } from "@/components/eora/EoraCompanion";
import { EioraVisual } from "@/components/eora/EioraVisual";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/client/cn";

export interface LandingUser {
  displayName?: string | null;
  role?: string;
}

interface LandingProps {
  user?: LandingUser | null;
}

type PersonaType = "builder" | "researcher" | "learner";

const PERSONA_CONFIG: Record<
  PersonaType,
  {
    tag: string;
    headline: string;
    sub: string;
    skills: string[];
    highlightWorld: string;
    metric: string;
  }
> = {
  builder: {
    tag: "For Developers & Software Engineers",
    headline: "Transform code repositories into verified engineering proof.",
    sub: "Connect GitHub, LeetCode, and HackerRank to deconstruct your commits, architecture patterns, and problem-solving depth into an unforgeable skill graph.",
    skills: ["System Design", "MLOps & Docker", "PyTorch", "Distributed Systems", "FastAPI"],
    highlightWorld: "Collaborate & Avasar",
    metric: "3.4x faster technical shortlisting via verified repository evidence",
  },
  researcher: {
    tag: "For AI Scientists & ML Academics",
    headline: "Turn publications and notebooks into an active citation graph.",
    sub: "Index ORCID, Semantic Scholar, and Kaggle. Show the world not just the title of your papers, but the mathematics and reproducible models behind them.",
    skills: ["Transformer Architectures", "Diffusion Models", "Statistical Inference", "LaTeX", "CUDA"],
    highlightWorld: "Iris & Learn",
    metric: "98.2% automated citation & methodology extraction accuracy",
  },
  learner: {
    tag: "For Students & Career Transitioners",
    headline: "Close skill gaps with intelligent, evidence-grounded roadmaps.",
    sub: "Eiora pinpoints exactly what you already know from your CV, maps the delta to your dream role, and guides you through project-driven milestones.",
    skills: ["Python Foundations", "Data Structures", "Deep Learning", "SQL", "Prompt Engineering"],
    highlightWorld: "Learn & Meet",
    metric: "Zero vague courses · 100% project-grounded mastery",
  },
};

const ECOSYSTEM_WORLDS = [
  {
    id: "avasar",
    name: "Avasar",
    tagline: "High-Integrity Opportunity Exchange",
    desc: "Alternative to Naukri & Indeed. Matches candidates to top AI/ML internships and careers based purely on verified skill evidence, eliminating resume-keyword spam.",
    icon: Briefcase,
    color: "#D4AF37", // Champagne Gold
    badge: "Careers & Internships",
    stat: "1,200+ Verified AI Roles",
    link: "/student",
  },
  {
    id: "collaborate",
    name: "Collaborate",
    tagline: "Peer Co-Builders & Open-Source Network",
    desc: "Alternative to LinkedIn noise. Discover builders working on compatible stacks, form project squads, share pull requests, and create demonstrable team artifacts.",
    icon: UsersThree,
    color: "#E05A47", // Living Terracotta
    badge: "Network & Squads",
    stat: "4,800+ Active Builders",
    link: "/student/connections",
  },
  {
    id: "learn",
    name: "Learn",
    tagline: "Adaptive AI Curriculum & Roadmaps",
    desc: "Hyper-personalized learning modules tailored to your proven gaps. No generic 50-hour playlists—just bite-sized builds and rigorous concept drills.",
    icon: GraduationCap,
    color: "#C48A5A",
    badge: "Adaptive Curriculum",
    stat: "140+ Role Roadmaps",
    link: "/student/roadmap",
  },
  {
    id: "meet",
    name: "Meet",
    tagline: "Spatial Collaboration & Peer Review",
    desc: "Alternative to Zoom/Meet. Real-time audio/video collaboration rooms equipped with live interactive code sandboxes, paper reading whiteboards, and AI meeting summaries.",
    icon: VideoCamera,
    color: "#4CD3E3", // Prism Cyan
    badge: "Real-Time Rooms",
    stat: "Zero-latency WebRTC",
    link: "/student/interviews",
  },
  {
    id: "iris",
    name: "Iris",
    tagline: "AI-Proctored Integrity & Skill Assessments",
    desc: "High-integrity multi-modal evaluation suite that validates practical coding, reasoning, and system architecture with cryptographic proof of authenticity.",
    icon: Eye,
    color: "#F1948A", // Prism Rose
    badge: "Verified Evaluation",
    stat: "Tamper-Proof Ledger",
    link: "/student/assessments",
  },
];

type PreviewTabId = "profile" | "skills" | "projects" | "roadmap";

interface PreviewTab {
  id: PreviewTabId;
  label: string;
  badge: string;
  title: string;
  subtitle: string;
}

const PREVIEW_TABS: PreviewTab[] = [
  {
    id: "profile",
    label: "Person 360",
    badge: "Identity & Goals",
    title: "Holistic Verified Candidate Profile",
    subtitle: "A living representation of your skills, papers, and code that replaces static PDF resumes.",
  },
  {
    id: "skills",
    label: "Skill Graph",
    badge: "Proven Provenance",
    title: "Evidence-Ground Skill Topology",
    subtitle: "Every node links back to exact repositories, pull requests, or peer-reviewed papers.",
  },
  {
    id: "projects",
    label: "Project Ledger",
    badge: "Engineering Depth",
    title: "Verified Contribution Workspaces",
    subtitle: "Show what you personally built with clear architecture diagrams and contribution notes.",
  },
  {
    id: "roadmap",
    label: "Adaptive Roadmap",
    badge: "Goal Trajectory",
    title: "Precision Role Milestones",
    subtitle: "Eiora maps the exact technical bridge between your current capabilities and your target role.",
  },
];

const FAQS = [
  {
    q: "How does AI Tathastu differ from generic SaaS or course platforms?",
    a: "Generic platforms hand everyone the same static video curriculum and rely on self-reported resume claims. AI Tathastu is an evidence-first ecosystem. We read your real GitHub commits, papers, Kaggle work, and CV, then build an honest, verified skill graph with Eiora guiding your exact next step.",
  },
  {
    q: "What are the 5 Worlds of AI Tathastu?",
    a: "The ecosystem consists of Avasar (evidence-matched jobs/internships), Collaborate (noise-free project co-builders), Learn (personalized skill roadmaps), Meet (spatial video/code collaboration rooms), and Iris (high-integrity AI proctored assessments).",
  },
  {
    q: "Is my personal data, code, and resume kept secure?",
    a: "Yes. All data processing adheres to the India Digital Personal Data Protection (DPDP) Act 2023. Connectors are read-only and optional; we never sell candidate data, and nothing reaches your public profile until you explicitly review and approve it.",
  },
  {
    q: "Can I use AI Tathastu as a beginner with no projects?",
    a: "Absolutely. Eiora begins by discovering your latent background and interests, then crafts step-by-step foundation projects so your very first lines of code turn into demonstrable portfolio evidence.",
  },
  {
    q: "How long does onboarding take, and do I have to finish all 11 steps at once?",
    a: "Onboarding takes approximately 3 to 5 minutes. You can pause or close the browser at any time—our optimistic locking and draft persistence automatically resume your progress right where you left off.",
  },
];

export function Landing({ user }: LandingProps) {
  // Storytelling sequence state (Phase A: 0 to 75 seconds)
  const [storyActive, setStoryActive] = useState(false);
  const [storyTime, setStoryTime] = useState(0); // in seconds
  const [storyPlaying, setStoryPlaying] = useState(true);
  const storyRafRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);

  // Phase B interactive hero state
  const [activePersona, setActivePersona] = useState<PersonaType>("builder");
  const [previewTab, setPreviewTab] = useState<PreviewTabId>("profile");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initialize or check if user has skipped intro before, with reduced-motion preference check
  useEffect(() => {
    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setStoryActive(false);
      return;
    }
    const viewed = typeof window !== "undefined" ? sessionStorage.getItem("aitathastu_story_viewed") : "true";
    if (!viewed && !user) {
      setStoryActive(true);
      sessionStorage.setItem("aitathastu_story_viewed", "true");
    }
  }, [user]);

  // Keyboard controls for storytelling (Escape to skip) and Mobile Menu (Escape to close)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (storyActive) {
          setStoryActive(false);
          sessionStorage.setItem("aitathastu_story_viewed", "true");
        }
        if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [storyActive, mobileMenuOpen]);

  // Cinematic 75s animation ticker
  useEffect(() => {
    if (!storyActive || !storyPlaying) return;

    const tick = (timestamp: number) => {
      if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
      const delta = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      setStoryTime((prev) => {
        const next = prev + delta;
        if (next >= 75) {
          setStoryActive(false);
          return 75;
        }
        return next;
      });

      storyRafRef.current = requestAnimationFrame(tick);
    };

    lastTimestampRef.current = performance.now();
    storyRafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(storyRafRef.current);
    };
  }, [storyActive, storyPlaying]);

  const handleSkipIntro = useCallback(() => {
    setStoryActive(false);
    sessionStorage.setItem("aitathastu_story_viewed", "true");
  }, []);

  const handleReplayIntro = useCallback(() => {
    setStoryTime(0);
    setStoryActive(true);
    setStoryPlaying(true);
  }, []);

  // Format MM:SS
  const formatStoryTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-[#F8F6F0] text-[#141413] selection:bg-[#D4AF37]/30 selection:text-[#141413]">
      {/* ============================================================
          PHASE A: 75-SECOND CINEMATIC STORYTELLING OVERLAY
          ============================================================ */}
      {storyActive && (
        <section
          aria-label="Storytelling experience"
          className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#F8F6F0] text-[#141413]"
        >
          {/* Top Bar: Progress & Skip Pill */}
          <div className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10">
            <div className="flex items-center gap-3">
              <span className="size-2.5 rounded-full bg-[#D4AF37] animate-pulse" />
              <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#5A5852]">
                Genesis of AI Tathastu · {formatStoryTime(storyTime)} / 01:15
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStoryPlaying((p) => !p)}
                className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-white/70 px-3 py-1.5 font-mono text-xs font-medium text-[#141413] backdrop-blur-md transition hover:bg-white"
                aria-label={storyPlaying ? "Pause storytelling" : "Play storytelling"}
              >
                {storyPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{storyPlaying ? "Pause" : "Resume"}</span>
              </button>

              <button
                type="button"
                onClick={handleSkipIntro}
                className="group flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#141413] px-4 py-1.5 font-sans text-xs font-semibold text-[#F8F6F0] shadow-md transition hover:bg-[#2B1D17]"
              >
                <span>Skip Intro</span>
                <X size={14} className="transition-transform group-hover:rotate-90" />
              </button>
            </div>
          </div>

          {/* Center Cinematic Stage */}
          <div className="relative flex flex-1 items-center justify-center px-6 text-center">
            {/* 00:00 - 00:08: Act I - The Singularity & Big Bang */}
            {storyTime < 8 && (
              <div className="flex flex-col items-center animate-[fade-in_1s_ease-out]">
                <div className="relative mb-8 size-8">
                  <span className="absolute inset-0 size-8 animate-ping rounded-full bg-[#D4AF37]/50" />
                  <span className="relative block size-8 rounded-full bg-[#D4AF37] shadow-[0_0_40px_#D4AF37]" />
                </div>
                <h2 className="font-editorial text-4xl sm:text-6xl italic font-normal tracking-tight text-[#141413]">
                  In the beginning, your evidence was scattered.
                </h2>
                <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[#5A5852]">
                  00:00 — 00:08 · The Digital Singularity
                </p>
              </div>
            )}

            {/* 00:08 - 00:20: Act II - The Birth of Eiora */}
            {storyTime >= 8 && storyTime < 20 && (
              <div className="flex flex-col items-center animate-[fade-in_1s_ease-out]">
                <div className="mb-6 scale-110">
                  <EioraVisual state="speaking" size={200} interactive={false} />
                </div>
                <h2 className="max-w-2xl font-editorial text-3xl sm:text-5xl font-normal leading-tight text-[#141413]">
                  &ldquo;Your digital footprint is scattered across a dozen worlds. Let’s bring your story home.&rdquo;
                </h2>
                <span className="mt-4 rounded-full border border-[#D4AF37]/35 bg-[#141413] px-3.5 py-1 font-mono text-2xs uppercase tracking-wider text-[#D4AF37]">
                  Eiora · Living AI Companion
                </span>
              </div>
            )}

            {/* 00:20 - 00:38: Act III - Onboarding Preview */}
            {storyTime >= 20 && storyTime < 38 && (
              <div className="flex flex-col items-center max-w-3xl animate-[fade-in_1s_ease-out]">
                <div className="mb-6 flex items-center gap-6">
                  <EioraVisual state="extracting" size={140} interactive={false} />
                  <div className="rounded-2xl border border-[#D4AF37]/30 bg-white/80 p-5 shadow-xl backdrop-blur-md text-left max-w-md">
                    <div className="flex items-center gap-2 font-mono text-xs text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
                      <Sparkle size={16} /> Extraction in Flight
                    </div>
                    <p className="mt-1 font-sans text-sm text-[#141413] font-medium">
                      Deconstructing CV, parsing GitHub commits, mapping LeetCode algorithms, and compiling ORCID citations…
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-2xs text-[#5A5852]">
                      <span className="rounded bg-[#FAF6F0] px-2 py-0.5 border border-[#EFECE6]">GitHub ✓</span>
                      <span className="rounded bg-[#FAF6F0] px-2 py-0.5 border border-[#EFECE6]">LinkedIn ✓</span>
                      <span className="rounded bg-[#FAF6F0] px-2 py-0.5 border border-[#EFECE6]">LeetCode ✓</span>
                      <span className="rounded bg-[#FAF6F0] px-2 py-0.5 border border-[#EFECE6]">ORCID ✓</span>
                    </div>
                  </div>
                </div>
                <h3 className="font-editorial text-3xl sm:text-4xl text-[#141413]">
                  No typing resume forms. Your work speaks for itself.
                </h3>
              </div>
            )}

            {/* 00:38 - 00:58: Act IV - The 5-World Ecosystem */}
            {storyTime >= 38 && storyTime < 58 && (
              <div className="flex flex-col items-center max-w-4xl animate-[fade-in_1s_ease-out]">
                <p className="font-mono text-2xs uppercase tracking-widest text-[#8A6D1C] dark:text-[#D4AF37] font-semibold mb-2">
                  Act IV · The 5-World Ecosystem
                </p>
                <h3 className="font-editorial text-3xl sm:text-5xl text-[#141413] mb-6">
                  One Unified Universe. Five Specialized Spheres.
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full">
                  {ECOSYSTEM_WORLDS.map((w) => {
                    const Icon = w.icon;
                    return (
                      <div
                        key={w.id}
                        className="rounded-xl border border-[#D4AF37]/25 bg-white/70 p-3.5 backdrop-blur-md shadow-sm transition hover:scale-105"
                      >
                        <div
                          className="size-8 rounded-lg flex items-center justify-center mb-2 mx-auto"
                          style={{ backgroundColor: `${w.color}20`, color: w.color }}
                        >
                          <Icon size={18} weight="bold" />
                        </div>
                        <h4 className="font-editorial text-lg font-bold text-[#141413]">{w.name}</h4>
                        <p className="text-2xs text-[#5A5852] mt-0.5 line-clamp-2">{w.tagline}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 00:58 - 01:15: Act V - The Synthesis */}
            {storyTime >= 58 && (
              <div className="flex flex-col items-center max-w-2xl animate-[fade-in_1s_ease-out]">
                <div className="mb-4">
                  <EioraVisual state="idle" size={130} interactive={false} />
                </div>
                <h2 className="font-editorial text-4xl sm:text-6xl text-[#141413] leading-tight">
                  Your journey is ready to begin.
                </h2>
                <p className="mt-3 text-sm sm:text-base text-[#5A5852] max-w-lg">
                  Welcome to the honest intelligence platform where your true capabilities are verified, celebrated, and elevated.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={handleSkipIntro}
                    className="flex items-center gap-2 rounded-full bg-[#141413] px-6 py-3 font-sans text-sm font-semibold text-[#F8F6F0] shadow-xl transition hover:bg-[#2B1D17]"
                  >
                    Enter Platform Now <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Progress Track */}
          <div className="relative z-20 w-full px-6 pb-6 sm:px-10">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EFECE6]">
              <div
                className="h-full bg-gradient-to-r from-[#D4AF37] via-[#E05A47] to-[#4CD3E3] transition-all duration-300"
                style={{ width: `${(storyTime / 75) * 100}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
          PHASE B: POST-STORYTELLING SCROLLABLE LANDING PAGE
          ============================================================ */}

      {/* 1. ARCHITECTURAL HEADER & RESPONSIVE NAVIGATION */}
      <header className="sticky top-0 z-40 border-b border-[#D4AF37]/15 bg-[#F8F6F0]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 group shrink min-w-0">
            <div className="size-8 rounded-lg bg-[#141413] flex items-center justify-center text-[#D4AF37] font-editorial text-lg font-bold group-hover:scale-105 transition-transform shadow-xs shrink-0">
              AT
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-editorial text-lg sm:text-xl font-bold tracking-tight text-[#141413] truncate">
                AI Tathastu
              </span>
              <span className="hidden sm:inline-block font-mono text-3xs uppercase tracking-widest text-[#5A5852] -mt-1 truncate">
                Warm Editorial Futurism
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 font-sans text-sm font-medium text-[#5A5852]">
            <a href="#ecosystem" className="hover:text-[#141413] transition-colors">Ecosystem</a>
            <a href="#preview" className="hover:text-[#141413] transition-colors">Product Preview</a>
            <a href="#visualizer" className="hover:text-[#141413] transition-colors">Skill Graph</a>
            <a href="#how-it-works" className="hover:text-[#141413] transition-colors">How It Works</a>
            <a href="#proof" className="hover:text-[#141413] transition-colors">Wall of Proof</a>
            <a href="#faq" className="hover:text-[#141413] transition-colors">FAQ</a>
            <button
              type="button"
              onClick={handleReplayIntro}
              className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] hover:underline"
            >
              Replay Intro ✦
            </button>
          </nav>

          {/* Action CTAs + Mobile Menu Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ThemeToggle compact />
            {user ? (
              <Link
                href="/student"
                className="flex items-center gap-1.5 rounded-full bg-[#141413] px-3.5 py-1.5 sm:px-4 sm:py-2 font-sans text-xs font-semibold text-[#F8F6F0] shadow-sm hover:bg-[#2B1D17] transition"
              >
                <span>Dashboard ({user.displayName?.split(" ")[0] || "Active"})</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="hidden sm:inline-block font-sans text-xs font-semibold text-[#141413] hover:text-[#D4AF37] transition px-2"
                >
                  Sign In
                </Link>
                <Link
                  href="/onboarding"
                  className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#141413] px-3.5 py-1.5 sm:px-4 sm:py-2 font-sans text-xs font-semibold text-[#F8F6F0] shadow-md hover:bg-[#2B1D17] transition"
                >
                  <span>Initialize Profile</span>
                  <ArrowRight size={14} />
                </Link>
              </>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="lg:hidden flex items-center justify-center size-9 rounded-lg border border-[#D4AF37]/30 bg-white/70 text-[#141413] hover:bg-white transition"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileMenuOpen ? <X size={20} /> : <List size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            id="mobile-nav-drawer"
            className="lg:hidden border-t border-[#D4AF37]/20 bg-[#F8F6F0]/95 backdrop-blur-xl px-4 py-5 shadow-2xl animate-[fade-in_0.2s_ease-out]"
          >
            <nav className="flex flex-col space-y-3 font-sans text-sm font-medium text-[#141413]">
              <a
                href="#ecosystem"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 px-3 rounded-lg hover:bg-white/80 transition"
              >
                Ecosystem
              </a>
              <a
                href="#preview"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 px-3 rounded-lg hover:bg-white/80 transition"
              >
                Product Experience Preview
              </a>
              <a
                href="#visualizer"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 px-3 rounded-lg hover:bg-white/80 transition"
              >
                Living Skill Graph
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 px-3 rounded-lg hover:bg-white/80 transition"
              >
                How It Works
              </a>
              <a
                href="#proof"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 px-3 rounded-lg hover:bg-white/80 transition"
              >
                Wall of Proof
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 px-3 rounded-lg hover:bg-white/80 transition"
              >
                Frequently Answered Questions
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleReplayIntro();
                }}
                className="text-left py-1.5 px-3 rounded-lg text-xs font-mono uppercase tracking-wider text-[#D4AF37] hover:bg-white/80 transition"
              >
                Watch Genesis Sequence ✦
              </button>
              {!user && (
                <div className="pt-3 border-t border-[#EFECE6] flex flex-col gap-2">
                  <Link
                    href="/sign-in"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 rounded-lg border border-[#D4AF37]/30 bg-white font-semibold text-xs text-[#141413]"
                  >
                    Sign In to Existing Profile
                  </Link>
                  <Link
                    href="/onboarding"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 rounded-lg bg-[#141413] text-[#F8F6F0] font-semibold text-xs shadow-md"
                  >
                    Initialize New Profile
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* 2. INTERACTIVE HERO WITH EIORA & LIVE PERSONA TOGGLES */}
      <section id="eora-landing-hero" data-eora-id="eora-landing-hero" className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Persona Segmented Pill Switcher */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-full border border-[#D4AF37]/30 bg-white/80 p-1 shadow-sm backdrop-blur-md">
              {(["builder", "researcher", "learner"] as PersonaType[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePersona(p)}
                  className={cn(
                    "rounded-full px-4 py-1.5 font-sans text-xs font-semibold capitalize transition-all duration-200",
                    activePersona === p
                      ? "bg-[#141413] text-[#F8F6F0] shadow-sm"
                      : "text-[#5A5852] hover:text-[#141413]"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Narrative Headline */}
            <div className="lg:col-span-7 flex flex-col items-start text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3.5 py-1 font-mono text-2xs uppercase tracking-wider text-[#D4AF37] font-semibold mb-4">
                <Sparkle size={14} weight="fill" />
                {PERSONA_CONFIG[activePersona].tag}
              </div>

              <h1 className="font-editorial text-4xl sm:text-6xl lg:text-7xl font-normal leading-[1.08] tracking-tight text-[#141413]">
                {PERSONA_CONFIG[activePersona].headline}
              </h1>

              <p className="mt-5 text-base sm:text-lg text-[#5A5852] leading-relaxed max-w-2xl font-sans">
                {PERSONA_CONFIG[activePersona].sub}
              </p>

              {/* Skills preview tags */}
              <div className="mt-6 flex flex-wrap gap-2 items-center">
                <span className="font-mono text-xs text-[#5A5852] mr-1">Signature Evidence:</span>
                {PERSONA_CONFIG[activePersona].skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-[#D4AF37]/25 bg-white/70 px-2.5 py-1 font-mono text-xs font-medium text-[#141413] shadow-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>

              {/* CTA Action Bar */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  id="eora-landing-cta"
                  data-eora-id="eora-landing-cta"
                  href={user ? "/student" : "/onboarding"}
                  className="flex items-center gap-2 rounded-full bg-[#141413] px-7 py-3.5 font-sans text-sm font-semibold text-[#F8F6F0] shadow-lg hover:bg-[#2B1D17] transition hover:scale-[1.02] active:scale-95"
                >
                  <span>{user ? "Continue Your Journey" : "Initialize Your Profile"}</span>
                  <ArrowRight size={18} />
                </Link>

                <button
                  type="button"
                  onClick={() => openEoraChat("Hi EORA! How do I get started with AI Tathastu?")}
                  className="flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-white/80 px-5 py-3.5 font-sans text-sm font-medium text-[#141413] shadow-sm backdrop-blur-md hover:bg-white transition"
                >
                  <Sparkle size={16} className="text-[#D4AF37]" weight="fill" />
                  <span>Ask EORA Live</span>
                </button>
              </div>

              {/* Micro-metric */}
              <p className="mt-4 font-mono text-2xs text-[#5A5852] flex items-center gap-2">
                <CheckCircle size={14} className="text-verified" weight="bold" />
                {PERSONA_CONFIG[activePersona].metric}
              </p>
            </div>

            {/* Right Column: Eiora 3D Companion Centerpiece */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="relative p-6 sm:p-8 rounded-3xl border border-[#D4AF37]/25 bg-white/60 backdrop-blur-md shadow-xl flex flex-col items-center w-full max-w-md">
                <EioraVisual
                  state="idle"
                  size={240}
                  speedMultiplier={1.1}
                  statusText="Eiora · Ready to inspect evidence"
                />

                <div className="mt-5 text-center">
                  <p className="font-editorial text-lg text-[#141413] italic">
                    &ldquo;Tap me or ask a question anytime. I guide your steps without generic noise.&rdquo;
                  </p>
                  <span className="inline-block mt-2 font-mono text-2xs text-[#8A6D1C] dark:text-[#D4AF37] uppercase tracking-wider font-semibold">
                    Universal Page Intelligence Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. VERIFIED TRUST & CREDIBILITY BAR */}
      <section className="border-y border-[#D4AF37]/15 bg-white/60 py-6 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-xs uppercase tracking-wider text-[#141413] font-bold">
                Supported Ecosystem Ingestion
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 font-mono text-xs text-[#5A5852]">
              {[
                "GitHub Repositories",
                "LinkedIn Experience",
                "Kaggle Benchmarks",
                "LeetCode Metrics",
                "HackerRank",
                "ORCID Citations",
                "Hugging Face",
              ].map((src) => (
                <span
                  key={src}
                  className="rounded-full border border-[#D4AF37]/20 bg-[#F8F6F0] px-3 py-1 font-medium text-[#141413] shadow-xs"
                >
                  {src}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 text-2xs font-mono text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
              <ShieldCheck size={16} weight="bold" className="text-emerald-600" />
              <span>DPDP Act 2023 Compliant</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE PROBLEM & THE TRANSFORMATION */}
      <section className="py-20 bg-[#F8F6F0]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <span className="font-mono text-xs uppercase tracking-widest text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
              The Paradigm Shift
            </span>
            <h2 className="font-editorial text-3xl sm:text-5xl font-normal text-[#141413] mt-1">
              From unverified resume claims to indisputable engineering proof.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5A5852]">
              Why traditional hiring is broken for ambitious builders, and how AI Tathastu replaces keyword matching with proof.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* The Broken Status Quo */}
            <div className="rounded-3xl border border-red-200/60 bg-red-50/20 p-8 shadow-xs flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 text-red-800 px-3 py-1 font-mono text-2xs font-bold uppercase tracking-wider mb-4">
                  The Broken Status Quo
                </div>
                <h3 className="font-editorial text-2xl font-bold text-[#141413] mb-3">
                  Scattered Resumes &amp; ATS Keyword Games
                </h3>
                <p className="text-sm text-[#5A5852] leading-relaxed mb-6">
                  Job portals and traditional platforms reward keyword stuffing rather than real technical execution. High-signal developers are lost in noise.
                </p>

                <ul className="space-y-3 font-sans text-xs sm:text-sm text-[#5A5852]">
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500 font-bold shrink-0">✕</span>
                    <span>Static PDF resumes with unverifiable claims and inflated buzzwords.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500 font-bold shrink-0">✕</span>
                    <span>Passive 50-hour video courses that produce zero demonstrable artifacts.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500 font-bold shrink-0">✕</span>
                    <span>Algorithmic ATS black holes filtering out non-pedigree candidates.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-red-200/40 font-mono text-2xs text-red-700">
                Result: 94% of engineering time wasted on credential signaling.
              </div>
            </div>

            {/* The AI Tathastu Standard */}
            <div className="rounded-3xl border border-[#D4AF37]/35 bg-white/80 p-8 shadow-md backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#141413] text-[#D4AF37] px-3 py-1 font-mono text-2xs font-bold uppercase tracking-wider mb-4 border border-[#D4AF37]/30">
                  <Sparkle size={12} weight="fill" />
                  The AI Tathastu Evidence Standard
                </div>
                <h3 className="font-editorial text-2xl font-bold text-[#141413] mb-3">
                  Automated Evidence Deconstruction &amp; Living Graphs
                </h3>
                <p className="text-sm text-[#5A5852] leading-relaxed mb-6">
                  We inspect your actual commits, PRs, mathematical citations, and code repositories to synthesize a cryptographic, verified capability ledger.
                </p>

                <ul className="space-y-3 font-sans text-xs sm:text-sm text-[#141413]">
                  <li className="flex items-start gap-2.5">
                    <Check size={18} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Code Provenance:</strong> Commits, architecture designs, and algorithms parsed with zero manual data entry.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={18} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>100% Student Control:</strong> Nothing is published until you review, edit, or confirm candidates.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={18} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Direct Matching:</strong> Hiring and squads matched on actual code depth rather than keyword filters.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-[#EFECE6] font-mono text-2xs text-[#8A6D1C] dark:text-[#D4AF37] font-semibold flex items-center justify-between">
                <span>Result: Unforgeable proof that speaks directly to engineering leads.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE PRODUCT EXPERIENCE PREVIEW */}
      <section id="preview" className="py-20 bg-[#EFECE6]/50 border-t border-[#D4AF37]/15">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="font-mono text-xs uppercase tracking-widest text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
              Live Product Experience
            </span>
            <h2 className="font-editorial text-3xl sm:text-5xl font-normal text-[#141413] mt-1">
              Explore the four core workspace modes.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5A5852]">
              Preview the actual user interface and information architecture that powers AI Tathastu students and researchers.
            </p>
          </div>

          {/* Interactive Mode Segmented Tabs */}
          <div role="tablist" aria-label="Product preview modes" className="flex flex-wrap gap-2 mb-8">
            {PREVIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                onClick={() => setPreviewTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 font-sans text-xs font-semibold transition-all shadow-xs border",
                  previewTab === tab.id
                    ? "bg-[#141413] text-[#F8F6F0] border-[#141413] shadow-md"
                    : "bg-white/80 text-[#5A5852] border-[#D4AF37]/25 hover:text-[#141413] hover:bg-white"
                )}
                aria-selected={previewTab === tab.id}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "font-mono text-3xs px-2 py-0.5 rounded-full",
                    previewTab === tab.id
                      ? "bg-[#D4AF37]/20 text-[#D4AF37]"
                      : "bg-[#EFECE6] text-[#5A5852]"
                  )}
                >
                  {tab.badge}
                </span>
              </button>
            ))}
          </div>

          {/* Tab Content Display Card */}
          <div className="rounded-3xl border border-[#D4AF37]/25 bg-white/85 p-6 sm:p-10 shadow-xl backdrop-blur-md">
            {/* View 1: Person 360 */}
            {previewTab === "profile" && (
              <div className="animate-[fade-in_0.3s_ease-out]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#EFECE6] gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-14 rounded-2xl bg-[#141413] text-[#D4AF37] font-editorial text-2xl font-bold flex items-center justify-center shadow-md">
                      AS
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-editorial text-xl sm:text-2xl font-bold text-[#141413]">
                          Aarav Sharma
                        </h4>
                        <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-3xs px-2 py-0.5 font-semibold">
                          Verified Candidate
                        </span>
                      </div>
                      <p className="font-mono text-xs text-[#5A5852]">
                        Target Objective: Lead AI/ML Infrastructure Engineer
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-mono text-2xs text-[#5A5852] block">Capability Score</span>
                      <span className="font-editorial text-2xl font-bold text-[#8A6D1C] dark:text-[#D4AF37]">94.2%</span>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mt-6">
                  <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-4">
                    <span className="font-mono text-3xs uppercase tracking-wider text-[#5A5852] font-semibold">Ingestion Provenance</span>
                    <p className="mt-2 text-sm font-semibold text-[#141413]">4 Sources Synchronized</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-3xs">
                      <span className="rounded bg-white px-2 py-0.5 border border-[#EFECE6]">GitHub (28 repos)</span>
                      <span className="rounded bg-white px-2 py-0.5 border border-[#EFECE6]">Kaggle (Top 8%)</span>
                      <span className="rounded bg-white px-2 py-0.5 border border-[#EFECE6]">ORCID (1 preprint)</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-4">
                    <span className="font-mono text-3xs uppercase tracking-wider text-[#5A5852] font-semibold">Signature Architecture</span>
                    <p className="mt-2 text-sm font-semibold text-[#141413]">vLLM Tensor-Parallel Serving</p>
                    <p className="mt-1 text-xs text-[#5A5852] line-clamp-2">
                      Benchmarked KV cache memory throughput on 8x A100 cluster with Triton custom kernels.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-4">
                    <span className="font-mono text-3xs uppercase tracking-wider text-[#5A5852] font-semibold">Opportunity Match</span>
                    <p className="mt-2 text-sm font-semibold text-[#141413]">3 Direct Avasar Shortlists</p>
                    <p className="mt-1 text-xs text-[#5A5852]">
                      Zero resume screening required; engineering teams requested architecture demo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* View 2: Skill Graph */}
            {previewTab === "skills" && (
              <div className="animate-[fade-in_0.3s_ease-out]">
                <div className="flex items-center justify-between pb-6 border-b border-[#EFECE6]">
                  <div>
                    <h4 className="font-editorial text-2xl font-bold text-[#141413]">
                      Evidence-Grounded Capability Ledger
                    </h4>
                    <p className="text-xs text-[#5A5852] mt-0.5">
                      Each skill node links to cryptographic commit hashes, PRs, or benchmark tables.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
                    18 Confirmed Skills · 0 Gaps
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {[
                    { skill: "PyTorch & CUDA", tier: "Verified", source: "3 Repos + 1 Benchmark", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                    { skill: "Distributed Training", tier: "Corroborated", source: "2 GitHub PRs", tone: "bg-amber-50 text-amber-800 border-amber-200" },
                    { skill: "Triton Kernels", tier: "Demonstrated", source: "1 Custom Op Commit", tone: "bg-blue-50 text-blue-800 border-blue-200" },
                    { skill: "Docker & Kubernetes", tier: "Verified", source: "CI/CD Pipeline Repo", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                  ].map((s) => (
                    <div key={s.skill} className="rounded-2xl border border-[#D4AF37]/20 bg-[#FAF8F5] p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn("font-mono text-3xs px-2 py-0.5 rounded-full font-semibold border", s.tone)}>
                            {s.tier}
                          </span>
                        </div>
                        <h5 className="font-sans text-sm font-bold text-[#141413]">{s.skill}</h5>
                      </div>
                      <p className="mt-3 font-mono text-3xs text-[#5A5852] border-t border-[#EFECE6] pt-2">
                        {s.source}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View 3: Project Ledger */}
            {previewTab === "projects" && (
              <div className="animate-[fade-in_0.3s_ease-out]">
                <div className="flex items-center justify-between pb-6 border-b border-[#EFECE6]">
                  <div>
                    <h4 className="font-editorial text-2xl font-bold text-[#141413]">
                      Verified Contribution Workspaces
                    </h4>
                    <p className="text-xs text-[#5A5852] mt-0.5">
                      Authorship deconstruction isolates your specific commits from generic group repos.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-text-muted">Filtered by Authorship Depth</span>
                </div>

                <div className="mt-6 rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-mono text-2xs uppercase tracking-wider text-[#D4AF37] font-semibold">Featured Repository</span>
                      <h5 className="font-sans text-base font-bold text-[#141413] mt-0.5">
                        deep-rag-engine / fast-vector-retriever
                      </h5>
                    </div>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-3xs px-2.5 py-1 font-semibold self-start sm:self-auto">
                      Authorship: 78.4% of total commits
                    </span>
                  </div>
                  <p className="mt-3 text-xs sm:text-sm text-[#5A5852] leading-relaxed">
                    Designed and benchmarked an asynchronous hybrid sparse-dense retriever combining BM25 and ColBERT embeddings. Reduced P99 query latency from 240ms to 42ms.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 font-mono text-3xs text-[#141413]">
                    <span className="rounded bg-white px-2.5 py-1 border border-[#EFECE6]">FastAPI</span>
                    <span className="rounded bg-white px-2.5 py-1 border border-[#EFECE6]">Qdrant Vector DB</span>
                    <span className="rounded bg-white px-2.5 py-1 border border-[#EFECE6]">PyTorch 2.4</span>
                    <span className="rounded bg-white px-2.5 py-1 border border-[#EFECE6]">Docker Swarm</span>
                  </div>
                </div>
              </div>
            )}

            {/* View 4: Adaptive Roadmap */}
            {previewTab === "roadmap" && (
              <div className="animate-[fade-in_0.3s_ease-out]">
                <div className="flex items-center justify-between pb-6 border-b border-[#EFECE6]">
                  <div>
                    <h4 className="font-editorial text-2xl font-bold text-[#141413]">
                      Precision Learning Bridge
                    </h4>
                    <p className="text-xs text-[#5A5852] mt-0.5">
                      Tailored project milestones to conquer remaining target role prerequisites.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
                    Target: MLOps Architect (4 of 5 Mastered)
                  </span>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 mt-6">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <span className="font-mono text-3xs text-emerald-800 font-bold uppercase">Milestone 1 · Completed</span>
                    <h5 className="font-sans text-sm font-bold text-[#141413] mt-1">Dockerized API Pipeline</h5>
                    <p className="text-2xs text-[#5A5852] mt-2">Verified via GitHub repository commits and multi-stage container build.</p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <span className="font-mono text-3xs text-emerald-800 font-bold uppercase">Milestone 2 · Completed</span>
                    <h5 className="font-sans text-sm font-bold text-[#141413] mt-1">Model Monitoring with Prometheus</h5>
                    <p className="text-2xs text-[#5A5852] mt-2">Verified via telemetry dashboard export and latency alarms.</p>
                  </div>

                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-4">
                    <span className="font-mono text-3xs text-[#8A6D1C] dark:text-[#D4AF37] font-bold uppercase">Milestone 3 · In Progress</span>
                    <h5 className="font-sans text-sm font-bold text-[#141413] mt-1">Distributed Ray Cluster Deployment</h5>
                    <p className="text-2xs text-[#5A5852] mt-2">Eiora interactive lab: launch local multi-node Ray actor pool.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6. THE 5-WORLD ECOSYSTEM BENTO GRID */}
      <section id="ecosystem" data-eora-id="eora-landing-features" className="py-20 border-t border-[#D4AF37]/15 bg-[#F8F6F0]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="font-mono text-xs uppercase tracking-widest text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
              The Architecture
            </span>
            <h2 className="font-editorial text-3xl sm:text-5xl font-normal text-[#141413] mt-1">
              Five interconnected worlds. Zero walled gardens.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5A5852]">
              Each world addresses a critical phase of the modern technologist&apos;s lifecycle—from learning and collaboration to interviews, integrity validation, and career placement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* World 1: Avasar (Double Column) */}
            <div className="md:col-span-2 rounded-2xl border border-[#D4AF37]/25 bg-white/80 p-8 shadow-sm backdrop-blur-md flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#141413] px-3 py-1 font-mono text-2xs uppercase tracking-wider text-[#D4AF37] font-semibold border border-[#D4AF37]/30">
                    <Briefcase size={14} weight="bold" />
                    Careers &amp; Opportunities
                  </span>
                  <span className="font-mono text-xs text-[#5A5852]">{ECOSYSTEM_WORLDS[0].stat}</span>
                </div>
                <h3 className="font-editorial text-3xl font-bold text-[#141413]">
                  Avasar by AI Tathastu
                </h3>
                <p className="mt-2 text-sm text-[#5A5852] leading-relaxed">
                  The evidence-first alternative to Naukri and Indeed. Instead of matching buzzwords on PDF resumes, Avasar evaluates candidates based on verified repositories, confirmed project milestones, and cryptographically signed skill assessments.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-[#EFECE6] flex items-center justify-between">
                <span className="font-mono text-xs text-[#5A5852]">Direct hiring pipelines without recruiter spam</span>
                <Link href="/student" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8A6D1C] dark:text-[#D4AF37] hover:underline">
                  Explore Avasar Roles <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* World 2: Collaborate */}
            <div className="rounded-2xl border border-[#D4AF37]/25 bg-white/80 p-8 shadow-sm backdrop-blur-md flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E05A47]/15 px-3 py-1 font-mono text-2xs uppercase tracking-wider text-[#E05A47] font-semibold">
                    <UsersThree size={14} weight="bold" />
                    Network &amp; Squads
                  </span>
                </div>
                <h3 className="font-editorial text-2xl font-bold text-[#141413]">
                  Collaborate by AI Tathastu
                </h3>
                <p className="mt-2 text-sm text-[#5A5852] leading-relaxed">
                  Professional networking stripped of vanity metrics. Connect with developers who complement your tech stack to co-build production-grade open source projects.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-[#EFECE6]">
                <Link href="/student/connections" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E05A47] hover:underline">
                  Find Squad Co-Builders <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* World 3: Learn */}
            <div className="rounded-2xl border border-[#D4AF37]/25 bg-white/80 p-8 shadow-sm backdrop-blur-md flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C48A5A]/15 px-3 py-1 font-mono text-2xs uppercase tracking-wider text-[#C48A5A] font-semibold">
                    <GraduationCap size={14} weight="bold" />
                    Curriculum
                  </span>
                </div>
                <h3 className="font-editorial text-2xl font-bold text-[#141413]">
                  Learn by AI Tathastu
                </h3>
                <p className="mt-2 text-sm text-[#5A5852] leading-relaxed">
                  Precision curricula mapped to your specific goal role. Every milestone builds a tangible repository item rather than a passive completion certificate.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-[#EFECE6]">
                <Link href="/student/roadmap" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C48A5A] hover:underline">
                  View Skill Roadmaps <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* World 4: Meet */}
            <div className="rounded-2xl border border-[#D4AF37]/25 bg-white/80 p-8 shadow-sm backdrop-blur-md flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4CD3E3]/15 px-3 py-1 font-mono text-2xs uppercase tracking-wider text-[#4CD3E3] font-semibold">
                    <VideoCamera size={14} weight="bold" />
                    Spatial Rooms
                  </span>
                </div>
                <h3 className="font-editorial text-2xl font-bold text-[#141413]">
                  Meet by AI Tathastu
                </h3>
                <p className="mt-2 text-sm text-[#5A5852] leading-relaxed">
                  Real-time video &amp; code collaboration rooms. Pair program directly with mentors, conduct architectural walk-throughs, and record verified interview demonstrations.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-[#EFECE6]">
                <Link href="/student/interviews" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4CD3E3] hover:underline">
                  Launch Collaboration Room <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* World 5: Iris */}
            <div className="rounded-2xl border border-[#D4AF37]/25 bg-white/80 p-8 shadow-sm backdrop-blur-md flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1948A]/15 px-3 py-1 font-mono text-2xs uppercase tracking-wider text-[#F1948A] font-semibold">
                    <Eye size={14} weight="bold" />
                    Proctored Integrity
                  </span>
                </div>
                <h3 className="font-editorial text-2xl font-bold text-[#141413]">
                  Iris by AI Tathastu
                </h3>
                <p className="mt-2 text-sm text-[#5A5852] leading-relaxed">
                  High-integrity AI proctoring that verifies genuine competency. Assesses reasoning paths, code comprehension, and algorithmic originality without invasive surveillance.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-[#EFECE6]">
                <Link href="/student/assessments" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F1948A] hover:underline">
                  Take Integrity Evaluation <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. HOW IT WORKS (4 UNDERSTANDABLE STAGES) */}
      <section id="how-it-works" className="py-20 bg-[#EFECE6]/40 border-t border-[#D4AF37]/15">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <span className="font-mono text-xs uppercase tracking-widest text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
              The Journey
            </span>
            <h2 className="font-editorial text-3xl sm:text-5xl font-normal text-[#141413] mt-1">
              Four steps from footprint to verified capability.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5A5852]">
              Honest, transparent, and structured. You keep complete ownership and review every claim before it goes public.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                stage: "Personalize",
                title: "Define Your Target Focus",
                desc: "Choose whether you are a builder, researcher, or learner. Select your dream AI role and top three priorities.",
              },
              {
                step: "02",
                stage: "Ingest",
                title: "Connect Footprints & CV",
                desc: "Drop your CV and optionally link GitHub, LinkedIn, Kaggle, or ORCID. Connectors are strictly read-only.",
              },
              {
                step: "03",
                stage: "Refine",
                title: "Review & Correct Claims",
                desc: "Eiora extracts candidate projects, skills, and publications. Edit, accept, or reject anything before saving.",
              },
              {
                step: "04",
                stage: "Activate",
                title: "Launch Tailored Workspace",
                desc: "Enter your dashboard with a living skill graph, personalized roadmap milestones, and direct opportunity matches.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-2xl border border-[#D4AF37]/25 bg-white/80 p-6 shadow-sm backdrop-blur-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-editorial text-3xl font-bold text-[#8A6D1C] dark:text-[#D4AF37]">{s.step}</span>
                    <span className="font-mono text-2xs uppercase tracking-wider text-[#5A5852] bg-[#F8F6F0] px-2.5 py-1 rounded-full border border-[#EFECE6]">
                      {s.stage}
                    </span>
                  </div>
                  <h3 className="font-editorial text-xl font-bold text-[#141413] mb-2">{s.title}</h3>
                  <p className="text-xs sm:text-sm text-[#5A5852] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. FOOTPRINT-TO-GRAPH VISUALIZER */}
      <section id="visualizer" className="py-20 bg-[#F8F6F0] border-t border-[#D4AF37]/15">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="font-mono text-xs uppercase tracking-widest text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
              The Evidence Engine
            </span>
            <h2 className="font-editorial text-3xl sm:text-5xl font-normal text-[#141413] mt-1">
              Raw footprints become a living skill graph.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5A5852]">
              Watch how isolated sources transform into unified, verified proof nodes that employers and mentors can audit.
            </p>
          </div>

          <div className="rounded-3xl border border-[#D4AF37]/25 bg-white/70 p-6 sm:p-10 shadow-lg backdrop-blur-md">
            <div className="grid lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Raw Ingestion Sources */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                <span className="font-mono text-2xs uppercase tracking-wider text-[#5A5852] font-semibold">
                  Raw Ingestion Connectors:
                </span>

                {[
                  { name: "GitHub Repositories", icon: Code, metric: "Commits, PRs & Architecture", tag: "Code" },
                  { name: "LinkedIn & Experience", icon: Briefcase, metric: "Roles, Tenures & Endorsements", tag: "History" },
                  { name: "LeetCode & HackerRank", icon: TerminalWindow, metric: "Problem Metrics & Rank", tag: "Algorithms" },
                  { name: "ORCID & ArXiv Papers", icon: FileText, metric: "Peer-Reviewed Publications", tag: "Research" },
                  { name: "Kaggle Competitions", icon: Cpu, metric: "Model Benchmarks & Datasets", tag: "ML" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-xl border border-[#EFECE6] bg-[#F8F6F0] px-4 py-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-[#141413] text-[#D4AF37] flex items-center justify-center">
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="font-sans text-xs font-semibold text-[#141413]">{item.name}</p>
                          <p className="font-mono text-3xs text-[#5A5852]">{item.metric}</p>
                        </div>
                      </div>
                      <span className="font-mono text-3xs rounded bg-[#EFECE6] px-2 py-0.5 text-[#141413]">
                        {item.tag}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Middle Column: Synthesis Core */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  <EioraVisual state="extracting" size={170} interactive={false} />
                </div>
                <h4 className="font-editorial text-2xl text-[#141413]">Eiora Corroboration Pipeline</h4>
                <p className="font-mono text-2xs text-[#5A5852] mt-1 max-w-xs">
                  Deterministic matching + multi-modal verification + cryptographic ledger timestamping.
                </p>
              </div>

              {/* Right Column: Resulting Skill Graph Nodes */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                <span className="font-mono text-2xs uppercase tracking-wider text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
                  Verified Capability Ledger:
                </span>

                {[
                  { skill: "PyTorch & Deep Learning", tier: "Verified", count: "3 Repos + 1 ArXiv", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                  { skill: "Distributed Training", tier: "Corroborated", count: "2 GitHub PRs", tone: "bg-amber-50 text-amber-800 border-amber-200" },
                  { skill: "Algorithms & Complexity", tier: "Demonstrated", count: "Top 4% LeetCode", tone: "bg-blue-50 text-blue-800 border-blue-200" },
                  { skill: "LLM Fine-Tuning & LoRA", tier: "Verified", count: "1 Published Notebook", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                ].map((s) => (
                  <div
                    key={s.skill}
                    className="flex items-center justify-between rounded-xl border border-[#D4AF37]/20 bg-[#FAF6F0] px-4 py-3"
                  >
                    <div>
                      <p className="font-sans text-xs font-bold text-[#141413]">{s.skill}</p>
                      <p className="font-mono text-3xs text-[#5A5852]">{s.count}</p>
                    </div>
                    <span className={cn("font-mono text-3xs px-2.5 py-0.5 rounded-full border font-semibold", s.tone)}>
                      {s.tier}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. EDITORIAL "WALL OF PROOF" TESTIMONIALS */}
      <section id="proof" className="py-20 bg-[#EFECE6]/40 border-t border-[#D4AF37]/15">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="font-mono text-xs uppercase tracking-widest text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
              Wall of Proof
            </span>
            <h2 className="font-editorial text-3xl sm:text-5xl font-normal text-[#141413] mt-1">
              Real capabilities. Real unlocked opportunities.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5A5852]">
              See how verified evidence replaced generic resumes for engineers and researchers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Aarav Sharma",
                role: "MLOps Engineer @ DeepScale",
                quote: "Before AI Tathastu, recruiters ignored my resume because I didn't have an IIT pedigree. Avasar verified my Dockerized Kubernetes pipeline directly from GitHub, and I had 3 direct interview invites within a week.",
                nodes: ["MLOps", "Kubernetes", "PyTorch"],
                source: "Matched via Avasar",
              },
              {
                name: "Dr. Priya Venkat",
                role: "Postdoc AI Researcher",
                quote: "Indexing my ArXiv preprints and Kaggle notebooks in one verified profile allowed me to collaborate with international research squads. Eiora made the onboarding synthesis effortless.",
                nodes: ["Diffusion Models", "Transformers", "ORCID"],
                source: "Squad via Collaborate",
              },
              {
                name: "Rohan Patel",
                role: "AI Foundations Graduate",
                quote: "The personalized roadmap didn't waste my time on videos I already understood. I built an end-to-end RAG assistant, Iris verified the architecture, and that became the centerpiece of my portfolio.",
                nodes: ["RAG Systems", "Vector DBs", "FastAPI"],
                source: "Graduated via Learn",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-[#D4AF37]/25 bg-white/80 p-6 shadow-sm backdrop-blur-md flex flex-col justify-between"
              >
                <div>
                  <p className="font-editorial text-base sm:text-lg italic text-[#141413] leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {t.nodes.map((n) => (
                      <span key={n} className="font-mono text-3xs rounded bg-[#FAF6F0] border border-[#EFECE6] px-2 py-0.5 text-[#5A5852]">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#EFECE6] flex items-center justify-between">
                  <div>
                    <h5 className="font-sans text-xs font-bold text-[#141413]">{t.name}</h5>
                    <p className="font-mono text-3xs text-[#5A5852]">{t.role}</p>
                  </div>
                  <span className="font-mono text-3xs text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">{t.source}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. FAQ ACCORDION */}
      <section id="faq" className="py-20 bg-[#F8F6F0] border-t border-[#D4AF37]/15">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="font-mono text-xs uppercase tracking-widest text-[#8A6D1C] dark:text-[#D4AF37] font-semibold">
              Clarifications
            </span>
            <h2 className="font-editorial text-3xl sm:text-5xl font-normal text-[#141413] mt-1">
              Frequently Answered Questions
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-[#D4AF37]/20 bg-white/70 overflow-hidden shadow-xs backdrop-blur-md transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between px-6 py-5 text-left font-sans text-sm sm:text-base font-semibold text-[#141413]"
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <span className="font-mono text-lg text-[#8A6D1C] dark:text-[#D4AF37]">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-[#5A5852] leading-relaxed border-t border-[#EFECE6] pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 11. FINAL MAGNETIC CALL TO ACTION */}
      <section className="py-20 bg-[#141413] text-[#F8F6F0] relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-1 font-mono text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-6">
            <RocketLaunch size={16} />
            Begin Your Verified Transformation
          </div>

          <h2 className="font-editorial text-4xl sm:text-6xl lg:text-7xl font-normal text-[#F8F6F0] leading-tight">
            You imagine. AI makes it happen.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[#FAF6F0]/70 max-w-2xl mx-auto font-sans leading-relaxed">
            Join thousands of developers, researchers, and students who have replaced guesswork with unforgeable evidence.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={user ? "/student" : "/onboarding"}
              className="flex items-center gap-2 rounded-full bg-[#D4AF37] px-8 py-4 font-sans text-sm font-bold text-[#141413] shadow-xl hover:bg-[#F5B041] transition hover:scale-105 active:scale-95"
            >
              <span>{user ? "Go to Dashboard" : "Initialize Your Profile Now"}</span>
              <ArrowRight size={18} />
            </Link>

            <button
              type="button"
              onClick={handleReplayIntro}
              className="flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-transparent px-6 py-4 font-sans text-sm font-semibold text-[#F8F6F0] hover:bg-white/10 transition"
            >
              <span>Watch Genesis Sequence</span>
            </button>
          </div>
        </div>
      </section>

      {/* 12. ARCHITECTURAL FOOTER */}
      <footer className="border-t border-[#D4AF37]/20 bg-[#141413] text-[#F8F6F0] pt-16 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-14">
            {/* Col 1: Brand & Mission */}
            <div className="sm:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="size-7 rounded-lg bg-[#D4AF37] text-[#141413] font-editorial text-lg font-bold flex items-center justify-center">
                  AT
                </span>
                <span className="font-editorial text-2xl font-bold text-[#F8F6F0]">AI Tathastu</span>
              </div>
              <p className="text-xs text-[#FAF6F0]/70 leading-relaxed max-w-sm mb-4">
                Warm Editorial Futurism for the next generation of artificial intelligence builders, scientists, and thinkers. All claims backed by real code and verifiable publications.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-2xs text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>All 5 Ecosystem Portals Operational</span>
              </div>
            </div>

            {/* Col 2: The 5 Worlds */}
            <div className="flex flex-col space-y-2.5">
              <h5 className="font-mono text-2xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">
                The 5 Worlds
              </h5>
              <Link href="/student" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Avasar (Jobs)</Link>
              <Link href="/student/connections" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Collaborate (Squads)</Link>
              <Link href="/student/roadmap" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Learn (Roadmaps)</Link>
              <Link href="/student/interviews" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Meet (Rooms)</Link>
              <Link href="/student/assessments" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Iris (Integrity)</Link>
            </div>

            {/* Col 3: Legal & DPDP Compliance */}
            <div className="flex flex-col space-y-2.5">
              <h5 className="font-mono text-2xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">
                Legal &amp; DPDP 2023
              </h5>
              <Link href="/privacy" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Privacy Policy</Link>
              <Link href="/terms" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Terms &amp; Conditions</Link>
              <Link href="/cookies" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Cookie Policy</Link>
              <Link href="/cookie-settings" className="text-xs text-[#D4AF37] hover:underline transition">Cookie Preferences</Link>
              <Link href="/privacy/your-rights" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Data Ownership Controls</Link>
            </div>

            {/* Col 4: Platform Status */}
            <div className="flex flex-col space-y-2.5">
              <h5 className="font-mono text-2xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">
                Verification &amp; Security
              </h5>
              <Link href="/security" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Security Practices</Link>
              <Link href="/evidence-policy" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Evidence Policy</Link>
              <Link href="/verification" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Verification Engine</Link>
              <Link href="/grievance" className="text-xs text-[#FAF6F0]/70 hover:text-[#F8F6F0] transition">Grievance Redressal</Link>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[#FAF6F0]/50">
            <p>© {new Date().getFullYear()} AI Tathastu platform. Zero unverified claims.</p>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition">Terms</Link>
              <Link href="/security" className="hover:text-white transition">Security</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
