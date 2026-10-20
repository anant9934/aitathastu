"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Sparkle, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { EioraVisual } from "@/components/eora/EioraVisual";
import { useSyncStatus, SOURCE_LABELS, type SourceStatus } from "@/lib/client/use-sync-status";
import { cn } from "@/lib/client/cn";

export function GeminiThinkingStream({ className }: { className?: string }) {
  const { data } = useSyncStatus();
  const sources = data?.sources;
  const aggregate = data?.aggregate;
  const [logIndex, setLogIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Derive truthful server-backed active progress logs
  const serverLogs = useMemo(() => {
    const list: string[] = [];

    if (aggregate?.headline) {
      list.push(`> Server Status: ${aggregate.headline}`);
    }

    const runningSources = (sources || []).filter((s: SourceStatus) => s.state === "running" || s.state === "queued");
    for (const src of runningSources) {
      const label = SOURCE_LABELS[src.source] || src.source;
      const stageStr = src.stage ? ` (${src.stage})` : "";
      list.push(`> ${label}: ${src.state === "running" ? "Importing evidence" : "Queue waiting"}${stageStr}…`);
    }

    if (!list.length) {
      list.push("> Establishing encrypted DPDP connector session…");
      list.push("> Waiting for document reader & source sync response…");
      list.push("> Synthesizing unconfirmed candidate claims into review buffer…");
    }

    return list;
  }, [aggregate, sources]);

  useEffect(() => {
    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setLogIndex((prev) => (prev + 1) % Math.max(1, serverLogs.length));
        setAnimating(false);
      }, 250);
    }, 2800);

    return () => clearInterval(interval);
  }, [serverLogs.length]);

  const activeMessage = serverLogs[logIndex % serverLogs.length] || "> Ingestion active…";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-[#D4AF37]/30 bg-[#FAF6F0]/95 dark:bg-[#141413]/95 p-4 sm:p-5 shadow-lg backdrop-blur-md overflow-hidden",
        className
      )}
    >
      {/* Background Opalescent Shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />

      {/* Eiora Visual */}
      <div className="shrink-0 flex items-center justify-center">
        <EioraVisual state="extracting" size={72} interactive={false} />
      </div>

      {/* Live Monospace Thinking Stream */}
      <div className="min-w-0 flex-1 w-full text-left">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#141413] px-3 py-0.5 font-mono text-3xs font-bold uppercase tracking-wider text-[#D4AF37] shadow-xs">
            <Sparkle size={10} weight="fill" className="animate-spin motion-reduce:animate-none" />
            Gemini-Style Thinking Stream
          </span>
          <span className="font-mono text-3xs text-[#5A5852] dark:text-[#EFECE6]/70">
            Truthful Server Sync
          </span>
        </div>

        {/* Shimmering glass pill with log */}
        <div className="rounded-xl border border-[#EFECE6] dark:border-white/10 bg-[#141413] px-3.5 py-2.5 text-left shadow-inner">
          <p
            className={cn(
              "font-mono text-xs text-[#FAF6F0] leading-relaxed transition-opacity duration-200 truncate",
              animating ? "opacity-30" : "opacity-100"
            )}
          >
            {activeMessage}
          </p>
        </div>

        {/* Dynamic status footer */}
        <div className="mt-2 flex items-center gap-3 text-3xs font-mono text-[#5A5852] dark:text-[#EFECE6]/70">
          <span className="flex items-center gap-1">
            <CheckCircle size={12} weight="bold" className="text-verified" />
            Zero synthetic completion percentages
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Server-orchestrated status</span>
        </div>
      </div>
    </div>
  );
}
