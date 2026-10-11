/**
 * Centralized Onboarding Step Registry
 * AI Tathastu Ecosystem — 10 Canonical Steps
 * 
 * Provides unified, consistent logical steps and indicators across all onboarding views.
 */

export interface OnboardingStepDefinition {
  stepNumber: number; // 1-indexed (1 to 10)
  id: string;
  title: string;
  shortLabel: string;
  description: string;
  section: "Identity" | "Direction" | "Profile" | "Footprints" | "Review" | "Launch";
  screenIndex: number;
}

// Screen 2 is the welcome prelude. Screen 9 is an unnumbered skills-map view
// between Steps 8 and 9; neither should shift the ten numbered steps.
export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    stepNumber: 1,
    id: "platform_role",
    title: "Choose Your Platform Role",
    shortLabel: "Platform Role",
    description: "Identify whether you are a Student, Faculty, Mentor, or Institution.",
    section: "Identity",
    screenIndex: 3,
  },
  {
    stepNumber: 2,
    id: "aiml_direction",
    title: "Your AI/ML Direction",
    shortLabel: "AI/ML Direction",
    description: "Choose your target AI/ML role, specific goal, and timeline.",
    section: "Direction",
    screenIndex: 3.2,
  },
  {
    stepNumber: 3,
    id: "priorities",
    title: "What Brings You to AI Tathastu?",
    shortLabel: "Priorities",
    description: "Select what you want to focus on first in Tathastu.",
    section: "Direction",
    screenIndex: 3.5,
  },
  {
    stepNumber: 4,
    id: "resume_upload",
    title: "Resume / CV Upload",
    shortLabel: "Resume & CV",
    description: "Upload a PDF or DOCX resume for extraction and review (optional).",
    section: "Profile",
    screenIndex: 5,
  },
  {
    stepNumber: 5,
    id: "academic_details",
    title: "Basic Academic Details",
    shortLabel: "Academic Details",
    description: "Confirm your degree, university, department, and graduation year when needed.",
    section: "Profile",
    screenIndex: 4,
  },
  {
    stepNumber: 6,
    id: "digital_profiles",
    title: "Connect Digital Profiles",
    shortLabel: "Digital Profiles",
    description: "Link your GitHub, LinkedIn, or coding platform profiles.",
    section: "Footprints",
    screenIndex: 6,
  },
  {
    stepNumber: 7,
    id: "ai_analysis",
    title: "Review & Analyze Information",
    shortLabel: "AI Analysis",
    description: "EORA analyzes your starting picture and synthesizes insights.",
    section: "Review",
    screenIndex: 7,
  },
  {
    stepNumber: 8,
    id: "profile_insights",
    title: "Review Profile & Skills",
    shortLabel: "Profile & Skills",
    description: "Verify your confirmed skills and profile highlights.",
    section: "Review",
    screenIndex: 8,
  },
  {
    stepNumber: 9,
    id: "github_projects",
    title: "Review Projects & Contributions",
    shortLabel: "Projects",
    description: "Confirm your self-reported projects and personal contributions.",
    section: "Review",
    screenIndex: 10,
  },
  {
    stepNumber: 10,
    id: "complete_launch",
    title: "Finalize & Enter Dashboard",
    shortLabel: "Launch",
    description: "Complete your onboarding and transition to your live student workspace.",
    section: "Launch",
    screenIndex: 11,
  },
];

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length; // 10

export function getOnboardingStep(stepNumber: number): OnboardingStepDefinition {
  const found = ONBOARDING_STEPS.find((s) => s.stepNumber === stepNumber);
  return found || ONBOARDING_STEPS[0];
}

export function getOnboardingStepLabels(): string[] {
  return ONBOARDING_STEPS.map((s) => s.shortLabel);
}

export function getStepByScreenIndex(screenIndex: number): OnboardingStepDefinition | undefined {
  return ONBOARDING_STEPS.find((s) => s.screenIndex === screenIndex);
}

export function getScreenIndexByStepNumber(stepNumber: number): number {
  const step = getOnboardingStep(stepNumber);
  return step.screenIndex;
}
