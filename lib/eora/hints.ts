/**
 * EORA's zero-LLM page hints (Task 1.4.2): a rule table over data already in
 * the database. Deterministic, no network, no model: the same state always
 * produces the same hints, in the same order.
 */
import { SOURCE_SYNC_POLICY } from "@/lib/sync/policy";
import type { SyncSource } from "@/lib/sync/state-machine";

export type EoraHint = {
  id: string;
  kind: "missing_skills" | "connect_github" | "review_repositories" | "stale_sync" | "failed_import" | "request_verification";
  priority: number; // lower = shown first
  message: string;
  action: { label: string; href: string };
};

export type HintInput = {
  now?: number;
  role: "student" | "faculty";
  /** Skills of the next roadmap stage that have no evidence yet. */
  missingSkills: string[];
  nextMilestoneTitle: string | null;
  connections: { provider: string; status: string; lastSyncedAt: Date | string | null }[];
  githubCandidateProjects: number;
  skillsCount: number;
  verifiedEvidenceCount: number;
  failedSyncs: { source: string; state: string }[];
};

const LABEL: Record<string, string> = { github: "GitHub", leetcode: "LeetCode", hackerrank: "HackerRank", kaggle: "Kaggle", scholar: "research papers", linkedin: "LinkedIn", resume: "CV" };
const DAY = 24 * 60 * 60 * 1000;

export function buildSuggestedHints(input: HintInput, limit = 4): EoraHint[] {
  if (input.role !== "student") return [];
  const now = input.now ?? Date.now();
  const hints: EoraHint[] = [];

  for (const f of input.failedSyncs) {
    hints.push({
      id: `failed_import:${f.source}`, kind: "failed_import", priority: 1,
      message: `Your ${LABEL[f.source] ?? f.source} import didn't finish. Open your data sources to see why and retry.`,
      action: { label: "See what happened", href: "/student/connections" },
    });
  }
  if (input.missingSkills.length) {
    const shown = input.missingSkills.slice(0, 3).join(", ");
    hints.push({
      id: "missing_skills", kind: "missing_skills", priority: 2,
      message: `${input.nextMilestoneTitle ? `Next milestone: ${input.nextMilestoneTitle}. ` : ""}No evidence yet for ${shown}${input.missingSkills.length > 3 ? ` and ${input.missingSkills.length - 3} more` : ""}.`,
      action: { label: "Open roadmap", href: "/student/roadmap" },
    });
  }
  const github = input.connections.find((c) => c.provider === "github" && c.status !== "disconnected");
  if (!github) {
    hints.push({
      id: "connect_github", kind: "connect_github", priority: 3,
      message: "Connect GitHub so your repositories can back up the skills on your profile.",
      action: { label: "Connect GitHub", href: "/student/connections" },
    });
  }
  if (input.githubCandidateProjects > 0) {
    hints.push({
      id: "review_repositories", kind: "review_repositories", priority: 3,
      message: `${input.githubCandidateProjects} ${input.githubCandidateProjects === 1 ? "repository is" : "repositories are"} waiting for you to confirm as projects.`,
      action: { label: "Review projects", href: "/student/projects" },
    });
  }
  for (const c of input.connections) {
    if (c.status === "disconnected" || !c.lastSyncedAt || !(c.provider in SOURCE_SYNC_POLICY)) continue;
    const age = now - new Date(c.lastSyncedAt).getTime();
    const ttl = SOURCE_SYNC_POLICY[c.provider as SyncSource].ttlMs;
    // Only nudge once data is clearly old: twice the refresh window, and at least a week.
    if (age > Math.max(2 * ttl, 7 * DAY)) {
      hints.push({
        id: `stale_sync:${c.provider}`, kind: "stale_sync", priority: 4,
        message: `Your ${LABEL[c.provider] ?? c.provider} data is ${Math.floor(age / DAY)} days old.`,
        action: { label: "Sync now", href: "/student/connections" },
      });
    }
  }
  if (input.skillsCount >= 3 && input.verifiedEvidenceCount === 0) {
    hints.push({
      id: "request_verification", kind: "request_verification", priority: 5,
      message: "None of your skills are verified yet. A faculty review or an assessment moves a skill to Verified.",
      action: { label: "See your skills", href: "/student/skills" },
    });
  }
  return hints.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)).slice(0, limit);
}
