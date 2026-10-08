"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Edit3,
  Trash2,
  ArrowLeft,
  Calendar,
  Users,
  Cpu,
  Layers,
  Terminal,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Globe,
  FileText,
  Database,
  BarChart2,
  Lock,
  Eye,
} from "lucide-react";
import type {
  ProjectLinkRecord,
  ProjectTimelineRecord,
  TeamMemberRecord,
  MentorRecord,
  AiMlDetailsRecord,
  HardwareDetailsRecord,
} from "@/lib/domain/project-taxonomy";

interface ProjectDetailData {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  purpose: string;
  visibility: string;
  projectType: string;
  status: string;
  repositoryUrl: string | null;
  demoUrl: string | null;
  technologies: string[];
  sources: string[];
  links: ProjectLinkRecord[];
  timeline: ProjectTimelineRecord;
  team: {
    projectStructure?: "individual" | "team";
    teamName?: string;
    teamMembers?: TeamMemberRecord[];
    mentors?: MentorRecord[];
  };
  aiDetails: AiMlDetailsRecord;
  hardwareDetails: HardwareDetailsRecord;
  media: unknown[];
  contributionRoles: string[];
  contributionNote: string;
  createdAt: string;
  updatedAt: string;
}

interface EvidenceRecordItem {
  id: string;
  category: string;
  subject: string;
  value: string;
  source: string;
  verificationStatus: string;
  sourceReference: string | null;
  interpretation: string;
  whyItMatters: string;
  observedAt: string | null;
}

