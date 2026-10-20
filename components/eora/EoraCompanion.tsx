"use client";

/**
 * EORA outside onboarding (P4-13 rebuilt). She docks in a corner as a
 * launcher; guidance appears in a card beside the launcher, never flown on top
 * of page content. During a tour the target gets an outline ring and the card
 * moves to whichever corner does not cover it. On onboarding she lives inline
 * in the page flow instead (EoraGuideLine), so this renders nothing there.
 *
 * Free-form questions go to the grounded chat (/api/eora/chat); tour and
 * navigation commands stay on the zero-LLM engine (Tasks 1.4.1, 1.4.3).
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EioraVisual } from "./EioraVisual";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, ChatCircleText, MapTrifold, Minus, PaperPlaneRight, Pause, Play, SpeakerHigh, SpeakerSlash, X } from "@phosphor-icons/react/dist/ssr";
import { useEoraSafe } from "@/lib/client/eora/provider";
import { getPageContract } from "@/lib/eora/page-registry";
import { recognizeIntent } from "@/lib/eora/intent";
import { Portal } from "@/components/ui/Overlay";
import { Button, IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/client/cn";
import { EoraChat } from "./EoraChat";

const OPEN_CHAT = "eora:open-chat";

/** Opens the grounded chat from anywhere (e.g. the onboarding guide line). */
export function openEoraChat(seed?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT, { detail: { seed } }));
}

const TOUR_FOR_ROUTE: Record<string, string> = {
  "student-home": "student-home",
  "student-skills": "student-skills",
  "student-projects": "student-projects",
  "student-roadmap": "student-roadmap",
};

function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);
  const speak = useCallback((text: string, hinglish: boolean) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[✦💡✨•]/g, "").trim());
    u.lang = hinglish ? "hi-IN" : "en-IN";
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, []);
  useEffect(() => stop, [stop]);
  return { speaking, speak, stop };
}

/** The workspace's EORA control, rendered in the rail and the phone top bar. */
export function EoraLauncher({ compact }: { compact?: boolean }) {
  const eora = useEoraSafe();
  if (!eora) return null;
  const open = eora.isPanelOpen && !eora.isMinimized;
  const hasTip = Boolean(eora.currentMessage.text) && !eora.isPanelOpen && eora.preferences.assistanceMode !== "quiet";
  return (
    <button
      type="button"
      data-eora-id="eora-avatar-btn"
      aria-expanded={open}
      onClick={() => {
        if (!eora.isVisible) eora.restore();
        if (eora.isMinimized) eora.expand();
        if (eora.isPanelOpen) eora.closePanel(); else eora.openPanel();
      }}
      className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg text-sm transition-colors hover:bg-deep-espresso",
        compact ? "size-10 justify-center pointer-coarse:size-11" : "min-h-10 w-full px-3 text-text-muted hover:text-text-primary")}
      aria-label={compact ? `Ask EORA, your guide${hasTip ? " (new tip)" : ""}` : hasTip ? "Ask EORA (new tip)" : undefined}
    >
      <span className="relative size-6 shrink-0 overflow-hidden rounded-full border border-border-medium bg-bg-primary">
        <EioraVisual size={24} className="absolute inset-0" state={open ? "speaking" : eora.isMinimized ? "minimized" : "idle"} />
        {hasTip && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-obsidian bg-soft-amber" aria-hidden="true" />}
      </span>
      {!compact && <span>Ask EORA</span>}
    </button>
  );
}

