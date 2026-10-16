import React from "react";
import { CheckCircle, Info, WarningCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";

type Kind = "info" | "success" | "warning" | "danger";

const KINDS: Record<Kind, { cls: string; icon: Icon; role: "status" | "alert" }> = {
  info: { cls: "border-border-medium bg-bg-raised text-text-primary", icon: Info, role: "status" },
  success: { cls: "border-verified/40 bg-verified-bg text-text-primary", icon: CheckCircle, role: "status" },
  warning: { cls: "border-warning/40 bg-warning-bg text-text-primary", icon: WarningCircle, role: "status" },
  danger: { cls: "border-danger/40 bg-danger-bg text-text-primary", icon: XCircle, role: "alert" },
};

const ICON_TONE: Record<Kind, string> = {
  info: "text-text-muted",
  success: "text-verified",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * Inline message tied to a region. Errors say what happened and how to recover;
 * pass the recovery control in `action`.
 */
export function Banner({
  kind = "info",
  title,
  children,
  action,
  className,
  live = true,
}: {
  kind?: Kind;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Set false for static banners that should not be announced. */
  live?: boolean;
}) {
  const k = KINDS[kind];
  const Glyph = k.icon;
  return (
    <div
      role={live ? k.role : undefined}
      className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[var(--radius-control)] border px-3.5 py-3 text-sm", k.cls, className)}
    >
      <Glyph size={18} weight="bold" aria-hidden="true" className={cn("mt-0.5 shrink-0", ICON_TONE[kind])} />
      <div className="min-w-0 flex-1 basis-48">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn("text-text-muted", Boolean(title) && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
