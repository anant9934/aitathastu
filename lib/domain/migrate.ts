import { ONBOARDING_STORAGE_KEY, safeJourney, type JourneyState } from "../onboarding";
import { createPersonProfile } from "./person";
import { createGoal } from "./goal";
import { createEvidenceItem, type EvidenceItem, type EvidenceSource, type VerificationStatus } from "./evidence";
import { createJourneyEvent, type JourneyEvent } from "./journey";
import { loadWorkspaceState, saveWorkspaceState, type WorkspaceState } from "./workspace";

export function splitItems(str: string): string[] {
  return str
    .split(/[,;\n•–—]+/)
    .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
    .filter((s) => s.length > 0 && s.length < 80);
}

export function migrateOnboardingToWorkspace(
  onboarding: JourneyState,
  existingWorkspace?: WorkspaceState | null
): WorkspaceState {
  const now = new Date().toISOString();

  // If already migrated and person matches, don't re-create or wipe out actions
  if (
    existingWorkspace &&
    existingWorkspace.goal.title === (onboarding.goal || existingWorkspace.goal.title) &&
    existingWorkspace.person.name === (onboarding.details.name || existingWorkspace.person.name) &&
    existingWorkspace.evidence.length > 0
  ) {
    return existingWorkspace;
  }

  const person = createPersonProfile({
    name: onboarding.details.name || existingWorkspace?.person.name || "",
    education: onboarding.details.education || existingWorkspace?.person.education || "",
    experience: onboarding.details.experience || existingWorkspace?.person.experience || "",
  });

  const goalTitle = onboarding.goal.trim() || existingWorkspace?.goal.title || "ML Engineer";
  const goal = createGoal(goalTitle);

  const evidence: EvidenceItem[] = [];
  const events: JourneyEvent[] = [];

  // Goal evidence
  evidence.push(
    createEvidenceItem({
      id: "ev_goal_active",
      category: "goal",
      subject: goal.title,
      value: `Selected active direction: ${goal.title}`,
      source: "self_reported",
      verificationStatus: "self_reported",
      observedAt: now,
      interpretation: "Your self-selected direction. Provides orientation for gap analysis and next actions.",
      whyItMatters: "Directs what dimensions Tathastu evaluates for relevance.",
    })
  );

  // Initial journey events
  events.push(
    createJourneyEvent(
      "onboarding_started",
      "Journey started",
      "Initiated the AI Tathastu pathway discovery."
    )
  );

  // Resume or manual processing events & evidence
  const isResume = onboarding.profileSource === "resume";
  const source: EvidenceSource = isResume ? "resume_extracted" : "self_reported";
  const status: VerificationStatus = isResume ? "unverified" : "self_reported";

  if (isResume) {
    events.push(
      createJourneyEvent(
        "resume_processed",
        "Resume processed",
        "Uploaded resume text parsed for preliminary review suggestions."
      )
    );
  }

  if (onboarding.profileReviewed) {
    events.push(
      createJourneyEvent(
        "profile_reviewed",
        "Profile details reviewed",
        "Confirmed starting background details. All skills remain unverified."
      )
    );
  }

  events.push(
    createJourneyEvent(
      "goal_selected",
      `Goal set to ${goal.title}`,
      `Selected ${goal.title} as active direction.`
    )
  );

  // Education evidence
  if (person.education) {
    evidence.push(
      createEvidenceItem({
        id: "ev_edu_entry",
        category: "education",
        subject: person.education,
        value: person.education,
        source,
        verificationStatus: status,
        observedAt: now,
        interpretation: isResume
          ? "Extracted from your resume. Helpful background context, not an official transcript."
          : "Entered by you during onboarding. Self-reported learning background.",
        whyItMatters: "Helps understand foundational learning exposure.",
      })
    );
  }

  // Skills evidence
  if (onboarding.details.skills) {
    const skillList = splitItems(onboarding.details.skills);
    skillList.forEach((skill, idx) => {
      evidence.push(
        createEvidenceItem({
          id: `ev_skill_${idx}_${skill.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          category: "skill",
          subject: skill,
          value: `Mentioned in ${isResume ? "resume" : "self-reported profile"}: ${skill}`,
          source,
          verificationStatus: status,
          observedAt: now,
          interpretation: isResume
            ? `Appears in your reviewed resume information. This does not yet prove proficiency.`
            : `Self-reported skill entry. Provides focus for practice and project evidence.`,
          whyItMatters: "Identifies areas where hands-on build or deployment evidence can be collected.",
        })
      );
    });
  }

  // Experience evidence
  if (person.experience) {
    evidence.push(
      createEvidenceItem({
        id: "ev_exp_entry",
        category: "experience",
        subject: "Prior experience & projects",
        value: person.experience,
        source,
        verificationStatus: status,
        observedAt: now,
        interpretation: isResume
          ? "Summary from your reviewed resume. Gives context on things you have tried."
          : "Self-reported background notes. Useful context for tailoring next steps.",
        whyItMatters: "Provides initial context on previous projects or work exposure.",
      })
    );
  }

  const workspace: WorkspaceState = {
    version: 1,
    person,
    goal,
    evidence,
    journeyEvents: events,
    actionStates: existingWorkspace?.actionStates || {},
    eoraDismissed: existingWorkspace?.eoraDismissed || false,
    lastUpdated: now,
  };

  return workspace;
}

export function getOrMigrateWorkspace(): WorkspaceState {
  const existing = loadWorkspaceState();
  if (existing) return existing;

  let onboardingState: JourneyState | null = null;
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (stored) {
        onboardingState = safeJourney(JSON.parse(stored));
      }
    } catch (err) {
      console.warn("Unable to read onboarding storage", err);
    }
  }

  const fallbackOnboarding: JourneyState = onboardingState || {
    step: "finish",
    details: { name: "", education: "", skills: "", experience: "" },
    profileSource: "none",
    profileReviewed: false,
    goal: "ML Engineer",
    goalDraft: "ML Engineer",
    actionAccepted: false,
    guideMinimized: false,
  };

  const migrated = migrateOnboardingToWorkspace(fallbackOnboarding, null);
  saveWorkspaceState(migrated);
  return migrated;
}
