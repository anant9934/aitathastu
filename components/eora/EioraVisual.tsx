"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/client/cn";

export type EioraState = "idle" | "speaking" | "extracting" | "minimized";

interface EioraVisualProps {
  state?: EioraState;
  size?: number; // Size in px (default 180)
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  statusText?: string;
  showOrbitalParticles?: boolean;
  speedMultiplier?: number;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  angle: number;
  dist: number;
  speed: number;
  color: string;
  label?: string;
  opacity: number;
}

const PARTICLE_LABELS = [
  "GitHub", "LinkedIn", "LeetCode", "ORCID", "Kaggle",
  "PyTorch", "Transformers", "Python", "ArXiv", "HackerRank"
];

const ACCENT_COLORS = [
  "#D4AF37", // Champagne Gold
  "#E05A47", // Living Terracotta
  "#4CD3E3", // Prism Cyan
  "#F5B041", // Prism Amber
  "#F1948A", // Prism Rose
];

export function EioraVisual({
  state = "idle",
  size = 180,
  interactive = true,
  className,
  onClick,
  statusText,
  showOrbitalParticles = true,
  speedMultiplier = 1,
}: EioraVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });
  const timeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const [hovered, setHovered] = useState(false);

  // Initialize orbital particles for extracting & speaking states
  useEffect(() => {
    const particles: Particle[] = [];
    const count = state === "extracting" ? 28 : 14;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = (size * 0.42) + Math.random() * (size * 0.45);
      particles.push({
        x: 0,
        y: 0,
        radius: 1.5 + Math.random() * 2.5,
        angle,
        dist,
        speed: (0.015 + Math.random() * 0.02) * (state === "extracting" ? 2.5 : 1),
        color: ACCENT_COLORS[i % ACCENT_COLORS.length],
        label: i < PARTICLE_LABELS.length ? PARTICLE_LABELS[i] : undefined,
        opacity: 0.3 + Math.random() * 0.7,
      });
    }
    particlesRef.current = particles;
  }, [state, size]);

  // Handle pointer tracking
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const nx = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));
    mouseRef.current.targetX = nx;
    mouseRef.current.targetY = ny;
  }, []);

  useEffect(() => {
    if (!interactive) return;
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [interactive, handleMouseMove]);

  // Main high-fps render loop with visibility pause and reduced-motion support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let isMounted = true;
    let isPaused = false;
    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    canvas.width = size * dpr;
    canvas.height = size * dpr;

    // Pause rendering when tab is hidden to save GPU/CPU cycles
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isPaused = true;
        cancelAnimationFrame(rafRef.current);
      } else {
        if (isPaused && isMounted && !prefersReducedMotion) {
          isPaused = false;
          rafRef.current = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange, { passive: true });

    const drawFrame = (t: number) => {
      // Smooth lerp mouse towards target
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const baseR = (size / 2) * (state === "minimized" ? 0.72 : 0.64);

      // 1. Ambient Outer Opalescent Glow
      const glowGrad = ctx.createRadialGradient(
        cx + mx * 10,
        cy + my * 10,
        baseR * 0.2,
        cx,
        cy,
        baseR * 1.55
      );
      if (state === "extracting") {
        glowGrad.addColorStop(0, "rgba(224, 90, 71, 0.35)"); // Terracotta
        glowGrad.addColorStop(0.5, "rgba(212, 175, 55, 0.22)"); // Champagne
        glowGrad.addColorStop(1, "rgba(212, 175, 55, 0)");
      } else if (state === "speaking") {
        glowGrad.addColorStop(0, "rgba(76, 211, 227, 0.35)"); // Prism cyan
        glowGrad.addColorStop(0.5, "rgba(212, 175, 55, 0.25)");
        glowGrad.addColorStop(1, "rgba(241, 148, 138, 0)");
      } else {
        // Idle: warm champagne & soft pearl prism
        glowGrad.addColorStop(0, "rgba(212, 175, 55, 0.3)");
        glowGrad.addColorStop(0.6, "rgba(224, 90, 71, 0.12)");
        glowGrad.addColorStop(1, "rgba(248, 246, 240, 0)");
      }

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 1.55, 0, Math.PI * 2);
      ctx.fill();

      // 2. Orbital particles & vortex trails (Extracting / Speaking / Idle)
      if (showOrbitalParticles) {
        const particles = particlesRef.current;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!prefersReducedMotion) {
            p.angle += p.speed;

            if (state === "extracting") {
              // Tight spiral pull towards center
              p.dist -= 0.35 * speedMultiplier;
              if (p.dist < baseR * 0.45) {
                p.dist = size * 0.46;
                p.speed = 0.02 + Math.random() * 0.03;
              }
            }
          }

          const px = cx + Math.cos(p.angle) * p.dist;
          const py = cy + Math.sin(p.angle) * p.dist * 0.85 + (my * 8);

          // Draw particle trail
          ctx.beginPath();
          ctx.arc(px, py, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.opacity;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.shadowBlur = 0;

          // If extracting, draw particle orbit connector line
          if (state === "extracting" && i % 3 === 0) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(cx, cy);
            ctx.strokeStyle = `rgba(212, 175, 55, 0.15)`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }

          ctx.globalAlpha = 1.0;
        }
      }

      // 3. Liquid Glass Sphere Boundary (Deformed Organic Perlin-Like Geometry)
      const numSegments = 64;
      const breath = prefersReducedMotion
        ? 0
        : Math.sin(t * (state === "speaking" ? 4.5 : 2.0)) * (state === "extracting" ? 0.07 : 0.035);
      const currentR = baseR * (1 + breath);

      ctx.beginPath();
      for (let i = 0; i <= numSegments; i++) {
        const theta = (Math.PI * 2 * i) / numSegments;

        // Wave deformation harmonics
        let wave = Math.sin(theta * 3 + t * 2.5) * 0.025;
        wave += Math.cos(theta * 5 - t * 3.2) * 0.015;

        if (state === "speaking") {
          // Acoustic surface ripples
          wave += Math.sin(theta * 8 - t * 8) * 0.045;
        } else if (state === "extracting") {
          // Vortex spiral distortion
          wave += Math.sin(theta * 4 + t * 7) * 0.06;
        }

        const rTheta = currentR * (1 + (prefersReducedMotion ? 0 : wave));
        const x = cx + Math.cos(theta) * rTheta;
        const y = cy + Math.sin(theta) * rTheta;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Liquid glass fill with refractive volumetric depth
      const sphereGrad = ctx.createRadialGradient(
        cx + mx * (baseR * 0.45),
        cy + my * (baseR * 0.45) - (baseR * 0.2),
        baseR * 0.05,
        cx,
        cy,
        currentR
      );
      sphereGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      sphereGrad.addColorStop(0.2, "rgba(254, 249, 231, 0.85)"); // Soft gold core
      sphereGrad.addColorStop(0.5, "rgba(212, 175, 55, 0.45)");  // Champagne
      sphereGrad.addColorStop(0.8, "rgba(224, 90, 71, 0.35)");  // Living terracotta
      sphereGrad.addColorStop(1, "rgba(76, 211, 227, 0.2)");    // Prism cyan edge refraction

      ctx.fillStyle = sphereGrad;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "rgba(212, 175, 55, 0.4)";
      ctx.fill();
      ctx.shadowBlur = 0;

      // 4. Inner Liquid Caustics & Flowing Plasma Curvature
      ctx.save();
      ctx.clip(); // Keep inner caustics inside sphere

      // Fluid plasma bands
      for (let b = 0; b < 3; b++) {
        const offset = (b * Math.PI) / 1.5;
        const bx = cx + Math.cos((prefersReducedMotion ? 0 : t * 1.5) + offset) * (baseR * 0.35);
        const by = cy + Math.sin((prefersReducedMotion ? 0 : t * 1.2) + offset) * (baseR * 0.25);
        const br = baseR * (0.35 + (prefersReducedMotion ? 0 : Math.sin(t * 2 + b) * 0.08));

        const bandGrad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        if (b === 0) {
          bandGrad.addColorStop(0, "rgba(255, 255, 255, 0.6)");
          bandGrad.addColorStop(1, "rgba(212, 175, 55, 0)");
        } else if (b === 1) {
          bandGrad.addColorStop(0, "rgba(224, 90, 71, 0.4)");
          bandGrad.addColorStop(1, "rgba(224, 90, 71, 0)");
        } else {
          bandGrad.addColorStop(0, "rgba(76, 211, 227, 0.35)");
          bandGrad.addColorStop(1, "rgba(76, 211, 227, 0)");
        }

        ctx.fillStyle = bandGrad;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Reactive Eye/Gaze Focus Nodes (Living Companion Gaze)
      const gazeX = cx + mx * (baseR * 0.28);
      const gazeY = cy + my * (baseR * 0.28);
      const eyeSep = baseR * 0.28;

      for (let side = -1; side <= 1; side += 2) {
        const ex = gazeX + side * eyeSep;
        const ey = gazeY - (baseR * 0.05);
        const eyeR = baseR * (state === "speaking" ? 0.09 : 0.075);

        // Soft eye glow
        const eyeGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeR * 1.8);
        eyeGrad.addColorStop(0, "#141413"); // Deep Obsidian
        eyeGrad.addColorStop(0.7, "#5A5852");
        eyeGrad.addColorStop(1, "rgba(90, 88, 82, 0)");

        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fill();

        // Tiny specular pupil catchlight
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(ex + 1.2, ey - 1.2, eyeR * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // Exit sphere clipping

      // 6. Opalescent Frosted Rim Highlight
      ctx.lineWidth = 1.5;
      const rimGrad = ctx.createLinearGradient(
        cx - currentR,
        cy - currentR,
        cx + currentR,
        cy + currentR
      );
      rimGrad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      rimGrad.addColorStop(0.35, "rgba(212, 175, 55, 0.7)");
      rimGrad.addColorStop(0.7, "rgba(224, 90, 71, 0.6)");
      rimGrad.addColorStop(1, "rgba(76, 211, 227, 0.65)");

      ctx.strokeStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.stroke();

      // 7. Dynamic Concentric Resonance Rings (Speaking state)
      if (state === "speaking" && !prefersReducedMotion) {
        for (let ring = 1; ring <= 2; ring++) {
          const ringProgress = (t * 1.5 + ring * 0.5) % 1;
          const ringR = currentR + ringProgress * (size * 0.22);
          const ringAlpha = (1 - ringProgress) * 0.5;

          ctx.beginPath();
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(212, 175, 55, ${ringAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const render = () => {
      if (!isMounted || isPaused) return;

      timeRef.current += 0.018 * speedMultiplier;
      drawFrame(timeRef.current);

      if (!prefersReducedMotion) {
        rafRef.current = requestAnimationFrame(render);
      }
    };

    if (prefersReducedMotion) {
      // Render single static beautiful frame without high-frequency loop
      drawFrame(1.0);
    } else {
      rafRef.current = requestAnimationFrame(render);
    }

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelAnimationFrame(rafRef.current);
    };
  }, [state, size, speedMultiplier, showOrbitalParticles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (interactive && onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  const isClickable = interactive && Boolean(onClick);

  return (
    <div
      ref={containerRef}
      role={isClickable ? "button" : "img"}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`Eiora AI Companion: ${state} state${statusText ? `. ${statusText}` : ""}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        mouseRef.current.targetX = 0;
        mouseRef.current.targetY = 0;
      }}
      className={cn(
        "relative select-none flex items-center justify-center transition-transform duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-4 rounded-full",
        interactive && "cursor-pointer active:scale-95",
        hovered && interactive && "scale-105",
        className
      )}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="block pointer-events-none drop-shadow-[0_8px_24px_rgba(212,175,55,0.22)]"
      />

      {statusText && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#D4AF37]/35 bg-[#141413] px-3.5 py-1 text-2xs font-mono font-medium text-[#FAF6F0] shadow-md">
          {statusText}
        </div>
      )}
    </div>
  );
}
