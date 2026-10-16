import React from "react";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** Same geometry as the loaded dashboard, so nothing jumps when data arrives (Task 3.3.1). */
export function DashboardSkeleton() {
  return (
    <LoadingRegion label="Loading your dashboard" className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-6 lg:px-8">
      <div className="flex gap-2 border-b border-line py-2.5">{[72, 120, 110, 96].map((w, i) => <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />)}</div>
      <div className="pt-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="bg-surface p-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-2 h-7 w-12" /><Skeleton className="mt-2 h-3 w-28" /></div>)}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Skeleton className="h-64 rounded-[var(--radius-panel)]" />
          <Skeleton className="h-64 rounded-[var(--radius-panel)]" />
        </div>
      </div>
      <Skeleton className="mt-10 h-6 w-56" />
      <Skeleton className="mt-3 h-48 rounded-[var(--radius-panel)]" />
    </LoadingRegion>
  );
}
