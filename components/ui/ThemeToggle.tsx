"use client";

import React from "react";
import { Moon, Sun } from "@phosphor-icons/react/dist/ssr";
import { useTheme, type Theme } from "@/lib/client/theme";
import { cn } from "@/lib/client/cn";

/** The visible two-option Dark / Light switch (D-2). */
export function ThemeToggle({ compact, className }: { compact?: boolean; className?: string }) {
  const [theme, setTheme] = useTheme();
  const options: { value: Theme; label: string; Icon: typeof Moon }[] = [
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "light", label: "Light", Icon: Sun },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("inline-flex shrink-0 items-center rounded-full border border-border-medium bg-bg-elevated p-0.5", className)}
    >
      {options.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full text-xs font-medium transition-all duration-150 pointer-coarse:h-10",
              compact ? "w-8 justify-center pointer-coarse:w-10" : "px-3",
              active ? "bg-bg-elevated text-text-warm font-semibold shadow-[0_0_8px_rgba(196,138,90,0.2)]" : "text-text-muted hover:text-text-warm",
            )}
          >
            <Icon size={15} weight={active ? "fill" : "regular"} className={active ? "text-accent-primary" : undefined} aria-hidden="true" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
