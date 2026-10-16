import React from "react";
import { cn } from "@/lib/client/cn";

export type PillVariant = "live" | "preview" | "illustrative";

export function Pill({
  children,
  variant = "live",
  className,
}: {
  children: React.ReactNode;
  variant?: PillVariant;
  className?: string;
}) {
  if (variant === "illustrative") {
    return <span className={cn("illustrative-note", className)}>{children}</span>;
  }

  return (
    <span className={cn("pill-live", className)}>
      <i aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
