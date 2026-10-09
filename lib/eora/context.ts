/**
 * EORA CONTEXT ENGINE — VERSION 1.0
 * Understands what is happening in the application using real signals.
 * Never accesses raw auth tokens, passwords, or secrets.
 * Never mixes authenticated identities.
 */

export type EoraRoute =
  | "landing"
  | "sign-in"
  | "sign-up"
  | "onboarding"
  | "dashboard"
  | "student-home"
  | "student-profile"
  | "student-skills"
  | "student-projects"
  | "student-roadmap"
  | "student-journey"
  | "student-assessments"
  | "student-interviews"
  | "student-connections"
  | "verification"
  | "unknown";

/**
 * Onboarding step IDs — aligned with ExactScreensContainer screen numbers.
 */
export type OnboardingStep =
  | "welcome"         // screen 2
  | "role-select"     // screen 3
  | "ai-direction"    // screen 3.2
  | "priorities"      // screen 3.5
  | "academic"        // screen 4
  | "resume"          // screen 5
  | "digital-footprints" // screen 6
  | "ai-analysis"     // screen 7
  | "profile-insights" // screen 8
  | "skills-map"      // screen 9
  | "github-projects" // screen 10
  | "complete"        // screen 11
  | "none";

/**
 * Maps screen numbers from ExactScreensContainer to semantic step IDs.
 */
export function screenNumberToOnboardingStep(screen: number): OnboardingStep {
  const map: Record<number, OnboardingStep> = {
    2: "welcome",
    3: "role-select",
    3.2: "ai-direction",
    3.5: "priorities",
    4: "academic",
    5: "resume",
    6: "digital-footprints",
    7: "ai-analysis",
    8: "profile-insights",
    9: "skills-map",
    10: "github-projects",
    11: "complete",
  };
  return map[screen] ?? "none";
}

/**
 * Describes the current focused form field, including validation state.
 */
export interface FieldContext {
  fieldId: string;
  label: string;
  isValid: boolean;
  isEmpty: boolean;
  errorMessage?: string;
}

/**
 * Safe subset of student data EORA is permitted to use.
 * Raw OAuth tokens, passwords, and secrets are never included here.
 */
export interface StudentContext {
  personId: string | null;
  displayName: string | null;
  isAuthenticated: boolean;
  activeGoalTitle: string | null;
  targetRole: string | null;
  primaryPriority: string | null;
  secondaryPriorities: string[];
  skillsCount: number;
  projectsCount: number;
  verifiedEvidenceCount: number;
  /** IDs of completed tours — prevents replay */
  completedTourIds: string[];
  /** IDs of dismissed suggestions — prevents repetition */
  dismissedSuggestionIds: string[];
  /** Whether any source is currently processing */
  isProcessing: boolean;
  /** Connected source names (not tokens) */
  connectedSources: string[];
  /** Roadmap next milestone title if available */
  nextMilestoneTitle: string | null;
}

/**
 * Full EORA context — the unified signal passed to the decision engine.
 */
export interface EoraContext {
  route: EoraRoute;
  onboardingStep: OnboardingStep;
  focusedField: FieldContext | null;
  student: StudentContext;
  /** Whether the student is actively typing/focused */
  userIsFocused: boolean;
  /** Last successful action (e.g. "resume_uploaded", "github_connected") */
  lastSuccessfulAction: string | null;
  /** Current processing state label */
  processingState: string | null;
  /** Timestamp of last EORA interaction */
  lastEoraInteractionAt: number | null;
}

/**
 * Creates a default (empty) student context for unauthenticated states.
 */
export function createEmptyStudentContext(): StudentContext {
  return {
    personId: null,
    displayName: null,
    isAuthenticated: false,
    activeGoalTitle: null,
    targetRole: null,
    primaryPriority: null,
    secondaryPriorities: [],
    skillsCount: 0,
    projectsCount: 0,
    verifiedEvidenceCount: 0,
    completedTourIds: [],
    dismissedSuggestionIds: [],
    isProcessing: false,
    connectedSources: [],
    nextMilestoneTitle: null,
  };
}

/**
 * Creates a default context.
 */
export function createDefaultContext(): EoraContext {
  return {
    route: "unknown",
    onboardingStep: "none",
    focusedField: null,
    student: createEmptyStudentContext(),
    userIsFocused: false,
    lastSuccessfulAction: null,
    processingState: null,
    lastEoraInteractionAt: null,
  };
}

/**
 * Resolves the current route from a pathname string.
 */
export function resolveRouteFromPathname(pathname: string): EoraRoute {
  if (pathname === "/" || pathname === "") return "landing";
  if (pathname.startsWith("/sign-in")) return "sign-in";
  if (pathname.startsWith("/sign-up")) return "sign-up";
  if (pathname.startsWith("/onboarding")) return "onboarding";
  if (pathname === "/student" || pathname === "/student/") return "student-home";
  if (pathname.startsWith("/student/profile")) return "student-profile";
  if (pathname.startsWith("/student/skills")) return "student-skills";
  if (pathname.startsWith("/student/projects")) return "student-projects";
  if (pathname.startsWith("/student/roadmap")) return "student-roadmap";
  if (pathname.startsWith("/student/journey")) return "student-journey";
  if (pathname.startsWith("/student/assessments")) return "student-assessments";
  if (pathname.startsWith("/student/interviews")) return "student-interviews";
  if (pathname.startsWith("/student/connections")) return "student-connections";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/verification")) return "verification";
  return "unknown";
}

/**
 * Determines whether EORA should be quiet based on context.
 * EORA is quiet when the user is focused, typing, or on a deeply focused page.
 */
export function shouldEoraBeQuiet(context: EoraContext): boolean {
  if (context.userIsFocused) return true;
  // EORA doesn't interrupt assessments
  if (context.route === "student-assessments") return true;
  if (context.route === "student-interviews") return true;
  return false;
}
