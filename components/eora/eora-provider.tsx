"use client";

/**
 * EORA PROVIDER — SHARED COMPANION CONTROLLER — VERSION 1.0
 * One single EORA instance across the entire app.
 * Manages: context, intent, decisions, tour state, preferences, animation.
 *
 * Performance rules:
 * - No duplicate timers or subscriptions.
 * - Cleans up all listeners on unmount.
 * - Lazy-loads nothing here (pure state management).
 * - ZERO LLM calls for routine interactions.
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

import type { EoraContext, OnboardingStep } from "@/lib/eora/context";
import {
  createDefaultContext,
  resolveRouteFromPathname,
  shouldEoraBeQuiet,
} from "@/lib/eora/context";
import type { EoraMessage } from "@/lib/eora/dialogue";
import { recognizeIntent } from "@/lib/eora/intent";
import { processUserInput, getProactiveDecision } from "@/lib/eora/brain";
import type { EoraPreferences } from "@/lib/eora/engagement";
import {
  loadPreferences,
  savePreferences,
  markTourCompleted,
  snoozeEora,
  canSendProactiveNudge,
  recordNudgeSent,
  recordInteraction,
  resetPreferences,
  detectReducedMotionPreference,
} from "@/lib/eora/engagement";
import type { TourDefinition } from "@/lib/eora/tours";
import { getTourById } from "@/lib/eora/tours";
import type { EoraAnimationState } from "@/lib/eora/identity";

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface EoraControllerState {
  /** Current EORA message (empty text = no message shown) */
  currentMessage: EoraMessage;
  /** Current animation pose */
  animationState: EoraAnimationState;
  /** Whether the floating companion is visible */
  isVisible: boolean;
  /** Whether the help panel is expanded */
  isPanelOpen: boolean;
  /** Whether EORA is in quiet mode */
  isQuiet: boolean;
  /** Active tour definition (null if no tour running) */
  activeTour: TourDefinition | null;
  /** Current tour step index */
  tourStepIndex: number;
  /** Whether EORA is minimized to avatar-only */
  isMinimized: boolean;
  /** Current onboarding step (set externally by onboarding container) */
  onboardingStep: OnboardingStep;
  /** User preferences */
  preferences: EoraPreferences;
  /** Clarifying options shown when intent is uncertain */
  clarifyingOptions: string[] | null;
  /** Navigation URL from last decision */
  pendingNavUrl: string | null;
  pendingNavLabel: string | null;
  /** Whether to show a celebration */
  showCelebration: boolean;
}

