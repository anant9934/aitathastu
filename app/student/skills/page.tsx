"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Search,
  CheckCircle2,
  FolderGit2,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  ShieldCheck,
  Award,
  Target,
  BookOpen,
  Filter,
} from "lucide-react";

type SkillItem = {
  name: string;
  category: "AI & ML" | "GenAI" | "Data" | "Backend" | "Tools" | "Cloud" | "Languages" | "Other";
  state: "Verified" | "Demonstrated" | "Evidence available" | "Claimed" | "Unknown";
  level?: "Not assessed" | "Claimed" | "Exposure recorded" | "Applied evidence available" | "Demonstrated" | "Assessed" | "Verified";
  goalRelevance?: "required_core" | "recommended" | "complementary" | "elective";
  isGoalPrerequisite?: boolean;
  evidenceCount: number;
  relatedProjects: Array<{ id: string; title: string }>;
  whyTathastuThinksThis: string;
  conciseExplanation?: string;
  lastObservedAt: string;
};

type MissingGoalSkill = {
  name: string;
  category: string;
  relevance: "required_core" | "recommended" | "complementary" | "elective";
  suggestedTask: string;
};

type SkillsData = {
  skills: SkillItem[];
  missingGoalSkills?: MissingGoalSkill[];
  targetRole?: string;
  stats: {
    totalSkills?: number;
    trackedSkills?: number;
    evidencedSkills?: number;
    demonstratedSkills: number;
    assessedSkills?: number;
    verifiedSkills: number;
    totalProjects: number;
    totalEvidence: number;
  };
  activeGoal: string;
};

