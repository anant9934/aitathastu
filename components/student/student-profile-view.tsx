"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Target,
  FileCheck2,
  History,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building,
  Award,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { useWorkspace } from "./student-context";
import { getSourceLabel, getVerificationStatusLabel, type EvidenceItem } from "@/lib/domain";
import { RequestVerificationModal } from "./request-verification-modal";

export function StudentProfileView() {
  const {
    workspace,
    user,
    activeGoal,
    evidence,
    journeyEvents,
    verificationRequests,
    updateProfile,
    addEvidence,
  } = useWorkspace();

  const [verifyingItem, setVerifyingItem] = useState<EvidenceItem | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [displayName, setDisplayName] = useState(workspace?.person.name || "");
  const [education, setEducation] = useState(workspace?.person.education || "");
  const [experience, setExperience] = useState(workspace?.person.experience || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Evidence modal state
  const [isAddingEvidence, setIsAddingEvidence] = useState(false);
  const [newCategory, setNewCategory] = useState("skill");
  const [newSubject, setNewSubject] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newWhyItMatters, setNewWhyItMatters] = useState("");
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const initial = workspace?.person.name ? workspace.person.name.trim().charAt(0).toUpperCase() : "S";

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccessMsg(null);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        education: education.trim(),
        experience: experience.trim(),
      });
      setIsEditingProfile(false);
      setProfileSuccessMsg("Profile details saved to Tathastu Core.");
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Save profile error", err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) {
      setEvidenceError("Please provide a subject for the evidence.");
      return;
    }
    setSavingEvidence(true);
    setEvidenceError(null);
    try {
      await addEvidence({
        category: newCategory,
        subject: newSubject.trim(),
        value: newValue.trim() || newSubject.trim(),
        whyItMatters: newWhyItMatters.trim(),
      });
      setIsAddingEvidence(false);
      setNewSubject("");
      setNewValue("");
      setNewWhyItMatters("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add evidence.";
      setEvidenceError(message);
    } finally {
      setSavingEvidence(false);
    }
  };

  return (
    <div className="student-home-view" style={{ maxWidth: 980, margin: "0 auto", paddingBottom: 60 }}>
      {/* Profile Header Hero */}
      <section className="ws-hero-card" style={{ padding: "32px 30px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #5942dc, #7961f7)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 28,
                fontWeight: 700,
                boxShadow: "0 8px 24px rgba(89, 66, 220, 0.25)",
              }}
            >
              {initial}
            </div>
            <div>
              <div className="ws-greeting-badge">
                <ShieldCheck size={13} />
                <span>PERSON 360 FOUNDATION</span>
              </div>
              <h1 className="ws-greeting-title" style={{ fontSize: "clamp(24px, 3vw, 32px)", margin: "4px 0" }}>
                {workspace?.person.name || "Student"}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 13.5, color: "#696778" }}>
                <span>{user?.email || "Account member"}</span>
                <span>•</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Building size={14} color="#5942dc" /> AI Tathastu Network (Student)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setDisplayName(workspace?.person.name || "");
              setEducation(workspace?.person.education || "");
              setExperience(workspace?.person.experience || "");
              setIsEditingProfile(!isEditingProfile);
            }}
            className="ws-btn ws-btn-secondary"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: 13.5 }}
          >
            {isEditingProfile ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        {profileSuccessMsg && (
          <div
            style={{
              marginTop: 18,
              background: "#edfcf4",
              border: "1px solid #c2f3d6",
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#166534",
              fontSize: 13,
            }}
          >
            <CheckCircle2 size={16} />
            <span>{profileSuccessMsg}</span>
          </div>
        )}

        {/* Inline Profile Editing Form */}
        {isEditingProfile && (
          <form onSubmit={handleSaveProfile} style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #efede9" }}>
            <h3 style={{ fontSize: 16, fontWeight: 650, color: "var(--ink)", marginBottom: 14 }}>
              Edit Self-Managed Details
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              <div className="auth-field">
                <label className="auth-label">Display Name</label>
                <input
                  type="text"
                  className="auth-input"
                  style={{ paddingLeft: 14 }}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Education / Degree</label>
                <input
                  type="text"
                  className="auth-input"
                  style={{ paddingLeft: 14 }}
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="e.g. B.Tech Computer Science, 3rd Year"
                />
              </div>
            </div>
            <div className="auth-field" style={{ marginTop: 14 }}>
              <label className="auth-label">Prior Background & Projects</label>
              <textarea
                className="auth-input"
                style={{ padding: 12, height: 74, resize: "vertical" }}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Brief summary of projects, exposure, or prior experience"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="ws-btn ws-btn-secondary"
                style={{ minHeight: 38, fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="ws-btn ws-btn-primary"
                style={{ minHeight: 38, fontSize: 13 }}
              >
                {savingProfile ? "Saving…" : "Save to Database"}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Grid: Background & Goals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginTop: 22 }}>
        {/* Education & Background Card */}
        <div className="ws-content-card" style={{ padding: "24px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <GraduationCap size={18} color="#5942dc" />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>Education & Background</h2>
          </div>
          <div style={{ fontSize: 14, color: "#363345", marginBottom: 14, lineHeight: 1.5 }}>
            <strong>Degree / Institution:</strong>
            <div style={{ color: "#5a576b", marginTop: 2 }}>
              {workspace?.person.education || "No education background entered yet."}
            </div>
          </div>
          <div style={{ fontSize: 14, color: "#363345", lineHeight: 1.5 }}>
            <strong>Project / Experience Notes:</strong>
            <div style={{ color: "#5a576b", marginTop: 2 }}>
              {workspace?.person.experience || "No prior background notes recorded yet."}
            </div>
          </div>
        </div>

        {/* Pathway Direction Card */}
        <div className="ws-content-card" style={{ padding: "24px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Target size={18} color="#5942dc" />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>Active Direction</h2>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
            {activeGoal?.title || "Exploring Directions"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 650,
                padding: "3px 8px",
                borderRadius: 6,
                background: "#eeebff",
                color: "#5942dc",
                textTransform: "uppercase",
              }}
            >
              Status: {activeGoal?.status || "active"}
            </span>
            <span style={{ fontSize: 12, color: "#817e8d" }}>
              Source: {activeGoal?.source === "preset" ? "Canonical Track" : "Custom Direction"}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#696778", margin: 0, lineHeight: 1.45 }}>
            Gaps and next actions are evaluated continuously against this direction.
          </p>
        </div>
      </div>

      {/* Connected Evidence Producers Section (Phase 6) */}
      <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16 }}>
        <div className="ws-content-card" style={{ padding: "20px 22px", background: "linear-gradient(180deg, #ffffff, #fcfbf9)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Award size={18} color="#059669" />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--ink)" }}>Standardized Assessments</h3>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#059669" }}>ERIS Connected</span>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", background: "rgba(16, 185, 129, 0.1)", padding: "2px 8px", borderRadius: 6 }}>
              {evidence.filter((e) => e.category === "assessment").length} verified items
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: "#5a576b", margin: "0 0 14px", lineHeight: 1.45 }}>
            Objective assessment outcomes ingested with verified provenance. Informs goal dimensions with standardized evidence.
          </p>
          <Link
            href="/student/assessments"
            style={{
              fontSize: 12.5,
              fontWeight: 650,
              color: "#059669",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            View ERIS Assessments <ArrowRight size={14} />
          </Link>
        </div>

        <div className="ws-content-card" style={{ padding: "20px 22px", background: "linear-gradient(180deg, #ffffff, #fcfbf9)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(89, 66, 220, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageSquare size={18} color="#5942dc" />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--ink)" }}>AI Interview Practice</h3>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#5942dc" }}>Rubric Connected</span>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#5942dc", background: "rgba(89, 66, 220, 0.1)", padding: "2px 8px", borderRadius: 6 }}>
              {evidence.filter((e) => e.category === "interview").length} sessions
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: "#5a576b", margin: "0 0 14px", lineHeight: 1.45 }}>
            Performance observations on technical reasoning and communication. Session-specific feedback without permanent labels.
          </p>
          <Link
            href="/student/interviews"
            style={{
              fontSize: 12.5,
              fontWeight: 650,
              color: "#5942dc",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            View Interview Feedback <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Evidence Ledger Section */}
      <section className="ws-content-card" style={{ marginTop: 22, padding: "26px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileCheck2 size={18} color="#5942dc" />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                Person 360 Evidence Ledger
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "#696778", margin: "4px 0 0" }}>
              Total {evidence.length} recorded items with preserved provenance and honest verification states.
            </p>
          </div>

          <button
            onClick={() => setIsAddingEvidence(true)}
            className="ws-btn ws-btn-secondary"
            style={{ minHeight: 38, fontSize: 13, gap: 6 }}
          >
            <Plus size={15} />
            <span>Add Honest Evidence</span>
          </button>
        </div>

        {/* Modal / Inline Add Evidence Form */}
        {isAddingEvidence && (
          <form
            onSubmit={handleAddEvidence}
            style={{
              background: "#faf9f7",
              border: "1px solid #e9e6e2",
              borderRadius: 14,
              padding: "18px 20px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 650, color: "var(--ink)" }}>Record New Evidence Item</span>
              <span style={{ fontSize: 11.5, color: "#777485", background: "#eee", padding: "2px 8px", borderRadius: 4 }}>
                Saved as: Self-reported (Unverified)
              </span>
            </div>

            {evidenceError && (
              <div style={{ color: "#991b1b", fontSize: 12.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertCircle size={14} /> {evidenceError}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, marginBottom: 12 }}>
              <div className="auth-field">
                <label className="auth-label">Category</label>
                <select
                  className="auth-input"
                  style={{ paddingLeft: 10 }}
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  <option value="skill">Skill</option>
                  <option value="project">Project</option>
                  <option value="education">Education</option>
                  <option value="experience">Experience</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="auth-field">
                <label className="auth-label">Subject</label>
                <input
                  type="text"
                  className="auth-input"
                  style={{ paddingLeft: 12 }}
                  placeholder="e.g. PyTorch, Docker, or Research Paper"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                />
              </div>
            </div>

            <div className="auth-field" style={{ marginBottom: 12 }}>
              <label className="auth-label">Context / Demonstration Value</label>
              <input
                type="text"
                className="auth-input"
                style={{ paddingLeft: 12 }}
                placeholder="e.g. Built an image classifier during semester coursework"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>

            <div className="auth-field" style={{ marginBottom: 14 }}>
              <label className="auth-label">Why it matters (optional)</label>
              <input
                type="text"
                className="auth-input"
                style={{ paddingLeft: 12 }}
                placeholder="e.g. Relevant for ML model training and deployment"
                value={newWhyItMatters}
                onChange={(e) => setNewWhyItMatters(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsAddingEvidence(false)}
                className="ws-btn ws-btn-secondary"
                style={{ minHeight: 36, fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEvidence}
                className="ws-btn ws-btn-primary"
                style={{ minHeight: 36, fontSize: 13 }}
              >
                {savingEvidence ? "Recording…" : "Save Evidence"}
              </button>
            </div>
          </form>
        )}

        {/* Evidence List */}
        {evidence.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--muted)", fontSize: 14 }}>
            No evidence recorded yet. Use the button above to record your first skill or project exposure.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {evidence.map((item) => {
              const req = (verificationRequests || []).find((r) => r.evidenceId === item.id);
              const isVerified = item.verificationStatus === "verified";
              const isPending = item.verificationStatus === "verification_requested" || item.verificationStatus === "under_review";
              const isChangesRequested = item.verificationStatus === "changes_requested";
              const isRejected = item.verificationStatus === "rejected";
              const isEligibleForVerification = !isVerified && !isPending && !isChangesRequested;

              // Find latest decision feedback if any
              const latestDecision = req?.decisions && req.decisions.length > 0
                ? req.decisions[req.decisions.length - 1]
                : null;

              return (
                <div
                  key={item.id}
                  style={{
                    border: isChangesRequested
                      ? "1px solid #fed7aa"
                      : isVerified
                      ? "1px solid #bbf7d0"
                      : "1px solid #eeece8",
                    borderRadius: 12,
                    padding: "16px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    background: isChangesRequested ? "#fffbf7" : isVerified ? "#fbfdfc" : "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: "#5942dc",
                            background: "#f2effc",
                            padding: "2px 7px",
                            borderRadius: 5,
                          }}
                        >
                          {item.category}
                        </span>
                        <strong style={{ fontSize: 15, color: "var(--ink)" }}>{item.subject}</strong>
                      </div>
                      <div style={{ fontSize: 13.5, color: "#474454", marginBottom: 4, lineHeight: 1.45 }}>
                        {item.value}
                      </div>
                      <div style={{ fontSize: 12, color: "#817e8d", fontStyle: "italic" }}>
                        {item.interpretation}
                      </div>

                      {item.sourceReference && (
                        <div style={{ fontSize: 12, color: "#5942dc", marginTop: 4 }}>
                          Reference: <code>{item.sourceReference}</code>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 650,
                          padding: "3px 9px",
                          borderRadius: 6,
                          background:
                            isVerified
                              ? "#dcfce7"
                              : isChangesRequested
                              ? "#ffedd5"
                              : isPending
                              ? "#fef3c7"
                              : isRejected
                              ? "#f1f5f9"
                              : "#faf9f7",
                          color:
                            isVerified
                              ? "#15803d"
                              : isChangesRequested
                              ? "#c2410c"
                              : isPending
                              ? "#b45309"
                              : isRejected
                              ? "#475569"
                              : "#6a6778",
                          border: `1px solid ${
                            isVerified
                              ? "#bbf7d0"
                              : isChangesRequested
                              ? "#fed7aa"
                              : isPending
                              ? "#fde68a"
                              : "#e9e6e2"
                          }`,
                        }}
                      >
                        {getVerificationStatusLabel(item.verificationStatus)}
                      </span>
                      <span style={{ fontSize: 11, color: "#9e9ba9" }}>
                        {getSourceLabel(item.source)}
                      </span>
                    </div>
                  </div>

                  {/* Reviewer Feedback / Changes Requested Banner */}
                  {isChangesRequested && latestDecision && (
                    <div
                      style={{
                        background: "#fff7ed",
                        border: "1px solid #fed7aa",
                        borderRadius: 8,
                        padding: "10px 12px",
                        fontSize: 12.5,
                        color: "#9a3412",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <AlertCircle size={15} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <strong>Reviewer requested updates:</strong> &ldquo;{latestDecision.reason}&rdquo;
                      </div>
                    </div>
                  )}

                  {/* Verified provenance details */}
                  {isVerified && item.verifiedAt && (
                    <div style={{ fontSize: 11.5, color: "#166534", display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle2 size={13} />
                      <span>
                        Verified on {new Date(item.verifiedAt).toLocaleDateString()}
                        {item.verificationMethod ? ` via ${item.verificationMethod.replace("_", " ")}` : ""}
                      </span>
                    </div>
                  )}

                  {/* Actions: Request or Resubmit */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
                    {isChangesRequested && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyingItem(item);
                          setIsVerifyModalOpen(true);
                        }}
                        className="ws-btn ws-btn-primary"
                        style={{ fontSize: 12, minHeight: 32, padding: "4px 12px" }}
                      >
                        Respond & Resubmit Updates
                      </button>
                    )}

                    {isEligibleForVerification && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyingItem(item);
                          setIsVerifyModalOpen(true);
                        }}
                        className="ws-btn ws-btn-secondary"
                        style={{ fontSize: 12, minHeight: 32, padding: "4px 12px", gap: 6 }}
                      >
                        <ShieldCheck size={13} />
                        <span>Request Verification</span>
                      </button>
                    )}

                    {isPending && (
                      <span style={{ fontSize: 12, color: "#b45309", fontStyle: "italic", alignSelf: "center" }}>
                        Pending faculty review
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>


      {/* Journey Milestones Section */}
      <section className="ws-content-card" style={{ marginTop: 22, padding: "26px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <History size={18} color="#5942dc" />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
            Persistent Journey Milestones
          </h2>
        </div>

        {journeyEvents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 20px", color: "var(--muted)", fontSize: 14 }}>
            No journey events recorded yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {journeyEvents.slice(0, 10).map((ev) => (
              <div
                key={ev.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  paddingBottom: 12,
                  borderBottom: "1px solid #f2efe9",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#5942dc",
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong style={{ fontSize: 13.5, color: "var(--ink)" }}>{ev.title}</strong>
                    <span style={{ fontSize: 11.5, color: "#8e8b99" }}>
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#636072", marginTop: 2 }}>{ev.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <RequestVerificationModal
        evidenceItem={verifyingItem}
        existingRequest={
          verifyingItem
            ? (verificationRequests || []).find((r) => r.evidenceId === verifyingItem.id)
            : null
        }
        isOpen={isVerifyModalOpen}
        onClose={() => {
          setIsVerifyModalOpen(false);
          setVerifyingItem(null);
        }}
      />
    </div>
  );
}

