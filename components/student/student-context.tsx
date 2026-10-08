"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  type WorkspaceState,
  type Goal,
  type EvidenceItem,
  type JourneyEvent,
  type ActionStatus,
  type Recommendation,
  type GapEvaluation,
  type PersonProfile,
  type EvidenceCategory,
  type EvidenceSource,
  type VerificationStatus,
  type JourneyEventType,
  type ReadinessResult,
  createGoal,
  createPersonProfile,
  evaluateGaps,
  computeNextActions,
  calculateReadiness,
} from "@/lib/domain";

import { SYNCED_STORAGE_KEY } from "./import-continuity-modal";
import { ONBOARDING_STORAGE_KEY } from "@/lib/onboarding";
import { WORKSPACE_STORAGE_KEY } from "@/lib/domain/workspace";

  type ApiEvidenceItem = {
  id: string;
  category: EvidenceCategory;
  subject: string;
  value: string;
  source: EvidenceSource;
  verificationStatus: VerificationStatus;
  observedAt: string;
  interpretation: string;
  whyItMatters: string;
  sourceReference?: string | null;
  verifiedByPersonId?: string | null;
  verifiedAt?: string | null;
  verificationMethod?: string | null;
  verificationDecisionId?: string | null;
};

type ApiJourneyEvent = {
  id: string;
  type: JourneyEventType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type VerificationRequestItem = {
  id: string;
  evidenceId: string;
  requesterPersonId: string;
  organizationId: string;
  status: string;
  supportingReference?: string | null;
  studentNotes?: string | null;
  requestedAt: string;
  resolvedAt?: string | null;
  decisions: Array<{
    id: string;
    decision: string;
    reason?: string | null;
    method: string;
    createdAt: string;
  }>;
};

type AuthUser = {
  id: string;
  email: string;
};

type AuthPerson = {
  id: string;
  displayName: string;
};

type WorkspaceContextType = {
  workspace: WorkspaceState | null;
  hydrated: boolean;
  user: AuthUser | null;
  person: AuthPerson | null;
  activeGoal: Goal | null;
  evidence: EvidenceItem[];
  journeyEvents: JourneyEvent[];
  gapEval: GapEvaluation | null;
  recommendations: Recommendation[];
  readiness: ReadinessResult | null;
  verificationRequests: VerificationRequestItem[];
  showContinuityModal: boolean;
  setShowContinuityModal: (show: boolean) => void;
  updateActiveGoal: (newTitle: string, description?: string) => Promise<void>;
  updateActionStatus: (actionId: string, status: ActionStatus, actionTitle: string) => Promise<void>;
  addEvidence: (params: { category: string; subject: string; value: string; whyItMatters?: string }) => Promise<void>;
  updateProfile: (updates: { displayName?: string; education?: string; experience?: string; headline?: string }) => Promise<void>;
  requestVerification: (evidenceId: string, options?: { supportingReference?: string; studentNotes?: string }) => Promise<{ success: boolean; error?: string }>;
  resubmitVerification: (requestId: string, options?: { supportingReference?: string; studentNotes?: string }) => Promise<{ success: boolean; error?: string }>;
  dismissEora: () => Promise<void>;
  restoreEora: () => Promise<void>;
  reloadWorkspace: () => Promise<void>;
  signOut: () => Promise<void>;
};


const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [person, setPerson] = useState<AuthPerson | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequestItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showContinuityModal, setShowContinuityModal] = useState(false);

  // Load from persistent Person 360 API
  const fetchPerson360 = useCallback(async () => {
    try {
      // 1. Check Session
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();

      if (!sessionRes.ok || !sessionData.authenticated) {
        // Not authenticated -> redirect to sign-in preserving intended destination
        const currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/student";
        router.push(`/sign-in?from=${encodeURIComponent(currentPath)}`);
        return;
      }

      setUser(sessionData.user);
      setPerson(sessionData.person);

      // 2. Fetch Person 360 Data
      const res = await fetch("/api/student/person-360");
      if (!res.ok) {
        throw new Error("Failed to load workspace data.");
      }

      const p360 = await res.json();
      setVerificationRequests(p360.verificationRequests || []);

      // Convert Person 360 result to Domain WorkspaceState
      const domainPerson: PersonProfile = createPersonProfile({
        id: p360.person.id,
        name: p360.person.displayName,
        education: p360.profile.education,
        experience: p360.profile.experience,
        createdAt: p360.person.createdAt,
        updatedAt: p360.person.updatedAt,
      });

      const domainGoal: Goal = p360.activeGoal
        ? {
            id: p360.activeGoal.id,
            title: p360.activeGoal.title,
            description: p360.activeGoal.description,
            status: p360.activeGoal.status,
            source: p360.activeGoal.source,
            createdAt: p360.person.createdAt,
            updatedAt: p360.activeGoal.updatedAt,
          }
        : createGoal("ML Engineer");

      const domainEvidence: EvidenceItem[] = (p360.evidence || []).map((e: ApiEvidenceItem) => ({
        id: e.id,
        category: e.category,
        subject: e.subject,
        value: e.value,
        source: e.source,
        verificationStatus: e.verificationStatus,
        observedAt: e.observedAt,
        createdAt: e.observedAt,
        interpretation: e.interpretation,
        whyItMatters: e.whyItMatters,
        sourceReference: e.sourceReference || null,
        verifiedByPersonId: e.verifiedByPersonId || null,
        verifiedAt: e.verifiedAt || null,
        verificationMethod: e.verificationMethod || null,
        verificationDecisionId: e.verificationDecisionId || null,
      }));


      const domainEvents: JourneyEvent[] = (p360.journeySummary || []).map((j: ApiJourneyEvent) => ({
        id: j.id,
        type: j.type,
        title: j.title,
        description: j.description,
        timestamp: j.timestamp,
        metadata: j.metadata || undefined,
      }));

      const nextWorkspace: WorkspaceState = {
        version: 1,
        person: domainPerson,
        goal: domainGoal,
        evidence: domainEvidence,
        journeyEvents: domainEvents,
        actionStates: p360.actionStates || {},
        eoraDismissed: p360.preferences?.eoraDismissed || false,
        lastUpdated: new Date().toISOString(),
      };

      setWorkspace(nextWorkspace);

      // 3. Check for unsynced local data to offer continuity import
      if (typeof window !== "undefined") {
        const isSynced = window.localStorage.getItem(SYNCED_STORAGE_KEY);
        if (isSynced !== "true") {
          const hasLocalWs = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
          const hasLocalOb = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
          if (hasLocalWs || hasLocalOb) {
            setShowContinuityModal(true);
          }
        }
      }
    } catch (err) {
      console.error("[Workspace Load Error]", err);
    } finally {
      setHydrated(true);
    }
  }, [router]);

  useEffect(() => {
    fetchPerson360();
  }, [fetchPerson360]);

  const activeGoal = workspace?.goal || null;
  const evidence = useMemo(() => workspace?.evidence || [], [workspace?.evidence]);
  const journeyEvents = useMemo(() => workspace?.journeyEvents || [], [workspace?.journeyEvents]);

  // Phase 3 Deterministic Engines
  const gapEval = useMemo(() => {
    if (!activeGoal) return null;
    return evaluateGaps(activeGoal.title, evidence);
  }, [activeGoal, evidence]);

  const recommendations = useMemo(() => {
    if (!activeGoal || !gapEval) return [];
    return computeNextActions(activeGoal, evidence, gapEval, workspace?.actionStates || {});
  }, [activeGoal, gapEval, evidence, workspace?.actionStates]);

  // Phase 5 Defensible Readiness Engine
  const readiness = useMemo(() => {
    if (!activeGoal) return null;
    return calculateReadiness(activeGoal, evidence);
  }, [activeGoal, evidence]);

  const requestVerification = useCallback(
    async (evidenceId: string, options?: { supportingReference?: string; studentNotes?: string }) => {
      try {
        const res = await fetch("/api/verification/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceId,
            supportingReference: options?.supportingReference,
            studentNotes: options?.studentNotes,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to submit verification request.");
        await fetchPerson360();
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error submitting request.";
        return { success: false, error: msg };
      }
    },
    [fetchPerson360]
  );

  const resubmitVerification = useCallback(
    async (requestId: string, options?: { supportingReference?: string; studentNotes?: string }) => {
      try {
        const res = await fetch("/api/verification/resubmit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            supportingReference: options?.supportingReference,
            studentNotes: options?.studentNotes,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to resubmit verification request.");
        await fetchPerson360();
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error resubmitting request.";
        return { success: false, error: msg };
      }
    },
    [fetchPerson360]
  );

  const updateActiveGoal = useCallback(
    async (newTitle: string, description?: string) => {
      try {
        const res = await fetch("/api/student/goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle, description }),
        });
        if (!res.ok) throw new Error("Failed to update goal.");
        await fetchPerson360();
      } catch (err) {
        console.error("Error updating goal:", err);
      }
    },
    [fetchPerson360]
  );

  const updateActionStatus = useCallback(
    async (actionId: string, status: ActionStatus, actionTitle: string) => {
      try {
        const res = await fetch("/api/student/action-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionId, status, actionTitle }),
        });
        if (!res.ok) throw new Error("Failed to update action status.");
        await fetchPerson360();
      } catch (err) {
        console.error("Error updating action status:", err);
      }
    },
    [fetchPerson360]
  );

  const addEvidence = useCallback(
    async (params: { category: string; subject: string; value: string; whyItMatters?: string }) => {
      try {
        const res = await fetch("/api/student/evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (!res.ok) throw new Error("Failed to add evidence.");
        await fetchPerson360();
      } catch (err) {
        console.error("Error adding evidence:", err);
      }
    },
    [fetchPerson360]
  );

  const updateProfile = useCallback(
    async (updates: { displayName?: string; education?: string; experience?: string; headline?: string }) => {
      try {
        const res = await fetch("/api/student/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update profile.");
        await fetchPerson360();
      } catch (err) {
        console.error("Error updating profile:", err);
      }
    },
    [fetchPerson360]
  );

  const dismissEora = useCallback(async () => {
    try {
      await fetch("/api/student/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eoraDismissed: true }),
      });
      if (workspace) {
        setWorkspace({ ...workspace, eoraDismissed: true });
      }
    } catch (err) {
      console.error("Error dismissing EORA:", err);
    }
  }, [workspace]);

  const restoreEora = useCallback(async () => {
    try {
      await fetch("/api/student/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eoraDismissed: false }),
      });
      if (workspace) {
        setWorkspace({ ...workspace, eoraDismissed: false });
      }
    } catch (err) {
      console.error("Error restoring EORA:", err);
    }
  }, [workspace]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } catch (err) {
      console.warn("Sign out request error", err);
    } finally {
      router.push("/sign-in");
      router.refresh();
    }
  }, [router]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        hydrated,
        user,
        person,
        activeGoal,
        evidence,
        journeyEvents,
        gapEval,
        recommendations,
        readiness,
        verificationRequests,
        showContinuityModal,
        setShowContinuityModal,
        updateActiveGoal,
        updateActionStatus,
        addEvidence,
        updateProfile,
        requestVerification,
        resubmitVerification,
        dismissEora,
        restoreEora,
        reloadWorkspace: fetchPerson360,
        signOut,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );

}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
