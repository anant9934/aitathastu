"use client";

import type { EoraPose } from "@/lib/eora/avatar-registry";
import type { EoraAnimationState } from "@/lib/eora/identity";

/** Shared amber sphere used by the floating guide. The parent button owns its label and actions. */
export function EoraMotionAvatar({ pose, state, reducedMotion }: {
  pose: EoraPose;
  state: EoraAnimationState;
  reducedMotion: boolean;
}) {
  return (
    <span
      className="eora-motion-stage eora-orb-stage"
      data-motion-state={state}
      data-pose={pose}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      aria-hidden="true"
    >
      <span className="eora-orb-ring" />
      <span className="eora-orb-core">
        <span className="eora-orb-eye eora-orb-eye--left" />
        <span className="eora-orb-eye eora-orb-eye--right" />
        <span className="eora-orb-mouth" />
      </span>
    </span>
  );
}
