"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, ArrowLeft, CheckCircle2, AlertCircle, Sparkles, UserCheck } from "lucide-react";
import type { InterviewSession } from "@/lib/domain/integrations";

export function StudentInterviewsView() {
  const [interviews, setInterviews] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/student/interviews");
        if (!res.ok) {
          throw new Error("Failed to load interview sessions");
        }
        const data = await res.json();
        setInterviews(data.interviews || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading interviews");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="student-workspace-view" style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px" }}>
      {/* Top back bar */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/student"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.88rem",
            color: "var(--color-text-secondary, #666)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} /> Back to Student Home
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#5942dc",
              backgroundColor: "rgba(89, 66, 220, 0.12)",
              padding: "3px 10px",
              borderRadius: 12,
            }}
          >
            Connected Evidence Producer · AI Interview
          </span>
        </div>
        <h1 style={{ fontSize: "1.85rem", fontWeight: 700, margin: "4px 0 8px", color: "var(--color-text-primary, #111)" }}>
          Interview Observations & Feedback
        </h1>
        <p style={{ fontSize: "0.95rem", color: "var(--color-text-secondary, #555)", margin: 0, maxWidth: 740, lineHeight: 1.5 }}>
          Structured observations from AI Interview sessions. Evaluates technical reasoning, communication structure, and problem solving without permanent labels or speculative inferences.
        </p>
      </div>

      {/* EORA guidance banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(89, 66, 220, 0.08), rgba(245, 158, 11, 0.08))",
          border: "1px solid rgba(89, 66, 220, 0.18)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 28,
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <Sparkles size={20} color="#5942dc" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "#111", marginBottom: 3 }}>
            EORA guide — Performance Evidence
          </div>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "#444", lineHeight: 1.5 }}>
            &ldquo;Interview feedback describes performance in one session, not a permanent personal label. You can review each dimension and its suggestions. Tathastu does not infer facial emotion or personality.&rdquo;
          </p>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>
          Loading interview sessions...
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 8,
            padding: 16,
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && interviews.length === 0 && (
        <div
          data-eora-id="eora-interviews-list"
          style={{
            textAlign: "center",
            padding: "50px 24px",
            border: "1px dashed var(--color-border, #ddd)",
            borderRadius: 16,
            background: "#fafafa",
          }}
        >
          <MessageSquare size={40} color="#999" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 6px" }}>No AI interview sessions completed yet</h3>
          <p style={{ fontSize: "0.9rem", color: "#666", maxWidth: 480, margin: "0 auto 16px" }}>
            When you complete an AI Interview practice session, structured rubric feedback on technical reasoning and communication will appear here.
          </p>
          <Link
            href="/student"
            style={{
              display: "inline-block",
              background: "#5942dc",
              color: "#fff",
              padding: "8px 18px",
              borderRadius: 8,
              fontSize: "0.88rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Explore Next Actions
          </Link>
        </div>
      )}

      {/* Interview Sessions List */}
      {!loading && !error && interviews.length > 0 && (
        <div data-eora-id="eora-interviews-list" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {interviews.map((ses) => (
            <div
              key={ses.id}
              className="ws-content-card"
              style={{
                background: "#fff",
                border: "1px solid var(--color-border, #e5e5e5)",
                borderRadius: 14,
                padding: "22px 24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              {/* Session Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 16,
                  paddingBottom: 14,
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "#111" }}>
                      Target Role: {ses.targetRole}
                    </h3>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#5942dc",
                        backgroundColor: "rgba(89, 66, 220, 0.1)",
                        padding: "2px 8px",
                        borderRadius: 8,
                      }}
                    >
                      <UserCheck size={13} /> Performance Observation
                    </span>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#666", display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span>Rubric Version: {ses.rubricVersion}</span>
                    <span>Completed: {new Date(ses.completedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                  </div>
                </div>
              </div>

              {/* Rubric Dimensions */}
              <div>
                <h4 style={{ fontSize: "0.88rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", margin: "0 0 12px" }}>
                  Observed Rubric Dimensions
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {ses.dimensions && ses.dimensions.map((dim) => {
                    const val = Number(dim.value) || 0;
                    const max = Number(dim.scaleMax) || 5;
                    const percent = Math.min(100, Math.round((val / max) * 100));

                    return (
                      <div
                        key={dim.id}
                        style={{
                          background: "#fafafa",
                          border: "1px solid #eee",
                          borderRadius: 10,
                          padding: "14px 16px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#111" }}>
                            {dim.dimensionLabel}
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "0.92rem",
                              color: "#5942dc",
                              background: "rgba(89, 66, 220, 0.1)",
                              padding: "2px 10px",
                              borderRadius: 6,
                            }}
                          >
                            {dim.value} / {dim.scaleMax}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div
                          style={{
                            height: 6,
                            background: "#e5e5e5",
                            borderRadius: 3,
                            overflow: "hidden",
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${percent}%`,
                              background: percent >= 75 ? "#10b981" : percent >= 50 ? "#5942dc" : "#f59e0b",
                              borderRadius: 3,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>

                        {/* Constructive explanation */}
                        <p style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "#444", lineHeight: 1.45 }}>
                          {dim.explanation}
                        </p>

                        <div style={{ fontSize: "0.78rem", color: "#666", display: "flex", alignItems: "center", gap: 5 }}>
                          <CheckCircle2 size={13} color="#059669" />
                          <span>Contributes verified interview evidence to your readiness profile</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Provenance Footer */}
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: "1px dashed #eee",
                  fontSize: "0.78rem",
                  color: "#888",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span>External Interview Session ID: {ses.externalInterviewId}</span>
                <span>Provenance Event ID: {ses.producerEventId}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
