"use client";

import React, { useState } from "react";
import { BookOpen, Briefcase, Users, Network, Code, FlaskConical, CheckCircle2 } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";

interface Screen3aPrioritiesProps {
  initialPriorities?: string[];
  initialPrimary?: string;
  onSavePriorities: (selected: string[], primary: string | undefined) => void;
  onNext: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

const prioritiesOptions = [
  { id: "learning", title: "Learn AI & ML", icon: BookOpen },
  { id: "jobs", title: "Internships & Jobs", icon: Briefcase },
  { id: "people", title: "People & Mentors", icon: Users },
  { id: "collaboration", title: "Collaborate", icon: Network },
  { id: "projects", title: "Build Projects", icon: Code },
  { id: "research_events", title: "Research & Events", icon: FlaskConical },
];

function normalizeId(id: string): string {
  if (id === "network") return "people";
  return id;
}

export function Screen3aPriorities({
  initialPriorities = [],
  initialPrimary,
  onSavePriorities,
  onNext,
  onBack,
  onJumpToStep,
}: Screen3aPrioritiesProps) {
  const normalizedInitial = initialPriorities.map(normalizeId);
  const normalizedPrimary = initialPrimary ? normalizeId(initialPrimary) : normalizedInitial[0];

  const [selected, setSelected] = useState<string[]>(normalizedInitial);
  const [primary, setPrimary] = useState<string | undefined>(normalizedPrimary);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setNotice(null);
    let nextSelected = [...selected];
    if (nextSelected.includes(id)) {
      // Deselect
      nextSelected = nextSelected.filter((item) => item !== id);
      if (primary === id) {
        setPrimary(nextSelected.length > 0 ? nextSelected[0] : undefined);
      }
    } else {
      // Select
      if (nextSelected.length >= 3) {
        setNotice("You can select up to 3 interests (1 Primary + up to 2 Secondary).");
        return;
      }
      nextSelected.push(id);
      if (!primary) {
        setPrimary(id);
      }
    }
    setSelected(nextSelected);
  };

