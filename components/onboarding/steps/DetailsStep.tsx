"use client";

import React, { useRef, useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusChip";
import { useEoraSafe } from "@/lib/client/eora/provider";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import type { AcademicDetails } from "@/lib/client/onboarding/types";
import { StepFooter, StepHeader } from "../OnboardingShell";

const YEARS = ["1st year", "2nd year", "3rd year", "4th year", "Final year", "Postgraduate", "Graduated", "Working"];

export function DetailsStep({ initial, isAuthenticated, fromCv, saving, guide, onBack, onContinue }: {
  initial: AcademicDetails;
  isAuthenticated: boolean;
  /** Fields pre-filled from the CV (shown with a source tag). */
  fromCv: string[];
  saving: boolean;
  guide: React.ReactNode;
  onBack: () => void;
  onContinue: (details: AcademicDetails) => void;
}) {
  const eora = useEoraSafe();
  const [form, setForm] = useState<AcademicDetails>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof AcademicDetails, string>>>({});
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof AcademicDetails>(k: K, v: AcademicDetails[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) { setErrors((e) => ({ ...e, [k]: undefined })); eora?.clearFieldError(String(k)); }
  };
  const cv = (k: string) => (fromCv.includes(k) ? <Tag>From CV</Tag> : undefined);

  const validate = () => {
    const e: Partial<Record<keyof AcademicDetails, string>> = {};
    if (!form.fullName.trim()) e.fullName = "Add your full name.";
    if (!form.email.trim()) e.email = "Add your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "That email address looks incomplete, e.g. name@university.edu.";
    if (!isAuthenticated && (!form.password || form.password.length < 6)) e.password = "Use at least 6 characters.";
    if (!form.institution.trim()) e.institution = "Add your college, university or employer.";
    if (!form.degree.trim()) e.degree = "Add your degree, e.g. B.Tech, B.Sc, M.S.";
    if (form.expectedGraduationYear && !/^(19|20)\d{2}$/.test(String(form.expectedGraduationYear))) e.expectedGraduationYear = "Use a four-digit year, e.g. 2027.";
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      eora?.signalFieldError(first, first, String(e[first as keyof AcademicDetails]));
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return false;
    }
    return true;
  };

  const submit = () => { if (validate()) onContinue({ ...form, fullName: form.fullName.trim(), institution: form.institution.trim() }); };
  useEoraStepEvents({ onNext: submit, onBack });

  return (
    <>
      <StepHeader
        title={fromCv.length ? "Check the details we couldn't fill" : "A few details about you"}
        description={isAuthenticated ? "These identify your profile. Fields from your CV are marked." : "These identify your profile and create your account, so you can come back to it."}
        guide={guide}
      />
      <form
        ref={formRef}
        noValidate
        data-eora-id="eora-academic-form"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="mt-6 flex flex-col gap-6"
      >
        {/* SECTION 1: Personal & Account Identity */}
        <div className="rounded-card border border-line-soft bg-bg-surface p-5 sm:p-6 shadow-card">
          <div className="mb-4 border-b border-line-soft pb-3">
            <h3 className="font-display text-sm font-semibold text-warm-ivory tracking-wide">
              Personal Information
            </h3>
            <p className="mt-0.5 text-xs text-text-muted">
              Your name and primary contact details for verification and workspace access.
            </p>
          </div>

          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <TextField
              id="field-fullname"
              wrapperClassName="sm:col-span-2"
              label="Full name"
              required
              autoComplete="name"
              placeholder="e.g. Jane Doe"
              value={form.fullName}
              error={errors.fullName}
              aside={cv("fullName")}
              onChange={(e) => set("fullName", e.target.value)}
            />
            <TextField
              id="field-email"
              label="Email"
              required
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@university.edu"
              value={form.email}
              error={errors.email}
              aside={cv("email")}
              onChange={(e) => set("email", e.target.value)}
              disabled={isAuthenticated && Boolean(initial.email)}
              hint={isAuthenticated && initial.email ? "Your account email." : undefined}
            />
            <TextField
              label="Mobile (optional)"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={form.mobile}
              aside={cv("mobile")}
              onChange={(e) => set("mobile", e.target.value)}
            />
            {!isAuthenticated && (
              <div className="flex items-end gap-2 sm:col-span-2">
                <TextField
                  wrapperClassName="flex-1"
                  label="Create a password"
                  required
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={form.password ?? ""}
                  error={errors.password}
                  hint="At least 6 characters."
                  onChange={(e) => set("password", e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className={errors.password ? "mb-7 w-11 px-0 shrink-0" : "mb-5 w-11 px-0 shrink-0"}
                  aria-pressed={show}
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow((v) => !v)}
                >
                  {show ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: Academic / Institutional Background */}
        <div className="rounded-card border border-line-soft bg-bg-surface p-5 sm:p-6 shadow-card">
          <div className="mb-4 border-b border-line-soft pb-3">
            <h3 className="font-display text-sm font-semibold text-warm-ivory tracking-wide">
              Academic & Professional Details
            </h3>
            <p className="mt-0.5 text-xs text-text-muted">
              Used to align career roadmaps and verify prerequisite eligibility.
            </p>
          </div>

          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <TextField
              wrapperClassName="sm:col-span-2"
              label="College, university or employer"
              required
              autoComplete="organization"
              placeholder="e.g. Stanford University or Tech Corp"
              value={form.institution}
              error={errors.institution}
              aside={cv("institution")}
              onChange={(e) => set("institution", e.target.value)}
            />
            <TextField
              label="Degree"
              required
              placeholder="e.g. B.Tech, B.Sc, M.S."
              value={form.degree}
              error={errors.degree}
              aside={cv("degree")}
              onChange={(e) => set("degree", e.target.value)}
            />
            <TextField
              label="Field of study"
              placeholder="e.g. Computer Science, AI/ML"
              value={form.department}
              aside={cv("department")}
              onChange={(e) => set("department", e.target.value)}
            />
            <SelectField
              label="Where you are now"
              value={form.currentYear}
              onChange={(e) => set("currentYear", e.target.value)}
            >
              <option value="">Choose…</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              {form.currentYear && !YEARS.includes(form.currentYear) && <option value={form.currentYear}>{form.currentYear}</option>}
            </SelectField>
            <TextField
              label="Graduation year"
              inputMode="numeric"
              placeholder="2027"
              value={form.expectedGraduationYear ? String(form.expectedGraduationYear) : ""}
              error={errors.expectedGraduationYear}
              aside={cv("expectedGraduationYear")}
              onChange={(e) => set("expectedGraduationYear", e.target.value ? Number(e.target.value.replace(/\D/g, "").slice(0, 4)) : undefined)}
            />
          </div>
        </div>

        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      <StepFooter onBack={onBack} onNext={submit} saving={saving} />
    </>
  );
}
