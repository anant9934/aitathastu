"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Github,
  Plus,
  Star,
  GitFork,
  X,
  ExternalLink,
  Code2,
  Cpu,
  Layers,
  Sparkles,
  GitCommit,
  CheckCircle2,
  Check
} from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";

export interface ProjectEntry {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  sources: string[];
  status: "candidate" | "confirmed" | "removed";
  contribution: string[];
  contributionNote: string;
  url?: string;
  stars?: number;
  forks?: number;
  impactScore?: number;
  commitsCount?: number;
  codeSnippet?: string;
  architecture?: string[];
  highlights?: string[];
  aiPurpose?: string;
  uncertaintyNotes?: string[];
}

interface Screen10GitHubProjectsProps {
  discoveredProjects?: ProjectEntry[];
  onProjectsChange?: (projects: ProjectEntry[]) => void;
  onNext: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
  isGalleryMode?: boolean;
}

const defaultRichProjects: ProjectEntry[] = [
  {
    id: "proj_1",
    title: "CoRXGB",
    description: "Hybrid CNN + Bi-LSTM + XGBoost ensemble architecture for agile story point classification and effort estimation.",
    technologies: ["Python", "PyTorch", "XGBoost", "FastAPI"],
    sources: ["github"],
    status: "confirmed",
    contribution: ["Lead ML Architect", "Neural Architecture Search"],
    contributionNote: "Designed dual-stream CNN-LSTM encoder feeding gradient boosted tree ensembles.",
    stars: 42,
    forks: 8,
    impactScore: 94,
    commitsCount: 168,
    codeSnippet: `class CoRXGBEnsemble(nn.Module):
  def __init__(self, vocab_sz, emb_dim):
    super().__init__()
    self.cnn = TextCNN(vocab_sz, emb_dim)
    self.lstm = BiLSTM(emb_dim, hidden=128)
  def forward(self, x):
    feat = torch.cat([self.cnn(x), self.lstm(x)], 1)
    return self.xgb_head.predict_proba(feat)`,
    architecture: ["TextCNN Feature Extractor", "Bi-LSTM Sequence Memory", "XGBoost Stacking Head"],
    highlights: ["Published in IEEE workshop", "92.4% F1-score on benchmark", "Sub-15ms inference latency"],
  },
  {
    id: "proj_2",
    title: "Medical Image Classification",
    description: "Multi-modal vision transformer and U-Net pipeline for automated pathology segmentation and early tumor detection.",
    technologies: ["Python", "TensorFlow", "Vision Transformers", "OpenCV"],
    sources: ["github"],
    status: "confirmed",
    contribution: ["Computer Vision Lead", "REST Inference API"],
    contributionNote: "Trained hybrid ViT models with attention heatmaps and integrated DICOM medical format parsing.",
    stars: 28,
    forks: 6,
    impactScore: 88,
    commitsCount: 94,
    codeSnippet: `def compute_attention_rollout(vit_model, dicom_tensor):
  attn_weights = vit_model.get_attn_layers(dicom_tensor)
  rollout = torch.eye(attn_weights.size(-1))
  for attn in attn_weights:
    rollout = torch.matmul(attn, rollout)
  return heatmap_overlay(rollout)`,
    architecture: ["Vision Transformer (ViT-B/16)", "Grad-CAM Explainability", "FastAPI Serving"],
    highlights: ["AUROC 0.963 on NIH ChestX-ray", "Heatmap visual explainability", "Real-time DICOM processor"],
  },
  {
    id: "proj_3",
    title: "GRAcEmo ViRa",
    description: "AI-driven cognitive robotics platform with real-time gesture control, sensory SLAM mapping, and kinematics.",
    technologies: ["Python", "ROS 2", "MediaPipe", "C++"],
    sources: ["github"],
    status: "confirmed",
    contribution: ["Perception Stack", "Trajectory Optimization"],
    contributionNote: "Engineered 3D spatial coordinate solver using computer vision gesture streams on embedded hardware.",
    stars: 31,
    forks: 9,
    impactScore: 84,
    commitsCount: 112,
    codeSnippet: `void GestureController::processFrame(const cv::Mat& frame) {
  auto landmarks = pose_detector->Infer(frame);
  geometry_msgs::Twist cmd;
  cmd.linear.x = kinematics::ComputeVelocity(landmarks);
  pub_cmd_vel->publish(cmd);
}`,
    architecture: ["ROS 2 Humble Node", "MediaPipe Hands 3D", "PID Kinematics Solver"],
    highlights: ["Smart India Hackathon Finalist", "60 FPS embedded latency", "Closed-loop feedback control"],
  },
  {
    id: "proj_4",
    title: "Agentic RAG Search Engine",
    description: "Self-correcting retrieval augmented generation system with iterative query planning and reranking.",
    technologies: ["Python", "LangChain", "Qdrant", "HuggingFace"],
    sources: ["github"],
    status: "confirmed",
    contribution: ["Full-Stack AI Developer"],
    contributionNote: "Engineered multi-stage vector search with BM25 hybrid ranking and hallucination grading.",
    stars: 19,
    forks: 4,
    impactScore: 91,
    commitsCount: 78,
    codeSnippet: `async def generate_grounded_answer(query: str):
  docs = await hybrid_retriever.get_relevant_documents(query)
  grade = await grader_chain.ainvoke({"docs": docs, "query": query})
  if grade.score < 0.7:
    return await fallback_web_search(query)
  return await answer_chain.ainvoke(docs)`,
    architecture: ["Hybrid Sparse/Dense Retriever", "Hallucination Grader LLM", "Async Streaming Server"],
    highlights: ["85% reduction in hallucination", "Sub-200ms document recall", "Semantic cache integration"],
  },
  {
    id: "proj_5",
    title: "Microservices LLM Gateway",
    description: "High-throughput token streaming proxy with semantic caching, budget limits, and Prometheus observability.",
    technologies: ["Go", "Docker", "Redis", "Prometheus"],
    sources: ["github"],
    status: "confirmed",
    contribution: ["Backend Systems Architect"],
    contributionNote: "Built ultra-low latency token routing proxy supporting OpenAI, Anthropic, and local Ollama.",
    stars: 24,
    forks: 5,
    impactScore: 86,
    commitsCount: 65,
    codeSnippet: `func (g *Gateway) StreamHandler(c *gin.Context) {
  cached, hit := g.semanticCache.Get(c.Request.Context(), prompt)
  if hit {
    c.Data(200, "text/event-stream", cached)
    return
  }
  g.upstreamProxy.Stream(c.Writer, prompt)
}`,
    architecture: ["Gin Go Web Framework", "Redis Vector Semantic Cache", "Prometheus Metrics"],
    highlights: ["Handles 10,000 req/min", "99.9% uptime in stress tests", "35% API token cost savings"],
  },
  {
    id: "proj_6",
    title: "Neural Audio Denoising DSP",
    description: "Deep recurrent spectral mask estimator for ultra-low latency speech enhancement in noisy teleconferences.",
    technologies: ["Python", "PyTorch", "NumPy", "ONNX"],
    sources: ["github"],
    status: "confirmed",
    contribution: ["Audio DSP Researcher"],
    contributionNote: "Designed lightweight GRU spectral filtering pipeline compiled to ONNX Runtime.",
    stars: 15,
    forks: 3,
    impactScore: 82,
    commitsCount: 54,
    codeSnippet: `def stft_denoise_block(audio_waveform, onnx_session):
  specs = torch.stft(audio_waveform, n_fft=512, hop_length=128)
  mask = onnx_session.run(None, {"spec": specs.numpy()})[0]
  cleaned = specs * torch.from_numpy(mask)
  return torch.istft(cleaned, n_fft=512, hop_length=128)`,
    architecture: ["STFT Spectral Analyzer", "Bidirectional GRU Mask", "ONNX Mobile Runtime"],
    highlights: ["12dB SNR improvement", "4ms real-time audio chunking", "Quantized model < 3MB"],
  },
];

