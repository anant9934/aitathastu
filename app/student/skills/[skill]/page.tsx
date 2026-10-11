"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FolderGit2,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  BookOpen,
  Target,
  Award,
  Layers,
  HelpCircle,
  Network,
  Send,
  Info,
  Clock,
  UserCheck,
} from "lucide-react";

type SkillDetailData = {
  name: string;
  canonicalName: string;
  category: string;
  state: "Verified" | "Demonstrated" | "Evidence available" | "Claimed" | "Unknown";
  level?: "Not assessed" | "Claimed" | "Exposure recorded" | "Applied evidence available" | "Demonstrated" | "Assessed" | "Verified";
  goalRelevance?: "required_core" | "recommended" | "complementary" | "elective";
  isGoalPrerequisite?: boolean;
  evidenceCount: number;
  evidenceItems: Array<{
    id: string;
    source: string;
    verificationStatus: string;
    sourceReference: string | null;
    observedAt: string;
    interpretation: string;
  }>;
  relatedProjects: Array<{
    id: string;
    title: string;
    repositoryUrl?: string | null;
    personalContributionRoles: string[];
    description?: string;
  }>;
  personalContribution?: {
    confirmed: boolean;
    projectTitle?: string;
    projectId?: string;
    featureImplemented?: string;
    componentDescription?: string;
    isThirdPartyVerified: boolean;
  };
  dimensions?: {
    selfAssessedKnowledge: string;
    observedTechnicalEvidence: {
      count: number;
      files: string[];
      repositories: string[];
      platforms: string[];
    };
    demonstratedApplication: {
      projectCount: number;
      projects: Array<{
        id: string;
        title: string;
        repositoryUrl?: string | null;
        roles: string[];
        description?: string;
      }>;
    };
    assessedCompetency: {
      assessed: boolean;
      score?: number;
      testTitle?: string;
      assessedAt?: string;
    };
    independentVerification: {
      verified: boolean;
      verifiedBy?: string;
      verifiedAt?: string;
      method?: string;
    };
  };
  sevenQuestions?: {
    whatIsThisSkill: {
      name: string;
      category: string;
      definition: string;
    };
    whereWasItObserved: {
      sources: string[];
      observations: Array<{
        source: string;
        sourceReference: string | null;
        details: string;
      }>;
    };
    howWasItUsed: {
      usageSummary: string;
      projects: string[];
      manifestsOrFiles: string[];
    };
    whatDidStudentPersonallyContribute: {
      hasContribution: boolean;
      statement: string;
      roles: string[];
      fileReference?: string;
    };
    howMuchKnowledgeDemonstrated: {
      level: string;
      explanation: string;
      isVerified: boolean;
    };
    whatEvidenceIsMissing: {
      missingPoints: string[];
    };
    whatShouldStudentLearnOrProveNext: {
      action: string;
      suggestedTask: string;
      assessmentAvailable: boolean;
    };
  };
  graph?: {
    nodes: Array<{ id: string; type: string; label: string }>;
    edges: Array<{ id: string; from: string; to: string; relationship: string; label: string }>;
  };
  whyTathastuThinksThis: string;
  conciseExplanation?: string;
  whatToImprove: string;
  learningPath: Array<{
    title: string;
    source: string;
    type: string;
  }>;
  lastObservedAt: string;
};

