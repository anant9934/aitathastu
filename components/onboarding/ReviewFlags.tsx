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
  model_recovered: "A missing detail was filled in by AI from the nearby lines of your CV",
  multiple_emails: "Several emails found and none marked as primary; check which one to use",
  multiple_phones: "Several phone numbers found and none marked as primary; check which one to use",
  email_outside_contact: "Found outside your contact details; it may belong to someone else",
  invalid_date_of_birth: "This date of birth is not a valid date",
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
const SECTION_LABEL: Record<string, string> = {
  experience: "Experience", education: "Education", projects: "Projects", skills: "Skills", certifications: "Certifications",
  awards: "Awards", publications: "Publications", leadership: "Leadership", volunteering: "Volunteering", languages: "Languages",
  summary: "Summary", memberships: "Memberships", contact: "Contact details", header: "Header",
};

export function ReviewFlags({ data, previousDecision, savedDecision, corrected }: { data: Record<string, any>; previousDecision?: string; savedDecision?: "confirmed" | "rejected"; corrected?: boolean }) {
  const review: Review | undefined = data?.review;
  // The extractor's checks describe the value it read; once the student edits it they no longer apply.
  const status = !corrected && review?.status ? STATUS[review.status] : undefined;
  const issues = corrected ? [] : (review?.issues ?? []).map((i) => ISSUE_TEXT[i]).filter(Boolean);
  const page = data?.evidence?.page;
  const section = SECTION_LABEL[String(data?.evidence?.section ?? "")];
  const details = (data?.details ?? {}) as Record<string, unknown>;
  const notes = [
    data?.confidenceLevel && data.confidenceLevel !== "high" ? `${data.confidenceLevel === "low" ? "Low" : "Medium"} confidence` : null,
    data?.method === "derived" ? "Calculated from your experience entries" : null,
    typeof data?.normalized === "string" ? `Standard form: ${data.normalized}` : null,
    details.countryCodeInferred ? `Country code ${String(details.countryCode)} assumed from the number format` : null,
    typeof details.label === "string" ? `Labelled "${details.label}" in your CV` : null,
    typeof details.kind === "string" && details.kind !== "address" ? `${details.kind[0].toUpperCase()}${details.kind.slice(1)} address` : null,
  ].filter((n): n is string => Boolean(n));
  if (!status && !issues.length && !previousDecision && !savedDecision && !corrected && !page && !notes.length) return null;
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
        {savedDecision && (
          <span className={cn("rounded px-1.5 py-0.5 text-3xs font-medium", savedDecision === "confirmed" ? "bg-verified-bg text-verified" : "bg-bg-surface text-text-muted")}>
            {savedDecision === "rejected" ? "Saved as not right" : corrected ? "Saved with your edit" : "Saved as correct"}
          </span>
        )}
        {!savedDecision && corrected && (
          <span className="rounded bg-bg-surface px-1.5 py-0.5 text-3xs font-medium text-text-muted">Edited by you</span>
        )}
        {!savedDecision && !corrected && previousDecision === "confirmed" && (
          <span className="rounded bg-verified-bg px-1.5 py-0.5 text-3xs font-medium text-verified">You confirmed this before</span>
        )}
        {typeof page === "number" && <span className="text-3xs text-text-dim">Page {page}{section ? ` · ${section}` : ""}</span>}
      </div>
      {notes.length > 0 && <p className="text-2xs text-text-muted">{notes.join(" · ")}</p>}
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
