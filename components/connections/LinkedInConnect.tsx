"use client";

/**
 * LinkedIn profile connection — three distinct paths:
 *   1. Link profile URL — saves a reference_only connection, no data import.
 *   2. Extract public profile — Apify-powered extraction (requires server configuration).
 *   3. Upload LinkedIn data export — CSV/ZIP/JSON import via the existing parser.
 *
 * Automated password login is permanently disabled (LinkedIn ToS).
 * This step is optional; onboarding and scoring work without it.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  LinkedinLogo, LinkSimple, Upload, Spinner, CheckCircle, WarningCircle, MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { Banner } from "@/components/ui/Banner";

type ImportResult = {
  ok: boolean;
  status?: string;
  totalRecords?: number;
  positions?: number;
  education?: number;
  skills?: number;
  certifications?: number;
  recordsDiscovered?: number;
  recordsPersisted?: number;
  lastExtractedAt?: string | null;
  message?: string;
  error?: string;
};

type ExtractionState =
  | "idle"          // not started
  | "queued"        // actor started, polling
  | "extracting"    // still running
  | "synced"        // success
  | "partial"       // some records
  | "no_results"    // actor returned nothing
  | "failed"        // actor or network error
  | "not_configured"; // no actor in env

type Mode = "idle" | "url" | "upload" | "extract";

export function LinkedInConnect({ onSettled }: { onSettled?: (state: string) => void }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [urlDone, setUrlDone] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // URL linking
  const [profileUrl, setProfileUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlBusy, setUrlBusy] = useState(false);

  // CSV upload
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apify extraction
  const [extractionState, setExtractionState] = useState<ExtractionState>("idle");
  const [extractionBusy, setExtractionBusy] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionMsg, setExtractionMsg] = useState<string | null>(null);
  const [extractionRecords, setExtractionRecords] = useState<number | null>(null);
  const [extractionConfigured, setExtractionConfigured] = useState<boolean | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A profile link saved earlier is server state; show it after a refresh too.
  useEffect(() => {
    void requestJson<{ connectors?: Array<{ provider: string; status: string; profileUrl: string | null }> }>("/api/student/connections", { cache: "no-store" }).then((res) => {
      if (!res.ok) return;
      const li = res.data.connectors?.find((c) => c.provider === "linkedin");
      if (li && li.status !== "not_connected" && li.status !== "disconnected" && li.profileUrl) {
        setUrlDone(true);
        setProfileUrl((u) => u || li.profileUrl || "");
      }
    });
  }, []);

  // Check extraction configuration once on mount
  useEffect(() => {
    void requestJson<ImportResult>("/api/student/linkedin/extract").then((res) => {
      if (res.ok) {
        const st = res.data.status;
        setExtractionConfigured(st !== "not_configured");
        if (st === "synced" || st === "partially_extracted") {
          setExtractionState(st === "synced" ? "synced" : "partial");
          setExtractionRecords(res.data.recordsPersisted ?? null);
        } else if (st === "extraction_queued" || st === "extracting") {
          setExtractionState("queued");
          schedulePoll();
        }
      } else {
        setExtractionConfigured(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedulePoll = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(async () => {
      const res = await requestJson<ImportResult>("/api/student/linkedin/extract");
      if (!res.ok) { setExtractionState("failed"); return; }
      const st = res.data.status;
      if (st === "extracting" || st === "extraction_queued") {
        setExtractionState("extracting");
        schedulePoll();
      } else if (st === "synced") {
        setExtractionState("synced");
        setExtractionRecords(res.data.recordsPersisted ?? null);
        onSettled?.("succeeded");
      } else if (st === "partially_extracted") {
        setExtractionState("partial");
        setExtractionRecords(res.data.recordsPersisted ?? null);
        onSettled?.("succeeded");
      } else if (st === "no_results") {
        setExtractionState("no_results");
      } else {
        setExtractionState("failed");
        setExtractionError(res.data.message ?? "Extraction failed.");
      }
    }, 4000);
  }, [onSettled]);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const linkUrl = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    if (!profileUrl.trim()) { setUrlError("Enter your LinkedIn profile URL."); return; }
    setUrlBusy(true);
    const res = await requestJson<{ state?: string; error?: string }>("/api/student/linkedin", {
      method: "POST",
      json: { profileUrl: profileUrl.trim(), consent: true },
    });
    setUrlBusy(false);
    if (!res.ok) { setUrlError(res.error?.message ?? describeError(res.error)); return; }
    setUrlDone(true);
    setMode("idle");
    onSettled?.("succeeded");
  }, [profileUrl, onSettled]);

  const uploadFile = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    if (!file) { setUploadError("Select a file first."); return; }
    setUploadBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await requestJson<ImportResult>("/api/student/linkedin/import", { method: "POST", body: fd });
    setUploadBusy(false);
    if (!res.ok) { setUploadError(res.error?.message ?? describeError(res.error)); return; }
    setImportResult(res.data);
    setImportDone(true);
    setMode("idle");
    setFile(null);
    onSettled?.("succeeded");
  }, [file, onSettled]);

  const startExtract = useCallback(async () => {
    setExtractionError(null);
    const url = profileUrl.trim();
    if (!url) { setExtractionError("Enter your LinkedIn profile URL first."); return; }
    setExtractionBusy(true);
    const res = await requestJson<ImportResult>("/api/student/linkedin/extract", {
      method: "POST",
      json: { profileUrl: url },
    });
    setExtractionBusy(false);
    if (!res.ok) {
      const errData = res.data as { status?: string; message?: string } | undefined;
      const st = errData?.status;
      if (st === "not_configured") {
        setExtractionConfigured(false);
        setExtractionError("Apify extraction is not configured on this server.");
      } else {
        setExtractionState("failed");
        setExtractionError(errData?.message ?? describeError(res.error));
      }
      return;
    }
    const st = res.data.status;
    if (st === "extraction_queued" || st === "extracting") {
      setExtractionState("queued");
      setExtractionMsg(res.data.message ?? null);
      schedulePoll();
    } else if (st === "synced") {
      setExtractionState("synced");
      setExtractionRecords(res.data.recordsPersisted ?? null);
      onSettled?.("succeeded");
    } else if (st === "partially_extracted") {
      setExtractionState("partial");
      setExtractionRecords(res.data.recordsPersisted ?? null);
      onSettled?.("succeeded");
    } else if (st === "no_results") {
      setExtractionState("no_results");
    } else {
      setExtractionState("failed");
      setExtractionError(res.data.message ?? "Extraction failed.");
    }
  }, [profileUrl, schedulePoll, onSettled]);

  const reset = () => { setMode("idle"); setUrlError(null); setUploadError(null); setFile(null); setExtractionError(null); };

  const extractionLabel: string | null =
    extractionState === "queued" || extractionState === "extracting"
      ? extractionMsg ?? "Extracting profile data…"
      : extractionState === "synced"
      ? `Extracted${extractionRecords != null ? ` ${extractionRecords} records` : ""}. Review in the next step.`
      : extractionState === "partial"
      ? `Partially extracted${extractionRecords != null ? ` (${extractionRecords} records)` : ""}.`
      : extractionState === "no_results"
      ? "No profile data found. Check that the profile URL is public and correct."
      : null;

  return (
    <section aria-labelledby="li-title" className="rounded-card border border-border-medium bg-bg-elevated p-4 sm:p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <LinkedinLogo size={22} aria-hidden="true" className="text-champagne" />
        <h3 id="li-title" className="font-display text-base font-semibold text-text-primary">LinkedIn</h3>
        <StatusChip tone="neutral" icon={null}>Optional</StatusChip>
        {importDone || extractionState === "synced" ? (
          <StatusChip tone="verified" icon={CheckCircle}>Imported</StatusChip>
        ) : extractionState === "partial" ? (
          <StatusChip tone="warning" icon={null}>Partly extracted</StatusChip>
        ) : urlDone ? (
          <StatusChip tone="corroborated" icon={null}>Profile linked</StatusChip>
        ) : null}
      </div>
      <p className="mt-2 max-w-[62ch] text-sm text-text-muted">
        Adds your work history and education. Skipping is always free.
      </p>

      {extractionLabel && (
        <p aria-live="polite" className={`mt-2 text-sm ${extractionState === "failed" || extractionState === "no_results" ? "text-warning" : "text-text-primary"}`}>
          {extractionState === "queued" || extractionState === "extracting"
            ? <Spinner size={12} aria-hidden="true" className="inline mr-1.5 animate-spin" />
            : null}
          {extractionLabel}
        </p>
      )}
      {extractionError && <p aria-live="assertive" className="mt-2 text-sm text-danger">{extractionError}</p>}

      {/* ── Idle: show action buttons ── */}
      {mode === "idle" && (
        <div className="mt-4 grid gap-4">
          {/* Profile URL section */}
          {!urlDone && (
            <Button variant="secondary" size="sm" icon={<LinkSimple size={15} aria-hidden="true" />} onClick={() => { setMode("url"); setUrlError(null); }}>
              Link profile URL
            </Button>
          )}
          {urlDone && (
            <p className="text-xs text-verified flex items-center gap-1.5"><CheckCircle size={12} aria-hidden="true" />Profile URL saved.</p>
          )}

          {/* Apify extraction */}
          {extractionConfigured !== null && (
            <div className="flex flex-wrap items-center gap-2">
              {extractionConfigured ? (
                extractionState === "idle" || extractionState === "failed" || extractionState === "no_results" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<MagnifyingGlass size={15} aria-hidden="true" />}
                    onClick={() => { setMode("extract"); setExtractionError(null); }}
                  >
                    {extractionState === "failed" ? "Retry extraction" : "Extract public profile"}
                  </Button>
                ) : (extractionState === "synced" || extractionState === "partial") ? (
                  <Button variant="ghost" size="sm" onClick={() => { setMode("extract"); setExtractionError(null); }}>
                    Re-extract profile
                  </Button>
                ) : null
              ) : (
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <WarningCircle size={12} aria-hidden="true" className="shrink-0" />
                  Public profile extraction is not configured on this server.
                </p>
              )}
            </div>
          )}

          {/* CSV import */}
          {!importDone ? (
            <Button variant="secondary" size="sm" icon={<Upload size={15} aria-hidden="true" />} onClick={() => { setMode("upload"); setUploadError(null); }}>
              Upload data export
            </Button>
          ) : (
            <p className="text-xs text-verified flex items-center gap-1.5">
              <CheckCircle size={12} aria-hidden="true" />
              {importResult?.totalRecords ? `${importResult.totalRecords} records imported.` : "Export processed."}
            </p>
          )}
        </div>
      )}

      {/* ── URL link form ── */}
      {mode === "url" && (
        <form onSubmit={linkUrl} noValidate className="mt-4 grid max-w-md gap-3">
          <p className="text-xs text-text-muted">Enter your public LinkedIn URL. Only the link is saved — no profile data is fetched.</p>
          <TextField
            label="LinkedIn profile URL"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://linkedin.com/in/yourname"
            value={profileUrl}
            onChange={(e) => { setProfileUrl(e.target.value); setUrlError(null); }}
          />
          {urlError && <Banner kind="danger">{urlError}</Banner>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={urlBusy} loadingLabel="Linking…">Link profile</Button>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}

      {/* ── Apify extraction form ── */}
      {mode === "extract" && (
        <div className="mt-4 grid max-w-md gap-3">
          <p className="text-xs text-text-muted">
            Extracts your public work history, education and skills from your LinkedIn profile. Only publicly visible data is collected.
          </p>
          <TextField
            label="LinkedIn profile URL"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://linkedin.com/in/yourname"
            value={profileUrl}
            onChange={(e) => { setProfileUrl(e.target.value); setExtractionError(null); }}
          />
          {extractionError && <Banner kind="danger">{extractionError}</Banner>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              loading={extractionBusy || extractionState === "queued" || extractionState === "extracting"}
              loadingLabel="Extracting…"
              onClick={() => void startExtract()}
            >
              Extract profile
            </Button>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── CSV upload form ── */}
      {mode === "upload" && (
        <form onSubmit={uploadFile} noValidate className="mt-4 grid max-w-md gap-3">
          <div className="rounded-md border border-line-soft bg-bg-surface/50 p-3 text-xs text-text-muted space-y-1">
            <p className="font-medium text-text-primary">How to get your LinkedIn data export:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Go to LinkedIn → Settings &amp; Privacy → Data privacy → Get a copy of your data.</li>
              <li>Select &quot;Want something in particular?&quot; and tick Positions, Education, Skills.</li>
              <li>Click &quot;Request archive&quot;. LinkedIn emails a link within 10 minutes.</li>
              <li>Download and upload the ZIP here, or upload individual CSV files.</li>
            </ol>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5" htmlFor="li-file">
              LinkedIn export file <span className="text-text-muted font-normal">(ZIP, CSV, or JSON)</span>
            </label>
            <input
              id="li-file"
              ref={fileInputRef}
              type="file"
              accept=".zip,.csv,.json"
              className="block w-full text-sm text-text-muted file:mr-3 file:rounded file:border-0 file:bg-bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-primary hover:file:bg-bg-elevated"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setUploadError(null); }}
            />
            {file && <p className="mt-1 text-xs text-text-muted">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
          </div>
          {uploadError && <Banner kind="danger">{uploadError}</Banner>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={!file} loading={uploadBusy} loadingLabel="Importing…">Import</Button>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}
