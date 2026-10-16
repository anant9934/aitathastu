"use client";

/** The signed-in person's Person 360 record (GET /api/student/person-360). */
import { useCallback, useEffect, useState } from "react";
import { requestJson, describeError } from "./api";

export type EvidenceItem = {
  id: string;
  category: string;
  subject: string;
  value: string;
  source: string;
  verificationStatus: string;
  sourceReference?: string | null;
  verifiedAt?: string | null;
  observedAt?: string | null;
  interpretation?: string | null;
};

export type VerificationRequest = { id: string; evidenceId: string; status: string; reviewerNotes?: string | null; createdAt?: string };

export type Person360 = {
  person: { id: string; displayName: string; createdAt: string };
  profile: {
    headline?: string; bio?: string; institution?: string; degree?: string; specialization?: string;
    currentYear?: string; expectedGraduationYear?: number | null; placementStatus?: string; internshipStatus?: string; updatedAt?: string;
  } | null;
  activeGoal: { id: string; title: string; description?: string } | null;
  evidence: EvidenceItem[];
  verificationRequests: VerificationRequest[];
  journeySummary: { id: string; type: string; title: string; description?: string; timestamp: string }[];
  projects: { id: string; title: string; description?: string; technologies: string[]; sources: string[]; status: string; updatedAt: string }[];
  assessments: Record<string, unknown>[];
  interviews: Record<string, unknown>[];
  preferences: { primaryPriority?: string; secondaryPriorities?: string[]; metadata?: Record<string, unknown> } | null;
};

export function usePerson360() {
  const [data, setData] = useState<Person360 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const res = await requestJson<Person360>("/api/student/person-360", { cache: "no-store" });
    if (res.ok) { setData(res.data); setError(null); } else setError(describeError(res.error));
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, reload, setData };
}

export const VERIFICATION_VIEW: Record<string, { label: string; tone: "verified" | "warning" | "danger" | "neutral" | "busy" | "evidenced" | "signal" }> = {
  verified: { label: "Verified", tone: "verified" },
  verification_requested: { label: "Verification requested", tone: "busy" },
  under_review: { label: "Under review", tone: "busy" },
  changes_requested: { label: "Changes requested", tone: "warning" },
  rejected: { label: "Not verified", tone: "danger" },
  imported: { label: "Imported", tone: "evidenced" },
  self_reported: { label: "Your word", tone: "neutral" },
  unverified: { label: "Not verified yet", tone: "neutral" },
};
