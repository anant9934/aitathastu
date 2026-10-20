/**
 * The one source of onboarding step and stage numbers (P4-13). The page
 * stepper, the step label in the header and EORA's guide all read this, so
 * they can never disagree.
 *
 * Screen numbers are the draft's `currentScreen` values (kept for draft
 * compatibility, so they are not in display order). Screen 2 is an unnumbered
 * welcome. Steps the CV already covered are skipped by navigation but keep
 * their number and show as done, so the count never shifts mid-flow.
 *
 * Screen 6 ("Your accounts") was merged into 5.5; old drafts saved on 6 resume
 * on 5.5 (see normalizeOnboardingScreen).
 */

export type OnboardingRole = "student" | "faculty";

export interface OnboardingStageDefinition {
  id: string;
  name: string;
}

export interface OnboardingStepDefinition {
  id: string;
  /** Draft screen number. */
  screen: number;
  title: string;
  shortLabel: string;
  stage: string;
}

export const WELCOME_SCREEN = 2;
export const SOURCES_SCREEN = 5.5;

const STUDENT_STAGES: OnboardingStageDefinition[] = [
  { id: "personalize", name: "Personalize" },
  { id: "build", name: "Build your profile" },
  { id: "refine", name: "Refine" },
  { id: "complete", name: "Finish" },
];

const STUDENT_STEPS: OnboardingStepDefinition[] = [
  { id: "platform_role", screen: 3, title: "Your role", shortLabel: "Role", stage: "personalize" },
  { id: "aiml_direction", screen: 3.2, title: "Your AI/ML direction", shortLabel: "Direction", stage: "personalize" },
  { id: "priorities", screen: 3.5, title: "What matters most", shortLabel: "Priorities", stage: "personalize" },
  { id: "resume_upload", screen: 5, title: "Your CV", shortLabel: "CV", stage: "build" },
  { id: "connect_sources", screen: SOURCES_SCREEN, title: "Connect your sources", shortLabel: "Sources", stage: "build" },
  { id: "import", screen: 7, title: "Importing what we found", shortLabel: "Import", stage: "build" },
  { id: "profile_review", screen: 8, title: "Review your profile", shortLabel: "Review", stage: "build" },
  { id: "academic_details", screen: 4, title: "Your details", shortLabel: "Details", stage: "refine" },
  { id: "skills_map", screen: 9, title: "Your skills and their evidence", shortLabel: "Skills", stage: "refine" },
  { id: "projects", screen: 10, title: "Your projects", shortLabel: "Projects", stage: "refine" },
  { id: "finish", screen: 11, title: "Finish", shortLabel: "Finish", stage: "complete" },
];

const FACULTY_STAGES: OnboardingStageDefinition[] = [
  { id: "personalize", name: "Role & focus" },
  { id: "account", name: "Institutional setup" },
];

const FACULTY_STEPS: OnboardingStepDefinition[] = [
  { id: "platform_role", screen: 3, title: "Your role", shortLabel: "Role", stage: "personalize" },
  { id: "priorities", screen: 3.5, title: "What matters most", shortLabel: "Priorities", stage: "personalize" },
  { id: "faculty_setup", screen: 3.7, title: "Your faculty account", shortLabel: "Account", stage: "account" },
];

export function onboardingSteps(role: OnboardingRole = "student"): OnboardingStepDefinition[] {
  return role === "faculty" ? FACULTY_STEPS : STUDENT_STEPS;
}

export function onboardingStages(role: OnboardingRole = "student"): OnboardingStageDefinition[] {
  return role === "faculty" ? FACULTY_STAGES : STUDENT_STAGES;
}

/** Student screens in the order they are shown. */
export const STUDENT_SCREEN_ORDER: number[] = STUDENT_STEPS.map((s) => s.screen);

/** Maps retired screens in saved drafts to the step that replaced them. */
export function normalizeOnboardingScreen(screen: number): number {
  return screen === 6 ? SOURCES_SCREEN : screen;
}

export type StepPosition = {
  number: number;
  total: number;
  step: OnboardingStepDefinition;
  stageNumber: number;
  stageTotal: number;
  stage: OnboardingStageDefinition;
} | null;

/** "Stage s of S, Step n of N" for a screen, or null for the unnumbered welcome. */
export function stepForScreen(screen: number, role: OnboardingRole = "student"): StepPosition {
  const steps = onboardingSteps(role);
  const stages = onboardingStages(role);
  const index = steps.findIndex((s) => s.screen === normalizeOnboardingScreen(screen));
  if (index < 0) return null;
  const step = steps[index];
  const stageIndex = stages.findIndex((st) => st.id === step.stage);
  return { number: index + 1, total: steps.length, step, stageNumber: stageIndex + 1, stageTotal: stages.length, stage: stages[stageIndex] };
}

/** Back-compat for callers that only need the labels. */
export function getOnboardingStepLabels(role: OnboardingRole = "student"): string[] {
  return onboardingSteps(role).map((s) => s.shortLabel);
}

export const TOTAL_ONBOARDING_STEPS = STUDENT_STEPS.length;
