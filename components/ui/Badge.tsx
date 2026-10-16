import React from "react";
import { cn } from "@/lib/client/cn";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("badge", className)}>{children}</span>;
}
