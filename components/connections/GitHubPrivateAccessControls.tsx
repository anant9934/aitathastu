"use client";

import { useState } from "react";
import { ArrowSquareOut, LockKey, ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { Button, buttonClass } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { toast } from "@/components/ui/Feedback";

export function GitHubPrivateAccessControls() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const syncPrivate = async () => {
    setBusy(true);
    setProblem(null);
    setMessage(null);
    try {
      const response = await fetch("/api/student/connections/github/private-sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || (result.failedRepos?.length ? `Some repositories could not be read (${result.failedRepos.length} failed).` : "Private repository sync did not complete."));
      }
      const summary = `Scanned ${result.repositoryCount} selected repositories; updated ${result.recordsChanged} project records.`;
      setMessage(summary);
      toast.success("Private repositories synced", summary);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Private repository sync failed.";
      setProblem(text);
      toast.error("Private repository sync failed", text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-border-medium bg-bg-surface/50 p-3.5">
      <div className="flex items-start gap-2.5">
        <LockKey size={19} aria-hidden="true" className="mt-0.5 text-champagne" />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">Private repository access</h3>
          <p className="mt-1 text-sm text-text-muted">
            Optional. GitHub will let you choose specific repositories. AI Tathastu requests read-only repository metadata and contents; it cannot push commits or change your code.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a className={buttonClass("secondary", "sm")} href="/api/auth/github/app-start">
          <ArrowSquareOut size={16} aria-hidden="true" /> Authorize selected repositories
        </a>
        <Button size="sm" variant="primary" loading={busy} loadingLabel="Reading repositories…" onClick={() => void syncPrivate()} icon={<ArrowClockwise size={16} aria-hidden="true" />}>
          Sync authorized repositories
        </Button>
      </div>
      {message && <Banner kind="success" title="Sync complete">{message}</Banner>}
      {problem && <div className="mt-3"><Banner kind="danger" title="Could not sync private repositories">{problem}</Banner></div>}
    </section>
  );
}
