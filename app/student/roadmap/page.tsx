"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Target,
  BookOpen,
  Code2,
  ShieldCheck,
  FolderGit2,
} from "lucide-react";

type RoadmapStage = {
  stageNumber: number;
  title: string;
  description: string;
  requiredSkills: string[];
  status: "completed" | "in_progress" | "locked";
  recommendedActions: Array<{
    actionType: "Learn" | "Practice" | "Build" | "Verify" | "Interview";
    title: string;
    description: string;
    reason: string;
    sourcePlatform: string;
  }>;
};

type RoadmapData = {
  roadmap: {
    goal: string;
    cohort?: number;
    totalStages: number;
    currentStageIndex: number;
    stages: RoadmapStage[];
    primaryActions: Array<{
      actionType: "Learn" | "Practice" | "Build" | "Verify" | "Interview";
      title: string;
      description: string;
      whyItMatters: string;
      sourcePlatform: string;
    }>;
  };
  studentName: string;
  goal: string;
  cohort?: number;
};

export default function RoadmapPage() {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoadmap() {
      try {
        const res = await fetch("/api/student/roadmap");
        if (res.ok) {
          const resData = await res.json();
          setData(resData);
        }
      } catch {
        // Non-fatal
      } finally {
        setLoading(false);
      }
    }
    loadRoadmap();
  }, []);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "Padho Code":
        return <Code2 className="w-3.5 h-3.5" style={{ color: "#2563EB" }} />;
      case "Study LPU":
        return <BookOpen className="w-3.5 h-3.5" style={{ color: "#D97706" }} />;
      case "ERIS":
        return <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#059669" }} />;
      case "MentorMaze":
        return <Sparkles className="w-3.5 h-3.5" style={{ color: "#7C3AED" }} />;
      default:
        return <FolderGit2 className="w-3.5 h-3.5" style={{ color: "#5942DC" }} />;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#F9F8F5", color: "#171626" }}>
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
            margin: "0 auto",
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
                justifyContent: "center",
                textDecoration: "none",
                transition: "all 0.15s",
              }}
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "#171626",
                    letterSpacing: "-0.01em",
                    margin: 0,
                  }}
                >
                  Your Path to {data?.goal || "AI/ML Engineer"}
                </h1>
                {data?.cohort && (
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: "#EDE9FE",
                      color: "#5942DC",
                      border: "1px solid #DDD6FE",
                    }}
                  >
                    {data.cohort} Batch
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: "#6B7280", margin: "2px 0 0 0" }}>
                Prerequisite-aware roadmap that skips what you already demonstrated and prioritizes genuine gaps
              </p>
            </div>
          </div>
          <Link
            href="/student/skills"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#5942DC",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Your Skills &rarr;
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 20px" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
            Generating personalized roadmap...
          </div>
        ) : !data?.roadmap ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
            Roadmap not available.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* What Matters Now: Max 3 Primary Actions */}
            <section
              style={{
                padding: 24,
                borderRadius: 16,
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Target className="w-5 h-5" style={{ color: "#5942DC" }} />
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#171626", margin: 0 }}>
                      What Matters Now
                    </h2>
                  </div>
                  <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
                    The highest-leverage actions to fill your current gaps toward {data.goal}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    padding: "3px 10px",
                    borderRadius: 12,
                    background: "#EDE9FE",
                    color: "#5942DC",
                    border: "1px solid #DDD6FE",
                    fontWeight: 600,
                  }}
                >
                  3 Primary Actions
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 16,
                }}
              >
                {data.roadmap.primaryActions.map((act, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 18,
                      borderRadius: 14,
                      background: "#FBFBFC",
                      border: "1px solid #E5E7EB",
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
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#5942DC" }}>
                          {act.actionType}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 11,
                            color: "#6B7280",
                          }}
                        >
                          {getPlatformIcon(act.sourcePlatform)}
                          {act.sourcePlatform}
                        </span>
                      </div>
                      <h3
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#171626",
                          margin: "0 0 6px 0",
                        }}
                      >
                        {act.title}
                      </h3>
                      <p
                        style={{
                          fontSize: 12,
                          color: "#4B5563",
                          lineHeight: 1.5,
                          marginBottom: 12,
                        }}
                      >
                        {act.description}
                      </p>
                    </div>

                    <div style={{ paddingTop: 10, borderTop: "1px solid #E5E7EB" }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#6B7280",
                          display: "block",
                          marginBottom: 10,
                        }}
                      >
                        Why now?{" "}
                        <span style={{ color: "#171626", fontWeight: 500 }}>
                          {act.whyItMatters}
                        </span>
                      </span>
                      <button
                        style={{
                          width: "100%",
                          padding: "7px 12px",
                          borderRadius: 8,
                          background: "#5942DC",
                          color: "#FFFFFF",
                          fontSize: 12,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#4930D8")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#5942DC")}
                      >
                        Start Action <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Stages Progression */}
            <section
              data-eora-id="eora-roadmap-milestones"
              style={{
                padding: 24,
                borderRadius: 16,
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#171626",
                  marginBottom: 4,
                  marginTop: 0,
                }}
              >
                Progression Stages
              </h2>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, marginTop: 0 }}>
                Stages are derived from your evidence ledger. Mastered stages are automatically marked completed.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {data.roadmap.stages.map((stage) => {
                  const isCompleted = stage.status === "completed";
                  const isInProgress = stage.status === "in_progress";

                  return (
                    <div
                      key={stage.stageNumber}
                      style={{
                        padding: 20,
                        borderRadius: 14,
                        transition: "all 0.2s",
                        ...(isInProgress
                          ? {
                              border: "1.5px solid #C4B5FD",
                              background: "#F5F3FF",
                            }
                          : isCompleted
                          ? {
                              border: "1px solid #BBF7D0",
                              background: "#F0FDF4",
                            }
                          : {
                              border: "1px solid #E5E7EB",
                              background: "#F9FAFB",
                              opacity: 0.85,
                            }),
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 16,
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 13,
                              flexShrink: 0,
                              ...(isCompleted
                                ? {
                                    background: "#DCFCE7",
                                    color: "#15803D",
                                    border: "1px solid #86EFAC",
                                  }
                                : isInProgress
                                ? {
                                    background: "#5942DC",
                                    color: "#FFFFFF",
                                  }
                                : {
                                    background: "#E5E7EB",
                                    color: "#6B7280",
                                  }),
                            }}
                          >
                            {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : stage.stageNumber}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <h3
                                style={{
                                  fontSize: 15,
                                  fontWeight: 700,
                                  color: isInProgress || isCompleted ? "#171626" : "#4B5563",
                                  margin: 0,
                                }}
                              >
                                {stage.title}
                              </h3>
                              {isCompleted && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    background: "#DCFCE7",
                                    color: "#15803D",
                                    border: "1px solid #86EFAC",
                                  }}
                                >
                                  Demonstrated Prerequisite
                                </span>
                              )}
                              {isInProgress && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    background: "#EDE9FE",
                                    color: "#5942DC",
                                    border: "1px solid #DDD6FE",
                                  }}
                                >
                                  Current Active Focus
                                </span>
                              )}
                            </div>
                            <p
                              style={{
                                fontSize: 13,
                                color: isCompleted ? "#6B7280" : isInProgress ? "#4B5563" : "#9CA3AF",
                                margin: "4px 0 0 0",
                              }}
                            >
                              {stage.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Required Skills Chips */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 10,
                          paddingLeft: 44,
                        }}
                      >
                        {stage.requiredSkills.map((skill) => (
                          <span
                            key={skill}
                            style={{
                              padding: "3px 9px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontFamily: "monospace",
                              ...(isCompleted
                                ? {
                                    background: "#DCFCE7",
                                    color: "#166534",
                                    border: "1px solid #86EFAC",
                                    fontWeight: 500,
                                  }
                                : isInProgress
                                ? {
                                    background: "#FFFFFF",
                                    color: "#5942DC",
                                    border: "1px solid #DDD6FE",
                                    fontWeight: 500,
                                  }
                                : {
                                    background: "#FFFFFF",
                                    color: "#6B7280",
                                    border: "1px solid #E5E7EB",
                                  }),
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
