"use client";

import { useState } from "react";
import { ShieldCheck, HelpCircle, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import type { ReadinessResult } from "@/lib/domain";
import { ReadinessExplanationModal } from "./readiness-explanation-modal";

type ReadinessCardProps = {
  readiness: ReadinessResult | null;
  onOpenEvidenceLedger?: () => void;
};

export function ReadinessCard({ readiness, onOpenEvidenceLedger }: ReadinessCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!readiness) {
    return null;
  }

  const isPublishable = readiness.publishable;
  const isCustomGoal = readiness.policyKey === "custom-no-policy";

  return (
    <>
      <div
        className="ws-content-card"
        style={{
          padding: "24px 24px",
          background: isPublishable
            ? "linear-gradient(135deg, #ffffff 0%, #f7f5ff 100%)"
            : "#ffffff",
          border: isPublishable ? "1px solid #dcd7fe" : "1px solid #eeece8",
          boxShadow: isPublishable ? "0 4px 16px rgba(89, 66, 220, 0.06)" : "0 2px 6px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <ShieldCheck size={16} color="#5942dc" />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "#5942dc",
                  textTransform: "uppercase",
                }}
              >
                Defensible Readiness Assessment
              </span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 750, color: "var(--ink)", margin: 0 }}>
              {readiness.goalTitle} Readiness
            </h2>
          </div>

          <span
            style={{
              fontSize: 11.5,
              fontWeight: 650,
              padding: "4px 9px",
              borderRadius: 6,
              background: "#faf9f7",
              border: "1px solid #eeece8",
              color: "#777485",
            }}
          >
            {readiness.policyVersion !== "none" ? readiness.policyName : "Standard Custom Track"}
          </span>
        </div>

        {/* STATE C: Custom goal without policy */}
        {isCustomGoal ? (
          <div style={{ padding: "12px 0 6px" }}>
            <p style={{ fontSize: 13.5, color: "#605d6e", margin: "0 0 14px", lineHeight: 1.5 }}>
              Readiness scoring is not available for this goal yet. Continue tracking honest evidence, gaps, and next actions below.
            </p>
            <div
              style={{
                background: "#faf9f7",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12.5,
                color: "#6b687b",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Sparkles size={15} color="#5942dc" />
              <span>EORA: &ldquo;Custom tracks rely directly on your self-paced milestones.&rdquo;</span>
            </div>
          </div>
        ) : isPublishable ? (
          /* STATE B: Requirements satisfied - Publishable Score */
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                margin: "12px 0 16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  style={{
                    fontSize: 42,
                    fontWeight: 850,
                    letterSpacing: "-0.03em",
                    color: "var(--ink)",
                    lineHeight: 1,
                  }}
                >
                  {readiness.score}%
                </span>
                <span style={{ fontSize: 14, color: "#777485", fontWeight: 600 }}>readiness estimate</span>
              </div>

              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 650,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "#dcfce7",
                  color: "#166534",
                }}
              >
                Audited & Defensible
              </span>
            </div>

            {/* Coverage Indicators */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid #eeece8",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "#777485", fontWeight: 700, textTransform: "uppercase" }}>
                  Verified Coverage
                </div>
                <div style={{ fontSize: 17, fontWeight: 750, color: "#166534", marginTop: 2 }}>
                  {readiness.verifiedCoverage}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#777485", fontWeight: 700, textTransform: "uppercase" }}>
                  Evidence Coverage
                </div>
                <div style={{ fontSize: 17, fontWeight: 750, color: "#5942dc", marginTop: 2 }}>
                  {readiness.evidenceCoverage}%
                </div>
              </div>
            </div>

            {/* EORA short speech */}
            <div
              style={{
                background: "#f6f4fe",
                border: "1px solid #e9e5fd",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12.5,
                color: "#3f3377",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <Sparkles size={15} color="#5942dc" />
              <span>
                EORA: &ldquo;There is enough verified evidence to show a score. You can also see why.&rdquo;
              </span>
            </div>

            {/* Action Button */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="ws-btn ws-btn-secondary"
                style={{ fontSize: 13, minHeight: 36, gap: 6 }}
              >
                <HelpCircle size={14} />
                <span>Why {readiness.score}%?</span>
              </button>
            </div>
          </div>
        ) : (
          /* STATE A: Insufficient verification */
          <div>
            <div style={{ margin: "10px 0 14px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#92400e",
                  background: "#fffbeb",
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #fef3c7",
                }}
              >
                <AlertCircle size={16} />
                <span>Not enough verified evidence yet.</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "#605d6e", margin: "0 0 14px", lineHeight: 1.5 }}>
              A numerical readiness score cannot be displayed until sufficient evidence is independently reviewed and verified.
            </p>

            {/* Coverage Indicators */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                background: "#faf9f7",
                border: "1px solid #eeece8",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "#777485", fontWeight: 700, textTransform: "uppercase" }}>
                  Verified Coverage
                </div>
                <div style={{ fontSize: 17, fontWeight: 750, color: "#92400e", marginTop: 2 }}>
                  {readiness.verifiedCoverage}%
                </div>
                <div style={{ fontSize: 11, color: "#8a8798" }}>Min 60% required for scoring</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#777485", fontWeight: 700, textTransform: "uppercase" }}>
                  Evidence Coverage
                </div>
                <div style={{ fontSize: 17, fontWeight: 750, color: "#5942dc", marginTop: 2 }}>
                  {readiness.evidenceCoverage}%
                </div>
                <div style={{ fontSize: 11, color: "#8a8798" }}>Self-reported / extracted</div>
              </div>
            </div>

            {/* EORA short speech */}
            <div
              style={{
                background: "#fefce8",
                border: "1px solid #fef08a",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12.5,
                color: "#713f12",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <Sparkles size={15} color="#ca8a04" />
              <span>
                EORA: &ldquo;Some areas still need verified evidence, so I won&apos;t show a misleading percentage.&rdquo;
              </span>
            </div>

            {/* Action Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="ws-btn ws-btn-secondary"
                style={{ fontSize: 13, minHeight: 36, gap: 6 }}
              >
                <span>See what is needed</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ReadinessExplanationModal
        readiness={readiness}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onOpenEvidenceLedger={onOpenEvidenceLedger}
      />
    </>
  );
}
