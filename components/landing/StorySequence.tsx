"use client";

/**
 * A once-per-tab editorial introduction. It is deliberately isolated from the
 * app's data flow: this sequence never calls APIs or mutates onboarding state.
 * Visitors can skip it at any time; reduced-motion users get a short static
 * preview instead of a timed animation.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";

const DURATION_MS = 75_000;
const SEEN_KEY = "at-story-intro-seen";

const SCENES = [
  {
    range: "00:00 — 00:08",
    eyebrow: "A quieter kind of intelligence",
    title: "Every beginning is a signal.",
    copy: "One idea. A thousand fragments of work waiting to become a story.",
  },
  {
    range: "00:08 — 00:20",
    eyebrow: "Meet your guide",
    title: "Your story, brought home.",
    copy: "Your digital footprint is scattered across a dozen worlds. Let’s bring your story home.",
  },
  {
    range: "00:20 — 00:38",
    eyebrow: "The evidence comes together",
    title: "Not a claim. A clearer picture.",
    copy: "Bring your CV, projects, research and public profiles together. Review every finding before it becomes part of your profile.",
  },
  {
    range: "00:38 — 00:58",
    eyebrow: "Five connected worlds",
    title: "One profile. More ways forward.",
    copy: "Find opportunities, collaborators, learning paths, meeting spaces and assessments in one connected workspace.",
  },
  {
    range: "00:58 — 01:15",
    eyebrow: "The synthesis",
    title: "Make your next move count.",
    copy: "A living picture of your skills, evidence and next steps — shaped around the work you want to do.",
  },
] as const;

const WORLDS = [
  { name: "Avasar", description: "Opportunities" },
  { name: "Collaborate", description: "People & projects" },
  { name: "Learn", description: "Skill roadmaps" },
  { name: "Meet", description: "Live collaboration" },
  { name: "Iris", description: "Assessments" },
] as const;

function sceneFor(elapsed: number) {
  if (elapsed < 8_000) return 0;
  if (elapsed < 20_000) return 1;
  if (elapsed < 38_000) return 2;
  if (elapsed < 58_000) return 3;
  return 4;
}

function formatClock(ms: number) {
  const seconds = Math.min(75, Math.floor(ms / 1_000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function StorySequence({ startHref }: { startHref: string }) {
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = window.sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Session storage can be disabled; the skip control remains available.
    }
    if (alreadySeen) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(reduceMotion);
    setVisible(true);
    if (reduceMotion) return;

    const start = Date.now();
    const timer = window.setInterval(() => {
      const next = Date.now() - start;
      if (next >= DURATION_MS) {
        setElapsed(DURATION_MS);
        setVisible(false);
        try { window.sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* no-op */ }
        window.clearInterval(timer);
      } else {
        setElapsed(next);
      }
    }, 220);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // dismiss is stable by design; this listener only tracks visibility.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function dismiss() {
    setVisible(false);
    try { window.sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* no-op */ }
  }

  if (!visible) return null;

  const sceneIndex = sceneFor(elapsed);
  const scene = SCENES[sceneIndex];
  const progress = reduced ? 0 : Math.min(100, (elapsed / DURATION_MS) * 100);

  return (
    <div className="at-story" role="dialog" aria-modal="true" aria-label="AI Tathastu introduction">
      <div className="at-story-grain" aria-hidden="true" />
      <header className="at-story-top">
        <Link className="at-story-brand" href="/" onClick={dismiss} aria-label="AI Tathastu home">
          <span className="at-story-brand-mark" aria-hidden="true">✳</span>
          <span>AI Tathastu</span>
        </Link>
        <span className="at-story-edition">A PERSONAL INTELLIGENCE WORKSPACE</span>
        <button className="at-story-skip" type="button" onClick={dismiss}>
          Skip intro <span aria-hidden="true">↗</span>
        </button>
      </header>

      <main className="at-story-content" key={sceneIndex}>
        <div className={`at-story-art at-story-art-${sceneIndex + 1}`} aria-hidden="true">
          <div className="at-story-orbit at-story-orbit-one" />
          <div className="at-story-orbit at-story-orbit-two" />
          <div className="at-story-orbit at-story-orbit-three" />
          <div className="at-story-sphere">
            <span className="at-story-sphere-highlight" />
            <span className="at-story-sphere-shine" />
          </div>
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              className={`at-story-particle at-story-particle-${index + 1}`}
            />
          ))}
          {sceneIndex >= 2 && (
            <div className="at-story-data-card">
              <span className="at-story-data-overline">IDENTITY / 360</span>
              <strong>Evidence, in context.</strong>
              <span>Skills · Projects · Research</span>
              <div className="at-story-data-lines"><i /><i /><i /></div>
            </div>
          )}
        </div>

        <div className="at-story-copy">
          <p className="at-story-eyebrow"><span />{scene.eyebrow}</p>
          <p className="at-story-time">{scene.range}</p>
          <h1>{scene.title}</h1>
          <p className="at-story-description">{scene.copy}</p>

          {sceneIndex === 3 && (
            <div className="at-story-worlds" aria-label="The five AI Tathastu worlds">
              {WORLDS.map((world, index) => (
                <div className="at-story-world" key={world.name} style={{ "--world-index": index } as React.CSSProperties}>
                  <span className="at-story-world-index">0{index + 1}</span>
                  <strong>{world.name}</strong>
                  <small>{world.description}</small>
                </div>
              ))}
            </div>
          )}

          {sceneIndex === 4 && (
            <div className="at-story-final-actions">
              <Link className="at-story-primary" href={startHref} onClick={dismiss}>
                Initialize your profile <span aria-hidden="true">↗</span>
              </Link>
              <button className="at-story-secondary" type="button" onClick={dismiss}>Explore the platform</button>
            </div>
          )}
        </div>
      </main>

      <footer className="at-story-bottom">
        <span className="at-story-chapter">CHAPTER 0{sceneIndex + 1} <i /> 05</span>
        <div className="at-story-progress" role="progressbar" aria-label="Introduction timeline" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="at-story-clock">{formatClock(elapsed)} <i /> 01:15</span>
      </footer>
    </div>
  );
}
