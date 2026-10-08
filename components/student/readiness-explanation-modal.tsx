"use client";

import { X, CheckCircle2, AlertCircle, HelpCircle, Shield, ArrowRight } from "lucide-react";
import type { ReadinessResult } from "@/lib/domain";

type ReadinessExplanationModalProps = {
  readiness: ReadinessResult | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEvidenceLedger?: () => void;
};

export function ReadinessExplanationModal({
  readiness,
  isOpen,
  onClose,
  onOpenEvidenceLedger,
}: ReadinessExplanationModalProps) {
  if (!isOpen || !readiness) return null;

  const isPublishable = readiness.publishable;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="readiness-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          maxWidth: 640,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 48px rgba(0,0,0,0.22)",
          border: "1px solid #e2e0dc",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "22px 24px 18px",
            borderBottom: "1px solid #efede9",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Shield size={16} color="#5942dc" />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#5942dc", textTransform: "uppercase" }}>
                Defensible Methodology Explanation
              </span>
            </div>
            <h2 id="readiness-modal-title" style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "var(--ink)" }}>
              {isPublishable
                ? `Why this score? (${readiness.score}%)`
                : "What is needed for a Readiness Estimate?"}
            </h2>
            <div style={{ fontSize: 12.5, color: "#777485", marginTop: 4 }}>
              Goal: <strong>{readiness.goalTitle}</strong> • Model: <strong>{readiness.policyName}</strong> ({readiness.policyVersion})
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "#faf9f7",
              border: "1px solid #e9e6e2",
              borderRadius: 8,
              padding: 6,
              cursor: "pointer",
              color: "#777485",
            }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "22px 24px" }}>
          {/* Coverage Overview */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              background: "#faf9f7",
              border: "1px solid #eeece8",
              borderRadius: 14,
              padding: "16px 18px",
              marginBottom: 20,
            }}
          >
            <div>
              <span style={{ fontSize: 11.5, color: "#777485", textTransform: "uppercase", fontWeight: 700 }}>
                Verified Coverage
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: readiness.verifiedCoverage >= 60 ? "#166534" : "#92400e" }}>
                {readiness.verifiedCoverage}%
              </div>
              <span style={{ fontSize: 11.5, color: "#817e8d" }}>Independently reviewed dimensions</span>
            </div>

            <div>
              <span style={{ fontSize: 11.5, color: "#777485", textTransform: "uppercase", fontWeight: 700 }}>
                Evidence Coverage
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#5942dc" }}>
                {readiness.evidenceCoverage}%
              </div>
              <span style={{ fontSize: 11.5, color: "#817e8d" }}>Dimensions with any recorded facts</span>
            </div>
          </div>

          {/* If NOT publishable, show explicit why */}
          {!isPublishable && readiness.unavailableReasons.length > 0 && (
            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 14,
                padding: "16px 18px",
                marginBottom: 22,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#92400e", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                <AlertCircle size={17} />
                <span>Estimate Currently Unavailable</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#78350f", lineHeight: 1.55 }}>
                {readiness.unavailableReasons.map((reason, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    {reason}
                  </li>
                ))}
              </ul>
              <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#92400e" }}>
                AI Tathastu strictly forbids fabricating percentages. Unknown dimensions must remain unknown until independently demonstrated.
              </p>
            </div>
          )}

          {/* Dimension Breakdown */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
              Dimensional Breakdown & Policy Weights
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {readiness.dimensions.map((dim) => {
                const isVerified = dim.state === "verified";
                const isDemonstrated = dim.state === "demonstrated";
                const isSomeEvidence = dim.state === "some_evidence";

                return (
                  <div
                    key={dim.key}
                    style={{
                      border: "1px solid #eeece8",
                      borderRadius: 12,
                      padding: "14px 16px",
                      background: isVerified ? "#fbfdfc" : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isVerified ? (
                          <CheckCircle2 size={16} color="#166534" />
                        ) : (
                          <HelpCircle size={16} color="#8a8798" />
                        )}
                        <strong style={{ fontSize: 14, color: "var(--ink)" }}>{dim.label}</strong>
                        <span style={{ fontSize: 11.5, color: "#777485" }}>(Weight: {dim.weight}%)</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: isVerified
                              ? "#dcfce7"
                              : isDemonstrated
                              ? "#e0f2fe"
                              : isSomeEvidence
                              ? "#fef3c7"
                              : "#f1f5f9",
                            color: isVerified
                              ? "#15803d"
                              : isDemonstrated
                              ? "#0369a1"
                              : isSomeEvidence
                              ? "#b45309"
                              : "#64748b",
                            textTransform: "uppercase",
                          }}
                        >
                          {dim.state.replace("_", " ")}
                        </span>

                        {isPublishable && dim.contribution !== undefined && (
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 750,
                              color: dim.contribution > 0 ? "#166534" : "#8a8798",
                            }}
                          >
                            +{dim.contribution} pts
                          </span>
                        )}
                      </div>
                    </div>

                    <p style={{ fontSize: 12.5, color: "#5a576a", margin: "4px 0 0", lineHeight: 1.45 }}>
                      {dim.explanation}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Call to Action */}
          <div
            style={{
              borderTop: "1px solid #efede9",
              paddingTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12, color: "#8a8798" }}>
              Calculated on: {new Date(readiness.calculatedAt).toLocaleString()}
            </span>

            <div style={{ display: "flex", gap: 10 }}>
              {onOpenEvidenceLedger && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEvidenceLedger();
                  }}
                  className="ws-btn ws-btn-secondary"
                  style={{ fontSize: 13, minHeight: 36, gap: 6 }}
                >
                  <span>Submit Evidence for Review</span>
                  <ArrowRight size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="ws-btn ws-btn-primary"
                style={{ fontSize: 13, minHeight: 36 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
