"use client";

import { Compass, Pencil, Sparkles } from "lucide-react";
import type { Goal } from "@/lib/domain";

type GoalCardProps = {
  goal: Goal | null;
  dimensionCount: number;
  onOpenChangeGoal: () => void;
};

export function GoalCard({ goal, dimensionCount, onOpenChangeGoal }: GoalCardProps) {
  return (
    <section className="workspace-card goal-card" aria-labelledby="goal-heading">
      <div className="card-topline">
        <span className="card-eyebrow">
          <Compass size={15} aria-hidden="true" />
          ACTIVE DIRECTION
        </span>
        <span className="card-pill">
          {goal?.source === "preset" ? "Preset trajectory" : "Custom direction"}
        </span>
      </div>

      <div className="goal-main-content">
        <div>
          <h2 id="goal-heading" className="goal-title">
            {goal?.title || "ML Engineer"}
          </h2>
          <p className="goal-subtext">
            Evaluating {dimensionCount} core dimensions for this goal. Changing your goal recomputes gaps without wiping existing evidence.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenChangeGoal}
          className="button button-quiet goal-change-btn"
          aria-label="Change current goal"
        >
          <Pencil size={15} aria-hidden="true" />
          Change goal
        </button>
      </div>

      <div className="goal-footer-note">
        <Sparkles size={14} aria-hidden="true" />
        <span>Direction is flexible — explore anytime without losing recorded evidence.</span>
      </div>
    </section>
  );
}
