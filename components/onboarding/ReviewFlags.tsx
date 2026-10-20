"use client";

import { cn } from "@/lib/client/cn";

type Review = { status?: string; confidence?: number; issues?: string[] };

const ISSUE_TEXT: Record<string, string> = {
  missing_title: "Job title not found in the CV",
  missing_organization: "Organisation not found in the CV",
  missing_institution: "Institution not found in the CV",
  missing_degree: "Degree not found in the CV",
  end_before_start: "End date is before the start date",
  ambiguous_date: "Date could be read as day/month or month/day",
  future_start: "Start date is in the future",
  title_organization_order_inferred: "Check which part is the title and which is the organisation",
  low_ocr_quality: "This part of the scan was hard to read",
  duplicate_conflict: "Listed more than once with different details",
  model_extracted: "Suggested by AI from your CV text",
  ungrounded_date_dropped: "An AI-suggested date was not in your CV and was removed",
};

const STATUS: Record<string, { label: string; tone: "warn" | "danger" }> = {
  needs_review: { label: "Check this", tone: "warn" },
  invalid: { label: "Needs a fix", tone: "danger" },
  conflicting: { label: "Conflicting details", tone: "warn" },
  unreadable: { label: "Hard to read", tone: "danger" },
};

/**
 * Why a suggestion needs a look, from the extractor's own checks. Nothing is
 * shown for records that passed every check.
 */
export function ReviewFlags({ data, previousDecision }: { data: Record<string, any>; previousDecision?: string }) {
  const review: Review | undefined = data?.review;
  const status = review?.status ? STATUS[review.status] : undefined;
  const issues = (review?.issues ?? []).map((i) => ISSUE_TEXT[i]).filter(Boolean);
  const page = data?.evidence?.page;
  if (!status && !issues.length && !previousDecision && !page) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {status && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-3xs font-semibold",
              status.tone === "danger" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning",
            )}
          >
            {status.label}
          </span>
        )}
        {previousDecision === "confirmed" && (
          <span className="rounded bg-verified-bg px-1.5 py-0.5 text-3xs font-medium text-verified">You confirmed this before</span>
        )}
        {typeof page === "number" && <span className="text-3xs text-text-dim">Page {page}</span>}
      </div>
      {issues.length > 0 && (
        <ul className="list-disc pl-4 text-2xs text-text-muted">
          {issues.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
