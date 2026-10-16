import React from "react";
import { cn } from "@/lib/client/cn";

/**
 * The one container. Structure comes from a 1 px border and a tonal step;
 * never nest a Panel inside a Panel (use PanelSection or a divided list).
 */
export function Panel({
  as: Tag = "section",
  className,
  padded = true,
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType; padded?: boolean }) {
  return (
    <Tag
      className={cn(
        "min-w-0 rounded-card border border-border-medium bg-bg-elevated text-text-primary",
        padded && "p-4 sm:p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  id,
  level = 2,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
  level?: 2 | 3;
  className?: string;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0 flex-1 basis-56">
        <H id={id} className={cn("font-display font-semibold text-text-primary", level === 2 ? "text-lg" : "text-base")}>{title}</H>
        {description && <p className="mt-1 max-w-[68ch] text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A divided list inside a panel: rows separated by hairlines, no inner cards. */
export function DividedList({ className, children, ...rest }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={cn("divide-y divide-border-subtle", className)} {...rest}>
      {children}
    </ul>
  );
}
