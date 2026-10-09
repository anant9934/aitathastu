/**
 * EORA BRAIN — DECISION ENGINE — VERSION 1.0
 * Deterministic state machine. No LLM calls.
 * Takes context + intent → produces an action/message.
 *
 * Priority order:
 * 1. Safety check (always first)
 * 2. User-triggered intent (highest priority)
 * 3. Contextual proactive suggestion
 * 4. Idle / quiet state
 */

import type { EoraContext } from "./context";
import { shouldEoraBeQuiet } from "./context";
import type { IntentRecognitionResult } from "./intent";
import { isIntentConfident, getClarifyingOptions } from "./intent";
import { checkInputSafety, checkOutputSafety } from "./safety";
import type { EoraMessage } from "./dialogue";
import {
  getIntentResponse,
  getRouteWelcomeMessage,
  getOnboardingStepMessage,
  getTinyVictoryMessage,
  getFieldErrorMessage,
} from "./dialogue";
import { isResponseWithinPersonalityBounds, getSafeFallbackResponse } from "./personality";

export type EoraDecisionType =
  | "USER_INTENT_RESPONSE"
  | "PROACTIVE_CONTEXTUAL"
  | "TOUR_STEP"
  | "FIELD_HELP"
  | "CELEBRATION"
  | "CLARIFY"
  | "SAFETY_REFUSAL"
  | "QUIET"
  | "IDLE";

export interface EoraDecision {
  type: EoraDecisionType;
  message: EoraMessage;
  /** Whether EORA should speak proactively (without user asking) */
  isProactive: boolean;
  /** Navigation URL if EORA should offer to navigate */
  navigationUrl?: string;
  /** Label for navigation button */
  navigationLabel?: string;
  /** Clarifying options to show if confidence is low */
  clarifyingOptions?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DECISION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a user's typed/spoken input and current context.
 * Returns what EORA should do next.
 */
export function processUserInput(
  rawInput: string,
  intentResult: IntentRecognitionResult,
  context: EoraContext
): EoraDecision {
  // 1. Safety check on input
  const inputSafety = checkInputSafety(rawInput);
  if (!inputSafety.safe) {
    return {
      type: "SAFETY_REFUSAL",
      message: {
        text: inputSafety.refusalMessage ?? "I can't help with that.",
        animationState: "REASSURING",
      },
      isProactive: false,
    };
  }

  // 2. Low confidence → ask for clarification
  if (!isIntentConfident(intentResult)) {
    return {
      type: "CLARIFY",
      message: {
        text: "I'm not sure what you need. Which of these would help?",
        animationState: "CONFUSED",
      },
      isProactive: false,
      clarifyingOptions: getClarifyingOptions(),
    };
  }

  // 3. Handle dismiss/pause immediately
  if (
    intentResult.intent === "DISMISS_ASSISTANT" ||
    intentResult.intent === "PAUSE_ASSISTANT"
  ) {
    return {
      type: "USER_INTENT_RESPONSE",
      message: getIntentResponse(intentResult.intent, context),
      isProactive: false,
    };
  }

  // 4. Quiet during focused work (but still respond to user input)
  // User asked explicitly → always respond

  // 5. Generate intent-based response
  const responseMessage = getIntentResponse(intentResult.intent, context);

  // 6. Output safety check
  const outputSafety = checkOutputSafety(responseMessage.text);
  if (!outputSafety.safe) {
    return {
      type: "SAFETY_REFUSAL",
      message: {
        text: getSafeFallbackResponse("error"),
        animationState: "REASSURING",
      },
      isProactive: false,
    };
  }

  // 7. Personality bounds check
  if (!isResponseWithinPersonalityBounds(responseMessage.text)) {
    return {
      type: "SAFETY_REFUSAL",
      message: {
        text: getSafeFallbackResponse("boundary"),
        animationState: "REASSURING",
      },
      isProactive: false,
    };
  }

  return {
    type: "USER_INTENT_RESPONSE",
    message: responseMessage,
    isProactive: false,
    navigationUrl: responseMessage.actionUrl,
    navigationLabel: responseMessage.actionLabel,
  };
}

/**
 * Generates a proactive contextual suggestion based on current app state.
 * Called by the engagement scheduler — returns null if EORA should stay quiet.
 */
export function getProactiveDecision(context: EoraContext): EoraDecision | null {
  // Never interrupt focused work proactively
  if (shouldEoraBeQuiet(context)) return null;

  // Route-based proactive messages during onboarding
  if (context.route === "onboarding" && context.onboardingStep !== "none") {
    const stepMessage = getOnboardingStepMessage(context.onboardingStep);
    return {
      type: "PROACTIVE_CONTEXTUAL",
      message: stepMessage,
      isProactive: true,
    };
  }

  // Field with validation error → proactive help
  if (
    context.focusedField &&
    !context.focusedField.isValid &&
    context.focusedField.errorMessage
  ) {
    const fieldMessage = getFieldErrorMessage(
      context.focusedField.label,
      context.focusedField.errorMessage
    );
    return {
      type: "FIELD_HELP",
      message: fieldMessage,
      isProactive: true,
    };
  }

  // Recent successful action → tiny victory
  if (context.lastSuccessfulAction) {
    const victoryMessage = getTinyVictoryMessage(context.lastSuccessfulAction);
    const outputSafety = checkOutputSafety(victoryMessage.text);
    if (outputSafety.safe && isResponseWithinPersonalityBounds(victoryMessage.text)) {
      return {
        type: "PROACTIVE_CONTEXTUAL",
        message: victoryMessage,
        isProactive: true,
      };
    }
  }

  // Route-level welcome on first visit
  const welcomeMessage = getRouteWelcomeMessage(context);
  if (welcomeMessage.animationState !== "IDLE") {
    return {
      type: "PROACTIVE_CONTEXTUAL",
      message: welcomeMessage,
      isProactive: true,
      navigationUrl: welcomeMessage.actionUrl,
      navigationLabel: welcomeMessage.actionLabel,
    };
  }

  return null;
}

/**
 * Returns the idle decision (EORA is present but not speaking).
 */
export function getIdleDecision(): EoraDecision {
  return {
    type: "IDLE",
    message: {
      text: "",
      animationState: "IDLE",
    },
    isProactive: false,
  };
}
