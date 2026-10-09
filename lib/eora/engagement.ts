/**
 * EORA ENGAGEMENT ENGINE — VERSION 1.0
 * Nudge scheduler, cooldown logic, preference persistence.
 * Stores preferences via the existing /api/student/preferences endpoint.
 *
 * Rules:
 * - Max 1 unsolicited greeting per session.
 * - Max 2 nonessential nudges per day in Balanced mode.
 * - No disruptive popups during active typing.
 * - Notifications can be muted, snoozed, or disabled.
 * - No sensitive form values are logged.
 */

export type EoraAssistanceMode = "quiet" | "balanced" | "playful";

export interface EoraPreferences {
  assistanceMode: EoraAssistanceMode;
  language: "en" | "hi" | "hinglish";
  tourCompletedIds: string[];
  dismissedSuggestionIds: string[];
  reducedMotion: boolean;
  lastInteractionAt: number | null;
  /** ISO date string of last daily nudge */
  lastNudgeDate: string | null;
  nudgeCountToday: number;
  /** Whether EORA is currently snoozed */
  snoozedUntil: number | null;
}

export function createDefaultPreferences(): EoraPreferences {
  return {
    assistanceMode: "balanced",
    language: "en",
    tourCompletedIds: [],
    dismissedSuggestionIds: [],
    reducedMotion: false,
    lastInteractionAt: null,
    lastNudgeDate: null,
    nudgeCountToday: 0,
    snoozedUntil: null,
  };
}

const STORAGE_KEY = "eora_preferences_v1";

/**
 * Loads EORA preferences from localStorage (client-side only).
 * Falls back to defaults if nothing is stored.
 */
export function loadPreferences(): EoraPreferences {
  if (typeof window === "undefined") return createDefaultPreferences();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultPreferences();
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle schema evolution
    return { ...createDefaultPreferences(), ...parsed };
  } catch {
    return createDefaultPreferences();
  }
}

/**
 * Saves EORA preferences to localStorage.
 * Never logs raw form content.
 */
export function savePreferences(prefs: EoraPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable — fail silently
  }
}

/**
 * Resets all EORA preferences to defaults.
 */
export function resetPreferences(): EoraPreferences {
  const defaults = createDefaultPreferences();
  savePreferences(defaults);
  return defaults;
}

/**
 * Marks a tour as completed in preferences.
 */
export function markTourCompleted(
  prefs: EoraPreferences,
  tourId: string
): EoraPreferences {
  if (prefs.tourCompletedIds.includes(tourId)) return prefs;
  const updated = {
    ...prefs,
    tourCompletedIds: [...prefs.tourCompletedIds, tourId],
  };
  savePreferences(updated);
  return updated;
}

/**
 * Dismisses a suggestion ID so it won't repeat.
 */
export function dismissSuggestion(
  prefs: EoraPreferences,
  suggestionId: string
): EoraPreferences {
  if (prefs.dismissedSuggestionIds.includes(suggestionId)) return prefs;
  const updated = {
    ...prefs,
    dismissedSuggestionIds: [...prefs.dismissedSuggestionIds, suggestionId],
  };
  savePreferences(updated);
  return updated;
}

/**
 * Snoozes EORA for a given number of minutes.
 */
export function snoozeEora(
  prefs: EoraPreferences,
  minutes: number
): EoraPreferences {
  const updated = {
    ...prefs,
    snoozedUntil: Date.now() + minutes * 60 * 1000,
  };
  savePreferences(updated);
  return updated;
}

/**
 * Returns true if EORA is currently snoozed.
 */
export function isEoraSnoozed(prefs: EoraPreferences): boolean {
  if (!prefs.snoozedUntil) return false;
  return Date.now() < prefs.snoozedUntil;
}

/**
 * Determines whether EORA may send a proactive unsolicited nudge right now.
 * Returns false if mode, cooldown, or daily limit prevents it.
 */
export function canSendProactiveNudge(
  prefs: EoraPreferences,
  lastNudgeTimestamp: number | null,
  sessionNudgeCount: number
): boolean {
  // Quiet mode: no proactive nudges
  if (prefs.assistanceMode === "quiet") return false;

  // Snoozed
  if (isEoraSnoozed(prefs)) return false;

  // Daily limit
  const maxPerDay =
    prefs.assistanceMode === "balanced"
      ? 2
      : prefs.assistanceMode === "playful"
      ? 4
      : 0;

  const today = new Date().toISOString().slice(0, 10);
  if (prefs.lastNudgeDate === today && prefs.nudgeCountToday >= maxPerDay) {
    return false;
  }

  // Cooldown between nudges: 30 minutes
  const COOLDOWN_MS = 30 * 60 * 1000;
  if (lastNudgeTimestamp && Date.now() - lastNudgeTimestamp < COOLDOWN_MS) {
    return false;
  }

  // Session greeting limit
  if (sessionNudgeCount >= 1 && prefs.assistanceMode === "balanced") {
    return false;
  }

  return true;
}

/**
 * Records that a proactive nudge was sent. Updates daily count.
 */
export function recordNudgeSent(prefs: EoraPreferences): EoraPreferences {
  const today = new Date().toISOString().slice(0, 10);
  const count =
    prefs.lastNudgeDate === today ? prefs.nudgeCountToday + 1 : 1;
  const updated = {
    ...prefs,
    lastNudgeDate: today,
    nudgeCountToday: count,
    lastInteractionAt: Date.now(),
  };
  savePreferences(updated);
  return updated;
}

/**
 * Detects whether the user prefers reduced motion.
 * Reads the OS/browser preference.
 */
export function detectReducedMotionPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Updates preferences after EORA interaction.
 */
export function recordInteraction(prefs: EoraPreferences): EoraPreferences {
  const updated = { ...prefs, lastInteractionAt: Date.now() };
  savePreferences(updated);
  return updated;
}
