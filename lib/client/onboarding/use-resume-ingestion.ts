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
import { RESUME_ACCEPTED_EXTENSIONS, RESUME_ACCEPTED_LABEL, RESUME_MAX_UPLOAD_BYTES, RESUME_MAX_UPLOAD_MB } from "@/lib/config/upload-limits";
import {
  acceptedProfileFrom, addRecord, addSingle, buildWorkspace, githubProfileFrom, isChanged, isUserItem, recordFromValues,
  removeItem, restoreItem, saveProblems, serializeWorkspace, setCurrentEducation, setSectionSelected, setSelected, setValue, summarize, SECTIONS,
  type CandidateLike, type Problem, type RecordType, type SectionId, type Workspace, type WsItem,
} from "@/lib/resume/review-workspace";
import { PROFILE_SOURCE_IDS, type ReviewedResumeClaim } from "./types";

export type ResumeProcessingState = "IDLE" | "UPLOADING" | "QUEUED" | "PROCESSING" | "REVIEW_REQUIRED" | "SAVING" | "COMPLETED" | "FAILED";

export type ResumeCandidate = Omit<ReviewedResumeClaim, "category"> & {
  id: string;
  selected: boolean;
  previousDecision?: string;
  /** The decision saved for this document, restored after a reload. */
  savedDecision?: "confirmed" | "rejected";
  category: ReviewedResumeClaim["category"] | "achievement" | "profile" | "link" | "publication";
  field?: string;
};

const UNSAFE_FOR_BULK = new Set(["invalid", "unreadable", "conflicting"]);
export function isBulkSelectable(c: { recordData?: Record<string, any> }): boolean {
  return !UNSAFE_FOR_BULK.has(String(c.recordData?.review?.status ?? ""));
}

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
  /** The records the student confirmed in the review workspace, with their edits and additions (replaces index lookups). */
  reviewedRecords?: {
    education: NonNullable<ResumeExtraData["extractedEducation"]>;
    experience: NonNullable<ResumeExtraData["extractedExperience"]>;
    achievements: NonNullable<ResumeExtraData["extractedAchievements"]>;
    projects: NonNullable<ResumeExtraData["extractedProjects"]>;
    /** Every confirmed skill name, edited or added ones included. */
    skills?: string[];
  };
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


/** Review sections, structured per record category for all 16 CV categories. */
/** Personal-detail fields shown in each personal group (category "profile"). */
const IDENTITY_FIELDS = ["fullName", "pronouns", "dateOfBirth", "nationality"];
const CONTACT_FIELDS = ["email", "alternateEmail", "mobile", "alternatePhone"];
const LOCATION_FIELDS = ["location", "address"];
const PROFILE_FIELDS = ["headline", "currentRole", "currentEmployer", "experienceDuration", "workAuthorization", "drivingLicence", "institution", "degree", "specialization", "expectedGraduationYear"];

export const REVIEW_GROUPS: Array<{ id: string; title: string; categories: ResumeCandidate["category"][]; fields?: string[] }> = [
  { id: "identity", title: "Identity", categories: ["profile"], fields: IDENTITY_FIELDS },
  { id: "contact", title: "Contact", categories: ["profile"], fields: CONTACT_FIELDS },
  { id: "location", title: "Location", categories: ["profile"], fields: LOCATION_FIELDS },
  { id: "profiles", title: "Professional profile and links", categories: ["profile", "link", "digitalFootprint"], fields: PROFILE_FIELDS },
  { id: "summary", title: "Professional summary", categories: ["summary"] },
  { id: "education", title: "Education", categories: ["education"] },
  { id: "skills", title: "Skills and technologies", categories: ["skill"] },
  { id: "experience", title: "Work experience and internships", categories: ["experience"] },
  { id: "leadership", title: "Leadership and positions", categories: ["leadership"] },
  { id: "projects", title: "Projects", categories: ["project"] },
  { id: "certifications", title: "Certifications", categories: ["certification"] },
  { id: "achievements", title: "Achievements and awards", categories: ["achievement"] },
  { id: "research", title: "Research and intellectual property", categories: ["research", "publication"] },
  { id: "hackathons", title: "Hackathons and competitions", categories: ["hackathon"] },
  { id: "training", title: "Training, courses and workshops", categories: ["training"] },
  { id: "volunteering", title: "Volunteering and community", categories: ["volunteering"] },
  { id: "languages", title: "Languages", categories: ["language"] },
  { id: "additional", title: "Additional information", categories: ["additional"] },
];

