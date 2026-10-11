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
  FileCheck,
  Trash2
} from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";
import { candidateNames } from "@/lib/onboarding-import-candidates";

export interface Screen8EducationEntry {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  graduationYear?: string;
  gpa?: string;
  percentage?: string;
  academicLevel?: string;
  source?: string;
  status?: "candidate" | "confirmed";
}

export interface Screen8ProjectEntry {
  title: string;
  description: string;
  technologies?: string[];
  sources?: string[];
  url?: string;
  aiCategories?: string[];
  status?: string;
  contributionStatus?: string;
}

export interface Screen8TechCandidate {
  name: string;
  category?: string;
  source: string;
  provenance?: string;
  sourceFile?: string;
}

export interface Screen8ExperienceEntry {
  company: string;
  role: string;
  type?: string;
  duration?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  technologies?: string[];
  source?: string;
  status?: "candidate" | "confirmed";
}

export interface Screen8AchievementEntry {
  title: string;
  category?: string;
  subType?: string;
  issuer?: string;
  date?: string;
  description?: string;
  source?: string;
  status?: "candidate" | "confirmed";
}

export interface Screen8ProfileInsightsProps {
  studentName?: string;
  degree?: string;
  specialization?: string;
  institution?: string;
  year?: string;
  location?: string;
  goal?: string;
  skills?: string[];
  educationEntries?: Screen8EducationEntry[];
  experiences?: Screen8ExperienceEntry[];
  achievements?: Screen8AchievementEntry[];
  projectsCount?: number;
  projects?: Screen8ProjectEntry[];
  technologyCandidates?: Screen8TechCandidate[];
  isGalleryMode?: boolean;
  onNext: () => void;
  onBack: () => void;
  onEdit?: () => void;
  onJumpToStep?: (step: number) => void;
  onToggleConfirmEducation?: (institution: string, degree?: string) => void;
  onRemoveEducation?: (institution: string, degree?: string) => void;
  onConfirmAllEducation?: () => void;
  onToggleConfirmProject?: (title: string) => void;
  onRemoveProject?: (title: string) => void;
  onConfirmAllProjects?: () => void;
  onToggleConfirmExperience?: (company: string, role: string) => void;
  onRemoveExperience?: (company: string, role: string) => void;
  onConfirmAllExperience?: () => void;
  onToggleConfirmAchievement?: (title: string) => void;
  onRemoveAchievement?: (title: string) => void;
  onConfirmAllAchievements?: () => void;
  onConfirmSkill?: (name: string) => void;
  onRejectSkill?: (name: string, source: string) => void;
}

const navSections = [
  { id: "personal", label: "Personal Info", icon: User },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "projects", label: "Projects", icon: FolderGit2 },
  { id: "achievements", label: "Achievements", icon: Award },
];

function formatSource(source?: string): string {
  if (!source) return "Source: CV";
  const s = source.toLowerCase();
  if (s.includes("github")) return "Source: GitHub";
  if (s.includes("linkedin")) return "Source: LinkedIn Export";
  if (s.includes("huggingface") || s.includes("hugging face")) return "Source: Hugging Face";
  if (s.includes("orcid")) return "Source: ORCID";
  if (s.includes("devto") || s.includes("dev.to")) return "Source: DEV Community";
  if (s.includes("stackoverflow") || s.includes("stack overflow")) return "Source: Stack Overflow";
  if (s.includes("leetcode")) return "Source: LeetCode";
  if (s.includes("hackerrank")) return "Source: HackerRank";
  if (s.includes("codechef")) return "Source: CodeChef";
  if (s.includes("kaggle")) return "Source: Kaggle";
  if (s.includes("portfolio")) return "Source: Portfolio";
  if (s.includes("scholar")) return "Source: Google Scholar";
  if (s.includes("resume") || s.includes("cv")) return "Source: CV";
  return `Source: ${source}`;
}

