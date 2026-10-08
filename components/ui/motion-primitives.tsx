"use client";

import React, { useState, useRef, useEffect } from "react";

/**
 * 1. SpotlightCard — From ibelick/ui-skills & motion-primitives
 * Creates an interactive card where a soft radial gradient follows the user's cursor.
 */
interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  spotlightColor?: string;
  borderColor?: string;
  borderRadius?: number;
  className?: string;
  background?: string;
}

export function SpotlightCard({
  children,
  spotlightColor = "rgba(2, 197, 245, 0.18)",
  borderColor = "rgba(255, 255, 255, 0.12)",
  borderRadius = 20,
  background = "rgba(10, 18, 42, 0.75)",
  style = {},
  className = "",
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: -500, y: -500 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setPosition({ x: -500, y: -500 });
      }}
      className={`spotlight-card ${className}`}
      style={{
        position: "relative",
        borderRadius,
        border: `1px solid ${borderColor}`,
        background,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: isHovered
          ? "0 20px 45px -10px rgba(0, 0, 0, 0.7), 0 0 30px rgba(2, 197, 245, 0.15)"
          : "0 8px 30px rgba(0, 0, 0, 0.45)",
        overflow: "hidden",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
        ...style,
      }}
      {...props}
    >
      {/* Dynamic Cursor Spotlight */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          opacity: isHovered ? 1 : 0,
          transition: "opacity 0.25s ease",
          background: `radial-gradient(350px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
          zIndex: 1,
        }}
      />

      {/* Subtle Top Inner Edge Highlight (Impeccable craft principle) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      <div style={{ position: "relative", zIndex: 3 }}>{children}</div>
    </div>
  );
}

/**
 * 2. TextShimmer — From ibelick/motion-primitives
 * Adds a gentle, tasteful light-sweep shimmer across high-impact text.
 */
interface TextShimmerProps {
  children: string;
  className?: string;
  style?: React.CSSProperties;
}

export function TextShimmer({ children, style = {} }: TextShimmerProps) {
  return (
    <span
      style={{
        display: "inline-block",
        background: "linear-gradient(110deg, #02C5F5 0%, #60A5FA 30%, #C084FC 60%, #02C5F5 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        animation: "textShimmerPass 4.5s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * 3. GlowingBadge — Pill tag with subtle breathing aura and 1px inner border
 */
interface GlowingBadgeProps {
  children: React.ReactNode;
  color?: "cyan" | "violet" | "blue" | "emerald" | "amber";
  icon?: React.ReactNode;
}

export function GlowingBadge({ children, color = "cyan", icon }: GlowingBadgeProps) {
  const colorMap = {
    cyan: { bg: "rgba(2, 197, 245, 0.12)", border: "rgba(2, 197, 245, 0.45)", text: "#38BDF8", glow: "rgba(2, 197, 245, 0.3)" },
    violet: { bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.45)", text: "#C084FC", glow: "rgba(168, 85, 247, 0.3)" },
    blue: { bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.45)", text: "#60A5FA", glow: "rgba(59, 130, 246, 0.3)" },
    emerald: { bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.45)", text: "#34D399", glow: "rgba(16, 185, 129, 0.3)" },
    amber: { bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.45)", text: "#FBBF24", glow: "rgba(245, 158, 11, 0.3)" },
  };

  const c = colorMap[color];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 14px",
        borderRadius: 9999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.03em",
        boxShadow: `0 0 16px ${c.glow}`,
        backdropFilter: "blur(8px)",
      }}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

/**
 * 4. SpringButton — Magnetic spring tactile interaction
 */
interface SpringButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "glass";
  icon?: React.ReactNode;
}

export function SpringButton({
  children,
  variant = "primary",
  icon,
  style = {},
  ...props
}: SpringButtonProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const getStyle = (): React.CSSProperties => {
    if (variant === "primary") {
      return {
        background: "linear-gradient(110deg, #02C5F5 0%, #4564FF 48%, #9335E8 100%)",
        color: "#FFFFFF",
        border: "none",
        boxShadow: hovered
          ? "0 10px 28px rgba(69, 100, 255, 0.55), 0 0 20px rgba(2, 197, 245, 0.3)"
          : "0 4px 18px rgba(69, 100, 255, 0.4)",
      };
    }
    if (variant === "secondary") {
      return {
        background: hovered ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.07)",
        color: "#FFFFFF",
        border: "1px solid rgba(255, 255, 255, 0.25)",
        backdropFilter: "blur(12px)",
        boxShadow: hovered ? "0 8px 24px rgba(0, 0, 0, 0.4)" : "0 2px 10px rgba(0, 0, 0, 0.2)",
      };
    }
    return {
      background: "rgba(255, 255, 255, 0.08)",
      color: "#FFFFFF",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      backdropFilter: "blur(12px)",
    };
  };

  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "13px 30px",
        borderRadius: 9999,
        fontSize: 14.5,
        fontWeight: 750,
        cursor: "pointer",
        transform: pressed ? "scale(0.96)" : hovered ? "translateY(-2px) scale(1.02)" : "translateY(0) scale(1)",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        outline: "none",
        ...getStyle(),
        ...style,
      }}
      {...props}
    >
      <span>{children}</span>
      {icon}
    </button>
  );
}

/**
 * 5. AnimatedCounter — Smooth number ticker
 */
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  style?: React.CSSProperties;
}

export function AnimatedCounter({
  value,
  duration = 1200,
  suffix = "",
  prefix = "",
  style = {},
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * value));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      } else {
        setCount(value);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [value, duration]);

  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {count}
      {suffix}
    </span>
  );
}

/**
 * 6. TiltCard — 3D perspective tilt on hover
 */
interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxTilt?: number;
}

export function TiltCard({ children, maxTilt = 8, style = {}, ...props }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const tiltX = (y / (rect.height / 2)) * -maxTilt;
    const tiltY = (x / (rect.width / 2)) * maxTilt;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: "transform 0.15s ease-out",
        transformStyle: "preserve-3d",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
