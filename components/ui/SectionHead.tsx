import React from "react";
import { cn } from "@/lib/client/cn";
import { Label, type LabelVariant } from "./Label";

export function SectionHead({
  label,
  labelVariant = "warm",
  title,
  lede,
  align = "center",
  className,
}: {
  label?: React.ReactNode;
  labelVariant?: LabelVariant;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={cn("section-head", align === "center" && "center", className)}>
      {label && <Label variant={labelVariant}>{label}</Label>}
      <h2 className="h2">{title}</h2>
      {lede && <p className="lede">{lede}</p>}
    </div>
  );
}
