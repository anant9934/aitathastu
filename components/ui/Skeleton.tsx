import React from "react";
import { cn } from "@/lib/client/cn";

/** A shimmer block shaped like the content it stands in for (Task 3.3.1). */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        "rounded-[var(--radius-control)] bg-raised",
        "bg-[linear-gradient(90deg,var(--raised)_0px,var(--line)_120px,var(--raised)_240px)] bg-[length:640px_100%]",
        "animate-[shimmer_1.4s_linear_infinite] motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/** Wraps skeleton geometry with a single accessible busy announcement. */
export function LoadingRegion({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
