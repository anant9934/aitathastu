"use client";

import React, { useEffect, useRef, useState } from "react";
import { EioraVisual } from "@/components/eora/EioraVisual";

const FRAGMENTS = [
  { label: "SKILLS", className: "at-cv-fragment-skills" },
  { label: "EDUCATION", className: "at-cv-fragment-education" },
  { label: "EXPERIENCE", className: "at-cv-fragment-experience" },
  { label: "PROJECTS", className: "at-cv-fragment-projects" },
];

/**
 * Decorative document-to-identity animation. The percentage represents this
 * visual sequence, not extraction-engine telemetry; the real status is shown
 * in the existing upload handler UI and remains authoritative.
 */
export function CvExtractionAssembly({ busy, stage, fileName }: {
  busy: boolean;
  stage: string;
  fileName?: string | null;
}) {
  const [visible, setVisible] = useState(false);
  const [percent, setPercent] = useState(0);
  const wasBusy = useRef(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let hideTimeout: ReturnType<typeof setTimeout> | undefined;

    if (busy) {
      wasBusy.current = true;
      setVisible(true);
      setPercent(0);
      let p = 0;
      interval = setInterval(() => {
        p = Math.min(94, p + Math.max(1, Math.round((94 - p) * 0.085)));
        setPercent(p);
      }, 85);
    } else if (wasBusy.current) {
      wasBusy.current = false;
      setPercent(100);
      hideTimeout = setTimeout(() => setVisible(false), 1250);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [busy]);

  if (!visible) return null;

  return (
    <section className="at-cv-assembly" aria-label="Resume processing visualisation">
      <div className="at-cv-assembly-head">
        <div>
          <p className="at-cv-overline">EIORA / IDENTITY ASSEMBLY</p>
          <h2>Turning pages into a clearer picture.</h2>
          <p className="at-cv-filename">{fileName || "Your selected document"}</p>
        </div>
        <div className="at-cv-counter" aria-hidden="true">{String(percent).padStart(2, "0")}<span>%</span></div>
      </div>

      <div className="at-cv-assembly-stage">
        <div className="at-cv-document" aria-hidden="true">
          <div className="at-cv-doc-top"><span>CV / DOCUMENT</span><i /></div>
          <b />
          <i className="wide" /><i /><i className="medium" />
          <div className="at-cv-doc-rule" />
          <i className="wide" /><i className="medium" /><i />
          <div className="at-cv-doc-rule" />
          <i className="wide" /><i /><i className="medium" />
        </div>
        {FRAGMENTS.map((fragment) => (
          <div key={fragment.label} className={`at-cv-fragment ${fragment.className}`} aria-hidden="true">{fragment.label}</div>
        ))}
        <div className="at-cv-assembly-orb"><EioraVisual size={122} state={busy ? "extracting" : "idle"} /></div>
        <div className="at-cv-identity" aria-hidden="true">
          <div className="at-cv-id-label">IDENTITY / 360</div>
          <strong>Evidence assembled</strong>
          <span>Skills · Education · Projects</span>
          <div className="at-cv-id-bars"><i /><i /><i /></div>
        </div>
      </div>

      <div className="at-cv-assembly-foot">
        <div className="at-cv-track"><span style={{ width: `${percent}%` }} /></div>
        <p>{busy ? (stage || "Reading selected document") : "Visual assembly complete"} <span>·</span> <small>Animation only; extractor status is reported separately.</small></p>
      </div>
    </section>
  );
}
