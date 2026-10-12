/**
 * Merges a guest's onboarding progress into an existing account on sign-in.
 *
 * Without this, signing in (password or Google) just switched the cookie to
 * the existing account and the guest's draft, uploaded CV, review claims,
 * imports and projects were silently orphaned.
 *
 * Rules (additive, never destructive to the account):
 *   - history-like rows (CV documents/blobs/jobs/snapshots, journey events,
 *     sync runs, activities, artifacts) always move to the account;
 *   - deduplicated rows move only if the account lacks an equivalent:
 *     evidence (same category + subject), projects (same normalized title or
 *     repo URL), external connections (same provider);
 *   - single-row state (onboarding draft, person profile, preferences, goals)
 *     moves only if the account has none; otherwise the account's copy wins
 *     and the skip is recorded in the result and journey event.
 * The guest account is then deleted.
 *
 * The Neon HTTP driver has no interactive transactions, so each step is a
 * plain idempotent UPDATE/DELETE keyed by person id: if a step fails, the
 * guest still exists with whatever was not yet moved, and re-running the
 * merge on the next sign-in finishes the job.
 */

import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  getDb,
  persons,
  onboardingDrafts,
  personProfiles,
  userPreferences,
  goals,
  roadmapMilestones,
  resumeDocuments,
  resumeDocumentBlobs,
  resumeReviewHistory,
  sourceProcessingJobs,
  sourceSnapshots,
  journeyEvents,
  syncRuns,
  codingPracticeActivities,
  learningActivities,
  intelligenceArtifacts,
  personProfileVersions,
  sourceConflicts,
  evidenceItems,
  projects,
  projectContributions,
  externalConnections,
} from "@/lib/db";
import type { AuthContext } from "./session";
import { isGuestEmail } from "./server-session";
import { deleteAccountCompletely } from "@/lib/services/guest-cleanup-service";
import { normalizeProjectTitle } from "@/lib/text/normalize";

export type GuestMergeResult = { moved: Record<string, number>; keptAccountVersion: string[] };

