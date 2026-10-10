"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, BookOpen } from "lucide-react";
import type { AssessmentAttempt } from "@/lib/domain/integrations";

export function StudentAssessmentsView() {
  const [assessments, setAssessments] = useState<AssessmentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/student/assessments");
        if (!res.ok) {
          throw new Error("Failed to load assessments");
        }
        const data = await res.json();
        setAssessments(data.assessments || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading assessments");
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
              color: "#059669",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              padding: "3px 10px",
              borderRadius: 12,
            }}
          >
            Connected Evidence Producer · ERIS
          </span>
        </div>
        <h1 style={{ fontSize: "1.85rem", fontWeight: 700, margin: "4px 0 8px", color: "var(--color-text-primary, #111)" }}>
          Standardized Assessments
        </h1>
        <p style={{ fontSize: "0.95rem", color: "var(--color-text-secondary, #555)", margin: 0, maxWidth: 740, lineHeight: 1.5 }}>
          Objective examination outcomes ingested from ERIS. Assessed topics contribute verified institutional evidence directly to your goal profile.
        </p>
      </div>

      {/* EORA guidance banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(89, 66, 220, 0.06), rgba(16, 185, 129, 0.08))",
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
            EORA guide — Assessment Evidence
          </div>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "#444", lineHeight: 1.5 }}>
            &ldquo;An assessment result is evidence from a specific attempt, not a permanent label. ERIS results can support relevant goal dimensions when the institutional source is trusted.&rdquo;
          </p>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>
          Loading assessment records...
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
      {!loading && !error && assessments.length === 0 && (
        <div
          data-eora-id="eora-assessments-list"
          style={{
            textAlign: "center",
            padding: "50px 24px",
            border: "1px dashed var(--color-border, #ddd)",
            borderRadius: 16,
            background: "#fafafa",
          }}
        >
          <BookOpen size={40} color="#999" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 6px" }}>No ERIS assessments recorded yet</h3>
          <p style={{ fontSize: "0.9rem", color: "#666", maxWidth: 480, margin: "0 auto 16px" }}>
            When you take a standardized exam on connected ERIS platform, verified results and assessed topic evidence will automatically appear here.
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

      {/* Assessment List */}
      {!loading && !error && assessments.length > 0 && (
        <div data-eora-id="eora-assessments-list" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {assessments.map((att) => (
            <div
              key={att.id}
              className="ws-content-card"
              style={{
                background: "#fff",
                border: "1px solid var(--color-border, #e5e5e5)",
                borderRadius: 14,
                padding: "22px 24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              {/* Attempt Header */}
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
                      {att.assessmentTitle}
                    </h3>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#059669",
                        backgroundColor: "rgba(16, 185, 129, 0.1)",
                        padding: "2px 8px",
                        borderRadius: 8,
                      }}
                    >
                      <ShieldCheck size={13} /> ERIS Verified
                    </span>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#666", display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span>Type: {att.assessmentType}</span>
                    <span>Rubric: {att.rubricVersion}</span>
                    <span>Completed: {new Date(att.completedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                  </div>
                </div>

                {att.results && att.results.length > 0 && att.results[0].overallResult && (
                  <div
                    data-eora-id="eora-assessments-scores"
                    style={{
                      background: "rgba(89, 66, 220, 0.08)",
                      border: "1px solid rgba(89, 66, 220, 0.2)",
                      borderRadius: 10,
                      padding: "8px 16px",
                      textAlign: "right",
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "#5942dc" }}>
                      Overall Result
                    </div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#111" }}>
                      {att.results[0].overallResult}
                      {att.results[0].maxResult ? ` / ${att.results[0].maxResult}` : ""}
                    </div>
                  </div>
                )}
              </div>

              {/* Topics Breakdown */}
              <div>
                <h4 style={{ fontSize: "0.88rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", margin: "0 0 12px" }}>
                  Assessed Topics & Generated Evidence
                </h4>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                  {att.topics && att.topics.map((top) => (
                    <div
                      key={top.id}
                      style={{
                        background: "#fafafa",
                        border: "1px solid #eee",
                        borderRadius: 10,
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: "0.92rem", color: "#111" }}>
                          {top.topicLabel}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            color: "#059669",
                            background: "rgba(16, 185, 129, 0.12)",
                            padding: "2px 8px",
                            borderRadius: 6,
                          }}
                        >
                          {top.value} {top.maxValue ? `/ ${top.maxValue}` : ""} {top.measurementType === "rubric_level" ? "Level" : ""}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.78rem", color: "#666", display: "flex", alignItems: "center", gap: 5 }}>
                        <CheckCircle2 size={13} color="#059669" />
                        <span>Contributes Level 3 verified evidence to goal dimensions</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Provenance note */}
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
                <span>External Assessment ID: {att.externalAssessmentId}</span>
                <span>Provenance Event ID: {att.producerEventId}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