export function Screen10GitHubProjects({
  discoveredProjects = [],
  onProjectsChange,
  onNext,
  onBack,
  onJumpToStep,
  isGalleryMode = false,
}: Screen10GitHubProjectsProps) {
  const [projects, setProjects] = useState<ProjectEntry[]>(
    isGalleryMode ? defaultRichProjects : discoveredProjects
  );
  useEffect(() => {
    if (isGalleryMode) return;
    setProjects((current) => [...current, ...discoveredProjects.filter((incoming) => !current.some((existing) => existing.id === incoming.id || (incoming.url && existing.url === incoming.url)))]);
  }, [discoveredProjects, isGalleryMode]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    isGalleryMode ? defaultRichProjects[0].id : (discoveredProjects[0]?.id || "")
  );
  useEffect(() => {
    if (projects.length && !projects.some((project) => project.id === selectedProjectId)) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTechs, setNewTechs] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");

  const activeProject: ProjectEntry = projects.find((p) => p.id === selectedProjectId) || projects[0] || {
    id: "empty",
    title: "No project added yet",
    description: "Add a project or connect GitHub to review a repository.",
    technologies: [],
    sources: [],
    status: "candidate" as const,
    contribution: [],
    contributionNote: "",
  };

  const handleSelectProject = (proj: ProjectEntry) => {
    setSelectedProjectId(proj.id);
    setAnalysisMessage("");
    setAiConsent(false);
  };

  const updateProject = (id: string, patch: Partial<ProjectEntry>) => {
    const next = projects.map((project) => project.id === id ? { ...project, ...patch } : project);
    setProjects(next);
    onProjectsChange?.(next);
  };

  const handleAnalyzeProject = async () => {
    if (!activeProject.url || !aiConsent) return;
    const match = /^https:\/\/github\.com\/([^/]+)\/([^/?#]+)\/?$/i.exec(activeProject.url);
    if (!match) { setAnalysisMessage("A valid GitHub repository URL is required."); return; }
    setAnalysisBusy(true);
    setAnalysisMessage("");
    try {
      const response = await fetch("/api/student/projects/interpret", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName: `${match[1]}/${match[2]}`, aiConsent: true }),
      });
      const data = await response.json();
      if (!response.ok || !data.interpretation) throw new Error(data.error || data.meta?.error || "Interpretation unavailable.");
      const result = data.interpretation;
      updateProject(activeProject.id, {
        description: result.projectPurpose,
        aiPurpose: result.projectPurpose,
        technologies: Array.from(new Set([...(activeProject.technologies || []), ...result.detectedTechnologies])),
        uncertaintyNotes: result.uncertaintyNotes,
      });
      setAnalysisMessage("Repository interpretation is ready for your review. It does not verify your personal contribution.");
    } catch (error) {
      setAnalysisMessage(error instanceof Error ? error.message : "Interpretation unavailable.");
    } finally { setAnalysisBusy(false); }
  };

  const handleAddProject = () => {
    if (!newTitle.trim()) return;
    const parsedTechs = newTechs
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const newProj: ProjectEntry = {
      id: `proj_${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      technologies: parsedTechs,
      sources: ["manual"],
      status: "confirmed",
      contribution: [],
      contributionNote: "",
    };

    const next = [newProj, ...projects];
    setProjects(next);
    setSelectedProjectId(newProj.id);
    onProjectsChange?.(next);
    setNewTitle("");
    setNewDesc("");
    setNewTechs("");
    setShowAddModal(false);
  };

  return (
    <div
      className="exact-screen-wrapper"
      style={{
        background: "radial-gradient(ellipse at 80% 20%, rgba(2, 197, 245, 0.08) 0%, rgba(86, 66, 239, 0.05) 40%, #F9F8F5 75%)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: "absolute",
          top: "-5%",
          left: "10%",
          width: "550px",
          height: "550px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2, 197, 245, 0.08) 0%, rgba(86, 66, 239, 0.04) 50%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-5%",
          right: "10%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(147, 53, 232, 0.08) 0%, rgba(86, 66, 239, 0.03) 50%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      <ScreenHeader
        onBack={onBack}
        showBack={true}
        rightLabel="Step 9 of 10"
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
        {/* Header Row: Title, Subtitle, View All, Add Project */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#5642EF", background: "rgba(86, 66, 239, 0.08)", border: "1px solid rgba(86, 66, 239, 0.2)", padding: "4px 12px", borderRadius: 9999, marginBottom: 8 }}>
              <Sparkles size={12} />
              <span>Step 9 · Project Evidence Review</span>
            </div>
            <h1 style={{ fontSize: "clamp(26px, 3.2vw, 36px)", fontWeight: 850, color: "#171626", margin: "0 0 6px", letterSpacing: "-0.03em" }}>
              Your Project Evidence Ledger
            </h1>
            <p style={{ fontSize: 14.5, color: "#64748B", margin: 0 }}>
              Review each project&apos;s source, contribution and available evidence before confirming it.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              href="/student/projects"
              style={{ fontSize: 13, fontWeight: 700, color: "#5642EF", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span>View All Repos</span>
              <ExternalLink size={13} />
            </Link>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 18px",
                borderRadius: 9999,
                background: "linear-gradient(90deg, #5642EF, #7B2CBF)",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(86, 66, 239, 0.35)",
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <Plus size={15} /> Add Custom Project
            </button>
          </div>
        </div>

        {/* Two Columns: Left Projects Grid (6 cards) + Right Active Project Detail Showcase */}
        <div data-eora-id="eora-github-projects" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 24, alignItems: "start", marginBottom: 28 }}>
          
          {/* Left Grid: 2 Columns of Project Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {projects.map((proj) => {
              const isSelected = selectedProjectId === proj.id;

              return (
                <div
                  key={proj.id}
                  onClick={() => handleSelectProject(proj)}
                  style={{
                    background: "#FFFFFF",
                    border: isSelected ? "2px solid #5642EF" : "1px solid #E2E8F0",
                    borderRadius: 16,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: isSelected
                      ? "0 0 0 3px rgba(86, 66, 239, 0.2), 0 12px 28px rgba(86, 66, 239, 0.12)"
                      : "0 2px 8px rgba(0, 0, 0, 0.03)",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: isSelected ? "translateY(-2px)" : "translateY(0)",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#CBD5E1";
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.06)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#E2E8F0";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.03)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}
                >
                  {/* Selected Active Glow Ribbon */}
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: "linear-gradient(90deg, #02C5F5, #5642EF, #9335E8)",
                      }}
                    />
                  )}

                  {/* Card Header: Icon + Title + Status */}
                  <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: isSelected ? "linear-gradient(135deg, #5642EF, #7B2CBF)" : "#F1F5F9",
                          color: isSelected ? "#FFFFFF" : "#1E293B",
                          display: "grid",
                          placeItems: "center",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <Github size={15} />
                      </div>
                      <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1E293B" }}>
                        {proj.title}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isSelected && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: 9999,
                            background: "#EDE9FE",
                            color: "#5642EF",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Check size={11} /> Selected
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#F1F5F9",
                          color: "#64748B",
                        }}
                      >
                        {proj.sources.includes("github") ? "GitHub" : "Manual"}
                      </span>
                    </div>
                  </div>

                  {/* Code / Architecture Preview Banner */}
                  <div
                    style={{
                      height: 84,
                      margin: "0 14px",
                      borderRadius: 10,
                      background: isSelected
                        ? "linear-gradient(135deg, #0A0F24 0%, #151C38 100%)"
                        : "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
                      border: isSelected ? "1px solid rgba(86, 66, 239, 0.4)" : "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      color: "rgba(255, 255, 255, 0.8)",
                      fontSize: 11,
                      fontFamily: "monospace",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.6, fontSize: 9.5 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Code2 size={10} color="#02C5F5" /> {proj.url ? "Repository linked" : "No repository linked"}
                      </span>
                      <span>{proj.commitsCount == null ? "Commits unavailable" : `${proj.commitsCount} commits`}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {proj.codeSnippet ? proj.codeSnippet.split("\n")[0] : "Code preview unavailable"}
                    </div>
                  </div>

                  {/* Description & Techs */}
                  <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.45, margin: "0 0 10px", flex: 1 }}>
                      {proj.description}
                    </p>

                    {/* Tech chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                      {proj.technologies.slice(0, 3).map((t) => {
                        const name = typeof t === "string" ? t : (t as any)?.name || String(t);
                        return (
                          <span
                            key={name}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: isSelected ? "#EDE9FE" : "#EFF6FF",
                              color: isSelected ? "#5642EF" : "#2563EB",
                            }}
                          >
                            {name}
                          </span>
                        );
                      })}
                    </div>

                    {/* Footer Metrics Row: Stars, Forks, AI Impact */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#64748B" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <Star size={12} color="#F59E0B" fill="#F59E0B" /> {proj.stars ?? "—"}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <GitFork size={12} /> {proj.forks ?? "—"}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: isSelected ? "linear-gradient(90deg, #5642EF, #7B2CBF)" : "#F4F1FF",
                          color: isSelected ? "#FFFFFF" : "#5642EF",
                        }}
                      >
                        {proj.impactScore == null ? "Not assessed" : `AI Impact ${proj.impactScore}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Deep Telemetry & Code Inspector Card */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              border: "1px solid rgba(226, 232, 240, 0.9)",
              boxShadow: "0 12px 36px -6px rgba(86, 66, 239, 0.08), 0 2px 12px rgba(0, 0, 0, 0.03)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              position: "sticky",
              top: 20,
            }}
          >
            {/* Top Identity Header */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#5642EF",
                    background: "#EDE9FE",
                    padding: "3px 9px",
                    borderRadius: 6,
                  }}
                >
                  Project Review
                </span>

                <span style={{ fontSize: 13, fontWeight: 800, color: "#10B981", display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={15} /> {isGalleryMode ? "Demo codebase" : activeProject.status === "confirmed" ? "Student confirmed" : "Needs review"}
                </span>
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 850, color: "#171626", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                {activeProject.title}
              </h2>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.45, margin: 0 }}>
                {activeProject.description}
              </p>
              {!isGalleryMode && activeProject.id !== "empty" && <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {activeProject.url && <a href={activeProject.url} target="_blank" rel="noopener noreferrer" style={{ color: "#5642EF", fontSize: 12 }}>Open repository</a>}
                {activeProject.sources.includes("github") && <>
                  <label style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12, color: "#475569" }}><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /> I agree to send this repository&apos;s README and metadata to an approved AI provider for interpretation.</label>
                  <button type="button" disabled={!aiConsent || analysisBusy || !activeProject.url} onClick={handleAnalyzeProject} style={{ border: 0, borderRadius: 8, background: "#5642EF", color: "white", padding: "8px 10px", cursor: "pointer" }}>{analysisBusy ? "Interpreting..." : "Interpret repository"}</button>
                </>}
                {analysisMessage && <span style={{ color: "#475569", fontSize: 12 }}>{analysisMessage}</span>}
                {activeProject.uncertaintyNotes?.length ? <div style={{ fontSize: 12, color: "#92400E" }}>Uncertain: {activeProject.uncertaintyNotes.join("; ")}</div> : null}
                <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>What did you personally work on?<textarea value={activeProject.contributionNote} onChange={(event) => updateProject(activeProject.id, { contributionNote: event.target.value })} rows={3} style={{ display: "block", width: "100%", marginTop: 5, border: "1px solid #CBD5E1", borderRadius: 7, padding: 7 }} /></label>
                {activeProject.status === "candidate" && <div style={{ display: "flex", gap: 8 }}><button type="button" disabled={activeProject.sources.includes("github") && !activeProject.contributionNote.trim()} onClick={() => updateProject(activeProject.id, { status: "confirmed" })} style={{ background: "#059669", color: "white", border: 0, borderRadius: 7, padding: "7px 12px" }}>Confirm project</button><button type="button" onClick={() => updateProject(activeProject.id, { status: "removed" })} style={{ border: "1px solid #CBD5E1", borderRadius: 7, padding: "7px 12px" }}>Reject</button></div>}
              </div>}
            </div>

            {/* AI Impact Breakdown Radar */}
            <div style={{ background: "#F8FAFC", borderRadius: 14, border: "1px solid #E2E8F0", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {isGalleryMode ? "Demo score" : "Assessment"}
                </span>
                <span style={{ fontSize: 16, fontWeight: 850, color: "#5642EF" }}>
                  {activeProject.impactScore == null ? "Not assessed" : `${activeProject.impactScore} / 100`}
                </span>
              </div>

              {isGalleryMode && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, textAlign: "center" }}>
                <div style={{ background: "#FFFFFF", padding: "8px 4px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981" }}>96%</div>
                  <div style={{ fontSize: 9.5, color: "#64748B", fontWeight: 600 }}>Code Quality</div>
                </div>
                <div style={{ background: "#FFFFFF", padding: "8px 4px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#5642EF" }}>92%</div>
                  <div style={{ fontSize: 9.5, color: "#64748B", fontWeight: 600 }}>Architecture</div>
                </div>
                <div style={{ background: "#FFFFFF", padding: "8px 4px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0284C7" }}>88%</div>
                  <div style={{ fontSize: 9.5, color: "#64748B", fontWeight: 600 }}>Testing</div>
                </div>
              </div>}
            </div>

            {/* Code Snippet Viewer */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 5 }}>
                <Code2 size={13} color="#5642EF" /> Code preview
              </div>
              <pre
                style={{
                  background: "#0F172A",
                  color: "#E2E8F0",
                  borderRadius: 10,
                  padding: "12px",
                  fontSize: 11,
                  fontFamily: "monospace",
                  lineHeight: 1.45,
                  overflowX: "auto",
                  margin: 0,
                  border: "1px solid #1E293B",
                  maxHeight: 140,
                }}
              >
                <code>{activeProject.codeSnippet || "No code preview available."}</code>
              </pre>
            </div>

            {/* Architecture Layers */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 5 }}>
                <Layers size={13} color="#0284C7" /> Documented architecture
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(activeProject.architecture || []).map((arch, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155" }}>
                    <Cpu size={13} color="#5642EF" style={{ flexShrink: 0 }} />
                    <span>{arch}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verified Highlights */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 5 }}>
                <GitCommit size={13} color="#10B981" /> Documented highlights
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(activeProject.highlights || []).map((hl, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155" }}>
                    <CheckCircle2 size={13} color="#10B981" style={{ flexShrink: 0 }} />
                    <span>{hl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal for Adding Manual Project */}
        {showAddModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
              zIndex: 9999,
              display: "grid",
              placeItems: "center",
              padding: 20,
            }}
            onClick={() => setShowAddModal(false)}
          >
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 20,
                maxWidth: 520,
                width: "100%",
                padding: 28,
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                border: "1px solid #E2E8F0",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h3 style={{ fontSize: 18, fontWeight: 850, color: "#1E1B4B", margin: 0 }}>
                  Add Verified Project
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>
                    Project Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LLM Autonomous Code Assistant"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    style={{ width: "100%", height: 42, padding: "0 14px", borderRadius: 10, border: "1px solid #D1D5DB", fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>
                    Description & Methodology
                  </label>
                  <textarea
                    placeholder="Brief description of your model architecture, dataset, and results"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    style={{ width: "100%", height: 80, padding: "10px 14px", borderRadius: 10, border: "1px solid #D1D5DB", fontSize: 13.5, resize: "none" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>
                    Technologies & Frameworks (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="Python, PyTorch, FastAPI, Docker"
                    value={newTechs}
                    onChange={(e) => setNewTechs(e.target.value)}
                    style={{ width: "100%", height: 42, padding: "0 14px", borderRadius: 10, border: "1px solid #D1D5DB", fontSize: 13.5 }}
                  />
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#FFF", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddProject}
                    style={{ padding: "10px 22px", borderRadius: 10, background: "linear-gradient(90deg, #5642EF, #7B2CBF)", color: "#FFF", border: "none", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(86,66,239,0.3)" }}
                  >
                    Save to Evidence Ledger
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <ScreenFooter
          onBack={onBack}
          onNext={onNext}
          onJumpToStep={onJumpToStep}
          activeStep={9}
          totalSteps={10}
          nextLabel="Next"
        />
      </main>
    </div>
  );
}
