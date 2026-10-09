"use client";

/**
 * EORA STUDENT BRIDGE — v1.2 (Phase 5.1)
 *
 * Fetches real student context from /api/eora/context and feeds it into
 * the EoraProvider. This is the authoritative wiring point.
 *
 * Security contract:
 * - Only the authenticated student's own data is returned by the API
 * - No OAuth tokens, passwords, or raw session data are stored here
 * - EORA preferences are scoped to the authenticated personId to prevent
 *   cross-user contamination on shared devices
 * - Context is cleared immediately on unmount (sign-out / navigation away)
 */

import { useEffect, useRef, useCallback } from "react";
import {
  useEoraSafe,
  type EoraLiveStudentData,
} from "@/components/eora/eora-provider";
import type { EoraContextResponse } from "@/app/api/eora/context/route";

interface EoraStudentBridgeProps {
  /** Whether the parent workspace is fully hydrated */
  hydrated: boolean;
  /** Whether this is the student's very first session */
  isFirstSession?: boolean;
}

export function EoraStudentBridge({
  hydrated,
  isFirstSession = false,
}: EoraStudentBridgeProps) {
  const eora = useEoraSafe();
  const fetchedPersonId = useRef<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAndUpdateContext = useCallback(async () => {
    if (!eora) return;

    try {
      const res = await fetch("/api/eora/context", {
        // Credentials: same-origin (session cookie is sent automatically)
        credentials: "same-origin",
      });

      if (!res.ok) {
        // 401 means signed out — clear any existing context
        if (res.status === 401) {
          eora.clearStudentContext();
          fetchedPersonId.current = null;
        }
        return;
      }

      const data: EoraContextResponse = await res.json();

      // Prevent stale context from a previous user if personId changed
      if (
        fetchedPersonId.current &&
        fetchedPersonId.current !== data.personId
      ) {
        eora.clearStudentContext();
      }
      fetchedPersonId.current = data.personId;

      const liveData: EoraLiveStudentData = {
        personId: data.personId,
        displayName: data.displayName,
        isAuthenticated: true,
        activeGoalTitle: data.activeGoalTitle,
        targetRole: data.targetRole,
        primaryPriority: data.primaryPriority,
        secondaryPriorities: data.secondaryPriorities,
        skillsCount: data.skillsCount,
        projectsCount: data.projectsCount,
        verifiedEvidenceCount: data.verifiedEvidenceCount,
        connectedSources: data.connectedSources,
        nextMilestoneTitle: data.nextMilestoneTitle,
        isProcessing: data.isProcessing,
        isFirstSession,
      };

      eora.updateLiveStudentContext(liveData);
    } catch {
      // Network error — EORA continues with stale or empty context gracefully
    }
  }, [eora, isFirstSession]);

  // Initial fetch when workspace is hydrated
  useEffect(() => {
    if (!hydrated || !eora) return;
    fetchAndUpdateContext();
  }, [hydrated, eora, fetchAndUpdateContext]);

  // Re-fetch when the tab becomes visible (handles long sessions)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && hydrated) {
        fetchAndUpdateContext();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [hydrated, fetchAndUpdateContext]);

  // Clear context and cancel retries on unmount (sign-out / nav away)
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      eora?.clearStudentContext();
      fetchedPersonId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null; // Pure side-effect component
}
