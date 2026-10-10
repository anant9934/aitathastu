"use client";

/**
 * EORA FLOATING COMPANION — VERSION 8.1 (Phase 8.1)
 * Clash of Clans–Inspired Interactive Tutorial Companion:
 * - Spatial movement to real DOM elements with soft spotlight
 * - Attached cartoon-style Speech Cloud & Thought Cloud
 * - Permanent English | Hinglish language switch
 * - Step progress indicator ("Step 2 of 5")
 * - User-controlled optional voice narration (browser SpeechSynthesis, off by default)
 * - Playful avatar "Boop!" reaction
 * - Keyboard accessible (Tab/Enter/Escape)
 * - Mobile safe-area collision avoidance
 * - Respects prefers-reduced-motion
 * - Zero routine LLM calls
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
  Languages,
  MessageSquare,
} from "lucide-react";
import { useEoraSafe } from "./eora-provider";
import { EoraSpeechBubble } from "./eora-speech-bubble";
import { EoraSpeechCloud } from "./eora-speech-cloud";
import { getEoraAsset } from "@/lib/eora/avatar-registry";
import { EoraMotionAvatar } from "./eora-motion-avatar";
import { getPageContract } from "@/lib/eora/page-registry";
import { getPrimaryTaskForRoute } from "@/lib/eora/tasks";

type Placement = "bottom-right" | "bottom-left" | "top-right" | "top-left";

interface SpatialCoords {
  x: number;
  y: number;
  tail: "left" | "right" | "top" | "bottom";
  active: boolean;
}

export function EoraFloatingCompanion() {
  const eora = useEoraSafe();
  const [inputText, setInputText] = useState("");
  const [placement, setPlacement] = useState<Placement>("bottom-right");
  const [spatialCoords, setSpatialCoords] = useState<SpatialCoords>({
    x: 0,
    y: 0,
    tail: "left",
    active: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isHinglish =
    eora?.preferences.language === "hinglish" || eora?.preferences.language === "hi";

  // Explicitly sync data-eora-language attribute on containerRef DOM element
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.setAttribute(
        "data-eora-language",
        isHinglish ? "hinglish" : "english"
      );
    }
  }, [isHinglish]);

  // ── Keyboard: Escape closes panel / clouds ───────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (eora?.isPanelOpen) {
          eora.closePanel();
        } else if (eora?.currentMessage.text) {
          eora.clearMessage();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [eora?.isPanelOpen, eora?.closePanel, eora?.currentMessage.text, eora?.clearMessage]);

  // ── Track user typing focus globally to suppress nudges ──────────────────
  useEffect(() => {
    if (!eora) return;
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      const isEoraInput = containerRef.current?.contains(target);
      if (isInput && !isEoraInput) {
        eora.setUserFocused(true);
        const field = target as HTMLInputElement;
        const label =
          field.labels?.[0]?.textContent?.trim() ||
          field.getAttribute("aria-label") ||
          field.getAttribute("placeholder") ||
          "this field";
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

  // ── Resting edge placement scoring (when not spatially anchored) ──────────
  useEffect(() => {
    if (!eora?.isVisible || eora.isPanelOpen) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const trigger = containerRef.current
          ?.querySelector<HTMLElement>(".eora-avatar-trigger")
          ?.getBoundingClientRect();
        const triggerWidth = trigger?.width || (width <= 480 ? 58 : 72);
        const triggerHeight = trigger?.height || (width <= 480 ? 58 : 72);
        const edge = width <= 340 ? 8 : width <= 480 ? 12 : width <= 768 ? 16 : 24;
        const bottom = width <= 340 ? 68 : width <= 480 ? 72 : 24;
        const candidates: Placement[] = [
          "bottom-right",
          "bottom-left",
          "top-right",
          "top-left",
        ];
        const controls = Array.from(
          document.querySelectorAll<HTMLElement>(
            "button, input, textarea, select, a, [role='button']"
          )
        ).filter(
          (el) => !containerRef.current?.contains(el) && el.getClientRects().length > 0
        );
        const scored = candidates.map((candidate, index) => {
          const left = candidate.endsWith("right") ? width - triggerWidth - edge : edge;
          const top = candidate.startsWith("bottom") ? height - bottom - triggerHeight : 82;
          const box = {
            left: left - 6,
            top: top - 6,
            right: left + triggerWidth + 6,
            bottom: top + triggerHeight + 6,
          };
          const collisions = controls.reduce((count, control) => {
            const r = control.getBoundingClientRect();
            return (
              count +
              (r.left < box.right &&
              r.right > box.left &&
              r.top < box.bottom &&
              r.bottom > box.top
                ? 1
                : 0)
            );
          }, 0);
          return { candidate, score: collisions * 100 + index };
        });
        scored.sort((a, b) => a.score - b.score);
        setPlacement((current) =>
          current === scored[0].candidate ? current : scored[0].candidate
        );
      });
    };
    update();
    const observer = new MutationObserver((mutations) => {
      if (
        mutations.some((mutation) => !containerRef.current?.contains(mutation.target))
      )
        update();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [eora?.isVisible, eora?.isPanelOpen, eora?.onboardingStep, eora?.context.route]);

  // ── SPATIAL MOVEMENT ENGINE — CLASH OF CLANS CHARACTER GUIDANCE ───────────
  useEffect(() => {
    const targetId = eora?.tourSpotlightTargetId;
    if (!targetId) {
      setSpatialCoords((prev) => (prev.active ? { ...prev, active: false } : prev));
      return;
    }

    let frame = 0;
    const calculateSpatialPosition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const currentTargetId = eora?.tourSpotlightTargetId;
        if (!currentTargetId) {
          setSpatialCoords((prev) => (prev.active ? { ...prev, active: false } : prev));
          return;
        }

        const el =
          document.getElementById(currentTargetId) ||
          document.querySelector(`[data-eora-id="${currentTargetId}"]`);

        if (!el) {
          setSpatialCoords((prev) => (prev.active ? { ...prev, active: false } : prev));
          return;
        }

        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const isMobile = vw <= 768;
        const companionW = isMobile ? 310 : 380;
        const companionH = isMobile ? 220 : 260;

        if (!isMobile) {
          // Desktop: prefer placing to the right, fallback to left or top/bottom
          if (rect.right + companionW + 24 <= vw) {
            const x = rect.right + 18;
            const y = Math.max(76, Math.min(vh - companionH - 24, rect.top - 20));
            setSpatialCoords({ x, y, tail: "left", active: true });
          } else if (rect.left - companionW - 24 >= 0) {
            const x = rect.left - companionW - 18;
            const y = Math.max(76, Math.min(vh - companionH - 24, rect.top - 20));
            setSpatialCoords({ x, y, tail: "right", active: true });
          } else if (rect.bottom + companionH + 20 <= vh) {
            const x = Math.max(16, Math.min(vw - companionW - 16, rect.left));
            const y = rect.bottom + 14;
            setSpatialCoords({ x, y, tail: "top", active: true });
          } else {
            const x = Math.max(16, Math.min(vw - companionW - 16, rect.left));
            const y = Math.max(76, rect.top - companionH - 14);
            setSpatialCoords({ x, y, tail: "bottom", active: true });
          }
        } else {
          // Mobile: prefer placing below or above so the target element is NEVER obscured
          if (rect.bottom + companionH + 30 <= vh) {
            const x = Math.max(12, Math.min(vw - companionW - 12, rect.left - 10));
            const y = rect.bottom + 12;
            setSpatialCoords({ x, y, tail: "top", active: true });
          } else if (rect.top - companionH - 14 >= 64) {
            const x = Math.max(12, Math.min(vw - companionW - 12, rect.left - 10));
            const y = Math.max(68, rect.top - companionH - 12);
            setSpatialCoords({ x, y, tail: "bottom", active: true });
          } else {
            const x = Math.max(12, vw - companionW - 12);
            const y = Math.max(68, vh - companionH - 72);
            setSpatialCoords({ x, y, tail: "bottom", active: true });
          }
        }
      });
    };

    calculateSpatialPosition();
    window.addEventListener("scroll", calculateSpatialPosition, true);
    window.addEventListener("resize", calculateSpatialPosition);

    const observer = new MutationObserver(calculateSpatialPosition);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", calculateSpatialPosition, true);
      window.removeEventListener("resize", calculateSpatialPosition);
      observer.disconnect();
    };
  }, [eora?.tourSpotlightTargetId]);

  // Keep panel open during active interactive tasks or tours
  useEffect(() => {
    if (!eora?.isPanelOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (eora.activeTask || eora.activeTour) return;
      if (!containerRef.current?.contains(event.target as Node)) eora.closePanel();
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [eora?.isPanelOpen, eora?.closePanel, eora?.activeTask, eora?.activeTour]);

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

  // Playful avatar "Boop!" user reaction
  const handleAvatarBoop = () => {
    if (!eora) return;
    if (eora.isPanelOpen) {
      eora.closePanel();
    }
    if (eora.activeTour || eora.activeTask) {
      // Repeat the current instruction during an active tour
      eora.handleUserMessage("repeat");
      return;
    }
    eora.boop();
  };

  // ── Not initialized ────────────────────────────────────────────────────────
  if (!eora) return null;

  // ── Dismissed — minimal restore ───────────────────────────────────────────
  if (!eora.isVisible) {
    return (
      <div className="eora-restore-wrapper" aria-label="EORA companion">
        <button
          type="button"
          className="eora-restore-btn"
          onClick={eora.restore}
          aria-label="Bring back EORA companion"
          data-eora-id="eora-restore-btn"
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>Ask EORA</span>
        </button>
      </div>
    );
  }

  const pose = (eora.currentPose as Parameters<typeof getEoraAsset>[0]) ?? "avatar";
  const asset = getEoraAsset(pose);
  const reducedMotion = eora.preferences.reducedMotion;
  const motionPaused =
    reducedMotion ||
    eora.context.userIsFocused ||
    eora.preferences.assistanceMode === "quiet";

  // ── Minimized state ───────────────────────────────────────────────────────
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
          <Image
            src={getEoraAsset("avatar").src}
            alt=""
            width={48}
            height={48}
            className="eora-avatar-mini-img"
          />
        </button>
      </div>
    );
  }

  const route = eora.context.route;
  const pageContract = getPageContract(route);
  const primaryTask = getPrimaryTaskForRoute(route);
  const isStudentArea = route.startsWith("student");
  const isOnboarding = route === "onboarding";

  const tourIdForRoute: Record<string, string> = {
    "student-home": "student-home",
    "student-skills": "student-skills",
    "student-projects": "student-projects",
    "student-roadmap": "student-roadmap",
    onboarding: "onboarding-welcome",
  };
  const activeTourId = pageContract?.guidedTour?.tourId || tourIdForRoute[route];
  const tourAvailable = Boolean(activeTourId);

  // Is EORA currently actively guiding the user through a tour, task, or dialogue?
  const isGuidanceActive = Boolean(
    eora.activeTour ||
      eora.activeTask ||
      eora.tourSpotlightTargetId ||
      eora.currentMessage.text ||
      eora.context.student.isProcessing ||
      eora.context.processingState
  );

  const isSpatiallyAnchored = spatialCoords.active && Boolean(eora.tourSpotlightTargetId);

  // Compute spatial styling when anchored to real DOM target
  const spatialContainerStyle: React.CSSProperties = isSpatiallyAnchored
    ? {
        position: "fixed",
        left: `${spatialCoords.x}px`,
        top: `${spatialCoords.y}px`,
        bottom: "auto",
        right: "auto",
        transform: "none",
        transition: reducedMotion
          ? "none"
          : "left 0.4s cubic-bezier(0.16, 1, 0.3, 1), top 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        zIndex: 10005,
      }
    : {};

  // Progress metadata for active tour or task
  const progressData = eora.activeTour
    ? {
        current: eora.tourStepIndex + 1,
        total: eora.activeTour.steps.length,
        title: eora.activeTour.steps[eora.tourStepIndex]?.title || "Tour Step",
        hinglishTitle:
          eora.activeTour.steps[eora.tourStepIndex]?.hinglishTitle ||
          eora.activeTour.steps[eora.tourStepIndex]?.title,
      }
    : eora.activeTask && eora.activeTaskDef
    ? {
        current: eora.activeTask.currentStepIndex + 1,
        total: eora.activeTaskDef.steps.length,
        title: eora.activeTaskDef.title,
        hinglishTitle: eora.activeTaskDef.title,
      }
    : null;

  return (
    <div
      className={`eora-floating-root eora-place-${placement} ${
        isSpatiallyAnchored ? "eora-floating-root--spatial" : ""
      } ${eora.isPanelOpen ? "eora-panel-open" : ""} ${
        motionPaused ? "eora-no-motion" : ""
      }`}
      style={spatialContainerStyle}
      ref={containerRef}
      data-eora-id="eora-floating-companion"
      data-eora-route={route}
      data-eora-language={isHinglish ? "hinglish" : "english"}
      aria-label="EORA AI Companion"
    >
      {/* ── AVATAR + CONNECTED SPEECH CLOUD ROW ────────────────────────── */}
      <div className="eora-floating-row">
        {/* Avatar trigger button with Boop click reaction */}
        <div className="eora-avatar-wrapper">
          <button
            type="button"
            className={`eora-avatar-trigger eora-avatar-trigger--full ${
              eora.isPanelOpen ? "eora-avatar-trigger--active" : ""
            }`}
            onClick={() => {
              if (eora.isPanelOpen) {
                eora.closePanel();
              }
              handleAvatarBoop();
            }}
            aria-label={`EORA Avatar — ${isHinglish ? "Madad ke liye click karein" : "Click for guidance"}`}
            title={isHinglish ? "EORA se baat karein" : "Talk with EORA"}
            data-eora-id="eora-avatar-btn"
          >
            <EoraMotionAvatar
              pose={asset.pose}
              state={eora.animationState}
              reducedMotion={motionPaused}
            />
            <span className="eora-avatar-badge" aria-hidden="true">
              <Sparkles size={10} />
            </span>
            {pageContract && (
              <span className="eora-page-badge sr-only" data-page-id={pageContract.pageId}>
                {pageContract.pageTitle}
              </span>
            )}
          </button>

          {/* Quick controls row (when expanded or guiding) */}
          <div className="eora-ctrl-row" aria-label="EORA quick controls">
            {/* Permanent language switch pill in compact view */}
            <div
              className="eora-lang-toggle"
              role="group"
              aria-label="Language selection"
              data-eora-id="eora-lang-switch"
            >
              <button
                type="button"
                className={`eora-lang-btn ${!isHinglish ? "eora-lang-btn--active" : ""}`}
                onClick={() => eora.setLanguage("english")}
                title="Switch to English"
              >
                EN
              </button>
              <button
                type="button"
                className={`eora-lang-btn ${isHinglish ? "eora-lang-btn--active" : ""}`}
                onClick={() => eora.setLanguage("hinglish")}
                title="Hinglish mein baat karein"
              >
                Hinglish
              </button>
            </div>

            <button
              type="button"
              className={`eora-ctrl-btn ${eora.isPanelOpen ? "eora-ctrl-btn--active" : ""}`}
              onClick={() => {
                if (eora.isPanelOpen) {
                  eora.closePanel();
                } else {
                  eora.openPanel();
                }
              }}
              aria-label={eora.isPanelOpen ? "Close Q&A Panel" : "Open Q&A Panel"}
              data-eora-id="eora-open-panel-btn"
              title={isHinglish ? "Poochhein ya Guide Maangein" : "Ask or Chat with EORA"}
            >
              <MessageSquare size={12} aria-hidden="true" />
            </button>
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
              className="eora-ctrl-btn eora-ctrl-btn--dismiss"
              onClick={eora.dismiss}
              aria-label="Close EORA"
              title="Dismiss"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── CLASH OF CLANS–INSPIRED CONNECTED SPEECH CLOUD ──────────────── */}
        {isGuidanceActive && !eora.isPanelOpen && (
          <EoraSpeechCloud
            text={eora.currentMessage.text}
            isProcessing={Boolean(
              eora.context.student.isProcessing || eora.context.processingState
            )}
            processingMessage={eora.context.processingState ?? undefined}
            language={isHinglish ? "hinglish" : "english"}
            onLanguageChange={eora.setLanguage}
            progress={progressData}
            onNext={
              eora.activeTour
                ? eora.tourPaused
                  ? eora.resumeTour
                  : eora.nextTourStep
                : eora.activeTask
                ? eora.advanceTask
                : undefined
            }
            onPrev={
              eora.activeTour
                ? eora.prevTourStep
                : eora.activeTask
                ? eora.rewindTask
                : undefined
            }
            onRepeat={() => eora.handleUserMessage("repeat")}
            onPause={
              eora.activeTour
                ? eora.pauseTour
                : eora.activeTask
                ? eora.pauseTask
                : undefined
            }
            onResume={
              eora.activeTour
                ? eora.resumeTour
                : eora.activeTask
                ? eora.resumeTask
                : undefined
            }
            onSkip={() => eora.handleUserMessage("skip")}
            onExit={
              eora.activeTour
                ? eora.exitTour
                : eora.activeTask
                ? eora.cancelTask
                : undefined
            }
            isPaused={
              eora.activeTour
                ? eora.tourPaused
                : eora.activeTask?.state === "PAUSED"
            }
            hasNext={
              eora.activeTour
                ? eora.tourStepIndex < eora.activeTour.steps.length - 1
                : eora.activeTask && eora.activeTaskDef
                ? eora.activeTask.currentStepIndex < eora.activeTaskDef.steps.length - 1
                : false
            }
            hasPrev={
              eora.activeTour
                ? eora.tourStepIndex > 0
                : eora.activeTask
                ? eora.activeTask.currentStepIndex > 0
                : false
            }
            canSkip={Boolean(eora.activeTour || eora.activeTask)}
            actionLabel={eora.currentMessage.actionLabel}
            actionUrl={eora.currentMessage.actionUrl}
            onActionClick={(url) => {
              window.location.assign(url);
            }}
            quickReplies={eora.clarifyingOptions}
            onQuickReplyClick={handleClarifyChoice}
            onClose={eora.clearMessage}
            tailDirection={isSpatiallyAnchored ? spatialCoords.tail : "left"}
            reducedMotion={reducedMotion}
          />
        )}
      </div>

      {/* ── EXPANDED FULL PANEL (for manual Q&A exploration) ──────────────── */}
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
              {/* Permanent language switch pill in panel header */}
              <div
                className="eora-lang-toggle"
                role="group"
                aria-label="Language selection"
              >
                <button
                  type="button"
                  className={`eora-lang-btn ${!isHinglish ? "eora-lang-btn--active" : ""}`}
                  onClick={() => eora.setLanguage("english")}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={`eora-lang-btn ${isHinglish ? "eora-lang-btn--active" : ""}`}
                  onClick={() => eora.setLanguage("hinglish")}
                >
                  Hinglish
                </button>
              </div>

              {tourAvailable && (
                <button
                  type="button"
                  className="eora-panel-btn"
                  onClick={() => {
                    if (activeTourId) eora.startTour(activeTourId);
                  }}
                  title={isHinglish ? "Page ka tour shuru karein" : "Start page tour"}
                  aria-label="Start a guided tour of this page"
                  data-eora-id="eora-panel-tour-btn"
                >
                  <MapPin size={13} aria-hidden="true" />
                  <span>{isHinglish ? "Tour" : "Tour"}</span>
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
              <div
                style={{
                  fontWeight: 700,
                  color: "#38bdf8",
                  marginBottom: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Sparkles size={11} />
                <span>{pageContract.pageTitle}</span>
              </div>
              <p style={{ margin: 0, opacity: 0.9 }}>{pageContract.pagePurpose}</p>
            </div>
          )}

          {/* Current message */}
          {eora.currentMessage.text && (
            <EoraSpeechBubble
              text={eora.currentMessage.text}
              actionLabel={eora.currentMessage.actionLabel}
              actionUrl={eora.currentMessage.actionUrl}
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
            <div
              className="eora-clarifying-options"
              role="listbox"
              aria-label="Choose what you need"
            >
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

          {/* Quick Actions */}
          <div className="eora-quick-actions">
            {tourAvailable && (
              <button
                type="button"
                className="eora-quick-btn"
                style={{
                  background: "rgba(86, 66, 239, 0.25)",
                  borderColor: "rgba(86, 66, 239, 0.5)",
                  color: "#c4b5fd",
                  fontWeight: 700,
                }}
                onClick={() => {
                  if (activeTourId) eora.startTour(activeTourId);
                }}
                data-eora-id="eora-quick-tour-btn"
              >
                🗺️ {isHinglish ? "Tour karao" : "Tour this page"}
              </button>
            )}
            <button
              type="button"
              className="eora-quick-btn"
              onClick={() =>
                eora.handleUserMessage(
                  isHinglish ? "Pura website tour karao" : "Explore AI Tathastu"
                )
              }
              data-eora-id="eora-quick-full-tour-btn"
            >
              🌐 {isHinglish ? "Pura website tour" : "Explore website"}
            </button>
            <button
              type="button"
              className="eora-quick-btn"
              onClick={() =>
                eora.handleUserMessage(isHinglish ? "Mujhe guide karo" : "Guide me")
              }
            >
              {isHinglish ? "Mujhe guide karo" : "Guide me"}
            </button>
            <button
              type="button"
              className="eora-quick-btn"
              onClick={() =>
                eora.handleUserMessage(isHinglish ? "Ab aage kya?" : "What's next?")
              }
            >
              {isHinglish ? "Ab aage kya?" : "What's next?"}
            </button>
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
              placeholder={
                isHinglish ? "EORA se kuch bhi puchiye..." : "Ask EORA anything..."
              }
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
              onClick={eora.toggleLanguage}
              title="Toggle language"
            >
              <Languages size={11} aria-hidden="true" />
              <span>{isHinglish ? "English" : "Hinglish"}</span>
            </button>
            <button
              type="button"
              className="eora-footer-link"
              onClick={() => eora.snooze(60)}
            >
              {isHinglish ? "1h Ruko" : "Snooze 1h"}
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

      {/* ── CELEBRATION OVERLAY ─────────────────────────────────────────── */}
      {eora.showCelebration && !motionPaused && (
        <span className="eora-tiny-sparkle" aria-hidden="true">
          ✦
        </span>
      )}
    </div>
  );
}
