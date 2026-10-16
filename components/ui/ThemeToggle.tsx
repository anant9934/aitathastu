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
      className={cn("inline-flex shrink-0 items-center rounded-[var(--radius-control)] border border-line bg-canvas p-0.5", className)}
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
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[6px] text-xs font-medium transition-colors duration-150 pointer-coarse:h-10",
              compact ? "w-8 justify-center pointer-coarse:w-10" : "px-2.5",
              active ? "bg-raised text-ink shadow-[0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-ink",
            )}
          >
            <Icon size={15} weight={active ? "fill" : "regular"} aria-hidden="true" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
