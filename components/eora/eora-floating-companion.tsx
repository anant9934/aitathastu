"use client";

/**
 * EORA FLOATING COMPANION — VERSION 1.1 (Phase 5)
 * Full wiring: real DOM spotlight, user-focus detection,
 * dashboard-aware quick actions, tour step targeting.
 *
 * Rules:
 * - One instance only (enforced by EoraProvider singleton)
 * - Does NOT intercept clicks outside the overlay
 * - Keyboard accessible (Tab/Enter/Escape)
 * - Mobile safe-area spacing
 * - Respects reduced-motion preference
 * - ZERO LLM calls for routine interactions
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Sparkles,
  X,
  ChevronDown,
  Send,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { useEoraSafe } from "./eora-provider";
import { EoraSpeechBubble } from "./eora-speech-bubble";
import { getEoraAsset } from "@/lib/eora/avatar-registry";
import { EoraMotionAvatar } from "./eora-motion-avatar";
import { getPageContract } from "@/lib/eora/page-registry";

type Placement = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export function EoraFloatingCompanion() {
  const eora = useEoraSafe();
  const [inputText, setInputText] = useState("");
  const [placement, setPlacement] = useState<Placement>("bottom-right");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Keyboard: Escape closes panel ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && eora?.isPanelOpen) {
        eora.closePanel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [eora?.isPanelOpen, eora?.closePanel]);

  // ── Track user typing focus globally to suppress nudges ──────────────────
  useEffect(() => {
    if (!eora) return;
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      // Don't mark our own input as "user focused" (we want EORA responsive)
      const isEoraInput = containerRef.current?.contains(target);
      if (isInput && !isEoraInput) {
        eora.setUserFocused(true);
        const field = target as HTMLInputElement;
        const label = field.labels?.[0]?.textContent?.trim() || field.getAttribute("aria-label") || field.getAttribute("placeholder") || "this field";
        eora.focusField(field.id || field.name || "focused-field", label.slice(0, 80));
      }
    };
    const handleFocusOut = () => {
      eora.setUserFocused(false);
    };
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, [eora?.setUserFocused, eora?.focusField]);

  // Keep the compact trigger clear of visible controls at each viewport size.
  // The panel is user opened and closes on outside interaction.
  useEffect(() => {
    if (!eora?.isVisible || eora.isPanelOpen) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const trigger = containerRef.current?.querySelector<HTMLElement>(".eora-avatar-trigger")?.getBoundingClientRect();
        const triggerWidth = trigger?.width || (width <= 480 ? 58 : 72);
        const triggerHeight = trigger?.height || (width <= 480 ? 58 : 72);
        const edge = width <= 340 ? 8 : width <= 480 ? 12 : width <= 768 ? 16 : 24;
        const bottom = width <= 340 ? 68 : width <= 480 ? 72 : 24;
        const candidates: Placement[] = ["bottom-right", "bottom-left", "top-right", "top-left"];
        const controls = Array.from(document.querySelectorAll<HTMLElement>("button, input, textarea, select, a, [role='button']"))
          .filter((el) => !containerRef.current?.contains(el) && el.getClientRects().length > 0);
        const scored = candidates.map((candidate, index) => {
          const left = candidate.endsWith("right") ? width - triggerWidth - edge : edge;
          const top = candidate.startsWith("bottom") ? height - bottom - triggerHeight : 82;
          const box = { left: left - 6, top: top - 6, right: left + triggerWidth + 6, bottom: top + triggerHeight + 6 };
          const collisions = controls.reduce((count, control) => {
            const r = control.getBoundingClientRect();
            return count + (r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top ? 1 : 0);
          }, 0);
          return { candidate, score: collisions * 100 + index };
        });
        scored.sort((a, b) => a.score - b.score);
        setPlacement((current) => current === scored[0].candidate ? current : scored[0].candidate);
      });
    };
    update();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => !containerRef.current?.contains(mutation.target))) update();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("load", update, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("load", update, true);
    };
  }, [eora?.isVisible, eora?.isPanelOpen, eora?.onboardingStep, eora?.context.route]);

  useEffect(() => {
    if (!eora?.isPanelOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) eora.closePanel();
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [eora?.isPanelOpen, eora?.closePanel]);

  useEffect(() => {
    if (!eora?.isPanelOpen || !eora.currentMessage.text) return;
    const frame = requestAnimationFrame(() => {
      if (panelRef.current) panelRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [eora?.isPanelOpen, eora?.currentMessage.text]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputText.trim() || !eora) return;
      eora.handleUserMessage(inputText.trim());
      setInputText("");
    },
    [inputText, eora]
  );

  const handleClarifyChoice = useCallback(
    (option: string) => {
      if (!eora) return;
      eora.handleClarifyingChoice(option);
    },
    [eora]
  );

  // ── Not initialized ────────────────────────────────────────────────────────
  if (!eora) return null;

  // ── Dismissed — show minimal restore ──────────────────────────────────────
  if (!eora.isVisible) {
    return (
      <div className="eora-restore-wrapper" aria-label="EORA companion">
        <button
          type="button"
          className="eora-restore-btn"
          onClick={eora.restore}
          aria-label="Bring back EORA companion"
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>Ask EORA</span>
        </button>
      </div>
    );
  }

  // Use currentPose from provider (includes animation-state resolution)
  const pose = (eora.currentPose as Parameters<typeof getEoraAsset>[0]) ?? "avatar";
  const asset = getEoraAsset(pose);
  const reducedMotion = eora.preferences.reducedMotion;
  const motionPaused = reducedMotion || eora.context.userIsFocused || eora.preferences.assistanceMode === "quiet";

  // ── Minimized — just the avatar ────────────────────────────────────────────
  if (eora.isMinimized) {
    return (
      <div
        className={`eora-floating-root eora-floating-root--minimized eora-place-${placement} ${
          reducedMotion ? "eora-no-motion" : ""
        }`}
        ref={containerRef}
        aria-label="EORA companion (minimized)"
      >
        <button
          type="button"
          className="eora-avatar-trigger"
          onClick={eora.expand}
          aria-label="Expand EORA companion"
          aria-expanded="false"
        >
          <Image src={getEoraAsset("avatar").src} alt="" width={48} height={48} className="eora-avatar-mini-img" />
        </button>
      </div>
    );
  }

  // ── Compute quick actions for current route ────────────────────────────────
  const route = eora.context.route;
  const pageContract = getPageContract(route);
  const isStudentArea = route.startsWith("student");
  const isOnboarding = route === "onboarding";

  // Tour ID mapping with page contract fallback
  const tourIdForRoute: Record<string, string> = {
    "student-home": "student-home",
    "student-skills": "student-skills",
    "student-projects": "student-projects",
    "student-roadmap": "student-roadmap",
    "onboarding": "onboarding-welcome",
  };
  const activeTourId = pageContract?.guidedTour?.tourId || tourIdForRoute[route];
  const tourAvailable = Boolean(activeTourId);

  // ── Full floating companion ────────────────────────────────────────────────
  return (
    <div
      className={`eora-floating-root eora-place-${placement} ${eora.isPanelOpen ? "eora-panel-open" : ""} ${motionPaused ? "eora-no-motion" : ""}`}
      ref={containerRef}
      data-eora-id="eora-floating-companion"
      data-eora-route={route}
      aria-label="EORA AI companion"
    >
      {/* ── AVATAR + SPEECH BUBBLE ROW ──────────────────────────────────── */}
      <div className="eora-floating-row">
        {/* Avatar trigger */}
        <div className="eora-avatar-wrapper">
          <button
            type="button"
            className={`eora-avatar-trigger eora-avatar-trigger--full ${
              eora.isPanelOpen ? "eora-avatar-trigger--active" : ""
            }`}
            onClick={() => {
              if (eora.isPanelOpen) {
                eora.closePanel();
              } else {
                eora.openPanel();
                if (!eora.currentMessage.text) {
                  eora.handleUserMessage("hi");
                }
              }
            }}
            aria-label={`EORA — ${eora.isPanelOpen ? "close" : "open"} help panel`}
            aria-expanded={eora.isPanelOpen}
          >
            <EoraMotionAvatar pose={asset.pose} state={eora.animationState} reducedMotion={motionPaused} />
            <span className="eora-avatar-badge" aria-hidden="true">
              <Sparkles size={10} />
            </span>
            {pageContract && (
              <span className="eora-page-badge sr-only" data-page-id={pageContract.pageId}>
                {pageContract.pageTitle}
              </span>
            )}
          </button>


          {/* Control row */}
          {eora.isPanelOpen && <div className="eora-ctrl-row" aria-label="EORA controls">
            <button
              type="button"
              className="eora-ctrl-btn"
              onClick={eora.minimize}
              aria-label="Minimize EORA"
              title="Minimize"
            >
              <ChevronDown size={12} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="eora-ctrl-btn"
              onClick={() =>
                eora.updatePreferences({
                  assistanceMode:
                    eora.preferences.assistanceMode === "quiet"
                      ? "balanced"
                      : "quiet",
                })
              }
              aria-label={
                eora.preferences.assistanceMode === "quiet"
                  ? "Unmute EORA"
                  : "Mute EORA"
              }
              title={
                eora.preferences.assistanceMode === "quiet" ? "Unmute" : "Mute"
              }
            >
              {eora.preferences.assistanceMode === "quiet" ? (
                <VolumeX size={12} aria-hidden="true" />
              ) : (
                <Volume2 size={12} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="eora-ctrl-btn eora-ctrl-btn--dismiss"
              onClick={eora.dismiss}
              aria-label="Close EORA"
              title="Dismiss"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>}
        </div>
      </div>

      {/* ── EXPANDED PANEL ──────────────────────────────────────────────── */}
      {eora.isPanelOpen && (
        <div
          className="eora-panel"
          ref={panelRef}
          role="dialog"
          aria-label="EORA help panel"
          aria-modal="false"
        >
          {/* Header */}
          <div className="eora-panel-header">
            <div className="eora-panel-title">
              <Sparkles size={13} aria-hidden="true" />
              <strong>EORA</strong>
              <span className="eora-panel-subtitle">
                {eora.context.student.isAuthenticated
                  ? `Hi, ${eora.context.student.displayName?.split(" ")[0] ?? "there"}!`
                  : "Your AI Companion"}
              </span>
              {pageContract && (
                <span
                  className="eora-page-badge eora-panel-page-badge"
                  style={{

                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 6,
                    background: "rgba(2, 197, 245, 0.12)",
                    color: "#0284c7",
                    border: "1px solid rgba(2, 197, 245, 0.25)",
                    marginLeft: 6,
                  }}
                  title={pageContract.pagePurpose}
                >
                  {pageContract.pageTitle}
                </span>
              )}
            </div>
            <div className="eora-panel-header-actions">
              {tourAvailable && (
                <button
                  type="button"
                  className="eora-panel-btn"
                  onClick={() => {
                    if (activeTourId) eora.startTour(activeTourId);
                  }}
                  title="Start page tour"
                  aria-label="Start a guided tour of this page"
                >
                  <MapPin size={13} aria-hidden="true" />
                  <span>Tour</span>
                </button>
              )}
              <button
                type="button"
                className="eora-panel-btn eora-panel-btn--close"
                onClick={eora.closePanel}
                aria-label="Close help panel"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Universal Page Intelligence Summary */}
          {pageContract && (
            <div
              className="eora-panel-explanation"
              style={{
                margin: "8px 12px",
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                fontSize: 12,
                lineHeight: 1.45,
                color: "#e2e8f0",
              }}
            >
              <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>
                <Sparkles size={11} />
                <span>{pageContract.pageTitle}</span>
              </div>
              <p style={{ margin: 0, opacity: 0.9 }}>{pageContract.pagePurpose}</p>
            </div>
          )}


          {eora.currentMessage.text && !eora.context.userIsFocused && (
            <EoraSpeechBubble
              text={eora.currentMessage.text}
              actionLabel={eora.pendingNavLabel ?? undefined}
              actionUrl={eora.pendingNavUrl ?? undefined}
              onActionClick={(url) => {
                window.location.assign(url);
                eora.closePanel();
              }}
              onClose={eora.clearMessage}
              ariaLive="polite"
              reducedMotion={reducedMotion}
            />
          )}

          {eora.clarifyingOptions && eora.clarifyingOptions.length > 0 && (
            <div className="eora-clarifying-options" role="listbox" aria-label="Choose what you need">
              {eora.clarifyingOptions.map((option) => (
                <button key={option} type="button" role="option" aria-selected="false" className="eora-clarifying-btn" onClick={() => handleClarifyChoice(option)}>
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Active tour controls */}
          {eora.activeTour && (
            <div
              className="eora-tour-controls"
              role="navigation"
              aria-label="Tour navigation"
            >
              <span className="eora-tour-progress">
                Step {eora.tourStepIndex + 1} of {eora.activeTour.steps.length}
                {" — "}
                <strong>
                  {eora.activeTour.steps[eora.tourStepIndex]?.title}
                </strong>
              </span>
              <div className="eora-tour-nav">
                {!eora.tourTargetAvailable && !eora.tourPaused && <span className="eora-tour-unavailable">This section is not visible yet. Continue in the page or skip ahead.</span>}
                <button
                  type="button"
                  className="eora-tour-btn"
                  onClick={eora.prevTourStep}
                  disabled={eora.tourStepIndex === 0}
                  aria-label="Previous tour step"
                >
                  <ChevronLeft size={13} aria-hidden="true" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  className="eora-tour-btn eora-tour-btn--primary"
                  onClick={eora.tourPaused ? eora.resumeTour : eora.nextTourStep}
                  aria-label={
                    eora.tourPaused ? "Resume tour" : eora.tourStepIndex === eora.activeTour.steps.length - 1
                      ? "Finish tour"
                      : "Next step"
                  }
                >
                  <span>
                    {eora.tourPaused ? "Resume" : eora.tourStepIndex === eora.activeTour.steps.length - 1
                      ? "Finish"
                      : "Next"}
                  </span>
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
                {!eora.tourPaused && <button type="button" className="eora-tour-btn" onClick={eora.pauseTour} aria-label="Pause tour">Pause</button>}
                <button
                  type="button"
                  className="eora-tour-btn eora-tour-btn--exit"
                  onClick={eora.exitTour}
                  aria-label="Exit tour"
                >
                  Exit
                </button>
              </div>
            </div>
          )}

          {/* Context-aware quick actions */}
          <div className="eora-quick-actions">
            <button
              type="button"
              className="eora-quick-btn"
              onClick={() => eora.handleUserMessage("Explain this page")}
            >
              Explain page
            </button>
            <button
              type="button"
              className="eora-quick-btn"
              onClick={() => eora.handleUserMessage("What should I do next?")}
            >
              What&apos;s next?
            </button>
            {pageContract?.suggestedNextActions && pageContract.suggestedNextActions.length > 0 && (
              <button
                type="button"
                className="eora-quick-btn"
                onClick={() => {
                  const firstAction = pageContract.suggestedNextActions[0];
                  if (firstAction.route) {
                    window.location.assign(firstAction.route);
                  } else {
                    eora.handleUserMessage(firstAction.label);
                  }
                }}
              >
                {pageContract.suggestedNextActions[0].label}
              </button>
            )}
            {isOnboarding && (
              <>
                <button
                  type="button"
                  className="eora-quick-btn"
                  onClick={() => eora.handleUserMessage("Explain this page")}
                >
                  Explain step
                </button>
                <button
                  type="button"
                  className="eora-quick-btn"
                  onClick={() => eora.handleUserMessage("Explain this field")}
                >
                  Explain field
                </button>
              </>
            )}
            {isStudentArea && (
              <>
                <button
                  type="button"
                  className="eora-quick-btn"
                  onClick={() => eora.handleUserMessage("Show my roadmap")}
                >
                  My roadmap
                </button>
                <button
                  type="button"
                  className="eora-quick-btn"
                  onClick={() => eora.handleUserMessage("Show my skills")}
                >
                  My skills
                </button>
              </>
            )}
            {!isStudentArea && !isOnboarding && (
              <button
                type="button"
                className="eora-quick-btn"
                onClick={() => eora.handleUserMessage("Guide me")}
              >
                Guide me
              </button>
            )}
          </div>

          {/* Message input */}
          <form
            className="eora-input-row"
            onSubmit={handleSubmit}
            aria-label="Message EORA"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask EORA anything..."
              className="eora-input"
              aria-label="Type a message to EORA"
              maxLength={500}
              autoComplete="off"
            />
            <button
              type="submit"
              className="eora-input-send"
              disabled={!inputText.trim()}
              aria-label="Send message to EORA"
            >
              <Send size={14} aria-hidden="true" />
            </button>
          </form>

          {/* Settings row */}
          <div className="eora-panel-footer">
            <button
              type="button"
              className="eora-footer-link"
              onClick={() => eora.handleUserMessage("Explain in Hinglish")}
              title="Switch language to Hinglish"
            >
              Hinglish
            </button>
            <button
              type="button"
              className="eora-footer-link"
              onClick={() => eora.snooze(60)}
            >
              Snooze 1h
            </button>
            <button
              type="button"
              className="eora-footer-link"
              onClick={() =>
                eora.updatePreferences({
                  assistanceMode:
                    eora.preferences.assistanceMode === "quiet"
                      ? "balanced"
                      : eora.preferences.assistanceMode === "balanced"
                      ? "playful"
                      : "quiet",
                })
              }
            >
              Mode: {eora.preferences.assistanceMode}
            </button>
            <button
              type="button"
              className="eora-footer-link"
              onClick={eora.resetAllPreferences}
              title="Reset EORA preferences"
            >
              <RotateCcw size={10} aria-hidden="true" />
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ── CELEBRATION OVERLAY ──────────────────────────────────────────── */}
      {eora.showCelebration && !motionPaused && <span className="eora-tiny-sparkle" aria-hidden="true">✦</span>}
    </div>
  );
}
