"use client";

/**
 * EORA inside the onboarding page flow (P4-13). Her step guidance is part of
 * the layout, under the step heading, so it can never cover the heading or a
 * control. Collapsing is remembered on this device.
 */
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { CaretDown, ChatCircleText } from "@phosphor-icons/react/dist/ssr";
import { useEoraSafe } from "@/lib/client/eora/provider";
import { cn } from "@/lib/client/cn";

const KEY = "tathastu-eora-guide-collapsed";

export function EoraGuideLine({ fallback, onAsk }: { fallback?: string; onAsk?: () => void }) {
  const eora = useEoraSafe();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(KEY) === "1"); } catch { /* storage blocked: stay open */ }
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(KEY, c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };

  const text = eora?.currentMessage.text || fallback;
  if (!text) return null;
  const hinglish = eora?.preferences.language === "hinglish" || eora?.preferences.language === "hi";

  return (
    <aside aria-label="EORA, your guide" className="rounded-card border border-line-soft bg-bg-surface shadow-card transition-all">
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="relative mt-0.5 size-9 shrink-0 overflow-hidden rounded-full border border-accent-warm/40 bg-bg-primary shadow-[0_0_12px_rgba(244,154,71,0.3)]">
          <Image src="/assets/eora/avatar.png" alt="" fill sizes="36px" className="object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs text-text-muted">
            <span className="font-bold text-accent-warm">EORA</span>
            {eora && (
              <span role="group" aria-label="EORA language" className="inline-flex rounded-full border border-border-subtle bg-bg-primary/50 p-0.5">
                {(["english", "hinglish"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    aria-pressed={lang === "hinglish" ? hinglish : !hinglish}
                    onClick={() => eora.setLanguage(lang)}
                    className={cn(
                      "min-h-6 cursor-pointer rounded-full px-2 text-2xs font-medium transition-colors pointer-coarse:min-h-8",
                      (lang === "hinglish") === hinglish ? "bg-accent-warm text-obsidian font-bold shadow-sm" : "text-text-muted hover:text-warm-ivory",
                    )}
                  >
                    {lang === "english" ? "EN" : "Hinglish"}
                  </button>
                ))}
              </span>
            )}
          </p>
          <p aria-live="polite" className={cn("mt-1.5 text-sm text-warm-ivory leading-relaxed", collapsed && "sr-only")}>{text}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onAsk && (
            <button type="button" onClick={onAsk} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-soft-amber hover:bg-soft-amber/10 pointer-coarse:min-h-11 transition-colors">
              <ChatCircleText size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Ask</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Show EORA's tip" : "Hide EORA's tip"}
            className="grid size-9 cursor-pointer place-items-center rounded-md text-text-muted hover:bg-deep-espresso hover:text-warm-ivory pointer-coarse:size-11 transition-colors"
          >
            <CaretDown size={16} aria-hidden="true" className={cn("transition-transform duration-150", collapsed && "-rotate-90")} />
          </button>
        </div>
      </div>
    </aside>
  );
}
