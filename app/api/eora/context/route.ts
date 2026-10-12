/**
 * /api/eora/context
 *
 * Returns the minimal, authorised, security-reviewed context EORA needs
 * to operate in the browser. This is the single authoritative server-side
 * assembly point for all EORA live data.
 *
 * Security contract:
 * - Requires authenticated session
 * - Returns only the safe EORA subset — no tokens, passwords, or other
 *   students' data
 * - Never returns raw OAuth credentials, connection tokens, or session keys
 * - Tenant-isolated: always uses the authenticated person's own ID
 *
 * Returned shape is the EoraLiveStudentData interface without isAuthenticated
 * (the client adds that flag).
 */

import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getUserPreferences } from "@/lib/repositories/person-repository";
import { getActiveGoal } from "@/lib/repositories/goal-repository";
import { getEvidenceByPersonId } from "@/lib/repositories/evidence-repository";
import { getProjectsByPersonId } from "@/lib/repositories/project-repository";
import { getExternalConnections } from "@/lib/repositories/connection-repository";
import { generatePersonalizedRoadmap } from "@/lib/domain/roadmap";
import { normalizeInterest } from "@/lib/domain/personalization-engine";
import { validPurposeIds } from "@/lib/domain/adaptive-workspace";
import { can } from "@/lib/auth/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface EoraContextResponse {
  role: "student" | "faculty";
  facultyAuthorized: boolean;
  personId: string;
  displayName: string;
  activeGoalTitle: string | null;
  targetRole: string | null;
  primaryPriority: string | null;
  secondaryPriorities: string[];
  skillsCount: number;
  projectsCount: number;
  verifiedEvidenceCount: number;
  connectedSources: string[];
  nextMilestoneTitle: string | null;
  nextMilestoneDescription: string | null;
  isProcessing: boolean;
  /** ISO timestamp for cache validation */
  fetchedAt: string;
}

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const personId = auth.person.id;

    // Parallel fetch — all data for this person only
    const [prefs, activeGoal, evidenceList, allProjects, connections] =
      await Promise.all([
        getUserPreferences(personId).catch(() => null),
        getActiveGoal(personId).catch(() => null),
        getEvidenceByPersonId(personId).catch(() => []),
        getProjectsByPersonId(personId).catch(() => []),
        getExternalConnections(personId).catch(() => []),
      ]);

    // ── Skills and evidence counts ─────────────────────────────────────────
    const skills = evidenceList.filter((e) => e.category === "skill");
    const verifiedCount = evidenceList.filter(
      (e) => e.verificationStatus === "verified"
    ).length;
    const confirmedProjects = allProjects.filter((p) => p.status === "confirmed");

    // ── Connected sources — provider names only, never tokens ──────────────
    // Sources EORA may mention. "detected"/"reference_only" are included but
    // tagged, so EORA never claims an unverified account is connected.
    const connectedSources = connections
      .filter((c) => c.status === "connected" || c.status === "reference_only" || c.status === "detected")
      .map((c) => (c.status === "connected" ? c.provider : `${c.provider} (linked, unverified)`));

    // ── Priorities ─────────────────────────────────────────────────────────
    const rawMetadata = (prefs?.metadata as Record<string, unknown>) || {};
    const facultyAuthorized = await can(personId, "student.verify_skill");
    const role = rawMetadata.requestedRole === "faculty" || facultyAuthorized ? "faculty" : "student";
    const rawPrimary = prefs?.primaryPriority || (rawMetadata.primaryPriority as string) || null;
    const rankedPurposes = validPurposeIds(role, [rawPrimary, ...(Array.isArray(prefs?.secondaryPriorities) ? prefs.secondaryPriorities : [])]);
    const primaryPriority: string | null = rankedPurposes[0] || null;

    const secondaryPriorities: string[] = rankedPurposes.slice(1);

    // ── Target role ────────────────────────────────────────────────────────
    const targetRole =
      (rawMetadata.targetRole as string) || activeGoal?.title || null;

    // ── Roadmap: next incomplete milestone ─────────────────────────────────
    let nextMilestoneTitle: string | null = null;
    let nextMilestoneDescription: string | null = null;

    if (role === "student" && activeGoal?.title) {
      try {
        const evidencedSkills = skills
          .filter((e) => e.verificationStatus === "verified")
          .map((e) => e.subject);

        const roadmap = generatePersonalizedRoadmap(
          activeGoal.title,
          evidencedSkills,
          undefined,
          undefined,
          {
            targetRole: targetRole ?? undefined,
            specificGoal: activeGoal.title,
            primaryPriority: primaryPriority ? normalizeInterest(primaryPriority) : undefined,
            confirmedProjectCount: confirmedProjects.length,
          }
        );

        // Find the first non-completed stage
        const nextStage = roadmap.stages.find(
          (s) => s.status !== "completed"
        );
        if (nextStage) {
          nextMilestoneTitle = nextStage.title;
          nextMilestoneDescription = nextStage.description ?? null;
        }
      } catch {
        // Roadmap generation failure must not break EORA context
        nextMilestoneTitle = null;
        nextMilestoneDescription = null;
      }
    }

    // ── Processing state — any source currently syncing? ──────────────────
    const isProcessing = connections.some(
      (c) => c.status === "syncing"
    );

    const response: EoraContextResponse = {
      role,
      facultyAuthorized,
      personId,
      displayName: auth.person.displayName,
      activeGoalTitle: activeGoal?.title ?? null,
      targetRole,
      primaryPriority,
      secondaryPriorities,
      skillsCount: skills.length,
      projectsCount: confirmedProjects.length,
      verifiedEvidenceCount: verifiedCount,
      connectedSources,
      nextMilestoneTitle,
      nextMilestoneDescription,
      isProcessing,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        // Person-specific guidance must never survive sign-out or account switching.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "EORA context unavailable";
    console.error("[EORA Context Error]", msg);
    // Return graceful empty context so EORA can still function in offline mode
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
