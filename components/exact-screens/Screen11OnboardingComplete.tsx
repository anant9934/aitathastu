"use client";

import React from "react";
import Image from "next/image";
import { ArrowRight, Sparkles, ShieldCheck, Compass, Briefcase, Bot, CheckCircle2 } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";

export interface Screen11OnboardingCompleteProps {
  studentName?: string;
  onGoToDashboard: () => void;
  onExploreOpportunities?: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

const milestones = [
  {
    icon: Bot,
    title: "EORA Companion",
    desc: "Use your saved goals and profile details to guide future conversations.",
    color: "#5642EF",
    bg: "#EDE9FE",
  },
  {
    icon: ShieldCheck,
    title: "Evidence Review",
    desc: "Add sources and review claims before treating them as verified.",
    color: "#10B981",
    bg: "#DCFCE7",
  },
  {
    icon: Compass,
    title: "Learning Roadmap",
    desc: "Explore paths based on the goals and skills you choose to save.",
    color: "#0284C7",
    bg: "#E0F2FE",
  },
  {
    icon: Briefcase,
    title: "Opportunity Discovery",
    desc: "Browse available internships, hackathons and mentor connections.",
    color: "#D97706",
    bg: "#FEF3C7",
  },
];

export function Screen11OnboardingComplete({
  studentName = "Student",
  onGoToDashboard,
  onExploreOpportunities,
  onBack,
  onJumpToStep,
}: Screen11OnboardingCompleteProps) {
  const firstName = studentName.trim().split(" ")[0] || "Student";

  return (
    <div
      className="exact-screen-wrapper"
      style={{
        background: "radial-gradient(ellipse at 75% 20%, rgba(2, 197, 245, 0.08) 0%, rgba(147, 53, 232, 0.06) 40%, #F9F8F5 75%)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient background glows */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "20%",
          width: "650px",
          height: "650px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2, 197, 245, 0.1) 0%, rgba(69, 100, 255, 0.04) 50%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          right: "15%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(147, 53, 232, 0.09) 0%, rgba(86, 66, 220, 0.03) 50%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      <ScreenHeader
        onBack={onBack}
        showBack={true}
        rightLabel="Step 10 of 10"
      />

      <main
        className="screen-body"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 1260,
          margin: "0 auto",
          width: "100%",
          padding: "24px 36px 36px",
        }}
      >
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.2fr", alignItems: "center", gap: 56, margin: "auto 0" }}>
          
          {/* Approved celebration pose, compact outside the landing hero. */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div
              style={{
                position: "absolute",
                width: 220,
                height: 220,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(2, 197, 245, 0.22) 0%, rgba(147, 53, 232, 0.16) 50%, transparent 75%)",
                filter: "blur(40px)",
                zIndex: 0,
              }}
            />
            <div style={{ position: "relative", width: "100%", maxWidth: 190, height: 210, zIndex: 1 }}>
              <Image
                src="/assets/eora/celebrating.png"
                alt="EORA celebrating"
                fill
                sizes="190px"
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
          </div>

          {/* Right Column: Copy, Milestones Grid & Actions */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#5642EF", background: "rgba(86, 66, 239, 0.08)", border: "1px solid rgba(86, 66, 239, 0.2)", padding: "4px 14px", borderRadius: 9999, marginBottom: 12, alignSelf: "flex-start" }}>
              <Sparkles size={14} color="#02C5F5" />
              <span>Step 10 · Launch Student Workspace</span>
            </div>

            <h1 style={{ fontSize: "clamp(32px, 3.6vw, 44px)", fontWeight: 850, color: "#171626", lineHeight: 1.15, marginBottom: 10, letterSpacing: "-0.03em" }}>
              Welcome aboard, {firstName}! 🚀
            </h1>
            <p style={{ fontSize: 15.5, color: "#64748B", lineHeight: 1.55, marginBottom: 24 }}>
              Open your student workspace to save your reviewed starting profile. You can keep adding and correcting details later.
            </p>

            {/* 4 Generated Asset Milestone Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 28 }}>
              {milestones.map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div
                    key={idx}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: 14,
                      padding: "16px",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: m.bg,
                        color: m.color,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1E1B4B", marginBottom: 2, display: "flex", alignItems: "center", gap: 5 }}>
                        <span>{m.title}</span>
                        <CheckCircle2 size={13} color="#10B981" />
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.4 }}>
                        {m.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button
                type="button"
                id="eora-onboarding-finish"
                data-eora-id="eora-onboarding-finish"
                onClick={onGoToDashboard}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "14px 32px",
                  borderRadius: 9999,
                  background: "linear-gradient(110deg, #02C5F5 0%, #4564FF 48%, #9335E8 100%)",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: 15,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(69, 100, 255, 0.4)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <span>Launch My Workspace</span>
                <ArrowRight size={18} />
              </button>

              <button
                type="button"
                onClick={onExploreOpportunities || onBack}
                style={{
                  padding: "13px 24px",
                  borderRadius: 9999,
                  border: "1.5px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#475569",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s ease",
                }}
              >
                Review Evidence
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <ScreenFooter
          onBack={onBack}
          onJumpToStep={onJumpToStep}
          activeStep={10}
          totalSteps={10}
          showNext={false}
        />
      </main>
    </div>
  );
}