/** Whether a candidate belongs in a review group (personal fields are split across four groups). */
export function inGroup(c: { category: string; field?: string }, group: { categories: string[]; fields?: string[] }): boolean {
  if (!group.categories.includes(c.category)) return false;
  return c.category !== "profile" || !group.fields || group.fields.includes(c.field ?? "");
}

export const FIELD_LABELS: Record<string, string> = {
  fullName: "Full name", email: "Email", mobile: "Phone number", location: "Location",
  pronouns: "Pronouns", dateOfBirth: "Date of birth", nationality: "Nationality",
  alternateEmail: "Alternate email", alternatePhone: "Alternate phone", address: "Address",
  headline: "Headline", currentRole: "Current designation", currentEmployer: "Current employer",
  experienceDuration: "Total experience", workAuthorization: "Work authorisation", drivingLicence: "Driving licence",
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
  const [workspace, setWorkspace] = useState<Workspace>({ items: [], currentEducationId: null });
  /** Problems found when the student last tried to save; cleared as they edit. */
  const [problems, setProblems] = useState<Problem[]>([]);
  const [dirty, setDirty] = useState(false);
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
          const { category, candidateId, value, sourceSpan, field, recordData, previousDecision, previousValue, decision, decidedValue } = item ?? {};
          if (
            ![
              "profile", "link", "education", "experience", "project", "skill",
              "certification", "achievement", "publication", "leadership",
              "summary", "research", "hackathon", "training", "volunteering",
              "language", "digitalFootprint", "additional"
            ].includes(String(category)) ||
            typeof candidateId !== "string" || typeof value !== "string" || typeof sourceSpan !== "string"
          ) return [];
          // The student's saved decision on this document wins; otherwise a
          // decision from an earlier upload of the same file is pre-applied.
          const saved = decision === "confirmed" || decision === "rejected";
          const earlier = saved ? decision === "confirmed" : previousDecision === "confirmed";
          const keptValue = saved ? decidedValue : previousValue;
          const earlierValue = earlier && typeof keptValue === "string" && keptValue.trim() ? keptValue : null;
          return [{
            id: candidateId,
            candidateId,
            category: category as ResumeCandidate["category"],
            value: earlierValue ?? value,
            sourceSpan,
            documentId: docId,
            corrected: Boolean(earlierValue && earlierValue !== value),
            selected: earlier,
            previousDecision: typeof previousDecision === "string" ? previousDecision : undefined,
            savedDecision: saved ? (decision as "confirmed" | "rejected") : undefined,
            field: typeof field === "string" ? field : undefined,
            recordData: (recordData as Record<string, any>) || undefined,
          }];
        })
      : [];
    const structured = result.structured ?? {};
    setFileName(name);
    setDocumentId(docId);
    setRetryDocumentId(null);
    setError(null);
    setCandidates(rows);
    setWorkspace(buildWorkspace(
      (Array.isArray(result.reviewCandidates) ? result.reviewCandidates : []).filter((c: Record<string, unknown>) => c && typeof c.candidateId === "string" && typeof c.value === "string") as CandidateLike[],
    ));
    setProblems([]);
    setDirty(false);
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
    if (!(RESUME_ACCEPTED_EXTENSIONS as readonly string[]).includes(ext || "")) return `Choose a ${RESUME_ACCEPTED_LABEL} file.`;
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
    const res = await requestJson<{ jobId?: string }>(`/api/resume/${docId}/retry`, {
      method: "POST",
      json: { aiConsent: Boolean(aiConsent) },
    });
    if (!res.ok || !res.data?.jobId) { fail(res.ok ? "The retry didn't start. Try again." : describeError(res.error), res.ok ? null : res.error.code ?? null, docId); return; }
    await poll(docId, res.data.jobId, fileName || selectedFile.current?.name || "CV");
  };

  /** "Select all" never ticks a record the extractor marked as needing a fix; those are ticked one by one. */
  const setAll = (categories: ResumeCandidate["category"][], selected: boolean) => {
    setReviewSaved(false);
    setCandidates((cur) => cur.map((c) => (categories.includes(c.category) && (!selected || isBulkSelectable(c)) ? { ...c, selected } : c)));
  };
  const toggle = (id: string, selected: boolean) => {
    setReviewSaved(false);
    setCandidates((cur) => cur.map((c) => (c.id === id ? { ...c, selected } : c)));
  };
  const correct = (id: string, value: string) => {
    setReviewSaved(false);
    setCandidates((cur) => cur.map((c) => (c.id === id ? { ...c, value, corrected: true } : c)));
  };

  const edit = (fn: (ws: Workspace) => Workspace) => {
    setReviewSaved(false);
    setDirty(true);
    setWorkspace((ws) => {
      const next = fn(ws);
      // Re-check only what was flagged, so a fixed field stops showing its error.
      setProblems((cur) => (cur.length ? saveProblems(next) : cur));
      return next;
    });
  };
  const ws = {
    setValue: (id: string, key: string, value: string) => edit((w) => setValue(w, id, key, value)),
    setSelected: (id: string, selected: boolean) => edit((w) => setSelected(w, id, selected)),
    setSection: (section: SectionId, selected: boolean) => edit((w) => setSectionSelected(w, section, selected)),
    add: (type: RecordType) => edit((w) => addRecord(w, type).ws),
    addSingle: (field: string) => edit((w) => addSingle(w, field).ws),
    remove: (id: string) => edit((w) => removeItem(w, id)),
    restore: (id: string) => edit((w) => restoreItem(w, id)),
    setCurrentEducation: (id: string) => edit((w) => setCurrentEducation(w, id)),
  };

  /**
   * Saves every decision to the CV record (unticked means rejected), then lets
   * the caller fold the accepted data into onboarding. Returns an error
   * message, or null on success.
   */
  const saveReview = async (applyToOnboarding: (fileName: string, claims: ReviewedResumeClaim[], extra: ResumeExtraData) => Promise<boolean>): Promise<string | null> => {
    if (!documentId) return "This review is no longer linked to an uploaded file. Upload the file again.";
    // Required fields are checked here, when saving, never while the student is reading the review.
    const found = saveProblems(workspace);
    setProblems(found);
    if (found.length) {
      const n = found.length;
      return `${n} ${n === 1 ? "field needs" : "fields need"} your attention before saving: ${[...new Set(found.map((p) => p.label))].slice(0, 4).join(", ")}${n > 4 ? "…" : ""}.`;
    }
    const payload = serializeWorkspace(workspace);
    setState("SAVING");
    setError(null);
    const res = await requestJson<{ ok?: boolean; code?: string }>(`/api/resume/${documentId}/apply`, { method: "POST", json: payload });
    if (!res.ok || !res.data?.ok) {
      setState("REVIEW_REQUIRED");
      // The server checks the same required fields; show its findings on the fields.
      const server = !res.ok ? (res.data as { problems?: Problem[] } | null)?.problems : undefined;
      if (!res.ok && res.error.code === "MANDATORY_FIELDS_MISSING" && Array.isArray(server)) {
        setProblems(server);
        return `Some required details are missing or not valid: ${[...new Set(server.map((p) => p.label))].slice(0, 4).join(", ")}.`;
      }
      return res.ok ? "Your review couldn't be saved. Try again." : describeError(res.error);
    }
    const kept = workspace.items.filter((i) => i.selected && !i.removed && Object.values(i.values).some((v) => v.trim()));
    const toOnboarding = workspaceToOnboarding(kept, workspace, documentId);
    const reviewSummary = Object.fromEntries(SECTIONS.map((s) => {
      const rows = workspace.items.filter((i) => i.section === s.id && !i.removed && i.source !== "none");
      return [s.id, { total: rows.length, accepted: rows.filter((i) => kept.includes(i)).length }];
    }));
    const saved = await applyToOnboarding(fileName || "CV", toOnboarding.claims, { ...extra, ...toOnboarding.extra, reviewSummary });
    if (!saved) {
      setState("REVIEW_REQUIRED");
      return "Your review was saved to your profile, but your onboarding progress couldn't be updated. Try again.";
    }
    // What was just saved is now the baseline for a later edit.
    setWorkspace((cur) => ({
      ...cur,
      items: cur.items.filter((i) => !(i.removed && isUserItem(i))).map((i) => ({
        ...i,
        saved: kept.includes(i) ? "confirmed" : i.source === "none" && !Object.values(i.values).some((v) => v.trim()) ? undefined : "rejected",
      })),
    }));
    setDirty(false);
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
    fileName, state, stage, error, setError, candidates, workspace, problems, dirty, ws, reviewSaved, documentId, retryDocumentId, advice, extra, serviceReady, busy,
    hasSelectedFile: () => Boolean(selectedFile.current),
    upload, retry, setAll, toggle, correct, saveReview, remove,
  };
}

