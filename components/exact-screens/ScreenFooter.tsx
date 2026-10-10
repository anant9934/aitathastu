"use client";

import React, { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

export interface ScreenFooterProps {
  onBack?: () => void;
  onNext?: () => void;
  onStepClick?: (step: number) => void;
  onJumpToStep?: (step: number) => void;
  nextLabel?: string;
  activeStep?: number; // 1-indexed (e.g., 1 to 7)
  totalSteps?: number; // default 7
  showBack?: boolean;
  showNext?: boolean;
  isNextDisabled?: boolean;
  nextIcon?: React.ReactNode;
  className?: string;
  stepLabels?: string[];
}

import { getOnboardingStepLabels, TOTAL_ONBOARDING_STEPS } from "@/lib/onboarding-step-registry";

export function ScreenFooter({
  onBack,
  onNext,
  onStepClick,
  onJumpToStep,
  nextLabel = "Next",
  activeStep = 1,
  totalSteps = TOTAL_ONBOARDING_STEPS,
  showBack = true,
  showNext = true,
  isNextDisabled = false,
  nextIcon = <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />,
  className = "",
  stepLabels = getOnboardingStepLabels(),
}: ScreenFooterProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const handleStepSelect = onStepClick || onJumpToStep;

  return (
    <footer
      className={`screen-stepper-footer select-none ${className}`}
      style={{
        marginTop: "auto",
        paddingTop: 28,
        paddingBottom: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        width: "100%",
      }}
    >
      {/* 1. Back Button */}
      <div style={{ flex: "0 0 100px" }}>
        {showBack && onBack ? (
          <button
            type="button"
            id="eora-onboarding-back-btn"
            data-eora-id="eora-onboarding-back-btn"
            className="stepper-circle-btn group"
            onClick={onBack}
            aria-label="Previous step"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "1.5px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#4B5563",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#5942DC";
              e.currentTarget.style.color = "#5942DC";
              e.currentTarget.style.transform = "scale(1.06) translateX(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(89, 66, 220, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#E5E7EB";
              e.currentTarget.style.color = "#4B5563";
              e.currentTarget.style.transform = "scale(1) translateX(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.04)";
            }}
          >
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
          </button>
        ) : (
          <div style={{ width: 44, height: 44 }} />
        )}
      </div>

      {/* 2. Interactive Center Stepper & Progress Bar */}
      <div
        style={{
          flex: 1,
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          position: "relative",
        }}
      >
        {/* Floating Tooltip showing step description */}
        <div
          style={{
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#5942DC",
              letterSpacing: "0.02em",
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          >
            {hoveredStep !== null && stepLabels[hoveredStep - 1]
              ? `Step ${hoveredStep}: ${stepLabels[hoveredStep - 1]}`
              : `Step ${activeStep} of ${totalSteps} · Onboarding journey`}
          </span>
        </div>

        {/* Step Track & Nodes */}
        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 4px",
          }}
          aria-label={`Step ${activeStep} of ${totalSteps}`}
        >
          {/* Background Track Line */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 12,
              right: 12,
              height: 4,
              transform: "translateY(-50%)",
              background: "#E5E7EB",
              borderRadius: 2,
              zIndex: 0,
            }}
          />

          {/* Active Gradient Fill Line */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 12,
              height: 4,
              width: `${Math.min(100, Math.max(0, ((activeStep - 1) / (totalSteps - 1)) * 100))}%`,
              transform: "translateY(-50%)",
              background: "linear-gradient(90deg, #02C5F5 0%, #4564FF 50%, #9335E8 100%)",
              borderRadius: 2,
              zIndex: 1,
              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 0 10px rgba(69, 100, 255, 0.4)",
            }}
          />

          {/* Step Nodes / Pills */}
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const stepNum = idx + 1;
            const isCurrent = stepNum === activeStep;
            const isCompleted = stepNum < activeStep;
            const isClickable = Boolean(handleStepSelect);

            return (
              <button
                key={stepNum}
                type="button"
                onClick={() => isClickable && handleStepSelect?.(stepNum)}
                onMouseEnter={() => setHoveredStep(stepNum)}
                onMouseLeave={() => setHoveredStep(null)}
                disabled={!isClickable}
                aria-label={`Go to step ${stepNum}: ${stepLabels[idx] || ""}`}
                style={{
                  position: "relative",
                  zIndex: 2,
                  width: isCurrent ? 28 : 20,
                  height: isCurrent ? 28 : 20,
                  borderRadius: "50%",
                  border: isCurrent
                    ? "2.5px solid #FFFFFF"
                    : isCompleted
                    ? "2px solid #5942DC"
                    : "2px solid #D1D5DB",
                  background: isCurrent
                    ? "linear-gradient(135deg, #02C5F5, #5942DC)"
                    : isCompleted
                    ? "#5942DC"
                    : "#FFFFFF",
                  color: isCompleted || isCurrent ? "#FFFFFF" : "#6B7280",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isClickable ? "pointer" : "default",
                  boxShadow: isCurrent
                    ? "0 0 0 4px rgba(89, 66, 220, 0.25), 0 4px 12px rgba(2, 197, 245, 0.4)"
                    : isCompleted
                    ? "0 2px 6px rgba(89, 66, 220, 0.25)"
                    : "0 1px 3px rgba(0,0,0,0.05)",
                  transform: isCurrent ? "scale(1.15)" : hoveredStep === stepNum ? "scale(1.2)" : "scale(1)",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  padding: 0,
                }}
              >
                {isCurrent ? (
                  <span style={{ fontSize: 11, fontWeight: 800 }}>{stepNum}</span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{stepNum}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Next Button */}
      <div style={{ flex: "0 0 130px", display: "flex", justifyContent: "flex-end" }}>
        {showNext && onNext ? (
          <button
            type="button"
            id="eora-onboarding-next-btn"
            data-eora-id="eora-onboarding-next-btn"
            className="btn-purple-next group"
            onClick={onNext}
            disabled={isNextDisabled}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px 26px",
              borderRadius: 9999,
              background: "linear-gradient(110deg, #02C5F5 0%, #4564FF 48%, #9335E8 100%)",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              cursor: isNextDisabled ? "not-allowed" : "pointer",
              opacity: isNextDisabled ? 0.6 : 1,
              boxShadow: "0 4px 18px rgba(69, 100, 255, 0.4)",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseEnter={(e) => {
              if (!isNextDisabled) {
                e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(147, 53, 232, 0.5)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isNextDisabled) {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow = "0 4px 18px rgba(69, 100, 255, 0.4)";
              }
            }}
          >
            <span>{nextLabel}</span>
            {nextIcon}
          </button>
        ) : (
          <div style={{ width: 130 }} />
        )}
      </div>
    </footer>
  );
}