export function EoraCompanion() {
  const pathname = usePathname() ?? "/";
  const eora = useEoraSafe();
  const [chat, setChat] = useState<{ open: boolean; seed: { text: string; nonce: number } | null }>({ open: false, seed: null });
  const [input, setInput] = useState("");
  const [corner, setCorner] = useState<"right" | "left">("right");
  const card = useRef<HTMLDivElement>(null);
  const speech = useSpeech();

  const hidden = pathname === "/" || pathname.startsWith("/onboarding");
  const inWorkspace = pathname.startsWith("/student");

  useEffect(() => {
    const onOpen = (e: Event) => {
      const seed = (e as CustomEvent<{ seed?: string }>).detail?.seed;
      setChat({ open: true, seed: seed ? { text: seed, nonce: Date.now() } : null });
    };
    window.addEventListener(OPEN_CHAT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT, onOpen);
  }, []);

  // The spotlight ring shows only during an explicit tour (globals in this file's style tag).
  const touring = Boolean(eora?.activeTour);
  useEffect(() => {
    const root = document.documentElement;
    if (touring) root.dataset.eoraTour = "on";
    else delete root.dataset.eoraTour;
    return () => { delete root.dataset.eoraTour; };
  }, [touring]);

  // Move the card to the other corner when it would cover the spotlighted target.
  const target = eora?.tourSpotlightTargetId;
  useLayoutEffect(() => {
    if (!target) { setCorner("right"); return; }
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>("[data-eora-spotlight='true']");
        const box = card.current?.getBoundingClientRect();
        if (!el || !box) return;
        const r = el.getBoundingClientRect();
        const w = box.width + 32;
        const overlapsRight = r.right > window.innerWidth - w && r.bottom > window.innerHeight - box.height - 120;
        setCorner(overlapsRight ? "left" : "right");
      });
    };
    check();
    window.addEventListener("scroll", check, true);
    window.addEventListener("resize", check);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", check, true); window.removeEventListener("resize", check); };
  }, [target]);

  if (!eora || hidden) {
    return chat.open ? <EoraChat open seed={chat.seed} onClose={() => setChat({ open: false, seed: null })} /> : null;
  }

  const hinglish = eora.preferences.language === "hinglish" || eora.preferences.language === "hi";
  const route = eora.context.route;
  const contract = getPageContract(route);
  const tourId = contract?.guidedTour?.tourId || TOUR_FOR_ROUTE[route];
  const message = eora.currentMessage.text;
  const quiet = eora.preferences.assistanceMode === "quiet";
  const tour = eora.activeTour;
  const task = eora.activeTask && eora.activeTaskDef ? { s: eora.activeTask, d: eora.activeTaskDef } : null;
  // In the workspace the card opens only on request (panel, tour, task); a new tip shows as a dot on the shell control instead of floating over content.
  const showCard = inWorkspace ? Boolean(tour || task || eora.isPanelOpen) : Boolean((message && !quiet) || tour || task || eora.isPanelOpen);

  const position = cn(
    "fixed z-[900] flex flex-col items-end gap-3",
    inWorkspace ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-5" : "bottom-[calc(env(safe-area-inset-bottom)+1rem)]",
    inWorkspace
      ? "right-3 sm:right-5 lg:right-auto lg:left-[16.25rem] lg:items-start"
      : corner === "right" ? "right-3 sm:right-5" : "left-3 sm:left-5 items-start",
  );

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const { intent } = recognizeIntent(text, pathname, eora.context);
    if (intent === "UNKNOWN_INTENT" || intent === "UNKNOWN") {
      setChat({ open: true, seed: { text, nonce: Date.now() } });
      eora.closePanel();
    } else {
      eora.handleUserMessage(text);
    }
    setInput("");
  };

  if (!eora.isVisible) {
    return (
      <Portal>
        <div className={position}>
          <button type="button" onClick={eora.restore} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border-medium bg-bg-elevated px-4 text-sm font-medium text-text-primary shadow-card hover:border-champagne/40">
            <ChatCircleText size={18} aria-hidden="true" className="text-soft-amber" />Ask EORA
          </button>
        </div>
        {chat.open && <EoraChat open seed={chat.seed} onClose={() => setChat({ open: false, seed: null })} />}
      </Portal>
    );
  }

  const progress = tour
    ? { n: eora.tourStepIndex + 1, total: tour.steps.length, title: (hinglish ? tour.steps[eora.tourStepIndex]?.hinglishTitle : undefined) ?? tour.steps[eora.tourStepIndex]?.title }
    : task ? { n: task.s.currentStepIndex + 1, total: task.d.steps.length, title: task.d.title } : null;

  return (
    <Portal>
      <style>{`:root[data-eora-tour="on"] [data-eora-spotlight="true"] { outline: 2px solid var(--soft-amber); outline-offset: 4px; border-radius: 8px; transition: outline-color 150ms; }`}</style>
      <div className={position} data-eora-id="eora-floating-companion" data-eora-language={hinglish ? "hinglish" : "english"} data-eiora-state={speech.speaking ? "speaking" : (tour || task) ? "extracting" : eora.isMinimized ? "minimized" : "idle"}>
        {showCard && !eora.isMinimized && (
          <div
            ref={card}
            role={eora.isPanelOpen ? "dialog" : "region"}
            aria-modal={eora.isPanelOpen ? false : undefined}
            aria-label="EORA, your guide"
            onKeyDown={(e) => { if (e.key === "Escape") { if (eora.isPanelOpen) eora.closePanel(); else eora.clearMessage(); } }}
            className="w-[min(22rem,calc(100vw-1.5rem))] animate-[rise-in_180ms_var(--ease-soft)] rounded-card border border-border-medium bg-bg-elevated shadow-card"
          >
            <div className="flex items-center gap-2 border-b border-border-medium px-3.5 py-2.5">
              <span className="font-display text-sm font-medium text-text-primary">EORA</span>
              {progress && <span className="font-mono text-2xs text-text-muted tabular" aria-label={`Step ${progress.n} of ${progress.total}`}>{progress.n}/{progress.total}</span>}
              <span role="group" aria-label="EORA language" className="ml-auto inline-flex rounded-md border border-border-medium">
                {(["english", "hinglish"] as const).map((l) => (
                  <button key={l} type="button" aria-pressed={(l === "hinglish") === hinglish} onClick={() => eora.setLanguage(l)}
                    className={cn("min-h-7 cursor-pointer px-1.5 text-2xs pointer-coarse:min-h-9 transition-colors", (l === "hinglish") === hinglish ? "bg-deep-espresso text-text-primary font-medium" : "text-text-muted hover:text-text-primary")}>
                    {l === "english" ? "EN" : "Hinglish"}
                  </button>
                ))}
              </span>
              {message && "speechSynthesis" in (typeof window !== "undefined" ? window : {}) && (
                <IconButton label={speech.speaking ? "Stop reading aloud" : "Read aloud"} className="size-8 pointer-coarse:size-10" onClick={() => (speech.speaking ? speech.stop() : speech.speak(message, hinglish))}>
                  {speech.speaking ? <SpeakerSlash size={16} aria-hidden="true" /> : <SpeakerHigh size={16} aria-hidden="true" />}
                </IconButton>
              )}
              <IconButton label="Close" className="size-8 pointer-coarse:size-10" onClick={() => { speech.stop(); if (tour) eora.exitTour(); else if (task) eora.cancelTask(); else if (eora.isPanelOpen) eora.closePanel(); else eora.clearMessage(); }}>
                <X size={16} aria-hidden="true" />
              </IconButton>
            </div>

            <div className="flex max-h-[min(60dvh,26rem)] flex-col gap-3 overflow-y-auto px-3.5 py-3">
              {progress?.title && <p className="text-xs font-medium text-text-muted">{progress.title}</p>}
              {message && <p aria-live="polite" className="text-sm text-text-primary">{message}</p>}
              {eora.currentMessage.actionLabel && eora.currentMessage.actionUrl && (
                <Button size="sm" variant="primary" className="self-start" onClick={() => window.location.assign(eora.currentMessage.actionUrl!)}>{eora.currentMessage.actionLabel}</Button>
              )}
              {eora.clarifyingOptions?.length ? (
                <div className="flex flex-wrap gap-1.5" aria-label="Choose what you need">
                  {eora.clarifyingOptions.map((o) => <Button key={o} size="sm" variant="secondary" onClick={() => eora.handleClarifyingChoice(o)}>{o}</Button>)}
                </div>
              ) : null}

              {(tour || task) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="ghost" icon={<ArrowLeft size={16} aria-hidden="true" />}
                    disabled={tour ? eora.tourStepIndex === 0 : task ? task.s.currentStepIndex === 0 : true}
                    onClick={tour ? eora.prevTourStep : eora.rewindTask}>Back</Button>
                  {tour && (eora.tourPaused
                    ? <IconButton label="Resume tour" onClick={eora.resumeTour}><Play size={16} aria-hidden="true" /></IconButton>
                    : <IconButton label="Pause tour" onClick={eora.pauseTour}><Pause size={16} aria-hidden="true" /></IconButton>)}
                  <Button size="sm" variant="primary" className="ml-auto"
                    onClick={tour ? (eora.tourPaused ? eora.resumeTour : eora.nextTourStep) : eora.advanceTask}>
                    {(tour && eora.tourStepIndex >= tour.steps.length - 1) || (task && task.s.currentStepIndex >= task.d.steps.length - 1) ? "Finish" : "Next"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </div>
              )}

              {eora.isPanelOpen && (
                <>
                  {contract && <p className="text-xs text-text-muted"><span className="font-medium text-text-primary">{contract.pageTitle}.</span> {contract.pagePurpose}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {tourId && <Button size="sm" variant="secondary" icon={<MapTrifold size={16} aria-hidden="true" />} onClick={() => eora.startTour(tourId)}>Tour this page</Button>}
                    <Button size="sm" variant="ghost" onClick={() => eora.handleUserMessage(hinglish ? "Ab aage kya?" : "What's next?")}>{hinglish ? "Ab aage kya?" : "What's next?"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => eora.handleUserMessage(hinglish ? "Mujhe guide karo" : "Guide me")}>{hinglish ? "Mujhe guide karo" : "Guide me"}</Button>
                  </div>
                  <form onSubmit={ask} className="flex items-center gap-2">
                    <label htmlFor="eora-ask" className="sr-only">Ask EORA</label>
                    <input id="eora-ask" value={input} onChange={(e) => setInput(e.target.value.slice(0, 500))} autoComplete="off" data-autofocus
                      placeholder={hinglish ? "EORA se kuch bhi puchiye…" : "Ask about your skills or next step…"}
                      className="min-h-10 min-w-0 flex-1 rounded-lg border border-border-medium bg-bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-champagne focus-visible:outline-none pointer-coarse:min-h-11" />
                    <IconButton label="Send" variant="secondary" type="submit" disabled={!input.trim()}><PaperPlaneRight size={16} aria-hidden="true" /></IconButton>
                  </form>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border-medium pt-2 text-2xs text-text-muted">
                    <button type="button" className="cursor-pointer hover:text-text-primary" onClick={() => eora.snooze(60)}>Quiet for 1 hour</button>
                    <button type="button" className="cursor-pointer hover:text-text-primary" onClick={() => eora.updatePreferences({ assistanceMode: quiet ? "balanced" : "quiet" })}>
                      {quiet ? "Show tips again" : "Fewer tips"}
                    </button>
                    <button type="button" className="cursor-pointer hover:text-text-primary" onClick={eora.resetAllPreferences}>Reset EORA</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className={cn("flex items-center gap-1.5", inWorkspace && "hidden")}>
          {showCard && !eora.isMinimized && (
            <IconButton label="Minimise EORA" variant="secondary" className="size-9 rounded-full bg-bg-elevated border border-border-medium pointer-coarse:size-11" onClick={eora.minimize}>
              <Minus size={16} aria-hidden="true" />
            </IconButton>
          )}
          <button
            type="button"
            data-eora-id="eora-avatar-btn"
            aria-expanded={eora.isPanelOpen}
            aria-label={eora.isPanelOpen ? "Close EORA" : "Open EORA, your guide"}
            onClick={() => {
              if (eora.isMinimized) { eora.expand(); return; }
              if (eora.isPanelOpen) eora.closePanel(); else eora.openPanel();
            }}
            className="relative size-12 cursor-pointer overflow-hidden rounded-full border border-champagne/40 bg-deep-espresso shadow-[0_0_16px_rgba(196,138,90,0.25)] transition-transform duration-150 active:scale-95"
          >
            <EioraVisual size={48} className="absolute inset-0" state={speech.speaking ? "speaking" : (tour || task) ? "extracting" : eora.isMinimized ? "minimized" : "idle"} />
            {eora.isMinimized && message && <span className="absolute right-1 top-1 size-2.5 rounded-full border-2 border-deep-espresso bg-soft-amber" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {chat.open && <EoraChat open seed={chat.seed} onClose={() => setChat({ open: false, seed: null })} />}
    </Portal>
  );
}
