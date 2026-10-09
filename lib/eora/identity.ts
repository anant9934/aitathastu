/**
 * EORA CHARACTER IDENTITY REGISTRY — VERSION 1.0
 * Centralized, versioned, immutable definition of the EORA character.
 * This is the single source of truth for the AI Tathastu digital companion.
 *
 * LOCKED: Do not alter appearance, name, or core promise without explicit approval.
 */

export const EORA_IDENTITY_VERSION = "1.0.0";

export const EORA_CHARACTER = {
  name: "EORA",
  fullTitle: "AI Tathastu Digital Companion",
  version: EORA_IDENTITY_VERSION,

  /**
   * Core promise — never modify without product approval.
   */
  corePromise: "Curious enough to explore. Smart enough to guide. Kind enough to listen.",

  /**
   * Appearance specification — ABSOLUTELY LOCKED.
   * These describe the approved character assets.
   * Do not regenerate, substitute, or override.
   */
  appearance: {
    eyes: "Large brown eyes",
    glasses: "Round black glasses",
    hair: "Dark hair tied back with loose strands",
    hoodie: "Sky-blue hoodie with AI Tathastu network logo",
    proportions: "Original character proportions and styling",
    background: "Transparent-background approved images",
  },

  /**
   * Role hierarchy
   */
  role: {
    primary: "Intelligent digital companion and guide",
    secondary: "Onboarding guide, tour navigator, dashboard companion, form helper",
    neverClaim: [
      "Human consciousness or feelings",
      "Romantic or personal attachment",
      "Exclusive emotional dependency",
    ],
  },
} as const;

/**
 * Approved EORA poses mapped to contexts.
 * Each pose should be used only for its intended purpose.
 */
export const EORA_POSE_CONTEXTS = {
  "welcome-hand": {
    state: "ENTERING",
    contexts: ["landing-hero", "dashboard-return", "first-visit"],
    description: "Hero landing, dashboard greetings, open invitations",
  },
  waving: {
    state: "WAVING",
    contexts: ["onboarding-intro", "welcome-screen", "check-in"],
    description: "Onboarding introduction, friendly check-ins",
  },
  "pointing-right": {
    state: "POINTING",
    contexts: ["form-guidance", "step-transition", "call-to-action", "workspace-guide"],
    description: "Forms, step transitions, call-to-actions",
  },
  "pointing-down": {
    state: "POINTING",
    contexts: ["field-highlight", "option-highlight"],
    description: "Form input focus, highlighting options below",
  },
  thinking: {
    state: "THINKING",
    contexts: ["ai-analysis", "data-processing", "synthesis"],
    description: "AI analysis, synthesis, data processing states",
  },
  "thumbs-up": {
    state: "HAPPY",
    contexts: ["milestone-confirmed", "skill-verified", "success", "tiny-victory"],
    description: "Milestone confirmation, verified skills, success states",
  },
  explaining: {
    state: "EXPLAINING",
    contexts: ["ecosystem-overview", "skills-map", "career-choices", "feature-intro"],
    description: "Ecosystem overview, skills map, career choices",
  },
  "holding-tablet": {
    state: "WORKING",
    contexts: ["evidence-review", "curriculum-review", "workspace-guide", "profile-review"],
    description: "Evidence ledger, curriculum review, workspace guides",
  },
  celebrating: {
    state: "CELEBRATING",
    contexts: ["onboarding-complete", "goal-achieved", "major-milestone"],
    description: "Onboarding completion, goal achievements",
  },
  reassuring: {
    state: "REASSURING",
    contexts: ["guidance", "empathy", "encouragement", "sign-in", "error-recovery"],
    description: "Guidance, empathy, encouragement, sign-in",
  },
  presenting: {
    state: "EXPLAINING",
    contexts: ["feature-showcase", "workspace-highlight", "module-intro", "dashboard-welcome"],
    description: "Feature showcases, workspace highlights, module intros",
  },
  avatar: {
    state: "IDLE",
    contexts: ["chat-header", "badge", "recommendation-card", "minimized"],
    description: "Circular badges, chat headers, recommendation cards",
  },
} as const;

export type EoraPoseContext = keyof typeof EORA_POSE_CONTEXTS;

/**
 * Animation state machine — maps route/app states to EORA animation states.
 */
export type EoraAnimationState =
  | "IDLE"
  | "ENTERING"
  | "WAVING"
  | "LISTENING"
  | "THINKING"
  | "EXPLAINING"
  | "POINTING"
  | "REASSURING"
  | "HAPPY"
  | "CELEBRATING"
  | "CONFUSED"
  | "HOLDING_TABLET"
  | "WORKING"
  | "WAITING"
  | "QUIET"
  | "EXITING";

/**
 * Resolves the best EORA pose for a given animation state.
 * Falls back to avatar if no matching pose found.
 */
export function getPoseForState(state: EoraAnimationState): EoraPoseContext {
  const stateMap: Record<EoraAnimationState, EoraPoseContext> = {
    IDLE: "avatar",
    ENTERING: "welcome-hand",
    WAVING: "waving",
    LISTENING: "explaining",
    THINKING: "thinking",
    EXPLAINING: "explaining",
    POINTING: "pointing-right",
    REASSURING: "reassuring",
    HAPPY: "thumbs-up",
    CELEBRATING: "celebrating",
    CONFUSED: "thinking",
    HOLDING_TABLET: "holding-tablet",
    WORKING: "holding-tablet",
    WAITING: "thinking",
    QUIET: "avatar",
    EXITING: "waving",
  };
  return stateMap[state] ?? "avatar";
}