export function StudentProjectDetailView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjectDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/student/projects/${projectId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Project not found or you do not have permission to view it.");
        }
        throw new Error("Failed to load project details.");
      }
      const data = await res.json();
      setProject(data.project);
      setEvidenceList(data.evidence || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading project.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectDetail();
  }, [fetchProjectDetail]);

  const handleDelete = async () => {
    if (!project) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${project.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/student/projects/${project.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete project.");
      }
      router.push("/student/projects");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete project.");
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1040, marginInline: "auto", padding: "48px 20px", textAlign: "center" }}>
        <p style={{ color: "#696778", fontSize: 15 }}>Loading project record from Tathastu ledger...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ maxWidth: 1040, marginInline: "auto", padding: "48px 20px" }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            border: "1px solid #E5E7EB",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <AlertCircle size={36} color="#DC2626" style={{ margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#171626", marginBottom: 8 }}>
            Unable to Load Project
          </h2>
          <p style={{ color: "#696778", fontSize: 14, marginBottom: 20 }}>
            {error || "Project record could not be found."}
          </p>
          <Link
            href="/student/projects"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              background: "#5942DC",
              color: "#FFF",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <ArrowLeft size={16} /> Return to Projects
          </Link>
        </div>
      </div>
    );
  }

  const isHardware = project.projectType === "hardware" || project.projectType === "both";
  const metrics = project.aiDetails?.results || [];

  return (
    <div style={{ maxWidth: 1040, marginInline: "auto", width: "100%", padding: "28px 20px 80px" }}>
      {/* Back Navigation & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <Link
          href="/student/projects"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
            color: "#5942DC",
          }}
        >
          <ArrowLeft size={16} /> Back to All Projects
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => router.push(`/student/projects?edit=${project.id}`)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#171626",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Edit3 size={15} color="#5942DC" /> Edit Project
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #FEE2E2",
              background: "#FEF2F2",
              color: "#DC2626",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Trash2 size={15} /> {isDeleting ? "Deleting..." : "Delete Project"}
          </button>
        </div>
      </div>

      {/* Main Header Card */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          border: "1px solid #E5E7EB",
          boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
          padding: 32,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 12,
              background: "#EDE9FE",
              color: "#5942DC",
              textTransform: "capitalize",
            }}
          >
            {project.status.replace("_", " ")}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 12,
              background: "#F3F4F6",
              color: "#374151",
            }}
          >
            {project.category}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 12,
              background: "#F3F4F6",
              color: "#374151",
              textTransform: "capitalize",
            }}
          >
            {project.projectType}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 12,
              background: "#F3F4F6",
              color: "#6B7280",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {project.visibility === "private" ? <Lock size={12} /> : <Eye size={12} />}
            {project.visibility}
          </span>
          {project.sources?.includes("github") && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 12,
                background: "#EFF6FF",
                color: "#2563EB",
                border: "1px solid #DBEAFE",
              }}
            >
              GitHub Source
            </span>
          )}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#171626", margin: "0 0 12px", lineHeight: 1.2 }}>
          {project.title}
        </h1>

        {project.summary && (
          <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.6, margin: "0 0 20px", fontWeight: 500 }}>
            {project.summary}
          </p>
        )}

        {/* Saved Links Bar (Only show if actually saved!) */}
        {((project.links && project.links.length > 0) || project.repositoryUrl || project.demoUrl) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 18, borderTop: "1px solid #F3F4F6" }}>
            {project.repositoryUrl && (
              <a
                href={project.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "#171626",
                  color: "#FFF",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Terminal size={14} /> Repository <ExternalLink size={12} />
              </a>
            )}
            {project.demoUrl && (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "#059669",
                  color: "#FFF",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Globe size={14} /> Live Demo <ExternalLink size={12} />
              </a>
            )}
            {project.links?.map((link) => (
              <a
                key={link.id || link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  color: "#374151",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <FileText size={13} color="#5942DC" />
                {link.label || link.type} <ExternalLink size={12} color="#9CA3AF" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 24 }}>
        {/* Left Column: Technical Details, Personal Contribution, Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Detailed Description */}
          {project.description && (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E5E7EB",
                padding: 24,
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#171626", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={18} color="#5942DC" /> Project Description
              </h2>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {project.description}
              </div>
            </div>
          )}

          {/* Personal Contribution Record */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#171626", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} color="#5942DC" /> Personal Contribution
              </h2>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A" }}>
                Self-Reported Claim
              </span>
            </div>

            {project.contributionRoles && project.contributionRoles.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {project.contributionRoles.map((role) => (
                  <span
                    key={role}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 10,
                      background: "#EDE9FE",
                      color: "#5942DC",
                      border: "1px solid #DDD6FE",
                    }}
                  >
                    {role}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 12px" }}>
                No specific roles selected yet.
              </p>
            )}

            {project.contributionNote ? (
              <div
                style={{
                  background: "#F9FAFB",
                  borderRadius: 10,
                  border: "1px solid #F3F4F6",
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#374151",
                  lineHeight: 1.6,
                }}
              >
                &ldquo;{project.contributionNote}&rdquo;
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, fontStyle: "italic" }}>
                No contribution notes recorded.
              </p>
            )}

            <p style={{ fontSize: 11, color: "#6B7280", margin: "14px 0 0", borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
              * Contribution claims reflect individual student responsibilities and are separate from third-party library or collaborator code.
            </p>
          </div>

          {/* AI/ML Details (Problem, Dataset, Architecture, Results) */}
          {(project.aiDetails?.problemStatement || project.aiDetails?.proposedSolution || project.aiDetails?.modelFamily || metrics.length > 0) && (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E5E7EB",
                padding: 24,
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#171626", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Cpu size={18} color="#5942DC" /> AI/ML Technical Specifications
              </h2>

              {project.aiDetails?.problemStatement && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>
                    Problem Statement
                  </div>
                  <p style={{ fontSize: 14, color: "#374151", margin: 0, lineHeight: 1.6 }}>
                    {project.aiDetails.problemStatement}
                  </p>
                </div>
              )}

              {project.aiDetails?.proposedSolution && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>
                    Proposed Solution & Method
                  </div>
                  <p style={{ fontSize: 14, color: "#374151", margin: 0, lineHeight: 1.6 }}>
                    {project.aiDetails.proposedSolution}
                  </p>
                </div>
              )}

              {/* Model & Architecture */}
              {(project.aiDetails?.modelFamily || project.aiDetails?.algorithm || project.aiDetails?.trainingApproach) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16, background: "#F9FAFB", padding: 14, borderRadius: 10 }}>
                  {project.aiDetails?.modelFamily && (
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>Model Family</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#171626" }}>{project.aiDetails.modelFamily}</div>
                    </div>
                  )}
                  {project.aiDetails?.algorithm && (
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>Algorithm</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#171626" }}>{project.aiDetails.algorithm}</div>
                    </div>
                  )}
                  {project.aiDetails?.trainingApproach && (
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>Training Approach</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#171626" }}>{project.aiDetails.trainingApproach}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Dataset Details */}
              {project.aiDetails?.dataset && (project.aiDetails.dataset.name || project.aiDetails.dataset.source) && (
                <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, border: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#171626", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <Database size={14} color="#5942DC" /> Dataset Information
                  </div>
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    <strong>Name:</strong> {project.aiDetails.dataset.name || "Custom dataset"}
                    {project.aiDetails.dataset.source && ` • Source: ${project.aiDetails.dataset.source}`}
                    {project.aiDetails.dataset.license && ` • License: ${project.aiDetails.dataset.license}`}
                  </div>
                  {project.aiDetails.dataset.url && (
                    <a
                      href={project.aiDetails.dataset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#5942DC", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}
                    >
                      Dataset Reference <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}

              {/* Structured Metrics Table */}
              {metrics.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#171626", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <BarChart2 size={14} color="#5942DC" /> Reported Performance Metrics
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                          <th style={{ padding: "8px 12px", fontWeight: 600, color: "#4B5563" }}>Metric</th>
                          <th style={{ padding: "8px 12px", fontWeight: 600, color: "#4B5563" }}>Reported Value</th>
                          <th style={{ padding: "8px 12px", fontWeight: 600, color: "#4B5563" }}>Evaluation Split</th>
                          <th style={{ padding: "8px 12px", fontWeight: 600, color: "#4B5563" }}>Baseline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #F3F4F6" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 700, color: "#171626" }}>{m.metricName}</td>
                            <td style={{ padding: "8px 12px", color: "#059669", fontWeight: 600 }}>
                              {m.metricValue} {m.unit || ""}
                            </td>
                            <td style={{ padding: "8px 12px", color: "#6B7280" }}>{m.datasetSplit || "Test set"}</td>
                            <td style={{ padding: "8px 12px", color: "#6B7280" }}>{m.baseline || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: 11, color: "#6B7280", margin: "8px 0 0" }}>
                    * Values represent reported experimental results with documented evaluation splits.
                  </p>
                </div>
              )}

              {/* Limitations */}
              {project.aiDetails?.limitations && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>
                    Known Limitations
                  </div>
                  <p style={{ fontSize: 13, color: "#4B5563", margin: 0, lineHeight: 1.5 }}>
                    {project.aiDetails.limitations}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Hardware Details (if applicable) */}
          {isHardware && (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E5E7EB",
                padding: 24,
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#171626", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Cpu size={18} color="#5942DC" /> Hardware Details
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
                {project.hardwareDetails?.platform && (
                  <div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>Platform</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#171626" }}>{project.hardwareDetails.platform}</div>
                  </div>
                )}
                {project.hardwareDetails?.microcontroller && (
                  <div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>Microcontroller / SBC</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#171626" }}>{project.hardwareDetails.microcontroller}</div>
                  </div>
                )}
                {project.hardwareDetails?.prototypeStage && (
                  <div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>Prototype Stage</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#171626" }}>{project.hardwareDetails.prototypeStage}</div>
                  </div>
                )}
              </div>

              {project.hardwareDetails?.testingNotes && (
                <div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 2 }}>Testing Notes</div>
                  <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{project.hardwareDetails.testingNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Evidence Graph Records */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#171626", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={18} color="#5942DC" /> Evidence Graph & Verification
              </h2>
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                {evidenceList.length} {evidenceList.length === 1 ? "record" : "records"} linked
              </span>
            </div>

            {evidenceList.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {evidenceList.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid #F3F4F6",
                      background: "#F9FAFB",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#171626" }}>{e.subject}</div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: e.verificationStatus === "institution_verified" ? "#DCFCE7" : "#F3F4F6",
                          color: e.verificationStatus === "institution_verified" ? "#166534" : "#4B5563",
                        }}
                      >
                        {e.verificationStatus.replace("_", " ")}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#4B5563", marginBottom: 4 }}>{e.interpretation}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>
                      <strong>Why it matters:</strong> {e.whyItMatters}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
                No external verification records attached yet. Project is saved as a verified student artifact in your portfolio ledger.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Technologies, Team, Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Technologies Card */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#171626", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Terminal size={16} color="#5942DC" /> Saved Technologies
            </h2>
            {project.technologies && project.technologies.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {project.technologies.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: "#F3F4F6",
                      color: "#374151",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>None specified.</p>
            )}
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "12px 0 0" }}>
              * Technologies represent tool usage in this project, not automated claims of verified mastery.
            </p>
          </div>

          {/* Team & Mentors */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#171626", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={16} color="#5942DC" /> Team & Collaborators
            </h2>
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>
              <strong>Structure:</strong>{" "}
              {project.team?.projectStructure === "team" ? "Team Project" : "Individual Project"}
            </div>

            {project.team?.projectStructure === "team" && project.team.teamName && (
              <div style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>
                <strong>Team Name:</strong> {project.team.teamName}
              </div>
            )}

            {project.team?.teamMembers && project.team.teamMembers.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Team Members:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {project.team.teamMembers.map((m, idx) => (
                    <div key={idx} style={{ fontSize: 12, color: "#374151", background: "#F9FAFB", padding: "4px 8px", borderRadius: 6 }}>
                      {m.name} {m.role ? `(${m.role})` : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {project.team?.mentors && project.team.mentors.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Mentors & Advisors:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {project.team.mentors.map((m, idx) => (
                    <div key={idx} style={{ fontSize: 12, color: "#374151", background: "#F9FAFB", padding: "4px 8px", borderRadius: 6 }}>
                      {m.name} {m.role ? `• ${m.role}` : ""} {m.institution ? `(${m.institution})` : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timeline & Organization */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#171626", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={16} color="#5942DC" /> Timeline & Context
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#374151" }}>
              {project.timeline?.startDate && (
                <div>
                  <strong style={{ color: "#6B7280" }}>Start Date:</strong> {project.timeline.startDate}
                </div>
              )}
              {project.timeline?.endDate && (
                <div>
                  <strong style={{ color: "#6B7280" }}>End Date:</strong> {project.timeline.endDate}
                </div>
              )}
              {project.timeline?.expectedCompletionDate && (
                <div>
                  <strong style={{ color: "#6B7280" }}>Target Completion:</strong> {project.timeline.expectedCompletionDate}
                </div>
              )}
              {project.timeline?.institution && (
                <div>
                  <strong style={{ color: "#6B7280" }}>Institution:</strong> {project.timeline.institution}
                </div>
              )}
              {project.timeline?.course && (
                <div>
                  <strong style={{ color: "#6B7280" }}>Course:</strong> {project.timeline.course}
                </div>
              )}
              {project.timeline?.hackathon && (
                <div>
                  <strong style={{ color: "#6B7280" }}>Event / Hackathon:</strong> {project.timeline.hackathon}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
