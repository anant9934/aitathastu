"use client";

import { HelpCircle, CheckCircle, Play, X, ArrowUpRight } from "lucide-react";
import type { Recommendation, ActionStatus } from "@/lib/domain";

type NextActionCardProps = {
  action: Recommendation;
  onOpenWhyThis: (action: Recommendation) => void;
  onUpdateStatus: (actionId: string, status: ActionStatus, actionTitle: string) => void;
};

export function NextActionCard({ action, onOpenWhyThis, onUpdateStatus }: NextActionCardProps) {
  const isStarted = action.status === "active";

  const typeLabels: Record<string, string> = {
    learn: "Concept study",
    build: "Hands-on build",
    verify: "Verification",
    practice: "Practice & critique",
    connect: "Peer conversation",
    complete_profile: "Profile detail",
  };

  return (
    <article className={`next-action-card ${isStarted ? "started" : ""}`} aria-labelledby={`action-title-${action.id}`}>
      <div className="action-card-header">
        <span className={`action-type-pill ${action.type}`}>
          {typeLabels[action.type] || "Practical action"}
        </span>
        <div className="action-header-right">
          <button
            type="button"
            className="action-why-btn"
            onClick={() => onOpenWhyThis(action)}
            aria-label={`Why this step: ${action.title}`}
          >
            <HelpCircle size={14} aria-hidden="true" />
            <span>Why this?</span>
          </button>
          <button
            type="button"
            className="action-dismiss-btn"
            onClick={() => onUpdateStatus(action.id, "dismissed", action.title)}
            aria-label={`Dismiss suggested action: ${action.title}`}
            title="Dismiss suggestion"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <h3 id={`action-title-${action.id}`} className="action-title">
        {action.title}
      </h3>

      <p className="action-desc">{action.description}</p>

      <div className="action-reason-snippet">
        <span className="reason-label">Why this matters:</span>
        <p className="reason-text">{action.reason}</p>
      </div>

      <div className="action-card-footer">
        {isStarted ? (
          <div className="started-status-badge">
            <CheckCircle size={15} aria-hidden="true" />
            <span>Active in your journey</span>
          </div>
        ) : (
          <button
            type="button"
            className="button button-primary action-start-btn"
            onClick={() => onUpdateStatus(action.id, "active", action.title)}
          >
            <Play size={15} aria-hidden="true" />
            Start this action
          </button>
        )}

        <button
          type="button"
          className="button button-text action-details-btn"
          onClick={() => onOpenWhyThis(action)}
        >
          View reasoning <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
