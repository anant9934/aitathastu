"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { StepFooter, StepHeader } from "../OnboardingShell";

import { Eye, EyeSlash, GraduationCap } from "@phosphor-icons/react/dist/ssr";

type Details = { name: string; institution: string; department: string; email: string; password: string };

/** Faculty account request. Privileged tools stay locked until the institution approves. */
export function FacultyStep({ initial, isAuthenticated, submitting, guide, onBack, onSubmit }: {
  initial: Details;
  isAuthenticated: boolean;
  submitting: boolean;
  guide: React.ReactNode;
  onBack: () => void;
  onSubmit: (d: Details) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [d, setD] = useState<Details>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const set = (k: keyof Details, v: string) => { setD((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const submit = async () => {
    const e: Partial<Record<keyof Details, string>> = {};
    if (!d.name.trim()) e.name = "Add your name.";
    if (!d.institution.trim()) e.institution = "Add your institution.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = "Add your institution email.";
    if (!isAuthenticated && d.password.length < 6) e.password = "Use at least 6 characters.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError(null);
    const r = await onSubmit(d);
    if (!r.ok) setServerError(r.message ?? "Your faculty account wasn't created. Try again.");
  };

  return (
    <>
      <StepHeader
        title="Your faculty account"
        description="Verification tools unlock after your institution approves your account. Until then you can explore the workspace."
        guide={guide}
      />

      <div className="mt-6 flex flex-col gap-6">
        {/* Institutional Verification Notice */}
        <div className="flex items-center gap-3 rounded-card border border-champagne/30 bg-bg-surface p-4 shadow-card">
          <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-champagne/15 text-champagne border border-champagne/30 shrink-0">
            <GraduationCap size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-warm-ivory">Institutional Verification Required</p>
            <p className="text-xs text-text-muted">
              Use your official college or university email (.edu, .ac.in, or university domain) for expedited approval.
            </p>
          </div>
        </div>

        {/* Structured Form Card */}
        <form
          noValidate
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
          className="rounded-card border border-line-soft bg-bg-surface p-5 sm:p-6 shadow-card"
        >
          <div className="mb-4 border-b border-line-soft pb-3">
            <h3 className="font-display text-sm font-semibold text-warm-ivory tracking-wide">
              Faculty Profile Details
            </h3>
            <p className="mt-0.5 text-xs text-text-muted">
              These credentials will identify you across departmental rosters and student assessment boards.
            </p>
          </div>

          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <TextField
              wrapperClassName="sm:col-span-2"
              label="Full name"
              required
              placeholder="Prof. or Dr. Full Name"
              value={d.name}
              error={errors.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <TextField
              label="Institution"
              required
              placeholder="e.g. Stanford University or IIT Delhi"
              value={d.institution}
              error={errors.institution}
              onChange={(e) => set("institution", e.target.value)}
            />
            <TextField
              label="Department"
              placeholder="e.g. Computer Science & Engineering"
              value={d.department}
              onChange={(e) => set("department", e.target.value)}
            />
            <TextField
              wrapperClassName={isAuthenticated ? "sm:col-span-2" : undefined}
              label="Institution email"
              required
              type="email"
              placeholder="faculty@university.edu"
              value={d.email}
              error={errors.email}
              onChange={(e) => set("email", e.target.value)}
            />
            {!isAuthenticated && (
              <div className="flex items-end gap-2">
                <TextField
                  wrapperClassName="flex-1"
                  label="Create a password"
                  required
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={d.password}
                  error={errors.password}
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
            {serverError && <Banner kind="danger" className="sm:col-span-2">{serverError}</Banner>}
          </div>

          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </div>

      <StepFooter
        onBack={onBack}
        secondary={
          <Button
            variant="primary"
            loading={submitting}
            loadingLabel="Creating…"
            onClick={() => void submit()}
            className="flex-1 sm:flex-none sm:min-w-52 font-semibold"
          >
            Create faculty account
          </Button>
        }
      />
    </>
  );
}
