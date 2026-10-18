"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  Briefcase,
  CaretDown,
  CaretUp,
  Certificate,
  CheckCircle,
  Code,
  FileArrowUp,
  FileText,
  GraduationCap,
  LockKey,
  PencilSimple,
  ShieldCheck,
  Sparkle,
  Trash,
  Trophy,
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
  const [cvProcessingConsent, setCvProcessingConsent] = useState(false);
  const [aiEnrichmentConsent, setAiEnrichmentConsent] = useState(false);
  const [disclosureExpanded, setDisclosureExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
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

  const getGroupIcon = (groupId: string) => {
    switch (groupId) {
      case "education":
        return <GraduationCap size={18} weight="bold" className="text-accent-warm" />;
      case "skills":
        return <Sparkle size={18} weight="bold" className="text-accent-warm" />;
      case "experience":
        return <Briefcase size={18} weight="bold" className="text-accent-warm" />;
      case "projects":
        return <Code size={18} weight="bold" className="text-accent-warm" />;
      case "certifications":
        return <Certificate size={18} weight="bold" className="text-accent-warm" />;
      case "achievements":
      case "publications":
        return <Trophy size={18} weight="bold" className="text-accent-warm" />;
      default:
        return <FileText size={18} weight="bold" className="text-accent-warm" />;
    }
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
                <span className="font-medium text-warm-ivory">
                  100% Privacy Protected: Mobile and phone numbers are never extracted from your CV.
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
                  <p className="font-semibold text-warm-ivory">Candidate information parsed from your document:</p>
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
              <div className="border-b border-border-medium bg-deep-espresso/40 px-5 py-3 text-xs text-text-muted sm:text-sm flex items-start gap-2">
                <Sparkle size={16} weight="fill" className="mt-0.5 shrink-0 text-accent-warm" />
                <div>
                  <span className="font-bold text-accent-warm">EORA Guidance:</span> {cv.advice}
                </div>
              </div>
            )}

            <div className="divide-y divide-border-medium">
              {REVIEW_GROUPS.map((group) => {
                const rows = cv.candidates.filter((c) => group.categories.includes(c.category));
                if (!rows.length) return null;
                const selectedInGroup = rows.filter((r) => r.selected).length;

                // Special presentation for Skills: Compact Grouped Chip Grid
                if (group.id === "skills") {
                  return (
                    <fieldset key={group.id} className="p-4 sm:p-5">
                      <legend className="sr-only">{group.title}</legend>
                      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="flex items-center gap-2">
                          {getGroupIcon(group.id)}
                          <p className="font-display text-sm font-bold text-warm-ivory" aria-hidden="true">
                            {group.title}
                          </p>
                        </div>
                        <span className="font-mono text-2xs text-text-muted tabular">
                          {selectedInGroup}/{rows.length}
                        </span>
                        <span className="ml-auto flex gap-1">
                          <Button size="sm" variant="quiet" onClick={() => cv.setAll(group.categories, true)}>
                            Select all ({rows.length})
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => cv.setAll(group.categories, false)}>
                            Clear
                          </Button>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {rows.map((c) => {
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => cv.toggle(c.id, !c.selected)}
                              className={cn(
                                "group inline-flex items-center gap-2 rounded-panel border px-3 py-1.5 text-xs font-medium transition-all shadow-xs cursor-pointer select-none",
                                c.selected
                                  ? "border-accent-warm bg-accent-warm/15 text-warm-ivory shadow-[0_0_12px_rgba(244,154,71,0.15)]"
                                  : "border-border-medium bg-bg-surface/50 text-text-muted hover:border-border-bright hover:text-text-primary",
                              )}
                              title={`In CV: "${c.sourceSpan}"`}
                            >
                              <span
                                className={cn(
                                  "size-2 rounded-full transition-colors",
                                  c.selected ? "bg-accent-warm-bright" : "bg-border-medium group-hover:bg-text-dim",
                                )}
                              />
                              <span>{c.value}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                }

                // Structured Record Cards for Education, Experience, Projects, Certifications, etc.
                return (
                  <fieldset key={group.id} className="p-4 sm:p-5">
                    <legend className="sr-only">{group.title}</legend>
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="flex items-center gap-2">
                        {getGroupIcon(group.id)}
                        <p className="font-display text-sm font-bold text-warm-ivory" aria-hidden="true">
                          {group.title}
                        </p>
                      </div>
                      <span className="font-mono text-2xs text-text-muted tabular">
                        {selectedInGroup}/{rows.length}
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

                    <ul className="grid gap-3 sm:grid-cols-2">
                      {rows.map((c) => {
                        const label = c.field ? FIELD_LABELS[c.field] || c.field : c.category;
                        const data = (c as any).recordData || {};
                        const isEditing = editingCandidateId === c.id;

                        return (
                          <li
                            key={c.id}
                            className={cn(
                              "flex flex-col gap-2 rounded-card border p-4 transition-all duration-150 shadow-xs",
                              c.selected
                                ? "border-accent-warm/50 bg-accent-warm/[0.07] text-warm-ivory shadow-[0_0_16px_rgba(244,154,71,0.08)]"
                                : "border-border-medium bg-bg-surface/50 text-text-muted hover:border-border-bright",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                id={`cv-chk-${c.id}`}
                                checked={c.selected}
                                onChange={(e) => cv.toggle(c.id, e.target.checked)}
                                className="mt-1 size-4 rounded border-border-medium accent-accent-warm cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <label
                                    htmlFor={`cv-chk-${c.id}`}
                                    className="cursor-pointer text-2xs font-bold uppercase tracking-wider text-accent-warm"
                                  >
                                    {label}
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCandidateId(isEditing ? null : c.id)}
                                    className="text-text-dim hover:text-accent-warm transition-colors p-1"
                                    title="Edit wording"
                                  >
                                    <PencilSimple size={14} />
                                  </button>
                                </div>

                                {isEditing ? (
                                  <div className="mt-1.5 flex flex-col gap-1.5">
                                    <input
                                      id={`cv-input-${c.id}`}
                                      value={c.value}
                                      onChange={(e) => cv.correct(c.id, e.target.value)}
                                      onBlur={() => setEditingCandidateId(null)}
                                      autoFocus
                                      className="w-full rounded border border-accent-warm bg-bg-primary px-2 py-1 text-sm font-medium text-text-primary focus:outline-none"
                                    />
                                    <span className="text-3xs text-text-dim">Press Enter or click away to save edits</span>
                                  </div>
                                ) : (
                                  <p
                                    onClick={() => setEditingCandidateId(c.id)}
                                    className="mt-0.5 text-sm font-medium text-text-primary cursor-text hover:text-warm-ivory"
                                    title="Click to edit wording"
                                  >
                                    {c.value}
                                  </p>
                                )}

                                {/* Structured Metadata badges if present */}
                                {(data.institution || data.degree || data.role || data.company || data.issuer || data.year || data.duration || data.status) && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {data.degree && (
                                      <span className="rounded bg-accent-warm/15 px-1.5 py-0.5 text-3xs font-medium text-accent-warm-bright">
                                        {data.degree}
                                      </span>
                                    )}
                                    {data.graduationYear && (
                                      <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-3xs font-mono text-text-muted">
                                        Class of {data.graduationYear}
                                      </span>
                                    )}
                                    {data.type && (
                                      <span className="rounded bg-verified/15 px-1.5 py-0.5 text-3xs font-medium text-verified capitalize">
                                        {data.type}
                                      </span>
                                    )}
                                    {data.duration && (
                                      <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-3xs font-mono text-text-muted">
                                        {data.duration}
                                      </span>
                                    )}
                                    {data.issuer && (
                                      <span className="rounded bg-deep-espresso px-1.5 py-0.5 text-3xs text-warm-ivory">
                                        {data.issuer}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Evidence Grounding Snippet */}
                                {c.sourceSpan && c.sourceSpan !== c.value && (
                                  <p className="mt-2 text-2xs text-text-dim border-t border-border-subtle pt-1.5 break-words line-clamp-2">
                                    <span className="font-semibold text-text-muted">Document snippet:</span> &ldquo;{c.sourceSpan}&rdquo;
                                  </p>
                                )}
                              </div>
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
