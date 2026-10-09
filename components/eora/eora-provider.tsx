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
  savePreferences,
  markTourCompleted,
  snoozeEora,
  isEoraSnoozed,
  canSendProactiveNudge,
  recordNudgeSent,
  recordInteraction,
  resetPreferences,
  detectReducedMotionPreference,
} from "@/lib/eora/engagement";
import type { TourDefinition } from "@/lib/eora/tours";
import { getTourById } from "@/lib/eora/tours";
import type { EoraAnimationState } from "@/lib/eora/identity";
import { getPoseForState } from "@/lib/eora/identity";

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
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface EoraController extends EoraControllerState {
  handleUserMessage: (text: string) => void;
  handleClarifyingChoice: (text: string) => void;
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
  exitTour: () => void;
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
  updatePreferences: (patch: Partial<EoraPreferences>) => void;
  resetAllPreferences: () => void;
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

  // Session refs
  const sessionNudgeCount = useRef(0);
  const lastNudgeTimestamp = useRef<number | null>(null);
  const proactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownWelcomeBack = useRef(false);

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
    }),
    [
      pathname,
      onboardingStep,
      focusedField,
      liveStudent,
      preferences.tourCompletedIds,
      preferences.dismissedSuggestionIds,
      preferences.lastInteractionAt,
      userIsFocused,
      lastSuccessfulAction,
    ]
  );

  // ── Init: load preferences and detect reduced motion ──────────────────────
  useEffect(() => {
    const prefs = loadPreferences();
    const rm = detectReducedMotionPreference();
    setPreferences({ ...prefs, reducedMotion: prefs.reducedMotion || rm });
  }, []);

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
    if (shouldEoraBeQuiet(context)) return;
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
  }, [pathname, onboardingStep, lastSuccessfulAction, hasLiveStudentData]);

  // ── Onboarding step change → EORA message ─────────────────────────────────
  useEffect(() => {
    if (onboardingStep === "none") return;
    const msg = getOnboardingStepMessage(onboardingStep);
    if (msg.text) {
      setCurrentMessage(msg);
      setAnimationState(msg.animationState);
      setClarifyingOptions(null);
    }
  }, [onboardingStep]);

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
    const target = document.querySelector(
      `[data-eora-id="${tourSpotlightTargetId}"]`
    ) as HTMLElement | null;

    if (target) {
      target.setAttribute("data-eora-spotlight", "true");
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    return () => {
      // Cleanup on unmount
      document
        .querySelectorAll("[data-eora-spotlight='true']")
        .forEach((el) => {
          (el as HTMLElement).removeAttribute("data-eora-spotlight");
        });
    };
  }, [tourSpotlightTargetId]);

  // ─────────────────────────────────────────────────────────────────────────
  // CALLBACKS
  // ─────────────────────────────────────────────────────────────────────────

  const handleUserMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setClarifyingOptions(null);
      setPendingNavUrl(null);
      setPendingNavLabel(null);

      const intentResult = recognizeIntent(text);
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

      if (intentResult.intent === "DISMISS_ASSISTANT") {
        setTimeout(() => setIsVisible(false), 800);
      }
      if (intentResult.intent === "PAUSE_ASSISTANT") {
        setPreferences((p) => snoozeEora(p, 60));
      }
      if (intentResult.intent === "RESUME_ASSISTANT") {
        setIsVisible(true);
        setIsMinimized(false);
      }
      // Tour navigation via chat
      if (intentResult.intent === "NEXT_TOUR_STEP" && activeTour) {
        nextTourStep();
        return;
      }
      if (intentResult.intent === "PREVIOUS_TOUR_STEP" && activeTour) {
        prevTourStep();
        return;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, activeTour]
  );

  const handleClarifyingChoice = useCallback(
    (text: string) => {
      handleUserMessage(text);
    },
    [handleUserMessage]
  );

  // ── Tour controls ──────────────────────────────────────────────────────────
  const startTour = useCallback((tourId: string) => {
    const tour = getTourById(tourId);
    if (!tour) return;
    setActiveTour(tour);
    setTourStepIndex(0);
    const firstStep = tour.steps[0];
    setCurrentMessage({
      text: firstStep?.explanation ?? tour.description,
      animationState: "EXPLAINING",
    });
    setAnimationState("EXPLAINING");
    setTourSpotlightTargetId(firstStep?.targetId ?? null);
    setIsPanelOpen(true);
  }, []);

  const nextTourStep = useCallback(() => {
    if (!activeTour) return;
    const nextIndex = tourStepIndex + 1;
    if (nextIndex >= activeTour.steps.length) {
      setPreferences((p) => markTourCompleted(p, activeTour.tourId));
      setActiveTour(null);
      setTourStepIndex(0);
      setTourSpotlightTargetId(null);
      setCurrentMessage({
        text: "Tour complete! You know this page well now.",
        animationState: "HAPPY",
      });
      setAnimationState("HAPPY");
      return;
    }
    setTourStepIndex(nextIndex);
    const step = activeTour.steps[nextIndex];
    setCurrentMessage({
      text: step.explanation,
      animationState: "POINTING",
    });
    setAnimationState("POINTING");
    setTourSpotlightTargetId(step.targetId);
  }, [activeTour, tourStepIndex]);

  const prevTourStep = useCallback(() => {
    if (!activeTour || tourStepIndex === 0) return;
    const prevIndex = tourStepIndex - 1;
    setTourStepIndex(prevIndex);
    const step = activeTour.steps[prevIndex];
    setCurrentMessage({
      text: step.explanation,
      animationState: "EXPLAINING",
    });
    setAnimationState("EXPLAINING");
    setTourSpotlightTargetId(step.targetId);
  }, [activeTour, tourStepIndex]);

  const exitTour = useCallback(() => {
    setActiveTour(null);
    setTourStepIndex(0);
    setTourSpotlightTargetId(null);
    setCurrentMessage({
      text: "Tour ended. I'm here whenever you need me.",
      animationState: "IDLE",
    });
    setAnimationState("IDLE");
  }, []);

  // ── Onboarding step external setter ──────────────────────────────────────
  const setOnboardingStep = useCallback((step: OnboardingStep) => {
    setOnboardingStepState(step);
  }, []);

  // ── Live student context (from WorkspaceProvider / student pages) ─────────
  const updateLiveStudentContext = useCallback(
    (data: EoraLiveStudentData) => {
      // Security: never store tokens, passwords, or raw secrets
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
        completedTourIds: preferences.tourCompletedIds,
        dismissedSuggestionIds: preferences.dismissedSuggestionIds,
        isProcessing: data.isProcessing,
        connectedSources: data.connectedSources,
        nextMilestoneTitle: data.nextMilestoneTitle,
      });
      setHasLiveStudentData(true);
    },
    [preferences.tourCompletedIds, preferences.dismissedSuggestionIds]
  );

  const clearStudentContext = useCallback(() => {
    setLiveStudent(createEmptyStudentContext());
    setHasLiveStudentData(false);
    hasShownWelcomeBack.current = false;
    // Clear any personal message
    setCurrentMessage({ text: "", animationState: "IDLE" });
    setAnimationState("IDLE");
  }, []);

  // ── Visibility controls ────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setIsVisible(false);
    setIsPanelOpen(false);
    exitTour();
  }, [exitTour]);

  const restore = useCallback(() => {
    setIsVisible(true);
    setIsMinimized(false);
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
    setIsPanelOpen(false);
  }, []);

  const expand = useCallback(() => setIsMinimized(false), []);
  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const snoozeHandler = useCallback((minutes: number) => {
    setPreferences((p) => snoozeEora(p, minutes));
    setCurrentMessage({
      text: `Quiet for ${minutes} minutes. See you soon!`,
      animationState: "QUIET",
    });
    setAnimationState("QUIET");
    setTimeout(() => {
      setCurrentMessage({ text: "", animationState: "IDLE" });
      setAnimationState("IDLE");
    }, minutes * 60 * 1000);
  }, []);

  // ── Success signals (must originate from verified backend results) ─────────
  const signalSuccess = useCallback(
    (action: string, studentName?: string) => {
      setLastSuccessfulAction(action);

      const celebrateActions = new Set([
        "onboarding_complete",
        "goal_achieved",
      ]);

      if (celebrateActions.has(action)) {
        setShowCelebration(true);
        const name = studentName || liveStudent.displayName || "Student";
        const celebMsg = getCelebrationMessage(name);
        setCurrentMessage(celebMsg);
        setAnimationState(celebMsg.animationState);
      } else {
        const msg = getTinyVictoryMessage(action);
        setCurrentMessage(msg);
        setAnimationState(msg.animationState);
      }

      // Clear signal after animation cycle
      setTimeout(() => setLastSuccessfulAction(null), 5000);
    },
    [liveStudent.displayName]
  );

  // ── Field validation signals ──────────────────────────────────────────────
  const signalFieldError = useCallback(
    (fieldId: string, label: string, error: string) => {
      setFocusedField({
        fieldId,
        label,
        isValid: false,
        isEmpty: false,
        errorMessage: error,
      });
      // Show EORA reassurance message for the field
      setCurrentMessage({
        text: `"${label}": ${error}`,
        animationState: "REASSURING",
      });
      setAnimationState("REASSURING");
    },
    []
  );

  const clearFieldError = useCallback((fieldId?: string) => {
    setFocusedField((prev) => {
      if (!fieldId || prev?.fieldId === fieldId) return null;
      return prev;
    });
    // Return to idle only if current message is a field error
    setCurrentMessage((prev) => {
      if (prev.animationState === "REASSURING") {
        return { text: "", animationState: "IDLE" };
      }
      return prev;
    });
    setAnimationState((prev) => (prev === "REASSURING" ? "IDLE" : prev));
  }, []);

  const setUserFocused = useCallback((focused: boolean) => {
    setUserIsFocused(focused);
  }, []);

  // ── Preferences ────────────────────────────────────────────────────────────
  const updatePreferences = useCallback((patch: Partial<EoraPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...patch };
      savePreferences(updated);
      return updated;
    });
  }, []);

  const updateStudentContext = useCallback(
    (patch: Partial<EoraPreferences>) => {
      updatePreferences(patch);
    },
    [updatePreferences]
  );

  const resetAllPreferences = useCallback(() => {
    setPreferences(resetPreferences());
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
    tourSpotlightTargetId,
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
    exitTour,
    setOnboardingStep,
    updateLiveStudentContext,
    clearStudentContext,
    signalSuccess,
    signalFieldError,
    clearFieldError,
    setUserFocused,
    updateStudentContext,
    updatePreferences,
    resetAllPreferences,
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
