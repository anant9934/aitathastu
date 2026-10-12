"use client";

import React, { useEffect, useState } from "react";
import { GraduationCap, User, Briefcase, Users, Award, Building2, Sparkles, Check } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";

interface Screen3ChooseRoleProps {
  selectedRole?: string;
  onSelectRole: (role: string) => void;
  onNext: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

const roles = [
  { id: "student", title: "I'm a Student", subtitle: "Build an intelligent profile, learn AI/ML, and discover opportunities", icon: GraduationCap, available: true },
  { id: "faculty", title: "I'm Faculty", subtitle: "Shape learning, research, and mentorship. Privileged tools require institution approval.", icon: User, available: false },
  { id: "professional", title: "I'm a Professional", subtitle: "Share domain expertise, review architectures, and collaborate", icon: Briefcase, available: false },
  { id: "mentor", title: "I'm a Mentor", subtitle: "Conduct mock assessments and guide aspiring engineers", icon: Users, available: false },
  { id: "alumni", title: "I'm an Alumni", subtitle: "Connect with students and give back to your institution", icon: Award, available: false },
  { id: "organization", title: "I'm an Organization", subtitle: "Discover pre-verified talent with authentic project evidence", icon: Building2, available: false },
];

export function Screen3ChooseRole({
  selectedRole = "",
  onSelectRole,
  onNext,
  onBack,
  onJumpToStep,
}: Screen3ChooseRoleProps) {
  const [current, setCurrent] = useState(selectedRole || "");
  useEffect(() => setCurrent(selectedRole || ""), [selectedRole]);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSelect = (id: string, available: boolean) => {
    if (!available) {
      setNotice("This role workspace is coming soon. Student onboarding is available today.");
      return;
    }
    setNotice(null);
    setCurrent(id);
    onSelectRole(id);
  };

  return (
    <div
      className="exact-screen-wrapper"
      style={{
        background: "radial-gradient(ellipse at 80% 20%, rgba(2, 197, 245, 0.08) 0%, rgba(86, 66, 239, 0.05) 40%, #F9F8F5 75%)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          right: "10%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2, 197, 245, 0.1) 0%, rgba(69, 100, 255, 0.04) 50%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      <ScreenHeader
        onBack={onBack}
        showBack={true}
        rightLabel="Step 1 of 10"
      />

      <main
        className="screen-body v4-role-main"
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
        {/* Centered Heading */}
        <div style={{ textAlign: "center", marginBottom: 32, marginTop: 4 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#5642EF", background: "rgba(86, 66, 239, 0.08)", border: "1px solid rgba(86, 66, 239, 0.2)", padding: "4px 14px", borderRadius: 9999, marginBottom: 10 }}>
            <Sparkles size={13} color="#02C5F5" />
            <span>Step 1 · Role Identification</span>
          </div>
          <h1 style={{ fontSize: "clamp(28px, 3.2vw, 40px)", fontWeight: 850, color: "#171626", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
            What best describes you?
          </h1>
          <p style={{ fontSize: 15.5, color: "#64748B", maxWidth: 640, margin: "0 auto", lineHeight: 1.55 }}>
            This helps EORA tailor your learning pathways, verification rubrics, and workspace tools.
          </p>
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

        {/* 3x2 Role Grid in Glass Card Container */}
        <div
          className="v4-role-panel"
          data-eora-id="eora-role-select"
          style={{
            background: "#FFFFFF",
            borderRadius: 24,
            padding: "36px 40px",
            boxShadow: "0 14px 40px -8px rgba(86, 66, 239, 0.08), 0 2px 12px rgba(0, 0, 0, 0.03)",
            border: "1px solid rgba(226, 232, 240, 0.9)",
            marginBottom: 28,
          }}
        >
          <div className="v4-role-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {roles.map((r) => {
              const Icon = r.icon;
                  const isSelected = current === r.id;
              return (
                <div
                  className="v4-role-card"
                  key={r.id}
                  id={`eora-role-${r.id}`}
                  data-eora-id={`eora-role-${r.id}`}
                  onClick={() => handleSelect(r.id, r.available)}
                  role="button"
                  aria-disabled={!r.available}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSelect(r.id, r.available);
                    }
                  }}
                  style={{
                    background: isSelected ? "#F4F1FF" : "#FFFFFF",
                    border: isSelected ? "2px solid #5642EF" : "1.5px solid #E2E8F0",
                    borderRadius: 18,
                    padding: "28px 22px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    boxShadow: isSelected
                      ? "0 8px 24px rgba(86, 66, 239, 0.18)"
                      : "0 2px 6px rgba(0,0,0,0.02)",
                    position: "relative",
                    transform: isSelected ? "translateY(-2px)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#CBD5E1";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#E2E8F0";
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.02)";
                    }
                  }}
                >
                  {!r.available && (
                    <span
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: "#F1F5F9",
                        color: "#64748B",
                      }}
                    >
                      Coming Soon
                    </span>
                  )}
                  {isSelected && (
                    <span
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: 9999,
                        background: "#5642EF",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Check size={11} strokeWidth={3} /> Selected
                    </span>
                  )}
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: isSelected ? "linear-gradient(135deg, #5642EF, #7B2CBF)" : "#F1F5F9",
                      color: isSelected ? "#FFFFFF" : "#5642EF",
                      display: "grid",
                      placeItems: "center",
                      transition: "all 0.2s ease",
                      boxShadow: isSelected ? "0 4px 14px rgba(86, 66, 239, 0.35)" : "none",
                    }}
                  >
                    <Icon size={24} />
                  </div>
                  <div
                    style={{
                      fontSize: 16.5,
                      fontWeight: 850,
                      color: isSelected ? "#5642EF" : "#171626",
                      textAlign: "center",
                    }}
                  >
                    {r.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: isSelected ? "#475569" : "#64748B",
                      textAlign: "center",
                      lineHeight: 1.45,
                      maxWidth: 240,
                    }}
                  >
                    {r.subtitle}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <ScreenFooter
          onBack={onBack}
          onNext={() => current ? onNext() : setNotice("Choose Student or Faculty to continue.")}
          onStepClick={onJumpToStep}
          activeStep={1}
          totalSteps={10}
          nextLabel="Next"
        />
      </main>
      <style jsx>{`@media(max-width:700px){.v4-role-main{padding:20px 16px 28px!important}.v4-role-panel{padding:16px!important}.v4-role-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}.v4-role-card{padding:22px 10px!important;min-height:170px}}`}</style>
    </div>
  );
}
