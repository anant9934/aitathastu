"use client";

/**
 * EORA PROVIDER — SHARED COMPANION CONTROLLER — VERSION 1.1
 * Phase 5: Full live application wiring.
 *
 * New in 1.1:
 * - updateLiveStudentContext() — receives real Person 360 data
 * - Tour spotlight DOM targeting
 * - Field focus tracking via userIsFocused
 * - Proper celebration with student name
 * - Dashboard companion with personalization context
 * - Success event with verified backend origin flag
 * - Logout / context-clear support
 *
 * Security rules (unchanged):
 * - Never stores raw OAuth tokens, passwords, or secret keys
 * - Never mixes authenticated identities
 * - Zero LLM calls for routine interactions
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { usePathname } from "next/navigation";

import type { EoraContext, OnboardingStep, StudentContext } from "@/lib/eora/context";
import {
  createDefaultContext,
  createEmptyStudentContext,
  resolveRouteFromPathname,
  shouldEoraBeQuiet,
} from "@/lib/eora/context";
import type { EoraMessage } from "@/lib/eora/dialogue";
import {
  getOnboardingStepMessage,
  getTinyVictoryMessage,
  getCelebrationMessage,
  getWelcomeBackMessage,
} from "@/lib/eora/dialogue";
import { recognizeIntent } from "@/lib/eora/intent";
import { processUserInput, getProactiveDecision } from "@/lib/eora/brain";
import type { EoraPreferences } from "@/lib/eora/engagement";
import {
  loadPreferences,
  loadPreferencesForPerson,
  savePreferences,
  savePreferencesForPerson,
  markTourCompleted,
  snoozeEora,
  isEoraSnoozed,
  canSendProactiveNudge,
  recordNudgeSent,
  recordInteraction,
  resetPreferences,
  clearPreferencesForPerson,
  detectReducedMotionPreference,
  setLanguagePreference,
} from "@/lib/eora/engagement";
import { getPageContract } from "@/lib/eora/page-registry";
import type { TourDefinition } from "@/lib/eora/tours";
import { getTourById } from "@/lib/eora/tours";
import type { EoraAnimationState } from "@/lib/eora/identity";
import { getPoseForState } from "@/lib/eora/identity";
import type { EoraActiveTaskSession, EoraTaskDefinition } from "@/lib/eora/tasks";
import {
  getTaskById,
  getPrimaryTaskForRoute,
  createInitialTaskSession,
  advanceTaskStep,
  rewindTaskStep,
  canResumeTask,
} from "@/lib/eora/tasks";

// ─────────────────────────────────────────────────────────────────────────────
// LIVE STUDENT DATA — safe subset only (no tokens/passwords/secrets)
// ─────────────────────────────────────────────────────────────────────────────

export interface EoraLiveStudentData {
  personId: string;
  displayName: string;
  isAuthenticated: true;
  activeGoalTitle: string | null;
  targetRole: string | null;
  primaryPriority: string | null;
  secondaryPriorities: string[];
  skillsCount: number;
  projectsCount: number;
  verifiedEvidenceCount: number;
  connectedSources: string[];
  nextMilestoneTitle: string | null;
  isProcessing: boolean;
  /** Whether this student has just completed onboarding (for welcome celebration) */
  isFirstSession: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER STATE TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface EoraControllerState {
  currentMessage: EoraMessage;
  animationState: EoraAnimationState;
  /** Resolved pose name (for avatar rendering) */
  currentPose: string;
  isVisible: boolean;
  isPanelOpen: boolean;
  isQuiet: boolean;
  activeTour: TourDefinition | null;
  tourStepIndex: number;
  tourPaused: boolean;
  tourTargetAvailable: boolean;
  /** Current spotlight target data-eora-id (null when not in tour) */
  tourSpotlightTargetId: string | null;
  isMinimized: boolean;
  onboardingStep: OnboardingStep;
  preferences: EoraPreferences;
  clarifyingOptions: string[] | null;
  pendingNavUrl: string | null;
  pendingNavLabel: string | null;
  showCelebration: boolean;
  /** Whether live student data has been loaded */
  hasLiveStudentData: boolean;
  /** Guided multi-step task state (Phase 7.1) */
  activeTask: EoraActiveTaskSession | null;
  activeTaskDef: EoraTaskDefinition | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface EoraController extends EoraControllerState {
  handleUserMessage: (text: string) => void;
  handleClarifyingChoice: (text: string) => void;
  clearMessage: () => void;
  openPanel: () => void;
  closePanel: () => void;
  dismiss: () => void;
  restore: () => void;
  minimize: () => void;
  expand: () => void;
  snooze: (minutes: number) => void;
  startTour: (tourId: string) => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  pauseTour: () => void;
  resumeTour: () => void;
  exitTour: () => void;
  /** Phase 7.1 Guided Task State Machine */
  startTask: (taskId: string) => void;
  advanceTask: () => void;
  rewindTask: () => void;
  pauseTask: () => void;
  resumeTask: () => void;
  cancelTask: () => void;
  notifyTaskEvent: (eventName: string, data?: unknown) => void;
  /** Called by ExactScreensContainer on each screen transition */
  setOnboardingStep: (step: OnboardingStep) => void;
  /** Called by WorkspaceProvider / student pages with real Person 360 data */
  updateLiveStudentContext: (data: EoraLiveStudentData) => void;
  /** Called on logout — clears all personal context */
  clearStudentContext: () => void;
  /** Signals a successful action confirmed by the backend */
  signalSuccess: (action: string, studentName?: string) => void;
  /** Signals a field validation error */
  signalFieldError: (fieldId: string, label: string, error: string) => void;
  /** Clears field error when corrected */
  clearFieldError: (fieldId?: string) => void;
  /** Marks user as actively typing (suppresses proactive nudges) */
  setUserFocused: (focused: boolean) => void;
  focusField: (fieldId: string, label: string) => void;
  updatePreferences: (patch: Partial<EoraPreferences>) => void;
  resetAllPreferences: () => void;
  /** Direct dialogue speech method */
  speak: (text: string, state?: EoraAnimationState) => void;
  /** Language toggling */
  setLanguage: (lang: "english" | "hinglish") => void;
  toggleLanguage: () => void;
  /** Playful avatar boop reaction */
  boop: () => void;
  /** Deprecated compat shim — use updateLiveStudentContext instead */
  updateStudentContext: (patch: Partial<EoraPreferences>) => void;
  context: EoraContext;
}


// ─────────────────────────────────────────────────────────────────────────────
// REACT CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const EoraCtx = createContext<EoraController | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function EoraProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [preferences, setPreferences] = useState<EoraPreferences>(loadPreferences);
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<EoraMessage>({
    text: "",
    animationState: "IDLE",
  });
  const [animationState, setAnimationState] = useState<EoraAnimationState>("IDLE");
  const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourPaused, setTourPaused] = useState(false);
  const [tourTargetAvailable, setTourTargetAvailable] = useState(true);
  const [tourSpotlightTargetId, setTourSpotlightTargetId] =
    useState<string | null>(null);
  const [onboardingStep, setOnboardingStepState] =
    useState<OnboardingStep>("none");
  const [clarifyingOptions, setClarifyingOptions] = useState<string[] | null>(
    null
  );
  const [pendingNavUrl, setPendingNavUrl] = useState<string | null>(null);
  const [pendingNavLabel, setPendingNavLabel] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastSuccessfulAction, setLastSuccessfulAction] = useState<
    string | null
  >(null);
  const [focusedField, setFocusedField] =
    useState<EoraContext["focusedField"]>(null);
  const [userIsFocused, setUserIsFocused] = useState(false);
  // Live student context — populated by WorkspaceProvider / student pages
  const [liveStudent, setLiveStudent] = useState<StudentContext>(
    createEmptyStudentContext()
  );
  const [hasLiveStudentData, setHasLiveStudentData] = useState(false);
  // Guided multi-step task state (Phase 7.1)
  const [activeTask, setActiveTask] = useState<EoraActiveTaskSession | null>(null);
  const [activeTaskDef, setActiveTaskDef] = useState<EoraTaskDefinition | null>(null);

  // Session refs
  const sessionNudgeCount = useRef(0);
  const lastNudgeTimestamp = useRef<number | null>(null);
  const proactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownWelcomeBack = useRef(false);
  const managedTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const startTaskRef = useRef<(taskId: string) => void>(() => {});
  const advanceTaskRef = useRef<() => void>(() => {});
  const startTourRef = useRef<(tourId: string) => void>(() => {});
  const pauseTourRef = useRef<() => void>(() => {});
  const resumeTourRef = useRef<() => void>(() => {});
  const exitTourRef = useRef<() => void>(() => {});
  const nextTourStepRef = useRef<() => void>(() => {});
  const prevTourStepRef = useRef<() => void>(() => {});
  const setLanguageRef = useRef<(lang: "english" | "hinglish") => void>(() => {});

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      managedTimers.current.delete(timer);
      callback();
    }, delay);
    managedTimers.current.add(timer);
  }, []);

  useEffect(() => () => {
    managedTimers.current.forEach(clearTimeout);
    managedTimers.current.clear();
  }, []);

  // ── Context construction ───────────────────────────────────────────────────
  const context = useMemo<EoraContext>(
    () => ({
      route: resolveRouteFromPathname(pathname ?? "/"),
      onboardingStep,
      focusedField,
      student: {
        ...liveStudent,
        completedTourIds: preferences.tourCompletedIds,
        dismissedSuggestionIds: preferences.dismissedSuggestionIds,
      },
      userIsFocused,
      lastSuccessfulAction,
      processingState: liveStudent.isProcessing ? "Processing..." : null,
      lastEoraInteractionAt: preferences.lastInteractionAt,
      language:
        preferences.language === "hinglish" || preferences.language === "hi"
          ? "hinglish"
          : "english",
    }),
    [
      pathname,
      onboardingStep,
      focusedField,
      liveStudent,
      preferences.tourCompletedIds,
      preferences.dismissedSuggestionIds,
      preferences.lastInteractionAt,
      preferences.language,
      userIsFocused,
      lastSuccessfulAction,
    ]
  );

  useEffect(() => {
    const prefs = loadPreferences();
    const rm = detectReducedMotionPreference();
    setPreferences({ ...prefs, reducedMotion: prefs.reducedMotion || rm });
  }, []);

  // ── Automatic quiet behavior during typing and focused work ────────────────
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        if (target instanceof Element && target.closest(".eora-floating-root, .eora-panel")) {
          return;
        }
        setUserIsFocused(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        setUserIsFocused(false);
      }
    };

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  // ── Task account isolation guard ───────────────────────────────────────────
  useEffect(() => {
    if (activeTask && activeTask.personId && liveStudent.personId && activeTask.personId !== liveStudent.personId) {
      setActiveTask(null);
      setActiveTaskDef(null);
      setTourSpotlightTargetId(null);
    }
  }, [liveStudent.personId, activeTask]);

  // ── Proactive nudge on route / step change ────────────────────────────────
  useEffect(() => {
    if (proactiveTimer.current) clearTimeout(proactiveTimer.current);

    const route = resolveRouteFromPathname(pathname ?? "/");
    if (
      route === "landing" ||
      route === "sign-in" ||
      route === "sign-up"
    )
      return;
    if (shouldEoraBeQuiet(context) || activeTour || !isVisible || isPanelOpen) return;
    if (isEoraSnoozed(preferences)) return;

    proactiveTimer.current = setTimeout(() => {
      if (
        !canSendProactiveNudge(
          preferences,
          lastNudgeTimestamp.current,
          sessionNudgeCount.current
        )
      )
        return;

      // ── Welcome-back message for authenticated returning student ──────────
      if (
        route === "student-home" &&
        hasLiveStudentData &&
        liveStudent.displayName &&
        !hasShownWelcomeBack.current
      ) {
        hasShownWelcomeBack.current = true;
        const msg = getWelcomeBackMessage(liveStudent.displayName);
        setCurrentMessage(msg);
        setAnimationState(msg.animationState);
        sessionNudgeCount.current += 1;
        lastNudgeTimestamp.current = Date.now();
        setPreferences((p) => recordNudgeSent(p));
        return;
      }

      const decision = getProactiveDecision(context);
      if (!decision || !decision.message.text) return;

      setCurrentMessage(decision.message);
      setAnimationState(decision.message.animationState);
      if (decision.navigationUrl) {
        setPendingNavUrl(decision.navigationUrl);
        setPendingNavLabel(decision.navigationLabel ?? null);
      }

      sessionNudgeCount.current += 1;
      lastNudgeTimestamp.current = Date.now();
      setPreferences((p) => recordNudgeSent(p));
    }, 2500);

    return () => {
      if (proactiveTimer.current) clearTimeout(proactiveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, onboardingStep, lastSuccessfulAction, hasLiveStudentData, activeTour, isVisible, isPanelOpen]);

  // ── Onboarding step change → EORA message & dynamic spatial guidance ───────
  useEffect(() => {
    if (onboardingStep === "none" || activeTour || preferences.assistanceMode === "quiet") return;
    const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
    const msg = getOnboardingStepMessage(onboardingStep, isHinglish);
    if (msg.text) {
      setCurrentMessage(msg);
      setAnimationState(msg.animationState || "POINTING");
      setClarifyingOptions(null);
    }

    const stepTargets: Record<string, string> = {
      welcome: "eora-name-input",
      "role-select": "eora-role-student",
      "ai-direction": "eora-ai-direction",
      priorities: "eora-priorities",
      academic: "eora-academic-form",
      resume: "eora-resume-upload",
      "digital-footprints": "eora-digital-footprints",
      "ai-analysis": "eora-ai-analysis",
      "profile-insights": "eora-profile-insights",
      "skills-map": "eora-skills-map",
      "github-projects": "eora-github-projects",
      complete: "eora-onboarding-finish",
    };

    const target = stepTargets[onboardingStep];
    if (target) {
      // Prioritize invalid field if any exists on the screen
      const errField = document.querySelector<HTMLElement>(
        "[style*='solid #EF4444'], input:invalid, .field-error"
      );
      if (errField && (errField.id || errField.getAttribute("data-eora-id"))) {
        setTourSpotlightTargetId(errField.id || errField.getAttribute("data-eora-id") || target);
      } else {
        setTourSpotlightTargetId(target);
      }
    }
  }, [onboardingStep, activeTour, preferences.assistanceMode, preferences.language]);

  // ── Clear celebration after 3s ────────────────────────────────────────────
  useEffect(() => {
    if (!showCelebration) return;
    const t = setTimeout(() => setShowCelebration(false), 3000);
    return () => clearTimeout(t);
  }, [showCelebration]);

  // ── Tour spotlight DOM management ─────────────────────────────────────────
  useEffect(() => {
    if (!tourSpotlightTargetId) {
      // Remove spotlight from all elements
      document
        .querySelectorAll("[data-eora-spotlight='true']")
        .forEach((el) => {
          (el as HTMLElement).removeAttribute("data-eora-spotlight");
        });
      return;
    }

    // Remove old spotlight
    document
      .querySelectorAll("[data-eora-spotlight='true']")
      .forEach((el) => {
        (el as HTMLElement).removeAttribute("data-eora-spotlight");
      });

    // Apply new spotlight + scroll into view
    const applySpotlight = () => {
      const target = Array.from(document.querySelectorAll<HTMLElement>("[data-eora-id], [id]")).find(
        (element) =>
          (element.dataset.eoraId === tourSpotlightTargetId ||
            element.id === tourSpotlightTargetId) &&
          element.getClientRects().length > 0
      );

      if (target) {
        let effectiveTarget = target;
        if (
          target.id === "eora-academic-form" ||
          target.dataset.eoraId === "eora-academic-form" ||
          target.clientWidth > 550
        ) {
          const errorInput = target.querySelector<HTMLElement>(
            "[style*='solid #EF4444'], [style*='rgb(239, 68, 68)'], input:invalid, .field-error, [aria-invalid='true']"
          );
          const focusedInput = target.querySelector<HTMLElement>(
            "input:focus, textarea:focus, select:focus"
          );
          const defaultInput = target.querySelector<HTMLElement>(
            "#field-email, #field-fullname, input, select"
          );
          if (errorInput) effectiveTarget = errorInput;
          else if (focusedInput) effectiveTarget = focusedInput;
          else if (defaultInput && (target.id === "eora-academic-form" || target.dataset.eoraId === "eora-academic-form")) {
            effectiveTarget = defaultInput;
          }
        }

        setTourTargetAvailable(true);
        effectiveTarget.setAttribute("data-eora-spotlight", "true");
        // Compact onboarding keeps guidance available from the EORA orb.
        // Moving the page to each spotlight target would hide the new step's heading.
        if (!(pathname === "/onboarding" && window.matchMedia("(max-width: 480px)").matches)) {
          effectiveTarget.scrollIntoView({
            behavior: preferences.reducedMotion ? "instant" : "smooth",
            block: "nearest",
          });
        }
        return true;
      }
      setTourTargetAvailable(false);
      return false;
    };

    if (!applySpotlight()) {
      const timer = setTimeout(applySpotlight, 120);
      return () => clearTimeout(timer);
    }

    return () => {
      // Cleanup on unmount
      document
        .querySelectorAll("[data-eora-spotlight='true']")
        .forEach((el) => {
          (el as HTMLElement).removeAttribute("data-eora-spotlight");
        });
    };
  }, [tourSpotlightTargetId, onboardingStep, pathname, preferences.reducedMotion]);

  // ─────────────────────────────────────────────────────────────────────────
  // CALLBACKS
  // ─────────────────────────────────────────────────────────────────────────

  const handleUserMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setClarifyingOptions(null);
      setPendingNavUrl(null);
      setPendingNavLabel(null);

      const intentResult = recognizeIntent(text, pathname, context);
      const decision = processUserInput(text, intentResult, context);

      setCurrentMessage(decision.message);
      setAnimationState(decision.message.animationState);
      setPreferences((p) => recordInteraction(p));

      if (decision.clarifyingOptions) {
        setClarifyingOptions(decision.clarifyingOptions);
      }
      if (decision.navigationUrl) {
        setPendingNavUrl(decision.navigationUrl);
        setPendingNavLabel(decision.navigationLabel ?? null);
      }

      if (intentResult.intent === "DISMISS_ASSISTANT" || intentResult.intent === "DISMISS") {
        schedule(() => setIsVisible(false), 800);
      }
      if (intentResult.intent === "PAUSE_ASSISTANT" || intentResult.intent === "QUIET_MODE") {
        if (activeTour) {
          pauseTourRef.current();
          return;
        }
        setPreferences((p) => snoozeEora(p, 60));
      }
      if (intentResult.intent === "RESUME_ASSISTANT" || intentResult.intent === "RESUME") {
        if (activeTour && tourPaused) {
          resumeTourRef.current();
          return;
        }
        setIsVisible(true);
        setIsMinimized(false);
      }
      if (intentResult.intent === "STOP_TOUR") {
        if (activeTour) {
          exitTourRef.current();
          return;
        }
      }
      if (intentResult.intent === "START_FULL_TOUR") {
        startTourRef.current("explore-ai-tathastu");
        return;
      }
      if (intentResult.intent === "START_PAGE_TOUR" || intentResult.intent === "START_TOUR") {
        const route = context.route;
        const pageContract = getPageContract(route);
        const tourIdForRoute: Record<string, string> = {
          "student-home": "student-home",
          "student-skills": "student-skills",
          "student-projects": "student-projects",
          "student-roadmap": "student-roadmap",
          "onboarding": "onboarding-welcome",
        };
        const targetTour = pageContract?.guidedTour?.tourId || tourIdForRoute[route] || "student-home";
        startTourRef.current(targetTour);
        return;
      }
      if (intentResult.intent === "SKIP_STEP") {
        if (activeTour) {
          nextTourStepRef.current();
          return;
        }
        if (activeTask) {
          advanceTaskRef.current();
          return;
        }
      }
      if (intentResult.intent === "REPEAT_INSTRUCTION") {
        if (activeTour) {
          const step = activeTour.steps[tourStepIndex];
          if (step) {
            const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
            setCurrentMessage({
              text: isHinglish ? (step.hinglishExplanation ?? step.explanation) : step.explanation,
              animationState: "POINTING",
            });
            setAnimationState("POINTING");
            setTourSpotlightTargetId(step.targetId);
          }
          return;
        }
      }
      if (intentResult.intent === "SWITCH_LANGUAGE") {
        const lower = text.toLowerCase();
        const nextLang = lower.includes("hinglish") ? "hinglish" : "english";
        setLanguageRef.current(nextLang);
        return;
      }
      if (intentResult.intent === "NEXT_TOUR_STEP" && activeTour) {
        nextTourStepRef.current();
        return;
      }
      if (intentResult.intent === "PREVIOUS_TOUR_STEP" && activeTour) {
        prevTourStepRef.current();
        return;
      }

      // Phase 7.1 Deep Interactive Assistance Triggers
      if (
        (intentResult.intent === "HELP_WITH_PROJECT" ||
          text.toLowerCase().includes("add project") ||
          text.toLowerCase().includes("add my project")) &&
        (pathname?.includes("project") || context.route === "student-projects")
      ) {
        startTaskRef.current("task-add-project");
        return;
      }

      if (intentResult.intent === "WHERE_PUT_GITHUB_LINK") {
        setTourSpotlightTargetId("eora-project-input-repo");
      }
      if (intentResult.intent === "HOW_DESCRIBE_CONTRIBUTION") {
        setTourSpotlightTargetId("eora-project-input-contribution");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, activeTour, schedule, pathname]
  );

  const handleClarifyingChoice = useCallback(
    (text: string) => {
      handleUserMessage(text);
    },
    [handleUserMessage]
  );

  const clearMessage = useCallback(() => {
    setCurrentMessage({ text: "", animationState: "IDLE" });
    setAnimationState("IDLE");
    setClarifyingOptions(null);
  }, []);

  // ── Language controls ──────────────────────────────────────────────────────
  const setLanguage = useCallback((lang: "english" | "hinglish") => {
    setPreferences((prev) => {
      const updated = setLanguagePreference(prev, lang);
      if (liveStudent.personId) {
        savePreferencesForPerson(liveStudent.personId, updated);
      }
      return updated;
    });

    if (activeTour) {
      const step = activeTour.steps[tourStepIndex];
      if (step) {
        const text = lang === "hinglish" ? (step.hinglishExplanation ?? step.explanation) : step.explanation;
        setCurrentMessage({ text, animationState: "POINTING" });
      }
      return;
    }

    if (onboardingStep && onboardingStep !== "none") {
      const msg = getOnboardingStepMessage(onboardingStep, lang === "hinglish");
      setCurrentMessage(msg);
      setAnimationState(msg.animationState);
      return;
    }

    setCurrentMessage({
      text:
        lang === "hinglish"
          ? "Bilkul! Ab main aapse Hinglish me baat karungi. Kahiye, kya guide karoon?"
          : "Switched to English! How can I guide you today?",
      animationState: "HAPPY",
    });
    setAnimationState("HAPPY");
  }, [activeTour, tourStepIndex, onboardingStep, liveStudent.personId]);

  const toggleLanguage = useCallback(() => {
    const nextLang = preferences.language === "hinglish" || preferences.language === "hi" ? "english" : "hinglish";
    setLanguage(nextLang);
  }, [preferences.language, setLanguage]);

  const boop = useCallback(() => {
    const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
    setCurrentMessage({
      text: isHinglish
        ? "Boop! 😊 Main yahin hoon, guidance chahiye toh batao!"
        : "Boop! 😊 I'm right here with you. What can I help guide?",
      animationState: "HAPPY",
    });
    setAnimationState("HAPPY");
    setIsPanelOpen(false);
  }, [preferences.language]);

  // ── Tour controls ──────────────────────────────────────────────────────────
  const startTour = useCallback((tourId: string) => {
    const tour = getTourById(tourId);
    if (!tour) return;
    setActiveTour(tour);
    setTourStepIndex(0);
    setTourPaused(false);
    const firstStep = tour.steps[0];
    const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
    const text = isHinglish
      ? (firstStep?.hinglishExplanation ?? firstStep?.explanation ?? "Chaliye main aapko is page ka interactive tour karwati hoon!")
      : (firstStep?.explanation ?? tour.description);
    setCurrentMessage({
      text,
      animationState: "POINTING",
    });
    setAnimationState("POINTING");
    setTourSpotlightTargetId(firstStep?.targetId ?? null);
    setIsPanelOpen(false);
  }, [preferences.language]);

  const nextTourStep = useCallback(() => {
    if (!activeTour || tourPaused) return;
    const nextIndex = tourStepIndex + 1;
    const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
    if (activeTour.tourId === "onboarding-welcome" && nextIndex < activeTour.steps.length) {
      const nextTarget = activeTour.steps[nextIndex].targetId;
      if (!document.querySelector(`[data-eora-id="${nextTarget}"], #${nextTarget}`)) {
        setCurrentMessage({
          text: isHinglish
            ? "Pehle is step ka action complete kijiye. Main aapke saath agle screen par chalungi!"
            : "Complete this step in the form to continue the tour. I'll follow you to the next screen.",
          animationState: "WAITING",
        });
        setAnimationState("WAITING");
        return;
      }
    }
    if (nextIndex >= activeTour.steps.length) {
      setPreferences((p) => markTourCompleted(p, activeTour.tourId));
      setActiveTour(null);
      setTourStepIndex(0);
      setTourPaused(false);
      setTourSpotlightTargetId(null);
      setCurrentMessage({
        text: isHinglish
          ? "Tour complete ho gaya! Ab aap is page ko acche se samajh gaye hain. Shabaash!"
          : "Tour complete! You know this page well now.",
        animationState: "HAPPY",
      });
      setAnimationState("HAPPY");
      return;
    }
    setTourStepIndex(nextIndex);
    const step = activeTour.steps[nextIndex];
    setCurrentMessage({
      text: isHinglish ? (step.hinglishExplanation ?? step.explanation) : step.explanation,
      animationState: "POINTING",
    });
    setAnimationState("POINTING");
    setTourSpotlightTargetId(step.targetId);
  }, [activeTour, tourStepIndex, tourPaused, preferences.language]);

  const prevTourStep = useCallback(() => {
    if (!activeTour || tourStepIndex === 0) return;
    const prevIndex = tourStepIndex - 1;
    setTourStepIndex(prevIndex);
    const step = activeTour.steps[prevIndex];
    const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
    setCurrentMessage({
      text: isHinglish ? (step.hinglishExplanation ?? step.explanation) : step.explanation,
      animationState: "EXPLAINING",
    });
    setAnimationState("EXPLAINING");
    setTourSpotlightTargetId(step.targetId);
  }, [activeTour, tourStepIndex, preferences.language]);

  const exitTour = useCallback(() => {
    setActiveTour(null);
    setTourStepIndex(0);
    setTourPaused(false);
    setTourSpotlightTargetId(null);
    const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
    setCurrentMessage({
      text: isHinglish
        ? "Tour band kar diya gaya hai. Main yahin hoon, jab bhi zaroorat ho bula lena!"
        : "Tour ended. I'm here whenever you need me.",
      animationState: "WAVING",
    });
    setAnimationState("WAVING");
  }, [preferences.language]);

  useEffect(() => {
    if (!activeTour) return;
    const isValid =
      activeTour.validRoute === "/"
        ? pathname === "/" || pathname === ""
        : pathname.startsWith(activeTour.validRoute) ||
          activeTour.validRouteAliases?.some((alias) => pathname.startsWith(alias)) ||
          (activeTour.validRoute === "/verification" && pathname.startsWith("/faculty/verification"));
    if (!isValid) exitTour();
  }, [activeTour, pathname, exitTour]);

  const pauseTour = useCallback(() => {
    setTourPaused(true);
    setTourSpotlightTargetId(null);
    const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
    setCurrentMessage({
      text: isHinglish
        ? "Tour pause ho gaya hai. Jab aap tayyar hon, 'Resume' dabayein ya 'Next' bolein."
        : "Tour paused. Continue when you're ready.",
      animationState: "WAITING",
    });
    setAnimationState("WAITING");
  }, [preferences.language]);

  const resumeTour = useCallback(() => {
    if (!activeTour) return;
    const step = activeTour.steps[tourStepIndex];
    setTourPaused(false);
    if (step) {
      const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
      setCurrentMessage({
        text: isHinglish ? (step.hinglishExplanation ?? step.explanation) : step.explanation,
        animationState: "POINTING",
      });
      setAnimationState("POINTING");
      setTourSpotlightTargetId(step.targetId);
    }
  }, [activeTour, tourStepIndex, preferences.language]);

  // ── Phase 7.1 Guided Task State Machine ──────────────────────────────────
  const startTask = useCallback(
    (taskId: string) => {
      const taskDef = getTaskById(taskId);
      if (!taskDef) return;
      const session = createInitialTaskSession(taskDef, liveStudent.personId || undefined);
      setActiveTask(session);
      setActiveTaskDef(taskDef);
      setClarifyingOptions(null);
      setPendingNavUrl(null);
      setPendingNavLabel(null);
      setIsPanelOpen(true);
      const firstStep = taskDef.steps[0];
      if (firstStep) {
        setCurrentMessage({
          text: firstStep.instruction,
          animationState: firstStep.animationPose,
        });
        setAnimationState(firstStep.animationPose);
        setTourSpotlightTargetId(firstStep.targetId || firstStep.fieldId || null);
      }
    },
    [liveStudent.personId]
  );

  const advanceTask = useCallback(() => {
    if (!activeTask || !activeTaskDef) return;
    const nextSession = advanceTaskStep(activeTask, activeTaskDef);
    setActiveTask(nextSession);
    if (nextSession.state === "COMPLETED") {
      const celebration = activeTaskDef.completionCelebration;
      setCurrentMessage({
        text: celebration.message,
        animationState: celebration.animationPose,
        actionUrl: celebration.nextRoute,
        actionLabel: celebration.nextRecommendedAction,
      });
      setAnimationState(celebration.animationPose);
      setTourSpotlightTargetId(null);
      setShowCelebration(true);
      if (celebration.nextRoute) {
        setPendingNavUrl(celebration.nextRoute);
        setPendingNavLabel(celebration.nextRecommendedAction);
      }
      return;
    }
    const step = activeTaskDef.steps[nextSession.currentStepIndex];
    if (step) {
      setCurrentMessage({
        text: step.instruction,
        animationState: step.animationPose,
      });
      setAnimationState(step.animationPose);
      setTourSpotlightTargetId(step.targetId || step.fieldId || null);
    }
  }, [activeTask, activeTaskDef]);

  const rewindTask = useCallback(() => {
    if (!activeTask || !activeTaskDef) return;
    const prevSession = rewindTaskStep(activeTask);
    setActiveTask(prevSession);
    const step = activeTaskDef.steps[prevSession.currentStepIndex];
    if (step) {
      setCurrentMessage({
        text: step.instruction,
        animationState: step.animationPose,
      });
      setAnimationState(step.animationPose);
      setTourSpotlightTargetId(step.targetId || step.fieldId || null);
    }
  }, [activeTask, activeTaskDef]);

  const pauseTask = useCallback(() => {
    if (!activeTask) return;
    setActiveTask((prev) =>
      prev ? { ...prev, state: "PAUSED", lastUpdatedAt: Date.now() } : null
    );
    setTourSpotlightTargetId(null);
    setCurrentMessage({
      text: "Task paused. You can resume anytime from this page.",
      animationState: "WAITING",
    });
    setAnimationState("WAITING");
  }, [activeTask]);

  const resumeTask = useCallback(() => {
    if (!activeTask || !activeTaskDef) return;
    setActiveTask((prev) =>
      prev ? { ...prev, state: "WAITING_FOR_USER", lastUpdatedAt: Date.now() } : null
    );
    const step = activeTaskDef.steps[activeTask.currentStepIndex];
    if (step) {
      setCurrentMessage({
        text: step.instruction,
        animationState: step.animationPose,
      });
      setAnimationState(step.animationPose);
      setTourSpotlightTargetId(step.targetId || step.fieldId || null);
    }
  }, [activeTask, activeTaskDef]);

  const cancelTask = useCallback(() => {
    if (!activeTask) return;
    setActiveTask(null);
    setActiveTaskDef(null);
    setTourSpotlightTargetId(null);
    setCurrentMessage({
      text: "Task guidance ended. I'm here if you need help with anything else.",
      animationState: "IDLE",
    });
    setAnimationState("IDLE");
  }, [activeTask]);

  const notifyTaskEvent = useCallback(
    (eventName: string, data?: unknown) => {
      if (!activeTask || !activeTaskDef) return;
      const currentStep = activeTaskDef.steps[activeTask.currentStepIndex];
      if (currentStep && currentStep.expectedEvent === eventName) {
        if (activeTask.currentStepIndex >= activeTaskDef.steps.length - 1) {
          // Final step completed via event!
          setActiveTask((prev) =>
            prev
              ? {
                  ...prev,
                  state: "COMPLETED",
                  lastUpdatedAt: Date.now(),
                }
              : null
          );
          const celebration = activeTaskDef.completionCelebration;
          setCurrentMessage({
            text: celebration.message,
            animationState: celebration.animationPose,
            actionUrl: celebration.nextRoute,
            actionLabel: celebration.nextRecommendedAction,
          });
          setAnimationState(celebration.animationPose);
          setTourSpotlightTargetId(null);
          setShowCelebration(true);
          if (celebration.nextRoute) {
            setPendingNavUrl(celebration.nextRoute);
            setPendingNavLabel(celebration.nextRecommendedAction);
          }
        } else {
          advanceTask();
        }
      } else if (eventName === "project_saved" && activeTask.taskId === "task-add-project") {
        setActiveTask((prev) =>
          prev
            ? {
                ...prev,
                state: "COMPLETED",
                currentStepIndex: activeTaskDef.steps.length - 1,
                lastUpdatedAt: Date.now(),
              }
            : null
        );
        const celebration = activeTaskDef.completionCelebration;
        setCurrentMessage({
          text: celebration.message,
          animationState: celebration.animationPose,
          actionUrl: celebration.nextRoute,
          actionLabel: celebration.nextRecommendedAction,
        });
        setAnimationState(celebration.animationPose);
        setTourSpotlightTargetId(null);
        setShowCelebration(true);
        if (celebration.nextRoute) {
          setPendingNavUrl(celebration.nextRoute);
          setPendingNavLabel(celebration.nextRecommendedAction);
        }
      }
    },
    [activeTask, activeTaskDef, advanceTask]
  );

  useEffect(() => {
    if (!activeTask) return;
    if (!canResumeTask(activeTask, pathname ?? "/")) {
      if (activeTask.state !== "PAUSED" && activeTask.state !== "COMPLETED") {
        setActiveTask((prev) =>
          prev ? { ...prev, state: "PAUSED", lastUpdatedAt: Date.now() } : null
        );
      }
    }
  }, [pathname, activeTask]);

  useEffect(() => {
    startTaskRef.current = startTask;
    advanceTaskRef.current = advanceTask;
    startTourRef.current = startTour;
    pauseTourRef.current = pauseTour;
    resumeTourRef.current = resumeTour;
    exitTourRef.current = exitTour;
    nextTourStepRef.current = nextTourStep;
    prevTourStepRef.current = prevTourStep;
    setLanguageRef.current = setLanguage;
  }, [
    startTask,
    advanceTask,
    startTour,
    pauseTour,
    resumeTour,
    exitTour,
    nextTourStep,
    prevTourStep,
    setLanguage,
  ]);

  // Onboarding targets live on separate screens. Following the student's own
  // navigation keeps the tour aligned without advancing or submitting a form.
  useEffect(() => {
    if (!activeTour || activeTour.tourId !== "onboarding-welcome" || tourPaused) return;
    const targetByStep: Partial<Record<OnboardingStep, string>> = {
      welcome: "eora-name-input", "role-select": "eora-role-select",
      "ai-direction": "eora-ai-direction", priorities: "eora-priorities",
      academic: "eora-academic-form", resume: "eora-resume-upload",
      "digital-footprints": "eora-digital-footprints",
    };
    const targetId = targetByStep[onboardingStep];
    if (!targetId) return;
    const index = activeTour.steps.findIndex((step) => step.targetId === targetId);
    if (index < 0 || index === tourStepIndex) return;
    setTourStepIndex(index);
    setTourSpotlightTargetId(targetId);
    const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
    const text = isHinglish
      ? (activeTour.steps[index].hinglishExplanation ?? activeTour.steps[index].explanation)
      : activeTour.steps[index].explanation;
    setCurrentMessage({ text, animationState: "EXPLAINING" });
    setAnimationState("EXPLAINING");
  }, [activeTour, onboardingStep, tourPaused, tourStepIndex, preferences.language]);

  // ── Onboarding step external setter ──────────────────────────────────────
  const setOnboardingStep = useCallback((step: OnboardingStep) => {
    setOnboardingStepState(step);
    if (step && step !== "none") {
      const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
      const msg = getOnboardingStepMessage(step, isHinglish);
      setCurrentMessage(msg);
      setAnimationState(msg.animationState);
    }
  }, [preferences.language]);

  // ── Live student context (from EoraStudentBridge) ────────────────────────
  const updateLiveStudentContext = useCallback(
    (data: EoraLiveStudentData) => {
      // Security: never store tokens, passwords, or raw secrets
      // Load person-scoped preferences on first auth context arrival
      const personPrefs = loadPreferencesForPerson(data.personId);
      setPreferences((prev) => {
        const activeLang = prev.language || personPrefs.language || "en";
        // Only switch to person-scoped prefs if they're different from current
        if (prev.tourCompletedIds !== personPrefs.tourCompletedIds) {
          return { ...personPrefs, language: activeLang };
        }
        return { ...prev, language: activeLang };
      });

      setLiveStudent({
        personId: data.personId,
        displayName: data.displayName,
        isAuthenticated: true,
        activeGoalTitle: data.activeGoalTitle,
        targetRole: data.targetRole,
        primaryPriority: data.primaryPriority,
        secondaryPriorities: data.secondaryPriorities,
        skillsCount: data.skillsCount,
        projectsCount: data.projectsCount,
        verifiedEvidenceCount: data.verifiedEvidenceCount,
        completedTourIds: personPrefs.tourCompletedIds,
        dismissedSuggestionIds: personPrefs.dismissedSuggestionIds,
        isProcessing: data.isProcessing,
        connectedSources: data.connectedSources,
        nextMilestoneTitle: data.nextMilestoneTitle,
      });
      setHasLiveStudentData(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const clearStudentContext = useCallback(() => {
    setLiveStudent(createEmptyStudentContext());
    setHasLiveStudentData(false);
    hasShownWelcomeBack.current = false;
    // Revert to generic preferences on sign-out
    setPreferences(loadPreferences());
    // Clear any personal message
    setCurrentMessage({ text: "", animationState: "IDLE" });
    setAnimationState("IDLE");
  }, []);

  // ── Visibility controls ────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setIsPanelOpen(false);
    exitTour();
    setCurrentMessage({ text: "", animationState: "EXITING" });
    setAnimationState("EXITING");
    schedule(() => setIsVisible(false), 180);
  }, [exitTour, schedule]);

  const restore = useCallback(() => {
    setIsVisible(true);
    setIsMinimized(false);
    setAnimationState("ENTERING");
    schedule(() => setAnimationState("IDLE"), 500);
  }, [schedule]);

  const minimize = useCallback(() => {
    setIsMinimized(true);
    setIsPanelOpen(false);
  }, []);

  const expand = useCallback(() => setIsMinimized(false), []);
  const openPanel = useCallback(() => {
    if (proactiveTimer.current) clearTimeout(proactiveTimer.current);
    setIsPanelOpen(true);
  }, []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const snoozeHandler = useCallback((minutes: number) => {
    setPreferences((p) => snoozeEora(p, minutes));
    setCurrentMessage({
      text: `Quiet for ${minutes} minutes. See you soon!`,
      animationState: "QUIET",
    });
    setAnimationState("QUIET");
    schedule(() => {
      setCurrentMessage({ text: "", animationState: "IDLE" });
      setAnimationState("IDLE");
    }, minutes * 60 * 1000);
  }, [schedule]);

  // ── Success signals (must originate from verified backend results) ─────────
  const signalSuccess = useCallback(
    (action: string, studentName?: string) => {
      setLastSuccessfulAction(action);

      const celebrateActions = new Set([
        "onboarding_complete",
        "goal_achieved",
      ]);

      const isHandledByActiveTask =
        (action === "project_saved" && activeTask?.taskId === "task-add-project") ||
        (action === "profile_updated" && activeTask?.taskId === "task-audit-profile") ||
        (action === "verification_decision_submitted" && activeTask?.taskId === "task-verification-guide");

      if (celebrateActions.has(action)) {
        setShowCelebration(true);
        const name = studentName || liveStudent.displayName || "Student";
        const celebMsg = getCelebrationMessage(name);
        setCurrentMessage(celebMsg);
        setAnimationState(celebMsg.animationState);
      } else if (isHandledByActiveTask) {
        // Active task notification below will set the single authoritative celebration
      } else {
        const msg = getTinyVictoryMessage(action);
        setCurrentMessage(msg);
        setAnimationState(msg.animationState);
      }

      // Notify active task state machine of the backend success event
      notifyTaskEvent(action, studentName);

      // Clear signal after animation cycle
      schedule(() => setLastSuccessfulAction(null), 5000);
    },
    [liveStudent.displayName, schedule, notifyTaskEvent, activeTask?.taskId]
  );

  // ── Field validation signals ──────────────────────────────────────────────
  const signalFieldError = useCallback(
    (fieldId: string, label: string, error: string) => {
      const isHinglish = preferences.language === "hinglish" || preferences.language === "hi";
      setFocusedField({
        fieldId,
        label,
        isValid: false,
        isEmpty: false,
        errorMessage: error,
      });

      // Target the exact DOM element of the invalid field so EORA glides right beside it
      const baseClean = fieldId.toLowerCase().replace(/^field-/, "");
      const domId = fieldId.startsWith("field-")
        ? fieldId
        : document.getElementById(`field-${baseClean}`)
        ? `field-${baseClean}`
        : document.getElementById(`field-${fieldId}`)
        ? `field-${fieldId}`
        : fieldId;
      setTourSpotlightTargetId(domId);

      // Show EORA reassurance message for the field
      setCurrentMessage({
        text: isHinglish
          ? `Kripya "${label}" check karein: ${error}`
          : `Please check "${label}": ${error}`,
        animationState: "POINTING",
      });
      setAnimationState("POINTING");
    },
    [preferences.language]
  );

  const clearFieldError = useCallback(
    (fieldId?: string) => {
      setFocusedField((prev) => {
        if (!fieldId || prev?.fieldId === fieldId) return null;
        return prev;
      });
      if (onboardingStep !== "none") {
        const stepTargets: Record<string, string> = {
          welcome: "eora-name-input",
          "role-select": "eora-role-student",
          "ai-direction": "eora-ai-direction",
          priorities: "eora-priorities",
          academic: "eora-academic-form",
          resume: "eora-resume-upload",
          "digital-footprints": "eora-digital-footprints",
          "ai-analysis": "eora-ai-analysis",
          "profile-insights": "eora-profile-insights",
          "skills-map": "eora-skills-map",
          "github-projects": "eora-github-projects",
          complete: "eora-onboarding-finish",
        };
        const baseTarget = stepTargets[onboardingStep];
        if (baseTarget) setTourSpotlightTargetId(baseTarget);
      }
    },
    [onboardingStep]
  );

  const setUserFocused = useCallback((focused: boolean) => {
    setUserIsFocused(focused);
  }, []);

  const focusField = useCallback((fieldId: string, label: string) => {
    setFocusedField({ fieldId, label, isValid: true, isEmpty: false });
    const baseClean = fieldId.toLowerCase().replace(/^field-/, "");
    const domId = fieldId.startsWith("field-")
      ? fieldId
      : document.getElementById(`field-${baseClean}`)
      ? `field-${baseClean}`
      : document.getElementById(`field-${fieldId}`)
      ? `field-${fieldId}`
      : fieldId;
    if (document.getElementById(domId) || document.querySelector(`[data-eora-id="${domId}"]`)) {
      setTourSpotlightTargetId(domId);
    }
  }, []);

  // ── Preferences ────────────────────────────────────────────────────────────
  const updatePreferences = useCallback(
    (patch: Partial<EoraPreferences>) => {
      setPreferences((prev) => {
        const updated = { ...prev, ...patch };
        // Save to person-scoped key if authenticated, otherwise generic
        if (liveStudent.personId && liveStudent.isAuthenticated) {
          savePreferencesForPerson(liveStudent.personId, updated);
        } else {
          savePreferences(updated);
        }
        return updated;
      });
    },
    [liveStudent.personId, liveStudent.isAuthenticated]
  );

  const updateStudentContext = useCallback(
    (patch: Partial<EoraPreferences>) => {
      updatePreferences(patch);
    },
    [updatePreferences]
  );

  const resetAllPreferences = useCallback(() => {
    const defaults = resetPreferences();
    if (liveStudent.personId) {
      clearPreferencesForPerson(liveStudent.personId);
    }
    setPreferences(defaults);
  }, [liveStudent.personId]);

  const speak = useCallback((text: string, state: EoraAnimationState = "EXPLAINING") => {
    setCurrentMessage({ text, animationState: state });
    setAnimationState(state);
  }, []);


  // ── Derived values ─────────────────────────────────────────────────────────
  const isQuiet = shouldEoraBeQuiet(context);
  const currentPose = getPoseForState(animationState);

  // ── Controller value ───────────────────────────────────────────────────────
  const value: EoraController = {
    currentMessage,
    animationState,
    currentPose,
    isVisible,
    isPanelOpen,
    isQuiet,
    activeTour,
    tourStepIndex,
    tourPaused,
    tourTargetAvailable,
    tourSpotlightTargetId,
    activeTask,
    activeTaskDef,
    isMinimized,
    onboardingStep,
    preferences,
    clarifyingOptions,
    pendingNavUrl,
    pendingNavLabel,
    showCelebration,
    hasLiveStudentData,
    context,
    handleUserMessage,
    handleClarifyingChoice,
    clearMessage,
    openPanel,
    closePanel,
    dismiss,
    restore,
    minimize,
    expand,
    snooze: snoozeHandler,
    startTour,
    nextTourStep,
    prevTourStep,
    pauseTour,
    resumeTour,
    exitTour,
    startTask,
    advanceTask,
    rewindTask,
    pauseTask,
    resumeTask,
    cancelTask,
    notifyTaskEvent,
    setOnboardingStep,
    updateLiveStudentContext,
    clearStudentContext,
    signalSuccess,
    signalFieldError,
    clearFieldError,
    setUserFocused,
    focusField,
    updateStudentContext,
    updatePreferences,
    resetAllPreferences,
    speak,

    setLanguage,
    toggleLanguage,
    boop,
  };

  return <EoraCtx.Provider value={value}>{children}</EoraCtx.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useEora(): EoraController {
  const ctx = useContext(EoraCtx);
  if (!ctx) throw new Error("useEora must be used within an EoraProvider");
  return ctx;
}

export function useEoraSafe(): EoraController | null {
  return useContext(EoraCtx);
}
