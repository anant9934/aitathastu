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
  Trash2,
  Plus,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  X,
  Info,
  Check,
  Globe,
  Layers,
  Cpu,
  BrainCircuit,
  ArrowRight
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
  expectedGraduationYear?: number;
  email?: string;
  mobile?: string;
  location?: string;
  goal?: string;
  skills?: string[];
  educationEntries?: Screen8EducationEntry[];
  experiences?: Screen8ExperienceEntry[];
  achievements?: Screen8AchievementEntry[];
  projectsCount?: number;
  projects?: Screen8ProjectEntry[];
  technologyCandidates?: Screen8TechCandidate[];
  profiles?: Partial<Record<string, string>>;
  discoveredResumeProfiles?: Partial<Record<string, string>>;
  isFresher?: boolean;
  isGalleryMode?: boolean;
  onNext: () => void;
  onBack: () => void;
  onEdit?: () => void;
  onJumpToStep?: (step: number) => void;
  onToggleConfirmEducation?: (institution: string, degree?: string) => void;
  onRemoveEducation?: (institution: string, degree?: string) => void;
  onConfirmAllEducation?: () => void;
  onAddEducation?: (entry: Screen8EducationEntry) => void;
  onToggleConfirmProject?: (title: string) => void;
  onRemoveProject?: (title: string) => void;
  onConfirmAllProjects?: () => void;
  onAddProject?: (entry: Screen8ProjectEntry) => void;
  onToggleConfirmExperience?: (company: string, role: string) => void;
  onRemoveExperience?: (company: string, role: string) => void;
  onConfirmAllExperience?: () => void;
  onAddExperience?: (entry: Screen8ExperienceEntry) => void;
  onToggleFresher?: (isFresher: boolean) => void;
  onToggleConfirmAchievement?: (title: string) => void;
  onRemoveAchievement?: (title: string) => void;
  onConfirmAllAchievements?: () => void;
  onAddAchievement?: (entry: Screen8AchievementEntry) => void;
  onConfirmSkill?: (name: string) => void;
  onRejectSkill?: (name: string, source: string) => void;
  onAddSkill?: (skill: string) => void;
  onRemoveSkill?: (skill: string) => void;
  onUpdatePersonalInfo?: (data: {
    name?: string;
    degree?: string;
    specialization?: string;
    institution?: string;
    year?: string;
    expectedGraduationYear?: number;
    email?: string;
    mobile?: string;
  }) => void;
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

const COMMON_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Final Year", "Graduated"];