export default function SkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedRelevance, setSelectedRelevance] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadSkills() {
      try {
        const res = await fetch("/api/student/skills");
        if (res.ok) {
          const resData = await res.json();
          setData(resData);
          setError(null);
        } else {
          const result = await res.json().catch(() => ({}));
          setError(result.error || "Could not load skills.");
        }
      } catch {
        setError("Could not load skills. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    }
    loadSkills();
    window.addEventListener("focus", loadSkills);
    return () => window.removeEventListener("focus", loadSkills);
  }, []);

  const categories = ["All", "AI & ML", "GenAI", "Data", "Backend", "Tools", "Cloud", "Other"];

  const filteredSkills = (data?.skills || []).filter((s) => {
    const matchesCategory = selectedCategory === "All" || s.category === selectedCategory;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRelevance =
      selectedRelevance === "All" ||
      (selectedRelevance === "Core" && s.goalRelevance === "required_core") ||
      (selectedRelevance === "Recommended" && s.goalRelevance === "recommended") ||
      (selectedRelevance === "Demonstrated" && (s.level === "Demonstrated" || s.level === "Assessed" || s.level === "Verified"));
    return matchesCategory && matchesSearch && matchesRelevance;
  });

  const getLevelBadge = (level?: SkillItem["level"], state?: SkillItem["state"]) => {
    const effectiveLevel = level || (state === "Verified" ? "Verified" : state === "Demonstrated" ? "Demonstrated" : state === "Evidence available" ? "Applied evidence available" : state === "Claimed" ? "Claimed" : "Not assessed");

    switch (effectiveLevel) {
      case "Verified":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              background: "#DEF7EC",
              color: "#03543F",
              border: "1px solid #A7F3D0",
            }}
          >
            <ShieldCheck size={12} /> Verified
          </span>
        );
      case "Assessed":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              background: "#E0F2FE",
              color: "#0369A1",
              border: "1px solid #BAE6FD",
            }}
          >
            <Award size={12} /> Assessed
          </span>
        );
      case "Demonstrated":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              background: "#EDE9FE",
              color: "#5942DC",
              border: "1px solid #DDD6FE",
            }}
          >
            <FolderGit2 size={12} /> Demonstrated
          </span>
        );
      case "Applied evidence available":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              background: "#EFF6FF",
              color: "#2563EB",
              border: "1px solid #DBEAFE",
            }}
          >
            <TrendingUp size={12} /> Applied evidence
          </span>
        );
      case "Exposure recorded":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              background: "#F1F5F9",
              color: "#475569",
              border: "1px solid #CBD5E1",
            }}
          >
            <BookOpen size={12} /> Exposure recorded
          </span>
        );
      case "Claimed":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              background: "#FEF3C7",
              color: "#D97706",
              border: "1px solid #FDE68A",
            }}
          >
            <AlertCircle size={12} /> Claimed
          </span>
        );
      default:
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 12,
              fontSize: 11,
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

  const getRelevanceBadge = (relevance?: SkillItem["goalRelevance"]) => {
    switch (relevance) {
      case "required_core":
        return (
          <span
            style={{
              padding: "2px 7px",
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 800,
              background: "#FAF5FF",
              color: "#7E22CE",
              border: "1px solid #E9D5FF",
              letterSpacing: "0.02em",
            }}
          >
            CORE REQUIRED
          </span>
        );
      case "recommended":
        return (
          <span
            style={{
              padding: "2px 7px",
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 700,
              background: "#F0F9FF",
              color: "#0284C7",
              border: "1px solid #BAE6FD",
            }}
          >
            RECOMMENDED
          </span>
        );
      case "complementary":
        return (
          <span
            style={{
              padding: "2px 7px",
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 600,
              background: "#F8FAFC",
              color: "#64748B",
              border: "1px solid #E2E8F0",
            }}
          >
            COMPLEMENTARY
          </span>
        );
      default:
        return null;
    }
  };

  const totalTracked = data?.stats?.trackedSkills ?? data?.stats?.totalSkills ?? 0;
  const evidenced = data?.stats?.evidencedSkills ?? 0;
  const demonstrated = data?.stats?.demonstratedSkills ?? 0;
  const assessed = data?.stats?.assessedSkills ?? 0;
  const verified = data?.stats?.verifiedSkills ?? 0;

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
            maxWidth: 1100,
            marginInline: "auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              href="/student"
              style={{
                padding: "8px",
                borderRadius: 8,
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                color: "#4B5563",
                display: "inline-flex",
                alignItems: "center",
              }}
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#171626" }}>
                Explainable Skills & Competency Ledger
              </h1>
              <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                Evidence-driven skill intelligence • 5-dimension proficiency • Zero fabricated scores
              </p>
            </div>
          </div>
          <Link
            href="/student/roadmap"
            style={{ fontSize: 13, fontWeight: 700, color: "#5942DC", textDecoration: "none" }}
          >
            View Roadmap &rarr;
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main
        data-eora-id="eora-skills-list"
        style={{ maxWidth: 1100, marginInline: "auto", padding: "28px 20px 80px" }}
      >
        {/* Metrics Row */}
        <div
          data-eora-id="eora-skills-overview"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#6B7280",
                display: "block",
                marginBottom: 4,
              }}
            >
              Total Tracked Skills
            </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#171626" }}>
              {totalTracked}
            </span>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#6B7280",
                display: "block",
                marginBottom: 4,
              }}
            >
              Evidenced in Code/CV
            </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#2563EB" }}>
              {evidenced}
            </span>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#6B7280",
                display: "block",
                marginBottom: 4,
              }}
            >
              Demonstrated in Projects
            </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#5942DC" }}>
              {demonstrated}
            </span>
          </div>

          <div
            data-eora-id="eora-skill-verification"
            style={{
              padding: 18,
              borderRadius: 14,
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#6B7280",
                display: "block",
                marginBottom: 4,
              }}
            >
              Assessed / Verified
            </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#059669" }}>
              {verified + assessed}
            </span>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#6B7280",
                display: "block",
                marginBottom: 4,
              }}
            >
              Target Career Track
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "#171626",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {data?.targetRole || data?.activeGoal || "AI/ML Track"}
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 20,
            background: "#FFFFFF",
            padding: 16,
            borderRadius: 14,
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            {/* Relevance filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#6B7280",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginRight: 4,
                }}
              >
                <Filter size={13} /> Filter:
              </span>
              {[
                { label: "All Skills", value: "All" },
                { label: "Core Required", value: "Core" },
                { label: "Recommended", value: "Recommended" },
                { label: "Demonstrated", value: "Demonstrated" },
              ].map((btn) => (
                <button
                  key={btn.value}
                  type="button"
                  onClick={() => setSelectedRelevance(btn.value)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 16,
                    fontSize: 12,
                    fontWeight: 700,
                    border:
                      selectedRelevance === btn.value
                        ? "1.5px solid #5942DC"
                        : "1px solid #E5E7EB",
                    background: selectedRelevance === btn.value ? "#EDE9FE" : "#F9FAFB",
                    color: selectedRelevance === btn.value ? "#5942DC" : "#4B5563",
                    cursor: "pointer",
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div
              data-eora-id="eora-skills-search"
              style={{ position: "relative", minWidth: 260 }}
            >
              <Search
                size={15}
                color="#9CA3AF"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                type="text"
                placeholder="Search by skill name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="academic-form-input"
                style={{
                  width: "100%",
                  paddingLeft: 34,
                  fontSize: 12,
                  paddingBlock: 8,
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                }}
              />
            </div>
          </div>

          {/* Domain Category pills */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              overflowX: "auto",
              paddingTop: 4,
              borderTop: "1px solid #F3F4F6",
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 14,
                  fontSize: 11,
                  fontWeight: 600,
                  border:
                    selectedCategory === cat ? "1.5px solid #5942DC" : "1px solid transparent",
                  background: selectedCategory === cat ? "#F3E8FF" : "transparent",
                  color: selectedCategory === cat ? "#7E22CE" : "#6B7280",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Skills Grid */}
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
            Loading explainable skill ledger...
          </div>
        ) : error ? (
          <div
            role="alert"
            style={{ padding: 24, borderRadius: 12, background: "#FEF2F2", color: "#991B1B" }}
          >
            {error}
          </div>
        ) : filteredSkills.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              borderRadius: 16,
              background: "#FFFFFF",
              border: "1.5px dashed #E5E7EB",
              color: "#6B7280",
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: "#171626", marginBottom: 6 }}>
              No tracked skills match your filter.
            </p>
            <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
              Adjust your filters or add project code and connect accounts to expand your ledger.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
              gap: 16,
            }}
          >
            {filteredSkills.map((skill) => (
              <Link
                key={skill.name}
                href={`/student/skills/${encodeURIComponent(skill.name)}`}
                style={{
                  padding: 20,
                  borderRadius: 14,
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <h3
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#171626",
                            margin: "0 0 2px",
                          }}
                        >
                          {skill.name}
                        </h3>
                        {getRelevanceBadge(skill.goalRelevance)}
                      </div>
                      <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
                        {skill.category}
                      </span>
                    </div>
                    {getLevelBadge(skill.level, skill.state)}
                  </div>

                  {/* Truthful synthesized concise explanation */}
                  <p
                    style={{
                      fontSize: 13,
                      color: "#374151",
                      lineHeight: 1.5,
                      marginBottom: 16,
                      background: "#F9FAFB",
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid #F3F4F6",
                    }}
                  >
                    {skill.conciseExplanation || skill.whyTathastuThinksThis}
                  </p>
                </div>

                <div
                  style={{
                    paddingTop: 12,
                    borderTop: "1px solid #F3F4F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "#6B7280",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <FolderGit2 size={13} color="#9CA3AF" />
                      {skill.relatedProjects.length}{" "}
                      {skill.relatedProjects.length === 1 ? "project" : "projects"}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Sparkles size={13} color="#9CA3AF" />
                      {skill.evidenceCount}{" "}
                      {skill.evidenceCount === 1 ? "evidence" : "evidences"}
                    </span>
                  </div>

                  <span
                    style={{
                      color: "#5942DC",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    Explain &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Missing Goal Skills Section (Non-Punitive) */}
        {data?.missingGoalSkills && data.missingGoalSkills.length > 0 && (
          <section
            style={{
              marginTop: 40,
              padding: 24,
              borderRadius: 16,
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <Target size={22} color="#5942DC" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: 0 }}>
                  Target Role Prerequisites — Not Yet Observed
                </h2>
                <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
                  Missing evidence is <strong>not proof that you lack the skill</strong>. Here are recommended, non-punitive ways to demonstrate them for your target role of <strong>{data.targetRole || "AI/ML"}</strong>.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 12,
              }}
            >
              {data.missingGoalSkills.map((missing) => (
                <Link
                  key={missing.name}
                  href={`/student/skills/${encodeURIComponent(missing.name)}`}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    textDecoration: "none",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <h4
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#1E293B",
                          margin: 0,
                        }}
                      >
                        {missing.name}
                      </h4>
                      {getRelevanceBadge(missing.relevance)}
                    </div>
                    <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, margin: "0 0 10px" }}>
                      {missing.suggestedTask}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#5942DC",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    Explore learning pathway &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
