import { getPersonById, updatePersonProfileData } from "../repositories/person-repository";
import { setActiveGoal } from "../repositories/goal-repository";
import { createEvidenceRecord, type EvidenceInsertParams } from "../repositories/evidence-repository";
import { createJourneyEventRecord, type JourneyEventInsertParams } from "../repositories/journey-repository";
import { setActionState } from "../repositories/action-repository";
import { can } from "../auth/rbac";
import type { WorkspaceState } from "../domain/workspace";
import type { ActionStatus } from "../domain";
import type { JourneyState } from "../onboarding";
import { splitItems } from "../domain/migrate";

export type ImportPayload = {
  workspaceState?: WorkspaceState | null;
  onboardingState?: JourneyState | null;
};

export type ImportResult = {
  success: boolean;
  message: string;
  importedEvidenceCount: number;
  importedEventsCount: number;
  activeGoalTitle: string;
};

export async function importLocalProgress(
  personId: string,
  requesterPersonId: string,
  payload: ImportPayload
): Promise<ImportResult> {
  const isAuthorized = await can(requesterPersonId, "profile.update.self", {
    targetPersonId: personId,
  });

  if (!isAuthorized) {
    throw new Error("Unauthorized: Cannot import progress into this account.");
  }

  const person = await getPersonById(personId);
  if (!person) {
    throw new Error("Person not found.");
  }

  const { workspaceState, onboardingState } = payload;
  if (!workspaceState && !onboardingState) {
    return {
      success: true,
      message: "No local progress to import.",
      importedEvidenceCount: 0,
      importedEventsCount: 0,
      activeGoalTitle: "",
    };
  }

  let importedEvidenceCount = 0;
  let importedEventsCount = 0;
  let activeGoalTitle = "ML Engineer";

  // 1. Profile details
  const nameToUse =
    workspaceState?.person?.name ||
    onboardingState?.details?.name ||
    person.displayName;

  const educationToUse =
    workspaceState?.person?.education ||
    onboardingState?.details?.education ||
    "";

  const experienceToUse =
    workspaceState?.person?.experience ||
    onboardingState?.details?.experience ||
    "";

  await updatePersonProfileData(personId, {
    displayName: nameToUse || undefined,
    education: educationToUse || undefined,
    experience: experienceToUse || undefined,
  });

  // 2. Goal persistence
  if (workspaceState?.goal?.title) {
    activeGoalTitle = workspaceState.goal.title;
    await setActiveGoal(personId, activeGoalTitle, workspaceState.goal.description, workspaceState.goal.source);
  } else if (onboardingState?.goal) {
    activeGoalTitle = onboardingState.goal;
    await setActiveGoal(personId, activeGoalTitle, undefined, "custom");
  } else {
    await setActiveGoal(personId, "ML Engineer", undefined, "preset");
  }

  // 3. Evidence Import (Strictly preserving unverified/self-reported provenance)
  const evidenceToImport: EvidenceInsertParams[] = [];

  if (workspaceState?.evidence && Array.isArray(workspaceState.evidence)) {
    for (const item of workspaceState.evidence) {
      // NEVER upgrade verification status
      const verificationStatus =
        item.verificationStatus === "verified" ? "self_reported" : item.verificationStatus;

      const importKey = `imp_${personId}_${item.category}_${item.subject.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

      evidenceToImport.push({
        category: item.category,
        subject: item.subject,
        value: item.value,
        source: item.source,
        verificationStatus,
        observedAt: item.observedAt,
        interpretation: item.interpretation,
        whyItMatters: item.whyItMatters,
        importKey,
      });
    }
  } else if (onboardingState) {
    const isResume = onboardingState.profileSource === "resume";
    const source = isResume ? "resume_extracted" : "self_reported";
    const verificationStatus = isResume ? "unverified" : "self_reported";
    const now = new Date().toISOString();

    // Goal evidence
    evidenceToImport.push({
      category: "goal",
      subject: activeGoalTitle,
      value: `Selected active direction: ${activeGoalTitle}`,
      source: "self_reported",
      verificationStatus: "self_reported",
      observedAt: now,
      interpretation: "Your self-selected direction. Provides orientation for gap analysis and next actions.",
      whyItMatters: "Directs what dimensions Tathastu evaluates for relevance.",
      importKey: `imp_${personId}_goal_${activeGoalTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    });

    // Education
    if (onboardingState.details.education) {
      evidenceToImport.push({
        category: "education",
        subject: onboardingState.details.education,
        value: onboardingState.details.education,
        source,
        verificationStatus,
        observedAt: now,
        interpretation: isResume
          ? "Extracted from your resume. Helpful background context, not an official transcript."
          : "Entered by you during onboarding. Self-reported learning background.",
        whyItMatters: "Helps understand foundational learning exposure.",
        importKey: `imp_${personId}_edu_entry`,
      });
    }

    // Skills
    if (onboardingState.details.skills) {
      const skills = splitItems(onboardingState.details.skills);
      for (const skill of skills) {
        evidenceToImport.push({
          category: "skill",
          subject: skill,
          value: `Mentioned in ${isResume ? "resume" : "self-reported profile"}: ${skill}`,
          source,
          verificationStatus,
          observedAt: now,
          interpretation: isResume
            ? "Appears in your reviewed resume information. This does not yet prove proficiency."
            : "Self-reported skill entry. Provides focus for practice and project evidence.",
          whyItMatters: "Identifies areas where hands-on build or deployment evidence can be collected.",
          importKey: `imp_${personId}_skill_${skill.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        });
      }
    }

    // Experience
    if (onboardingState.details.experience) {
      evidenceToImport.push({
        category: "experience",
        subject: "Prior experience & projects",
        value: onboardingState.details.experience,
        source,
        verificationStatus,
        observedAt: now,
        interpretation: isResume
          ? "Summary from your reviewed resume. Gives context on things you have tried."
          : "Self-reported background notes. Useful context for tailoring next steps.",
        whyItMatters: "Provides initial context on previous projects or work exposure.",
        importKey: `imp_${personId}_exp_entry`,
      });
    }
  }

  // Insert evidence items idempotently
  for (const item of evidenceToImport) {
    await createEvidenceRecord(personId, item);
    importedEvidenceCount++;
  }

  // 4. Journey Events Import
  const eventsToImport: JourneyEventInsertParams[] = [];
  if (workspaceState?.journeyEvents && Array.isArray(workspaceState.journeyEvents)) {
    for (const ev of workspaceState.journeyEvents) {
      eventsToImport.push({
        type: ev.type,
        title: ev.title,
        description: ev.description,
        timestamp: ev.timestamp,
        metadata: ev.metadata,
        importKey: `imp_je_${personId}_${ev.type}_${(ev.timestamp || "").slice(0, 19)}`,
      });
    }
  }

  for (const ev of eventsToImport) {
    await createJourneyEventRecord(personId, ev);
    importedEventsCount++;
  }

  // 5. Action States
  if (workspaceState?.actionStates) {
    for (const [key, status] of Object.entries(workspaceState.actionStates)) {
      await setActionState(personId, key, status as ActionStatus);
    }
  }

  // 6. Record local_progress_imported event
  await createJourneyEventRecord(personId, {
    type: "local_progress_imported",
    title: "Local progress connected",
    description: `Successfully synchronized on-device journey (${importedEvidenceCount} evidence items) with your Tathastu account.`,
    importKey: `imp_done_${personId}`,
  });

  return {
    success: true,
    message: "Local progress imported successfully.",
    importedEvidenceCount,
    importedEventsCount,
    activeGoalTitle,
  };
}
