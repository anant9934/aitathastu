"use client";

import React, { useState } from "react";
import {
  User,
  GraduationCap,
  Briefcase,
  Sparkles,
  FolderGit2,
  Award,
  Edit3,
  CheckCircle2,
  ShieldCheck,
  FileCheck
} from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";

export interface Screen8ProfileInsightsProps {
  studentName?: string;
  degree?: string;
  specialization?: string;
  institution?: string;
  year?: string;
  location?: string;
  goal?: string;
  skills?: string[];
  projectsCount?: number;
  projects?: Array<{ title: string; description: string }>;
  isGalleryMode?: boolean;
  onNext: () => void;
  onBack: () => void;
  onEdit?: () => void;
  onJumpToStep?: (step: number) => void;
}

const navSections = [
  { id: "personal", label: "Personal Info", icon: User },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "projects", label: "Projects", icon: FolderGit2 },
  { id: "achievements", label: "Achievements", icon: Award },
];

export function Screen8ProfileInsights({
  studentName = "Student",
  degree = "",
  specialization = "",
  institution = "",
  year = "",
  skills = [],
  projectsCount = 0,
  projects = [],
  isGalleryMode = false,
  onNext,
  onBack,
  onEdit,
  onJumpToStep,
}: Screen8ProfileInsightsProps) {
  const [activeTab, setActiveTab] = useState("personal");
  const firstName = studentName.trim().split(" ")[0] || "Student";
  const initial = studentName.trim().charAt(0).toUpperCase() || "S";

  const defaultSkills = [
    "Python",
    "Deep Learning",
    "PyTorch",
    "NLP",
    "Computer Vision",
    "DSA",
    "Transformers",
    "FastAPI",
    "Docker",
    "XGBoost",
  ];

  const displayedSkills = isGalleryMode && skills.length === 0 ? defaultSkills : skills;

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
      {/* Ambient background light gradients */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          right: "10%",
          width: "750px",
          height: "750px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2, 197, 245, 0.1) 0%, rgba(69, 100, 255, 0.05) 50%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "5%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(147, 53, 232, 0.08) 0%, rgba(86, 66, 239, 0.03) 50%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      <ScreenHeader
        onBack={onBack}
        showBack={true}
        rightLabel="Step 8 of 10"
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
        {/* Title Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: "#5642EF",
              background: "rgba(86, 66, 239, 0.08)",
              border: "1px solid rgba(86, 66, 239, 0.2)",
              padding: "5px 14px",
              borderRadius: 9999,
              marginBottom: 10,
            }}
          >
            <Sparkles size={13} color="#02C5F5" />
            <span>Step 8 · Profile &amp; Skills Review</span>
          </span>
          <h1 style={{ fontSize: "clamp(28px, 3.2vw, 40px)", fontWeight: 850, color: "#171626", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
            Here&apos;s what I synthesized for you, {firstName}!
          </h1>
          <p style={{ fontSize: 15.5, color: "#64748B", maxWidth: 680, margin: "0 auto", lineHeight: 1.55 }}>
            Review the information you have provided. Add or correct details before continuing.
          </p>
        </div>

        {/* Broad Two-Column Layout */}
        <div
          data-eora-id="eora-profile-insights"
          style={{
            display: "grid",
            gridTemplateColumns: "260px 1fr",
            gap: 28,
            alignItems: "stretch",
            marginBottom: 28,
            minHeight: 480,
          }}
        >
          {/* Left Vertical Menu */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {navSections.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 18px",
                    borderRadius: 14,
                    border: isActive ? "2px solid #5642EF" : "1.5px solid rgba(226, 232, 240, 0.9)",
                    background: isActive ? "linear-gradient(135deg, #F4F1FF 0%, #EDE6FF 100%)" : "#FFFFFF",
                    color: isActive ? "#5642EF" : "#475569",
                    fontSize: 14.5,
                    fontWeight: isActive ? 800 : 600,
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: isActive ? "0 4px 14px rgba(86, 66, 239, 0.15)" : "0 2px 6px rgba(0,0,0,0.02)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Icon size={18} color={isActive ? "#5642EF" : "#64748B"} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Evidence summary badge in sidebar */}
            <div
              style={{
                marginTop: "auto",
                background: "linear-gradient(135deg, rgba(86,66,239,0.06), rgba(2,197,245,0.06))",
                border: "1px solid rgba(86,66,239,0.15)",
                borderRadius: 14,
                padding: "16px",
                fontSize: 12,
                color: "#1E1B4B",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, marginBottom: 6, color: "#5642EF" }}>
                <ShieldCheck size={16} /> Recorded Information
              </div>
              <div style={{ color: "#64748B", lineHeight: 1.4 }}>
                {displayedSkills.length} skills &bull; {projectsCount} confirmed projects
              </div>
            </div>
          </div>

          {/* Right Broad Profile Details Card with Dynamic Content based on Active Tab */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 24,
              border: "1.5px solid rgba(86, 66, 239, 0.12)",
              padding: "36px 40px",
              boxShadow: "0 18px 45px rgba(0, 0, 0, 0.06), 0 0 30px rgba(86, 66, 239, 0.04)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              {/* Profile Header Row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 22,
                  borderBottom: "1px solid #F1F5F9",
                  marginBottom: 26,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #02C5F5 0%, #4564FF 50%, #9335E8 100%)",
                      color: "#FFFFFF",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 24,
                      fontWeight: 850,
                      boxShadow: "0 4px 14px rgba(69, 100, 255, 0.35)",
                    }}
                  >
                    {initial}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 20, fontWeight: 850, color: "#1E1B4B", margin: "0 0 4px" }}>
                      {studentName}
                    </h3>
                    <div style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>
                      {[degree, specialization, institution].filter(Boolean).join(" · ") || "Academic details not added"}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#5642EF", fontWeight: 750, marginTop: 4 }}>
                      {year || "Academic year not added"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onEdit || onBack}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 18px",
                    borderRadius: 9999,
                    background: "rgba(86, 66, 239, 0.08)",
                    border: "1px solid rgba(86, 66, 239, 0.2)",
                    color: "#5642EF",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Edit3 size={14} />
                  <span>Edit Data</span>
                </button>
              </div>

              {/* Tab 1: Personal Info */}
              {activeTab === "personal" && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 24,
                      marginBottom: 28,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Institution
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 750, color: "#1E1B4B" }}>
                        {institution || "Not added"}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Degree & Year
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 750, color: "#1E1B4B" }}>
                        {[degree, year].filter(Boolean).join(" · ") || "Not added"}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Department / Domain
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 750, color: "#1E1B4B" }}>
                        {specialization || "Not added"}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Evidence Source
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#059669", display: "flex", alignItems: "center", gap: 6 }}>
                        <FileCheck size={16} />
                        <span>Student provided; verification pending</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: "#475569", fontWeight: 750, marginBottom: 12 }}>
                      Identified Core Competencies
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {displayedSkills.length === 0 && <span style={{ color: "#64748B" }}>No skills confirmed yet.</span>}
                      {displayedSkills.map((s) => (
                        <span
                          key={s}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            background: "rgba(86, 66, 239, 0.08)",
                            border: "1px solid rgba(86, 66, 239, 0.18)",
                            color: "#5642EF",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Tab 2: Education */}
              {activeTab === "education" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ padding: "16px", borderRadius: 14, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>{[degree, specialization].filter(Boolean).join(" in ") || "Education not added"}</h4>
                        <p style={{ fontSize: 13.5, color: "#64748B", margin: "2px 0 0" }}>{institution}</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#5642EF", background: "#EDE9FE", padding: "3px 10px", borderRadius: 6 }}>
                        {year || "Year not added"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Experience */}
              {activeTab === "experience" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {isGalleryMode ? <div style={{ padding: "16px", borderRadius: 14, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>AI Research Contributor</h4>
                        <p style={{ fontSize: 13, color: "#64748B", margin: "2px 0 0" }}>Applied ML Laboratory &bull; University Research Project</p>
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#10B981", background: "#DEF7EC", padding: "3px 8px", borderRadius: 6 }}>
                        Verified
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#475569", margin: "6px 0 0", lineHeight: 1.45 }}>
                      Implemented deep learning models, benchmarked Transformer models vs CNN baselines, and contributed to research manuscript draft.
                    </p>
                  </div> : <p style={{ color: "#64748B" }}>No experience has been confirmed yet.</p>}
                </div>
              )}

              {/* Tab 4: Skills */}
              {activeTab === "skills" && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 750, color: "#475569", marginBottom: 12 }}>
                    Synthesized Skills Breakdown
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {displayedSkills.map((sk) => (
                      <div key={sk} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 750, color: "#1E1B4B" }}>{sk}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981", display: "flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={13} /> Recorded
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 5: Projects */}
              {activeTab === "projects" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {isGalleryMode ? <div style={{ padding: "14px 16px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E1B4B" }}>CoRXGB Classification</div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>CNN + Bi-LSTM + XGBoost Ensemble</div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#5642EF", background: "#EDE9FE", padding: "3px 8px", borderRadius: 6 }}>AI Impact 94</span>
                  </div> : null}
                  {isGalleryMode ? <div style={{ padding: "14px 16px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E1B4B" }}>Medical Image Segmentation</div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>Vision Transformers &amp; OpenCV</div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#5642EF", background: "#EDE9FE", padding: "3px 8px", borderRadius: 6 }}>AI Impact 88</span>
                  </div> : null}
                  {!isGalleryMode && (projects.length ? projects.map((project) => <div key={project.title} style={{ padding: "14px 16px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0" }}><strong>{project.title}</strong><div style={{ color: "#64748B" }}>{project.description}</div></div>) : <p style={{ color: "#64748B" }}>No projects confirmed yet.</p>)}
                </div>
              )}

              {/* Tab 6: Achievements */}
              {activeTab === "achievements" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {isGalleryMode ? <div style={{ padding: "14px 16px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Award size={18} color="#F59E0B" />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1E1B4B" }}>Smart India Hackathon Finalist</div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>Ministry of Education Innovation Cell &bull; 2024</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#10B981", background: "#DEF7EC", padding: "3px 8px", borderRadius: 6 }}>Verified</span>
                  </div> : <p style={{ color: "#64748B" }}>No achievements confirmed yet.</p>}
                </div>
              )}
            </div>

            <div style={{ paddingTop: 20, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#64748B" }}>
                Review these details before saving your profile.
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#10B981", display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={16} /> Ready for review
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <ScreenFooter
          onBack={onBack}
          onNext={onNext}
          onJumpToStep={onJumpToStep}
          activeStep={8}
          totalSteps={10}
          nextLabel="Looks Good"
        />
      </main>
    </div>
  );
}