export function Screen8ProfileInsights({
  studentName = "Student",
  degree = "",
  specialization = "",
  institution = "",
  year = "",
  skills = [],
  educationEntries = [],
  experiences = [],
  achievements = [],
  projectsCount = 0,
  projects = [],
  technologyCandidates = [],
  isGalleryMode = false,
  onNext,
  onBack,
  onEdit,
  onJumpToStep,
  onToggleConfirmEducation,
  onRemoveEducation,
  onConfirmAllEducation,
  onToggleConfirmProject,
  onRemoveProject,
  onConfirmAllProjects,
  onToggleConfirmExperience,
  onRemoveExperience,
  onConfirmAllExperience,
  onToggleConfirmAchievement,
  onRemoveAchievement,
  onConfirmAllAchievements,
  onConfirmSkill,
  onRejectSkill,
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

  const displayedSkills = candidateNames(isGalleryMode && skills.length === 0 ? defaultSkills : skills);

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
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div>
                      <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>Educational Background</h4>
                      <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>Qualifications extracted from your CV & academic history</p>
                    </div>
                    {educationEntries && educationEntries.some((e) => e.status !== "confirmed") && (
                      <button
                        type="button"
                        onClick={onConfirmAllEducation}
                        style={{
                          background: "rgba(86, 66, 239, 0.08)",
                          border: "1px solid rgba(86, 66, 239, 0.25)",
                          color: "#5642EF",
                          padding: "6px 14px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Confirm All Education
                      </button>
                    )}
                  </div>

                  {educationEntries && educationEntries.length > 0 ? (
                    educationEntries.map((edu, idx) => (
                      <div
                        key={edu.institution + idx}
                        style={{
                          padding: "16px 20px",
                          borderRadius: 14,
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 8,
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <h4 style={{ fontSize: 16, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                                {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(" in ") || "Academic Qualification"}
                              </h4>
                              {edu.academicLevel && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: "#4338CA",
                                    background: "#EEF2FF",
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                    textTransform: "capitalize",
                                  }}
                                >
                                  {edu.academicLevel.replace("_", " ")}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: "#0369A1",
                                  background: "#E0F2FE",
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                }}
                              >
                                {formatSource(edu.source)}
                              </span>
                            </div>
                            <p style={{ fontSize: 13.5, color: "#64748B", margin: "4px 0 0", fontWeight: 550 }}>
                              {edu.institution}
                            </p>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              onClick={() => onToggleConfirmEducation?.(edu.institution, edu.degree)}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: edu.status === "confirmed" ? "#059669" : "#4338CA",
                                background: edu.status === "confirmed" ? "#ECFDF5" : "#EEF2FF",
                                border: `1px solid ${edu.status === "confirmed" ? "#A7F3D0" : "#C7D2FE"}`,
                                padding: "4px 10px",
                                borderRadius: 6,
                                cursor: "pointer",
                              }}
                            >
                              {edu.status === "confirmed" ? "Confirmed" : `Suggested from ${formatSource(edu.source).replace("Source: ", "")}`}
                            </span>
                            {onRemoveEducation && (
                              <button
                                type="button"
                                onClick={() => onRemoveEducation(edu.institution, edu.degree)}
                                title="Remove education entry"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#94A3B8",
                                  cursor: "pointer",
                                  padding: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Dates & Score Badges */}
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                          {(edu.startDate || edu.endDate || edu.graduationYear) && (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#5642EF",
                                background: "#EDE9FE",
                                padding: "2px 8px",
                                borderRadius: 6,
                              }}
                            >
                              {[edu.startDate, edu.endDate || edu.graduationYear].filter(Boolean).join(" – ")}
                            </span>
                          )}
                          {edu.gpa && (
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 750,
                                color: "#059669",
                                background: "#ECFDF5",
                                border: "1px solid #A7F3D0",
                                padding: "2px 8px",
                                borderRadius: 6,
                              }}
                            >
                              CGPA: {edu.gpa}
                            </span>
                          )}
                          {edu.percentage && (
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 750,
                                color: "#0D9488",
                                background: "#F0FDFA",
                                border: "1px solid #99F6E4",
                                padding: "2px 8px",
                                borderRadius: 6,
                              }}
                            >
                              Score: {edu.percentage}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "16px", borderRadius: 14, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <h4 style={{ fontSize: 16, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                            {[degree, specialization].filter(Boolean).join(" in ") || "Education not added"}
                          </h4>
                          <p style={{ fontSize: 13.5, color: "#64748B", margin: "2px 0 0" }}>{institution || "Institution not provided"}</p>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#5642EF", background: "#EDE9FE", padding: "3px 10px", borderRadius: 6 }}>
                          {year || "Year not added"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Experience */}
              {activeTab === "experience" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div>
                      <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>Experience & Internships</h4>
                      <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>Roles, employment & leadership extracted from your CV</p>
                    </div>
                    {experiences && experiences.some((e) => e.status !== "confirmed") && (
                      <button
                        type="button"
                        onClick={onConfirmAllExperience}
                        style={{
                          background: "rgba(86, 66, 239, 0.08)",
                          border: "1px solid rgba(86, 66, 239, 0.25)",
                          color: "#5642EF",
                          padding: "6px 14px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Confirm All Experience
                      </button>
                    )}
                  </div>

                  {isGalleryMode ? (
                    <div style={{ padding: "16px", borderRadius: 14, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>AI Research Contributor</h4>
                          <p style={{ fontSize: 13, color: "#64748B", margin: "2px 0 0" }}>Applied ML Laboratory &bull; University Research Project</p>
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#10B981", background: "#DEF7EC", padding: "3px 8px", borderRadius: 6 }}>
                          Confirmed
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: "#475569", margin: "6px 0 0", lineHeight: 1.45 }}>
                        Implemented deep learning models, benchmarked Transformer models vs CNN baselines, and contributed to research manuscript draft.
                      </p>
                    </div>
                  ) : null}
                  {!isGalleryMode && experiences && experiences.length > 0 ? (
                    experiences.map((exp, idx) => (
                      <div
                        key={exp.company + exp.role + idx}
                        style={{
                          padding: "16px 20px",
                          borderRadius: 14,
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                                {exp.role}
                              </h4>
                              {exp.type && exp.type !== "employment" && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: "#4338CA",
                                    background: "#EEF2FF",
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                    textTransform: "capitalize",
                                  }}
                                >
                                  {exp.type}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: "#0369A1",
                                  background: "#E0F2FE",
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                }}
                              >
                                {formatSource(exp.source)}
                              </span>
                            </div>
                            <p style={{ fontSize: 13, color: "#64748B", margin: "3px 0 0", fontWeight: 550 }}>
                              {exp.company} {exp.startDate || exp.endDate ? `• ${[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}` : (exp.duration ? `• ${exp.duration}` : "")}
                            </p>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              onClick={() => onToggleConfirmExperience?.(exp.company, exp.role)}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: exp.status === "confirmed" ? "#059669" : "#4338CA",
                                background: exp.status === "confirmed" ? "#ECFDF5" : "#EEF2FF",
                                border: `1px solid ${exp.status === "confirmed" ? "#A7F3D0" : "#C7D2FE"}`,
                                padding: "4px 10px",
                                borderRadius: 6,
                                cursor: "pointer",
                              }}
                            >
                              {exp.status === "confirmed" ? "Confirmed" : `Suggested from ${formatSource(exp.source).replace("Source: ", "")}`}
                            </span>
                            {onRemoveExperience && (
                              <button
                                type="button"
                                onClick={() => onRemoveExperience(exp.company, exp.role)}
                                title="Remove experience entry"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#94A3B8",
                                  cursor: "pointer",
                                  padding: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Tech tags */}
                        {exp.technologies && exp.technologies.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, marginBottom: 6 }}>
                            {exp.technologies.map((tech) => (
                              <span
                                key={tech}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 650,
                                  color: "#3730A3",
                                  background: "#EEF2FF",
                                  padding: "1px 7px",
                                  borderRadius: 5,
                                }}
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}

                        {exp.highlights && exp.highlights.length > 0 && (
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, color: "#475569", lineHeight: 1.45 }}>
                            {exp.highlights.map((h, i) => (
                              <li key={i}>{h}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))
                  ) : !isGalleryMode ? (
                    <p style={{ color: "#64748B" }}>No experience records confirmed yet.</p>
                  ) : null}
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
                    {technologyCandidates &&
                      technologyCandidates
                        .filter((tc) => !displayedSkills.some((s) => s.toLowerCase() === tc.name.toLowerCase()))
                        .map((tc) => (
                          <div
                            key={tc.name}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              borderRadius: 10,
                              background: "#F0FDF4",
                              border: "1px solid #BBF7D0",
                            }}
                          >
                            <div>
                              <span style={{ fontSize: 13.5, fontWeight: 750, color: "#166534" }}>{tc.name}</span>
                              <span style={{ display: "block", fontSize: 10.5, color: "#15803D" }}>
                                Suggested from {tc.source}{tc.sourceFile ? ` (${tc.sourceFile})` : ""}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" onClick={() => onConfirmSkill?.(tc.name)} style={{ fontSize: 11, fontWeight: 700, color: "#166534", background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: 6, padding: "3px 7px" }}>Confirm</button>
                              <button type="button" onClick={() => onRejectSkill?.(tc.name, tc.source)} style={{ fontSize: 11, fontWeight: 700, color: "#64748B", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 6, padding: "3px 7px" }}>Remove</button>
                            </div>
                          </div>
                        ))}
                  </div>
                </div>
              )}

              {/* Tab 5: Projects */}
              {activeTab === "projects" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div>
                      <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>Technical Projects</h4>
                      <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>Evidence-backed projects discovered from CV & GitHub</p>
                    </div>
                    {projects && projects.some((p) => p.status !== "confirmed") && (
                      <button
                        type="button"
                        onClick={onConfirmAllProjects}
                        style={{
                          background: "rgba(86, 66, 239, 0.08)",
                          border: "1px solid rgba(86, 66, 239, 0.25)",
                          color: "#5642EF",
                          padding: "6px 14px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Confirm All Projects
                      </button>
                    )}
                  </div>

                  {isGalleryMode ? (
                    <>
                      <div style={{ padding: "14px 16px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E1B4B" }}>CoRXGB Classification</div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>CNN + Bi-LSTM + XGBoost Ensemble</div>
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#5642EF", background: "#EDE9FE", padding: "3px 8px", borderRadius: 6 }}>AI Impact 94</span>
                      </div>
                      <div style={{ padding: "14px 16px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E1B4B" }}>Medical Image Segmentation</div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>Vision Transformers &amp; OpenCV</div>
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#5642EF", background: "#EDE9FE", padding: "3px 8px", borderRadius: 6 }}>AI Impact 88</span>
                      </div>
                    </>
                  ) : null}
                  {!isGalleryMode && projects.length > 0 ? (
                    projects.map((project, idx) => (
                      <div
                        key={project.title + idx}
                        style={{
                          padding: "16px 20px",
                          borderRadius: 14,
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 6,
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                                {project.title}
                              </h4>
                              {project.sources && project.sources.includes("github") && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: "#1E293B",
                                    background: "#E2E8F0",
                                    padding: "2px 7px",
                                    borderRadius: 9999,
                                  }}
                                >
                                  GitHub
                                </span>
                              )}
                              {project.sources && project.sources.some((s) => s.toLowerCase().includes("huggingface") || s.toLowerCase().includes("hugging face")) && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: "#B45309",
                                    background: "#FEF3C7",
                                    padding: "2px 7px",
                                    borderRadius: 9999,
                                  }}
                                >
                                  Hugging Face
                                </span>
                              )}
                              {project.sources && project.sources.some((s) => s.toLowerCase().includes("kaggle")) && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: "#0369A1",
                                    background: "#E0F2FE",
                                    padding: "2px 7px",
                                    borderRadius: 9999,
                                  }}
                                >
                                  Kaggle
                                </span>
                              )}
                              {project.sources && project.sources.some((s) => s.toLowerCase().includes("portfolio")) && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: "#6D28D9",
                                    background: "#F5F3FF",
                                    padding: "2px 7px",
                                    borderRadius: 9999,
                                  }}
                                >
                                  Portfolio
                                </span>
                              )}
                              {project.sources && project.sources.includes("resume") && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: "#1E40AF",
                                    background: "#DBEAFE",
                                    padding: "2px 7px",
                                    borderRadius: 9999,
                                  }}
                                >
                                  Source: CV
                                </span>
                              )}
                              {project.aiCategories &&
                                project.aiCategories.slice(0, 2).map((cat) => (
                                  <span
                                    key={cat}
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      color: "#6D28D9",
                                      background: "#F5F3FF",
                                      border: "1px solid #DDD6FE",
                                      padding: "1px 6px",
                                      borderRadius: 6,
                                    }}
                                  >
                                    {cat}
                                  </span>
                                ))}
                            </div>
                            <p style={{ fontSize: 13, color: "#475569", margin: "6px 0 10px", lineHeight: 1.45 }}>
                              {project.description}
                            </p>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              onClick={() => onToggleConfirmProject?.(project.title)}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: project.status === "confirmed" ? "#059669" : "#4338CA",
                                background: project.status === "confirmed" ? "#ECFDF5" : "#EEF2FF",
                                border: `1px solid ${project.status === "confirmed" ? "#A7F3D0" : "#C7D2FE"}`,
                                padding: "4px 10px",
                                borderRadius: 6,
                                flexShrink: 0,
                                cursor: "pointer",
                              }}
                            >
                              {project.status === "confirmed" ? "Confirmed" : "Suggested from your CV"}
                            </span>
                            {onRemoveProject && (
                              <button
                                type="button"
                                onClick={() => onRemoveProject(project.title)}
                                title="Remove project"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#94A3B8",
                                  cursor: "pointer",
                                  padding: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Tech pills & Repo link */}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            alignItems: "center",
                            marginTop: 8,
                          }}
                        >
                          {project.technologies?.map((tech) => (
                            <span
                              key={tech}
                              style={{
                                fontSize: 11.5,
                                fontWeight: 650,
                                color: "#4338CA",
                                background: "#EEF2FF",
                                border: "1px solid #C7D2FE",
                                padding: "2px 8px",
                                borderRadius: 6,
                              }}
                            >
                              {tech}
                            </span>
                          ))}
                          {project.url && (
                            <a
                              href={project.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 11.5,
                                color: "#2563EB",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                marginLeft: "auto",
                                fontWeight: 600,
                              }}
                            >
                              <span>Repository</span> &rarr;
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    !isGalleryMode && <p style={{ color: "#64748B" }}>No projects confirmed yet.</p>
                  )}
                </div>
              )}

              {/* Tab 6: Achievements */}
              {activeTab === "achievements" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div>
                      <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>Achievements, Research & Patents</h4>
                      <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>Intellectual output, papers, patents & honors from your CV</p>
                    </div>
                    {achievements && achievements.some((a) => a.status !== "confirmed") && (
                      <button
                        type="button"
                        onClick={onConfirmAllAchievements}
                        style={{
                          background: "rgba(86, 66, 239, 0.08)",
                          border: "1px solid rgba(86, 66, 239, 0.25)",
                          color: "#5642EF",
                          padding: "6px 14px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Confirm All Achievements
                      </button>
                    )}
                  </div>

                  {isGalleryMode ? (
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Award size={18} color="#F59E0B" />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#1E1B4B" }}>Smart India Hackathon Finalist</div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>Ministry of Education Innovation Cell &bull; 2024</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#10B981", background: "#DEF7EC", padding: "3px 8px", borderRadius: 6 }}>Confirmed</span>
                    </div>
                  ) : null}
                  {!isGalleryMode && achievements && achievements.length > 0 ? (
                    achievements.map((ach, idx) => (
                      <div
                        key={ach.title + idx}
                        style={{
                          padding: "16px 20px",
                          borderRadius: 14,
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <Award size={20} color="#6366F1" style={{ marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <h4 style={{ fontSize: 15, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                                {ach.title}
                              </h4>
                              {ach.category && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: "#6D28D9",
                                    background: "#F5F3FF",
                                    border: "1px solid #DDD6FE",
                                    padding: "1px 7px",
                                    borderRadius: 6,
                                    textTransform: "capitalize",
                                  }}
                                >
                                  {ach.subType ? ach.subType.replace("_", " ") : ach.category}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: "#0369A1",
                                  background: "#E0F2FE",
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                }}
                              >
                                {formatSource(ach.source)}
                              </span>
                            </div>
                            <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0", lineHeight: 1.45 }}>
                              {ach.description}
                            </p>
                            {(ach.issuer || ach.date) && (
                              <span style={{ fontSize: 12, color: "#64748B", display: "block", marginTop: 4 }}>
                                {[ach.issuer, ach.date].filter(Boolean).join(" • ")}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span
                            onClick={() => onToggleConfirmAchievement?.(ach.title)}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: ach.status === "confirmed" ? "#059669" : "#4338CA",
                              background: ach.status === "confirmed" ? "#ECFDF5" : "#EEF2FF",
                              border: `1px solid ${ach.status === "confirmed" ? "#A7F3D0" : "#C7D2FE"}`,
                              padding: "4px 10px",
                              borderRadius: 6,
                              cursor: "pointer",
                            }}
                          >
                            {ach.status === "confirmed" ? "Confirmed" : `Suggested from ${formatSource(ach.source).replace("Source: ", "")}`}
                          </span>
                          {onRemoveAchievement && (
                            <button
                              type="button"
                              onClick={() => onRemoveAchievement(ach.title)}
                              title="Remove achievement"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#94A3B8",
                                cursor: "pointer",
                                padding: "4px",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : !isGalleryMode ? (
                    <p style={{ color: "#64748B" }}>No achievements confirmed yet.</p>
                  ) : null}
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
