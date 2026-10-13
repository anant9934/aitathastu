export const PRESET_GOALS = ["ML Engineer", "AI Researcher", "AI Founder"] as const;
export type PresetGoalTitle = (typeof PRESET_GOALS)[number];

export type GoalStatus = "active" | "paused" | "achieved";
export type GoalSource = "preset" | "custom";

export type Goal = {
  id: string;
  title: string;
  description?: string;
  status: GoalStatus;
  source: GoalSource;
  createdAt: string;
  updatedAt: string;
};

function isPresetGoal(title: string): boolean {
  const norm = title.trim().toLowerCase();
  return PRESET_GOALS.some((p) => p.toLowerCase() === norm);
}

export function createGoal(title: string, options?: { description?: string; source?: GoalSource; id?: string }): Goal {
  const now = new Date().toISOString();
  const trimmedTitle = title.trim();
  const source: GoalSource = options?.source || (isPresetGoal(trimmedTitle) ? "preset" : "custom");

  return {
    id: options?.id || `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: trimmedTitle || "Explore Possibilities",
    description: options?.description?.trim(),
    status: "active",
    source,
    createdAt: now,
    updatedAt: now,
  };
}
