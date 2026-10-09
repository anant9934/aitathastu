"use client";

/**
 * EORA FLOATING COMPANION — VERSION 1.0
 * Compact floating assistant with avatar, speech bubble, input, and tour controls.
 *
 * Rules:
 * - One instance only (enforced by EoraProvider singleton).
 * - Does NOT intercept clicks outside the overlay.
 * - Keyboard accessible (Tab/Enter/Escape).
 * - Mobile safe-area spacing.
 * - Respects reduced-motion preference.
 * - Zero LLM calls for routine interactions.
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
import { getPoseForState } from "@/lib/eora/identity";

export function EoraFloatingCompanion() {
  const eora = useEoraSafe();
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Keyboard: Escape closes panel ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && eora?.isPanelOpen) {
        eora.closePanel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [eora]);

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

  // ── Not initialized or not visible → render nothing ───────────────────────
  if (!eora || !eora.isVisible) {
    // Show a minimal "ask EORA" restore button
    if (eora && !eora.isVisible) {
      return (
        <div className="eora-restore-wrapper" aria-label="EORA companion minimized">
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
    return null;
  }

  const pose = getPoseForState(eora.animationState);
  const asset = getEoraAsset(pose);
  const reducedMotion = eora.preferences.reducedMotion;

  // ── Minimized state: just the avatar bubble ──────────────────────────────
  if (eora.isMinimized) {
    return (
      <div
        className={`eora-floating-root eora-floating-root--minimized ${
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
          <Image
            src={asset.src}
            alt={asset.alt}
            width={52}
            height={65}
            className="eora-avatar-mini-img"
            priority={false}
          />
        </button>
      </div>
    );
  }

  // ── Full floating companion ───────────────────────────────────────────────
  return (
    <div
      className={`eora-floating-root ${reducedMotion ? "eora-no-motion" : ""}`}
      ref={containerRef}
      data-eora-id="eora-floating-companion"
      aria-label="EORA AI companion"
    >
      {/* ── AVATAR + SPEECH BUBBLE ROW ──────────────────────────────────── */}
      <div className="eora-floating-row">
        {/* Speech bubble (left of avatar) */}
        {eora.currentMessage.text && (
          <EoraSpeechBubble
            text={eora.currentMessage.text}
            actionLabel={eora.pendingNavLabel ?? undefined}
            actionUrl={eora.pendingNavUrl ?? undefined}
            onActionClick={(url) => {
              window.location.assign(url);
              eora.closePanel();
            }}
            onClose={() => {
              // Clear message
              eora.openPanel(); // or just dismiss — we'll keep message but dismiss bubble
            }}
            ariaLive="polite"
            reducedMotion={reducedMotion}
          />
        )}

        {/* Clarifying options */}
        {eora.clarifyingOptions && eora.clarifyingOptions.length > 0 && (
          <div className="eora-clarifying-options" role="listbox" aria-label="Clarifying options">
            {eora.clarifyingOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected="false"
                className="eora-clarifying-btn"
                onClick={() => handleClarifyChoice(option)}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {/* Avatar (click to toggle panel) */}
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
                // Playful response on explicit click
                if (!eora.currentMessage.text) {
                  eora.handleUserMessage("hi");
                }
              }
            }}
            aria-label={`EORA companion — ${eora.isPanelOpen ? "close panel" : "open panel"}`}
            aria-expanded={eora.isPanelOpen}
          >
            <Image
              src={asset.src}
              alt={asset.alt}
              width={72}
              height={90}
              className={`eora-avatar-img ${
                reducedMotion ? "" : "eora-avatar-img--animated"
              }`}
              priority={false}
            />
            {/* Sparkle badge */}
            <span className="eora-avatar-badge" aria-hidden="true">
              <Sparkles size={10} />
            </span>
          </button>

          {/* Control row: minimize, mute, dismiss */}
          <div className="eora-ctrl-row" aria-label="EORA controls">
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
                  ? "Unmute EORA suggestions"
                  : "Mute EORA suggestions"
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
              aria-label="Close EORA companion"
              title="Dismiss"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* ── EXPANDED PANEL ──────────────────────────────────────────────── */}
      {eora.isPanelOpen && (
        <div
          className="eora-panel"
          role="dialog"
          aria-label="EORA help panel"
          aria-modal="false"
        >
          {/* Panel header */}
          <div className="eora-panel-header">
            <div className="eora-panel-title">
              <Sparkles size={13} aria-hidden="true" />
              <strong>EORA</strong>
              <span className="eora-panel-subtitle">Your AI Companion</span>
            </div>
            <div className="eora-panel-header-actions">
              {/* Tour button */}
              <button
                type="button"
                className="eora-panel-btn"
                onClick={() => {
                  const route = eora.context.route;
                  const routeMap: Record<string, string> = {
                    "student-home": "student-home",
                    "student-skills": "student-skills",
                    "student-projects": "student-projects",
                    "student-roadmap": "student-roadmap",
                    "onboarding": "onboarding-welcome",
                  };
                  const tourId = routeMap[route];
                  if (tourId) {
                    eora.startTour(tourId);
                  }
                }}
                title="Start page tour"
                aria-label="Start a guided tour of this page"
              >
                <MapPin size={13} aria-hidden="true" />
                <span>Tour</span>
              </button>

              {/* Close panel */}
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

          {/* Tour controls (visible during active tour) */}
          {eora.activeTour && (
            <div className="eora-tour-controls" role="navigation" aria-label="Tour navigation">
              <span className="eora-tour-progress">
                Step {eora.tourStepIndex + 1} of {eora.activeTour.steps.length}:{" "}
                <strong>
                  {eora.activeTour.steps[eora.tourStepIndex]?.title}
                </strong>
              </span>
              <div className="eora-tour-nav">
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
                  onClick={eora.nextTourStep}
                  aria-label={
                    eora.tourStepIndex === eora.activeTour.steps.length - 1
                      ? "Finish tour"
                      : "Next tour step"
                  }
                >
                  <span>
                    {eora.tourStepIndex === eora.activeTour.steps.length - 1
                      ? "Finish"
                      : "Next"}
                  </span>
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
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

          {/* Quick actions */}
          <div className="eora-quick-actions">
            <button
              type="button"
              className="eora-quick-btn"
              onClick={() => eora.handleUserMessage("What should I do next?")}
            >
              What&apos;s next?
            </button>
            <button
              type="button"
              className="eora-quick-btn"
              onClick={() => eora.handleUserMessage("Explain this page")}
            >
              Explain page
            </button>
            {eora.context.student.isAuthenticated && (
              <button
                type="button"
                className="eora-quick-btn"
                onClick={() => eora.handleUserMessage("Show my roadmap")}
              >
                My roadmap
              </button>
            )}
          </div>

          {/* Message input */}
          <form className="eora-input-row" onSubmit={handleSubmit} aria-label="Message EORA">
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
              title="Reset all EORA preferences"
            >
              <RotateCcw size={10} aria-hidden="true" />
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ── CELEBRATION OVERLAY ──────────────────────────────────────────── */}
      {eora.showCelebration && !reducedMotion && (
        <div
          className="eora-celebration"
          aria-live="polite"
          aria-label="Celebration"
          aria-hidden="true"
        >
          {["✨", "🎉", "⭐", "✨", "🎊"].map((emoji, i) => (
            <span
              key={i}
              className="eora-confetti"
              style={{
                left: `${10 + i * 20}%`,
                animationDelay: `${i * 0.1}s`,
              }}
              aria-hidden="true"
            >
              {emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
