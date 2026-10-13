"use client";

import React, { useEffect, useState, useRef } from "react";
import { CheckCircle2, Circle, Loader2, AlertCircle, Clock } from "lucide-react";
import { parseSafeJsonResponse } from "@/lib/api/safe-api-response";

export type ProcessingJob = {
  id: string;
  sourceId: string;
  stage: string;
  status: "queued" | "running" | "processing" | "review_ready" | "completed" | "failed" | "retry" | "timed_out" | "cancelled";
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

const stages = ["acquire", "parse", "extract", "validate", "persist"];
const labels: Record<string, string> = {
  acquire: "Source received",
  parse: "Reading source",
  extract: "Extracting details",
  validate: "Checking source evidence",
  persist: "Saved for review",
};

export function ProcessingActivity({
  source,
  activeJobId,
  hideWhenIdle = false,
  onTerminalState,
}: {
  source?: string;
  activeJobId?: string | null;
  hideWhenIdle?: boolean;
  onTerminalState?: (job: ProcessingJob) => void;
}) {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const pollCountRef = useRef(0);
  const maxPolls = 45; // Max 45 seconds polling to prevent infinite loops

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const load = async () => {
      pollCountRef.current += 1;
      try {
        const query = activeJobId ? `?jobId=${encodeURIComponent(activeJobId)}` : "";
        const response = await fetch(`/api/student/processing-jobs${query}`, {
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        });

        const safe = await parseSafeJsonResponse<{ jobs: ProcessingJob[] }>(response);
        if (cancelled) return;

        if (safe.ok && safe.data && Array.isArray(safe.data.jobs)) {
          const fetchedJobs = safe.data.jobs;
          setJobs(fetchedJobs);

          // Check if visible jobs reached terminal state
          const relevant = fetchedJobs.filter((j) => (!source || j.sourceId === source) && (!activeJobId || j.id === activeJobId));
          const allTerminal = relevant.length > 0 && relevant.every((j) =>
            j.status === "completed" || j.status === "failed" || j.status === "timed_out" || j.status === "cancelled"
          );

          if (allTerminal && relevant[0]) {
            onTerminalState?.(relevant[0]);
            if (timer) window.clearInterval(timer);
            return;
          }
        }
      } catch {
        // Safe keep last known state during transient error
      }

      if (pollCountRef.current >= maxPolls && timer) {
        window.clearInterval(timer);
      }
    };

    void load();
    timer = window.setInterval(load, 1200);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [activeJobId, source, onTerminalState]);

  const visible = jobs
    .filter((job) => (!source || job.sourceId === source) && (!activeJobId || job.id === activeJobId))
    .slice(0, source || activeJobId ? 1 : 8);

  if (visible.length === 0) return null;

  const hasActiveJobs = visible.some((j) => j.status === "queued" || j.status === "running" || j.status === "processing");

  // If no specific activeJobId is tracked, do not show historical terminal jobs when idle
  if (!activeJobId && !hasActiveJobs) {
    return null;
  }

  // If hideWhenIdle is set and no visible jobs are running or in progress, omit
  if (hideWhenIdle && !hasActiveJobs) {
    return null;
  }

  return (
    <section
      aria-live="polite"
      style={{
        marginTop: 18,
        padding: 16,
        border: "1px solid #DDE3F0",
        borderRadius: 14,
        background: "#FFFFFF",
      }}
    >
      <strong style={{ color: "#1E1B4B", fontSize: 14 }}>Extraction activity</strong>
      {visible.map((job) => {
        const isFailed = job.status === "failed" || job.status === "retry";
        const isTimedOut = job.status === "timed_out";
        const isDone = job.status === "completed";
        const profileOnly = job.metadata?.acquisitionStatus === "PROFILE_LINK_ONLY";
        const current = stages.indexOf(job.stage);

        return (
          <div key={job.id} style={{ marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: isFailed || isTimedOut ? "#DC2626" : isDone ? "#059669" : "#334155",
              }}
            >
              {isFailed ? (
                <AlertCircle size={16} />
              ) : isTimedOut ? (
                <Clock size={16} />
              ) : isDone ? (
                <CheckCircle2 size={16} color="#059669" />
              ) : (
                <Loader2 size={16} className="animate-spin" />
              )}
              <strong style={{ textTransform: "capitalize" }}>{job.sourceId.replaceAll("_", " ")}</strong>
              <span>
                {isFailed
                  ? "Failed"
                  : isTimedOut
                  ? "Timed Out"
                  : profileOnly
                  ? "Profile linked — no data extracted"
                  : isDone
                  ? "Extraction complete — review required"
                  : "Processing"}
              </span>
            </div>

            {(isFailed || isTimedOut) && job.errorMessage && (
              <p style={{ color: "#B91C1C", fontSize: 12, margin: "6px 0" }}>{job.errorMessage}</p>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              {stages.map((stage, index) => {
                const complete = (isDone && (!profileOnly || index <= 1)) || (!isFailed && !isTimedOut && !isDone && current > index);
                const active = !isDone && !isFailed && !isTimedOut && current === index;
                return (
                  <span
                    key={stage}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: complete ? "#059669" : active ? "#4F46E5" : "#94A3B8",
                    }}
                  >
                    {complete ? (
                      <CheckCircle2 size={13} />
                    ) : active ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Circle size={13} />
                    )}
                    {labels[stage]}
                  </span>
                );
              })}
            </div>

            {isDone && typeof job.metadata?.candidates === "number" && (
              <small style={{ color: "#64748B", display: "block", marginTop: 4 }}>
                {job.metadata.candidates} claims ready to review
              </small>
            )}
          </div>
        );
      })}
    </section>
  );
}
