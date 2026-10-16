import React from "react";
import { FileText, Globe, LinkedinLogo } from "@phosphor-icons/react/dist/ssr";
import { siCodechef, siDevdotto, siGithub, siGooglescholar, siHackerearth, siHackerrank, siHuggingface, siKaggle, siLeetcode, siOrcid, siStackoverflow } from "simple-icons";
import { cn } from "@/lib/client/cn";

/**
 * A source's mark, drawn in one colour (currentColor) at one size. Brand paths
 * come from Simple Icons (CC0), unaltered; LinkedIn is not in that set, so it
 * uses the icon library's mark. Nothing is redrawn by hand.
 */
const BRAND: Record<string, { path: string; title: string }> = {
  github: siGithub, kaggle: siKaggle, leetcode: siLeetcode, hackerrank: siHackerrank, huggingface: siHuggingface,
  orcid: siOrcid, google_scholar: siGooglescholar, scholar: siGooglescholar, stackoverflow: siStackoverflow,
  devto: siDevdotto, codechef: siCodechef, hackerearth: siHackerearth,
};

export function SourceMark({ id, size = "md", className }: { id: string; size?: "sm" | "md"; className?: string }) {
  const box = size === "md" ? "size-10" : "size-8";
  const glyph = size === "md" ? 20 : 17;
  const brand = BRAND[id];
  const filled = id === "linkedin";
  const Icon = id === "linkedin" ? LinkedinLogo : id === "portfolio" ? Globe : id === "resume" ? FileText : null;
  return (
    <span aria-hidden="true" className={cn("grid shrink-0 place-items-center rounded-lg border border-border-medium bg-deep-espresso text-champagne", box, className)}>
      {brand ? (
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="currentColor"><path d={brand.path} /></svg>
      ) : Icon ? (
        <Icon size={glyph + 2} weight={filled ? "fill" : "regular"} />
      ) : (
        <Globe size={glyph + 2} />
      )}
    </span>
  );
}
