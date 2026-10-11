import React, { useRef, useState, useEffect } from "react";
import { FileText, CheckCircle2, FileUp, Sparkles, AlertCircle, ShieldCheck, Layers, BookOpen, Loader2, Hourglass } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";
import { ProcessingActivity } from "./ProcessingActivity";
import { useEoraSafe } from "@/components/eora/eora-provider";
import { parseSafeJsonResponse } from "@/lib/api/safe-api-response";

export type ResumeProcessingState =
  | "IDLE"
  | "UPLOADING"
  | "PARSING"
  | "EXTRACTING"
  | "REVIEW_REQUIRED"
  | "SAVING"
  | "COMPLETED"
  | "FAILED";

export type ReviewedResumeClaim = {
  candidateId?: string;
  category: "education" | "experience" | "project" | "skill" | "certification";
  value: string;
  sourceSpan: string;
  documentId: string;
  corrected: boolean;
};

export type ExtractedProfileData = {
  fullName?: string;
  email?: string;
  mobile?: string;
  degree?: string;
  specialization?: string;
  institution?: string;
  currentYear?: string;
  expectedGraduationYear?: number;
  gpa?: string;
};

type ResumeCandidate = ReviewedResumeClaim & { id: string; selected: boolean };

interface Screen5ResumeUploadProps {
  initialFileName?: string | null;
  stepNumber?: number;
  totalSteps?: number;
  onExtractSuccess?: (
    fileName: string,
    claims: ReviewedResumeClaim[],
    extraData?: {
      extractedProfile?: ExtractedProfileData;
      discoveredProfiles?: Partial<Record<string, string>>;
      extractedProjects?: Array<{ title: string; description: string; technologies: string[]; repositoryUrl?: string; sourceSpan: string }>;
      extractedEducation?: Array<{
        institution: string;
        degree: string;
        fieldOfStudy?: string;
        graduationYear?: string;
        startDate?: string;
        endDate?: string;
        gpa?: string;
        percentage?: string;
        academicLevel?: "undergraduate" | "postgraduate" | "high_school" | "diploma" | "doctorate";
      }>;
      extractedExperience?: Array<{
        company: string;
        role: string;
        type?: "employment" | "internship" | "freelance" | "founder" | "leadership" | "volunteering" | "other";
        duration?: string;
        startDate?: string;
        endDate?: string;
        highlights?: string[];
        technologies?: string[];
        sourceSpan: string;
      }>;
      extractedAchievements?: Array<{
        title: string;
        category?: string;
        subType?: "patent_application" | "patent_granted" | "published_paper" | "manuscript" | "book" | "book_coauthor" | "hackathon" | "honor" | "other";
        issuer?: string;
        date?: string;
        description?: string;
        sourceSpan: string;
      }>;
    }
  ) => Promise<boolean> | boolean;
  onNext: () => void;
  onSkip?: () => void;
  onExtractionReady?: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

export function Screen5ResumeUpload({
  initialFileName,
  stepNumber = 4,
  totalSteps = 10,
  onExtractSuccess,
  onNext,
  onSkip,
  onExtractionReady,
  onBack,
  onJumpToStep,
}: Screen5ResumeUploadProps) {
  const eora = useEoraSafe();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const completedDocumentsRef = useRef<Set<string>>(new Set());
  const [fileName, setFileName] = useState<string | null>(initialFileName || null);
  const [isUploaded, setIsUploaded] = useState<boolean>(Boolean(initialFileName));
  const [processingState, setProcessingState] = useState<ResumeProcessingState>(
    initialFileName ? "COMPLETED" : "IDLE"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [candidates, setCandidates] = useState<ResumeCandidate[]>([]);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [extraData, setExtraData] = useState<{
    extractedProfile?: ExtractedProfileData;
    discoveredProfiles?: Partial<Record<string, string>>;
    extractedProjects?: Array<{ title: string; description: string; technologies: string[]; repositoryUrl?: string; sourceSpan: string }>;
    extractedEducation?: Array<{
      institution: string;
      degree: string;
      fieldOfStudy?: string;
      graduationYear?: string;
      startDate?: string;
      endDate?: string;
      gpa?: string;
      percentage?: string;
      academicLevel?: "undergraduate" | "postgraduate" | "high_school" | "diploma" | "doctorate";
    }>;
    extractedExperience?: Array<{
      company: string;
      role: string;
      type?: "employment" | "internship" | "freelance" | "founder" | "leadership" | "volunteering" | "other";
      duration?: string;
      startDate?: string;
      endDate?: string;
      highlights?: string[];
      technologies?: string[];
      sourceSpan: string;
    }>;
    extractedAchievements?: Array<{
      title: string;
      category?: string;
      subType?: "patent_application" | "patent_granted" | "published_paper" | "manuscript" | "book" | "book_coauthor" | "hackathon" | "honor" | "other";
      issuer?: string;
      date?: string;
      description?: string;
      sourceSpan: string;
    }>;
  }>({});
  // null = probing, true = gate open, false = gate closed
  const [ingestionReady, setIngestionReady] = useState<boolean | null>(null);

  // Probe server gate status once on mount so UI reflects reality before any interaction
  useEffect(() => {
    let cancelled = false;
    fetch("/api/resume/preflight", { method: "GET", credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setIngestionReady(Boolean(data?.ready)); })
      .catch(() => { if (!cancelled) setIngestionReady(false); });
    return () => {
      cancelled = true;
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const isBusy =
    processingState === "UPLOADING" ||
    processingState === "PARSING" ||
    processingState === "EXTRACTING" ||
    processingState === "SAVING";

  // Upload is possible only when gate is confirmed open
  const uploadBlocked = ingestionReady === false;

  const notifyJobFailed = async (jobId: string, status: "failed" | "timed_out", message: string) => {
    try {
      await fetch("/api/student/processing-jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, status, errorMessage: message }),
      });
    } catch {
      // Safe non-blocking notification
    }
  };

  const processFile = async (file?: File) => {
    if (!file) return;
    selectedFileRef.current = file;

    const extension = file.name.toLowerCase().split(".").pop();
    if (extension === "doc") {
      setErrorMessage("Legacy .doc files are not supported. Open the file in Word or LibreOffice and save it as .docx or PDF.");
      return;
    }
    if (extension !== "pdf" && extension !== "docx") {
      setErrorMessage("Choose a PDF or DOCX resume.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Choose a file under 5 MB, or enter details manually.");
      return;
    }

    if (uploadBlocked) {
      setErrorMessage("Resume upload is temporarily unavailable. Use \"Skip for now\" to enter your details manually.");
      return;
    }
    if (!aiConsent) {
      setErrorMessage("Please consent to resume processing before upload.");
      return;
    }

    setErrorMessage(null);
    setProcessingState("UPLOADING");
    setFileName(null);
    setIsUploaded(false);
    setReviewSaved(false);
    setCandidates([]);
    setExtraData({});

    // Signal EORA extraction started (exact required copy)
    eora?.speak(
      "I'm reading your resume and collecting the details we can use.",
      "WORKING"
    );

    // Setup 45-second bounded client timeout to eliminate indefinite waiting
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const timeoutTimer = setTimeout(() => {
      abortController.abort("CLIENT_TIMEOUT");
    }, 45000);

    let currentJobId: string | null = null;

    try {
      // 1. Create or verify tracking job
      const jobResponse = await fetch("/api/student/processing-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: "resume" }),
        signal: abortController.signal,
      });

      const safeJob = await parseSafeJsonResponse<{ ok: boolean; jobId?: string; error?: string }>(
        jobResponse,
        "Could not start resume import."
      );

      if (!safeJob.ok || !safeJob.data?.jobId) {
        throw new Error(safeJob.error?.message || "Could not start resume import.");
      }
      currentJobId = safeJob.data.jobId;
      setActiveJobId(currentJobId);
      setProcessingState("PARSING");

      // 2. Perform zero-LLM structured extraction
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("aiConsent", "true");
      formData.append("jobId", currentJobId);

      setProcessingState("EXTRACTING");
      const res = await fetch("/api/resume/extract", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      clearTimeout(timeoutTimer);

      const safeExtract = await parseSafeJsonResponse<any>(
        res,
        "Could not read this file. Please try again or enter details manually."
      );

      if (!safeExtract.ok || !safeExtract.data) {
        const errorMsg = safeExtract.error?.message || "Could not read this file. Please enter details manually.";
        if (currentJobId) {
          void notifyJobFailed(currentJobId, "failed", errorMsg);
        }
        setErrorMessage(errorMsg);
        setProcessingState("FAILED");
        eora?.speak(
          "I couldn't finish reading this file. You can retry or continue manually.",
          "REASSURING"
        );
        return;
      }

      const data = safeExtract.data;
      const documentId = String(data.documentId || "");
      const rows: ResumeCandidate[] = Array.isArray(data.reviewCandidates)
        ? data.reviewCandidates.flatMap((raw: unknown) => {
            if (!raw || typeof raw !== "object") return [];
            const item = raw as Record<string, unknown>;
            const category = item.category;
            const candidateId = item.candidateId;
            const value = item.value;
            const sourceSpan = item.sourceSpan;
            if (
              !documentId ||
              !["education", "experience", "project", "skill", "certification", "achievement"].includes(String(category)) ||
              typeof candidateId !== "string" ||
              typeof value !== "string" ||
              typeof sourceSpan !== "string"
            )
              return [];
            return [
              {
                id: candidateId,
                candidateId,
                category: category as ReviewedResumeClaim["category"],
                value,
                sourceSpan,
                documentId,
                corrected: false,
                selected: false,
              },
            ];
          })
        : [];

      if (data.extractionMeta?.success !== true || rows.length === 0) {
        const err = "No reviewable claims were returned. Please retry or enter details manually.";
        if (currentJobId) void notifyJobFailed(currentJobId, "failed", err);
        setErrorMessage(err);
        setProcessingState("FAILED");
        eora?.speak(
          "I couldn't finish reading this file. You can retry or continue manually.",
          "REASSURING"
        );
        return;
      }

      setFileName(file.name);
      setIsUploaded(true);
      setProcessingState("REVIEW_REQUIRED");
      setReviewSaved(false);
      setExtraData({
        extractedProfile: data.extractedProfile,
        discoveredProfiles: data.discoveredProfiles,
        extractedProjects: Array.isArray(data.structured?.projects) ? data.structured.projects : [],
        extractedEducation: Array.isArray(data.structured?.education) ? data.structured.education : [],
        extractedExperience: Array.isArray(data.structured?.experience) ? data.structured.experience : [],
        extractedAchievements: Array.isArray(data.structured?.achievements) ? data.structured.achievements : [],
      });
      setCandidates(rows);

      // Contextual EORA event guidance based on completeness
      const hasAcademic = Boolean(data.extractedProfile?.degree && data.extractedProfile?.institution);
      if (hasAcademic) {
        eora?.speak(
          "I found some information! Let's review it together.",
          "HAPPY"
        );
      } else {
        eora?.speak(
          "I found some details, but we still need a little more information.",
          "EXPLAINING"
        );
      }

      if (!completedDocumentsRef.current.has(documentId)) {
        completedDocumentsRef.current.add(documentId);
        onExtractionReady?.();
      }
    } catch (err) {
      clearTimeout(timeoutTimer);
      const isTimeout =
        (err instanceof Error && (err.name === "AbortError" || err.message === "CLIENT_TIMEOUT")) ||
        abortController.signal.aborted;

      const userMessage = isTimeout
        ? "Resume extraction took longer than 45 seconds. You can retry or enter your details manually."
        : err instanceof Error
        ? err.message
        : "Network error during resume extraction. You can continue manually.";

      if (currentJobId) {
        void notifyJobFailed(currentJobId, isTimeout ? "timed_out" : "failed", userMessage);
      }

      setErrorMessage(userMessage);
      setProcessingState("FAILED");
      eora?.speak(
        "I couldn't finish reading this file. You can retry or continue manually.",
        "REASSURING"
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void processFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const advance = () => {
    if (isBusy) return;
    // If extraction failed or file unreadable, advance explicitly takes manual route
    if (processingState === "FAILED" || !isUploaded) {
      handleSkip();
      return;
    }
    // If ingestion is blocked and nothing was previously uploaded, force manual route via Skip
    if (uploadBlocked && !isUploaded) {
      handleSkip();
      return;
    }
    if (candidates.length > 0 && !reviewSaved) {
      setErrorMessage("Save your reviewed CV suggestions before continuing, or choose Skip for now.");
      return;
    }
    onNext();
  };

  const handleSkip = () => {
    if (isBusy) return;
    if (onSkip) {
      onSkip();
    } else {
      onNext();
    }
  };

  const saveReviewedClaims = async () => {
    const selected = candidates
      .filter((candidate) => candidate.selected && candidate.value.trim())
      .map(({ candidateId, category, value, sourceSpan, documentId, corrected }) => ({
        candidateId,
        category,
        value: value.trim(),
        sourceSpan,
        documentId,
        corrected,
      }));

    if (selected.length === 0) {
      setErrorMessage("Select at least one accurate CV detail to save, or use Skip for now.");
      return;
    }

    setProcessingState("SAVING");
    try {
      const saved = await onExtractSuccess?.(fileName || "resume", selected, extraData);
      if (saved === false) throw new Error("Review save failed");
      setReviewSaved(true);
      setProcessingState("COMPLETED");
      setErrorMessage(null);
      eora?.speak(
        "Everything is saved. Let's continue to your digital profiles.",
        "HAPPY"
      );
    } catch {
      setReviewSaved(false);
      setProcessingState("REVIEW_REQUIRED");
      setErrorMessage("We could not save your review. Please retry before continuing.");
    }
  };



  return (
    <div
      className="exact-screen-wrapper"
      style={{
        background: "radial-gradient(ellipse at 80% 20%, rgba(2, 197, 245, 0.08) 0%, rgba(89, 66, 220, 0.05) 40%, #F9F8F5 75%)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          right: "10%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2, 197, 245, 0.1) 0%, rgba(69, 100, 255, 0.04) 50%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "10%",
          width: "550px",
          height: "550px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(147, 53, 232, 0.08) 0%, rgba(89, 66, 220, 0.03) 50%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      <ScreenHeader
        onBack={onBack}
        showBack={true}
        rightLabel={`Step ${stepNumber} of ${totalSteps}`}
      />

      <main
        className="screen-body"
        data-eora-id="eora-resume-upload"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 1260,
          margin: "0 auto",
          width: "100%",
          padding: "24px 36px 36px",
        }}
      >
        {/* Centered Heading */}
        <div style={{ textAlign: "center", marginBottom: 32, marginTop: 4 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: "#5642EF",
              background: "rgba(86, 66, 239, 0.08)",
              border: "1px solid rgba(86, 66, 239, 0.2)",
              padding: "4px 14px",
              borderRadius: 9999,
              marginBottom: 10,
            }}
          >
            <Sparkles size={13} color="#02C5F5" />
            <span>Step {stepNumber} · Document &amp; Experience Ingestion</span>
          </span>
          <h1 style={{ fontSize: "clamp(28px, 3.2vw, 40px)", fontWeight: 850, color: "#171626", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
            Upload your Resume or Academic CV
          </h1>
          <p style={{ fontSize: 15.5, color: "#64748B", margin: 0, maxWidth: 660, marginInline: "auto", lineHeight: 1.55 }}>
            EORA automatically parses your course transcripts, project achievements, and skill mentions to construct your foundational competence graph.
          </p>
        </div>

        {/* Two Columns: Left Dropzone + Right Parsing Intelligence Highlights */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24, alignItems: "stretch", marginBottom: 28 }}>
          
          {/* Left Dropzone */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 24,
              padding: "36px",
              boxShadow: "0 12px 36px -6px rgba(86, 66, 239, 0.08), 0 2px 12px rgba(0, 0, 0, 0.03)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              onDragOver={(event) => { if (!uploadBlocked) event.preventDefault(); }}
              onDrop={(event) => { event.preventDefault(); if (!uploadBlocked) void processFile(event.dataTransfer.files?.[0]); }}
              onClick={() => { if (!uploadBlocked) fileInputRef.current?.click(); }}
              role="button"
              aria-disabled={uploadBlocked || isBusy}
              tabIndex={uploadBlocked ? -1 : 0}
              onKeyDown={(e) => {
                if (!uploadBlocked && (e.key === "Enter" || e.key === " ")) {
                  fileInputRef.current?.click();
                }
              }}
              style={{
                border: uploadBlocked
                  ? "2px dashed #CBD5E1"
                  : isUploaded
                  ? "2px solid #10B981"
                  : "2px dashed #818CF8",
                borderRadius: 18,
                padding: "48px 24px",
                background: uploadBlocked
                  ? "#F8FAFC"
                  : isUploaded
                  ? "#F0FDF4"
                  : "linear-gradient(135deg, #FAFAFE 0%, #F5F3FF 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: uploadBlocked ? "not-allowed" : "pointer",
                opacity: uploadBlocked ? 0.65 : 1,
                transition: "all 0.2s ease",
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".pdf,.docx"
                onChange={handleFileChange}
              />

              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: isUploaded ? "#DCFCE7" : "#EEF2FF",
                  color: isUploaded ? "#10B981" : "#5642EF",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: 16,
                  boxShadow: isUploaded ? "0 4px 14px rgba(16, 185, 129, 0.25)" : "0 4px 14px rgba(86, 66, 239, 0.2)",
                }}
              >
                {isUploaded ? <FileText size={30} /> : <FileUp size={30} />}
              </div>

              <div style={{ fontSize: 17, fontWeight: 800, color: "#171626", marginBottom: 6, textAlign: "center" }}>
                {isUploaded && fileName ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#10B981" }}>
                    <CheckCircle2 size={18} /> {fileName}
                  </span>
                ) : (
                  "Drag & drop your resume file here"
                )}
              </div>

              <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 20 }}>
                Supports PDF and DOCX (up to 5 MB)
              </div>

              <button
                type="button"
                disabled={uploadBlocked || isBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!uploadBlocked) fileInputRef.current?.click();
                }}
                style={{
                  padding: "11px 28px",
                  borderRadius: 9999,
                  background: uploadBlocked || isBusy
                    ? "rgba(100, 116, 139, 0.4)"
                    : "linear-gradient(110deg, #02C5F5 0%, #4564FF 48%, #9335E8 100%)",
                  color: "#FFFFFF",
                  fontWeight: 750,
                  fontSize: 13.5,
                  border: "none",
                  cursor: uploadBlocked || isBusy ? "not-allowed" : "pointer",
                  boxShadow: uploadBlocked || isBusy ? "none" : "0 4px 16px rgba(69, 100, 255, 0.35)",
                }}
              >
                {uploadBlocked
                  ? "Upload Unavailable"
                  : isBusy
                  ? processingState === "SAVING"
                    ? "Saving Claims..."
                    : "Reading & Extracting..."
                  : isUploaded
                  ? "Replace File"
                  : "Browse Computer"}
              </button>

              {/* Honest blocked state — shown instead of fake-ready state */}
              {uploadBlocked && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginTop: 14,
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#DC2626",
                    fontSize: 12.5,
                    maxWidth: 340,
                    textAlign: "center",
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>
                    Resume upload is temporarily unavailable. Use{" "}
                    <strong>Skip for now</strong> to enter your details manually and upload a resume later.
                  </span>
                </div>
              )}

              {isBusy && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 20px",
                    marginTop: 14,
                    borderRadius: 14,
                    background: "linear-gradient(135deg, rgba(86, 66, 239, 0.05) 0%, rgba(2, 197, 245, 0.08) 100%)",
                    border: "1px solid rgba(86, 66, 239, 0.2)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#5642EF", fontWeight: 700, fontSize: 13.5 }}>
                    <Hourglass size={18} className="animate-spin" style={{ animationDuration: "3s" }} />
                    <span>
                      {processingState === "UPLOADING" && "Uploading document securely..."}
                      {processingState === "PARSING" && "Parsing document structure & text..."}
                      {processingState === "EXTRACTING" && "Extracting skills, academics & projects (Zero-LLM)..."}
                      {processingState === "SAVING" && "Saving reviewed claims to Tathastu Core..."}
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: "#64748B" }}>
                    Deterministic in-process analysis &bull; Zero generative LLMs
                  </span>
                </div>
              )}

              {errorMessage && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#EF4444", fontSize: 13 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} /> {errorMessage}
                  </div>
                  {processingState === "FAILED" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                      {selectedFileRef.current && (
                        <button
                          type="button"
                          onClick={() => processFile(selectedFileRef.current!)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            background: "#5642EF",
                            color: "#FFFFFF",
                            fontSize: 12,
                            fontWeight: 650,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Retry this file
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: "#F1F5F9",
                          color: "#334155",
                          fontSize: 12,
                          fontWeight: 600,
                          border: "1px solid #CBD5E1",
                          cursor: "pointer",
                        }}
                      >
                        Choose another file
                      </button>
                      <button
                        type="button"
                        onClick={handleSkip}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: "#F8FAFC",
                          color: "#475569",
                          fontSize: 12,
                          fontWeight: 600,
                          border: "1px solid #E2E8F0",
                          cursor: "pointer",
                        }}
                      >
                        Enter details manually
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isUploaded && candidates.length > 0 && <div style={{ marginTop: 16, maxHeight: 260, overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, background: "#FFFFFF" }}>
              <strong style={{ color: "#1E1B4B", fontSize: 13 }}>Review suggested claims</strong>
              <p style={{ color: "#64748B", fontSize: 12, margin: "6px 0 10px" }}>Select only accurate items. You can correct the text before saving. These are not independently verified.</p>
              {candidates.map((candidate, index) => <div key={candidate.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                <input aria-label={`Select ${candidate.category} ${candidate.value}`} type="checkbox" checked={candidate.selected} onChange={(event) => { setReviewSaved(false); setCandidates((current) => current.map((item, i) => i === index ? { ...item, selected: event.target.checked } : item)); }} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: "#5642EF", fontWeight: 750, fontSize: 11, textTransform: "uppercase" }}>{candidate.category}</span>
                  <input aria-label={`Edit ${candidate.category}`} value={candidate.value} onChange={(event) => { setReviewSaved(false); setCandidates((current) => current.map((item, i) => i === index ? { ...item, value: event.target.value, corrected: true } : item)); }} style={{ display: "block", width: "100%", border: "1px solid #CBD5E1", borderRadius: 6, padding: "5px 7px", fontSize: 12 }} />
                  <small style={{ color: "#64748B" }}>Source: “{candidate.sourceSpan}”</small>
                </div>
              </div>)}
              <button type="button" disabled={isBusy} onClick={saveReviewedClaims} style={{ background: isBusy ? "#94A3B8" : "#5642EF", color: "#FFFFFF", border: 0, borderRadius: 8, padding: "8px 14px", cursor: isBusy ? "not-allowed" : "pointer" }}>Save selected claims</button>
              {reviewSaved && <span style={{ color: "#059669", marginLeft: 8, fontSize: 12 }}>Review saved</span>}
            </div>}
            {Boolean(activeJobId) && processingState !== "IDLE" && (
              <ProcessingActivity source="resume" activeJobId={activeJobId} />
            )}

            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 14, color: "#475569", fontSize: 12.5, lineHeight: 1.45 }}>
              <input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} />
              I agree to have this resume parsed to suggest profile details. I will review suggestions before saving them.
            </label>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                type="button"
                onClick={handleSkip}
                disabled={isBusy}
                style={{
                  background: "none",
                  border: "none",
                  // Skip is ALWAYS available even when ingestion is blocked
                  color: isBusy ? "#94A3B8" : uploadBlocked ? "#5642EF" : "#64748B",
                  fontSize: 13.5,
                  fontWeight: uploadBlocked ? 700 : 600,
                  cursor: isBusy ? "not-allowed" : "pointer",
                }}
              >
                Skip for now →
              </button>
            </div>
          </div>

          {/* Right Parsing Intelligence Card */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 24,
              padding: "32px",
              boxShadow: "0 12px 36px -6px rgba(86, 66, 239, 0.08), 0 2px 12px rgba(0, 0, 0, 0.03)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <ShieldCheck size={18} color="#5642EF" />
                <h3 style={{ fontSize: 17, fontWeight: 850, color: "#1E1B4B", margin: 0 }}>
                  What EORA Extracts
                </h3>
              </div>
              <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: "0 0 20px" }}>
                Our proprietary extraction engine parses and structures your background into auditable evidence dimensions:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <BookOpen size={16} color="#5642EF" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 750, color: "#1E1B4B" }}>Academic History &amp; Transcripts</div>
                    <div style={{ fontSize: 11.5, color: "#64748B" }}>Degree, major, expected graduation, coursework, and cumulative CGPA.</div>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Layers size={16} color="#10B981" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 750, color: "#1E1B4B" }}>Technical Stack &amp; Frameworks</div>
                    <div style={{ fontSize: 11.5, color: "#64748B" }}>Deep Learning, PyTorch, Transformers, NLP, Python, and system tools.</div>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Sparkles size={16} color="#F59E0B" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 750, color: "#1E1B4B" }}>Projects &amp; Publications</div>
                    <div style={{ fontSize: 11.5, color: "#64748B" }}>Neural architectures, hackathon accomplishments, and research preprints.</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ paddingTop: 18, borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748B" }}>
              <span>Private upload &bull; review before saving</span>
              {ingestionReady === null && (
                <span style={{ fontWeight: 600, color: "#94A3B8", display: "flex", alignItems: "center", gap: 4 }}>
                  <Loader2 size={12} className="animate-spin" /> Checking service...
                </span>
              )}
              {ingestionReady === true && (
                <span style={{ fontWeight: 700, color: "#10B981" }}>
                  Upload Service: Ready
                </span>
              )}
              {ingestionReady === false && (
                <span style={{ fontWeight: 700, color: "#DC2626", display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertCircle size={12} /> Service Unavailable
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <ScreenFooter
          onBack={onBack}
          onNext={advance}
          onStepClick={onJumpToStep}
          activeStep={stepNumber}
          totalSteps={totalSteps}
          nextLabel={processingState === "FAILED" ? "Continue Manually →" : "Next"}
          isNextDisabled={isBusy}
        />
      </main>
    </div>
  );
}

