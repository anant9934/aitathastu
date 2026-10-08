"use client";

import { ClipboardCheck, FileQuestion, UserCheck, ArrowRight, ShieldCheck } from "lucide-react";
import type { EvidenceItem } from "@/lib/domain";

type EvidenceSummaryProps = {
  evidence: EvidenceItem[];
  unknownAreasCount: number;
  onOpenDetails: () => void;
};

export function EvidenceSummaryCard({
  evidence,
  unknownAreasCount,
  onOpenDetails,
}: EvidenceSummaryProps) {
  // Available evidence: e.g. goal chosen, education provided
  const availableItems = evidence.filter(
    (e) => e.category === "goal" || e.category === "education"
  );

  // Self-reported items: skills or experiences from resume or manual input
  const selfReportedItems = evidence.filter(
    (e) => e.verificationStatus === "unverified" || e.verificationStatus === "self_reported"
  );

  return (
    <section className="workspace-card evidence-summary-card" aria-labelledby="evidence-summary-heading">
      <div className="card-topline">
        <span className="card-eyebrow">
          <ShieldCheck size={15} aria-hidden="true" />
          YOUR CURRENT PICTURE
        </span>
        <span className="card-pill info">Zero arbitrary scores</span>
      </div>

      <div className="evidence-metrics-grid">
        <div className="metric-cell available">
          <span className="metric-icon">
            <ClipboardCheck size={20} aria-hidden="true" />
          </span>
          <div className="metric-data">
            <strong>{availableItems.length} items</strong>
            <small>Available evidence</small>
          </div>
        </div>

        <div className="metric-cell self-reported">
          <span className="metric-icon">
            <UserCheck size={20} aria-hidden="true" />
          </span>
          <div className="metric-data">
            <strong>{selfReportedItems.length} items</strong>
            <small>Self-reported / unverified</small>
          </div>
        </div>

        <div className="metric-cell unknown">
          <span className="metric-icon">
            <FileQuestion size={20} aria-hidden="true" />
          </span>
          <div className="metric-data">
            <strong>{unknownAreasCount} areas</strong>
            <small>Still unknown</small>
          </div>
        </div>
      </div>

      <div className="evidence-summary-footer">
        <p className="honest-disclaimer">
          Missing records indicate unexplored areas, never personal weakness. Nothing is marked verified without proof.
        </p>
        <button
          type="button"
          onClick={onOpenDetails}
          className="button button-quiet view-evidence-btn"
          aria-label="View evidence details"
        >
          View evidence
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
