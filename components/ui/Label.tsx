import React from "react";
import { cn } from "@/lib/client/cn";

export type LabelVariant = "warm" | "intel" | "ink";

export function Label({
  children,
  variant = "warm",
  className,
}: {
  children: React.ReactNode;
  variant?: LabelVariant;
  className?: string;
}) {
  const variantClass =
    variant === "intel" ? "label--intel" : variant === "ink" ? "label--ink" : "";
  return <span className={cn("label", variantClass, className)}>{children}</span>;
}
