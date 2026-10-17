"use client";

/**
 * CV upload and review state (logic from the Phase 2 Screen 5; presentation is
 * new). Every busy state mirrors a real server job state from
 * GET /api/resume/[id]/status; nothing is timer-driven.
 *   UPLOADING        POST /api/resume/extract in flight
 *   QUEUED           job stored, not yet picked up
 *   PROCESSING       server is parsing / OCRing (label from the job stage)
 *   REVIEW_REQUIRED  job is review_ready, candidates shown
 *   SAVING           POST /api/resume/[id]/apply in flight
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson, describeError } from "@/lib/client/api";
import { RESUME_MAX_UPLOAD_BYTES, RESUME_MAX_UPLOAD_MB } from "@/lib/config/upload-limits";
import type { ReviewedResumeClaim } from "./types";

export type ResumeProcessingState = "IDLE" | "UPLOADING" | "QUEUED" | "PROCESSING" | "REVIEW_REQUIRED" | "SAVING" | "COMPLETED" | "FAILED";

export type ResumeCandidate = Omit<ReviewedResumeClaim, "category"> & {
  id: string;
  selected: boolean;
  category: ReviewedResumeClaim["category"] | "achievement" | "profile" | "link" | "publication";
  field?: string;
};

export type AcceptedResumeProfile = Partial<Record<"fullName" | "email" | "mobile" | "location" | "degree" | "specialization" | "institution" | "currentYear" | "expectedGraduationYear" | "gpa", string>>;

export type ResumeExtraData = {
  extractedProfile?: Record<string, unknown>;
  acceptedProfile?: AcceptedResumeProfile;
  acceptedLinks?: Partial<Record<string, string>>;
  acceptedPortfolioUrls?: string[];
  reviewSummary?: Record<string, { total: number; accepted: number }>;
  discoveredProfiles?: Partial<Record<string, string>>;
  extractedProjects?: Array<{ title: string; description: string; technologies: string[]; repositoryUrl?: string; sourceSpan: string }>;
  extractedEducation?: Array<{ institution: string; degree: string; fieldOfStudy?: string; graduationYear?: string; startDate?: string; endDate?: string; gpa?: string; percentage?: string; academicLevel?: string }>;
  extractedExperience?: Array<{ company: string; role: string; type?: string; duration?: string; startDate?: string; endDate?: string; highlights?: string[]; technologies?: string[]; sourceSpan: string }>;
  extractedAchievements?: Array<{ title: string; category?: string; subType?: string; issuer?: string; date?: string; description?: string; sourceSpan: string }>;
};

type JobStatus = {
  ok: boolean;
  documentId: string;
  jobId: string;
  filename?: string;
  status: "queued" | "processing" | "review_ready" | "completed" | "failed" | "timed_out" | "cancelled" | "retry";
  stage?: string;
  errorCode?: string | null;
  message?: string | null;
  retryable?: boolean;
  result?: Record<string, any> | null;
};

const RECORD_CANDIDATE_ID = /^[a-z]+_\d+$/;

/** Review sections, structured per record category (Phase 8). */
export const REVIEW_GROUPS: Array<{ id: string; title: string; categories: ResumeCandidate["category"][] }> = [
  { id: "identity", title: "Identity and contact", categories: ["profile"] },
  { id: "education", title: "Education", categories: ["education"] },
  { id: "skills", title: "Skills", categories: ["skill"] },
  { id: "experience", title: "Experience and training", categories: ["experience"] },
  { id: "projects", title: "Projects", categories: ["project"] },
  { id: "certifications", title: "Certifications", categories: ["certification"] },
  { id: "publications", title: "Research and publications", categories: ["publication"] },
  { id: "achievements", title: "Achievements", categories: ["achievement"] },
  { id: "links", title: "Digital footprints", categories: ["link"] },
];

export const FIELD_LABELS: Record<string, string> = {
  fullName: "Full name", email: "Email", mobile: "Phone", location: "Location",
  institution: "Institution", degree: "Degree", specialization: "Field of study",
  expectedGraduationYear: "Graduation year", github: "GitHub", linkedin: "LinkedIn", portfolio: "Portfolio",
};

const STAGE_LABELS: Record<string, string> = {
  acquire: "Waiting for the document reader",
  parse: "Reading the document text",
  extract: "Reading scanned pages (this can take a minute)",
  validate: "Pulling out skills, education and projects",
  persist: "Saving suggestions for your review",
};

const POLL_INTERVAL_MS = 1500;
const POLL_DEADLINE_MS = 6 * 60_000;

