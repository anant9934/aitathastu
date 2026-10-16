import React from "react";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";

/**
 * An empty module that teaches: what belongs here, why it is empty, and the
 * one action that fills it (Task 3.3.2).
 */
export function EmptyState({
  icon: Glyph,
  title,
  children,
  actions,
  className,
  compact,
}: {
  icon?: Icon;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-card border border-dashed border-border-medium bg-bg-surface/30",
        compact ? "p-4" : "p-5 sm:p-6",
        className,
      )}
    >
      {Glyph && (
        <span className="grid size-9 place-items-center rounded-lg border border-border-medium bg-deep-espresso text-champagne">
          <Glyph size={18} aria-hidden="true" />
        </span>
      )}
      <div className="max-w-[60ch]">
        <p className="font-display font-medium text-warm-ivory">{title}</p>
        {children && <div className="mt-1 text-sm text-text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