/** Categories kept in the server's extraction snapshot: only these are CV claims (lib/services/resume-review-service.ts). */
const SNAPSHOT_CATEGORIES = new Set(["education", "experience", "project", "skill", "certification", "publication", "achievement", "leadership", "summary", "research", "hackathon", "training", "volunteering", "language", "digitalFootprint", "additional"]);
const PLATFORM_IDS: Record<string, string> = { github: "github", linkedin: "linkedin", leetcode: "leetcode", hackerrank: "hackerrank", kaggle: "kaggle", portfolio: "portfolio", website: "portfolio" };

/**
 * What onboarding takes from the saved workspace. A CV claim is something read
 * from the CV: it carries the suggestion's exact category and source text (the
 * server checks both against the extraction snapshot) and its original value
 * unless the student edited it. What the student added is not a CV claim; it
 * reaches onboarding through reviewedRecords only.
 */
export function workspaceToOnboarding(kept: WsItem[], ws: Workspace, documentId: string): { claims: ReviewedResumeClaim[]; extra: ResumeExtraData } {
  const claims: ReviewedResumeClaim[] = [];
  const reviewed: NonNullable<ResumeExtraData["reviewedRecords"]> = { education: [], experience: [], achievements: [], projects: [], skills: [] };
  const acceptedLinks: Partial<Record<string, string>> = {};
  const acceptedPortfolioUrls: string[] = [];
  const claim = (i: WsItem, value: string) => {
    const ex = i.extracted;
    if (isUserItem(i) || !ex || !SNAPSHOT_CATEGORIES.has(ex.category)) return;
    const edited = isChanged(i);
    claims.push({ candidateId: i.linkedCandidateId ?? i.id, category: ex.category as ReviewedResumeClaim["category"], value: edited ? value : ex.value, sourceSpan: ex.sourceSpan, documentId, corrected: edited, recordData: i.recordData });
  };
  for (const i of kept) {
    if (i.kind === "single") {
      if (i.field === "githubUrl" && githubProfileFrom(i.values.value)) acceptedLinks.github = i.values.value.trim();
      if (i.field === "summary") claim(i, i.values.value.trim());
      continue;
    }
    claim(i, summarize(i.kind, i.values));
    const span = i.extracted?.sourceSpan ?? "";
    const rec = recordFromValues(i.kind, i.values, (i.recordData ?? {}) as Record<string, unknown>) as Record<string, any>;
    if (i.kind === "skill" && i.values.name?.trim()) reviewed.skills!.push(i.values.name.trim());
    if (i.kind === "education") reviewed.education.push(rec as never);
    if (i.kind === "experience") reviewed.experience.push({ ...rec, sourceSpan: span } as never);
    if (i.kind === "project") reviewed.projects.push({ ...rec, sourceSpan: span } as never);
    if (i.kind === "achievement" || i.kind === "publication") reviewed.achievements.push({ ...rec, category: rec.category ?? (i.kind === "publication" ? "publication" : "award"), sourceSpan: span } as never);
    if (i.kind === "link") {
      const id = PLATFORM_IDS[(i.values.platform ?? "").toLowerCase()];
      const url = i.values.url?.trim();
      if (id && url && PROFILE_SOURCE_IDS.includes(id) && !acceptedLinks[id]) acceptedLinks[id] = url;
      if (id === "portfolio" && url) acceptedPortfolioUrls.push(url);
    }
  }
  return { claims, extra: { acceptedProfile: acceptedProfileFrom(ws) as AcceptedResumeProfile, acceptedLinks, acceptedPortfolioUrls, reviewedRecords: reviewed } };
}
