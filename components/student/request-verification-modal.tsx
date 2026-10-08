"use client";

import { useState } from "react";
import { X, ShieldCheck, Sparkles, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import type { EvidenceItem } from "@/lib/domain";
import { useWorkspace, type VerificationRequestItem } from "./student-context";

type RequestVerificationModalProps = {
  evidenceItem: EvidenceItem | null;
  existingRequest?: VerificationRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
};

export function RequestVerificationModal({
  evidenceItem,
  existingRequest,
  isOpen,
  onClose,
}: RequestVerificationModalProps) {
  const { requestVerification, resubmitVerification } = useWorkspace();

  const isResubmission = existingRequest?.status === "changes_requested";

  const [supportingReference, setSupportingReference] = useState(
    existingRequest?.supportingReference || evidenceItem?.sourceReference || ""
  );
  const [studentNotes, setStudentNotes] = useState(existingRequest?.studentNotes || "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !evidenceItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    let res: { success: boolean; error?: string };

    if (isResubmission && existingRequest) {
      res = await resubmitVerification(existingRequest.id, {
        supportingReference,
        studentNotes,
      });
    } else {
      res = await requestVerification(evidenceItem.id, {
        supportingReference,
        studentNotes,
      });
    }

    setSubmitting(false);

    if (res.success) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2500);
    } else {
      setErrorMsg(res.error || "Failed to submit verification request.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-verification-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 110,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          maxWidth: 540,
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
            padding: "20px 24px",
            borderBottom: "1px solid #efede9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} color="#5942dc" />
            <h3 id="request-verification-title" style={{ fontSize: 17, fontWeight: 750, margin: 0, color: "var(--ink)" }}>
              {isResubmission ? "Resubmit for Verification" : "Request Independent Verification"}
            </h3>
          </div>

          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#8b889b", padding: 4 }}
            aria-label="Close dialog"
          >
            <X size={19} />
          </button>
        </div>

        {/* Success View */}
        {success ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "#dcfce7",
                color: "#166534",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <CheckCircle2 size={30} />
            </div>
            <h4 style={{ fontSize: 18, fontWeight: 750, color: "var(--ink)", margin: "0 0 8px" }}>
              Request Submitted to Queue
            </h4>
            <p style={{ fontSize: 13.5, color: "#605d6e", margin: "0 0 16px", lineHeight: 1.5 }}>
              Your evidence item has been routed to authorized academic reviewers.
            </p>
            <div
              style={{
                background: "#faf8ff",
                border: "1px solid #e9e5fd",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 13,
                color: "#3f3377",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Sparkles size={16} color="#5942dc" />
              <span>EORA: &ldquo;This claim is now in review. I will not call it a verified skill until a verifier approves it.&rdquo;</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "22px 24px" }}>
            {/* Target Evidence Context */}
            <div
              style={{
                background: "#faf9f7",
                border: "1px solid #eeece8",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    background: "#eeebff",
                    color: "#5942dc",
                    borderRadius: 4,
                  }}
                >
                  {evidenceItem.category}
                </span>
                <strong style={{ fontSize: 14.5, color: "var(--ink)" }}>{evidenceItem.subject}</strong>
              </div>
              <div style={{ color: "#545163", fontSize: 13 }}>{evidenceItem.value}</div>
            </div>

            {/* If Resubmission, show previous feedback */}
            {isResubmission && existingRequest?.decisions && existingRequest.decisions.length > 0 && (
              <div
                style={{
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 16,
                  fontSize: 12.5,
                  color: "#9a3412",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Reviewer Feedback:</div>
                <div style={{ fontStyle: "italic" }}>
                  &ldquo;{existingRequest.decisions[existingRequest.decisions.length - 1].reason}&rdquo;
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 12.5,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Supporting Reference */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 6, color: "var(--ink)" }}>
                Supporting Reference / Artifact Link
              </label>
              <input
                type="text"
                className="auth-input"
                style={{ paddingLeft: 12 }}
                placeholder="e.g. https://github.com/username/project or Certificate ID"
                value={supportingReference}
                onChange={(e) => setSupportingReference(e.target.value)}
              />
              <p style={{ fontSize: 11.5, color: "#777485", margin: "4px 0 0" }}>
                A URL or certificate identifier aids reviewers. Links are materials for human review, not automatic verification.
              </p>
            </div>

            {/* Student Notes */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 6, color: "var(--ink)" }}>
                Review Notes / Context for Verifier (Optional)
              </label>
              <textarea
                className="auth-input"
                style={{ padding: 12, height: 72, resize: "vertical" }}
                placeholder="e.g. Implemented the FastAPI serving layer and Docker container in week 3 of semester project."
                value={studentNotes}
                onChange={(e) => setStudentNotes(e.target.value)}
              />
            </div>

            {/* EORA Honest Notice */}
            <div
              style={{
                background: "#fbfaff",
                border: "1px solid #eeebfc",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                color: "#4d427d",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <Sparkles size={15} color="#5942dc" />
              <span>
                EORA: &ldquo;This claim will go to review. I will not call it a verified skill until a verifier approves it.&rdquo;
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="ws-btn ws-btn-secondary"
                style={{ minHeight: 38, fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="ws-btn ws-btn-primary"
                style={{ minHeight: 38, fontSize: 13, gap: 6 }}
              >
                <span>{submitting ? "Submitting…" : isResubmission ? "Resubmit for Review" : "Submit for Verification"}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