  const handleSetPrimary = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPrimary(id);
  };

  const handleNextClick = () => {
    if (selected.length === 0) {
      onSavePriorities([], undefined);
    } else {
      const activePrimary = primary && selected.includes(primary) ? primary : selected[0];
      onSavePriorities(selected, activePrimary);
    }
    onNext();
  };

  const getTitle = (id: string) => prioritiesOptions.find((p) => p.id === id)?.title || id;
  const activePrimaryTitle = primary && selected.includes(primary) ? getTitle(primary) : selected[0] ? getTitle(selected[0]) : null;
  const secondaryTitles = selected.filter((id) => id !== primary).map(getTitle);

  return (
    <div
      className="exact-screen-wrapper relative overflow-hidden"
      style={{
        background: "radial-gradient(circle at 80% 20%, rgba(2, 197, 245, 0.07) 0%, rgba(89, 66, 220, 0.05) 35%, #F9F8F5 70%)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-40 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-cyan-400/10 via-purple-500/10 to-transparent rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-[450px] h-[450px] bg-gradient-to-tr from-blue-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl" />

      <ScreenHeader
        onBack={onBack}
        showBack={true}
        rightLabel="Step 3 of 10"
      />

      <main
        className="screen-body"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 1240,
          margin: "0 auto",
          width: "100%",
          padding: "24px 36px 36px",
        }}
      >
        {/* Centered Heading */}
        <div style={{ textAlign: "center", marginBottom: 32, marginTop: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: "#5942DC",
              background: "rgba(89, 66, 220, 0.08)",
              border: "1px solid rgba(89, 66, 220, 0.2)",
              padding: "5px 14px",
              borderRadius: 9999,
              marginBottom: 12,
            }}
          >
            <span>Step 3 · What Brings You to AI Tathastu?</span>
          </span>
          <h1 style={{ fontSize: "clamp(28px, 3.2vw, 42px)", fontWeight: 850, color: "#171626", letterSpacing: "-0.03em", margin: "0 0 10px" }}>
            What brings you to AI Tathastu?
          </h1>
          <p style={{ fontSize: 16, color: "#64748B", margin: "0 0 8px", maxWidth: 640, marginInline: "auto", lineHeight: 1.55 }}>
            Choose what matters most to you. We&apos;ll adapt your entire dashboard, roadmap, and EORA guidance.
          </p>

          {/* Interactive Selection Status Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 9999, background: selected.length > 0 ? "#EDE9FE" : "#F3F4F6", border: selected.length > 0 ? "1px solid #DDD6FE" : "1px solid #E5E7EB", marginTop: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: selected.length > 0 ? "#5942DC" : "#6B7280" }}>
              {selected.length === 0 && "0 of 3 selected · Skip for now gives a neutral dashboard"}
              {selected.length === 1 && `1 of 3 selected · Primary: ${activePrimaryTitle}`}
              {selected.length === 2 && `2 of 3 selected · Primary: ${activePrimaryTitle} · Secondary: ${secondaryTitles[0]}`}
              {selected.length === 3 && `3 of 3 selected · Primary: ${activePrimaryTitle} · Secondary: ${secondaryTitles.join(", ")}`}
            </span>
          </div>
        </div>

        {notice && (
          <div
            style={{
              padding: "14px 22px",
              borderRadius: 14,
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              color: "#92400E",
              fontSize: 14,
              lineHeight: 1.5,
              textAlign: "center",
              marginBottom: 24,
              boxShadow: "0 2px 8px rgba(245, 158, 11, 0.08)",
            }}
            role="status"
          >
            {notice}
          </div>
        )}

        {/* 3x2 Grid in Glass Card Container */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(18px)",
            borderRadius: 24,
            padding: "36px 40px",
            boxShadow: "0 18px 45px rgba(0, 0, 0, 0.06), 0 0 30px rgba(89, 66, 220, 0.04)",
            border: "1.5px solid rgba(89, 66, 220, 0.12)",
            marginBottom: 28,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {prioritiesOptions.map((r) => {
              const Icon = r.icon;
              const isSelected = selected.includes(r.id);
              const isPrimary = primary === r.id || (selected.length === 1 && isSelected);

              return (
                <div
                  key={r.id}
                  onClick={() => handleSelect(r.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSelect(r.id);
                    }
                  }}
                  style={{
                    background: isSelected ? "linear-gradient(135deg, #F4F1FF 0%, #EDE6FF 100%)" : "#FAFAFD",
                    border: isSelected ? "2px solid #5942DC" : "1.5px solid #E5E7EB",
                    borderRadius: 16,
                    padding: "26px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: isSelected
                      ? "0 8px 24px rgba(89, 66, 220, 0.16), 0 0 0 1px #5942DC"
                      : "0 2px 8px rgba(0,0,0,0.02)",
                    position: "relative",
                    transform: isSelected ? "translateY(-2px)" : "none",
                  }}
                >
                  {/* Primary / Secondary indicator badge */}
                  {isSelected && (
                    <div
                      onClick={(e) => handleSetPrimary(e, r.id)}
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: 750,
                        color: isPrimary ? "#5942DC" : "#4B5563",
                        padding: "4px 8px",
                        borderRadius: 6,
                        background: isPrimary ? "#EDE6FF" : "#F3F4F6",
                        border: isPrimary ? "1.5px solid #C4B5FD" : "1px solid #E5E7EB",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      title={isPrimary ? "Primary interest" : "Click to set as Primary interest"}
                    >
                      {isPrimary ? (
                        <>
                          <CheckCircle2 size={12} fill="#5642DC" color="#FFF" />
                          <span>Primary</span>
                        </>
                      ) : (
                        <span>Secondary · Set as Primary</span>
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: "50%",
                      background: isSelected ? "#5942DC" : "#EEF2FF",
                      color: isSelected ? "#FFFFFF" : "#5942DC",
                      display: "grid",
                      placeItems: "center",
                      transition: "all 0.2s ease",
                      boxShadow: isSelected ? "0 4px 14px rgba(89, 66, 220, 0.3)" : "none",
                    }}
                  >
                    <Icon size={24} />
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: isSelected ? "#5942DC" : "#171626",
                      textAlign: "center",
                    }}
                  >
                    {r.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <ScreenFooter
          onBack={onBack}
          onNext={handleNextClick}
          onStepClick={onJumpToStep}
          activeStep={3}
          totalSteps={10}
          nextLabel={selected.length === 0 ? "Skip for now" : "Next"}
        />
      </main>
    </div>
  );
}