export interface EoraController extends EoraControllerState {
  /** Called when user sends a message to EORA */
  handleUserMessage: (text: string) => void;
  /** Called when a clarifying option is clicked */
  handleClarifyingChoice: (text: string) => void;
  /** Opens the help panel */
  openPanel: () => void;
  /** Closes the help panel */
  closePanel: () => void;
  /** Dismisses the companion */
  dismiss: () => void;
  /** Restores the companion */
  restore: () => void;
  /** Minimizes to icon */
  minimize: () => void;
  /** Expands from minimized */
  expand: () => void;
  /** Snoozes EORA for N minutes */
  snooze: (minutes: number) => void;
  /** Starts a tour by ID */
  startTour: (tourId: string) => void;
  /** Advances tour step */
  nextTourStep: () => void;
  /** Goes back one tour step */
  prevTourStep: () => void;
  /** Exits current tour */
  exitTour: () => void;
  /** Updates the onboarding step externally */
  setOnboardingStep: (step: OnboardingStep) => void;
  /** Updates student context data */
  updateStudentContext: (patch: Partial<EoraControllerState["preferences"]>) => void;
  /** Updates preferences */
  updatePreferences: (patch: Partial<EoraPreferences>) => void;
  /** Resets all preferences */
  resetAllPreferences: () => void;
  /** Signals a successful action (e.g. resume uploaded) */
  signalSuccess: (action: string) => void;
  /** Signals a field validation error */
  signalFieldError: (fieldId: string, label: string, error: string) => void;
  /** Clears field error */
  clearFieldError: () => void;
  /** The full context (read-only) */
  context: EoraContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const EoraContext = createContext<EoraController | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function EoraProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [preferences, setPreferences] = useState<EoraPreferences>(
    createDefaultContext().student ? loadPreferences() : loadPreferences()
  );
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
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("none");
  const [clarifyingOptions, setClarifyingOptions] = useState<string[] | null>(null);
  const [pendingNavUrl, setPendingNavUrl] = useState<string | null>(null);
  const [pendingNavLabel, setPendingNavLabel] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastSuccessfulAction, setLastSuccessfulAction] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<EoraContext["focusedField"]>(null);

  // Session nudge counter (resets on page load)
  const sessionNudgeCount = useRef(0);
  const lastNudgeTimestamp = useRef<number | null>(null);
  const proactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useRef(false);

  // ── Context construction ───────────────────────────────────────────────────
  const context = useMemo<EoraContext>(() => {
    const route = resolveRouteFromPathname(pathname ?? "/");
    return {
      route,
      onboardingStep,
      focusedField,
      student: {
        personId: null, // Populated by external updateStudentContext calls
        displayName: null,
        isAuthenticated: false,
        activeGoalTitle: null,
        targetRole: null,
        primaryPriority: null,
        secondaryPriorities: [],
        skillsCount: 0,
        projectsCount: 0,
        verifiedEvidenceCount: 0,
        completedTourIds: preferences.tourCompletedIds,
        dismissedSuggestionIds: preferences.dismissedSuggestionIds,
        isProcessing: false,
        connectedSources: [],
        nextMilestoneTitle: null,
      },
      userIsFocused: false,
      lastSuccessfulAction,
      processingState: null,
      lastEoraInteractionAt: preferences.lastInteractionAt,
    };
  }, [pathname, onboardingStep, focusedField, preferences, lastSuccessfulAction]);

  // ── Init: load preferences and detect reduced motion ──────────────────────
  useEffect(() => {
    const prefs = loadPreferences();
    reducedMotion.current = detectReducedMotionPreference();
    setPreferences({ ...prefs, reducedMotion: prefs.reducedMotion || reducedMotion.current });
  }, []);

  // ── Proactive nudge on route change ───────────────────────────────────────
  useEffect(() => {
    if (proactiveTimer.current) clearTimeout(proactiveTimer.current);

    const route = resolveRouteFromPathname(pathname ?? "/");
    // Never proactively nudge on landing/auth pages
    if (route === "landing" || route === "sign-in" || route === "sign-up") return;
    if (shouldEoraBeQuiet(context)) return;

    // Delay proactive suggestions by 2.5s after route change
    proactiveTimer.current = setTimeout(() => {
      if (
        !canSendProactiveNudge(
          preferences,
          lastNudgeTimestamp.current,
          sessionNudgeCount.current
        )
      )
        return;

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
      setPreferences((prev) => recordNudgeSent(prev));
    }, 2500);

    return () => {
      if (proactiveTimer.current) clearTimeout(proactiveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, onboardingStep, lastSuccessfulAction]);

  // ── Clear celebration after 3s ────────────────────────────────────────────
  useEffect(() => {
    if (!showCelebration) return;
    const t = setTimeout(() => setShowCelebration(false), 3000);
    return () => clearTimeout(t);
  }, [showCelebration]);

  // ── User message handler ───────────────────────────────────────────────────
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
      setPreferences((prev) => recordInteraction(prev));

      if (decision.clarifyingOptions) {
        setClarifyingOptions(decision.clarifyingOptions);
      }
      if (decision.navigationUrl) {
        setPendingNavUrl(decision.navigationUrl);
        setPendingNavLabel(decision.navigationLabel ?? null);
      }

      // Handle dismiss/pause via intent
      if (intentResult.intent === "DISMISS_ASSISTANT") {
        setTimeout(() => setIsVisible(false), 800);
      }
      if (intentResult.intent === "PAUSE_ASSISTANT") {
        setPreferences((prev) => snoozeEora(prev, 60));
      }
      if (intentResult.intent === "RESUME_ASSISTANT") {
        setIsVisible(true);
        setIsMinimized(false);
      }
    },
    [context]
  );

  // ── Clarifying choice ──────────────────────────────────────────────────────
  const handleClarifyingChoice = useCallback(
    (text: string) => {
      handleUserMessage(text);
    },
    [handleUserMessage]
  );

  // ── Tour controls ──────────────────────────────────────────────────────────
  const startTour = useCallback(
    (tourId: string) => {
      const tour = getTourById(tourId);
      if (!tour) return;
      setActiveTour(tour);
      setTourStepIndex(0);
      setCurrentMessage({
        text: tour.steps[0]?.explanation ?? tour.description,
        animationState: "EXPLAINING",
      });
      setAnimationState("EXPLAINING");
      setIsPanelOpen(true);
    },
    []
  );

  const nextTourStep = useCallback(() => {
    if (!activeTour) return;
    const nextIndex = tourStepIndex + 1;
    if (nextIndex >= activeTour.steps.length) {
      // Tour complete
      setPreferences((prev) => markTourCompleted(prev, activeTour.tourId));
      setActiveTour(null);
      setTourStepIndex(0);
      setCurrentMessage({ text: "Tour complete! Great job.", animationState: "HAPPY" });
      setAnimationState("HAPPY");
      return;
    }
    setTourStepIndex(nextIndex);
    setCurrentMessage({
      text: activeTour.steps[nextIndex].explanation,
      animationState: "POINTING",
    });
    setAnimationState("POINTING");
  }, [activeTour, tourStepIndex]);

  const prevTourStep = useCallback(() => {
    if (!activeTour || tourStepIndex === 0) return;
    const prevIndex = tourStepIndex - 1;
    setTourStepIndex(prevIndex);
    setCurrentMessage({
      text: activeTour.steps[prevIndex].explanation,
      animationState: "EXPLAINING",
    });
    setAnimationState("EXPLAINING");
  }, [activeTour, tourStepIndex]);

  const exitTour = useCallback(() => {
    setActiveTour(null);
    setTourStepIndex(0);
    setCurrentMessage({ text: "Tour ended. Click me anytime for help.", animationState: "IDLE" });
    setAnimationState("IDLE");
  }, []);

  // ── Visibility controls ────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setIsVisible(false);
    setIsPanelOpen(false);
  }, []);

  const restore = useCallback(() => {
    setIsVisible(true);
    setIsMinimized(false);
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
    setIsPanelOpen(false);
  }, []);

  const expand = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const snoozeHandler = useCallback((minutes: number) => {
    setPreferences((prev) => snoozeEora(prev, minutes));
    setCurrentMessage({ text: `I'll be quiet for ${minutes} minutes. See you soon!`, animationState: "QUIET" });
    setAnimationState("QUIET");
    setTimeout(() => {
      setCurrentMessage({ text: "", animationState: "IDLE" });
      setAnimationState("IDLE");
    }, minutes * 60 * 1000);
  }, []);

  // ── Signals ────────────────────────────────────────────────────────────────
  const signalSuccess = useCallback((action: string) => {
    setLastSuccessfulAction(action);
    if (action === "onboarding_complete" || action === "goal_achieved") {
      setShowCelebration(true);
      setCurrentMessage({ text: "Congratulations! You did it.", animationState: "CELEBRATING" });
      setAnimationState("CELEBRATING");
    }
    // Clear after one cycle
    setTimeout(() => setLastSuccessfulAction(null), 5000);
  }, []);

  const signalFieldError = useCallback(
    (fieldId: string, label: string, error: string) => {
      setFocusedField({ fieldId, label, isValid: false, isEmpty: false, errorMessage: error });
    },
    []
  );

  const clearFieldError = useCallback(() => {
    setFocusedField(null);
  }, []);

  // ── Preference controls ────────────────────────────────────────────────────
  const updatePreferences = useCallback((patch: Partial<EoraPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...patch };
      savePreferences(updated);
      return updated;
    });
  }, []);

  const updateStudentContext = useCallback(
    (patch: Partial<EoraControllerState["preferences"]>) => {
      updatePreferences(patch as Partial<EoraPreferences>);
    },
    [updatePreferences]
  );

  const resetAllPreferences = useCallback(() => {
    const defaults = resetPreferences();
    setPreferences(defaults);
  }, []);

  const isQuiet = shouldEoraBeQuiet(context);

  const value: EoraController = {
    currentMessage,
    animationState,
    isVisible,
    isPanelOpen,
    isQuiet,
    activeTour,
    tourStepIndex,
    isMinimized,
    onboardingStep,
    preferences,
    clarifyingOptions,
    pendingNavUrl,
    pendingNavLabel,
    showCelebration,
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
    updateStudentContext,
    updatePreferences,
    resetAllPreferences,
    signalSuccess,
    signalFieldError,
    clearFieldError,
  };

  return <EoraContext.Provider value={value}>{children}</EoraContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useEora(): EoraController {
  const ctx = useContext(EoraContext);
  if (!ctx) {
    throw new Error("useEora must be used within an EoraProvider");
  }
  return ctx;
}

/**
 * Safe version that returns null if called outside of an EoraProvider.
 * Use this in components that may render outside the provider tree.
 */
export function useEoraSafe(): EoraController | null {
  return useContext(EoraContext);
}
