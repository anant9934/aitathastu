"use client";

import React, { useEffect, useRef } from "react";

export type EioraVisualState = "idle" | "speaking" | "extracting" | "minimized";

type EioraVisualProps = {
  state?: EioraVisualState;
  className?: string;
  size?: number;
};

/**
 * Lightweight canvas companion: a warm liquid-glass core, refracted rim,
 * orbital particles, and cursor parallax. It is purely presentational and
 * never reads or mutates product state.
 */
export function EioraVisual({
  state = "idle",
  className,
  size = 260,
}: EioraVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let lastTime = 0;
    const particles = Array.from({ length: 34 }, (_, i) => ({
      phase: (i / 34) * Math.PI * 2,
      radius: 0.31 + (i % 7) * 0.043,
      speed: 0.13 + (i % 6) * 0.026,
      r: 1.2 + (i % 3) * 0.55,
      hue: i % 5 === 0 ? 10 : i % 4 === 0 ? 188 : 44,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
      targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
    };
    const leave = () => { targetX = 0; targetY = 0; };
    canvas.addEventListener("pointermove", move, { passive: true });
    canvas.addEventListener("pointerleave", leave);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const draw = (time: number) => {
      if (reduceMotion && lastTime > 0) {
        frame = 0;
        return;
      }
      const delta = lastTime ? Math.min(48, time - lastTime) : 16;
      lastTime = time;
      const mode = stateRef.current;
      const t = time / 1000;
      pointerX += (targetX - pointerX) * 0.055;
      pointerY += (targetY - pointerY) * 0.055;

      ctx.clearRect(0, 0, width, height);
      const cx = width * 0.5 + pointerX * width * 0.035;
      const cy = height * 0.5 + pointerY * height * 0.035;
      const radius = Math.min(width, height) * 0.32;
      const pulse = mode === "speaking" ? 1 + Math.sin(t * 8) * 0.035
        : mode === "extracting" ? 0.96 + Math.sin(t * 13) * 0.025
        : 1 + Math.sin(t * 1.5) * 0.022;
      const r = radius * pulse;

      // A subtle ambient halo keeps the form legible against the alabaster canvas.
      const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.8);
      halo.addColorStop(0, "rgba(212,175,55,0.14)");
      halo.addColorStop(0.52, "rgba(224,90,71,0.065)");
      halo.addColorStop(1, "rgba(212,175,55,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Tilted refractive orbit, expanded and accelerated during extraction.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (mode === "extracting" ? 1.8 : 0.12));
      ctx.strokeStyle = "rgba(140,106,18,0.23)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (mode === "extracting" ? 1.65 : 1.45), r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(Math.PI / 2.4);
      ctx.strokeStyle = "rgba(224,90,71,0.17)";
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.28, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Core with a pearl highlight and warm terracotta refraction.
      const core = ctx.createRadialGradient(cx - r * 0.34, cy - r * 0.38, r * 0.04, cx + r * 0.16, cy + r * 0.15, r * 1.22);
      core.addColorStop(0, "rgba(255,255,255,0.99)");
      core.addColorStop(0.2, "rgba(255,250,230,0.94)");
      core.addColorStop(0.42, "rgba(232,208,121,0.76)");
      core.addColorStop(0.67, "rgba(212,175,55,0.48)");
      core.addColorStop(0.84, "rgba(224,90,71,0.24)");
      core.addColorStop(1, "rgba(248,246,240,0.26)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.82)";
      ctx.lineWidth = 1.1;
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.99, 0, Math.PI * 2);
      ctx.clip();

      // A curved caustic gives the orb a liquid, hand-polished glass surface.
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.16 + pointerX * r * 0.18, cy - r * 0.18 + pointerY * r * 0.12,
        r * 0.42, r * 0.18, -0.7 + pointerX * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.filter = "blur(7px)";
      ctx.fill();
      ctx.filter = "none";

      if (mode === "speaking") {
        for (let i = 0; i < 3; i++) {
          const ripple = (t * 0.45 + i / 3) % 1;
          ctx.beginPath();
          ctx.arc(cx, cy, r * (0.28 + ripple * 0.72), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,255,255,${(1 - ripple) * 0.4})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      ctx.restore();

      // Orbiting points respond to the same mode signal as the companion.
      for (const p of particles) {
        const speed = mode === "extracting" ? p.speed * 5.3 : p.speed;
        const a = p.phase + t * speed;
        const orbitScale = mode === "extracting" ? 1.18 : mode === "minimized" ? 1.4 : 1.05;
        const px = cx + Math.cos(a) * r * p.radius * orbitScale;
        const py = cy + Math.sin(a * 1.13) * r * p.radius * orbitScale * 0.8;
        ctx.beginPath();
        ctx.arc(px, py, mode === "extracting" ? p.r * 0.8 : p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.hue === 10 ? "rgba(224,90,71,0.62)" : p.hue === 188 ? "rgba(76,211,227,0.50)" : "rgba(212,175,55,0.72)";
        ctx.fill();
      }

      // Small specular glint.
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.26, cy - r * 0.35, r * 0.18, r * 0.075, -0.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fill();

      if (!reduceMotion) frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      role="presentation"
      className={className}
      data-size={size}
      style={{ width: "100%", height: "100%", display: "block", pointerEvents: "auto" }}
    />
  );
}
