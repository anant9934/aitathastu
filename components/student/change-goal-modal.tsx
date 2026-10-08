"use client";

import React, { useState } from "react";
import { X, Check, ArrowRight, Bot, BrainCircuit, Cpu, FlaskConical, BarChart3, Rocket, Compass } from "lucide-react";
import { AIML_ROLE_CATALOG, AIML_GOAL_OUTCOMES, validateCustomGoal } from "@/lib/domain/aiml-role-taxonomy";

type ChangeGoalModalProps = {
  currentGoalTitle: string;
  currentTargetRole?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectGoal: (newTitle: string, newTargetRole?: string) => void;
};

const roleIcons: Record<string, React.ElementType> = {
  genai_engineer: Bot,
  ml_engineer: BrainCircuit,
  ai_engineer: Cpu,
  ai_researcher: FlaskConical,
  data_scientist_aiml: BarChart3,
  ai_product_builder: Rocket,
  exploring_aiml: Compass,
};

export function ChangeGoalModal({
  currentGoalTitle,
  currentTargetRole = "Generative AI Engineer",
  isOpen,
  onClose,
  onSelectGoal,
}: ChangeGoalModalProps) {
  const [selectedRole, setSelectedRole] = useState(currentTargetRole);
  const [selectedGoal, setSelectedGoal] = useState(currentGoalTitle);
  const [customGoalText, setCustomGoalText] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let finalGoal = selectedGoal;
    if (isCustomMode) {
      const v = validateCustomGoal(customGoalText);
      if (!v.valid) {
        setError(v.error || "Please enter a valid goal.");
        return;
      }
      finalGoal = customGoalText.trim();
    }

    onSelectGoal(finalGoal, selectedRole);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-direction-title"
      onClick={onClose}
    >
      <div className="modal-panel" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-eyebrow">FLEXIBLE AI/ML DIRECTION</span>
            <h2 id="change-direction-title" className="modal-title">
              Update Your AI/ML Direction
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close direction modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <p className="modal-description">
            Your direction can evolve anytime. Changing your target role or goal recalibrates your roadmap and next actions while preserving all previously collected evidence.
          </p>

          {error && (
            <div style={{ padding: "8px 12px", background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="field-label" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
              1. Target AI/ML Role
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {AIML_ROLE_CATALOG.slice(0, 6).map((role) => {
                const isSelected = selectedRole.toLowerCase() === role.title.toLowerCase();
                const Icon = roleIcons[role.id] || BrainCircuit;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.title)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1.5px solid",
                      borderColor: isSelected ? "#5942DC" : "#E2E8F0",
                      background: isSelected ? "rgba(89, 66, 220, 0.08)" : "#FFFFFF",
                      color: isSelected ? "#5942DC" : "#1E293B",
                      fontSize: 13,
                      fontWeight: isSelected ? 750 : 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <Icon size={16} />
                    <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {role.title}
                    </span>
                    {isSelected && <Check size={14} color="#5942DC" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field-label" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
              2. First Big Goal
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {AIML_GOAL_OUTCOMES.slice(0, 4).map((outcome) => {
                const isSelected = !isCustomMode && selectedGoal === outcome.label;
                return (
                  <button
                    key={outcome.id}
                    type="button"
                    onClick={() => {
                      setSelectedGoal(outcome.label);
                      setIsCustomMode(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: isSelected ? "#5942DC" : "#E2E8F0",
                      background: isSelected ? "rgba(89, 66, 220, 0.06)" : "#FFFFFF",
                      color: isSelected ? "#5942DC" : "#334155",
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{outcome.label}</span>
                    {isSelected && <Check size={14} color="#5942DC" />}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCustomMode(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: isCustomMode ? "#5942DC" : "#E2E8F0",
                  background: isCustomMode ? "rgba(89, 66, 220, 0.06)" : "#FFFFFF",
                  color: isCustomMode ? "#5942DC" : "#334155",
                  fontSize: 13,
                  fontWeight: isCustomMode ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span>Set custom goal...</span>
                {isCustomMode && <Check size={14} color="#5942DC" />}
              </button>
            </div>

            {isCustomMode && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="e.g. Build and deploy a multi-agent RAG system..."
                  value={customGoalText}
                  onChange={(e) => setCustomGoalText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1.5px solid #5942DC",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} className="button button-quiet" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#FFFFFF", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 20px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #5942DC 0%, #4564FF 100%)",
                color: "#FFFFFF",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Update Direction <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
