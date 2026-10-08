"use client";

import { X, Clock, ShieldCheck } from "lucide-react";

type ComingSoonModalProps = {
  featureName: string;
  isOpen: boolean;
  onClose: () => void;
};

export function ComingSoonModal({ featureName, isOpen, onClose }: ComingSoonModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coming-soon-title"
      onClick={onClose}
    >
      <div className="modal-panel coming-soon-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="coming-soon-header-title">
            <span className="modal-eyebrow">
              <Clock size={15} aria-hidden="true" />
              ECOSYSTEM MODULE PREVIEW
            </span>
            <h2 id="coming-soon-title" className="modal-title">
              {featureName}
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="coming-soon-body">
          <p className="coming-soon-main-text">
            This module is planned for a subsequent ecosystem phase. In Phase 3, Tathastu focuses strictly on verified evidence, deterministic gap analysis, and explainable next actions.
          </p>

          <div className="coming-soon-pledge">
            <ShieldCheck size={20} className="pledge-icon" aria-hidden="true" />
            <div className="pledge-text">
              <strong>Honest Architecture Pledge</strong>
              <span>We do not generate mock mentors, fake opportunities, or fictional assessment rankings to pad incomplete interfaces.</span>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="button button-primary">
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
