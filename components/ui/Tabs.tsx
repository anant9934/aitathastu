"use client";

import React, { useId, useRef } from "react";
import { cn } from "@/lib/client/cn";

export type TabItem = { id: string; label: React.ReactNode; badge?: React.ReactNode };

/**
 * WAI-ARIA tabs with roving focus (arrow keys, Home, End). Scrolls
 * horizontally on narrow screens instead of wrapping.
 */
export function Tabs({
  items,
  value,
  onChange,
  label,
  className,
  idBase,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
  idBase?: string;
}) {
  const auto = useId();
  const base = idBase ?? auto;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = items[next].id;
    onChange(id);
    refs.current[id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("-mx-1 flex gap-1 overflow-x-auto px-1 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      {items.map((item, i) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => { refs.current[item.id] = el; }}
            id={`${base}-tab-${item.id}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-[6px] px-3 text-sm font-medium transition-colors duration-150 pointer-coarse:min-h-11",
              active ? "bg-raised text-ink shadow-[inset_0_-2px_0_var(--signal)]" : "text-muted hover:text-ink hover:bg-raised/60",
            )}
          >
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, id, active, children, className }: { idBase: string; id: string; active: boolean; children: React.ReactNode; className?: string }) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} tabIndex={0} className={cn("focus-visible:outline-offset-4", className)}>
      {children}
    </div>
  );
}
