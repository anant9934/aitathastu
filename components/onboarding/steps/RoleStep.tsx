"use client";

import React, { useState } from "react";
import { Briefcase, Buildings, ChalkboardTeacher, Certificate, GraduationCap, Handshake } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Banner } from "@/components/ui/Banner";
import { StatusChip } from "@/components/ui/StatusChip";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";

const ROLES: { id: string; title: string; subtitle: string; icon: Icon; available: boolean }[] = [
  { id: "student", title: "Student or career switcher", subtitle: "Build a verified AI/ML profile, see your gaps, plan your next step.", icon: GraduationCap, available: true },
  { id: "faculty", title: "Faculty", subtitle: "Verify student evidence and mentor. Needs institution approval.", icon: ChalkboardTeacher, available: false },
  { id: "professional", title: "Professional", subtitle: "Review work and collaborate on projects.", icon: Briefcase, available: false },
  { id: "mentor", title: "Mentor", subtitle: "Run mock assessments and guide engineers.", icon: Handshake, available: false },
  { id: "alumni", title: "Alumni", subtitle: "Connect with students from your institution.", icon: Certificate, available: false },
  { id: "organization", title: "Organisation", subtitle: "Find talent through real project evidence.", icon: Buildings, available: false },
];

export function RoleStep({ initialRole, saving, guide, onBack, onContinue }: {
  initialRole: string;
  saving: boolean;
  guide: React.ReactNode;
  onBack: () => void;
  onContinue: (role: string) => void;
}) {
  const [role, setRole] = useState(initialRole || "student");
  const [notice, setNotice] = useState<string | null>(null);
  const next = () => onContinue(role);
  useEoraStepEvents({ onNext: next, onBack });

  return (
    <>
      <StepHeader title="Which best describes you?" description="This decides what your workspace is built around." guide={guide} />
      <div role="radiogroup" aria-label="Your role" data-eora-id="eora-role-select" className="mt-6 grid gap-2 sm:grid-cols-2">
        {ROLES.map((r) => {
          const checked = role === r.id;
          const Glyph = r.icon;
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!r.available || undefined}
              data-eora-id={r.id === "student" ? "eora-role-student" : `eora-role-${r.id}`}
              onClick={() => {
                if (!r.available) { setNotice(`The ${r.title.toLowerCase()} workspace isn't open yet. Student onboarding is available today.`); return; }
                setNotice(null);
                setRole(r.id);
              }}
              className={cn(
                "flex min-h-20 cursor-pointer items-start gap-3 rounded-[var(--radius-panel)] border p-4 text-left transition-colors duration-150",
                checked ? "border-signal bg-signal-tint" : "border-line bg-surface hover:border-line-strong",
                !r.available && "cursor-not-allowed opacity-70 hover:border-line",
              )}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] border", checked ? "border-signal/50 text-signal" : "border-line text-muted")}>
                <Glyph size={20} weight={checked ? "fill" : "regular"} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {r.title}
                  {!r.available && <StatusChip tone="neutral" size="sm" icon={null}>Coming later</StatusChip>}
                </span>
                <span className="mt-1 block text-sm text-muted">{r.subtitle}</span>
              </span>
            </button>
          );
        })}
      </div>
      {notice && <Banner kind="info" className="mt-4">{notice}</Banner>}
      <StepFooter onBack={onBack} onNext={next} saving={saving} />
    </>
  );
}
