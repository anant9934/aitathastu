/**
 * EORA SAFE INTERACTIVE ACTION ENGINE — VERSION 1.0
 *
 * Provides a strictly whitelisted, safe action dispatch system.
 *
 * Rules:
 * - NO arbitrary eval or unsanitized JavaScript execution.
 * - NO automated destructive actions (account deletion, database purge, password changes).
 * - NO reading or focusing password/OTP fields.
 * - Navigation restricted to known, authorized internal routes.
 * - Graceful failure reporting if a DOM element or modal does not exist.
 */

export type EoraActionType =
  | "HIGHLIGHT_ELEMENT"
  | "SCROLL_TO_SECTION"
  | "FOCUS_FIELD"
  | "NAVIGATE_ROUTE"
  | "START_PAGE_TOUR"
  | "OPEN_MODAL"
  | "SWITCH_LANGUAGE"
  | "SET_ASSISTANCE_MODE"
  | "EXPLAIN_FIELD"
  | "DISMISS_NUDGE";

export type EoraActionPayload = {
  type: EoraActionType;
  targetId?: string;
  route?: string;
  tourId?: string;
  language?: "en" | "hi" | "hinglish";
  mode?: "balanced" | "quiet" | "playful";
  fieldId?: string;
  fieldLabel?: string;
  modalId?: string;
};

export type EoraSafeAction = EoraActionPayload;

export const ALLOWED_EORA_ACTIONS: EoraActionType[] = [
  "HIGHLIGHT_ELEMENT",
  "SCROLL_TO_SECTION",
  "FOCUS_FIELD",
  "NAVIGATE_ROUTE",
  "START_PAGE_TOUR",
  "OPEN_MODAL",
  "SWITCH_LANGUAGE",
  "SET_ASSISTANCE_MODE",
  "EXPLAIN_FIELD",
  "DISMISS_NUDGE",
];

export interface ActionResult {
  success: boolean;
  actionType: EoraActionType;
  message?: string;
  error?: string;
}

/**
 * Whitelist of allowed navigation destinations.
 */
export const ALLOWED_NAVIGATION_ROUTES = new Set([
  "/",
  "/sign-in",
  "/sign-up",
  "/onboarding",
  "/student",
  "/student/profile",
  "/student/skills",
  "/student/projects",
  "/student/roadmap",
  "/student/connections",
  "/student/journey",
  "/student/assessments",
  "/student/interviews",
  "/verification",
  "/faculty/verification",
]);

/**
 * Sensitive field names that EORA is strictly forbidden to focus or read.
 */
const SENSITIVE_FIELD_PATTERNS = /password|secret|token|otp|cvv|pin|credit/i;

/**
 * Validates whether an action is safe to execute.
 */
export function isActionSafe(payload: EoraActionPayload): { safe: boolean; reason?: string } {
  if (payload.type === "NAVIGATE_ROUTE") {
    if (!payload.route) return { safe: false, reason: "Missing route destination." };
    const baseRoute = payload.route.split("?")[0].replace(/\/$/, "") || "/";
    const isWhitelisted =
      ALLOWED_NAVIGATION_ROUTES.has(baseRoute) ||
      baseRoute.startsWith("/student/skills/") ||
      baseRoute.startsWith("/student/projects/");
    if (!isWhitelisted) {
      return { safe: false, reason: `Navigation to '${payload.route}' is not in the authorized whitelist.` };
    }
  }

  if (payload.type === "FOCUS_FIELD") {
    if (!payload.fieldId) return { safe: false, reason: "Missing field target." };
    if (SENSITIVE_FIELD_PATTERNS.test(payload.fieldId) || (payload.fieldLabel && SENSITIVE_FIELD_PATTERNS.test(payload.fieldLabel))) {
      return { safe: false, reason: "Focusing sensitive credential or security fields is strictly prohibited." };
    }
  }

  return { safe: true };
}

/**
 * Executes a safe action in the browser DOM.
 */
