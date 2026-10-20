"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldWarning,
  DownloadSimple,
  ArrowClockwise,
  SlidersHorizontal,
  PlugsConnected,
  FileText,
  ClockCounterClockwise,
  CheckCircle,
  Warning,
  XCircle,
  Info,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Feedback";
import { DataRightsRequestCard } from "@/components/legal/DataRightsRequestCard";

interface ConsentRecord {
  consentId: string;
  purpose: string;
  scope: string;
  status: "granted" | "withdrawn" | "pending";
  policyVersion: string;
  noticeVersion: string;
  timestamp: string;
  sourceUI: string;
  metadata?: Record<string, any>;
}

interface PrivacyStatusData {
  activeConsents: Record<string, ConsentRecord>;
  auditTrail: ConsentRecord[];
  lastUpdated: string;
}

export function PrivacyControlsView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PrivacyStatusData | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/student/privacy/consent");
      if (!res.ok) {
        throw new Error("Failed to load privacy status");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error("Privacy status unavailable", "Could not load current consent records. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const toggleConsent = async (purpose: string, scope = "*", currentStatus: string) => {
    const nextStatus = currentStatus === "granted" ? "withdrawn" : "granted";
    const key = `${purpose}:${scope}`;
    setMutatingKey(key);

    try {
      const res = await fetch("/api/student/privacy/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          scope,
          status: nextStatus,
          sourceUI: "student_privacy_dashboard",
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error || "Update failed");
      }

      toast.success(
        nextStatus === "granted" ? "Consent Granted" : "Consent Withdrawn",
        `Updated permission for ${purpose.replace(/_/g, " ")}.`
      );
      await fetchStatus();
    } catch (err: any) {
      toast.error("Could not update consent", err.message || "Network error occurred.");
    } finally {
      setMutatingKey(null);
    }
  };

  const isConsentGranted = (purpose: string, scope = "*") => {
    if (!data?.activeConsents) return false;
    const direct = data.activeConsents[`${purpose}:${scope}`];
    if (direct) return direct.status === "granted";
    if (scope !== "*") {
      const wildcard = data.activeConsents[`${purpose}:*`];
      return wildcard?.status === "granted";
    }
    return false;
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="rounded-card border border-border-medium bg-bg-elevated p-6 sm:p-8 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck size={24} className="text-accent-warm-bright" aria-hidden="true" />
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
                Privacy, Consent &amp; Data Rights
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-text-muted max-w-2xl">
              Control your data permissions, review your tamper-evident consent ledger, and exercise your statutory
              rights under Indian Technology Law (DPDP Act 2023 phased framework).
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
            className="self-start sm:self-auto"
          >
            <ArrowClockwise size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            <span>Refresh Ledger</span>
          </Button>
        </div>
      </div>

      {/* Permissions & Consent Controls */}
      <div className="rounded-card border border-border-medium bg-bg-elevated p-6 sm:p-8 shadow-card">
        <h2 className="font-display text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
          <SlidersHorizontal size={20} className="text-accent-warm" aria-hidden="true" />
          <span>Active Data Processing Consents</span>
        </h2>
        <p className="text-xs text-text-muted mb-6">
          Every optional data process requires explicit consent. You have the right to withdraw optional consents at
          any time without affecting prior lawful processing.
        </p>

        <div className="space-y-4">
          {/* 1. Account & Essential Services */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-border-subtle bg-bg-primary/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-text-primary">Account Registration &amp; Essential Services</span>
                <span className="rounded bg-accent-warm/15 px-2 py-0.5 text-2xs font-mono text-accent-warm-bright">
                  Essential
                </span>
              </div>
              <p className="text-xs text-text-muted max-w-xl">
                Fundamental credentials, session security, and core platform delivery accepted at sign up under our{" "}
                <Link href="/terms" className="text-accent-warm hover:underline">
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-accent-warm hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs font-mono text-success flex items-center gap-1">
                <CheckCircle size={14} weight="fill" /> Always Active
              </span>
            </div>
          </div>

          {/* 2. Deterministic CV Parsing & Text OCR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-border-subtle bg-bg-primary/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-text-primary">CV Storage &amp; Text Extraction</span>
                {isConsentGranted("cv_processing") ? (
                  <span className="rounded bg-success/15 px-2 py-0.5 text-2xs font-mono text-success">
                    Active
                  </span>
                ) : (
                  <span className="rounded bg-border-medium px-2 py-0.5 text-2xs font-mono text-text-dim">
                    Not Uploaded
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted max-w-xl">
                Deterministic text extraction and OCR from uploaded resume documents to populate your baseline
                profile claims. Details in{" "}
                <Link href="/privacy/resume-processing" className="text-accent-warm hover:underline">
                  CV Processing Notice
                </Link>
                .
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs font-mono text-text-muted">
                {isConsentGranted("cv_processing") ? "Granted during upload" : "No active resume"}
              </span>
            </div>
          </div>

          {/* 3. AI-Assisted CV Suggestion Enrichment (Optional & Toggleable) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-border-subtle bg-bg-primary/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-text-primary">AI-Assisted CV Suggestion Enrichment</span>
                <span className="rounded bg-accent-warm/15 px-2 py-0.5 text-2xs font-mono text-accent-warm-bright">
                  Optional
                </span>
                {isConsentGranted("cv_external_ai_enrichment") ? (
                  <span className="rounded bg-success/15 px-2 py-0.5 text-2xs font-mono text-success">
                    Granted
                  </span>
                ) : (
                  <span className="rounded bg-text-dim/20 px-2 py-0.5 text-2xs font-mono text-text-dim">
                    Declined
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted max-w-xl">
                Allows passing anonymized CV text excerpts to external AI providers (OpenAI / Anthropic / Google)
                to extract nuanced project highlights and skill hints. Subject to strict zero data retention. Details in{" "}
                <Link href="/privacy/ai-processing" className="text-accent-warm hover:underline">
                  AI Processing Notice
                </Link>
                .
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                variant={isConsentGranted("cv_external_ai_enrichment") ? "secondary" : "primary"}
                size="sm"
                disabled={mutatingKey === "cv_external_ai_enrichment:*"}
                onClick={() =>
                  toggleConsent(
                    "cv_external_ai_enrichment",
                    "*",
                    isConsentGranted("cv_external_ai_enrichment") ? "granted" : "withdrawn"
                  )
                }
              >
                {isConsentGranted("cv_external_ai_enrichment") ? "Withdraw AI Consent" : "Grant AI Consent"}
              </Button>
            </div>
          </div>

          {/* 4. External Footprint Scraping & Profile Sync (Optional & Toggleable) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-border-subtle bg-bg-primary/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-text-primary">Digital Footprint External Syncing</span>
                <span className="rounded bg-accent-warm/15 px-2 py-0.5 text-2xs font-mono text-accent-warm-bright">
                  Optional
                </span>
                {isConsentGranted("external_profile_fetch") ? (
                  <span className="rounded bg-success/15 px-2 py-0.5 text-2xs font-mono text-success">
                    Granted
                  </span>
                ) : (
                  <span className="rounded bg-text-dim/20 px-2 py-0.5 text-2xs font-mono text-text-dim">
                    Reference Only
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted max-w-xl">
                Retrieving external repositories, problem counts, and commits from GitHub, Kaggle, or LeetCode. When
                withdrawn, profile links remain stored as passive references without active background fetching.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Link href="/student/connections">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <PlugsConnected size={14} />
                  <span>Manage Sources</span>
                </Button>
              </Link>
              <Button
                variant={isConsentGranted("external_profile_fetch") ? "secondary" : "primary"}
                size="sm"
                disabled={mutatingKey === "external_profile_fetch:*"}
                onClick={() =>
                  toggleConsent(
                    "external_profile_fetch",
                    "*",
                    isConsentGranted("external_profile_fetch") ? "granted" : "withdrawn"
                  )
                }
              >
                {isConsentGranted("external_profile_fetch") ? "Withdraw Sync" : "Enable Sync"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Portability & Rights Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Export Card */}
        <div className="rounded-card border border-border-medium bg-bg-elevated p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-accent-warm-bright">
              <DownloadSimple size={20} aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-text-primary">
                Data Portability Export
              </h2>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mb-4">
              Download your complete personal data file in structured JSON format under the DPDP Right to Access and
              Data Portability. Includes your profile details, verified evidence, skills catalog, footprints, and
              tamper-evident consent log.
            </p>
            <div className="rounded-md border border-border-subtle bg-bg-primary/40 p-3 text-2xs text-text-dim mb-4 space-y-1">
              <p>• Sanitized: Passwords, session tokens, and security secrets are strictly omitted.</p>
              <p>• Machine-readable JSON schema compatible with open portability standards.</p>
            </div>
          </div>
          <a href="/api/student/privacy/export" download className="w-full">
            <Button variant="secondary" size="sm" className="w-full gap-2">
              <DownloadSimple size={14} />
              <span>Download Student Data (JSON)</span>
            </Button>
          </a>
        </div>

        {/* Third-Party Connections & Disconnect */}
        <div className="rounded-card border border-border-medium bg-bg-elevated p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-accent-warm-bright">
              <PlugsConnected size={20} aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-text-primary">
                Connected Sources &amp; Disconnect
              </h2>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mb-4">
              Review and immediately disconnect external platforms (GitHub, Kaggle, LeetCode, arXiv, Hugging Face).
              Disconnecting an account immediately halts future background synchronization.
            </p>
            <div className="rounded-md border border-border-subtle bg-bg-primary/40 p-3 text-2xs text-text-dim mb-4 space-y-1">
              <p>• One-click disconnect for individual accounts.</p>
              <p>• Retains student-confirmed skills claims while removing active sync tokens.</p>
            </div>
          </div>
          <Link href="/student/connections" className="w-full">
            <Button variant="ghost" size="sm" className="w-full border border-border-medium">
              Manage Connected Accounts
            </Button>
          </Link>
        </div>
      </div>

      {/* Statutory Rights & Grievance Submission */}
      <div className="rounded-card border border-border-medium bg-bg-elevated p-6 sm:p-8 shadow-card">
        <h2 className="font-display text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
          <FileText size={20} className="text-accent-warm" aria-hidden="true" />
          <span>Submit Statutory Rights or Grievance Request</span>
        </h2>
        <p className="text-xs text-text-muted mb-6">
          Submit formal requests for data access, rectification, account erasure, consent withdrawal, or privacy
          grievances. Every request receives a unique tracking identifier.
        </p>

        <DataRightsRequestCard />
      </div>

      {/* Immutable Consent Ledger Audit Trail */}
      <div className="rounded-card border border-border-medium bg-bg-elevated p-6 sm:p-8 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClockCounterClockwise size={20} className="text-accent-warm" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-text-primary">
              Immutable Consent Ledger &amp; Audit Trail
            </h2>
          </div>
          {data?.lastUpdated && (
            <span className="text-2xs font-mono text-text-dim">
              Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted mb-6">
          Every consent grant and withdrawal is logged with an immutable timestamp, scope, policy version, and source
          UI marker in accordance with CERT-In directions and DPDP compliance requirements.
        </p>

        {loading ? (
          <div className="py-8 text-center text-xs font-mono text-text-dim">Loading consent ledger...</div>
        ) : !data?.auditTrail || data.auditTrail.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-text-dim border border-dashed border-border-subtle rounded-lg">
            No consent audit events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border-subtle text-2xs font-mono uppercase text-text-dim">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Purpose / Scope</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Policy Ver</th>
                  <th className="py-2.5 px-3">Source UI</th>
                  <th className="py-2.5 px-3 font-mono">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {data.auditTrail.slice(0, 15).map((evt) => (
                  <tr key={evt.consentId} className="hover:bg-bg-primary/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-text-dim whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-text-primary">
                      <span>{evt.purpose}</span>
                      {evt.scope && evt.scope !== "*" && (
                        <span className="ml-1.5 font-mono text-2xs text-text-dim">({evt.scope})</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-mono font-medium ${
                          evt.status === "granted"
                            ? "bg-success/15 text-success"
                            : evt.status === "withdrawn"
                            ? "bg-danger/15 text-danger"
                            : "bg-warning/15 text-warning"
                        }`}
                      >
                        {evt.status === "granted" && <CheckCircle size={10} />}
                        {evt.status === "withdrawn" && <XCircle size={10} />}
                        {evt.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-text-dim">v{evt.policyVersion}</td>
                    <td className="py-2.5 px-3 font-mono text-2xs text-text-muted">{evt.sourceUI}</td>
                    <td className="py-2.5 px-3 font-mono text-2xs text-text-dim truncate max-w-[120px]">
                      {evt.consentId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