export type ResumeIngestion = ReturnType<typeof useResumeIngestion>;

export function useResumeIngestion({
  initialFileName,
  initialDocumentId,
  ensureSession,
  onDocumentStored,
  onExtractionReady,
  onSpeak,
}: {
  initialFileName?: string | null;
  initialDocumentId?: string | null;
  ensureSession: () => Promise<boolean>;
  onDocumentStored?: (documentId: string, fileName: string) => void;
  onExtractionReady?: () => void;
  onSpeak?: (text: string, mood?: string) => void;
}) {
  const selectedFile = useRef<File | null>(null);
  const pollToken = useRef(0);
  const announced = useRef<Set<string>>(new Set());
  const [fileName, setFileName] = useState<string | null>(initialFileName ?? null);
  const [state, setState] = useState<ResumeProcessingState>(initialFileName ? "COMPLETED" : "IDLE");
  const [stage, setStage] = useState("");
  const [error, setError] = useState<{ message: string; code: string | null } | null>(null);
  const [candidates, setCandidates] = useState<ResumeCandidate[]>([]);
  const [reviewSaved, setReviewSaved] = useState(Boolean(initialFileName));
  const [documentId, setDocumentId] = useState<string | null>(initialDocumentId ?? null);
  const [retryDocumentId, setRetryDocumentId] = useState<string | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [extra, setExtra] = useState<ResumeExtraData>({});
  // null = checking, true = upload service available, false = unavailable.
  const [serviceReady, setServiceReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ ready?: boolean }>("/api/resume/preflight", { cache: "no-store" }).then((r) => {
      if (!cancelled) setServiceReady(r.ok ? Boolean(r.data?.ready) : false);
    });
    const token = pollToken;
    return () => { cancelled = true; token.current++; };
  }, []);

  const busy = state === "UPLOADING" || state === "QUEUED" || state === "PROCESSING" || state === "SAVING";

  const fail = useCallback((message: string, code: string | null, retryable: string | null) => {
    setError({ message, code });
    setRetryDocumentId(retryable);
    setState("FAILED");
    onSpeak?.("I couldn't finish reading this file. You can retry, or continue without it.", "REASSURING");
  }, [onSpeak]);

  const applyResult = useCallback((docId: string, name: string, result: Record<string, any>, reviewed: boolean) => {
    const rows: ResumeCandidate[] = Array.isArray(result.reviewCandidates)
      ? result.reviewCandidates.flatMap((item: Record<string, unknown>) => {
          const { category, candidateId, value, sourceSpan, field } = item ?? {};
          if (
            !["profile", "link", "education", "experience", "project", "skill", "certification", "achievement"].includes(String(category)) ||
            typeof candidateId !== "string" || typeof value !== "string" || typeof sourceSpan !== "string"
          ) return [];
          return [{ id: candidateId, candidateId, category: category as ResumeCandidate["category"], value, sourceSpan, documentId: docId, corrected: false, selected: false, field: typeof field === "string" ? field : undefined }];
        })
      : [];
    const structured = result.structured ?? {};
    setFileName(name);
    setDocumentId(docId);
    setRetryDocumentId(null);
    setError(null);
    setCandidates(rows);
    setReviewSaved(reviewed);
    setState(reviewed ? "COMPLETED" : "REVIEW_REQUIRED");
    setExtra({
      extractedProfile: result.extractedProfile ?? undefined,
      discoveredProfiles: result.discoveredProfiles ?? undefined,
      extractedProjects: Array.isArray(structured.projects) ? structured.projects : [],
      extractedEducation: Array.isArray(structured.education) ? structured.education : [],
      extractedExperience: Array.isArray(structured.experience) ? structured.experience : [],
      extractedAchievements: Array.isArray(structured.achievements) ? structured.achievements : [],
    });
    if (reviewed) return;
    void requestJson<{ eoraGuidance?: { primaryMessage?: string; mood?: string } }>(`/api/resume/${docId}`).then((r) => {
      const msg = r.ok ? r.data?.eoraGuidance?.primaryMessage : undefined;
      if (msg) { setAdvice(msg); onSpeak?.(msg, r.ok ? r.data?.eoraGuidance?.mood : undefined); }
    });
    if (!announced.current.has(docId)) {
      announced.current.add(docId);
      onExtractionReady?.();
    }
  }, [onExtractionReady, onSpeak]);

  const poll = useCallback(async (docId: string, jobId: string, name: string) => {
    const token = ++pollToken.current;
    const deadline = Date.now() + POLL_DEADLINE_MS;
    setState("QUEUED");
    setStage(STAGE_LABELS.acquire);
    while (token === pollToken.current) {
      const res = await requestJson<JobStatus>(`/api/resume/${docId}/status?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
      if (token !== pollToken.current) return;
      if (!res.ok && res.error.kind === "unauthorized") { fail("Your session ended. Refresh the page and try again.", "UNAUTHORIZED", null); return; }
      const data = res.ok ? res.data : null;
      if (data?.ok) {
        if (data.status === "review_ready" || data.status === "completed") {
          if (data.result) applyResult(docId, data.filename || name, data.result, data.status === "completed");
          else fail("Reading finished but the results couldn't be loaded. Retry to fetch them again.", "RESULT_MISSING", docId);
          return;
        }
        if (["failed", "timed_out", "cancelled", "retry"].includes(data.status)) {
          fail(data.message || "We couldn't read this file. Retry, choose another file, or continue without a CV.", data.errorCode ?? null, data.retryable ? docId : null);
          return;
        }
        setState(data.status === "queued" ? "QUEUED" : "PROCESSING");
        setStage(STAGE_LABELS[data.stage || "acquire"] || "Processing");
      }
      // A transient network error keeps polling until the deadline.
      if (Date.now() > deadline) { fail("This is taking much longer than expected. Retry, or continue without a CV and add it later.", "CLIENT_DEADLINE", docId); return; }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }, [applyResult, fail]);

  // After a refresh mid-review, rebuild the review from the stored document.
  useEffect(() => {
    if (!initialDocumentId) return;
    let cancelled = false;
    void requestJson<JobStatus>(`/api/resume/${initialDocumentId}/status`, { cache: "no-store" }).then((r) => {
      if (cancelled || !r.ok || !r.data?.ok) return;
      const data = r.data;
      if ((data.status === "review_ready" || data.status === "completed") && data.result) applyResult(initialDocumentId, data.filename || initialFileName || "CV", data.result, data.status === "completed");
      else if (data.status === "queued" || data.status === "processing") void poll(initialDocumentId, data.jobId, data.filename || initialFileName || "CV");
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rehydrate once for the document restored from the draft
  }, [initialDocumentId]);

  /** Returns a plain-language reason the file can't be used, or null. */
  const checkFile = (file: File, consent: boolean): string | null => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "doc") return "Older .doc files can't be read. Open it in Word or LibreOffice and save it as .docx or PDF.";
    if (ext !== "pdf" && ext !== "docx") return "Choose a PDF or DOCX file.";
    if (file.size > RESUME_MAX_UPLOAD_BYTES) return `Choose a file under ${RESUME_MAX_UPLOAD_MB} MB, or continue without a CV.`;
    if (serviceReady === false) return "CV upload is unavailable right now. Continue without a CV; you can add it later from your profile.";
    if (!consent) return "Tick the consent box first, so we can read your CV.";
    return null;
  };

  const upload = async (file: File | undefined, consent: boolean, aiConsent?: boolean) => {
    if (!file) return;
    selectedFile.current = file;
    const problem = checkFile(file, consent);
    if (problem) { setError({ message: problem, code: null }); return; }
    setError(null);
    setState("UPLOADING");
    onSpeak?.("I'm reading your CV and collecting the details we can use.", "WORKING");
    if (!(await ensureSession())) { fail("We couldn't start a secure session for the upload. Try again in a moment.", "SESSION_UNAVAILABLE", null); return; }
    const form = new FormData();
    form.append("resume", file);
    form.append("consent", consent ? "true" : "false");
    form.append("aiConsent", aiConsent ? "true" : "false");
    const res = await requestJson<{ ok: boolean; jobId?: string; documentId?: string; code?: string }>("/api/resume/extract", { method: "POST", body: form });
    if (!res.ok || !res.data?.jobId || !res.data.documentId) {
      fail(res.ok ? "The upload didn't start. Try again." : describeError(res.error), res.ok ? null : res.error.code ?? null, null);
      return;
    }
    onDocumentStored?.(res.data.documentId, file.name);
    await poll(res.data.documentId, res.data.jobId, file.name);
  };

  /** Retries the stored document on the server; falls back to re-uploading the picked file. */
  const retry = async (consent: boolean, aiConsent?: boolean) => {
    if (!retryDocumentId) { if (selectedFile.current) await upload(selectedFile.current, consent, aiConsent); return; }
    const docId = retryDocumentId;
    setError(null);
    setState("QUEUED");
    const res = await requestJson<{ jobId?: string }>(`/api/resume/${docId}/retry`, { method: "POST" });
    if (!res.ok || !res.data?.jobId) { fail(res.ok ? "The retry didn't start. Try again." : describeError(res.error), res.ok ? null : res.error.code ?? null, docId); return; }
    await poll(docId, res.data.jobId, fileName || selectedFile.current?.name || "CV");
  };

  const setAll = (categories: ResumeCandidate["category"][], selected: boolean) => {
    setReviewSaved(false);
    setCandidates((cur) => cur.map((c) => (categories.includes(c.category) ? { ...c, selected } : c)));
  };
  const toggle = (id: string, selected: boolean) => {
    setReviewSaved(false);
    setCandidates((cur) => cur.map((c) => (c.id === id ? { ...c, selected } : c)));
  };
  const correct = (id: string, value: string) => {
    setReviewSaved(false);
    setCandidates((cur) => cur.map((c) => (c.id === id ? { ...c, value, corrected: true } : c)));
  };

  /**
   * Saves every decision to the CV record (unticked means rejected), then lets
   * the caller fold the accepted data into onboarding. Returns an error
   * message, or null on success.
   */
  const saveReview = async (applyToOnboarding: (fileName: string, claims: ReviewedResumeClaim[], extra: ResumeExtraData) => Promise<boolean>): Promise<string | null> => {
    const accepted = candidates.filter((c) => c.selected && c.value.trim());
    const records = candidates.filter((c) => RECORD_CANDIDATE_ID.test(c.candidateId || c.id) && c.category !== "profile" && c.category !== "link");
    if (accepted.length === 0) return "Tick at least one detail that is right, or continue without saving the CV review.";
    if (!documentId) return "This review is no longer linked to an uploaded file. Upload the file again.";
    const claims = accepted.filter((c) => records.includes(c)).map(({ candidateId, category, value, sourceSpan, documentId: d, corrected }) => ({
      candidateId, category: category as ReviewedResumeClaim["category"], value: value.trim(), sourceSpan, documentId: d, corrected,
    }));
    const acceptedProfile: AcceptedResumeProfile = {};
    const acceptedLinks: Partial<Record<string, string>> = {};
    const acceptedPortfolioUrls: string[] = [];
    for (const c of accepted) {
      if (c.category === "profile" && c.field) acceptedProfile[c.field as keyof AcceptedResumeProfile] = c.value.trim();
      if (c.category === "link" && c.field) {
        if (!acceptedLinks[c.field]) acceptedLinks[c.field] = c.value.trim();
        if (c.field === "portfolio") acceptedPortfolioUrls.push(c.value.trim());
      }
    }
    const reviewSummary = Object.fromEntries(REVIEW_GROUPS.map((g) => {
      const rows = candidates.filter((c) => g.categories.includes(c.category));
      return [g.id, { total: rows.length, accepted: rows.filter((c) => accepted.includes(c)).length }];
    }));
    setState("SAVING");
    setError(null);
    const decisions = records.map((c) => ({
      candidateId: c.candidateId || c.id,
      state: c.selected && c.value.trim() ? "confirmed" : "rejected",
      ...(c.corrected && c.selected ? { correctedValue: c.value.trim() } : {}),
    }));
    const res = await requestJson<{ ok?: boolean }>(`/api/resume/${documentId}/apply`, { method: "POST", json: { decisions } });
    if (!res.ok || !res.data?.ok) {
      setState("REVIEW_REQUIRED");
      return res.ok ? "Your review couldn't be saved. Try again." : describeError(res.error);
    }
    const saved = await applyToOnboarding(fileName || "CV", claims, { ...extra, acceptedProfile, acceptedLinks, acceptedPortfolioUrls, reviewSummary });
    if (!saved) {
      setState("REVIEW_REQUIRED");
      return "Your review was saved to your profile, but your onboarding progress couldn't be updated. Try again.";
    }
    setReviewSaved(true);
    setState("COMPLETED");
    onSpeak?.("Everything is saved. Next, your accounts.", "HAPPY");
    return null;
  };

  const remove = async (): Promise<string | null> => {
    if (!documentId) return null;
    const res = await requestJson(`/api/resume/${documentId}`, { method: "DELETE" });
    if (!res.ok) return describeError(res.error);
    setFileName(null);
    setCandidates([]);
    setDocumentId(null);
    setReviewSaved(false);
    setState("IDLE");
    return null;
  };

  return {
    fileName, state, stage, error, setError, candidates, reviewSaved, documentId, retryDocumentId, advice, extra, serviceReady, busy,
    hasSelectedFile: () => Boolean(selectedFile.current),
    upload, retry, setAll, toggle, correct, saveReview, remove,
  };
}
