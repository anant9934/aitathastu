import React from "react";
import Link from "next/link";
import { cn } from "@/lib/client/cn";

/** The rounded-triangle mark, drawn in the single signal colour. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={cn("shrink-0", className)}>
      <path
        d="M50 18 L84 76 A6 6 0 0 1 78.6 84 L21.4 84 A6 6 0 0 1 16 76 Z"
        fill="color-mix(in srgb, var(--signal) 16%, transparent)"
        stroke="var(--signal)"
        strokeWidth="9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ href = "/", className, label = true }: { href?: string; className?: string; label?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex min-h-11 items-center gap-2 rounded-[6px] text-ink", className)} aria-label="AI Tathastu home">
      <LogoMark />
      {label && (
        <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">
          AI<span className="text-muted">Tathastu</span>
        </span>
      )}
    </Link>
  );
}
