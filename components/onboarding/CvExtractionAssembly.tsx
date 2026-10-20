"use client";

import React from "react";
import {
  Sparkle,
  FileText,
  GraduationCap,
  Code,
  Briefcase,
  Trophy,
  ArrowUp,
  Clock,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { EioraVisual } from "@/components/eora/EioraVisual";

interface CvExtractionAssemblyProps {
  fileName?: string | null;
  stage?: string;
  state?: string;
}

const EXTRACTED_PREVIEW_BUCKETS = [
  { label: "Education & Degree", icon: GraduationCap, category: "Academic Credentials", delay: "0.2s" },
  { label: "Technical Skills & Taxonomy", icon: Code, category: "Skills Graph", delay: "0.4s" },
  { label: "Engineering Projects & Repos", icon: Briefcase, category: "Evidence Ledger", delay: "0.6s" },
  { label: "Achievements & Awards", icon: Trophy, category: "Verified Milestones", delay: "0.8s" },
  { label: "External Footprints & Links", icon: Code, category: "Connectors", delay: "1.0s" },
];

export function CvExtractionAssembly({ fileName, stage, state = "PROCESSING" }: CvExtractionAssemblyProps) {
  // Truthful phase information derived directly from server state
  const isUploading = state === "UPLOADING";
  const isQueued = state === "QUEUED";
  const isSaving = state === "SAVING";
  const isExtracting = !isUploading && !isQueued && !isSaving;

  const currentPhaseTitle = isUploading
    ? "Document Vault Upload"
    : isQueued
    ? "Worker Queue Assigned"
    : isSaving
    ? "Saving Confirmed Decisions"
    : stage || "Neural Pattern Deconstruction";

  const phaseStepBadge = isUploading
    ? "Phase 1/3 · Secure Transfer"
    : isQueued
    ? "Phase 2/3 · Queue Scheduled"
    : isSaving
    ? "Finalizing · Committing"
    : "Phase 3/3 · Ingestion in Flight";

  return (
    <div
      role="region"
      aria-label="CV Extraction Assembly"
      className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/30 bg-[#FAF6F0] dark:bg-[#141413] p-6 sm:p-8 shadow-xl backdrop-blur-md"
    >
      {/* Top Header: Truthful Phase & Server Stage */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EFECE6] dark:border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-[#141413] dark:bg-[#FAF6F0] flex items-center justify-center text-[#D4AF37] dark:text-[#141413]">
            {isUploading ? (
              <ArrowUp size={20} weight="bold" className="animate-bounce" />
            ) : isQueued ? (
              <Clock size={20} weight="bold" />
            ) : (
              <Sparkle size={20} weight="fill" className="animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#141413] text-[#D4AF37] font-mono text-3xs font-bold uppercase tracking-widest border border-[#D4AF37]/30">
                {phaseStepBadge}
              </span>
              <span className="font-mono text-3xs text-[#5A5852] dark:text-[#EFECE6]/70">
                {isUploading ? "Uploading" : isQueued ? "Queued" : "Active Pipeline"}
              </span>
            </div>
            <p className="font-editorial text-xl sm:text-2xl font-bold text-[#141413] dark:text-[#F8F6F0] mt-1">
              {currentPhaseTitle}
            </p>
          </div>
        </div>

        {/* Indeterminate Pulse Indicator instead of fake % timer */}
        <div className="flex items-center gap-2.5 rounded-full border border-[#D4AF37]/25 bg-white/70 dark:bg-white/5 px-4 py-2 shadow-xs">
          <span className="size-2 rounded-full bg-[#D4AF37] animate-ping" />
          <span className="font-mono text-xs font-semibold text-[#141413] dark:text-[#F8F6F0]">
            {isUploading ? "Transmitting…" : isQueued ? "Worker Waiting…" : "Processing…"}
          </span>
        </div>
      </div>

      {/* Indeterminate Shimmer Progress Bar */}
      <div
        role="progressbar"
        aria-label="Extraction operation progress"
        aria-busy="true"
        className="relative my-4 h-1.5 w-full overflow-hidden rounded-full bg-[#EFECE6] dark:bg-white/10"
      >
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-[#D4AF37]/40 via-[#D4AF37] to-[#E05A47] animate-[shimmer_2s_infinite]" />
      </div>

      {/* Center Interactive Assembly Canvas */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Document Source with scanning ray */}
        <div className="lg:col-span-4 flex flex-col items-center">
          <div className="relative w-48 rounded-xl border-2 border-dashed border-[#D4AF37]/40 bg-white dark:bg-white/5 p-5 shadow-sm overflow-hidden text-left">
            {/* Laser Scan Bar (Active when extracting) */}
            {isExtracting && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent shadow-[0_0_12px_#D4AF37] animate-[bounce_2.5s_infinite]" />
            )}

            <div className="flex items-center gap-2 mb-3 text-[#141413] dark:text-[#F8F6F0]">
              <FileText size={20} className="text-[#D4AF37]" weight="fill" />
              <span className="font-sans text-xs font-bold truncate max-w-[120px]">
                {fileName || "CV Document"}
              </span>
            </div>

            {/* Skeleton document lines */}
            <div className="space-y-2 opacity-60">
              <div className="h-2 w-3/4 rounded bg-[#EFECE6] dark:bg-white/20" />
              <div className="h-2 w-full rounded bg-[#EFECE6] dark:bg-white/20" />
              <div className="h-2 w-5/6 rounded bg-[#EFECE6] dark:bg-white/20" />
              <div className="h-2 w-1/2 rounded bg-[#EFECE6] dark:bg-white/20" />
            </div>

            <span className="mt-4 block font-mono text-3xs text-[#5A5852] dark:text-[#EFECE6]/70 uppercase">
              {isUploading ? "Uploading bytes…" : isQueued ? "Queued in runner…" : "Deterministic parsing…"}
            </span>
          </div>
        </div>

        {/* Center: Eiora Orbital Vortex */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center">
          <EioraVisual
            state={isUploading ? "speaking" : "extracting"}
            size={130}
            interactive={false}
          />
          <span className="mt-2 font-mono text-3xs text-[#141413] dark:text-[#EFECE6] uppercase tracking-wider font-semibold">
            {isUploading ? "Document Ingestion" : "Pattern Extraction Active"}
          </span>
        </div>

        {/* Right: Live Identity Schema Preview */}
        <div className="lg:col-span-4 flex flex-col gap-2">
          <span className="font-mono text-3xs uppercase tracking-wider text-[#5A5852] dark:text-[#EFECE6]/70 font-semibold mb-1">
            Target Evidence Schema:
          </span>

          {EXTRACTED_PREVIEW_BUCKETS.map((frag) => {
            const Icon = frag.icon;
            return (
              <div
                key={frag.label}
                className="flex items-center justify-between rounded-xl border border-[#D4AF37]/20 bg-white/80 dark:bg-white/5 px-3.5 py-2 shadow-xs transition-all duration-300"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-6 rounded-md bg-[#141413] text-[#D4AF37] flex items-center justify-center shrink-0">
                    <Icon size={14} weight="bold" />
                  </div>
                  <div className="truncate">
                    <span className="block font-sans text-xs font-semibold text-[#141413] dark:text-[#F8F6F0] truncate">
                      {frag.label}
                    </span>
                    <span className="block font-mono text-3xs text-[#5A5852] dark:text-[#EFECE6]/60">
                      {frag.category}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-3xs rounded-full bg-[#EFECE6] dark:bg-white/10 px-2 py-0.5 text-[#5A5852] dark:text-[#EFECE6] shrink-0 ml-2">
                  Pending Review
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Truthful Note: Extracted vs Confirmed */}
      <div className="mt-6 pt-4 border-t border-[#EFECE6] dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-2xs font-mono text-[#5A5852] dark:text-[#EFECE6]/70">
        <div className="flex items-center gap-2">
          <CheckCircle size={14} weight="bold" className="text-verified" />
          <span>Extracted fields remain unconfirmed candidates until you explicitly tick them.</span>
        </div>
        <span className="hidden sm:inline">DPDP 2023 Compliant · Never trained on unconsented models</span>
      </div>
    </div>
  );
}
