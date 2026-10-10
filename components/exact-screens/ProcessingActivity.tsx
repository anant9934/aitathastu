"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";

type Job = {
  id: string;
  sourceId: string;
  stage: string;
  status: "queued" | "running" | "completed" | "failed" | "retry";
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

const stages = ["acquire", "parse", "extract", "validate", "persist"];
const labels: Record<string, string> = {
  acquire: "Source received", parse: "Reading source", extract: "Extracting details",
  validate: "Checking source evidence", persist: "Saved for review",
};

export function ProcessingActivity({ source, activeJobId }: { source?: string; activeJobId?: string | null }) {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/student/processing-jobs${activeJobId ? `?jobId=${encodeURIComponent(activeJobId)}` : ""}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setJobs(Array.isArray(data.jobs) ? data.jobs : []);
      } catch { /* Keep last confirmed status during a transient connection error. */ }
    };
    void load();
    const timer = window.setInterval(load, 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeJobId]);

  const visible = jobs.filter((job) => !source || job.sourceId === source).slice(0, source ? 1 : 16);
  if (visible.length === 0) return null;
  return <section aria-live="polite" style={{ marginTop: 18, padding: 16, border: "1px solid #DDE3F0", borderRadius: 14, background: "#FFFFFF" }}>
    <strong style={{ color: "#1E1B4B", fontSize: 14 }}>Extraction activity</strong>
    {visible.map((job) => {
      const failed = job.status === "failed" || job.status === "retry";
      const done = job.status === "completed";
      const profileOnly = job.metadata?.acquisitionStatus === "PROFILE_LINK_ONLY";
      const current = stages.indexOf(job.stage);
      return <div key={job.id} style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: failed ? "#DC2626" : "#334155" }}>
          {failed ? <AlertCircle size={16} /> : done ? <CheckCircle2 size={16} color="#059669" /> : <Loader2 size={16} className="animate-spin" />}
          <strong style={{ textTransform: "capitalize" }}>{job.sourceId.replaceAll("_", " ")}</strong>
          <span>{failed ? "Failed" : profileOnly ? "Profile linked — no data extracted" : done ? "Extraction complete — review required" : "Processing"}</span>
        </div>
        {failed && job.errorMessage && <p style={{ color: "#B91C1C", fontSize: 12, margin: "6px 0" }}>{job.errorMessage}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
          {stages.map((stage, index) => {
            const complete = (done && (!profileOnly || index <= 1)) || (!failed && !done && current > index);
            const active = !done && !failed && current === index;
            return <span key={stage} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: complete ? "#059669" : active ? "#4F46E5" : "#94A3B8" }}>
              {complete ? <CheckCircle2 size={13} /> : active ? <Loader2 size={13} className="animate-spin" /> : <Circle size={13} />}
              {labels[stage]}
            </span>;
          })}
        </div>
        {done && typeof job.metadata?.candidates === "number" && <small style={{ color: "#64748B" }}>{job.metadata.candidates} claims ready to review</small>}
      </div>;
    })}
  </section>;
}
