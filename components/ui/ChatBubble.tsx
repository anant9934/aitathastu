import React from "react";
import { cn } from "@/lib/client/cn";

export function ChatBubble({
  children,
  role = "ai",
  className,
  typing = false,
}: {
  children?: React.ReactNode;
  role?: "ai" | "user";
  className?: string;
  typing?: boolean;
}) {
  return (
    <div
      className={cn(
        "msg show",
        role === "ai" ? "msg ai" : "msg user",
        className,
      )}
    >
      {typing ? (
        <div className="typing" aria-label="EORA is thinking">
          <i />
          <i />
          <i />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
