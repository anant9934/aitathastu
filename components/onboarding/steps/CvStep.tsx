"use client";

import React, { useRef, useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  FileArrowUp,
  FileText,
  LockKey,
  ShieldCheck,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { RESUME_MAX_UPLOAD_MB } from "@/lib/config/upload-limits";
import { FIELD_LABELS, REVIEW_GROUPS, type ResumeIngestion } from "@/lib/client/onboarding/use-resume-ingestion";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { StatusChip } from "@/components/ui/StatusChip";
import { Spinner } from "@/components/ui/Spinner";
import { useConfirm, toast } from "@/components/ui/Feedback";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";

export function CvStep({
  cv,
  saving,
  guide,
  onBack,
  onSaveReview,
  onContinue,
  onSkip,
}: {
  cv: ResumeIngestion;
  saving: boolean;
  guide: React.ReactNode;
  onBack: () => void;
  /** Saves the review and folds it into onboarding; returns an error message or null. */
  onSaveReview: () => Promise<string | null>;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(Boolean(cv.fileName));
  const [aiConsent, setAiConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const confirm = useConfirm();

  const blocked = cv.serviceReady === false;
  const failed = cv.state === "FAILED";
  const inReview = cv.candidates.length > 0 && !cv.reviewSaved;
  const pick = () => {
    if (!blocked && !cv.busy) fileInput.current?.click();
  };

  const next = async () => {
    if (cv.busy) return;
    if (failed || !cv.fileName) {
      onSkip();
      return;
    }
    if (inReview) {
      setReviewError(null);
      const problem = await onSaveReview();
      if (problem) {
        setReviewError(problem);
        return;
      }
      toast.success("CV details saved", "Steps your CV fully covers will be filled in for you.");
    }
    onContinue();
  };
  useEoraStepEvents({ onNext: () => void next(), onBack, enabled: !cv.busy });

  const save = async () => {
    setReviewError(null);
    const problem = await onSaveReview();
    if (problem) setReviewError(problem);
    else toast.success("CV details saved", "Steps your CV fully covers will be filled in for you.");
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Delete this CV?",
      body: "The file and the details read from it are removed. Anything you already accepted into your profile stays until you edit it.",
      confirmLabel: "Delete CV",
      destructive: true,
    });
    if (!ok) return;
    const problem = await cv.remove();
    if (problem) toast.error("The CV wasn't deleted", problem);
    else toast.success("CV deleted");
  };

  const selectedCount = cv.candidates.filter((c) => c.selected).length;

  return (
    <>
      <StepHeader
        title="Add your CV"
        description="We extract your education, skills, projects, and links using deterministic pattern matching. You review and approve every detail before anything is saved."
        guide={guide}
      />

      <div data-eora-id="eora-resume-upload" className="mt-6 flex flex-col gap-6">
        {/* Two-region layout on desktop when candidates are not yet displayed */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-8 items-start">
          {/* Left Region: Upload Dropzone Card */}
          <div className="flex flex-col gap-4">
            <div
              onDragOver={(e) => {
                if (!blocked) {
                  e.preventDefault();
                  setDragging(true);
                }
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!blocked) void cv.upload(e.dataTransfer.files?.[0], consent, aiConsent);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-4 rounded-card border-2 border-dashed p-8 text-center transition-all duration-200 shadow-card min-h-[260px]",
                dragging
                  ? "border-accent-warm-bright bg-accent-warm-bright/10 shadow-[0_0_28px_rgba(244,154,71,0.2)]"
                  : cv.fileName && !failed
                  ? "border-verified/60 bg-bg-elevated"
                  : "border-border-medium bg-bg-elevated hover:border-accent-warm hover:bg-bg-elevated/80",
                blocked && "opacity-70",
              )}
            >
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  void cv.upload(e.target.files?.[0], consent, aiConsent);
                  e.target.value = "";
                }}
              />
              <span
                className={cn(
                  "grid size-14 place-items-center rounded-panel border shadow-sm transition-colors",
                  cv.fileName && !failed
                    ? "border-verified/40 bg-verified-bg text-verified"
                    : "border-border-medium bg-deep-espresso text-accent-warm",
                )}
              >
                {cv.fileName ? (
                  <FileText size={28} aria-hidden="true" />
                ) : (
                  <FileArrowUp size={28} aria-hidden="true" />
                )}
              </span>
              <div>
                <p className="font-display text-base font-bold text-warm-ivory sm:text-lg">
                  {cv.fileName ?? "Drag and drop your CV here"}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Supports PDF or DOCX formats, up to {RESUME_MAX_UPLOAD_MB} MB
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant={cv.fileName ? "secondary" : "primary"}
                  onClick={pick}
                  disabled={blocked || cv.busy}
                  className="font-semibold"
                >
                  {cv.fileName ? "Choose different file" : "Browse files"}
                </Button>
                {cv.fileName && (
                  <Button
                    variant="ghost"
                    onClick={() => void remove()}
                    disabled={blocked || cv.busy}
                    className="text-danger hover:bg-danger/10"
                    icon={<Trash size={16} aria-hidden="true" />}
                  >
                    Delete file
                  </Button>
                )}
              </div>

              <p className="text-2xs text-text-dim" aria-live="polite">
                {cv.serviceReady === null
                  ? "Checking upload service…"
                  : blocked
                  ? "CV upload is temporarily unavailable."
                  : "Upload service active and ready."}
              </p>
            </div>
          </div>

          {/* Right Region: Privacy & Guarantee Box */}
          <div className="flex flex-col gap-4 rounded-card border border-border-medium bg-bg-elevated p-5 sm:p-6 shadow-card">
            <div className="flex items-center gap-2 border-b border-border-medium/60 pb-3">
              <ShieldCheck size={18} weight="bold" className="text-verified" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-warm-ivory">
                Private & Evidence-Driven
              </h2>
            </div>

            <Checkbox
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              label="I agree to have my CV parsed for profile suggestions."
              description="I will review and approve every extracted entry before it is saved to my profile."
            />

            <Checkbox
              checked={aiConsent}
              onChange={(e) => setAiConsent(e.target.checked)}
              label="Enable external AI enrichment (Optional)."
              description="Allows secure external AI to help extract deeper project, publication, and experience details. Deterministic parsing is used by default if unchecked."
            />

            <ul className="mt-2 space-y-2.5 text-xs text-text-muted border-t border-border-medium/60 pt-3">
              <li className="flex items-start gap-2">
                <CheckCircle size={15} weight="bold" className="mt-0.5 shrink-0 text-accent-warm" />
                <span>Pre-fills college details, graduation year, and degree.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={15} weight="bold" className="mt-0.5 shrink-0 text-accent-warm" />
                <span>Identifies GitHub, Kaggle, LinkedIn, and paper links.</span>
              </li>
              <li className="flex items-start gap-2">
                <LockKey size={15} weight="bold" className="mt-0.5 shrink-0 text-verified" />
                <span>Never shared with third parties or used for public AI training.</span>
              </li>
            </ul>
          </div>
        </div>

        {blocked && (
          <Banner kind="warning" title="CV upload is unavailable right now">
            Continue without a CV and enter your details yourself. You can add a CV later from your profile.
          </Banner>
        )}

        {cv.busy && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-card border border-accent-warm/40 bg-bg-elevated p-4 text-sm shadow-card"
          >
            <Spinner size={20} className="text-accent-warm-bright" />
            <span className="font-medium text-text-primary">
              {cv.state === "UPLOADING"
                ? "Uploading your CV securely…"
                : cv.state === "SAVING"
                ? "Saving reviewed details to your draft…"
                : `${cv.stage}…`}
            </span>
            <span className="ml-auto hidden text-xs font-mono text-text-dim sm:inline">
              Processing server stream
            </span>
          </div>
        )}

        {cv.error && (
          <Banner
            kind={failed ? "danger" : "warning"}
            title={failed ? "We couldn't read this file" : undefined}
            action={
              failed ? (
                <>
                  {(cv.retryDocumentId || cv.hasSelectedFile()) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<ArrowClockwise size={16} aria-hidden="true" />}
                      onClick={() => void cv.retry(consent, aiConsent)}
                    >
                      Retry
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={pick}>
                    Choose another file
                  </Button>
                </>
              ) : undefined
            }
          >
            {cv.error.message}
            {cv.error.code && failed && (
              <span className="mt-1 block font-mono text-2xs text-text-muted">
                Reference: {cv.error.code}
              </span>
            )}
            {failed && cv.candidates.length > 0 && (
              <span className="mt-1 block">Your earlier results below haven&apos;t changed.</span>
            )}
          </Banner>
        )}

        {/* Candidate Extraction Review Section */}
        {cv.candidates.length > 0 && (
          <section
            aria-labelledby="cv-review-title"
            className="rounded-card border border-border-medium bg-bg-elevated shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-medium px-5 py-4">
              <div>
                <h2
                  id="cv-review-title"
                  className="font-display text-base font-bold text-text-primary sm:text-lg"
                >
                  Extracted suggestions from {cv.fileName}
                </h2>
                <p className="text-xs text-text-muted sm:text-sm">
                  Tick what is accurate. Fix wording before saving. Unticked items are omitted.
                </p>
              </div>
              <StatusChip tone={cv.reviewSaved ? "verified" : "neutral"} icon={cv.reviewSaved ? undefined : null}>
                {cv.reviewSaved ? "Saved to profile" : `${selectedCount} of ${cv.candidates.length} selected`}
              </StatusChip>
            </div>

            {cv.advice && (
              <p className="border-b border-border-medium bg-deep-espresso/40 px-5 py-3 text-xs text-text-muted sm:text-sm">
                <span className="font-bold text-accent-warm">EORA guidance:</span> {cv.advice}
              </p>
            )}

            <div className="divide-y divide-border-medium">
              {REVIEW_GROUPS.map((group) => {
                const rows = cv.candidates.filter((c) => group.categories.includes(c.category));
                if (!rows.length) return null;
                return (
                  <fieldset key={group.id} className="p-4 sm:p-5">
                    <legend className="sr-only">{group.title}</legend>
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-display text-sm font-bold text-warm-ivory" aria-hidden="true">
                        {group.title}
                      </p>
                      <span className="font-mono text-2xs text-text-muted tabular">
                        {rows.filter((r) => r.selected).length}/{rows.length}
                      </span>
                      <span className="ml-auto flex gap-1">
                        <Button size="sm" variant="quiet" onClick={() => cv.setAll(group.categories, true)}>
                          Tick all
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => cv.setAll(group.categories, false)}>
                          Clear
                        </Button>
                      </span>
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {rows.map((c) => {
                        const label = c.field ? FIELD_LABELS[c.field] || c.field : c.category;
                        return (
                          <li
                            key={c.id}
                            className={cn(
                              "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                              c.selected
                                ? "border-accent-warm/40 bg-accent-warm/10 text-warm-ivory"
                                : "border-border-medium bg-bg-surface/50 text-text-muted",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={c.selected}
                              onChange={(e) => cv.toggle(c.id, e.target.checked)}
                              className="mt-0.5 size-4 rounded border-border-medium accent-accent-warm"
                            />
                            <div className="min-w-0 flex-1">
                              <label htmlFor={`cv-${c.id}`} className="block text-2xs font-semibold uppercase tracking-wider text-text-dim">
                                {label}
                              </label>
                              <input
                                id={`cv-${c.id}`}
                                value={c.value}
                                onChange={(e) => cv.correct(c.id, e.target.value)}
                                className="mt-0.5 w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-text-primary hover:border-border-medium focus:border-accent-warm focus:bg-bg-primary/80 focus:outline-none"
                              />
                              {c.sourceSpan !== c.value && (
                                <p className="mt-0.5 break-words px-1.5 text-2xs text-text-muted">
                                  In CV: &ldquo;{c.sourceSpan}&rdquo;
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border-medium p-4 sm:px-5">
              {reviewError && <p className="text-xs text-danger">{reviewError}</p>}
              <Button
                variant="primary"
                size="sm"
                onClick={() => void save()}
                loading={cv.busy}
                className="ml-auto font-semibold"
              >
                Confirm & save suggestions
              </Button>
            </div>
          </section>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        onNext={next}
        saving={saving}
        nextLabel={cv.candidates.length > 0 && !cv.reviewSaved ? "Save & Continue" : cv.fileName ? "Continue" : "Continue without a CV"}
      />
    </>
  );
}
