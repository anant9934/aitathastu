"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, X, ChevronDown, ChevronUp, RotateCcw, Compass } from "lucide-react";

type EoraWorkspaceGuideProps = {
  dismissed: boolean;
  onDismiss: () => void;
  onRestore: () => void;
  onHighlightSection?: (sectionId: string) => void;
};

export function EoraWorkspaceGuide({
  dismissed,
  onDismiss,
  onRestore,
  onHighlightSection,
}: EoraWorkspaceGuideProps) {
  const [minimized, setMinimized] = useState(false);
  const [stepPromptIndex, setStepPromptIndex] = useState(0);

  const guidanceSteps = [
    {
      id: "intro",
      text: "You’re all set. I found a few things worth focusing on first.",
      target: "what-matters-now",
      hint: "Highlighted: What Matters Now",
    },
    {
      id: "goal",
      text: "Here is your active goal. You can change it without losing earlier evidence.",
      target: "goal-card-section",
      hint: "Highlighted: Active Goal",
    },
    {
      id: "actions",
      text: "What Matters Now shows up to three practical actions. Start one to build fresh evidence.",
      target: "what-matters-now",
      hint: "Highlighted: Next Actions",
    },
    {
      id: "evidence",
      text: "Your current picture separates available, unverified, and unknown information.",
      target: "evidence-section",
      hint: "Highlighted: Current Picture",
    },
  ];

  const currentStep = guidanceSteps[stepPromptIndex];

  const handleNextTip = () => {
    const nextIdx = (stepPromptIndex + 1) % guidanceSteps.length;
    setStepPromptIndex(nextIdx);
    if (onHighlightSection) {
      onHighlightSection(guidanceSteps[nextIdx].target);
    }
  };

  const handleReplay = () => {
    setStepPromptIndex(0);
    if (onHighlightSection) {
      onHighlightSection(guidanceSteps[0].target);
    }
  };

  if (dismissed) {
    return (
      <div className="ws-eora-min-restore-wrapper">
        <button
          type="button"
          onClick={onRestore}
          className="button button-quiet ws-eora-restore-btn"
          aria-label="Ask EORA for workspace guidance"
        >
          <Sparkles size={16} aria-hidden="true" />
          <span>Ask EORA</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="ws-eora-card" aria-label="EORA guidance assistant">
      <div className="ws-eora-header">
        <div className="ws-eora-title-group">
          <span className="ws-eora-sparkle-icon">
            <Sparkles size={15} aria-hidden="true" />
          </span>
          <strong>EORA, Your Guide</strong>
        </div>

        <div className="ws-eora-ctrl-buttons">
          <button
            type="button"
            className="ws-eora-ctrl-btn"
            onClick={() => setMinimized(!minimized)}
            aria-label={minimized ? "Expand EORA guide" : "Minimize EORA guide"}
          >
            {minimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            type="button"
            className="ws-eora-ctrl-btn"
            onClick={onDismiss}
            aria-label="Close EORA guide"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="ws-eora-body">
          <div className="ws-eora-dialog-row">
            <div className="ws-eora-avatar-mini">
              <Image
                src="/assets/eora/pointing-right.png"
                alt="EORA pointing toward the current workspace section"
                width={1024}
                height={1536}
                className="ws-eora-avatar-img"
              />
            </div>

            <div className="ws-eora-bubble">
              <p className="ws-eora-message">{currentStep.text}</p>
              <span className="ws-eora-step-hint">{currentStep.hint}</span>
            </div>
          </div>

          <div className="ws-eora-action-row">
            <button
              type="button"
              className="button button-quiet ws-eora-step-btn"
              onClick={handleNextTip}
            >
              <Compass size={14} aria-hidden="true" />
              <span>Guide me ({stepPromptIndex + 1}/{guidanceSteps.length})</span>
            </button>

            <button
              type="button"
              className="ws-eora-replay-btn"
              onClick={handleReplay}
              title="Replay from beginning"
              aria-label="Replay instruction from beginning"
            >
              <RotateCcw size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