export function Screen8ProfileInsights({
  studentName = "Student",
  degree = "",
  specialization = "",
  institution = "",
  year = "",
  expectedGraduationYear,
  email = "",
  mobile = "",
  skills = [],
  educationEntries = [],
  experiences = [],
  achievements = [],
  projectsCount = 0,
  projects = [],
  technologyCandidates = [],
  profiles = {},
  discoveredResumeProfiles = {},
  isFresher = false,
  isGalleryMode = false,
  onNext,
  onBack,
  onEdit,
  onJumpToStep,
  onToggleConfirmEducation,
  onRemoveEducation,
  onConfirmAllEducation,
  onAddEducation,
  onToggleConfirmProject,
  onRemoveProject,
  onConfirmAllProjects,
  onAddProject,
  onToggleConfirmExperience,
  onRemoveExperience,
  onConfirmAllExperience,
  onAddExperience,
  onToggleFresher,
  onToggleConfirmAchievement,
  onRemoveAchievement,
  onConfirmAllAchievements,
  onAddAchievement,
  onConfirmSkill,
  onRejectSkill,
  onAddSkill,
  onRemoveSkill,
  onUpdatePersonalInfo,
}: Screen8ProfileInsightsProps) {
  const [activeTab, setActiveTab] = useState<string>("personal");
  const [validationAlert, setValidationAlert] = useState<string | null>(null);

  // Modals state
  const [isEditPersonalOpen, setIsEditPersonalOpen] = useState(false);
  const [isAddEduOpen, setIsAddEduOpen] = useState(false);
  const [isAddExpOpen, setIsAddExpOpen] = useState(false);
  const [isAddProjOpen, setIsAddProjOpen] = useState(false);
  const [isAddAchOpen, setIsAddAchOpen] = useState(false);

  // Quick skill input
  const [newSkillText, setNewSkillText] = useState("");

  // Edit Personal Info form state
  const [pName, setPName] = useState(studentName);
  const [pInstitution, setPInstitution] = useState(institution);
  const [pDegree, setPDegree] = useState(degree);
  const [pSpec, setPSpec] = useState(specialization);
  const [pYear, setPYear] = useState(year);
  const [pGradYear, setPGradYear] = useState(expectedGraduationYear?.toString() || "");
  const [pEmail, setPEmail] = useState(email);
  const [pMobile, setPMobile] = useState(mobile);

  // Add Education form state
  const [eduInst, setEduInst] = useState("");
  const [eduDegree, setEduDegree] = useState("");
  const [eduField, setEduField] = useState("");
  const [eduGradYear, setEduGradYear] = useState("");
  const [eduScore, setEduScore] = useState("");
  const [eduLevel, setEduLevel] = useState("undergraduate");

  // Add Experience form state
  const [expCompany, setExpCompany] = useState("");
  const [expRole, setExpRole] = useState("");
  const [expType, setExpType] = useState("internship");
  const [expDuration, setExpDuration] = useState("");
  const [expHighlight, setExpHighlight] = useState("");
  const [expTech, setExpTech] = useState("");

  // Add Project form state
  const [projTitle, setProjTitle] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projTech, setProjTech] = useState("");
  const [projUrl, setProjUrl] = useState("");
  const [projCategory, setProjCategory] = useState("Full Stack");

  // Add Achievement form state
  const [achTitle, setAchTitle] = useState("");
  const [achCategory, setAchCategory] = useState("Award");
  const [achIssuer, setAchIssuer] = useState("");
  const [achDate, setAchDate] = useState("");
  const [achDesc, setAchDesc] = useState("");

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

  // Digital footprints count & list
  const connectedFootprints = Object.entries(profiles)
    .filter(([_, url]) => Boolean(url && url.trim()))
    .map(([key, url]) => ({ key, url }));

  // Section completeness & intelligence check
  const isPersonalComplete = Boolean(institution && degree && year);
  const isEducationComplete = (educationEntries && educationEntries.length > 0) || Boolean(institution && degree);
  const isExperienceComplete = (experiences && experiences.length > 0) || isFresher;
  const isSkillsComplete = displayedSkills.length > 0;
  const isProjectsComplete = projects.length > 0;
  const isAchievementsComplete = achievements.length > 0;

  // Synthesis Completeness percentage
  const completenessItems = [
    Boolean(studentName && studentName !== "Student"),
    Boolean(institution),
    Boolean(degree),
    Boolean(year),
    isEducationComplete,
    isExperienceComplete,
    isSkillsComplete,
    isProjectsComplete,
  ];
  const synthesisPercentage = Math.round(
    (completenessItems.filter(Boolean).length / completenessItems.length) * 100
  );

  // Missing required checks
  const missingItems: string[] = [];
  if (!year) missingItems.push("Academic Year in Personal Info");
  if (!institution) missingItems.push("Institution in Personal Info");
  if (!degree) missingItems.push("Degree in Personal Info");
  if (!isEducationComplete) missingItems.push("Education qualification");
  if (!isExperienceComplete) missingItems.push("Experience (or confirm Fresher)");
  if (!isSkillsComplete) missingItems.push("Core Skills");

  // Handle Strict Next check
  const handleProceedClick = () => {
    if (!year) {
      setActiveTab("personal");
      setValidationAlert("Academic Year is strictly required. Please select or add your current academic year.");
      return;
    }
    if (!institution || !degree) {
      setActiveTab("personal");
      setValidationAlert("Degree & Institution are strictly required. Please review Personal Info.");
      return;
    }
    if (!isEducationComplete) {
      setActiveTab("education");
      setValidationAlert("Education qualification is strictly required. Please add your degree.");
      return;
    }
    if (!isExperienceComplete) {
      setActiveTab("experience");
      setValidationAlert("Experience is required. If you have no prior corporate experience, click 'I am a Fresher' to proceed.");
      return;
    }
    if (!isSkillsComplete) {
      setActiveTab("skills");
      setValidationAlert("Please add at least one core skill to your profile.");
      return;
    }
    setValidationAlert(null);
    onNext();
  };

  // Quick Year Setter
  const handleQuickSetYear = (yr: string) => {
    onUpdatePersonalInfo?.({ year: yr });
    setValidationAlert(null);
  };

  // Quick Add Skill handler
  const handleQuickAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSkillText.trim();
    if (!trimmed) return;
    onAddSkill?.(trimmed);
    setNewSkillText("");
    setValidationAlert(null);
  };

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
        <div style={{ textAlign: "center", marginBottom: 24 }}>
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
            Review the information extracted from your resume &amp; digital footprints. Fill or correct missing sections before continuing.
          </p>
        </div>

        {/* Global Intelligence Synthesis Ribbon */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)",
            border: "1.5px solid rgba(86, 66, 239, 0.15)",
            borderRadius: 18,
            padding: "14px 22px",
            marginBottom: 24,
            boxShadow: "0 6px 20px rgba(86, 66, 239, 0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 10,
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                color: "#059669",
                fontSize: 12.5,
                fontWeight: 750,
              }}
            >
              <FileCheck size={14} />
              <span>Resume Extracted</span>
            </div>

            {connectedFootprints.length > 0 ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "rgba(2, 197, 245, 0.1)",
                  border: "1px solid rgba(2, 197, 245, 0.25)",
                  color: "#0284C7",
                  fontSize: 12.5,
                  fontWeight: 750,
                }}
              >
                <Globe size={14} />
                <span>{connectedFootprints.length} Digital Footprint{connectedFootprints.length > 1 ? "s" : ""} Linked</span>
              </div>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "rgba(100, 116, 139, 0.08)",
                  border: "1px solid rgba(100, 116, 139, 0.2)",
                  color: "#475569",
                  fontSize: 12.5,
                  fontWeight: 650,
                }}
              >
                <Globe size={14} />
                <span>Stand-alone CV Extraction</span>
              </div>
            )}

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 10,
                background: "rgba(86, 66, 239, 0.08)",
                border: "1px solid rgba(86, 66, 239, 0.2)",
                color: "#5642EF",
                fontSize: 12.5,
                fontWeight: 750,
              }}
            >
              <BrainCircuit size={14} />
              <span>AI Cross-Synthesis: {synthesisPercentage}% Complete</span>
            </div>
          </div>

          {missingItems.length > 0 ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                fontWeight: 750,
                color: "#D97706",
                background: "#FEF3C7",
                border: "1px solid #FDE68A",
                padding: "6px 14px",
                borderRadius: 10,
              }}
            >
              <AlertTriangle size={14} />
              <span>{missingItems.length} required detail{missingItems.length > 1 ? "s" : ""} missing</span>
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                fontWeight: 750,
                color: "#059669",
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                padding: "6px 14px",
                borderRadius: 10,
              }}
            >
              <CheckCircle2 size={14} />
              <span>All 6 sections verified &amp; ready</span>
            </div>
          )}
        </div>

        {/* Validation Alert Banner if user hits an incomplete strict condition */}
        {validationAlert && (
          <div
            style={{
              background: "#FFFBEB",
              border: "1.5px solid #FCD34D",
              borderRadius: 14,
              padding: "14px 20px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#92400E", fontSize: 13.5, fontWeight: 700 }}>
              <AlertTriangle size={18} color="#D97706" />
              <span>{validationAlert}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationAlert(null)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#92400E",
                padding: 4,
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Broad Two-Column Layout */}
        <div
          data-eora-id="eora-profile-insights"
          style={{
            display: "grid",
            gridTemplateColumns: "270px 1fr",
            gap: 28,
            alignItems: "stretch",
            marginBottom: 28,
            minHeight: 520,
          }}
        >
          {/* Left Vertical Menu with Intelligence Badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {navSections.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              // Compute tab badge
              let badgeText = "";
              let badgeColor = "#64748B";
              let badgeBg = "#F1F5F9";

              if (item.id === "personal") {
                if (isPersonalComplete) {
                  badgeText = "✓ Ready";
                  badgeColor = "#059669";
                  badgeBg = "#ECFDF5";
                } else {
                  badgeText = "Needs Year";
                  badgeColor = "#D97706";
                  badgeBg = "#FEF3C7";
                }
              } else if (item.id === "education") {
                if (isEducationComplete) {
                  badgeText = `✓ ${educationEntries.length || 1} Record`;
                  badgeColor = "#059669";
                  badgeBg = "#ECFDF5";
                } else {
                  badgeText = "Required";
                  badgeColor = "#DC2626";
                  badgeBg = "#FEE2E2";
                }
              } else if (item.id === "experience") {
                if (experiences && experiences.length > 0) {
                  badgeText = `✓ ${experiences.length} Role${experiences.length > 1 ? "s" : ""}`;
                  badgeColor = "#059669";
                  badgeBg = "#ECFDF5";
                } else if (isFresher) {
                  badgeText = "🎓 Fresher";
                  badgeColor = "#4338CA";
                  badgeBg = "#EEF2FF";
                } else {
                  badgeText = "Action Needed";
                  badgeColor = "#D97706";
                  badgeBg = "#FEF3C7";
                }
              } else if (item.id === "skills") {
                badgeText = `${displayedSkills.length} Skills`;
                badgeColor = "#059669";
                badgeBg = "#ECFDF5";
              } else if (item.id === "projects") {
                badgeText = projects.length > 0 ? `${projects.length} Proj` : "Recommended";
                badgeColor = projects.length > 0 ? "#059669" : "#64748B";
                badgeBg = projects.length > 0 ? "#ECFDF5" : "#F1F5F9";
              } else if (item.id === "achievements") {
                badgeText = achievements.length > 0 ? `${achievements.length} Honors` : "Optional";
                badgeColor = achievements.length > 0 ? "#059669" : "#64748B";
                badgeBg = achievements.length > 0 ? "#ECFDF5" : "#F1F5F9";
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setValidationAlert(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "13px 16px",
                    borderRadius: 14,
                    border: isActive ? "2px solid #5642EF" : "1.5px solid rgba(226, 232, 240, 0.9)",
                    background: isActive ? "linear-gradient(135deg, #F4F1FF 0%, #EDE6FF 100%)" : "#FFFFFF",
                    color: isActive ? "#5642EF" : "#475569",
                    fontSize: 14,
                    fontWeight: isActive ? 800 : 600,
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: isActive ? "0 4px 14px rgba(86, 66, 239, 0.15)" : "0 2px 6px rgba(0,0,0,0.02)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon size={17} color={isActive ? "#5642EF" : "#64748B"} />
                    <span>{item.label}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 750,
                      color: badgeColor,
                      background: badgeBg,
                      padding: "2px 8px",
                      borderRadius: 9999,
                    }}
                  >
                    {badgeText}
                  </span>
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
                <ShieldCheck size={16} /> Synthesized Profile
              </div>
              <div style={{ color: "#64748B", lineHeight: 1.45 }}>
                {displayedSkills.length} skills &bull; {projectsCount} confirmed project{projectsCount !== 1 ? "s" : ""}
                {isFresher ? " • Fresher status confirmed" : experiences.length > 0 ? ` • ${experiences.length} experience record(s)` : ""}
              </div>
            </div>
          </div>

          {/* Right Broad Profile Details Card with Dynamic Content based on Active Tab */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 24,
              border: "1.5px solid rgba(86, 66, 239, 0.12)",
              padding: "32px 36px",
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
                  paddingBottom: 20,
                  borderBottom: "1px solid #F1F5F9",
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #02C5F5 0%, #4564FF 50%, #9335E8 100%)",
                      color: "#FFFFFF",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 22,
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
                    <div style={{ fontSize: 13.5, color: "#64748B", fontWeight: 550 }}>
                      {[degree, specialization, institution].filter(Boolean).join(" · ") || "Academic details not added"}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: year ? "#5642EF" : "#D97706",
                        fontWeight: 750,
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {year ? (
                        <span>{year} {expectedGraduationYear ? `(Class of ${expectedGraduationYear})` : ""}</span>
                      ) : (
                        <span style={{ background: "#FEF3C7", padding: "1px 8px", borderRadius: 6 }}>
                          ⚠️ Academic year not added
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPName(studentName);
                    setPInstitution(institution);
                    setPDegree(degree);
                    setPSpec(specialization);
                    setPYear(year);
                    setPGradYear(expectedGraduationYear?.toString() || "");
                    setPEmail(email);
                    setPMobile(mobile);
                    setIsEditPersonalOpen(true);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 9999,
                    background: "rgba(86, 66, 239, 0.08)",
                    border: "1px solid rgba(86, 66, 239, 0.2)",
                    color: "#5642EF",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <Edit3 size={14} />
                  <span>Edit Data</span>
                </button>
              </div>

              {/* SECTION 1: Personal Info */}
              {activeTab === "personal" && (
                <div>
                  {/* Intelligence Layer Info Bar */}
                  <div
                    style={{
                      background: "rgba(86, 66, 239, 0.04)",
                      border: "1px solid rgba(86, 66, 239, 0.15)",
                      borderRadius: 12,
                      padding: "10px 16px",
                      marginBottom: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#3730A3", fontWeight: 700 }}>
                      <BrainCircuit size={15} color="#5642EF" />
                      <span>Academic Identity Intelligence: Synthesized from CV + Student Records</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 750, color: "#059669", background: "#ECFDF5", padding: "2px 8px", borderRadius: 6 }}>
                      Verified Credential
                    </span>
                  </div>

                  {/* Warning if Academic Year is missing */}
                  {!year && (
                    <div
                      style={{
                        background: "#FFFBEB",
                        border: "1.5px solid #FCD34D",
                        borderRadius: 12,
                        padding: "14px 18px",
                        marginBottom: 20,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#92400E", fontWeight: 750, fontSize: 13.5, marginBottom: 8 }}>
                        <AlertTriangle size={16} />
                        <span>Academic Year Missing (Required for Campus &amp; Job Placement Matching)</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: "#78350F", margin: "0 0 10px", lineHeight: 1.4 }}>
                        Select your current academic standing below to quickly confirm your profile:
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {COMMON_YEARS.map((yr) => (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => handleQuickSetYear(yr)}
                            style={{
                              background: "#FFFFFF",
                              border: "1px solid #D97706",
                              color: "#B45309",
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "5px 12px",
                              borderRadius: 8,
                              cursor: "pointer",
                            }}
                          >
                            + {yr}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 20,
                      marginBottom: 24,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Institution
                      </div>
                      <div style={{ fontSize: 15.5, fontWeight: 750, color: "#1E1B4B" }}>
                        {institution || <span style={{ color: "#EF4444" }}>Not added (Required)</span>}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Degree &amp; Academic Year
                      </div>
                      <div style={{ fontSize: 15.5, fontWeight: 750, color: "#1E1B4B" }}>
                        {[degree, year].filter(Boolean).join(" · ") || <span style={{ color: "#EF4444" }}>Not added</span>}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Department / Domain
                      </div>
                      <div style={{ fontSize: 15.5, fontWeight: 750, color: "#1E1B4B" }}>
                        {specialization || "Not specified"}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Evidence Source
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#059669", display: "flex", alignItems: "center", gap: 6 }}>
                        <FileCheck size={16} />
                        <span>Extracted from CV &amp; Student Onboarding</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: "#475569", fontWeight: 750, marginBottom: 10 }}>
                      Identified Core Competencies ({displayedSkills.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {displayedSkills.length === 0 && <span style={{ color: "#64748B" }}>No skills recorded yet.</span>}
                      {displayedSkills.map((s) => (
                        <span
                          key={s}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            background: "rgba(86, 66, 239, 0.08)",
                            border: "1px solid rgba(86, 66, 239, 0.18)",
                            color: "#5642EF",
                            fontSize: 12.5,
                            fontWeight: 700,
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: Education */}
              {activeTab === "education" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>Educational Background</h4>
                      <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>Qualifications extracted from your CV &amp; academic history</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEduInst(institution || "");
                          setEduDegree(degree || "");
                          setEduField(specialization || "");
                          setEduGradYear(expectedGraduationYear?.toString() || "");
                          setIsAddEduOpen(true);
                        }}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #5642EF",
                          color: "#5642EF",
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Plus size={14} /> Add Education
                      </button>
                      {educationEntries && educationEntries.some((e) => e.status !== "confirmed") && (
                        <button
                          type="button"
                          onClick={onConfirmAllEducation}
                          style={{
                            background: "rgba(86, 66, 239, 0.08)",
                            border: "1px solid rgba(86, 66, 239, 0.25)",
                            color: "#5642EF",
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Confirm All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Intelligence tag */}
                  <div
                    style={{
                      background: "rgba(86, 66, 239, 0.04)",
                      border: "1px solid rgba(86, 66, 239, 0.12)",
                      borderRadius: 10,
                      padding: "8px 14px",
                      fontSize: 12,
                      color: "#4338CA",
                      fontWeight: 650,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Layers size={14} />
                    <span>Academic Qualification Intelligence: Cross-referenced with degree taxonomy</span>
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <h4 style={{ fontSize: 16, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                                {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(" in ") || "Academic Qualification"}
                              </h4>
                              {edu.academicLevel && (
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", padding: "2px 7px", borderRadius: 6, textTransform: "capitalize" }}>
                                  {edu.academicLevel.replace("_", " ")}
                                </span>
                              )}
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0369A1", background: "#E0F2FE", padding: "2px 7px", borderRadius: 6 }}>
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
                                style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                          {(edu.startDate || edu.endDate || edu.graduationYear) && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#5642EF", background: "#EDE9FE", padding: "2px 8px", borderRadius: 6 }}>
                              {[edu.startDate, edu.endDate || edu.graduationYear].filter(Boolean).join(" – ")}
                            </span>
                          )}
                          {edu.gpa && (
                            <span style={{ fontSize: 11.5, fontWeight: 750, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: 6 }}>
                              CGPA: {edu.gpa}
                            </span>
                          )}
                          {edu.percentage && (
                            <span style={{ fontSize: 11.5, fontWeight: 750, color: "#0D9488", background: "#F0FDFA", border: "1px solid #99F6E4", padding: "2px 8px", borderRadius: 6 }}>
                              Score: {edu.percentage}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : institution || degree ? (
                    <div style={{ padding: "16px 20px", borderRadius: 14, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <h4 style={{ fontSize: 16, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                            {[degree, specialization].filter(Boolean).join(" in ") || "Undergraduate Degree"}
                          </h4>
                          <p style={{ fontSize: 13.5, color: "#64748B", margin: "4px 0 0" }}>{institution || "Institution not specified"}</p>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#5642EF", background: "#EDE9FE", padding: "3px 10px", borderRadius: 6 }}>
                          {year || "Year not added"}
                        </span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>
                          ✓ Inherited from verified academic enrollment
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "24px",
                        borderRadius: 14,
                        background: "#FFFBEB",
                        border: "1.5px dashed #FCD34D",
                        textAlign: "center",
                      }}
                    >
                      <GraduationCap size={28} color="#D97706" style={{ margin: "0 auto 8px" }} />
                      <h4 style={{ fontSize: 15, fontWeight: 800, color: "#92400E", margin: "0 0 4px" }}>
                        Education Details Required
                      </h4>
                      <p style={{ fontSize: 13, color: "#78350F", margin: "0 0 14px" }}>
                        Every student profile strictly requires at least one educational institution or degree.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsAddEduOpen(true)}
                        style={{
                          background: "#5642EF",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "8px 18px",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 750,
                          cursor: "pointer",
                        }}
                      >
                        + Add Education Now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3: Experience */}
              {activeTab === "experience" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>Experience &amp; Internships</h4>
                      <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>Roles, employment &amp; leadership extracted from your CV</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setIsAddExpOpen(true)}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #5642EF",
                          color: "#5642EF",
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Plus size={14} /> Add Experience
                      </button>
                      {experiences && experiences.some((e) => e.status !== "confirmed") && (
                        <button
                          type="button"
                          onClick={onConfirmAllExperience}
                          style={{
                            background: "rgba(86, 66, 239, 0.08)",
                            border: "1px solid rgba(86, 66, 239, 0.25)",
                            color: "#5642EF",
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Confirm All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Intelligence Banner */}
                  <div
                    style={{
                      background: "rgba(86, 66, 239, 0.04)",
                      border: "1px solid rgba(86, 66, 239, 0.12)",
                      borderRadius: 10,
                      padding: "8px 14px",
                      fontSize: 12,
                      color: "#4338CA",
                      fontWeight: 650,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Briefcase size={14} />
                    <span>Career Track Intelligence: Mapped to practical exposure and technical leadership</span>
                  </div>

                  {/* If Fresher mode is active */}
                  {isFresher ? (
                    <div
                      style={{
                        padding: "20px 22px",
                        borderRadius: 14,
                        background: "linear-gradient(135deg, rgba(86,66,239,0.06) 0%, rgba(2,197,245,0.06) 100%)",
                        border: "1.5px solid rgba(86, 66, 239, 0.2)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              background: "#EDE9FE",
                              display: "grid",
                              placeItems: "center",
                              color: "#5642EF",
                            }}
                          >
                            <GraduationCap size={20} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: 16, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                              Registered as Student / Fresher
                            </h4>
                            <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>
                              No prior corporate experience &bull; Focus on Projects &amp; Skills
                            </p>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 750, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "3px 9px", borderRadius: 6 }}>
                          ✓ Section Satisfied
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: "#475569", margin: "10px 0 12px", lineHeight: 1.45 }}>
                        Our AI placement layer will highlight your GitHub repositories, code contributions, and technical competencies to recruiters.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onToggleFresher?.(false);
                          setIsAddExpOpen(true);
                        }}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          color: "#475569",
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "5px 12px",
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        + Have an internship to add instead?
                      </button>
                    </div>
                  ) : experiences && experiences.length > 0 ? (
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
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", padding: "2px 7px", borderRadius: 6, textTransform: "capitalize" }}>
                                  {exp.type}
                                </span>
                              )}
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0369A1", background: "#E0F2FE", padding: "2px 7px", borderRadius: 6 }}>
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
                                style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {exp.technologies && exp.technologies.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, marginBottom: 6 }}>
                            {exp.technologies.map((tech) => (
                              <span key={tech} style={{ fontSize: 11, fontWeight: 650, color: "#3730A3", background: "#EEF2FF", padding: "1px 7px", borderRadius: 5 }}>
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
                  ) : (
                    /* EMPTY SECTION INTELLIGENCE PROMPT */
                    <div
                      style={{
                        padding: "24px",
                        borderRadius: 16,
                        background: "#FFFBEB",
                        border: "1.5px dashed #FCD34D",
                        textAlign: "center",
                      }}
                    >
                      <Briefcase size={28} color="#D97706" style={{ margin: "0 auto 8px" }} />
                      <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#92400E", margin: "0 0 6px" }}>
                        No Experience Records Found in CV or Digital Footprints
                      </h4>
                      <p style={{ fontSize: 13, color: "#78350F", maxWidth: 540, margin: "0 auto 16px", lineHeight: 1.45 }}>
                        Are you a student or fresher with no formal corporate tenure? Or do you have an internship, freelance role, or college society leadership to add?
                      </p>
                      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => {
                            onToggleFresher?.(true);
                            setValidationAlert(null);
                          }}
                          style={{
                            background: "linear-gradient(135deg, #5642EF 0%, #4338CA 100%)",
                            color: "#FFFFFF",
                            border: "none",
                            padding: "9px 18px",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 750,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            boxShadow: "0 4px 12px rgba(86,66,239,0.25)",
                          }}
                        >
                          <GraduationCap size={16} />
                          <span>I am a Fresher (No formal work experience)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddExpOpen(true)}
                          style={{
                            background: "#FFFFFF",
                            border: "1.5px solid #D97706",
                            color: "#B45309",
                            padding: "9px 18px",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 750,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Plus size={15} />
                          <span>+ Add Internship / Role</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 4: Skills */}
              {activeTab === "skills" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 750, color: "#475569" }}>
                      Synthesized Skills Breakdown ({displayedSkills.length})
                    </div>

                    {/* Inline Quick Add Skill */}
                    <form onSubmit={handleQuickAddSkill} style={{ display: "flex", gap: 6 }}>
                      <input
                        type="text"
                        value={newSkillText}
                        onChange={(e) => setNewSkillText(e.target.value)}
                        placeholder="Add skill (e.g. Next.js, PyTorch)..."
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid #CBD5E1",
                          fontSize: 12.5,
                          outline: "none",
                          width: 200,
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!newSkillText.trim()}
                        style={{
                          background: "#5642EF",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 750,
                          cursor: newSkillText.trim() ? "pointer" : "default",
                          opacity: newSkillText.trim() ? 1 : 0.6,
                        }}
                      >
                        + Add
                      </button>
                    </form>
                  </div>

                  {/* Skills Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {displayedSkills.map((sk) => (
                      <div
                        key={sk}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <span style={{ fontSize: 13.5, fontWeight: 750, color: "#1E1B4B" }}>{sk}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981", display: "flex", alignItems: "center", gap: 4 }}>
                            <CheckCircle2 size={13} /> Recorded
                          </span>
                          {onRemoveSkill && (
                            <button
                              type="button"
                              onClick={() => onRemoveSkill(sk)}
                              title={`Remove ${sk}`}
                              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2 }}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Digital Candidate Technologies */}
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
                              <button
                                type="button"
                                onClick={() => onConfirmSkill?.(tc.name)}
                                style={{ fontSize: 11, fontWeight: 700, color: "#166534", background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: 6, padding: "3px 7px", cursor: "pointer" }}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => onRejectSkill?.(tc.name, tc.source)}
                                style={{ fontSize: 11, fontWeight: 700, color: "#64748B", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 6, padding: "3px 7px", cursor: "pointer" }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                  </div>
                </div>
              )}

              {/* SECTION 5: Projects */}
              {activeTab === "projects" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>Technical Projects</h4>
                      <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>Evidence-backed projects discovered from CV &amp; GitHub</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setIsAddProjOpen(true)}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #5642EF",
                          color: "#5642EF",
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Plus size={14} /> Add Project
                      </button>
                      {projects && projects.some((p) => p.status !== "confirmed") && (
                        <button
                          type="button"
                          onClick={onConfirmAllProjects}
                          style={{
                            background: "rgba(86, 66, 239, 0.08)",
                            border: "1px solid rgba(86, 66, 239, 0.25)",
                            color: "#5642EF",
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Confirm All
                        </button>
                      )}
                    </div>
                  </div>

                  {projects && projects.length > 0 ? (
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                                {project.title}
                              </h4>
                              {project.sources && project.sources.includes("github") && (
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#1E293B", background: "#E2E8F0", padding: "2px 7px", borderRadius: 9999 }}>
                                  GitHub
                                </span>
                              )}
                              {project.sources && project.sources.includes("resume") && (
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#1E40AF", background: "#DBEAFE", padding: "2px 7px", borderRadius: 9999 }}>
                                  Source: CV
                                </span>
                              )}
                              {project.aiCategories &&
                                project.aiCategories.slice(0, 2).map((cat) => (
                                  <span key={cat} style={{ fontSize: 10.5, fontWeight: 700, color: "#6D28D9", background: "#F5F3FF", border: "1px solid #DDD6FE", padding: "1px 6px", borderRadius: 6 }}>
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
                                style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8 }}>
                          {project.technologies?.map((tech) => (
                            <span key={tech} style={{ fontSize: 11.5, fontWeight: 650, color: "#4338CA", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "2px 8px", borderRadius: 6 }}>
                              {tech}
                            </span>
                          ))}
                          {project.url && (
                            <a
                              href={project.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 11.5, color: "#2563EB", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto", fontWeight: 600 }}
                            >
                              <span>Repository</span> &rarr;
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: "24px",
                        borderRadius: 14,
                        background: "#F8FAFC",
                        border: "1.5px dashed #CBD5E1",
                        textAlign: "center",
                      }}
                    >
                      <FolderGit2 size={26} color="#64748B" style={{ margin: "0 auto 8px" }} />
                      <h4 style={{ fontSize: 15, fontWeight: 800, color: "#1E1B4B", margin: "0 0 4px" }}>
                        No Technical Projects Recorded Yet
                      </h4>
                      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 14px" }}>
                        Technical projects are the strongest evidence for recruiters to evaluate your skill depth.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsAddProjOpen(true)}
                        style={{
                          background: "#5642EF",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "8px 18px",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 750,
                          cursor: "pointer",
                        }}
                      >
                        + Add Technical Project
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 6: Achievements */}
              {activeTab === "achievements" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h4 style={{ fontSize: 15.5, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>Achievements, Research &amp; Patents</h4>
                      <p style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 0" }}>Intellectual output, papers, patents &amp; honors from your CV</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setIsAddAchOpen(true)}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #5642EF",
                          color: "#5642EF",
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Plus size={14} /> Add Achievement
                      </button>
                      {achievements && achievements.some((a) => a.status !== "confirmed") && (
                        <button
                          type="button"
                          onClick={onConfirmAllAchievements}
                          style={{
                            background: "rgba(86, 66, 239, 0.08)",
                            border: "1px solid rgba(86, 66, 239, 0.25)",
                            color: "#5642EF",
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Confirm All
                        </button>
                      )}
                    </div>
                  </div>

                  {achievements && achievements.length > 0 ? (
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
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#6D28D9", background: "#F5F3FF", border: "1px solid #DDD6FE", padding: "1px 7px", borderRadius: 6, textTransform: "capitalize" }}>
                                  {ach.subType ? ach.subType.replace("_", " ") : ach.category}
                                </span>
                              )}
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0369A1", background: "#E0F2FE", padding: "2px 7px", borderRadius: 6 }}>
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
                              style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: "24px",
                        borderRadius: 14,
                        background: "#F8FAFC",
                        border: "1.5px dashed #CBD5E1",
                        textAlign: "center",
                      }}
                    >
                      <Award size={26} color="#64748B" style={{ margin: "0 auto 8px" }} />
                      <h4 style={{ fontSize: 15, fontWeight: 800, color: "#1E1B4B", margin: "0 0 4px" }}>
                        No Achievements or Research Papers Extracted
                      </h4>
                      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 14px" }}>
                        Optional section. Add hackathon placements, patent applications, or academic honors.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsAddAchOpen(true)}
                        style={{
                          background: "#5642EF",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "8px 18px",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 750,
                          cursor: "pointer",
                        }}
                      >
                        + Add Achievement or Honor
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Status Bar */}
            <div style={{ paddingTop: 20, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
              <span style={{ fontSize: 13, color: "#64748B" }}>
                Review these details before finalizing your synthesized profile.
              </span>
              {missingItems.length === 0 ? (
                <span style={{ fontSize: 13, fontWeight: 800, color: "#10B981", display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={16} /> Ready for review
                </span>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 800, color: "#D97706", display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={15} /> {missingItems[0]} required
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <ScreenFooter
          onBack={onBack}
          onNext={handleProceedClick}
          onJumpToStep={onJumpToStep}
          activeStep={8}
          totalSteps={10}
          nextLabel="Looks Good"
        />
      </main>

      {/* ======================================================== */}
      {/* MODAL 1: Edit Personal Info                              */}
      {/* ======================================================== */}
      {isEditPersonalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              maxWidth: 580,
              width: "100%",
              padding: "28px 32px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 850, color: "#1E1B4B", margin: 0 }}>
                Edit Personal &amp; Academic Data
              </h3>
              <button
                type="button"
                onClick={() => setIsEditPersonalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Full Name</label>
                <input
                  type="text"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Institution / College</label>
                <input
                  type="text"
                  value={pInstitution}
                  onChange={(e) => setPInstitution(e.target.value)}
                  placeholder="e.g. Lovely Professional University"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Degree</label>
                <input
                  type="text"
                  value={pDegree}
                  onChange={(e) => setPDegree(e.target.value)}
                  placeholder="e.g. B.Tech, BCA, MCA"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Department / Major</label>
                <input
                  type="text"
                  value={pSpec}
                  onChange={(e) => setPSpec(e.target.value)}
                  placeholder="e.g. Computer Science"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Academic Year *</label>
                <select
                  value={pYear}
                  onChange={(e) => setPYear(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5, background: "#FFFFFF" }}
                >
                  <option value="">Select Year...</option>
                  {COMMON_YEARS.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Graduation Year</label>
                <input
                  type="number"
                  value={pGradYear}
                  onChange={(e) => setPGradYear(e.target.value)}
                  placeholder="e.g. 2026"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsEditPersonalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdatePersonalInfo?.({
                    name: pName,
                    institution: pInstitution,
                    degree: pDegree,
                    specialization: pSpec,
                    year: pYear,
                    expectedGraduationYear: pGradYear ? Number(pGradYear) : undefined,
                  });
                  setIsEditPersonalOpen(false);
                  setValidationAlert(null);
                }}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5642EF", color: "#FFFFFF", fontWeight: 750, cursor: "pointer" }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: Add Education Entry                             */}
      {/* ======================================================== */}
      {isAddEduOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              maxWidth: 520,
              width: "100%",
              padding: "26px 30px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 850, color: "#1E1B4B", margin: 0 }}>
                Add Educational Degree
              </h3>
              <button
                type="button"
                onClick={() => setIsAddEduOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Institution Name *</label>
                <input
                  type="text"
                  value={eduInst}
                  onChange={(e) => setEduInst(e.target.value)}
                  placeholder="e.g. Lovely Professional University (LPU)"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Degree Title *</label>
                  <input
                    type="text"
                    value={eduDegree}
                    onChange={(e) => setEduDegree(e.target.value)}
                    placeholder="e.g. B.Tech Computer Science"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Field of Study</label>
                  <input
                    type="text"
                    value={eduField}
                    onChange={(e) => setEduField(e.target.value)}
                    placeholder="e.g. CSE / AI"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Graduation Year</label>
                  <input
                    type="text"
                    value={eduGradYear}
                    onChange={(e) => setEduGradYear(e.target.value)}
                    placeholder="e.g. 2026"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>CGPA or Score</label>
                  <input
                    type="text"
                    value={eduScore}
                    onChange={(e) => setEduScore(e.target.value)}
                    placeholder="e.g. 8.5 CGPA or 85%"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsAddEduOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!eduInst.trim() || !eduDegree.trim()}
                onClick={() => {
                  onAddEducation?.({
                    institution: eduInst.trim(),
                    degree: eduDegree.trim(),
                    fieldOfStudy: eduField.trim() || undefined,
                    graduationYear: eduGradYear.trim() || undefined,
                    gpa: eduScore.trim() || undefined,
                    academicLevel: eduLevel,
                    source: "User Confirmed",
                    status: "confirmed",
                  });
                  setIsAddEduOpen(false);
                  setEduInst("");
                  setEduDegree("");
                  setEduField("");
                  setEduGradYear("");
                  setEduScore("");
                  setValidationAlert(null);
                }}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5642EF", color: "#FFFFFF", fontWeight: 750, cursor: "pointer" }}
              >
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: Add Experience Entry                            */}
      {/* ======================================================== */}
      {isAddExpOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              maxWidth: 520,
              width: "100%",
              padding: "26px 30px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 850, color: "#1E1B4B", margin: 0 }}>
                Add Internship or Work Experience
              </h3>
              <button
                type="button"
                onClick={() => setIsAddExpOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Company / Organization *</label>
                  <input
                    type="text"
                    value={expCompany}
                    onChange={(e) => setExpCompany(e.target.value)}
                    placeholder="e.g. Google, Startup, Labs"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Role / Job Title *</label>
                  <input
                    type="text"
                    value={expRole}
                    onChange={(e) => setExpRole(e.target.value)}
                    placeholder="e.g. ML Intern, Web Dev"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Role Type</label>
                  <select
                    value={expType}
                    onChange={(e) => setExpType(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5, background: "#FFFFFF" }}
                  >
                    <option value="internship">Internship</option>
                    <option value="research">Research Assistant</option>
                    <option value="freelance">Freelance</option>
                    <option value="full_time">Full-time</option>
                    <option value="society">Club / Society Leadership</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Duration / Dates</label>
                  <input
                    type="text"
                    value={expDuration}
                    onChange={(e) => setExpDuration(e.target.value)}
                    placeholder="e.g. Jun 2024 – Aug 2024"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Key Highlights / Responsibilities</label>
                <textarea
                  rows={2}
                  value={expHighlight}
                  onChange={(e) => setExpHighlight(e.target.value)}
                  placeholder="e.g. Built FastAPI backend, reduced query latency by 35%..."
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Technologies Used (comma separated)</label>
                <input
                  type="text"
                  value={expTech}
                  onChange={(e) => setExpTech(e.target.value)}
                  placeholder="e.g. Python, Docker, PyTorch"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsAddExpOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!expCompany.trim() || !expRole.trim()}
                onClick={() => {
                  onAddExperience?.({
                    company: expCompany.trim(),
                    role: expRole.trim(),
                    type: expType,
                    duration: expDuration.trim() || undefined,
                    highlights: expHighlight.trim() ? [expHighlight.trim()] : undefined,
                    technologies: expTech.trim() ? expTech.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
                    source: "User Added",
                    status: "confirmed",
                  });
                  onToggleFresher?.(false);
                  setIsAddExpOpen(false);
                  setExpCompany("");
                  setExpRole("");
                  setExpDuration("");
                  setExpHighlight("");
                  setExpTech("");
                  setValidationAlert(null);
                }}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5642EF", color: "#FFFFFF", fontWeight: 750, cursor: "pointer" }}
              >
                Save Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: Add Project Entry                               */}
      {/* ======================================================== */}
      {isAddProjOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              maxWidth: 520,
              width: "100%",
              padding: "26px 30px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 850, color: "#1E1B4B", margin: 0 }}>
                Add Technical Project
              </h3>
              <button
                type="button"
                onClick={() => setIsAddProjOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Project Title *</label>
                <input
                  type="text"
                  value={projTitle}
                  onChange={(e) => setProjTitle(e.target.value)}
                  placeholder="e.g. TeachGenie AI RAG Assistant"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Description *</label>
                <textarea
                  rows={2}
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="e.g. Developed high-performance RAG pipeline with Supabase vector search..."
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Technologies (comma separated)</label>
                <input
                  type="text"
                  value={projTech}
                  onChange={(e) => setProjTech(e.target.value)}
                  placeholder="e.g. React, FastAPI, PostgreSQL, LangChain"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Repository / Live URL</label>
                  <input
                    type="url"
                    value={projUrl}
                    onChange={(e) => setProjUrl(e.target.value)}
                    placeholder="https://github.com/..."
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>AI / Domain Classification</label>
                  <input
                    type="text"
                    value={projCategory}
                    onChange={(e) => setProjCategory(e.target.value)}
                    placeholder="e.g. AI / GenAI, Full Stack"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsAddProjOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!projTitle.trim() || !projDesc.trim()}
                onClick={() => {
                  onAddProject?.({
                    title: projTitle.trim(),
                    description: projDesc.trim(),
                    technologies: projTech.trim() ? projTech.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
                    url: projUrl.trim() || undefined,
                    aiCategories: projCategory.trim() ? [projCategory.trim()] : undefined,
                    sources: ["manual"],
                    status: "confirmed",
                  });
                  setIsAddProjOpen(false);
                  setProjTitle("");
                  setProjDesc("");
                  setProjTech("");
                  setProjUrl("");
                  setValidationAlert(null);
                }}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5642EF", color: "#FFFFFF", fontWeight: 750, cursor: "pointer" }}
              >
                Save Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: Add Achievement Entry                           */}
      {/* ======================================================== */}
      {isAddAchOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              maxWidth: 520,
              width: "100%",
              padding: "26px 30px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 850, color: "#1E1B4B", margin: 0 }}>
                Add Achievement or Honor
              </h3>
              <button
                type="button"
                onClick={() => setIsAddAchOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Title of Achievement / Honor *</label>
                <input
                  type="text"
                  value={achTitle}
                  onChange={(e) => setAchTitle(e.target.value)}
                  placeholder="e.g. Smart India Hackathon Finalist"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Category</label>
                  <select
                    value={achCategory}
                    onChange={(e) => setAchCategory(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5, background: "#FFFFFF" }}
                  >
                    <option value="Award">Award / Honor</option>
                    <option value="Hackathon">Hackathon / Contest</option>
                    <option value="Patent">Patent Application</option>
                    <option value="Publication">Research Paper</option>
                    <option value="Certification">Certification</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Issuer / Organization</label>
                  <input
                    type="text"
                    value={achIssuer}
                    onChange={(e) => setAchIssuer(e.target.value)}
                    placeholder="e.g. Ministry of Education"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Description</label>
                <textarea
                  rows={2}
                  value={achDesc}
                  onChange={(e) => setAchDesc(e.target.value)}
                  placeholder="e.g. Awarded certificate of recognition among 1000+ teams..."
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13.5 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsAddAchOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!achTitle.trim()}
                onClick={() => {
                  onAddAchievement?.({
                    title: achTitle.trim(),
                    category: achCategory,
                    issuer: achIssuer.trim() || undefined,
                    description: achDesc.trim() || undefined,
                    source: "User Added",
                    status: "confirmed",
                  });
                  setIsAddAchOpen(false);
                  setAchTitle("");
                  setAchIssuer("");
                  setAchDesc("");
                  setValidationAlert(null);
                }}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5642EF", color: "#FFFFFF", fontWeight: 750, cursor: "pointer" }}
              >
                Save Achievement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
