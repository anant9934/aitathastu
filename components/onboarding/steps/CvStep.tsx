"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  CaretDown,
  CaretUp,
  CheckCircle,
  FileArrowUp,
  FileText,
  LockKey,
  ShieldCheck,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { RESUME_ACCEPTED_EXTENSIONS, RESUME_ACCEPTED_LABEL, RESUME_MAX_UPLOAD_MB } from "@/lib/config/upload-limits";
import type { ResumeIngestion } from "@/lib/client/onboarding/use-resume-ingestion";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { useConfirm, toast } from "@/components/ui/Feedback";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";
import { CvExtractionAssembly } from "@/components/onboarding/CvExtractionAssembly";
import { CvReviewWorkspace } from "@/components/onboarding/CvReviewWorkspace";

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
  const [cvProcessingConsent, setCvProcessingConsent] = useState(false);
  const [aiEnrichmentConsent, setAiEnrichmentConsent] = useState(false);
  const [disclosureExpanded, setDisclosureExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const confirm = useConfirm();

  const blocked = cv.serviceReady === false;
  const failed = cv.state === "FAILED";
  const inReview = cv.candidates.length > 0 && !cv.reviewSaved;
  const pick = () => {
    if (!cvProcessingConsent) {
      toast.error("Consent required", "Please check the CV processing permission box first to allow file upload.");
      return;
    }
    if (!blocked && !cv.busy) fileInput.current?.click();
  };

  /** After a failed save, bring the first field that needs attention into view. */
  const showFirstProblem = () => {
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[aria-labelledby="cv-review-title"] [aria-invalid="true"], [aria-labelledby="cv-review-title"] section [role="alert"]');
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.focus({ preventScroll: true });
    }, 50);
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
        showFirstProblem();
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
    if (problem) {
      setReviewError(problem);
      showFirstProblem();
    } else toast.success("CV details saved", "Steps your CV fully covers will be filled in for you.");
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

  return (
    <>
      <StepHeader
        title="Add your CV"
        description="We extract your education, skills, projects, and links using deterministic pattern matching. You review and approve every detail before anything is saved."
        guide={guide}
      />

      <div data-eora-id="eora-resume-upload" className="mt-6 flex flex-col gap-6">
        {/* Upload Region & Privacy Box */}
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
                if (!blocked) {
                  if (!cvProcessingConsent) {
                    toast.error("Consent required", "Please check the CV processing permission box first to allow extraction.");
                    return;
                  }
                  void cv.upload(e.dataTransfer.files?.[0], cvProcessingConsent, aiEnrichmentConsent);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-4 rounded-card border-2 border-dashed p-8 text-center transition-all duration-200 shadow-card min-h-[260px]",
                dragging
                  ? "border-accent-warm-bright bg-accent-warm-bright/10 shadow-[0_0_28px_rgba(196,138,90,0.2)]"
                  : cv.fileName && !failed
                  ? "border-verified/60 bg-bg-elevated"
                  : "border-border-medium bg-bg-elevated hover:border-accent-warm hover:bg-bg-elevated/80",
                blocked && "opacity-70",
              )}
            >
              <input
                ref={fileInput}
                type="file"
                accept={RESUME_ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",")}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  if (!cvProcessingConsent) {
                    toast.error("Consent required", "Please check the CV processing permission box first to allow extraction.");
                    e.target.value = "";
                    return;
                  }
                  void cv.upload(e.target.files?.[0], cvProcessingConsent, aiEnrichmentConsent);
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
                <p className="font-display text-base font-bold text-text-primary sm:text-lg">
                  {cv.fileName ?? "Drag and drop your CV here"}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Supports {RESUME_ACCEPTED_LABEL}, up to {RESUME_MAX_UPLOAD_MB} MB
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
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-primary">
                Private & Evidence-Driven
              </h2>
            </div>

            <Checkbox
              checked={cvProcessingConsent}
              onChange={(e) => setCvProcessingConsent(e.target.checked)}
              label="I allow AI Tathastu to upload, store and process my CV to prepare profile suggestions."
              description="We extract your education, skills, projects, and links using deterministic pattern matching. These are suggestions for your review, not independently verified facts. You can continue without uploading a CV."
            />

            <Checkbox
              checked={aiEnrichmentConsent}
              onChange={(e) => setAiEnrichmentConsent(e.target.checked)}
              label="Allow optional AI-assisted CV analysis."
              description="A currently eligible and approved model provider may receive selected resume text to improve complex suggestions. Basic extraction does not require this."
            />

            <ul className="mt-2 space-y-2.5 text-xs text-text-muted border-t border-border-medium/60 pt-3">
              <li className="flex items-start gap-2">
                <CheckCircle size={15} weight="bold" className="mt-0.5 shrink-0 text-verified" />
                <span className="font-medium text-text-primary">
                  Your phone number is only shown as an unticked suggestion: it is saved only if you tick it, and it is never sent to AI providers.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={15} weight="bold" className="mt-0.5 shrink-0 text-accent-warm" />
                <span>Pre-fills college details, graduation year, and degree suggestions.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={15} weight="bold" className="mt-0.5 shrink-0 text-accent-warm" />
                <span>Identifies GitHub, Kaggle, LinkedIn, and paper links for review (does not auto-fetch).</span>
              </li>
              <li className="flex items-start gap-2">
                <LockKey size={15} weight="bold" className="mt-0.5 shrink-0 text-verified" />
                <span>Stored securely in your private account; never sold to third parties or used for unconsented public AI training.</span>
              </li>
            </ul>

            {/* Expandable Disclosure: What information may be extracted? */}
            <div className="border-t border-border-medium/60 pt-3">
              <button
                type="button"
                onClick={() => setDisclosureExpanded((prev: boolean) => !prev)}
                className="flex w-full items-center justify-between text-left text-xs font-medium text-accent-warm hover:text-accent-warm-bright transition-colors"
                aria-expanded={disclosureExpanded}
              >
                <span>What information may be extracted?</span>
                {disclosureExpanded ? (
                  <CaretUp size={14} aria-hidden="true" />
                ) : (
                  <CaretDown size={14} aria-hidden="true" />
                )}
              </button>

              {disclosureExpanded && (
                <div className="mt-3 rounded-md bg-deep-espresso/60 p-3 text-2xs text-text-muted space-y-2">
                  <p className="font-semibold text-text-primary">Candidate information parsed from your document:</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 list-disc list-inside">
                    <li>Identity & contact details (email, location)</li>
                    <li>Education & degrees</li>
                    <li>Technical skills & frameworks</li>
                    <li>Employment history</li>
                    <li>Internships & industrial training</li>
                    <li>Leadership & activities</li>
                    <li>Technical projects & repos</li>
                    <li>Certifications & licenses</li>
                    <li>Honors & achievements</li>
                    <li>Research & publications</li>
                    <li>Patents & authored books</li>
                    <li>Digital profile URLs</li>
                  </ul>
                  <div className="pt-2 flex flex-wrap gap-3 text-2xs border-t border-border-subtle">
                    <Link href="/privacy/resume-processing" className="text-accent-warm underline hover:text-accent-warm-bright">
                      Resume Processing Notice
                    </Link>
                    <Link href="/privacy" className="text-text-dim underline hover:text-text-primary">
                      Privacy Policy
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {blocked && (
          <Banner kind="warning" title="CV upload is unavailable right now">
            Continue without a CV and enter your details yourself. You can add a CV later from your profile.
          </Banner>
        )}

        {cv.busy && (
          <CvExtractionAssembly
            fileName={cv.fileName}
            stage={
              cv.state === "UPLOADING"
                ? "Uploading your CV document securely…"
                : cv.state === "SAVING"
                ? "Saving reviewed claims to your draft…"
                : `${cv.stage}…`
            }
            state={cv.state}
          />
        )}

        {cv.error && (
          <Banner
            kind={failed ? "danger" : "warning"}
            title={failed ? (cv.error.code === "PERSIST_FAILED" ? "We read your CV but couldn't save the results" : "We couldn't read this file") : undefined}
            action={
              failed ? (
                <>
                  {(cv.retryDocumentId || cv.hasSelectedFile()) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<ArrowClockwise size={16} aria-hidden="true" />}
                      onClick={() => void cv.retry(cvProcessingConsent, aiEnrichmentConsent)}
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

        {cv.candidates.length > 0 && <CvReviewWorkspace cv={cv} onSave={() => void save()} reviewError={reviewError} />}
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
