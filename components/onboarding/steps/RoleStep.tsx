"use client";

import React, { useState } from "react";
import {
  Briefcase,
  Buildings,
  ChalkboardTeacher,
  Certificate,
  GraduationCap,
  Handshake,
  Check,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Banner } from "@/components/ui/Banner";
import { StatusChip } from "@/components/ui/StatusChip";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";

interface RoleOption {
  id: string;
  title: string;
  subtitle: string;
  icon: Icon;
  available: boolean;
  highlights?: string[];
}

const PRIMARY_ROLES: RoleOption[] = [
  {
    id: "student",
    title: "Student or Career Switcher",
    subtitle: "Build a verified AI/ML portfolio, uncover your exact skill gaps, and prove your capabilities with code.",
    icon: GraduationCap,
    available: true,
    highlights: [
      "Discover & verify GitHub, Kaggle & papers",
      "Interactive AI/ML prerequisite roadmap",
      "Evidence-backed skill portfolio",
    ],
  },
  {
    id: "faculty",
    title: "Faculty & Academic Mentor",
    subtitle: "Verify student evidence, track cohort progress, and review submissions with institutional verification.",
    icon: ChalkboardTeacher,
    available: false,
    highlights: [
      "Cohort evidence & skill analytics",
      "Institutional project verification",
      "Requires institutional account approval",
    ],
  },
];

const OTHER_ROLES: RoleOption[] = [
  { id: "professional", title: "Professional", subtitle: "Review work and collaborate on industry AI projects.", icon: Briefcase, available: false },
  { id: "mentor", title: "Mentor", subtitle: "Run mock assessments and guide aspiring AI engineers.", icon: Handshake, available: false },
  { id: "alumni", title: "Alumni", subtitle: "Connect with students and alumni from your institution.", icon: Certificate, available: false },
  { id: "organization", title: "Organisation", subtitle: "Find verified AI/ML talent through project evidence.", icon: Buildings, available: false },
];

export function RoleStep({
  initialRole,
  saving,
  guide,
  onBack,
  onContinue,
}: {
  initialRole: string;
  saving: boolean;
  guide: React.ReactNode;
  onBack: () => void;
  onContinue: (role: string) => void;
}) {
  const [role, setRole] = useState(initialRole || "student");
  const [notice, setNotice] = useState<string | null>(null);
  const radioRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const next = () => onContinue(role);
  useEoraStepEvents({ onNext: next, onBack });

  const handleSelect = (r: RoleOption) => {
    if (!r.available) {
      setNotice(`The ${r.title.toLowerCase()} workspace isn't open yet. Student onboarding is available today.`);
      return;
    }
    setNotice(null);
    setRole(r.id);
    radioRefs.current[r.id]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (index + 1) % PRIMARY_ROLES.length;
      handleSelect(PRIMARY_ROLES[nextIndex]);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (index - 1 + PRIMARY_ROLES.length) % PRIMARY_ROLES.length;
      handleSelect(PRIMARY_ROLES[prevIndex]);
    }
  };

  return (
    <>
      <StepHeader
        title="Which best describes you?"
        description="Choose the primary focus of your workspace. Everything in AI Tathastu is tailored around this choice."
        guide={guide}
      />

      <div
        role="radiogroup"
        aria-label="Your platform role"
        data-eora-id="eora-role-select"
        className="mt-6 flex flex-col gap-6"
      >
        {/* Primary 2 Prominent Roles */}
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
          {PRIMARY_ROLES.map((r, i) => {
            const checked = role === r.id;
            const Glyph = r.icon;
            return (
              <div
                key={r.id}
                ref={(el) => { radioRefs.current[r.id] = el; }}
                role="radio"
                tabIndex={checked || (!role && i === 0) ? 0 : -1}
                aria-checked={checked}
                aria-disabled={!r.available || undefined}
                data-eora-id={r.id === "student" ? "eora-role-student" : `eora-role-${r.id}`}
                onClick={() => handleSelect(r)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    handleSelect(r);
                  } else {
                    handleKeyDown(e, i);
                  }
                }}
                className={cn(
                  "relative flex cursor-pointer flex-col justify-between rounded-card border p-5 sm:p-6 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent-warm focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary shadow-card",
                  checked
                    ? "border-accent-warm-bright bg-accent-warm-bright/10 text-text-primary shadow-[0_0_28px_rgba(196,138,90,0.18)]"
                    : "border-border-medium bg-bg-elevated text-text-primary hover:border-accent-warm hover:bg-bg-elevated/80",
                  !r.available && "cursor-not-allowed opacity-65 hover:border-border-medium",
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "grid size-12 shrink-0 place-items-center rounded-panel border transition-colors",
                        checked
                          ? "border-accent-warm-bright/60 bg-accent-warm-bright/15 text-accent-warm-bright shadow-[0_0_12px_rgba(196,138,90,0.25)]"
                          : "border-border-medium bg-deep-espresso text-text-dim",
                      )}
                    >
                      <Glyph size={24} weight={checked ? "fill" : "regular"} aria-hidden="true" />
                    </span>
                    <div className="flex items-center gap-2">
                      {r.available ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-verified-bg border border-verified/30 px-2 py-0.5 text-2xs font-semibold text-verified uppercase tracking-wider">
                          <Sparkle size={10} weight="fill" /> Active
                        </span>
                      ) : (
                        <StatusChip tone="neutral" size="sm" icon={null}>Coming soon</StatusChip>
                      )}
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-full border transition-all",
                          checked
                            ? "border-accent-warm-bright bg-accent-warm-bright text-espresso"
                            : "border-border-medium bg-bg-primary",
                        )}
                        aria-hidden="true"
                      >
                        {checked && <Check size={12} weight="bold" />}
                      </span>
                    </div>
                  </div>

                  <h2 className="mt-4 font-display text-lg font-bold text-text-primary sm:text-xl">
                    {r.title}
                  </h2>
                  <p className="mt-2 text-sm text-text-muted leading-relaxed">
                    {r.subtitle}
                  </p>

                  {r.highlights && (
                    <ul className="mt-4 space-y-1.5 border-t border-border-medium/60 pt-3 text-xs text-text-muted">
                      {r.highlights.map((h) => (
                        <li key={h} className="flex items-center gap-2">
                          <Check size={13} weight="bold" className={checked ? "text-accent-warm-bright" : "text-text-dim"} />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Other Upcoming Roles Section */}
        <div className="rounded-card border border-border-subtle bg-bg-elevated/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            Other upcoming workspace paths
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {OTHER_ROLES.map((r) => {
              const Glyph = r.icon;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-md border border-line-soft bg-bg-surface/60 p-3 text-left opacity-60 cursor-not-allowed select-none"
                  aria-hidden="true"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line-soft bg-deep-espresso text-text-dim">
                    <Glyph size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-text-primary">
                      {r.title}
                    </span>
                    <span className="block truncate text-2xs text-text-dim">
                      Coming later
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {notice && <Banner kind="info" className="mt-4">{notice}</Banner>}

      <StepFooter onBack={onBack} onNext={next} saving={saving} />
    </>
  );
}
