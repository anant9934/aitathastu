"use client";

import { X, HelpCircle, Target, CheckCircle2, AlertCircle, Sparkles, Box } from "lucide-react";
import type { Recommendation } from "@/lib/domain";

type WhyThisDrawerProps = {
  action: Recommendation | null;
  onClose: () => void;
};

export function WhyThisDrawer({ action, onClose }: WhyThisDrawerProps) {
  if (!action) return null;

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="why-this-title"
      onClick={onClose}
    >
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-header-title">
            <span className="drawer-eyebrow">
              <HelpCircle size={15} aria-hidden="true" />
              EXPLAINABLE RECOMMENDATION REASONING
            </span>
            <h2 id="why-this-title" className="drawer-title">
              Why this step?
            </h2>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close reasoning drawer"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="drawer-content">
          <div className="why-action-hero">
            <span className={`action-type-pill ${action.type}`}>{action.type}</span>
            <h3>{action.title}</h3>
            <p>{action.description}</p>
          </div>

          <div className="why-sections-grid">
            <div className="why-section-card">
              <div className="why-section-icon violet">
                <Target size={18} aria-hidden="true" />
              </div>
              <div className="why-section-body">
                <strong>Goal Relevance</strong>
                <p>{action.whyThis.goalRelevance}</p>
              </div>
            </div>

            <div className="why-section-card">
              <div className="why-section-icon mint">
                <CheckCircle2 size={18} aria-hidden="true" />
              </div>
              <div className="why-section-body">
                <strong>What We Know</strong>
                <p>{action.whyThis.whatWeKnow}</p>
              </div>
            </div>

            <div className="why-section-card">
              <div className="why-section-icon amber">
                <AlertCircle size={18} aria-hidden="true" />
              </div>
              <div className="why-section-body">
                <strong>What We Don&apos;t Know</strong>
                <p>{action.whyThis.whatWeDontKnow}</p>
              </div>
            </div>

            <div className="why-section-card">
              <div className="why-section-icon violet">
                <Sparkles size={18} aria-hidden="true" />
              </div>
              <div className="why-section-body">
                <strong>Why This Action Is Suggested</strong>
                <p>{action.whyThis.whyThisAction}</p>
              </div>
            </div>

            <div className="why-section-card">
              <div className="why-section-icon blue">
                <Box size={18} aria-hidden="true" />
              </div>
              <div className="why-section-body">
                <strong>Expected Evidence Upon Completion</strong>
                <p>{action.whyThis.expectedEvidence}</p>
              </div>
            </div>
          </div>

          <div className="why-drawer-footer-note">
            <p>
              Completing this action provides focused evidence for your pathway. It does not automatically guarantee mastery or replace independent peer evaluation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
