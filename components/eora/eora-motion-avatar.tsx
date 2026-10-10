"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { EoraPose } from "@/lib/eora/avatar-registry";
import { getEoraAsset } from "@/lib/eora/avatar-registry";
import type { EoraAnimationState } from "@/lib/eora/identity";

/** Crossfades approved still poses; the source art has no facial rig. */
export function EoraMotionAvatar({ pose, state, reducedMotion }: {
  pose: EoraPose;
  state: EoraAnimationState;
  reducedMotion: boolean;
}) {
  const [outgoing, setOutgoing] = useState<EoraPose | null>(null);
  const previous = useRef(pose);

  useEffect(() => {
    if (previous.current === pose) return;
    if (!reducedMotion) setOutgoing(previous.current);
    previous.current = pose;
    const timer = setTimeout(() => setOutgoing(null), 260);
    return () => clearTimeout(timer);
  }, [pose, reducedMotion]);

  const asset = getEoraAsset(pose);
  return (
    <span className="eora-motion-stage" data-motion-state={state}>
      {outgoing && !reducedMotion && (
        <Image
          src={getEoraAsset(outgoing).src}
          alt=""
          width={72}
          height={90}
          className="eora-motion-image eora-motion-image--outgoing"
          aria-hidden="true"
        />
      )}
      <Image
        key={pose}
        src={asset.src}
        alt={asset.alt}
        width={72}
        height={90}
        className={`eora-motion-image ${reducedMotion ? "" : "eora-motion-image--incoming"}`}
        priority={false}
      />
    </span>
  );
}
