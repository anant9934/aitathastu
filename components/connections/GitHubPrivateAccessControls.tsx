"use client";

import { useEffect, useState } from "react";
import { ArrowSquareOut, LockKey, ArrowClockwise, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Button, buttonClass } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { StatusChip } from "@/components/ui/StatusChip";
import { toast } from "@/components/ui/Feedback";

interface PrivateAccessStatus {
  configured: boolean;
  configDiagnostic?: string | null;
  appSlug: string | null;
  installed: boolean;
  installationId: string | null;
  accountLogin: string | null;
  accountType: string | null;
  repositorySelection: "all" | "selected" | null;
  lastSyncedAt: string | null;
  repositoryCount: number;
  privateRepositoryCount: number;
  publicRepositoryCount: number;
  lastSyncStatus: string | null;
  connectedAccount: string | null;
}

export function GitHubPrivateAccessControls() {
  const [busy, setBusy] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [status, setStatus] = useState<PrivateAccessStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [failedList, setFailedList] = useState<Array<{ repo: string; reason: string }>>([]);

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/student/connections/github/private-sync", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const syncPrivate = async () => {
    setBusy(true);
    setProblem(null);
    setMessage(null);
    setFailedList([]);

    try {
      const response = await fetch("/api/student/connections/github/private-sync", { method: "POST" });
      const result = await response.json();

      if (!response.ok && response.status !== 207) {
        throw new Error(result.error || "Private repository sync did not complete.");
      }

      if (result.status === "PARTIAL" || (result.failedRepositories && result.failedRepositories.length > 0)) {
        setFailedList(result.failedRepositories || []);
        const partialMsg = `Partially synced: ${result.processedRepositoryCount} of ${result.totalRepositories} repositories processed. ${result.failedRepositories?.length || 0} repository(s) encountered errors.`;
        setProblem(partialMsg);
        toast.warning("Partial sync", partialMsg);
      } else {
        const summary = `Scanned ${result.totalRepositories} authorized repositories (${result.privateRepositoryCount} private, ${result.publicRepositoryCount} public); updated ${result.recordsCreatedOrUpdated} project records.`;
        setMessage(summary);
        toast.success("Private repositories synced", summary);
      }

      await loadStatus();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Private repository sync failed.";
      setProblem(text);
      toast.error("Private repository sync failed", text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-border-medium bg-bg-surface/50 p-4 space-y-3.5">
      <div className="flex items-start gap-2.5">
        <LockKey size={20} aria-hidden="true" className="mt-0.5 text-champagne shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-text-primary">Private repository access</h3>
            {status?.installed ? (
              <StatusChip tone="verified">GitHub App Active</StatusChip>
            ) : (
              <StatusChip tone="neutral">Optional</StatusChip>
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            GitHub lets you choose specific repositories. AI Tathastu requests read-only metadata and contents; it cannot push commits or modify code.
          </p>
        </div>
      </div>

      {!loadingStatus && status && !status.configured && (
        <Banner kind="warning" title="Server configuration pending">
          {status.configDiagnostic ||
            "Private repository access requires GitHub App credentials on the server (GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_PRIVATE_KEY)."}
        </Banner>
      )}

      {status?.installed && (
        <div className="rounded-md border border-border-light bg-bg-base/70 p-3 text-xs space-y-1.5 text-text-secondary">
          <div className="flex flex-wrap justify-between gap-x-4">
            <span className="text-text-muted">Connected Account:</span>
            <span className="font-mono font-medium text-text-primary">{status.accountLogin || status.connectedAccount}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4">
            <span className="text-text-muted">Repository Selection:</span>
            <span className="capitalize">{status.repositorySelection || "selected repositories"}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4">
            <span className="text-text-muted">Authorized Repositories:</span>
            <span>{status.privateRepositoryCount} private · {status.publicRepositoryCount} public ({status.repositoryCount} total)</span>
          </div>
          {status.lastSyncedAt && (
            <div className="flex flex-wrap justify-between gap-x-4">
              <span className="text-text-muted">Last Synced:</span>
              <span>{new Date(status.lastSyncedAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <a
          className={buttonClass("secondary", "sm")}
          href="/api/auth/github/app-start"
          title="Install or reconfigure GitHub App repository permissions"
        >
          <ArrowSquareOut size={16} aria-hidden="true" />
          {status?.installed ? "Reconfigure repository access" : "Authorize selected repositories"}
        </a>

        {status?.installed && (
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            loadingLabel="Reading repositories…"
            onClick={() => void syncPrivate()}
            icon={<ArrowClockwise size={16} aria-hidden="true" />}
          >
            Sync authorized repositories
          </Button>
        )}
      </div>

      {message && (
        <Banner kind="success" title="Sync complete">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={16} className="text-success shrink-0" />
            <span>{message}</span>
          </div>
        </Banner>
      )}

      {problem && (
        <div className="space-y-2">
          <Banner kind="danger" title="Could not complete private repository sync">
            {problem}
          </Banner>
          {failedList.length > 0 && (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-2.5 text-xs space-y-1">
              <p className="font-medium text-danger">Failed Repositories:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-text-muted">
                {failedList.map((f) => (
                  <li key={f.repo}>
                    <span className="font-mono text-text-primary">{f.repo}</span>: {f.reason}
                  </li>
                ))}
              </ul>
              <div className="pt-1.5">
                <Button size="sm" variant="secondary" onClick={() => void syncPrivate()}>
                  Retry Failed Repositories
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {status?.installed && (
        <div className="pt-2 text-xs text-text-muted border-t border-border-light flex items-center justify-between gap-2">
          <span>To revoke provider-side access, uninstall the app in GitHub:</span>
          <a
            href={status.installationId ? `https://github.com/settings/installations/${status.installationId}` : "https://github.com/settings/installations"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            GitHub Settings <ArrowSquareOut size={13} aria-hidden="true" />
          </a>
        </div>
      )}
    </section>
  );
}
