"use client";

/**
 * Sticky section pills for the single-scroll dashboard (Task 3.1.2). The
 * active pill follows the section nearest the top of the viewport.
 */
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/client/cn";

export function JumpNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-112px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  // Keep the active pill visible when the bar scrolls sideways on phones.
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>(`[data-id="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav aria-label="Dashboard sections" className="sticky top-14 z-20 -mx-4 border-b border-border-medium bg-bg-primary/95 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-bg-primary/80 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
      <div ref={bar} className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((i) => (
          <a
            key={i.id}
            data-id={i.id}
            href={`#${i.id}`}
            aria-current={active === i.id ? "location" : undefined}
            onClick={() => setActive(i.id)}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center rounded-full px-3 text-sm font-medium transition-colors duration-150 pointer-coarse:min-h-11",
              active === i.id ? "bg-deep-espresso text-text-primary shadow-[0_0_0_1px_var(--border-medium)]" : "text-text-muted hover:text-text-primary",
            )}
          >
            {i.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
