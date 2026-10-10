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
} from "lucide-react";

type SkillItem = {
  name: string;
  category: "AI & ML" | "GenAI" | "Data" | "Backend" | "Tools" | "Cloud" | "Other";
  state: "Verified" | "Demonstrated" | "Evidence available" | "Claimed" | "Unknown";
  evidenceCount: number;
  relatedProjects: Array<{ id: string; title: string }>;
  whyTathastuThinksThis: string;
  lastObservedAt: string;
};

type SkillsData = {
  skills: SkillItem[];
  stats: {
    totalSkills: number;
    demonstratedSkills: number;
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
    return matchesCategory && matchesSearch;
  });

  const getStateBadge = (state: SkillItem["state"]) => {
    switch (state) {
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
            <CheckCircle2 size={12} /> Verified
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
      case "Evidence available":
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
            <TrendingUp size={12} /> Evidence available
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
            Unknown
          </span>
        );
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9F8F5", color: "#171626" }}>
      {/* Header */}
      <header style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1040, marginInline: "auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                Skills & Competency Ledger
              </h1>
              <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                Reviewed CV skills and source-backed platform signals, with evidence and verification status
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
      <main data-eora-id="eora-skills-list" style={{ maxWidth: 1040, marginInline: "auto", padding: "28px 20px 80px" }}>
        {/* Metrics Row */}
        <div data-eora-id="eora-skills-overview" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
          <div style={{ padding: 18, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>
              Total Tracked Skills
            </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#171626" }}>
              {data?.stats?.totalSkills ?? 0}
            </span>
          </div>
          <div style={{ padding: 18, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>
              Demonstrated Skills
            </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#5942DC" }}>
              {data?.stats?.demonstratedSkills ?? 0}
            </span>
          </div>
          <div data-eora-id="eora-skill-verification" style={{ padding: 18, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>
              Verified Skills
            </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#059669" }}>
              {data?.stats?.verifiedSkills ?? 0}
            </span>
          </div>
          <div style={{ padding: 18, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>
              Target Goal
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#171626", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
              {data?.activeGoal || "AI/ML Track"}
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: selectedCategory === cat ? "1.5px solid #5942DC" : "1px solid #E5E7EB",
                  background: selectedCategory === cat ? "#EDE9FE" : "#FFFFFF",
                  color: selectedCategory === cat ? "#5942DC" : "#4B5563",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div data-eora-id="eora-skills-search" style={{ position: "relative", minWidth: 240 }}>
            <Search size={15} color="#9CA3AF" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="academic-form-input"
              style={{ paddingLeft: 34, fontSize: 12, paddingBlock: 8, background: "#FFFFFF" }}
            />
          </div>
        </div>

        {/* Skills Grid */}
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
            Loading skills ledger...
          </div>
        ) : error ? (
          <div role="alert" style={{ padding: 24, borderRadius: 12, background: "#FEF2F2", color: "#991B1B" }}>{error}</div>
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
              No skills found matching your filter.
            </p>
            <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
              Add projects or connect your profiles to discover your skills automatically.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
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
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: "0 0 2px" }}>
                        {skill.name}
                      </h3>
                      <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
                        {skill.category}
                      </span>
                    </div>
                    {getStateBadge(skill.state)}
                  </div>

                  <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.5, marginBottom: 16, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {skill.whyTathastuThinksThis}
                  </p>
                </div>

                <div style={{ paddingTop: 12, borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#6B7280" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <FolderGit2 size={13} color="#9CA3AF" />
                      {skill.relatedProjects.length} {skill.relatedProjects.length === 1 ? "project" : "projects"}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Sparkles size={13} color="#9CA3AF" />
                      {skill.evidenceCount} {skill.evidenceCount === 1 ? "evidence" : "evidences"}
                    </span>
                  </div>

                  <span style={{ color: "#5942DC", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}>
                    View details <ChevronRight size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
