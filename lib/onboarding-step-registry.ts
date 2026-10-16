/**
 * The one source of onboarding step numbers (P4-13). The page stepper, the
 * step label in the header and EORA's guide all read this, so they can never
 * disagree again.
 *
 * Screen numbers are the draft's `currentScreen` values (kept for draft
 * compatibility). Screen 2 is an unnumbered welcome. Steps the CV already
 * covered are skipped by navigation but keep their number and show as done,
 * so the count never shifts mid-flow.
 */

export type OnboardingRole = "student" | "faculty";

export interface OnboardingStepDefinition {
  id: string;
  /** Draft screen number. */
  screen: number;
  title: string;
  shortLabel: string;
}

export const WELCOME_SCREEN = 2;

const STUDENT_STEPS: OnboardingStepDefinition[] = [
  { id: "platform_role", screen: 3, title: "Your role", shortLabel: "Role" },
  { id: "aiml_direction", screen: 3.2, title: "Your AI/ML direction", shortLabel: "Direction" },
  { id: "priorities", screen: 3.5, title: "What matters most", shortLabel: "Priorities" },
  { id: "resume_upload", screen: 5, title: "Your CV", shortLabel: "CV" },
  { id: "academic_details", screen: 4, title: "Your details", shortLabel: "Details" },
  { id: "digital_profiles", screen: 6, title: "Your accounts", shortLabel: "Accounts" },
  { id: "import", screen: 7, title: "Importing what we found", shortLabel: "Import" },
  { id: "profile_review", screen: 8, title: "Review your profile", shortLabel: "Review" },
  { id: "skills_map", screen: 9, title: "Your skills and their evidence", shortLabel: "Skills" },
  { id: "projects", screen: 10, title: "Your projects", shortLabel: "Projects" },
  { id: "finish", screen: 11, title: "Finish", shortLabel: "Finish" },
];

const FACULTY_STEPS: OnboardingStepDefinition[] = [
  { id: "platform_role", screen: 3, title: "Your role", shortLabel: "Role" },
  { id: "priorities", screen: 3.5, title: "What matters most", shortLabel: "Priorities" },
  { id: "faculty_setup", screen: 3.7, title: "Your faculty account", shortLabel: "Account" },
];

export function onboardingSteps(role: OnboardingRole = "student"): OnboardingStepDefinition[] {
  return role === "faculty" ? FACULTY_STEPS : STUDENT_STEPS;
}

export type StepPosition = { number: number; total: number; step: OnboardingStepDefinition } | null;

/** "Step n of N" for a screen, or null for the unnumbered welcome. */
export function stepForScreen(screen: number, role: OnboardingRole = "student"): StepPosition {
  const steps = onboardingSteps(role);
  const index = steps.findIndex((s) => s.screen === screen);
  if (index < 0) return null;
  return { number: index + 1, total: steps.length, step: steps[index] };
}

/** Back-compat for callers that only need the labels. */
export function getOnboardingStepLabels(role: OnboardingRole = "student"): string[] {
  return onboardingSteps(role).map((s) => s.shortLabel);
}

export const TOTAL_ONBOARDING_STEPS = STUDENT_STEPS.length;