/** Returns null when there is no guest to merge (no session, a real account, or the same account). */
export async function mergeGuestIntoAccount(
  guest: AuthContext | null,
  target: { userId: string; personId: string }
): Promise<GuestMergeResult | null> {
  if (!guest || !isGuestEmail(guest.user.email) || guest.user.id === target.userId || !target.personId) return null;
  const db = await getDb();
  const from = guest.person.id;
  const to = target.personId;
  const result: GuestMergeResult = { moved: {}, keptAccountVersion: [] };
  const count = (name: string, n: number) => { if (n) result.moved[name] = (result.moved[name] ?? 0) + n; };

  // History-like rows: always move.
  const alwaysMove = [
    ["resume_documents", resumeDocuments],
    ["resume_document_blobs", resumeDocumentBlobs],
    ["resume_review_history", resumeReviewHistory],
    ["source_processing_jobs", sourceProcessingJobs],
    ["source_snapshots", sourceSnapshots],
    ["journey_events", journeyEvents],
    ["sync_runs", syncRuns],
    ["coding_practice_activities", codingPracticeActivities],
    ["learning_activities", learningActivities],
    ["intelligence_artifacts", intelligenceArtifacts],
    ["person_profile_versions", personProfileVersions],
    ["source_conflicts", sourceConflicts],
  ] as const;
  for (const [name, table] of alwaysMove) {
    const rows = await db.update(table).set({ personId: to }).where(eq(table.personId, from)).returning();
    count(name, rows.length);
  }

  // Single-row state: move only when the account has none.
  const singletons = [
    ["onboarding_draft", onboardingDrafts],
    ["person_profile", personProfiles],
    ["user_preferences", userPreferences],
  ] as const;
  for (const [name, table] of singletons) {
    const [existing] = await db.select().from(table).where(eq(table.personId, to)).limit(1);
    if (existing) {
      const [guestRow] = await db.select().from(table).where(eq(table.personId, from)).limit(1);
      if (guestRow) result.keptAccountVersion.push(name);
      continue;
    }
    const rows = await db.update(table).set({ personId: to }).where(eq(table.personId, from)).returning();
    count(name, rows.length);
  }
  const [accountGoal] = await db.select().from(goals).where(eq(goals.personId, to)).limit(1);
  if (accountGoal) {
    const [guestGoal] = await db.select().from(goals).where(eq(goals.personId, from)).limit(1);
    if (guestGoal) result.keptAccountVersion.push("goals");
  } else {
    count("goals", (await db.update(goals).set({ personId: to }).where(eq(goals.personId, from)).returning()).length);
    count("roadmap_milestones", (await db.update(roadmapMilestones).set({ personId: to }).where(eq(roadmapMilestones.personId, from)).returning()).length);
  }

  // Deduplicated rows: move only what the account does not already have.
  const accountEvidence = new Set(
    (await db.select().from(evidenceItems).where(eq(evidenceItems.personId, to))).map((e) => `${e.category}:${e.subject.trim().toLowerCase()}`)
  );
  const guestEvidence = await db.select().from(evidenceItems).where(eq(evidenceItems.personId, from));
  const evidenceToMove = guestEvidence.filter((e) => !accountEvidence.has(`${e.category}:${e.subject.trim().toLowerCase()}`)).map((e) => e.id);
  if (evidenceToMove.length) {
    count("evidence_items", (await db.update(evidenceItems).set({ personId: to }).where(inArray(evidenceItems.id, evidenceToMove)).returning()).length);
  }

  const accountProjects = await db.select().from(projects).where(eq(projects.personId, to));
  const takenTitles = new Set(accountProjects.map((p) => normalizeProjectTitle(p.title)));
  const takenRepos = new Set(accountProjects.map((p) => p.repositoryUrl?.toLowerCase()).filter(Boolean));
  const guestProjects = await db.select().from(projects).where(eq(projects.personId, from));
  const projectsToMove = guestProjects
    .filter((p) => !takenTitles.has(normalizeProjectTitle(p.title)) && !(p.repositoryUrl && takenRepos.has(p.repositoryUrl.toLowerCase())))
    .map((p) => p.id);
  if (projectsToMove.length) {
    count("projects", (await db.update(projects).set({ personId: to, normalizedTitle: undefined }).where(inArray(projects.id, projectsToMove)).returning()).length);
    await db.update(projectContributions).set({ personId: to }).where(inArray(projectContributions.projectId, projectsToMove));
  }

  const accountProviders = new Set((await db.select().from(externalConnections).where(eq(externalConnections.personId, to))).map((c) => c.provider));
  const connectionsToMove = (await db.select().from(externalConnections).where(eq(externalConnections.personId, from)))
    .filter((c) => !accountProviders.has(c.provider))
    .map((c) => c.id);
  if (connectionsToMove.length) {
    count("external_connections", (await db.update(externalConnections).set({ personId: to }).where(inArray(externalConnections.id, connectionsToMove)).returning()).length);
  }

  // Everything left on the guest (duplicates, sessions) goes with it.
  await deleteAccountCompletely(guest.user.id);

  if (Object.keys(result.moved).length || result.keptAccountVersion.length) {
    await db.insert(journeyEvents).values({
      id: `je_merge_${crypto.randomBytes(8).toString("hex")}`,
      personId: to,
      type: "guest_progress_merged",
      title: "Onboarding progress merged into your account",
      description: result.keptAccountVersion.length
        ? `Kept your account's existing ${result.keptAccountVersion.join(", ")} instead of the guest copy.`
        : "Progress from before you signed in was added to your account.",
      metadata: result,
    });
  }
  console.info("[guest-merge] merged guest into account", { guestPersonId: from, personId: to, ...result });
  return result;
}

/** Looks up the person for a user id (used by sign-in routes that only know the user). */
export async function personIdForUser(userId: string): Promise<string | null> {
  const db = await getDb();
  const [p] = await db.select({ id: persons.id }).from(persons).where(eq(persons.primaryUserId, userId)).limit(1);
  return p?.id ?? null;
}

/**
 * Called by sign-in / sign-up / OAuth callbacks just before switching the
 * session to `target`. Never blocks sign-in: on failure the guest (with
 * whatever was not moved yet) is kept and the error is logged.
 */
export async function mergeGuestOnSignIn(target: { userId: string; personId: string | null | undefined }) {
  if (!target.personId) return null;
  try {
    const { getServerAuthContext } = await import("./server-session");
    return await mergeGuestIntoAccount(await getServerAuthContext(), { userId: target.userId, personId: target.personId });
  } catch (err) {
    console.error("[guest-merge] merge failed; guest kept for a later attempt", { userId: target.userId, error: err instanceof Error ? err.message : err });
    return null;
  }
}
