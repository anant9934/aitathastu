import React from "react";
import {
  CheckCircle,
  CircleDashed,
  Clock,
  Info,
  SealCheck,
  Stack,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";

/**
 * Evidence and state vocabulary. Status is never colour alone: every chip
 * carries an icon and a word (PHASE3_COLOR_SYSTEM_PROPOSAL.md).
 */
export type Tone = "verified" | "corroborated" | "evidenced" | "gap" | "warning" | "danger" | "neutral" | "signal" | "busy";

const TONES: Record<Tone, { cls: string; icon: Icon }> = {
  verified: { cls: "text-verified bg-verified-bg border-verified/35", icon: SealCheck },
  corroborated: { cls: "text-corroborated bg-corroborated-bg border-corroborated/35", icon: Stack },
  evidenced: { cls: "text-evidenced bg-evidenced-bg border-evidenced/35", icon: CheckCircle },
  gap: { cls: "text-text-muted bg-bg-elevated/80 border-border-medium border-dashed", icon: CircleDashed },
  warning: { cls: "text-warning bg-warning-bg border-warning/35", icon: WarningCircle },
  danger: { cls: "text-danger bg-danger-bg border-danger/35", icon: XCircle },
  neutral: { cls: "text-text-muted bg-bg-elevated border-border-medium", icon: Info },
  signal: { cls: "text-accent-warm-bright bg-accent-warm-bright/10 border-accent-warm-bright/35", icon: Info },
  busy: { cls: "text-text-muted bg-bg-elevated border-border-medium", icon: Clock },
};

export function StatusChip({
  tone,
  children,
  icon,
  className,
  size = "md",
}: {
  tone: Tone;
  children: React.ReactNode;
  /** Overrides the tone's default icon; pass null to hide it (only when the word alone is unambiguous). */
  icon?: Icon | null;
  className?: string;
  size?: "md" | "sm";
}) {
  const t = TONES[tone];
  const Glyph = icon === undefined ? t.icon : icon;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border font-medium leading-none whitespace-nowrap",
        size === "md" ? "h-6 px-2 text-xs" : "h-5 px-1.5 text-2xs",
        t.cls,
        className,
      )}
    >
      {Glyph && <Glyph size={size === "md" ? 14 : 12} weight="bold" aria-hidden="true" className="shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Neutral metadata tag, e.g. a technology or a source name. */
export function Tag({ children, className, mono }: { children: React.ReactNode; className?: string; mono?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center rounded-md border border-border-medium bg-tag-bg px-2 text-xs text-tag-fg",
        mono && "font-mono tabular",
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
