"use client";

import { FileText, ShieldAlert, Award, ArrowRight } from "lucide-react";
import type { EvidenceItem } from "@/lib/domain";

type RecentEvidenceProps = {
  evidence: EvidenceItem[];
  onOpenDetails: () => void;
};

export function RecentEvidenceCard({ evidence, onOpenDetails }: RecentEvidenceProps) {
  // Take up to 5 most recently observed items
  const recent = evidence.slice(0, 5);

  return (
    <section className="workspace-card recent-evidence-card" aria-labelledby="recent-evidence-heading">
      <div className="card-topline">
        <span className="card-eyebrow">
          <FileText size={15} aria-hidden="true" />
          RECENT EVIDENCE ITEMS
        </span>
        <button
          type="button"
          onClick={onOpenDetails}
          className="card-text-link"
          aria-label="View all recorded evidence items"
        >
          View all ({evidence.length}) <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>

      <h3 id="recent-evidence-heading" className="card-heading">
        Recorded in your local profile
      </h3>

      <div className="recent-evidence-list">
        {recent.length === 0 ? (
          <p className="empty-evidence-note">No evidence items recorded yet.</p>
        ) : (
          recent.map((item) => {
            const isResume = item.source === "resume_extracted";
            const isVerified = item.verificationStatus === "verified";

            return (
              <div key={item.id} className="recent-evidence-row">
                <div className="evidence-info">
                  <div className="evidence-subject-line">
                    <span className="evidence-subject">{item.subject}</span>
                    <span className="evidence-category-tag">{item.category}</span>
                  </div>
                  <span className="evidence-interpretation-snippet">
                    {item.interpretation}
                  </span>
                </div>

                <div className="evidence-status-pill-wrapper">
                  {isVerified ? (
                    <span className="evidence-status-badge verified">
                      <Award size={13} aria-hidden="true" /> Verified
                    </span>
                  ) : isResume ? (
                    <span className="evidence-status-badge unverified">
                      <FileText size={13} aria-hidden="true" /> Resume • Unverified
                    </span>
                  ) : (
                    <span className="evidence-status-badge self-reported">
                      <ShieldAlert size={13} aria-hidden="true" /> Self-reported
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="recent-evidence-disclaimer">
        <span>Extracted skills indicate stated exposure, not proven competence.</span>
      </div>
    </section>
  );
}
