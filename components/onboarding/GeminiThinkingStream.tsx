"use client";

import React, { useEffect, useState } from "react";

const STAGES = [
  "Preparing selected sources for review…",
  "Collecting public repository and project signals…",
  "Organising coding-profile and skill evidence…",
  "Grouping research identifiers and notebook links…",
  "Preparing the profile review queue…",
] as const;

/**
 * Small, clearly-labelled animation used as ambient guidance next to the
 * real SourceProgress component. It is not a connector status feed; provider
 * progress and errors continue to come from SourceProgress itself.
 */
export function GeminiThinkingStream() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % STAGES.length), 2800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <aside className="at-thinking-stream" aria-label="Import pipeline overview">
      <div className="at-thinking-orb" aria-hidden="true"><i /><i /><i /></div>
      <div className="at-thinking-copy">
        <div className="at-thinking-topline"><span className="at-thinking-live-dot" /> EIORA / PIPELINE OVERVIEW</div>
        <p key={index} className="at-thinking-stage"><span aria-hidden="true">&gt;</span> {STAGES[index]}</p>
        <p className="at-thinking-footnote">Illustrative sequence · actual provider status is shown above.</p>
      </div>
      <div className="at-thinking-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
    </aside>
  );
}
