import type React from "react";

/** Leaves for an external authorization page only after pending saves land, so nothing is cut off by the unload. */
export function leaveAfter(beforeLeave?: () => Promise<unknown>) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!beforeLeave) return;
    e.preventDefault();
    const href = e.currentTarget.href;
    void beforeLeave().catch(() => undefined).finally(() => window.location.assign(href));
  };
}