export function executeSafeAction(
  payload: EoraActionPayload,
  handlers: {
    navigate?: (route: string) => void;
    startTour?: (tourId: string) => void;
    setLanguage?: (lang: "en" | "hi" | "hinglish") => void;
    setMode?: (mode: "balanced" | "quiet" | "playful") => void;
  } = {}
): ActionResult {

  const safety = isActionSafe(payload);
  if (!safety.safe) {
    return {
      success: false,
      actionType: payload.type,
      error: safety.reason || "Action blocked by safety policy.",
    };
  }

  try {
    switch (payload.type) {
      case "NAVIGATE_ROUTE": {
        if (!payload.route) return { success: false, actionType: payload.type, error: "No route provided." };
        if (handlers.navigate) {
          handlers.navigate(payload.route);
        } else if (typeof window !== "undefined") {
          window.location.assign(payload.route);
        }
        return { success: true, actionType: payload.type, message: `Navigating to ${payload.route}` };
      }

      case "START_PAGE_TOUR": {
        if (!payload.tourId) return { success: false, actionType: payload.type, error: "No tourId provided." };
        if (handlers.startTour) {
          handlers.startTour(payload.tourId);
          return { success: true, actionType: payload.type, message: `Started tour ${payload.tourId}` };
        }
        if (typeof window === "undefined") {
          return { success: true, actionType: payload.type, message: `Simulated tour start for ${payload.tourId}` };
        }
        return { success: false, actionType: payload.type, error: "Tour runner not mounted." };
      }

      case "HIGHLIGHT_ELEMENT": {
        if (typeof document === "undefined") {
          return { success: true, actionType: payload.type, message: `Simulated highlight for ${payload.targetId}` };
        }
        if (!payload.targetId) {
          return { success: false, actionType: payload.type, error: "Target missing or SSR." };
        }
        const target =
          document.querySelector(`[data-eora-id="${payload.targetId}"]`) ||
          document.getElementById(payload.targetId);
        if (!target) {
          return { success: false, actionType: payload.type, error: `Target '${payload.targetId}' not found in DOM.` };
        }
        target.setAttribute("data-eora-spotlight", "true");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        return { success: true, actionType: payload.type, message: `Highlighted ${payload.targetId}` };
      }

      case "SCROLL_TO_SECTION": {
        if (typeof document === "undefined") {
          return { success: true, actionType: payload.type, message: `Simulated scroll for ${payload.targetId}` };
        }
        if (!payload.targetId) {
          return { success: false, actionType: payload.type, error: "Target missing." };
        }
        const target =
          document.querySelector(`[data-eora-id="${payload.targetId}"]`) ||
          document.getElementById(payload.targetId);
        if (!target) {
          return { success: false, actionType: payload.type, error: `Section '${payload.targetId}' not found.` };
        }
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return { success: true, actionType: payload.type, message: `Scrolled to ${payload.targetId}` };
      }

      case "FOCUS_FIELD": {
        if (typeof document === "undefined") {
          return { success: true, actionType: payload.type, message: `Simulated focus for ${payload.fieldId}` };
        }
        if (!payload.fieldId) {
          return { success: false, actionType: payload.type, error: "Field target missing." };
        }
        const input = document.getElementById(payload.fieldId) || document.querySelector<HTMLElement>(`[name="${payload.fieldId}"]`);
        if (!input) {
          return { success: false, actionType: payload.type, error: `Field '${payload.fieldId}' not found.` };
        }
        input.focus();
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        return { success: true, actionType: payload.type, message: `Focused ${payload.fieldId}` };
      }

      case "SWITCH_LANGUAGE": {
        if (payload.language && handlers.setLanguage) {
          handlers.setLanguage(payload.language);
          return { success: true, actionType: payload.type, message: `Language switched to ${payload.language}` };
        }
        if (typeof window === "undefined") {
          return { success: true, actionType: payload.type, message: `Simulated language switch to ${payload.language}` };
        }
        return { success: false, actionType: payload.type, error: "Language handler missing." };
      }

      case "SET_ASSISTANCE_MODE": {
        if (payload.mode && handlers.setMode) {
          handlers.setMode(payload.mode);
          return { success: true, actionType: payload.type, message: `Mode updated to ${payload.mode}` };
        }
        if (typeof window === "undefined") {
          return { success: true, actionType: payload.type, message: `Simulated mode set to ${payload.mode}` };
        }
        return { success: false, actionType: payload.type, error: "Mode handler missing." };
      }


      default:
        return { success: false, actionType: payload.type, error: "Unsupported action." };
    }
  } catch (err) {
    return {
      success: false,
      actionType: payload.type,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
