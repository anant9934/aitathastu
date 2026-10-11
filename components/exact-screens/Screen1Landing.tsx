"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Play,
  X,
  User,
  Users,
  Briefcase,
  Award,
  Sparkles,
  ChevronDown,
  BrainCircuit,
  Compass,
  FileCheck2,
} from "lucide-react";
import {
  SpotlightCard,
  TextShimmer,
  GlowingBadge,
  SpringButton,
} from "@/components/ui/motion-primitives";

interface Screen1LandingProps {
  onStartJourney?: () => void;
}

export function Screen1Landing({ onStartJourney }: Screen1LandingProps) {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleEoraClick = () => {
    const tips = [
      "EORA says: Review your resume and project evidence before adding it to your profile.",
      "EORA says: Connect a public GitHub profile only when you want to include its projects.",
      "EORA says: Set an AI/ML goal to see the next steps in your roadmap.",
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    setToastMessage(tip);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const faqs = [
    {
      q: "What makes AI Tathastu different from a standard learning portal?",
      a: "Tathastu helps you review resume and public GitHub evidence, build a Person 360 profile, and plan the next steps toward an AI/ML goal. Imported claims remain reviewable until you confirm them."
    },
    {
      q: "Who is EORA?",
      a: "EORA is your dedicated intelligent AI companion. She guides your onboarding, reviews your project evidence, highlights gaps in your roadmap, and suggests the next highest-impact actions."
    },
    {
      q: "How does project verification work?",
      a: "You review imported projects and describe your own contribution. A repository link or AI interpretation does not automatically verify a project or award a badge."
    },
    {
      q: "Are my academic and GitHub details kept private?",
      a: "Resume and GitHub import are optional. The app asks for your consent before AI interpretation, and you can disconnect a GitHub connection from your account settings."
    }
  ];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        backgroundColor: "#050A1B",
        color: "#FFFFFF",
        overflowX: "hidden",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Ambient atmospheric glows */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: `
            radial-gradient(circle at 72% 35%, rgba(2, 197, 245, 0.16) 0%, rgba(147, 53, 232, 0.12) 32%, rgba(5, 10, 27, 0) 65%),
            radial-gradient(circle at 20% 25%, rgba(69, 100, 255, 0.09) 0%, rgba(5, 10, 27, 0) 50%),
            radial-gradient(circle at 50% 85%, rgba(2, 197, 245, 0.06) 0%, rgba(5, 10, 27, 0) 40%)
          `,
        }}
      />

      {/* 1. TOP NAVIGATION */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          width: "100%",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          backgroundColor: "rgba(5, 10, 27, 0.85)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "16px 36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Brand Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <div style={{ position: "relative", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="38" height="38" viewBox="0 0 100 100" fill="none" style={{ filter: "drop-shadow(0 0 14px rgba(2, 197, 245, 0.7))" }}>
                <defs>
                  <linearGradient id="logoLoopGrad" x1="18" y1="20" x2="82" y2="80" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#02C5F5" />
                    <stop offset="50%" stopColor="#4564FF" />
                    <stop offset="100%" stopColor="#9335E8" />
                  </linearGradient>
                </defs>
                <path
                  d="M 50 20 L 82 74 A 6 6 0 0 1 76 82 L 24 82 A 6 6 0 0 1 18 74 Z"
                  stroke="url(#logoLoopGrad)"
                  strokeWidth="9"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="rgba(69, 100, 255, 0.15)"
                />
                <circle cx="50" cy="20" r="9" fill="#02C5F5" />
                <circle cx="82" cy="74" r="9" fill="#9335E8" />
                <circle cx="18" cy="74" r="9" fill="#4564FF" />
                <circle cx="50" cy="56" r="5" fill="#FFFFFF" opacity="0.6" />
              </svg>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF" }}>
              AITathastu
            </span>
          </Link>

          {/* Center Nav Links */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
              fontSize: 14,
              fontWeight: 500,
              color: "#CBD5E1",
            }}
          >
            <Link href="#about" style={{ color: "#CBD5E1", textDecoration: "none", transition: "color 0.15s" }}>
              Products
            </Link>
            <Link href="#ecosystem" style={{ color: "#CBD5E1", textDecoration: "none", transition: "color 0.15s" }}>
              For Students
            </Link>
            <Link href="#ecosystem" style={{ color: "#CBD5E1", textDecoration: "none", transition: "color 0.15s" }}>
              For Faculty
            </Link>
            <Link href="#ecosystem" style={{ color: "#CBD5E1", textDecoration: "none", transition: "color 0.15s" }}>
              For Professionals
            </Link>
            <Link href="#faq" style={{ color: "#CBD5E1", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <span>Resources</span>
              <span style={{ color: "#94A3B8" }}>⟶</span>
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              href="/sign-in"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                borderRadius: 9999,
                padding: "8px 22px",
                textDecoration: "none",
                transition: "all 0.15s ease",
                background: "rgba(255, 255, 255, 0.05)",
              }}
            >
              Login
            </Link>
            <SpringButton variant="primary" onClick={onStartJourney} style={{ padding: "9px 24px", fontSize: 14 }}>
              Get Started
            </SpringButton>
          </div>
        </div>
      </header>

      {/* =========================================================================
          SECTION A: HERO VIEWPORT
          ========================================================================= */}
      <section
        data-eora-id="eora-landing-hero"
        style={{
          position: "relative",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 2. HERO MAIN CONTENT */}
        <div
          style={{
            position: "relative",
            zIndex: 20,
            width: "100%",
            maxWidth: 1440,
            margin: "0 auto",
            padding: "48px 36px 28px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "1.15fr 0.85fr",
              gap: 48,
              alignItems: "center",
            }}
          >
            {/* Left Column: Headlines, Description & CTAs */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", zIndex: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <GlowingBadge color="cyan" icon={<Sparkles size={14} />}>
                  AI-Powered Unified Intelligence
                </GlowingBadge>
              </div>

              <h1
                style={{
                  fontSize: "clamp(38px, 4.6vw, 66px)",
                  fontWeight: 800,
                  lineHeight: 1.08,
                  letterSpacing: "-0.035em",
                  marginBottom: 16,
                  color: "#FFFFFF",
                }}
              >
                <span style={{ display: "block" }}>Your Dreams.</span>
                <span style={{ display: "block" }}>Our Intelligence.</span>
                <span style={{ display: "block", marginTop: 4 }}>
                  <TextShimmer>Tathastu.</TextShimmer>
                </span>
              </h1>

              <p
                style={{
                  color: "#94A3B8",
                  fontSize: "clamp(15px, 1.4vw, 18px)",
                  maxWidth: 460,
                  marginBottom: 34,
                  lineHeight: 1.6,
                  fontWeight: 400,
                }}
              >
                Build your Person 360 profile from reviewed evidence, explore your AI/ML roadmap, and ask EORA about your next step.
              </p>

              {/* CTA Buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
                <SpringButton
                  variant="primary"
                  onClick={onStartJourney}
                  icon={<ArrowRight size={18} />}
                  style={{ padding: "14px 34px", fontSize: 15 }}
                >
                  Get Started
                </SpringButton>

                <SpringButton
                  variant="secondary"
                  onClick={() => setShowVideoModal(true)}
                  icon={<Play size={11} fill="currentColor" />}
                  style={{ padding: "14px 28px", fontSize: 15 }}
                >
                  Watch Video
                </SpringButton>
              </div>
            </div>

            {/* Right Column: EORA Mascot & Ambient Halos */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                height: "100%",
                minHeight: 480,
              }}
            >
              {/* Holographic Orbital Rings behind EORA */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%) rotate(-15deg)",
                  width: 500,
                  height: 360,
                  borderRadius: "100%",
                  border: "1px solid rgba(2, 197, 245, 0.25)",
                  boxShadow: "0 0 50px rgba(2, 197, 245, 0.15)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%) rotate(-25deg)",
                  width: 580,
                  height: 420,
                  borderRadius: "100%",
                  border: "1px solid rgba(147, 53, 232, 0.2)",
                  pointerEvents: "none",
                }}
              />

              {/* The Unified EORA Mascot */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 460,
                  height: 480,
                  zIndex: 10,
                }}
              >
                <Image
                  src="/assets/eora/welcome-hand.png"
                  alt="EORA - AI Companion"
                  fill
                  sizes="(max-width: 768px) 100vw, 460px"
                  style={{ objectFit: "contain", objectPosition: "bottom" }}
                  onClick={handleEoraClick}
                  priority
                />
              </div>

              {/* Speech Bubble with Tasteful Glass Surface — Positioned top-left away from EORA's face */}
              <div
                onClick={handleEoraClick}
                title="Click to interact with EORA"
                style={{
                  position: "absolute",
                  top: "2%",
                  left: "-10px",
                  zIndex: 20,
                  background: "rgba(10, 16, 38, 0.94)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(2, 197, 245, 0.4)",
                  borderRadius: 18,
                  padding: "14px 18px",
                  boxShadow: "0 15px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(2, 197, 245, 0.2)",
                  maxWidth: 220,
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Sparkles size={14} color="#02C5F5" />
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
                    Hi! I&apos;m EORA
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: "#CBD5E1", margin: 0, lineHeight: 1.45 }}>
                  Let&apos;s explore your possibilities together.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. BOTTOM STATS BAR WITH SPOTLIGHT CARDS */}
        <footer
          style={{
            position: "relative",
            zIndex: 20,
            width: "100%",
            maxWidth: 1440,
            margin: "0 auto",
            padding: "0 36px 32px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 18,
            }}
          >
            {/* Core capability 1 */}
            <SpotlightCard
              spotlightColor="rgba(2, 197, 245, 0.2)"
              borderColor="rgba(2, 197, 245, 0.18)"
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid rgba(2, 197, 245, 0.35)",
                  background: "rgba(2, 197, 245, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#02C5F5",
                  flexShrink: 0,
                }}
              >
                <User size={22} />
              </div>
              <div>
                <div style={{ color: "#94A3B8", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Your profile</div>
                <div style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 800 }}>Person 360</div>
              </div>
            </SpotlightCard>

            {/* Core capability 2 */}
            <SpotlightCard
              spotlightColor="rgba(147, 53, 232, 0.2)"
              borderColor="rgba(147, 53, 232, 0.18)"
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid rgba(147, 53, 232, 0.35)",
                  background: "rgba(147, 53, 232, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9335E8",
                  flexShrink: 0,
                }}
              >
                <Users size={22} />
              </div>
              <div>
                <div style={{ color: "#94A3B8", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Your sources</div>
                <div style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 800 }}>Opt in</div>
              </div>
            </SpotlightCard>

            {/* Core capability 3 */}
            <SpotlightCard
              spotlightColor="rgba(69, 100, 255, 0.2)"
              borderColor="rgba(69, 100, 255, 0.18)"
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid rgba(69, 100, 255, 0.35)",
                  background: "rgba(69, 100, 255, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4564FF",
                  flexShrink: 0,
                }}
              >
                <Briefcase size={22} />
              </div>
              <div>
                <div style={{ color: "#94A3B8", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Your evidence</div>
                <div style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 800 }}>Review</div>
              </div>
            </SpotlightCard>

            {/* Core capability 4 */}
            <SpotlightCard
              spotlightColor="rgba(16, 185, 129, 0.2)"
              borderColor="rgba(16, 185, 129, 0.18)"
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  background: "rgba(16, 185, 129, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10B981",
                  flexShrink: 0,
                }}
              >
                <Award size={22} />
              </div>
              <div>
                <div style={{ color: "#94A3B8", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Your roadmap</div>
                <div style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 800 }}>AI/ML</div>
              </div>
            </SpotlightCard>
          </div>
        </footer>
      </section>

      {/* =========================================================================
          SECTION B: SCROLL SECTIONS
          ========================================================================= */}
      
      {/* 1. What AI Tathastu Does */}
      <section id="about" style={{ position: "relative", zIndex: 10, padding: "90px 36px", maxWidth: 1280, margin: "0 auto", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 52px" }}>
          <GlowingBadge color="cyan">Intelligent Platform Overview</GlowingBadge>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 800, color: "#FFFFFF", marginTop: 18, marginBottom: 16, letterSpacing: "-0.025em" }}>
            Bridging Potential to Real Industry Readiness
          </h2>
          <p style={{ color: "#94A3B8", fontSize: 16.5, lineHeight: 1.6 }}>
            AI Tathastu combines the information you choose to share with your reviewed skills and projects to build a Person 360 profile.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 28 }}>
          <SpotlightCard spotlightColor="rgba(2, 197, 245, 0.18)" style={{ padding: 34 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(2, 197, 245, 0.1)", border: "1px solid rgba(2, 197, 245, 0.3)", color: "#02C5F5", display: "grid", placeItems: "center", marginBottom: 22 }}>
              <BrainCircuit size={26} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 700, color: "#FFFFFF", marginBottom: 10 }}>AI Context Understanding</h3>
            <p style={{ color: "#94A3B8", fontSize: 14.5, lineHeight: 1.65, margin: 0 }}>
              Interprets approved resume text and public project documentation into claims you can inspect, correct, or reject.
            </p>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(147, 53, 232, 0.18)" style={{ padding: 34 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(147, 53, 232, 0.1)", border: "1px solid rgba(147, 53, 232, 0.3)", color: "#9335E8", display: "grid", placeItems: "center", marginBottom: 22 }}>
              <FileCheck2 size={26} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 700, color: "#FFFFFF", marginBottom: 10 }}>Defensive Verification</h3>
            <p style={{ color: "#94A3B8", fontSize: 14.5, lineHeight: 1.65, margin: 0 }}>
              Keeps the source of each imported claim visible and distinguishes your own statements from independently verified evidence.
            </p>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(69, 100, 255, 0.18)" style={{ padding: 34 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(69, 100, 255, 0.1)", border: "1px solid rgba(69, 100, 255, 0.3)", color: "#4564FF", display: "grid", placeItems: "center", marginBottom: 22 }}>
              <Compass size={26} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 700, color: "#FFFFFF", marginBottom: 10 }}>Targeted Career Roadmaps</h3>
            <p style={{ color: "#94A3B8", fontSize: 14.5, lineHeight: 1.65, margin: 0 }}>
              See recommended steps for your selected AI/ML role, with progress tied to evidence in your profile.
            </p>
          </SpotlightCard>
        </div>
      </section>

      {/* 2. One Intelligent Ecosystem for 5 Stakeholders */}
      <section id="ecosystem" data-eora-id="eora-landing-features" style={{ position: "relative", zIndex: 10, padding: "90px 36px", maxWidth: 1280, margin: "0 auto", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 52px" }}>
          <GlowingBadge color="violet">One Intelligent Ecosystem</GlowingBadge>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 800, color: "#FFFFFF", marginTop: 18, marginBottom: 16, letterSpacing: "-0.025em" }}>
            One Intelligent Ecosystem. Built for Everyone.
          </h2>
          <p style={{ color: "#94A3B8", fontSize: 16.5, lineHeight: 1.6 }}>
            AITathastu connects people, skills, knowledge, and opportunities through AI — helping every stakeholder discover, grow, connect, and create impact.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 24 }}>
          {/* 1. For Students */}
          <SpotlightCard spotlightColor="rgba(2, 197, 245, 0.22)" borderColor="rgba(2, 197, 245, 0.28)" style={{ padding: 30, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#38BDF8", background: "rgba(2, 197, 245, 0.12)", border: "1px solid rgba(2, 197, 245, 0.3)", padding: "4px 12px", borderRadius: 9999, letterSpacing: "0.04em" }}>Learners</span>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(2, 197, 245, 0.12)", display: "grid", placeItems: "center", color: "#38BDF8" }}>
                  <User size={18} />
                </div>
              </div>
              <h3 style={{ fontSize: 21, fontWeight: 700, color: "#FFFFFF", margin: "0 0 8px" }}>For Students</h3>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: "#38BDF8", margin: "0 0 10px" }}>Discover your potential. Build your future.</p>
              <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 24px" }}>
                Build a profile from reviewed evidence, showcase your projects, and see what to learn next for your selected AI/ML goal.
              </p>
            </div>
            <button type="button" onClick={onStartJourney} style={{ background: "none", border: "none", color: "#38BDF8", fontWeight: 700, fontSize: 14.5, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: 0 }}>
              <span>Explore Student Experience</span>
              <ArrowRight size={16} />
            </button>
          </SpotlightCard>

          {/* 2. For Faculty */}
          <SpotlightCard spotlightColor="rgba(168, 85, 247, 0.22)" borderColor="rgba(168, 85, 247, 0.28)" style={{ padding: 30, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#C084FC", background: "rgba(168, 85, 247, 0.12)", border: "1px solid rgba(168, 85, 247, 0.3)", padding: "4px 12px", borderRadius: 9999, letterSpacing: "0.04em" }}>Academics</span>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(168, 85, 247, 0.12)", display: "grid", placeItems: "center", color: "#C084FC" }}>
                  <Award size={18} />
                </div>
              </div>
              <h3 style={{ fontSize: 21, fontWeight: 700, color: "#FFFFFF", margin: "0 0 8px" }}>For Faculty</h3>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: "#C084FC", margin: "0 0 10px" }}>Share knowledge. Mentor talent. Create impact.</p>
              <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 24px" }}>
                Showcase your expertise and research, mentor students, collaborate on projects, discover promising talent, and connect learning with real-world opportunities.
              </p>
            </div>
            <Link href="/faculty/verification" style={{ color: "#C084FC", fontWeight: 700, fontSize: 14.5, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
              <span>Explore Faculty Experience</span>
              <ArrowRight size={16} />
            </Link>
          </SpotlightCard>

          {/* 3. For Mentors */}
          <SpotlightCard spotlightColor="rgba(59, 130, 246, 0.22)" borderColor="rgba(59, 130, 246, 0.28)" style={{ padding: 30, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#60A5FA", background: "rgba(59, 130, 246, 0.12)", border: "1px solid rgba(59, 130, 246, 0.3)", padding: "4px 12px", borderRadius: 9999, letterSpacing: "0.04em" }}>Guidance</span>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(59, 130, 246, 0.12)", display: "grid", placeItems: "center", color: "#60A5FA" }}>
                  <Users size={18} />
                </div>
              </div>
              <h3 style={{ fontSize: 21, fontWeight: 700, color: "#FFFFFF", margin: "0 0 8px" }}>For Mentors</h3>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: "#60A5FA", margin: "0 0 10px" }}>Your experience can shape someone’s journey.</p>
              <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 24px" }}>
                Connect with learners who need your expertise, provide personalized guidance, review projects, conduct mock interviews, and help them move forward with confidence.
              </p>
            </div>
            <button type="button" onClick={onStartJourney} style={{ background: "none", border: "none", color: "#60A5FA", fontWeight: 700, fontSize: 14.5, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: 0 }}>
              <span>Become a Mentor</span>
              <ArrowRight size={16} />
            </button>
          </SpotlightCard>

          {/* 4. For Alumni & Professionals */}
          <SpotlightCard spotlightColor="rgba(245, 158, 11, 0.22)" borderColor="rgba(245, 158, 11, 0.28)" style={{ padding: 30, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#FBBF24", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "4px 12px", borderRadius: 9999, letterSpacing: "0.04em" }}>Network</span>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245, 158, 11, 0.12)", display: "grid", placeItems: "center", color: "#FBBF24" }}>
                  <Sparkles size={18} />
                </div>
              </div>
              <h3 style={{ fontSize: 21, fontWeight: 700, color: "#FFFFFF", margin: "0 0 8px" }}>For Alumni & Professionals</h3>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: "#FBBF24", margin: "0 0 10px" }}>Turn your journey into someone else’s opportunity.</p>
              <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 24px" }}>
                Share your experience, mentor emerging talent, build meaningful connections, collaborate on projects, and discover opportunities aligned with your expertise.
              </p>
            </div>
            <button type="button" onClick={onStartJourney} style={{ background: "none", border: "none", color: "#FBBF24", fontWeight: 700, fontSize: 14.5, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: 0 }}>
              <span>Join the Network</span>
              <ArrowRight size={16} />
            </button>
          </SpotlightCard>

          {/* 5. For Organizations */}
          <SpotlightCard spotlightColor="rgba(16, 185, 129, 0.22)" borderColor="rgba(16, 185, 129, 0.28)" style={{ padding: 30, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#34D399", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "4px 12px", borderRadius: 9999, letterSpacing: "0.04em" }}>Industry & Hiring</span>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", display: "grid", placeItems: "center", color: "#34D399" }}>
                  <Briefcase size={18} />
                </div>
              </div>
              <h3 style={{ fontSize: 21, fontWeight: 700, color: "#FFFFFF", margin: "0 0 8px" }}>For Organizations</h3>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: "#34D399", margin: "0 0 10px" }}>Discover talent beyond the resume.</p>
              <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 24px" }}>
                Find people through demonstrated skills, projects, achievements, interests, and capabilities — and connect with the right talent for jobs, internships, projects, and collaboration.
              </p>
            </div>
            <button type="button" onClick={onStartJourney} style={{ background: "none", border: "none", color: "#34D399", fontWeight: 700, fontSize: 14.5, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: 0 }}>
              <span>Discover Talent</span>
              <ArrowRight size={16} />
            </button>
          </SpotlightCard>
        </div>
      </section>

      {/* 3. FAQ Section */}
      <section id="faq" style={{ position: "relative", zIndex: 10, padding: "90px 36px", maxWidth: 940, margin: "0 auto", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <GlowingBadge color="cyan">Got Questions?</GlowingBadge>
          <h2 style={{ fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 800, color: "#FFFFFF", marginTop: 16, marginBottom: 12 }}>
            Frequently Asked Questions
          </h2>
          <p style={{ color: "#94A3B8", fontSize: 15.5 }}>
            Everything you need to know about the AI Tathastu ecosystem.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                style={{
                  background: "rgba(8, 14, 36, 0.85)",
                  backdropFilter: "blur(12px)",
                  border: isOpen ? "1px solid rgba(2, 197, 245, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: isOpen ? "0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(2, 197, 245, 0.1)" : "none",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  style={{
                    width: "100%",
                    padding: "20px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "none",
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: 15.5,
                    fontWeight: 700,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={20}
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                      color: isOpen ? "#02C5F5" : "#94A3B8",
                      flexShrink: 0,
                    }}
                  />
                </button>
                {isOpen && (
                  <div style={{ padding: "0 24px 20px", color: "#94A3B8", fontSize: 14.5, lineHeight: 1.65, borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: 14 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Final CTA & Footer */}
      <section data-eora-id="eora-landing-cta" style={{ position: "relative", zIndex: 10, padding: "70px 36px 80px", maxWidth: 1280, margin: "0 auto", borderTop: "1px solid rgba(255, 255, 255, 0.08)", textAlign: "center" }}>
        <div
          style={{
            position: "relative",
            padding: "54px 36px",
            borderRadius: 26,
            background: "linear-gradient(180deg, #0B1230 0%, #040818 100%)",
            border: "1px solid rgba(2, 197, 245, 0.35)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(2, 197, 245, 0.15)",
          }}
        >
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 800, color: "#FFFFFF", marginBottom: 14 }}>
            Ready to shape your future with intelligence?
          </h2>
          <p style={{ color: "#94A3B8", fontSize: 16.5, maxWidth: 600, margin: "0 auto 32px" }}>
            Start with your own goals, review the evidence you add, and use your roadmap to plan the next step.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <SpringButton
              variant="primary"
              onClick={onStartJourney}
              style={{ padding: "14px 36px", fontSize: 15 }}
            >
              Get Started for Free →
            </SpringButton>

            <Link
              href="/sign-in"
              style={{
                padding: "14px 28px",
                borderRadius: 9999,
                border: "1px solid rgba(255, 255, 255, 0.2)",
                background: "rgba(255, 255, 255, 0.06)",
                backdropFilter: "blur(8px)",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              Sign In to Your Workspace
            </Link>
          </div>
        </div>

        <footer style={{ marginTop: 44, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748B", gap: 16 }}>
          <div>© {new Date().getFullYear()} AI Tathastu. Built with precision for students & educators.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Link href="#about" style={{ color: "#94A3B8", textDecoration: "none" }}>About</Link>
            <Link href="#ecosystem" style={{ color: "#94A3B8", textDecoration: "none" }}>Ecosystem</Link>
            <Link href="#faq" style={{ color: "#94A3B8", textDecoration: "none" }}>FAQ</Link>
            <Link href="/sign-in" style={{ color: "#94A3B8", textDecoration: "none" }}>Login</Link>
          </div>
        </footer>
      </section>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 50,
            background: "rgba(12, 18, 38, 0.95)",
            border: "1px solid rgba(2, 197, 245, 0.4)",
            color: "#E0F2FE",
            padding: "13px 22px",
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            backdropFilter: "blur(14px)",
            fontSize: 13.5,
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: 420,
          }}
        >
          <Sparkles size={16} color="#02C5F5" style={{ flexShrink: 0 }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* VIDEO PREVIEW MODAL */}
      {showVideoModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(10px)",
            padding: 16,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 700,
              background: "#090F20",
              border: "1px solid rgba(2, 197, 245, 0.35)",
              borderRadius: 22,
              padding: 26,
              boxShadow: "0 25px 50px rgba(0,0,0,0.8), 0 0 30px rgba(2, 197, 245, 0.15)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowVideoModal(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                color: "#94A3B8",
                background: "rgba(255, 255, 255, 0.06)",
                border: "none",
                borderRadius: "50%",
                padding: 6,
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(2, 197, 245, 0.2)", color: "#02C5F5", display: "grid", placeItems: "center" }}>
                <Play size={16} fill="currentColor" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Experience AI Tathastu</h3>
                <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>Transforming educational potential into realized careers</p>
              </div>
            </div>

            <div
              style={{
                aspectRatio: "16 / 9",
                borderRadius: 16,
                background: "#050A1B",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "linear-gradient(110deg, #02C5F5 0%, #4564FF 48%, #9335E8 100%)",
                  display: "grid",
                  placeItems: "center",
                  color: "#FFFFFF",
                  boxShadow: "0 0 25px rgba(2, 197, 245, 0.5)",
                  marginBottom: 16,
                  cursor: "pointer",
                }}
              >
                <Play size={22} fill="white" style={{ marginLeft: 2 }} />
              </div>
              <h4 style={{ fontSize: 17, fontWeight: 700, color: "#FFFFFF", margin: "0 0 6px" }}>Watch Platform Walkthrough</h4>
              <p style={{ color: "#94A3B8", fontSize: 13, maxWidth: 440, margin: "0 0 18px" }}>
                Explore how Tathastu reviews your evidence, builds a Person 360 profile, and suggests AI/ML roadmap steps.
              </p>
              <SpringButton
                variant="primary"
                onClick={() => {
                  setShowVideoModal(false);
                  onStartJourney?.();
                }}
                style={{ padding: "8px 22px", fontSize: 13 }}
              >
                Skip to Interactive Onboarding →
              </SpringButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
