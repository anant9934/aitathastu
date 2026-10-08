import type { PersonProfile } from "./person";
import type { Goal } from "./goal";
import type { EvidenceItem } from "./evidence";
import type { JourneyEvent } from "./journey";
import type { ActionStatus } from "./recommendations";

export const WORKSPACE_STORAGE_KEY = "ai-tathastu-workspace-v1";

export type WorkspaceState = {
  version: 1;
  person: PersonProfile;
  goal: Goal;
  evidence: EvidenceItem[];
  journeyEvents: JourneyEvent[];
  actionStates: Record<string, ActionStatus>;
  eoraDismissed: boolean;
  lastUpdated: string;
};

export function saveWorkspaceState(state: WorkspaceState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Unable to save workspace state to localStorage", err);
  }
}

export function loadWorkspaceState(): WorkspaceState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && parsed.person && parsed.goal && Array.isArray(parsed.evidence)) {
      return parsed as WorkspaceState;
    }
  } catch (err) {
    console.warn("Unable to parse workspace state from localStorage", err);
  }
  return null;
}