export default function SkillDetailPage() {
  const params = useParams();
  const rawSkill = (params?.skill as string) || "";
  const skillName = decodeURIComponent(rawSkill);

  const [data, setData] = useState<SkillDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"questions" | "dimensions" | "graph" | "confirm">(
    "questions"
  );

  // 5 Contextual Contribution form states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [contribProjectId, setContribProjectId] = useState("");
  const [roleInProject, setRoleInProject] = useState("Core Developer");
  const [codebaseParts, setCodebaseParts] = useState("");
  const [challengesSolved, setChallengesSolved] = useState("");
  const [projectType, setProjectType] = useState<"solo" | "team" | "forked">("solo");
  const [liveComfortLevel, setLiveComfortLevel] = useState<"high" | "medium" | "developing">("high");
  const [submittingContrib, setSubmittingContrib] = useState(false);
  const [contribSuccessMsg, setContribSuccessMsg] = useState<string | null>(null);

  const loadDetail = async () => {
    try {
      const res = await fetch(`/api/student/skills/${encodeURIComponent(skillName)}`);
      if (res.ok) {
        const detail = await res.json();
        setData(detail);
        if (detail.relatedProjects?.length > 0 && !contribProjectId) {
          setContribProjectId(detail.relatedProjects[0].id);
        }
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (skillName) {
      loadDetail();
    }
  }, [skillName]);

  const handleSaveContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribProjectId) {
      alert("Please select or specify a project.");
      return;
    }

    setSubmittingContrib(true);
    setContribSuccessMsg(null);
    try {
      const res = await fetch(`/api/student/skills/${encodeURIComponent(skillName)}/contribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: contribProjectId,
          roleInProject,
          codebaseParts,
          challengesSolved,
          projectType,
          liveComfortLevel,
        }),
      });

      if (res.ok) {
        setContribSuccessMsg(
          "Personal contribution recorded! State updated to Demonstrated. (Note: Student confirmation is self-reported, not third-party proof)."
        );
        setShowConfirmModal(false);
        await loadDetail();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to save contribution.");
      }
    } catch {
      alert("Error saving contribution. Please try again.");
    } finally {
      setSubmittingContrib(false);
    }
  };

  const getLevelBadge = (level?: string, state?: string) => {
    const effective = level || state;
    switch (effective) {
      case "Verified":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 700,
              background: "#DEF7EC",
              color: "#03543F",
              border: "1px solid #A7F3D0",
            }}
          >
            <ShieldCheck size={13} /> Verified
          </span>
        );
      case "Assessed":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 700,
              background: "#E0F2FE",
              color: "#0369A1",
              border: "1px solid #BAE6FD",
            }}
          >
            <Award size={13} /> Assessed
          </span>
        );
      case "Demonstrated":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 700,
              background: "#EDE9FE",
              color: "#5942DC",
              border: "1px solid #DDD6FE",
            }}
          >
            <FolderGit2 size={13} /> Demonstrated
          </span>
        );
      case "Applied evidence available":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 700,
              background: "#EFF6FF",
              color: "#2563EB",
              border: "1px solid #DBEAFE",
            }}
          >
            <TrendingUp size={13} /> Applied evidence available
          </span>
        );
      case "Exposure recorded":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 700,
              background: "#F1F5F9",
              color: "#475569",
              border: "1px solid #CBD5E1",
            }}
          >
            <BookOpen size={13} /> Exposure recorded
          </span>
        );
      case "Claimed":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 700,
              background: "#FEF3C7",
              color: "#D97706",
              border: "1px solid #FDE68A",
            }}
          >
            <AlertCircle size={13} /> Claimed
          </span>
        );
      default:
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 700,
              background: "#F3F4F6",
              color: "#6B7280",
              border: "1px solid #E5E7EB",
            }}
          >
            Not assessed
          </span>
        );
    }
  };

  const getRelevanceBadge = (relevance?: string) => {
    switch (relevance) {
      case "required_core":
        return (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 800,
              background: "#FAF5FF",
              color: "#7E22CE",
              border: "1px solid #E9D5FF",
            }}
          >
            CORE REQUIRED
          </span>
        );
      case "recommended":
        return (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              background: "#F0F9FF",
              color: "#0284C7",
              border: "1px solid #BAE6FD",
            }}
          >
            RECOMMENDED
          </span>
        );
      default:
        return null;
    }
  };

  const sq = data?.sevenQuestions;
  const dims = data?.dimensions;

  return (
    <div style={{ minHeight: "100vh", background: "#F9F8F5", color: "#171626" }}>
      {/* Header */}
      <header
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: 1040,
            marginInline: "auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              href="/student/skills"
              style={{
                padding: "8px",
                borderRadius: 8,
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                color: "#4B5563",
                display: "inline-flex",
                alignItems: "center",
              }}
              aria-label="Back to skills list"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#171626" }}>
                  {data?.canonicalName || skillName}
                </h1>
                {data && getLevelBadge(data.level, data.state)}
                {data && getRelevanceBadge(data.goalRelevance)}
              </div>
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                {data?.category || "Technology"} • Conservative Evidence Evaluation
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: "#EDE9FE",
                color: "#5942DC",
                border: "1px solid #DDD6FE",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <UserCheck size={14} /> Confirm Contribution
            </button>
            <Link
              href="/student/roadmap"
              style={{ fontSize: 13, fontWeight: 700, color: "#5942DC", textDecoration: "none" }}
            >
              Roadmap &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 1040, marginInline: "auto", padding: "28px 20px 80px" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
            Calculating explainable skill intelligence...
          </div>
        ) : !data ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
            Skill not found.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {contribSuccessMsg && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "#DEF7EC",
                  color: "#03543F",
                  border: "1px solid #A7F3D0",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {contribSuccessMsg}
              </div>
            )}

            {/* Concise Truthful Synthesis Banner */}
            <section
              data-eora-id="eora-skill-detail-card"
              style={{
                padding: 24,
                borderRadius: 16,
                background: "#FFFFFF",
                border: "1.5px solid #EDE9FE",
                boxShadow: "0 2px 8px rgba(89, 66, 220, 0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                <Sparkles size={22} color="#5942DC" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: 0 }}>
                    Deterministic Evidence Synthesis
                  </h2>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                    Strictly synthesized from verified database records and code manifests
                  </p>
                </div>
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: "#1E293B",
                  lineHeight: 1.6,
                  background: "#F8FAFC",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                {data.conciseExplanation || data.whyTathastuThinksThis}
              </p>
            </section>

            {/* Navigation Tabs */}
            <div
              style={{
                display: "flex",
                gap: 8,
                borderBottom: "1px solid #E5E7EB",
                paddingBottom: 4,
              }}
            >
              {[
                { id: "questions", label: "7 Core Questions", icon: HelpCircle },
                { id: "dimensions", label: "5 Proficiency Dimensions", icon: Layers },
                { id: "graph", label: "Canonical Evidence Graph", icon: Network },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      border: "none",
                      background: isActive ? "#5942DC" : "transparent",
                      color: isActive ? "#FFFFFF" : "#6B7280",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Icon size={15} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: 7 CORE QUESTIONS */}
            {activeTab === "questions" && sq && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Q1 */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#5942DC", textTransform: "uppercase" }}>
                    Question 1
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: "4px 0 8px" }}>
                    What is this skill?
                  </h3>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: 0 }}>
                    {sq.whatIsThisSkill.definition}
                  </p>
                </div>

                {/* Q2 */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#5942DC", textTransform: "uppercase" }}>
                    Question 2
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: "4px 0 8px" }}>
                    Where was it observed?
                  </h3>
                  {sq.whereWasItObserved.observations.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#64748B", margin: 0, fontStyle: "italic" }}>
                      Not yet observed in your profile or connected sources. Missing evidence is not proof that you lack the skill.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      {sq.whereWasItObserved.observations.map((obs, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            background: "#F8FAFC",
                            border: "1px solid #E2E8F0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                color: "#2563EB",
                              }}
                            >
                              {obs.source}
                            </span>
                            <p style={{ fontSize: 13, color: "#1E293B", margin: "2px 0 0" }}>
                              {obs.details}
                            </p>
                          </div>
                          {obs.sourceReference && (
                            <span style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>
                              {obs.sourceReference}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Q3 */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#5942DC", textTransform: "uppercase" }}>
                    Question 3
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: "4px 0 8px" }}>
                    How was it used?
                  </h3>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "0 0 10px" }}>
                    {sq.howWasItUsed.usageSummary}
                  </p>
                  {sq.howWasItUsed.projects.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {sq.howWasItUsed.projects.map((p, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: "#EDE9FE",
                            color: "#5942DC",
                          }}
                        >
                          Project: {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Q4 */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#5942DC", textTransform: "uppercase" }}>
                        Question 4
                      </span>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: "4px 0 8px" }}>
                        What did the student personally contribute?
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(true)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "#F3F4F6",
                        border: "1px solid #D1D5DB",
                        color: "#374151",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Update confirmation
                    </button>
                  </div>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "0 0 8px" }}>
                    {sq.whatDidStudentPersonallyContribute.statement}
                  </p>
                  {sq.whatDidStudentPersonallyContribute.roles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {sq.whatDidStudentPersonallyContribute.roles.map((r, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "#EDE9FE",
                            color: "#5942DC",
                          }}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                  <p
                    style={{
                      fontSize: 11,
                      color: "#64748B",
                      fontStyle: "italic",
                      margin: 0,
                      background: "#F8FAFC",
                      padding: 8,
                      borderRadius: 6,
                    }}
                  >
                    Note: Personal contribution statements are self-confirmed by the student. Tathastu presents them as personal claims, not third-party verified proof.
                  </p>
                </div>

                {/* Q5 */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#5942DC", textTransform: "uppercase" }}>
                    Question 5
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: "4px 0 8px" }}>
                    How much knowledge has actually been demonstrated?
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    {getLevelBadge(sq.howMuchKnowledgeDemonstrated.level)}
                  </div>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: 0 }}>
                    {sq.howMuchKnowledgeDemonstrated.explanation}
                  </p>
                </div>

                {/* Q6 */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#D97706", textTransform: "uppercase" }}>
                    Question 6
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: "4px 0 8px" }}>
                    What evidence is missing?
                  </h3>
                  {sq.whatEvidenceIsMissing.missingPoints.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#059669", fontWeight: 600, margin: 0 }}>
                      No gaps identified. All primary evidence forms have been observed.
                    </p>
                  ) : (
                    <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13, color: "#475569" }}>
                      {sq.whatEvidenceIsMissing.missingPoints.map((pt, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Q7 */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    background: "#FFFFFF",
                    border: "1.5px solid #DDD6FE",
                    boxShadow: "0 2px 8px rgba(89, 66, 220, 0.03)",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#5942DC", textTransform: "uppercase" }}>
                    Question 7
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: "4px 0 8px" }}>
                    What should the student learn or prove next?
                  </h3>
                  <p style={{ fontSize: 13, color: "#1E293B", fontWeight: 600, margin: "0 0 6px" }}>
                    {sq.whatShouldStudentLearnOrProveNext.action}
                  </p>
                  <p style={{ fontSize: 13, color: "#475569", margin: "0 0 14px" }}>
                    {sq.whatShouldStudentLearnOrProveNext.suggestedTask}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    {data.learningPath.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "#5942DC", marginBottom: 2 }}>
                          <span>{step.type}</span>
                          <span style={{ color: "#64748B" }}>{step.source}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                          {step.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 5 PROFICIENCY DIMENSIONS */}
            {activeTab === "dimensions" && dims && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                {/* Dim 1: Self-Assessed Knowledge */}
                <div style={{ padding: 20, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>DIMENSION 1</span>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#171626", margin: "4px 0 10px" }}>
                    Self-Assessed Knowledge
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "#5942DC" }}>
                      {dims.selfAssessedKnowledge}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
                    Claimed confidence level recorded in resume profile or self-intake surveys.
                  </p>
                </div>

                {/* Dim 2: Observed Technical Evidence */}
                <div style={{ padding: 20, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>DIMENSION 2</span>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#171626", margin: "4px 0 10px" }}>
                    Observed Technical Evidence
                  </h3>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#2563EB", display: "block", marginBottom: 8 }}>
                    {dims.observedTechnicalEvidence.count} observations
                  </span>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    <span>{dims.observedTechnicalEvidence.repositories.length} repositories</span> •{" "}
                    <span>{dims.observedTechnicalEvidence.platforms.length} platforms</span>
                  </div>
                </div>

                {/* Dim 3: Demonstrated Application */}
                <div style={{ padding: 20, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>DIMENSION 3</span>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#171626", margin: "4px 0 10px" }}>
                    Demonstrated Application
                  </h3>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#7E22CE", display: "block", marginBottom: 8 }}>
                    {dims.demonstratedApplication.projectCount} project(s)
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {dims.demonstratedApplication.projects.slice(0, 3).map((p) => (
                      <span key={p.id} style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
                        • {p.title}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Dim 4: Assessed Competency */}
                <div style={{ padding: 20, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>DIMENSION 4</span>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#171626", margin: "4px 0 10px" }}>
                    Assessed Competency
                  </h3>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: dims.assessedCompetency.assessed ? "#059669" : "#6B7280",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    {dims.assessedCompetency.assessed
                      ? `Assessed (${dims.assessedCompetency.score ? `${dims.assessedCompetency.score}%` : "Passed"})`
                      : "Not assessed yet"}
                  </span>
                  <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
                    {dims.assessedCompetency.testTitle || "Take an ERIS topic test or coding challenge to record evaluated proof."}
                  </p>
                </div>

                {/* Dim 5: Independent Verification */}
                <div style={{ padding: 20, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>DIMENSION 5</span>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#171626", margin: "4px 0 10px" }}>
                    Independent Verification
                  </h3>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: dims.independentVerification.verified ? "#059669" : "#6B7280",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    {dims.independentVerification.verified ? "Faculty Verified" : "Unverified"}
                  </span>
                  <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
                    Requires third-party faculty sign-off, industry certification, or supervised proctored evaluation.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: CANONICAL EVIDENCE GRAPH */}
            {activeTab === "graph" && (
              <div
                style={{
                  padding: 24,
                  borderRadius: 16,
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Network size={20} color="#5942DC" />
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: 0 }}>
                      Canonical Skill Traceability Graph
                    </h3>
                    <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
                      Skill &rarr; Project &rarr; Repository &rarr; File &rarr; Contribution &rarr; Assessment
                    </p>
                  </div>
                </div>

                {data.graph ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {data.graph.nodes.map((node) => (
                        <div
                          key={node.id}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 10,
                            background:
                              node.type === "skill"
                                ? "#EDE9FE"
                                : node.type === "project"
                                ? "#DBEAFE"
                                : node.type === "repository"
                                ? "#FEF3C7"
                                : node.type === "assessment"
                                ? "#DEF7EC"
                                : "#F3F4F6",
                            color:
                              node.type === "skill"
                                ? "#5942DC"
                                : node.type === "project"
                                ? "#1D4ED8"
                                : node.type === "repository"
                                ? "#B45309"
                                : node.type === "assessment"
                                ? "#047857"
                                : "#374151",
                            border: "1px solid rgba(0,0,0,0.06)",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          <span style={{ fontSize: 10, textTransform: "uppercase", opacity: 0.8, display: "block" }}>
                            {node.type}
                          </span>
                          {node.label}
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: "#171626", marginBottom: 8 }}>
                        Traceable Evidence Relationships
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {data.graph.edges.map((edge) => (
                          <div
                            key={edge.id}
                            style={{
                              fontSize: 12,
                              color: "#475569",
                              padding: "6px 12px",
                              background: "#F8FAFC",
                              borderRadius: 6,
                              border: "1px solid #E2E8F0",
                            }}
                          >
                            <strong>{edge.label}</strong>: {edge.from} &rarr; {edge.to}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
                    No graph connections recorded yet.
                  </p>
                )}
              </div>
            )}

            {/* CONFIRMATION DRAWER / MODAL */}
            {showConfirmModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 50,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 16,
                    maxWidth: 580,
                    width: "100%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    padding: 24,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#171626" }}>
                        Confirm Personal Contribution
                      </h3>
                      <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0" }}>
                        Confirm your individual hands-on work with {data.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#6B7280" }}
                    >
                      &times;
                    </button>
                  </div>

                  {/* Prominent Truthfulness Disclosure */}
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      fontSize: 12,
                      color: "#1E40AF",
                      marginBottom: 16,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Architectural Disclosure:</strong> Your confirmation is stored as <em>student-confirmed evidence</em>. It advances your skill status to <strong>Demonstrated</strong>, but is transparently labeled as a self-reported claim, not third-party proof.
                  </div>

                  <form onSubmit={handleSaveContribution} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Select Project */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                        Project
                      </label>
                      {data.relatedProjects.length > 0 ? (
                        <select
                          value={contribProjectId}
                          onChange={(e) => setContribProjectId(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #D1D5DB",
                            fontSize: 13,
                          }}
                        >
                          {data.relatedProjects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Project title or ID"
                          value={contribProjectId}
                          onChange={(e) => setContribProjectId(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #D1D5DB",
                            fontSize: 13,
                          }}
                          required
                        />
                      )}
                    </div>

                    {/* Question 1: Role */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                        1. What was your role in this project?
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Sole Author, Lead ML Developer, Pipeline Engineer"
                        value={roleInProject}
                        onChange={(e) => setRoleInProject(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #D1D5DB",
                          fontSize: 13,
                        }}
                        required
                      />
                    </div>

                    {/* Question 2: Codebase parts */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                        2. Which parts of the codebase did you personally write or modify?
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Data preprocessing pipeline, API endpoints, Model training loop"
                        value={codebaseParts}
                        onChange={(e) => setCodebaseParts(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #D1D5DB",
                          fontSize: 13,
                        }}
                        required
                      />
                    </div>

                    {/* Question 3: Challenges solved */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                        3. What challenges did you solve using this skill?
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Implemented batching to avoid OOM, optimized latency"
                        value={challengesSolved}
                        onChange={(e) => setChallengesSolved(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #D1D5DB",
                          fontSize: 13,
                        }}
                        required
                      />
                    </div>

                    {/* Question 4: Project type */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                        4. Was this a solo, team, or cloned/forked project?
                      </label>
                      <select
                        value={projectType}
                        onChange={(e) => setProjectType(e.target.value as typeof projectType)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #D1D5DB",
                          fontSize: 13,
                        }}
                      >
                        <option value="solo">Solo Project</option>
                        <option value="team">Team Collaboration</option>
                        <option value="forked">Cloned / Forked & Extended</option>
                      </select>
                    </div>

                    {/* Question 5: Comfort Level */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                        5. How would you rate your comfort level if asked to demonstrate this live?
                      </label>
                      <select
                        value={liveComfortLevel}
                        onChange={(e) => setLiveComfortLevel(e.target.value as typeof liveComfortLevel)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #D1D5DB",
                          fontSize: 13,
                        }}
                      >
                        <option value="high">High — Confident explaining and writing live</option>
                        <option value="medium">Medium — Competent with documentation access</option>
                        <option value="developing">Developing — Need more practice</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => setShowConfirmModal(false)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          background: "#F3F4F6",
                          border: "1px solid #D1D5DB",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingContrib}
                        style={{
                          padding: "8px 18px",
                          borderRadius: 8,
                          background: "#5942DC",
                          color: "#FFFFFF",
                          border: "none",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          opacity: submittingContrib ? 0.7 : 1,
                        }}
                      >
                        {submittingContrib ? "Recording..." : "Save Contribution"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
