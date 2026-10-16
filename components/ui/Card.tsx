"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/client/cn";

export type CardVariant = "surface" | "editorial" | "elevated";

export function Card({
  children,
  variant = "surface",
  glow = true,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  glow?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!glow || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    ref.current.style.setProperty("--fx", `${x}%`);
    ref.current.style.setProperty("--fy", `${y}%`);
  };

  const variantClass =
    variant === "editorial"
      ? "bg-paper text-ink border-soft-border"
      : variant === "elevated"
      ? "fcard feature-lg"
      : "fcard";

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={cn(variantClass, className)}
      {...rest}
    >
      {children}
    </div>
  );
}
