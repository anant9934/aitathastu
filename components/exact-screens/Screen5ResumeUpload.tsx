"use client";

import React, { useRef, useState } from "react";
import { FileText, CheckCircle2, FileUp, Sparkles, AlertCircle, ShieldCheck, Layers, BookOpen } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";

export type ReviewedResumeClaim = {
  candidateId?: string;
  category: "education" | "experience" | "project" | "skill" | "certification";
  value: string;
  sourceSpan: string;
  documentId: string;
  corrected: boolean;
};

type ResumeCandidate = ReviewedResumeClaim & { id: string; selected: boolean };

interface Screen5ResumeUploadProps {
  initialFileName?: string | null;
  onExtractSuccess?: (fileName: string, claims: ReviewedResumeClaim[]) => void;
  onNext: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

export function Screen5ResumeUpload({
  initialFileName,
  onExtractSuccess,
  onNext,
  onBack,
  onJumpToStep,
}: Screen5ResumeUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(initialFileName || null);
  const [isUploaded, setIsUploaded] = useState<boolean>(Boolean(initialFileName));
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [candidates, setCandidates] = useState<ResumeCandidate[]>([]);
  const [reviewSaved, setReviewSaved] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!aiConsent) {
      setErrorMessage("Please consent to resume processing before upload.");
      e.target.value = "";
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("aiConsent", "true");

      const res = await fetch("/api/resume/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Could not read this file. Please enter details manually.");
        setIsProcessing(false);
        return;
      }

      setFileName(file.name);
      setIsUploaded(true);
      setIsProcessing(false);
      setReviewSaved(false);
      const structured = data.structured || {};
      const documentId = String(data.documentId || "");
      const rows: ResumeCandidate[] = [];
      const append = (category: ReviewedResumeClaim["category"], values: unknown[], getValue: (item: Record<string, unknown>) => string) => {
        values.forEach((raw, index) => {
          if (!raw || typeof raw !== "object") return;
          const item = raw as Record<string, unknown>;
          const value = getValue(item);
          const sourceSpan = typeof item.sourceSpan === "string" ? item.sourceSpan.trim() : "";
          if (value && sourceSpan && documentId) rows.push({ id: `${category}_${index}`, candidateId: `${category}_${index}`, category, value, sourceSpan, documentId, corrected: false, selected: false });
        });
      };
      append("education", structured.education || [], (item) => [item.degree, item.fieldOfStudy, item.institution].filter(Boolean).join(" · "));
      append("experience", structured.experience || [], (item) => [item.role, item.company].filter(Boolean).join(" · "));
      append("project", structured.projects || [], (item) => String(item.title || ""));
      append("skill", structured.skills || [], (item) => String(item.name || ""));
      append("certification", structured.certifications || [], (item) => String(item.name || ""));

      if (rows.length === 0 && documentId) {
        if (data.suggestions?.education) {
          rows.push({ id: `education_0`, candidateId: `education_0`, category: "education", value: String(data.suggestions.education), sourceSpan: String(data.suggestions.education), documentId, corrected: false, selected: false });
        }
        if (data.suggestions?.skills) {
          const skl = String(data.suggestions.skills).split(/[,;]/);
          skl.forEach((s: string, idx: number) => {
            const trimmed = s.trim();
            if (trimmed) rows.push({ id: `skill_${idx}`, candidateId: `skill_${idx}`, category: "skill", value: trimmed, sourceSpan: trimmed, documentId, corrected: false, selected: false });
          });
        }
        if (data.discovery?.projects && Array.isArray(data.discovery.projects)) {
          data.discovery.projects.forEach((p: string, idx: number) => {
            if (p) rows.push({ id: `project_${idx}`, candidateId: `project_${idx}`, category: "project", value: p, sourceSpan: p, documentId, corrected: false, selected: false });
          });
        }
      }
      setCandidates(rows);
    } catch {
      setErrorMessage("Network error during file upload. You can continue manually.");
      setIsProcessing(false);
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
        rightLabel="Step 5 of 10"
      />

      <main
        className="screen-body"
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
            <span>Step 5 · Document &amp; Experience Ingestion</span>
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
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  fileInputRef.current?.click();
                }
              }}
              style={{
                border: isUploaded ? "2px solid #10B981" : "2px dashed #818CF8",
                borderRadius: 18,
                padding: "48px 24px",
                background: isUploaded ? "#F0FDF4" : "linear-gradient(135deg, #FAFAFE 0%, #F5F3FF 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
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
                disabled={isProcessing}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                style={{
                  padding: "11px 28px",
                  borderRadius: 9999,
                  background: "linear-gradient(110deg, #02C5F5 0%, #4564FF 48%, #9335E8 100%)",
                  color: "#FFFFFF",
                  fontWeight: 750,
                  fontSize: 13.5,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(69, 100, 255, 0.35)",
                }}
              >
                {isProcessing ? "Analyzing Resume with AI..." : isUploaded ? "Replace File" : "Browse Computer"}
              </button>

              {errorMessage && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#EF4444", fontSize: 13, marginTop: 12 }}>
                  <AlertCircle size={15} /> {errorMessage}
                </div>
              )}
            </div>

            {isUploaded && candidates.length > 0 && <div style={{ marginTop: 16, maxHeight: 260, overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, background: "#FFFFFF" }}>
              <strong style={{ color: "#1E1B4B", fontSize: 13 }}>Review suggested claims</strong>
              <p style={{ color: "#64748B", fontSize: 12, margin: "6px 0 10px" }}>Select only accurate items. You can correct the text before saving. These are not independently verified.</p>
              {candidates.map((candidate, index) => <div key={candidate.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                <input aria-label={`Select ${candidate.category} ${candidate.value}`} type="checkbox" checked={candidate.selected} onChange={(event) => setCandidates((current) => current.map((item, i) => i === index ? { ...item, selected: event.target.checked } : item))} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: "#5642EF", fontWeight: 750, fontSize: 11, textTransform: "uppercase" }}>{candidate.category}</span>
                  <input aria-label={`Edit ${candidate.category}`} value={candidate.value} onChange={(event) => setCandidates((current) => current.map((item, i) => i === index ? { ...item, value: event.target.value, corrected: true } : item))} style={{ display: "block", width: "100%", border: "1px solid #CBD5E1", borderRadius: 6, padding: "5px 7px", fontSize: 12 }} />
                  <small style={{ color: "#64748B" }}>Source: “{candidate.sourceSpan}”</small>
                </div>
              </div>)}
              <button type="button" onClick={() => { onExtractSuccess?.(fileName || "resume", candidates.filter((candidate) => candidate.selected && candidate.value.trim()).map(({ candidateId, category, value, sourceSpan, documentId, corrected }) => ({ candidateId, category, value: value.trim(), sourceSpan, documentId, corrected }))); setReviewSaved(true); }} style={{ background: "#5642EF", color: "#FFFFFF", border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Save selected claims</button>
              {reviewSaved && <span style={{ color: "#059669", marginLeft: 8, fontSize: 12 }}>Review saved</span>}
            </div>}

            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 14, color: "#475569", fontSize: 12.5, lineHeight: 1.45 }}>
              <input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} />
              I agree to have this resume parsed and relevant text sent to an approved AI provider to suggest profile details. I will review suggestions before saving them.
            </label>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                type="button"
                onClick={onNext}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748B",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
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
              <span style={{ fontWeight: 700, color: "#10B981" }}>Ready</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <ScreenFooter
          onBack={onBack}
          onNext={onNext}
          onStepClick={onJumpToStep}
          activeStep={5}
          totalSteps={10}
          nextLabel="Next"
        />
      </main>
    </div>
  );
}
