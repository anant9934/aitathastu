"use client";

/**
 * EORA STUDENT BRIDGE — PHASE 5
 * Feeds authenticated student data into the EoraProvider.
 *
 * Security contract:
 * - Only passes the safe EoraLiveStudentData subset
 * - Never passes OAuth tokens, passwords, or raw session data
 * - Clears EORA context when component unmounts (sign-out)
 */

import { useEffect } from "react";
import { useEoraSafe, type EoraLiveStudentData } from "@/components/eora/eora-provider";
import type { WorkspaceState } from "@/lib/domain";
import type { EvidenceItem } from "@/lib/domain/evidence";

interface EoraStudentBridgeProps {
  workspace: WorkspaceState | null;
  hydrated: boolean;
  primaryPriority: string | null;
  secondaryPriorities: string[];
  targetRole: string | null;
  nextMilestoneTitle: string | null;
  isProcessing: boolean;
  /** Provider names only (e.g. ["github"]) — never tokens */
  connectedSources: string[];
  isFirstSession: boolean;
  /** Optional overrides when workspace.evidence is not available */
  skillsCountOverride?: number;
  projectsCountOverride?: number;
  verifiedCountOverride?: number;
}

export function EoraStudentBridge({
  workspace,
  hydrated,
  primaryPriority,
  secondaryPriorities,
  targetRole,
  nextMilestoneTitle,
  isProcessing,
  connectedSources,
  isFirstSession,
  skillsCountOverride,
  projectsCountOverride,
  verifiedCountOverride,
}: EoraStudentBridgeProps) {
  const eora = useEoraSafe();

  useEffect(() => {
    if (!hydrated || !workspace?.person || !eora) return;

    const evidence: EvidenceItem[] = workspace.evidence || [];
    const skillsCount =
      skillsCountOverride ??
      evidence.filter((e) => e.category === "skill").length;
    const projectsCount =
      projectsCountOverride ??
      (workspace as unknown as { projects?: unknown[] }).projects?.length ?? 0;
    const verifiedCount =
      verifiedCountOverride ??
      evidence.filter((e) => e.verificationStatus === "verified").length;

    const data: EoraLiveStudentData = {
      personId: workspace.person.id,
      displayName: workspace.person.name,
      isAuthenticated: true,
      activeGoalTitle: workspace.goal?.title ?? null,
      targetRole,
      primaryPriority,
      secondaryPriorities,
      skillsCount,
      projectsCount,
      verifiedEvidenceCount: verifiedCount,
      connectedSources,
      nextMilestoneTitle,
      isProcessing,
      isFirstSession,
    };

    eora.updateLiveStudentContext(data);
  }, [
    hydrated,
    workspace,
    primaryPriority,
    secondaryPriorities,
    targetRole,
    nextMilestoneTitle,
    isProcessing,
    connectedSources,
    isFirstSession,
    skillsCountOverride,
    projectsCountOverride,
    verifiedCountOverride,
    eora,
  ]);

  // Clear on unmount (navigation away from student workspace → sign-out)
  useEffect(() => {
    return () => { eora?.clearStudentContext(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
