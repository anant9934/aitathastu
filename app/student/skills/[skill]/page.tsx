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
} from "lucide-react";

type SkillDetailData = {
  name: string;
  category: string;
  state: "Verified" | "Demonstrated" | "Evidence available" | "Claimed" | "Unknown";
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
  }>;
  whyTathastuThinksThis: string;
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

  useEffect(() => {
    async function loadDetail() {
      try {
        const res = await fetch(`/api/student/skills/${encodeURIComponent(skillName)}`);
        if (res.ok) {
          const detail = await res.json();
          setData(detail);
        }
      } catch {
        // Non-fatal
      } finally {
        setLoading(false);
      }
    }
    if (skillName) {
      loadDetail();
    }
  }, [skillName]);

  const getStateBadge = (state: SkillDetailData["state"]) => {
    switch (state) {
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
            <CheckCircle2 size={13} /> Verified Mastery
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
            <FolderGit2 size={13} /> Demonstrated Evidence
          </span>
        );
      case "Evidence available":
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
            <TrendingUp size={13} /> Multiple Evidences
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
            <AlertCircle size={13} /> Self-Reported Claim
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
            Unevidenced Target Skill
          </span>
        );
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9F8F5", color: "#171626" }}>
      {/* Header */}
      <header style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 960, marginInline: "auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#171626" }}>{skillName}</h1>
                {data && getStateBadge(data.state)}
              </div>
              <span style={{ fontSize: 12, color: "#6B7280" }}>{data?.category || "Technology"}</span>
            </div>
          </div>
          <Link
            href="/student/roadmap"
            style={{ fontSize: 13, fontWeight: 700, color: "#5942DC", textDecoration: "none" }}
          >
            Roadmap &rarr;
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 960, marginInline: "auto", padding: "28px 20px 80px" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
            Loading skill context...
          </div>
        ) : !data ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
            Skill not found.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Why Tathastu Thinks This */}
            <section style={{ padding: 24, borderRadius: 16, background: "#FFFFFF", border: "1.5px solid #EDE9FE", boxShadow: "0 2px 8px rgba(89, 66, 220, 0.04)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <Sparkles size={20} color="#5942DC" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: 0 }}>
                    Why Tathastu Thinks This
                  </h2>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                    Ground-truth justification derived strictly from your evidence ledger
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, background: "#F9FAFB", padding: 14, borderRadius: 12, border: "1px solid #E5E7EB", margin: 0 }}>
                {data.whyTathastuThinksThis}
              </p>
            </section>

            {/* What to Improve */}
            <section style={{ padding: 24, borderRadius: 16, background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <Target size={20} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#171626", margin: 0 }}>
                    What to Improve
                  </h2>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                    Next milestone to turn this skill into verified proof
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.6, margin: 0 }}>
                {data.whatToImprove}
              </p>
            </section>

            {/* Confirmed Projects */}
            {data.relatedProjects.length > 0 && (
              <section style={{ padding: 24, borderRadius: 16, background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#171626", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <FolderGit2 size={18} color="#5942DC" />
                  Confirmed Projects Demonstrating {data.name}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {data.relatedProjects.map((proj) => (
                    <div
                      key={proj.id}
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#171626", margin: 0 }}>
                            {proj.title}
                          </h3>
                          {proj.repositoryUrl && (
                            <a
                              href={proj.repositoryUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#6B7280", display: "inline-flex" }}
                              title="View repository"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>

                        {proj.personalContributionRoles.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                            {proj.personalContributionRoles.map((role) => (
                              <span
                                key={role}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 8,
                                  background: "#EDE9FE",
                                  color: "#5942DC",
                                  border: "1px solid #DDD6FE",
                                }}
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Supporting Evidence Records */}
            {data.evidenceItems.length > 0 && (
              <section style={{ padding: 24, borderRadius: 16, background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#171626", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={18} color="#059669" />
                  Supporting Evidence Records ({data.evidenceItems.length})
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.evidenceItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#171626", textTransform: "capitalize" }}>
                            {item.source}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 6,
                              background: item.verificationStatus === "verified" ? "#DEF7EC" : "#F3F4F6",
                              color: item.verificationStatus === "verified" ? "#03543F" : "#6B7280",
                            }}
                          >
                            {item.verificationStatus}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: "#4B5563", margin: 0 }}>
                          {item.interpretation}
                        </p>
                      </div>

                      <div style={{ fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                        {item.observedAt &&
                          new Date(item.observedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recommended Learning Path */}
            <section style={{ padding: 24, borderRadius: 16, background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#171626", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <BookOpen size={18} color="#5942DC" /> Recommended Actions in Ecosystem
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {data.learningPath.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: "#F9FAFB",
                      border: "1px solid #E5E7EB",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#5942DC", marginBottom: 4 }}>
                        <span>{step.type}</span>
                        <span style={{ color: "#6B7280" }}>{step.source}</span>
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: "#171626", margin: "0 0 8px" }}>
                        {step.title}
                      </h3>
                    </div>
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic" }}>
                      Available via {step.source} integration
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
