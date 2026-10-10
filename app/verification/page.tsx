"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  X,
  FileCheck,
  RefreshCw,
} from "lucide-react";

type QueueItem = {
  id: string;
  evidenceId: string;
  requesterPersonId: string;
  organizationId: string;
  status: "pending" | "under_review" | "verified" | "rejected" | "changes_requested";
  supportingReference?: string | null;
  studentNotes?: string | null;
  requestedAt: string;
  resolvedAt?: string | null;
  requesterName: string;
  evidenceCategory: string;
  evidenceSubject: string;
  evidenceValue: string;
  evidenceSource: string;
  evidenceObservedAt: string;
};

export default function VerificationPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "changes_requested" | "resolved">("pending");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Review State
  const [activeItem, setActiveItem] = useState<QueueItem | null>(null);
  const [decision, setDecision] = useState<"verified" | "changes_requested" | "rejected">("verified");
  const [method, setMethod] = useState("faculty_evaluation");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/verification/requests");
      if (res.status === 401 || res.status === 403) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load queue.");
      }
      const data = await res.json();
      setQueue(data.queue || []);
      setAuthorized(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error connecting to verification service.";
      setErrorMsg(msg);
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleOpenReview = (item: QueueItem) => {
    setActiveItem(item);
    setDecision("verified");
    setMethod("code_review");
    setReason("");
    setModalError(null);
  };

  const handleCloseReview = () => {
    setActiveItem(null);
    setModalError(null);
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    if ((decision === "rejected" || decision === "changes_requested") && !reason.trim()) {
      setModalError(`A clear feedback reason is required when selecting "${decision.replace("_", " ")}".`);
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch("/api/verification/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: activeItem.id,
          decision,
          reason: reason.trim(),
          method,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit decision.");
      }

      setSuccessMsg(`Decision "${decision.replace("_", " ")}" recorded for ${activeItem.evidenceSubject}.`);
      setActiveItem(null);
      await fetchQueue();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed.";
      setModalError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = queue.filter((item) => {
    if (filter === "all") return true;
    if (filter === "pending") return item.status === "pending" || item.status === "under_review";
    if (filter === "changes_requested") return item.status === "changes_requested";
    if (filter === "resolved") return item.status === "verified" || item.status === "rejected";
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: "1px solid #e9e6e2",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href="/student"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
                color: "var(--ink)",
                fontWeight: 750,
                fontSize: 16,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "#5942dc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <ShieldCheck size={18} />
              </div>
              <span>AI Tathastu</span>
            </Link>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 8px",
                background: "#eeebff",
                color: "#5942dc",
                borderRadius: 6,
                textTransform: "uppercase",
              }}
            >
              Verifier Workspace
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href="/student"
              className="ws-btn ws-btn-secondary"
              style={{ fontSize: 13, minHeight: 34, padding: "6px 12px" }}
            >
              Student Workspace
            </Link>
            <button
              onClick={fetchQueue}
              disabled={loading}
              className="ws-btn ws-btn-secondary"
              style={{ fontSize: 13, minHeight: 34, padding: "6px 10px" }}
              title="Refresh queue"
              aria-label="Refresh verification queue"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main data-eora-id="eora-verification-queue" style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 60px" }}>
        {/* Banner */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e9e6e2",
            borderRadius: 16,
            padding: "24px 26px",
            marginBottom: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: "#5942dc", textTransform: "uppercase" }}>
                Academic Evidence Governance
              </span>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 8px", color: "var(--ink)" }}>
                Verification Queue
              </h1>
              <p style={{ fontSize: 14, color: "#605d6e", margin: 0, maxWidth: 680, lineHeight: 1.5 }}>
                Review student claims, examine supporting repositories and credentials, and record immutable verification decisions. Verification directly unlocks defensible readiness models.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#faf9f7",
                border: "1px solid #eeece8",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 13,
                color: "#464353",
              }}
            >
              <FileCheck size={16} color="#5942dc" />
              <span>
                <strong>{queue.filter((q) => q.status === "pending" || q.status === "under_review").length}</strong> pending reviews
              </span>
            </div>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div
              style={{
                marginTop: 16,
                background: "#edfcf4",
                border: "1px solid #b7f4cb",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#166534",
                fontSize: 13,
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                marginTop: 16,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#991b1b",
                fontSize: 13,
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>


        {/* State: Unauthorized */}
        {authorized === false && !loading && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #fed7aa",
              borderRadius: 16,
              padding: "40px 24px",
              textAlign: "center",
              maxWidth: 580,
              margin: "40px auto",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#fff7ed",
                color: "#c2410c",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <AlertCircle size={26} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 750, color: "var(--ink)", marginBottom: 8 }}>
              Verifier Access Required
            </h2>
            <p style={{ fontSize: 14, color: "#605d6e", lineHeight: 1.55, marginBottom: 20 }}>
              Your current account does not have the <code>student.verify_skill</code> capability in this organization. Only authorized academic faculty or designated reviewers can access this workspace.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <Link href="/student" className="ws-btn ws-btn-secondary" style={{ fontSize: 13 }}>
                Return to Student Workspace
              </Link>
              <Link data-eora-id="eora-verification-action" href="/sign-in" className="ws-btn ws-btn-primary" style={{ fontSize: 13 }}>
                Sign In with Faculty Account
              </Link>
            </div>
          </div>
        )}

        {/* State: Authorized Queue */}
        {authorized === true && (
          <>
            {/* Filter Tabs */}
            <div
              data-eora-id="eora-verification-filters"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
                overflowX: "auto",
                paddingBottom: 4,
              }}
            >
              <span style={{ fontSize: 13, color: "#777485", display: "flex", alignItems: "center", gap: 4, marginRight: 6 }}>
                <Filter size={14} /> Filter:
              </span>
              {[
                { key: "pending", label: "Pending Review" },
                { key: "changes_requested", label: "Changes Requested" },
                { key: "resolved", label: "Resolved" },
                { key: "all", label: "All Items" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as typeof filter)}
                  style={{
                    border: "none",
                    background: filter === tab.key ? "#5942dc" : "#fff",
                    color: filter === tab.key ? "#fff" : "#464353",
                    padding: "7px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: filter === tab.key ? "#5942dc" : "#e9e6e2",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Queue Item Cards */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#777485" }}>
                Loading verification queue…
              </div>
            ) : filteredItems.length === 0 ? (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e9e6e2",
                  borderRadius: 16,
                  padding: "48px 24px",
                  textAlign: "center",
                  color: "#6b687b",
                }}
              >
                <Clock size={32} color="#a09dae" style={{ margin: "0 auto 12px" }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: "var(--ink)" }}>
                  No requests matching this view
                </h3>
                <p data-eora-id="eora-verification-action" style={{ fontSize: 13.5, margin: 0 }}>
                  {filter === "pending"
                    ? "All submitted evidence items have been reviewed."
                    : "No verification requests found in this filter category."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e9e6e2",
                      borderRadius: 14,
                      padding: "20px 22px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "2px 7px",
                              borderRadius: 5,
                              background: "#eeebff",
                              color: "#5942dc",
                            }}
                          >
                            {item.evidenceCategory}
                          </span>
                          <strong style={{ fontSize: 16, color: "var(--ink)" }}>{item.evidenceSubject}</strong>
                          <span style={{ fontSize: 13, color: "#817e8d" }}>by {item.requesterName}</span>
                        </div>
                        <div style={{ fontSize: 14, color: "#454252", lineHeight: 1.45 }}>
                          {item.evidenceValue}
                        </div>
                      </div>

                      {/* Status Pill */}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 650,
                          padding: "4px 10px",
                          borderRadius: 8,
                          background:
                            item.status === "verified"
                              ? "#dcfce7"
                              : item.status === "changes_requested"
                              ? "#ffedd5"
                              : item.status === "rejected"
                              ? "#f1f5f9"
                              : "#fef3c7",
                          color:
                            item.status === "verified"
                              ? "#15803d"
                              : item.status === "changes_requested"
                              ? "#c2410c"
                              : item.status === "rejected"
                              ? "#475569"
                              : "#b45309",
                          textTransform: "capitalize",
                        }}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                    </div>

                    {/* Metadata & Supporting Reference */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: 12,
                        background: "#faf9f7",
                        padding: "12px 14px",
                        borderRadius: 10,
                        fontSize: 12.5,
                        color: "#5a5769",
                      }}
                    >
                      <div>
                        <strong>Source:</strong> {item.evidenceSource.replace("_", " ")}
                      </div>
                      <div>
                        <strong>Observed Date:</strong> {new Date(item.evidenceObservedAt).toLocaleDateString()}
                      </div>
                      <div>
                        <strong>Requested:</strong> {new Date(item.requestedAt).toLocaleDateString()}
                      </div>
                      {item.supportingReference && (
                        <div style={{ gridColumn: "1 / -1" }}>
                          <strong>Supporting Reference / Artifact:</strong>{" "}
                          {item.supportingReference.startsWith("http") ? (
                            <a
                              href={item.supportingReference}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#5942dc", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              {item.supportingReference} <ExternalLink size={12} />
                            </a>
                          ) : (
                            <code style={{ background: "#eee", padding: "2px 6px", borderRadius: 4 }}>
                              {item.supportingReference}
                            </code>
                          )}
                        </div>
                      )}
                      {item.studentNotes && (
                        <div style={{ gridColumn: "1 / -1", fontStyle: "italic", color: "#6b687b" }}>
                          &ldquo;{item.studentNotes}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                      <button
                        data-eora-id="eora-verification-action"
                        onClick={() => handleOpenReview(item)}
                        className="ws-btn ws-btn-primary"
                        style={{ fontSize: 13, minHeight: 36, padding: "6px 14px", gap: 6 }}
                      >
                        <span>Review Evidence</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Review Modal Dialog */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
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
              borderRadius: 18,
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              border: "1px solid #e2e0dc",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #efede9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#5942dc", textTransform: "uppercase" }}>
                  Verification Assessment
                </span>
                <h3 id="review-modal-title" style={{ fontSize: 18, fontWeight: 750, margin: "2px 0 0", color: "var(--ink)" }}>
                  Review: {activeItem.evidenceSubject}
                </h3>
              </div>
              <button
                onClick={handleCloseReview}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8b889b", padding: 4 }}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitDecision} style={{ padding: "22px 24px" }}>
              {/* Privacy-scoped context */}
              <div
                style={{
                  background: "#faf9f7",
                  border: "1px solid #eeece8",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 18,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <strong>Student:</strong> {activeItem.requesterName}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong>Claim:</strong> {activeItem.evidenceValue}
                </div>
                {activeItem.supportingReference && (
                  <div>
                    <strong>Reference:</strong>{" "}
                    {activeItem.supportingReference.startsWith("http") ? (
                      <a href={activeItem.supportingReference} target="_blank" rel="noopener noreferrer" style={{ color: "#5942dc" }}>
                        {activeItem.supportingReference}
                      </a>
                    ) : (
                      <code>{activeItem.supportingReference}</code>
                    )}
                  </div>
                )}
              </div>

              {modalError && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    padding: "10px 12px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Decision Radio/Select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 8, color: "var(--ink)" }}>
                  Verification Decision
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { val: "verified", label: "Verify", color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
                    { val: "changes_requested", label: "Request Changes", color: "#9a3412", bg: "#fff7ed", border: "#fed7aa" },
                    { val: "rejected", label: "Reject Evidence", color: "#374151", bg: "#f8fafc", border: "#cbd5e1" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setDecision(opt.val as typeof decision)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 10,
                        border: `2px solid ${decision === opt.val ? opt.color : opt.border}`,
                        background: decision === opt.val ? opt.bg : "#fff",
                        color: opt.color,
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "#777485", margin: "6px 0 0" }}>
                  {decision === "verified" && "Evidence will be upgraded to independently verified and count toward verified readiness coverage."}
                  {decision === "changes_requested" && "Student will be requested to provide a link, demo, or institutional proof before review resumes."}
                  {decision === "rejected" && "Evidence did not satisfy verification criteria. Rejection is strictly artifact-level, not a measure of personal worth."}
                </p>
              </div>

              {/* Verification Method (for Verify) */}
              {decision === "verified" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 6, color: "var(--ink)" }}>
                    Verification Method
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="auth-input"
                    style={{ paddingLeft: 12, height: 40 }}
                  >
                    <option value="code_review">Code & Repository Inspection</option>
                    <option value="faculty_evaluation">Direct Academic / Faculty Evaluation</option>
                    <option value="credential_check">Credential & Certificate Authority Verification</option>
                    <option value="technical_interview">Technical Assessment / Viva</option>
                  </select>
                </div>
              )}

              {/* Feedback / Reason Field */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 6, color: "var(--ink)" }}>
                  {decision === "verified" ? "Review Notes (Optional)" : "Reason / Required Clarifications (Required)"}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    decision === "verified"
                      ? "e.g. Inspected GitHub repo; tests pass and architecture is clean."
                      : decision === "changes_requested"
                      ? "e.g. Please provide a working GitHub link or departmental project supervisor note."
                      : "e.g. The submitted document was a syllabus outline rather than an artifact demonstrating your own implementation."
                  }
                  required={decision !== "verified"}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #dcdad5",
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    height: 80,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleCloseReview}
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
                  style={{ minHeight: 38, fontSize: 13 }}
                >
                  {submitting ? "Submitting Decision…" : "Confirm Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
