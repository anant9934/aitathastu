"use client";

/**
 * EORA SPEECH & THOUGHT CLOUD UI — VERSION 8.1
 * Clash of Clans–inspired interactive tutorial speech cloud & thought cloud.
 *
 * Features:
 * - Cartoon-inspired rounded speech cloud connected by directional tail
 * - Distinct Thought Cloud connected by circular bubbles (o O 💭) during real processing
 * - Permanent English | Hinglish language switch
 * - Small tutorial progress indicator ("Step 2 of 5")
 * - User-controlled optional voice playback (Browser SpeechSynthesis, off by default, zero mic)
 * - Navigation controls: Next, Back, Repeat, Pause/Ruko, Skip, Exit
 * - Quick replies and action buttons
 * - Respects prefers-reduced-motion
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  X,
  Sparkles,
  ArrowRight,
  Check,
} from "lucide-react";
import { HINGLISH_UI } from "@/lib/eora/hinglish";

export interface EoraSpeechCloudProps {
  text: string;
  isProcessing?: boolean;
  processingMessage?: string;
  language: "english" | "hinglish";
  onLanguageChange: (lang: "english" | "hinglish") => void;
  /** Tutorial progress metadata */
  progress?: {
    current: number;
    total: number;
    title: string;
    hinglishTitle?: string;
  } | null;
  /** Navigation controls */
  onNext?: () => void;
  onPrev?: () => void;
  onRepeat?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onSkip?: () => void;
  onExit?: () => void;
  isPaused?: boolean;
  hasNext?: boolean;
  hasPrev?: boolean;
  canSkip?: boolean;
  /** Optional CTA */
  actionLabel?: string;
  actionUrl?: string;
  onActionClick?: (url: string) => void;
  /** Quick replies / clarifying choices */
  quickReplies?: string[] | null;
  onQuickReplyClick?: (reply: string) => void;
  /** Close / Dismiss */
  onClose?: () => void;
  /** Direction connector tail pointing toward EORA avatar */
  tailDirection?: "left" | "right" | "top" | "bottom";
  reducedMotion?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function EoraSpeechCloud({
  text,
  isProcessing = false,
  processingMessage,
  language,
  onLanguageChange,
  progress,
  onNext,
  onPrev,
  onRepeat,
  onPause,
  onResume,
  onSkip,
  onExit,
  isPaused = false,
  hasNext = false,
  hasPrev = false,
  canSkip = false,
  actionLabel,
  actionUrl,
  onActionClick,
  quickReplies,
  onQuickReplyClick,
  onClose,
  tailDirection = "left",
  reducedMotion = false,
  className = "",
  style,
}: EoraSpeechCloudProps) {
  const isHinglish = language === "hinglish";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop narration on unmount, text change, or step change
  const stopNarration = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    speechUtteranceRef.current = null;
  }, []);

  useEffect(() => {
    stopNarration();
  }, [text, stopNarration]);

  useEffect(() => {
    return () => {
      stopNarration();
    };
  }, [stopNarration]);

  // Voice narration toggle (browser speech synthesis only, 100% client-side, zero mic)
  const toggleVoice = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    if (isSpeaking) {
      stopNarration();
      return;
    }

    const cleanText = (isProcessing ? (processingMessage || text) : text)
      .replace(/[✦💡✨•]/g, "")
      .trim();

    if (!cleanText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    // Attempt to pick a pleasant voice
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang.startsWith("en-IN") || v.name.includes("India")) ||
      voices.find((v) => v.lang.startsWith("en-US")) ||
      voices[0];

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechUtteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleAction = () => {
    if (onActionClick && actionUrl) {
      onActionClick(actionUrl);
    } else if (actionUrl) {
      window.location.assign(actionUrl);
    }
  };

  // ── THOUGHT CLOUD (Real Processing State) ─────────────────────────────────
  if (isProcessing) {
    const thoughtText =
      processingMessage ||
      (isHinglish
        ? "Ek second, details verify kar rahi hoon..."
        : "One moment, verifying details...");

    return (
      <div
        className={`eora-thought-cloud-wrapper ${
          reducedMotion ? "eora-no-motion" : ""
        } ${className}`}
        style={style}
        role="status"
        aria-live="polite"
        data-tail={tailDirection}
      >
        {/* Connector bubbles trailing to EORA */}
        <div className="eora-thought-bubbles-tail" aria-hidden="true">
          <span className="eora-thought-bubble eora-thought-bubble--sm" />
          <span className="eora-thought-bubble eora-thought-bubble--md" />
          <span className="eora-thought-bubble eora-thought-bubble--lg" />
        </div>

        {/* Thought cloud body */}
        <div className="eora-thought-cloud-body">
          <div className="eora-thought-header">
            <span className="eora-thought-pulse" aria-hidden="true">💭</span>
            <span className="eora-thought-title">
              {isHinglish ? "EORA Soch Rahi Hai..." : "EORA is Thinking..."}
            </span>
            <div className="eora-lang-toggle" role="group" aria-label="Language selection">
              <button
                type="button"
                className={`eora-lang-btn ${!isHinglish ? "eora-lang-btn--active" : ""}`}
                onClick={() => onLanguageChange("english")}
                aria-pressed={!isHinglish}
              >
                EN
              </button>
              <button
                type="button"
                className={`eora-lang-btn ${isHinglish ? "eora-lang-btn--active" : ""}`}
                onClick={() => onLanguageChange("hinglish")}
                aria-pressed={isHinglish}
              >
                Hinglish
              </button>
            </div>
          </div>
          <p className="eora-thought-text">{thoughtText}</p>
        </div>
      </div>
    );
  }

  if (!text) return null;

  // ── SPEECH CLOUD (Interactive Guide Dialogue) ─────────────────────────────
  return (
    <div
      className={`eora-speech-cloud-wrapper ${
        reducedMotion ? "eora-no-motion" : ""
      } eora-tail-${tailDirection} ${className}`}
      style={style}
      role="region"
      aria-label="EORA Tutorial Guidance"
    >
      <div className="eora-speech-cloud-card">
        {/* Top bar: Progress indicator, Language toggle, Voice narration, Close */}
        <div className="eora-cloud-topbar">
          {progress ? (
            <div className="eora-cloud-progress" aria-label={`Step ${progress.current} of ${progress.total}`}>
              <span className="eora-progress-badge">
                {isHinglish
                  ? `Kadam ${progress.current} / ${progress.total}`
                  : `Step ${progress.current} of ${progress.total}`}
              </span>
              <span className="eora-progress-title">
                {isHinglish
                  ? (progress.hinglishTitle || progress.title)
                  : progress.title}
              </span>
            </div>
          ) : (
            <div className="eora-cloud-brand">
              <Sparkles size={13} className="eora-sparkle-icon" aria-hidden="true" />
              <span>EORA Guide</span>
            </div>
          )}

          <div className="eora-cloud-actions">
            {/* Permanent Language Toggle Switch: English | Hinglish */}
            <div
              className="eora-lang-toggle"
              role="group"
              aria-label="Language selection"
              data-eora-id="eora-lang-toggle"
            >
              <button
                type="button"
                className={`eora-lang-btn ${!isHinglish ? "eora-lang-btn--active" : ""}`}
                onClick={() => onLanguageChange("english")}
                aria-pressed={!isHinglish}
                title="Switch to English"
              >
                EN
              </button>
              <button
                type="button"
                className={`eora-lang-btn ${isHinglish ? "eora-lang-btn--active" : ""}`}
                onClick={() => onLanguageChange("hinglish")}
                aria-pressed={isHinglish}
                title="Hinglish mein baat karein"
              >
                Hinglish
              </button>
            </div>

            {/* Optional Voice Narration Button */}
            <button
              type="button"
              className={`eora-voice-pill-btn ${isSpeaking ? "eora-voice-pill-btn--active" : ""}`}
              onClick={toggleVoice}
              aria-label={
                isSpeaking
                  ? (isHinglish ? "Awaaz band karein" : "Stop voice narration")
                  : (isHinglish ? "Bol kar sunayein" : "Speak instruction")
              }
              title={
                isSpeaking
                  ? (isHinglish ? "Awaaz rokein" : "Stop speaking")
                  : (isHinglish ? "Awaaz se sunein" : "Listen aloud")
              }
            >
              {isSpeaking ? (
                <VolumeX size={12} aria-hidden="true" />
              ) : (
                <Volume2 size={12} aria-hidden="true" />
              )}
              <span className="eora-voice-label">
                {isSpeaking
                  ? (isHinglish ? "Ruko" : "Stop")
                  : (isHinglish ? "Bolo" : "Speak")}
              </span>
            </button>

            {/* Close button */}
            {onClose && (
              <button
                type="button"
                className="eora-cloud-close-btn"
                onClick={onClose}
                aria-label={isHinglish ? "Band karein" : "Dismiss message"}
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Message instruction dialogue */}
        <div className="eora-cloud-content" role="status" aria-live="polite">
          <p className="eora-cloud-text">{text}</p>
        </div>

        {/* Optional Action CTA */}
        {actionLabel && (
          <div className="eora-cloud-cta-row">
            <button
              type="button"
              className="eora-cloud-cta-btn"
              onClick={handleAction}
            >
              <span>{actionLabel}</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Quick Replies / Suggestions */}
        {quickReplies && quickReplies.length > 0 && (
          <div className="eora-cloud-replies-row" role="listbox" aria-label="Suggested questions">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                className="eora-cloud-reply-chip"
                onClick={() => onQuickReplyClick?.(reply)}
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Bottom Tutorial Controls: Back, Repeat, Pause/Resume, Skip, Next, Exit */}
        {(onNext || onPrev || onRepeat || onPause || onSkip || onExit) && (
          <div className="eora-cloud-controls-bar">
            <div className="eora-cloud-ctrl-left">
              {onPrev && (
                <button
                  type="button"
                  className="eora-cloud-nav-btn"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  aria-label={isHinglish ? "Pichla kadam" : "Previous step"}
                >
                  <ChevronLeft size={13} aria-hidden="true" />
                  <span>{isHinglish ? HINGLISH_UI.backBtn : "Back"}</span>
                </button>
              )}

              {onRepeat && (
                <button
                  type="button"
                  className="eora-cloud-nav-btn"
                  onClick={onRepeat}
                  aria-label={isHinglish ? "Dobara sunein" : "Repeat instruction"}
                  title={isHinglish ? "Instruction repeat karein" : "Repeat"}
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>{isHinglish ? HINGLISH_UI.repeatBtn : "Repeat"}</span>
                </button>
              )}

              {onPause && (
                <button
                  type="button"
                  className="eora-cloud-nav-btn"
                  onClick={isPaused ? onResume : onPause}
                  aria-label={
                    isPaused
                      ? (isHinglish ? "Tour shuru karein" : "Resume tour")
                      : (isHinglish ? "Tour rokein" : "Pause tour")
                  }
                >
                  {isPaused ? (
                    <>
                      <Play size={12} aria-hidden="true" />
                      <span>{isHinglish ? HINGLISH_UI.resumeBtn : "Resume"}</span>
                    </>
                  ) : (
                    <>
                      <Pause size={12} aria-hidden="true" />
                      <span>{isHinglish ? HINGLISH_UI.pauseBtn : "Pause"}</span>
                    </>
                  )}
                </button>
              )}

              {canSkip && onSkip && (
                <button
                  type="button"
                  className="eora-cloud-nav-btn eora-cloud-nav-btn--skip"
                  onClick={onSkip}
                  aria-label={isHinglish ? "Yeh step chhodein" : "Skip step"}
                >
                  <span>{isHinglish ? HINGLISH_UI.skipBtn : "Skip"}</span>
                </button>
              )}
            </div>

            <div className="eora-cloud-ctrl-right">
              {onExit && (
                <button
                  type="button"
                  className="eora-cloud-nav-btn eora-cloud-nav-btn--exit"
                  onClick={onExit}
                  aria-label={isHinglish ? "Tour band karein" : "Exit tour"}
                >
                  <span>{isHinglish ? HINGLISH_UI.exitBtn : "Exit"}</span>
                </button>
              )}

              {onNext && (
                <button
                  type="button"
                  className="eora-cloud-primary-next-btn"
                  onClick={onNext}
                  aria-label={
                    !hasNext
                      ? (isHinglish ? "Tour pura karein" : "Finish tour")
                      : (isHinglish ? "Agla kadam" : "Next step")
                  }
                  data-eora-id="eora-cloud-next-btn"
                >
                  <span>
                    {!hasNext
                      ? (isHinglish ? HINGLISH_UI.finishBtn : "Finish")
                      : (isHinglish ? HINGLISH_UI.nextBtn : "Next")}
                  </span>
                  {!hasNext ? (
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cloud Directional Tail Indicator */}
      <div className={`eora-cloud-tail eora-cloud-tail--${tailDirection}`} aria-hidden="true" />
    </div>
  );
}
