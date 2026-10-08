"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ShieldCheck, ArrowRight, X, AlertCircle } from "lucide-react";
import { ONBOARDING_STORAGE_KEY, safeJourney } from "@/lib/onboarding";
import { loadWorkspaceState } from "@/lib/domain/workspace";

export const SYNCED_STORAGE_KEY = "ai-tathastu-synced-v1";

type ImportContinuityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
};

export function ImportContinuityModal({ isOpen, onClose, onImportComplete }: ImportContinuityModalProps) {
  const [localDataPreview, setLocalDataPreview] = useState<{
    goalTitle: string;
    evidenceCount: number;
    hasData: boolean;
  } | null>(null);

  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    try {
      const isSynced = window.localStorage.getItem(SYNCED_STORAGE_KEY);
      if (isSynced === "true") {
        setLocalDataPreview(null);
        return;
      }

      const ws = loadWorkspaceState();
      let goalTitle = ws?.goal?.title || "";
      let evidenceCount = ws?.evidence?.length || 0;

      if (!ws) {
        const rawOnboarding = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (rawOnboarding) {
          const ob = safeJourney(JSON.parse(rawOnboarding));
          if (ob.goal) goalTitle = ob.goal;
          if (ob.details.skills) {
            evidenceCount += ob.details.skills.split(/[,;\n]+/).filter(Boolean).length;
          }
        }
      }

      if (goalTitle || evidenceCount > 0) {
        setLocalDataPreview({
          goalTitle: goalTitle || "Active Direction",
          evidenceCount,
          hasData: true,
        });
      } else {
        setLocalDataPreview(null);
      }
    } catch (e) {
      console.warn("Unable to inspect local data for import", e);
    }
  }, [isOpen]);

  if (!isOpen || !localDataPreview?.hasData) {
    return null;
  }

  const handleImport = async () => {
    setImporting(true);
    setError(null);

    try {
      let workspaceState = null;
      let onboardingState = null;

      try {
        workspaceState = loadWorkspaceState();
        const rawOb = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (rawOb) onboardingState = safeJourney(JSON.parse(rawOb));
      } catch (e) {
        console.warn("Error reading local state", e);
      }

      const res = await fetch("/api/student/import-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceState,
          onboardingState,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import local progress.");
      }

      // Mark locally as synchronized so user is not prompted again
      window.localStorage.setItem(SYNCED_STORAGE_KEY, "true");

      onImportComplete();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred during import.";
      setError(message);
    } finally {
      setImporting(false);
    }
  };

  const handleStartFresh = () => {
    // Dismiss without importing, mark synced
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SYNCED_STORAGE_KEY, "true");
    }
    onClose();
  };

  return (
    <div className="ws-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="continuity-title">
      <div className="ws-modal-card" style={{ maxWidth: 540 }}>
        <div className="ws-modal-header">
          <div className="ws-modal-badge">
            <Sparkles size={14} />
            <span>CONTINUITY DETECTED</span>
          </div>
          <button
            onClick={onClose}
            className="ws-modal-close-btn"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="ws-modal-body">
          <h2 id="continuity-title" className="ws-modal-title">
            Continue with your progress?
          </h2>
          <p className="ws-modal-desc">
            We found progress saved on this device. You can connect it to your account so your active direction, honest evidence, and next actions follow you anywhere.
          </p>

          <div
            style={{
              background: "#f4f1fc",
              border: "1px solid #e2dcfa",
              borderRadius: 14,
              padding: "16px 18px",
              margin: "18px 0",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #5942dc, #8c72f5)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              E
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontStyle: "italic", color: "#32295a", lineHeight: 1.45 }}>
                “I found earlier progress on this device. Would you like to import it?”
              </div>
              <div style={{ fontSize: 12, color: "#696384", marginTop: 4 }}>
                Found: <strong>{localDataPreview.goalTitle}</strong> • {localDataPreview.evidenceCount} recorded evidence items.
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#faf9f7",
              border: "1px solid #e9e6e2",
              borderRadius: 12,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12.5,
              color: "#535063",
              marginBottom: 20,
            }}
          >
            <ShieldCheck size={18} color="#5942dc" style={{ flexShrink: 0 }} />
            <span>
              <strong>Provenance preserved:</strong> Resume-extracted and self-reported items will remain strictly unverified. Trust levels are never inflated.
            </span>
          </div>

          {error && (
            <div
              style={{
                background: "#fdf2f2",
                border: "1px solid #fbcaca",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#991b1b",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="ws-modal-actions" style={{ gap: 12 }}>
            <button
              onClick={handleImport}
              disabled={importing}
              className="ws-btn ws-btn-primary"
              style={{ flex: 1, minHeight: 46 }}
            >
              {importing ? (
                <span>Connecting progress…</span>
              ) : (
                <>
                  <span>Import my progress</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
            <button
              onClick={handleStartFresh}
              disabled={importing}
              className="ws-btn ws-btn-secondary"
              style={{ minHeight: 46 }}
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
