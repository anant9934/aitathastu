"use client";

import React, { useRef, useState } from "react";
import { ArrowClockwise, DownloadSimple, FileArrowUp, FileText, Trash } from "@phosphor-icons/react/dist/ssr";
import { RESUME_MAX_UPLOAD_MB } from "@/lib/config/upload-limits";
import { FIELD_LABELS, REVIEW_GROUPS, type ResumeIngestion } from "@/lib/client/onboarding/use-resume-ingestion";
import { Button, buttonClass } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { StatusChip } from "@/components/ui/StatusChip";
import { Spinner } from "@/components/ui/Spinner";
import { useConfirm, toast } from "@/components/ui/Feedback";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";

export function CvStep({ cv, saving, guide, onBack, onSaveReview, onContinue, onSkip }: {
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
  const [dragging, setDragging] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const confirm = useConfirm();

  const blocked = cv.serviceReady === false;
  const failed = cv.state === "FAILED";
  const inReview = cv.candidates.length > 0 && !cv.reviewSaved;
  const pick = () => { if (!blocked && !cv.busy) fileInput.current?.click(); };

  const next = () => {
    if (cv.busy) return;
    if (failed || !cv.fileName) { onSkip(); return; }
    if (inReview) { setReviewError("Save your reviewed details first, or continue without them using \"Continue without a CV\"."); return; }
    onContinue();
  };
  useEoraStepEvents({ onNext: next, onBack, enabled: !cv.busy });

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
        description="We read it to pre-fill your education, skills, projects and links. You'll tick what's right before anything is saved. No generative AI reads your CV."
        guide={guide}
      />

      <div data-eora-id="eora-resume-upload" className="mt-6 flex flex-col gap-4">
        <Checkbox
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          label="I agree to have this CV read to suggest profile details."
          description="I'll review every suggestion before it's saved. The file stays private to my account."
        />

        <div
          onDragOver={(e) => { if (!blocked) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (!blocked) void cv.upload(e.dataTransfer.files?.[0], consent); }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-[var(--radius-panel)] border border-dashed px-5 py-8 text-center transition-colors duration-150",
            dragging ? "border-signal bg-signal-tint" : cv.fileName && !failed ? "border-verified/50 bg-surface" : "border-line-strong/70 bg-surface",
            blocked && "opacity-70",
          )}
        >
          <input ref={fileInput} type="file" accept=".pdf,.docx" className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={(e) => { void cv.upload(e.target.files?.[0], consent); e.target.value = ""; }} />
          <span className="grid size-11 place-items-center rounded-full border border-line bg-raised text-muted">
            {cv.fileName ? <FileText size={22} aria-hidden="true" /> : <FileArrowUp size={22} aria-hidden="true" />}
          </span>
          <div>
            <p className="font-medium text-ink">{cv.fileName ?? "Drop your CV here"}</p>
            <p className="mt-1 text-sm text-muted">PDF or DOCX, up to {RESUME_MAX_UPLOAD_MB} MB</p>
          </div>
          <Button variant={cv.fileName ? "secondary" : "primary"} onClick={pick} disabled={blocked || cv.busy}>
            {cv.fileName ? "Replace file" : "Choose a file"}
          </Button>
          <p className="text-xs text-muted" aria-live="polite">
            {cv.serviceReady === null ? "Checking the upload service…" : blocked ? "CV upload is unavailable right now." : "Upload service ready."}
          </p>
        </div>

        {blocked && (
          <Banner kind="warning" title="CV upload is unavailable right now">
            Continue without a CV and enter your details yourself. You can add a CV later from your profile.
          </Banner>
        )}

        {cv.busy && (
          <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-sm">
            <Spinner size={18} className="text-signal" />
            <span className="text-ink">
              {cv.state === "UPLOADING" ? "Uploading securely…" : cv.state === "SAVING" ? "Saving your reviewed details…" : `${cv.stage}…`}
            </span>
            <span className="ml-auto hidden text-xs text-muted sm:inline">Live status from the server</span>
          </div>
        )}

        {cv.error && (
          <Banner
            kind={failed ? "danger" : "warning"}
            title={failed ? "We couldn't read this file" : undefined}
            action={failed ? (
              <>
                {(cv.retryDocumentId || cv.hasSelectedFile()) && (
                  <Button size="sm" variant="secondary" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={() => void cv.retry(consent)}>Retry</Button>
                )}
                <Button size="sm" variant="ghost" onClick={pick}>Choose another file</Button>
              </>
            ) : undefined}
          >
            {cv.error.message}
            {cv.error.code && failed && <span className="mt-1 block font-mono text-2xs text-muted">Reference: {cv.error.code}</span>}
            {failed && cv.candidates.length > 0 && <span className="mt-1 block">Your earlier results below haven&apos;t changed.</span>}
          </Banner>
        )}

        {cv.candidates.length > 0 && (
          <section aria-labelledby="cv-review-title" className="rounded-[var(--radius-panel)] border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <h2 id="cv-review-title" className="text-base font-semibold">What we found in {cv.fileName}</h2>
                <p className="text-sm text-muted">Tick what&apos;s right. Fix wording before saving. Unticked items are left out.</p>
              </div>
              <StatusChip tone={cv.reviewSaved ? "verified" : "neutral"} icon={cv.reviewSaved ? undefined : null}>
                {cv.reviewSaved ? "Saved" : `${selectedCount} of ${cv.candidates.length} ticked`}
              </StatusChip>
            </div>

            {cv.advice && <p className="border-b border-line px-4 py-3 text-sm text-muted"><span className="font-medium text-ink">EORA:</span> {cv.advice}</p>}

            <div className="divide-y divide-line">
              {REVIEW_GROUPS.map((group) => {
                const rows = cv.candidates.filter((c) => group.categories.includes(c.category));
                if (!rows.length) return null;
                return (
                  <fieldset key={group.id} className="px-4 py-3">
                    <legend className="sr-only">{group.title}</legend>
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-sm font-semibold" aria-hidden="true">{group.title}</p>
                      <span className="font-mono text-2xs text-muted tabular">{rows.filter((r) => r.selected).length}/{rows.length}</span>
                      <span className="ml-auto flex gap-1">
                        <Button size="sm" variant="quiet" onClick={() => cv.setAll(group.categories, true)}>Tick all</Button>
                        <Button size="sm" variant="ghost" onClick={() => cv.setAll(group.categories, false)}>Clear</Button>
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {rows.map((c) => {
                        const label = c.field ? FIELD_LABELS[c.field] || c.field : c.category;
                        return (
                          <li key={c.id} className={cn("flex items-start gap-3 rounded-[var(--radius-control)] border px-3 py-2.5", c.selected ? "border-signal/40 bg-signal-tint/40" : "border-line")}>
                            <input
                              type="checkbox"
                              checked={c.selected}
                              aria-label={`Keep ${label}: ${c.value}`}
                              onChange={(e) => cv.toggle(c.id, e.target.checked)}
                              className="mt-3 size-5 shrink-0 cursor-pointer accent-signal"
                            />
                            <div className="min-w-0 flex-1">
                              <label htmlFor={`cv-${c.id}`} className="text-xs capitalize text-muted">{label}</label>
                              <input
                                id={`cv-${c.id}`}
                                value={c.value}
                                onChange={(e) => cv.correct(c.id, e.target.value)}
                                className="mt-0.5 w-full min-w-0 rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-base text-ink hover:border-line focus-visible:border-focus focus-visible:outline-none"
                              />
                              {c.sourceSpan !== c.value && (
                                <p className="mt-1 break-words px-1.5 text-xs text-muted">In your CV: &ldquo;{c.sourceSpan}&rdquo;</p>
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

            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
              <Button variant="primary" onClick={() => void save()} loading={cv.state === "SAVING"} loadingLabel="Saving…" disabled={cv.busy}>
                Save ticked details
              </Button>
              {cv.documentId && (
                <>
                  <a className={buttonClass("ghost", "sm")} href={`/api/resume/${cv.documentId}/export?format=json`} target="_blank" rel="noopener noreferrer">
                    <DownloadSimple size={16} aria-hidden="true" /> Export JSON
                  </a>
                  <Button size="sm" variant="ghost" className="ml-auto text-danger hover:bg-danger-bg" icon={<Trash size={16} aria-hidden="true" />} onClick={() => void remove()}>
                    Delete CV
                  </Button>
                </>
              )}
            </div>
            {reviewError && <div className="px-4 pb-3"><Banner kind="danger">{reviewError}</Banner></div>}
          </section>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        onNext={next}
        saving={saving}
        nextDisabled={cv.busy}
        nextLabel={!cv.fileName || failed ? "Continue without a CV" : "Continue"}
      />
    </>
  );
}
