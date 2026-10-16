import React from "react";
import { cn } from "@/lib/client/cn";

/**
 * The signature move: a thin segmented bar under a claim, one segment per
 * evidence tier behind it, sized by count. The same strip appears on the
 * dashboard, skills map, profile and project ledger, so "how proven is this?"
 * reads the same everywhere. Gap is the only dashed segment.
 */
export type EvidenceTier = "verified" | "corroborated" | "evidenced" | "gap";

export type EvidenceSegment = { tier: EvidenceTier; count: number; label?: string };

const FILL: Record<EvidenceTier, string> = {
  verified: "bg-verified",
  corroborated: "bg-corroborated",
  evidenced: "bg-evidenced",
  gap: "bg-transparent outline outline-1 -outline-offset-1 outline-dashed outline-gap",
};

const WORD: Record<EvidenceTier, string> = {
  verified: "verified",
  corroborated: "corroborated",
  evidenced: "evidenced",
  gap: "not yet shown",
};

export function evidenceSummary(segments: EvidenceSegment[]) {
  const parts = segments.filter((s) => s.count > 0).map((s) => `${s.count} ${s.label ?? WORD[s.tier]}`);
  return parts.length ? parts.join(", ") : "no evidence yet";
}

export function EvidenceStrip({
  segments,
  className,
  height = 6,
  showCounts = false,
  label,
}: {
  segments: EvidenceSegment[];
  className?: string;
  height?: number;
  /** Prints the tier counts after the bar in mono. */
  showCounts?: boolean;
  /** What the strip measures, for the accessible name, e.g. "PyTorch evidence". */
  label?: string;
}) {
  const visible = segments.filter((s) => s.count > 0);
  const total = visible.reduce((n, s) => n + s.count, 0);
  const summary = evidenceSummary(segments);
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div
        role="img"
        aria-label={label ? `${label}: ${summary}` : summary}
        className="flex min-w-0 flex-1 gap-[2px] overflow-hidden rounded-full"
        style={{ height }}
      >
        {total === 0 ? (
          <span className={cn("h-full w-full rounded-full", FILL.gap)} />
        ) : (
          visible.map((s, i) => (
            <span
              key={`${s.tier}-${i}`}
              className={cn("h-full first:rounded-l-full last:rounded-r-full", FILL[s.tier])}
              style={{ flexGrow: s.count, flexBasis: 0, minWidth: 4 }}
            />
          ))
        )}
      </div>
      {showCounts && (
        <span className="shrink-0 font-mono text-2xs tabular text-muted" aria-hidden="true">
          {total === 0 ? "0" : visible.map((s) => s.count).join("·")}
        </span>
      )}
    </div>
  );
}

/** Legend for the strip; render once per view, not per row. */
export function EvidenceLegend({ className, tiers = ["verified", "corroborated", "evidenced", "gap"] }: { className?: string; tiers?: EvidenceTier[] }) {
  const NAME: Record<EvidenceTier, string> = {
    verified: "Verified",
    corroborated: "Corroborated by 2+ sources",
    evidenced: "Evidenced by 1 source",
    gap: "Gap",
  };
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted", className)} aria-label="Evidence key">
      {tiers.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("inline-block h-1.5 w-4 rounded-full", FILL[t])} />
          {NAME[t]}
        </li>
      ))}
    </ul>
  );
}

/** A single labelled 0–100 measure (the "bar" half of bubble + bar). */
export function Meter({ value, label, tone = "signal", className }: { value: number; label: string; tone?: "signal" | "verified" | "evidenced" | "warning"; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const fill = { signal: "bg-signal", verified: "bg-verified", evidenced: "bg-evidenced", warning: "bg-warning" }[tone];
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-300 ease-[var(--ease-out)]", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
