"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { StepFooter, StepHeader } from "../OnboardingShell";

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
      <StepHeader title="Your faculty account" description="Verification tools unlock after your institution approves your account. Until then you can explore the workspace." guide={guide} />
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-6 grid gap-4 sm:grid-cols-2">
        <TextField wrapperClassName="sm:col-span-2" label="Full name" required value={d.name} error={errors.name} onChange={(e) => set("name", e.target.value)} />
        <TextField label="Institution" required value={d.institution} error={errors.institution} onChange={(e) => set("institution", e.target.value)} />
        <TextField label="Department" value={d.department} onChange={(e) => set("department", e.target.value)} />
        <TextField label="Institution email" required type="email" value={d.email} error={errors.email} onChange={(e) => set("email", e.target.value)} />
        {!isAuthenticated && <TextField label="Create a password" required type="password" autoComplete="new-password" value={d.password} error={errors.password} onChange={(e) => set("password", e.target.value)} />}
        {serverError && <Banner kind="danger" className="sm:col-span-2">{serverError}</Banner>}
      </form>
      <StepFooter onBack={onBack} secondary={<Button variant="primary" loading={submitting} loadingLabel="Creating…" onClick={() => void submit()}>Create faculty account</Button>} />
    </>
  );
}
