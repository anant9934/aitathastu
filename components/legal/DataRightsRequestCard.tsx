"use client";

import React, { useState } from "react";
import { DownloadSimple, PaperPlaneTilt, CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Feedback";
import { requestJson, describeError } from "@/lib/client/api";

export function DataRightsRequestCard() {
  const [requestType, setRequestType] = useState("access");
  const [details, setDetails] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim() || details.trim().length < 5) {
      toast.error("Description required", "Please describe your request in at least 5 characters.");
      return;
    }

    setSubmitting(true);
    const res = await requestJson<{ success: boolean; request: { requestId: string } }>(
      "/api/student/privacy/requests",
      {
        method: "POST",
        json: { requestType, details, contactEmail: contactEmail.trim() || undefined },
      }
    );
    setSubmitting(false);

    if (!res.ok) {
      toast.error("Submission failed", describeError(res.error));
      return;
    }

    setSubmittedId(res.data.request.requestId);
    setDetails("");
    toast.success("Request submitted", `Reference: ${res.data.request.requestId}`);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/student/privacy/export");
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Sign in required", "Please sign in to your student account to download your data export.");
          return;
        }
        throw new Error();
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-tathastu-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Export complete", "Your personal data export has been downloaded in JSON format.");
    } catch {
      toast.error("Export failed", "We couldn't generate your export right now. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-8 rounded-card border border-border-medium bg-bg-elevated p-6 sm:p-8 shadow-card space-y-6">
      <div className="border-b border-border-subtle/80 pb-4">
        <h3 className="font-display text-lg font-bold text-text-primary">
          Exercise Your Privacy Rights
        </h3>
        <p className="text-xs text-text-muted mt-1">
          Submit a request under Section 11, 12, or 13 of the Digital Personal Data Protection Act, 2023.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left: Instant Data Portability Export */}
        <div className="rounded-lg border border-border-medium bg-bg-surface p-5 space-y-3">
          <h4 className="font-semibold text-text-primary text-sm">Download My Data (Portability)</h4>
          <p className="text-2xs text-text-muted leading-relaxed">
            Download a machine-readable JSON copy of all personal profile information, confirmed projects, skills evidence,
            resumes metadata, and consent audit trails stored on AI Tathastu.
          </p>
          <Button
            size="sm"
            variant="secondary"
            icon={<DownloadSimple size={16} aria-hidden="true" />}
            loading={exporting}
            loadingLabel="Generating export…"
            onClick={() => void handleExport()}
          >
            Download Data Export (JSON)
          </Button>
        </div>

        {/* Right: Formal Request Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="req-type" className="block text-xs font-medium text-text-primary mb-1">
              Request Type
            </label>
            <select
              id="req-type"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="w-full rounded-md border border-border-interactive bg-input-background px-3 py-2 text-xs text-input-foreground focus:border-focus-ring focus:outline-none"
            >
              <option value="access">Access / Summary of Processing</option>
              <option value="correction">Correction or Updating of Evidence</option>
              <option value="erasure">Erasure / Data Deletion</option>
              <option value="consent_withdrawal">Withdrawal of Specific Consent</option>
              <option value="child_data_inquiry">Minor / Guardian Privacy Inquiry</option>
              <option value="grievance">Formal Grievance Complaint</option>
            </select>
          </div>

          <div>
            <label htmlFor="req-details" className="block text-xs font-medium text-text-primary mb-1">
              Details of Your Request
            </label>
            <textarea
              id="req-details"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe the specific profile data, correction, or privacy inquiry..."
              className="w-full rounded-md border border-border-interactive bg-input-background px-3 py-2 text-xs text-input-foreground placeholder:text-input-placeholder focus:border-focus-ring focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="req-email" className="block text-xs font-medium text-text-primary mb-1">
              Notification Email (Optional)
            </label>
            <input
              id="req-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Leave blank to use your account email"
              className="w-full rounded-md border border-border-interactive bg-input-background px-3 py-2 text-xs text-input-foreground placeholder:text-input-placeholder focus:border-focus-ring focus:outline-none"
            />
          </div>

          {submittedId && (
            <div className="rounded-md bg-verified/15 p-3 text-xs text-verified flex items-center gap-2 border border-verified/30">
              <CheckCircle size={16} aria-hidden="true" />
              <span>Request logged successfully. Reference ID: <strong className="font-mono">{submittedId}</strong></span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={<PaperPlaneTilt size={16} aria-hidden="true" />}
            loading={submitting}
            loadingLabel="Submitting request…"
          >
            Submit Request
          </Button>
        </form>
      </div>
    </div>
  );
}
