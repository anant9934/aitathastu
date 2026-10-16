"use client";

/**
 * EORA <-> screen step navigation by event, not DOM lookup (Task 1.4.1, BUG #1).
 *
 * The speech cloud used to find `#eora-onboarding-next-btn` and click it.
 * Screen 2 has its own submit button and no footer, so that lookup found
 * nothing and the click was silently swallowed. Now the companion dispatches
 * `eora:advance-step` / `eora:previous-step`; whichever screen is mounted
 * handles it with its own submit logic and marks it handled.
 */
import { useEffect, useRef } from "react";

export const EORA_ADVANCE = "eora:advance-step";
export const EORA_PREVIOUS = "eora:previous-step";

type StepDetail = { handled: boolean };

/** Fires a step event; returns whether a mounted screen handled it. */
export function dispatchEoraStep(kind: typeof EORA_ADVANCE | typeof EORA_PREVIOUS): boolean {
  const detail: StepDetail = { handled: false };
  window.dispatchEvent(new CustomEvent<StepDetail>(kind, { detail }));
  return detail.handled;
}

/**
 * Registers a screen's next/back handlers. Pass `enabled: false` while the
 * screen's own Next would be disabled, so EORA cannot skip validation.
 */
export function useEoraStepEvents(handlers: { onNext?: () => void; onBack?: () => void; enabled?: boolean }) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onAdvance = (e: Event) => {
      const h = ref.current;
      const detail = (e as CustomEvent<StepDetail>).detail;
      if (!h.onNext || h.enabled === false || detail.handled) return;
      detail.handled = true;
      h.onNext();
    };
    const onPrevious = (e: Event) => {
      const h = ref.current;
      const detail = (e as CustomEvent<StepDetail>).detail;
      if (!h.onBack || detail.handled) return;
      detail.handled = true;
      h.onBack();
    };
    window.addEventListener(EORA_ADVANCE, onAdvance);
    window.addEventListener(EORA_PREVIOUS, onPrevious);
    return () => {
      window.removeEventListener(EORA_ADVANCE, onAdvance);
      window.removeEventListener(EORA_PREVIOUS, onPrevious);
    };
  }, []);
}
