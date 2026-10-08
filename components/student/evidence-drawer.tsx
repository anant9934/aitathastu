"use client";

import { X, ShieldCheck, FileText, Calendar, Info, Award, UserCheck } from "lucide-react";
import type { EvidenceItem } from "@/lib/domain";

type EvidenceDrawerProps = {
  evidence: EvidenceItem[];
  isOpen: boolean;
  onClose: () => void;
};

export function EvidenceDrawer({ evidence, isOpen, onClose }: EvidenceDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-drawer-title"
      onClick={onClose}
    >
      <div className="drawer-panel wide" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-header-title">
            <span className="drawer-eyebrow">
              <ShieldCheck size={15} aria-hidden="true" />
              TRANSPARENT EVIDENCE RECORD
            </span>
            <h2 id="evidence-drawer-title" className="drawer-title">
              Recorded Evidence Details ({evidence.length})
            </h2>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close evidence drawer"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="drawer-content">
          <p className="drawer-intro-text">
            Tathastu maintains an honest log of facts and claims. Unverified claims guide your focus without masquerading as proven skills.
          </p>

          <div className="evidence-full-list">
            {evidence.map((item) => {
              const isResume = item.source === "resume_extracted";
              const isVerified = item.verificationStatus === "verified";

              return (
                <div key={item.id} className="evidence-detail-card">
                  <div className="evidence-detail-header">
                    <div className="evidence-title-group">
                      <strong className="evidence-detail-subject">{item.subject}</strong>
                      <span className="evidence-category-tag">{item.category}</span>
                    </div>

                    <div className="evidence-status-pill-wrapper">
                      {isVerified ? (
                        <span className="evidence-status-badge verified">
                          <Award size={13} aria-hidden="true" /> Verified
                        </span>
                      ) : item.verificationStatus === "verification_requested" ? (
                        <span className="evidence-status-badge" style={{ background: "#fef3c7", color: "#b45309" }}>
                          Verification requested
                        </span>
                      ) : item.verificationStatus === "under_review" ? (
                        <span className="evidence-status-badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                          Under review
                        </span>
                      ) : item.verificationStatus === "changes_requested" ? (
                        <span className="evidence-status-badge" style={{ background: "#ffedd5", color: "#c2410c" }}>
                          Changes requested
                        </span>
                      ) : item.verificationStatus === "rejected" ? (
                        <span className="evidence-status-badge" style={{ background: "#f1f5f9", color: "#475569" }}>
                          Not accepted
                        </span>
                      ) : isResume ? (
                        <span className="evidence-status-badge unverified">
                          <FileText size={13} aria-hidden="true" /> Resume • Unverified
                        </span>
                      ) : (
                        <span className="evidence-status-badge self-reported">
                          <UserCheck size={13} aria-hidden="true" /> Self-reported
                        </span>
                      )}
                    </div>
                  </div>


                  <p className="evidence-detail-value">{item.value}</p>

                  <div className="evidence-detail-grid">
                    <div className="evidence-meta-block">
                      <span className="meta-label">
                        <FileText size={13} aria-hidden="true" /> Source:
                      </span>
                      <span className="meta-value">{item.source.replace("_", " ")}</span>
                    </div>

                    <div className="evidence-meta-block">
                      <span className="meta-label">
                        <Calendar size={13} aria-hidden="true" /> Observed:
                      </span>
                      <span className="meta-value">
                        {new Date(item.observedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="evidence-interpretation-box">
                    <div className="interpretation-header">
                      <Info size={14} aria-hidden="true" />
                      <span>Interpretation & Why it matters</span>
                    </div>
                    <p className="interpretation-text">{item.interpretation}</p>
                    <small className="why-it-matters-text">{item.whyItMatters}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
