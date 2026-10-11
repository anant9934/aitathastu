"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Sparkles, Zap, ShieldCheck, Layers, ArrowUpRight, Cpu } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";
import { candidateNames } from "@/lib/onboarding-import-candidates";

interface Screen9SkillsMapProps {
  skills?: string[];
  suggestedSkills?: string[];
  isGalleryMode?: boolean;
  goal?: string;
  onNext: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

interface SkillNode {
  id: string;
  label: string;
  category: "Core" | "Specialized" | "Tooling" | "Theoretical";
  color: string;
  glowColor: string;
  // Canvas coordinate percentages (0-100 range)
  cx: number;
  cy: number;
  radius: number;
  level: "Expert" | "Advanced" | "Proficient" | "Emerging";
  confidence: number;
  evidence: string[];
  techs: string[];
  description: string;
  metrics: {
    githubCommits: number;
    benchmarkPercentile: number;
    courseCredentials: number;
  };
}

const skillNodes: SkillNode[] = [
  {
    id: "deep_learning",
    label: "Deep Learning",
    category: "Core",
    color: "linear-gradient(135deg, #7C3AED, #A855F7)",
    glowColor: "rgba(168, 85, 247, 0.45)",
    cx: 50,
    cy: 22,
    radius: 46,
    level: "Expert",
    confidence: 94,
    description: "Multi-layered neural architectures, backpropagation optimization, and deep representation learning.",
    evidence: ["CV (14 verified citations)", "6 GitHub repositories", "3 IEEE/ArXiv publications", "4 End-to-end projects"],
    techs: ["PyTorch", "TensorFlow", "scikit-learn", "XGBoost", "TorchVision"],
    metrics: { githubCommits: 142, benchmarkPercentile: 96, courseCredentials: 4 },
  },
  {
    id: "llms",
    label: "LLMs & GenAI",
    category: "Specialized",
    color: "linear-gradient(135deg, #0284C7, #06B6D4)",
    glowColor: "rgba(6, 182, 212, 0.45)",
    cx: 78,
    cy: 32,
    radius: 42,
    level: "Advanced",
    confidence: 89,
    description: "Transformer models, PEFT/LoRA fine-tuning, RAG pipelines, and prompt orchestration frameworks.",
    evidence: ["4 GitHub GenAI repositories", "RAG vector pipeline codebase", "CV verified coursework", "HuggingFace space"],
    techs: ["LangChain", "OpenAI API", "HuggingFace", "Transformers", "FAISS", "ChromaDB"],
    metrics: { githubCommits: 89, benchmarkPercentile: 91, courseCredentials: 3 },
  },
  {
    id: "nlp",
    label: "NLP",
    category: "Specialized",
    color: "linear-gradient(135deg, #2563EB, #38BDF8)",
    glowColor: "rgba(56, 189, 248, 0.4)",
    cx: 84,
    cy: 64,
    radius: 38,
    level: "Advanced",
    confidence: 86,
    description: "Statistical linguistics, token embeddings, sequence classification, and contextual embeddings.",
    evidence: ["3 NLP production projects", "BERT & RoBERTa fine-tuning repo", "Verified Kaggle competition"],
    techs: ["spaCy", "NLTK", "Tokenizers", "BERT", "Word2Vec"],
    metrics: { githubCommits: 64, benchmarkPercentile: 87, courseCredentials: 2 },
  },
  {
    id: "research",
    label: "AI Research",
    category: "Theoretical",
    color: "linear-gradient(135deg, #059669, #10B981)",
    glowColor: "rgba(16, 185, 129, 0.4)",
    cx: 66,
    cy: 82,
    radius: 39,
    level: "Proficient",
    confidence: 84,
    description: "Empirical methodology, ablation studies, reproducible benchmarking, and scientific writing.",
    evidence: ["Google Scholar indexed", "Conference workshop preprint", "ArXiv research summary", "Peer review co-author"],
    techs: ["LaTeX", "Zotero", "Weights & Biases", "Overleaf", "ArXiv API"],
    metrics: { githubCommits: 48, benchmarkPercentile: 88, courseCredentials: 2 },
  },
  {
    id: "cv",
    label: "Computer Vision",
    category: "Specialized",
    color: "linear-gradient(135deg, #D97706, #F59E0B)",
    glowColor: "rgba(245, 158, 11, 0.4)",
    cx: 24,
    cy: 76,
    radius: 40,
    level: "Proficient",
    confidence: 82,
    description: "Convolutional spatial feature extraction, YOLO object detection, segmentation, and tracking.",
    evidence: ["YOLOv8 real-time detection repo", "OpenCV image segmentation project", "Robotics camera perception pipeline"],
    techs: ["OpenCV", "YOLOv8", "TorchVision", "Albumentations", "MediaPipe"],
    metrics: { githubCommits: 76, benchmarkPercentile: 83, courseCredentials: 3 },
  },
  {
    id: "python",
    label: "Python",
    category: "Core",
    color: "linear-gradient(135deg, #4F46E5, #6366F1)",
    glowColor: "rgba(99, 102, 241, 0.45)",
    cx: 18,
    cy: 38,
    radius: 44,
    level: "Expert",
    confidence: 97,
    description: "Idiomatic Python 3, asynchronous event loops, vectorized scientific compute, and production microservices.",
    evidence: ["16 GitHub repositories", "LeetCode (Python3 300+ solved)", "Production API commits", "HackerRank Gold 5-star"],
    techs: ["Python 3.12", "FastAPI", "NumPy", "AsyncIO", "Pydantic", "Poetry"],
    metrics: { githubCommits: 310, benchmarkPercentile: 98, courseCredentials: 5 },
  },
  {
    id: "mlops",
    label: "MLOps",
    category: "Tooling",
    color: "linear-gradient(135deg, #DB2777, #EC4899)",
    glowColor: "rgba(236, 72, 153, 0.4)",
    cx: 34,
    cy: 88,
    radius: 36,
    level: "Proficient",
    confidence: 79,
    description: "Model containerization, continuous integration, registry tracking, and artifact monitoring.",
    evidence: ["Dockerized model containers", "GitHub Actions CI/CD workflows", "MLflow experiment tracking repository"],
    techs: ["Docker", "MLflow", "GitHub Actions", "FastAPI", "Prometheus", "MinIO"],
    metrics: { githubCommits: 52, benchmarkPercentile: 79, courseCredentials: 2 },
  },
  {
    id: "data_analytics",
    label: "Data Analytics",
    category: "Core",
    color: "linear-gradient(135deg, #0D9488, #14B8A6)",
    glowColor: "rgba(20, 184, 166, 0.4)",
    cx: 26,
    cy: 16,
    radius: 41,
    level: "Advanced",
    confidence: 90,
    description: "Exploratory data analysis, hypothesis testing, relational schema querying, and data visualization.",
    evidence: ["Kaggle datasets", "EDA Jupyter notebooks", "Statistical modeling repo", "CodeChef Data Track"],
    techs: ["Pandas", "Polars", "Seaborn", "PostgreSQL", "DuckDB", "SciPy"],
    metrics: { githubCommits: 118, benchmarkPercentile: 92, courseCredentials: 4 },
  },
];

function classifyReviewSkill(skill: string): SkillNode["category"] {
  if (/math|statistic|probability|linear algebra|calculus/i.test(skill)) return "Theoretical";
  if (/python|typescript|javascript|sql|git|docker|kubernetes|aws|azure|gcp|linux|pytorch|tensorflow|scikit|pandas|numpy|fastapi/i.test(skill)) return "Tooling";
  if (/nlp|language model|llm|genai|generative|rag|vision|transformer|agent|deep learning/i.test(skill)) return "Specialized";
  return "Core";
}

export function Screen9SkillsMap({ skills = [], suggestedSkills = [], isGalleryMode = false, onNext, onBack, onJumpToStep }: Screen9SkillsMapProps) {
  const safeSkills = candidateNames(skills);
  const safeSuggested = candidateNames(suggestedSkills);
  const confirmed = new Set(safeSkills.map((skill) => skill.toLowerCase()));
  const allSkills = [...safeSkills, ...safeSuggested.filter((skill) => !confirmed.has(skill.toLowerCase()))];
  const allNodes: SkillNode[] = isGalleryMode ? skillNodes : allSkills.map((skill, index) => ({
    ...skillNodes[index % skillNodes.length],
    id: `recorded_${index}`,
    label: skill,
    category: classifyReviewSkill(skill),
    level: "Emerging",
    confidence: 0,
    evidence: [confirmed.has(skill.toLowerCase()) ? "Reviewed CV or student-confirmed skill; verification pending" : "Detected in linked project metadata; personal use needs review"],
    techs: [],
    description: confirmed.has(skill.toLowerCase()) ? `${skill} is recorded in your profile. Add project evidence to show how you used it.` : `${skill} was detected in an imported project. Review your contribution before claiming proficiency.`,
    metrics: { githubCommits: 0, benchmarkPercentile: 0, courseCredentials: 0 },
  }));
  const displayNodes = allNodes.slice(0, 8);
  const [selectedNode, setSelectedNode] = useState<SkillNode>(allNodes[0] || {
    ...skillNodes[0], id: "empty", label: "No skills recorded", confidence: 0,
    evidence: [], techs: [], description: "Add or confirm a skill to begin your map.",
    metrics: { githubCommits: 0, benchmarkPercentile: 0, courseCredentials: 0 },
  });
  useEffect(() => {
    if (allNodes.length && !allNodes.some((node) => node.label === selectedNode.label)) setSelectedNode(allNodes[0]);
  }, [allNodes, selectedNode.label]);
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const categories = ["All", "Core", "Specialized", "Tooling", "Theoretical"];

  const filteredNodes = activeFilter === "All"
    ? displayNodes
    : displayNodes.filter((n) => n.category === activeFilter);
  const filteredList = activeFilter === "All" ? allNodes : allNodes.filter((n) => n.category === activeFilter);

  return (
    <div
      className="exact-screen-wrapper"
      style={{
        background: "radial-gradient(ellipse at 70% 20%, rgba(2, 197, 245, 0.08) 0%, rgba(89, 66, 220, 0.05) 40%, #F9F8F5 75%)",
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
          top: "-5%",
          right: "5%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.09) 0%, rgba(56, 189, 248, 0.04) 50%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-5%",
          left: "5%",
          width: "550px",
          height: "550px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2, 197, 245, 0.08) 0%, rgba(99, 102, 241, 0.04) 50%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      <ScreenHeader
        onBack={onBack}
        showBack={true}
        rightLabel="Skills map"
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
        {/* Top Header Row with Category Filters */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#5642EF", background: "rgba(86, 66, 239, 0.08)", border: "1px solid rgba(86, 66, 239, 0.2)", padding: "4px 12px", borderRadius: 9999, marginBottom: 8 }}>
              <Sparkles size={12} />
              <span>Skills Intelligence Map</span>
            </div>
            <h1 style={{ fontSize: "clamp(26px, 3vw, 36px)", fontWeight: 850, color: "#171626", margin: "0 0 6px", letterSpacing: "-0.03em" }}>
              Your Skills & Evidence Network
            </h1>
            <p style={{ fontSize: 14.5, color: "#64748B", margin: 0 }}>
              {isGalleryMode ? "Interactive knowledge constellation for design preview." : "Reviewed CV skills and skills suggested by linked projects. Evidence and proficiency need separate review."}
            </p>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", padding: "4px 6px", borderRadius: 9999, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            {categories.map((cat) => {
              const isCatActive = activeFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFilter(cat)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: isCatActive ? "linear-gradient(90deg, #5642EF, #7B2CBF)" : "transparent",
                    color: isCatActive ? "#FFFFFF" : "#64748B",
                    boxShadow: isCatActive ? "0 2px 8px rgba(86, 66, 239, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Two Main Regions: Left Map + Right Details Panel */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 24, alignItems: "stretch", marginBottom: 28, minHeight: 540 }}>
          
          {/* Left Region: Spacious, Modern Constellation Canvas */}
          <div
            data-eora-id="eora-skills-map"
            style={{
              position: "relative",
              minHeight: 540,
              background: "#FFFFFF",
              borderRadius: 24,
              border: "1px solid rgba(226, 232, 240, 0.9)",
              boxShadow: "0 12px 36px -6px rgba(86, 66, 239, 0.08), 0 2px 12px rgba(0, 0, 0, 0.03)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Radar / Constellation Grid Rings */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              <defs>
                <radialGradient id="radarGrid" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#5642EF" stopOpacity="0.04" />
                  <stop offset="60%" stopColor="#02C5F5" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <linearGradient id="activeLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5642EF" />
                  <stop offset="100%" stopColor="#02C5F5" />
                </linearGradient>
              </defs>

              {/* Concentric radar circles */}
              <circle cx="50%" cy="50%" r="90" fill="none" stroke="#EEF2F6" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx="50%" cy="50%" r="170" fill="none" stroke="#F1F5F9" strokeWidth="1.5" strokeDasharray="4 4" />
              <circle cx="50%" cy="50%" r="240" fill="none" stroke="#F8FAFC" strokeWidth="1.5" />

              {/* Connecting constellation lines */}
              {displayNodes.map((node) => {
                const isSelected = selectedNode.id === node.id;
                return (
                  <g key={node.id}>
                    <line
                      x1="50%"
                      y1="50%"
                      x2={`${node.cx}%`}
                      y2={`${node.cy}%`}
                      stroke={isSelected ? "url(#activeLineGrad)" : "#E2E8F0"}
                      strokeWidth={isSelected ? "2.5" : "1.2"}
                      strokeDasharray={isSelected ? "none" : "4 4"}
                      opacity={isSelected ? 1 : 0.75}
                    />
                    {isSelected && (
                      <circle
                        cx={`${node.cx}%`}
                        cy={`${node.cy}%`}
                        r={node.radius + 6}
                        fill="none"
                        stroke="#5642EF"
                        strokeWidth="2"
                        opacity="0.4"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Central Anchor Node: GenAI / ML Core Engine */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 106,
                height: 106,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #02C5F5 0%, #4564FF 50%, #9335E8 100%)",
                color: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 850,
                textAlign: "center",
                lineHeight: 1.15,
                boxShadow: "0 0 35px rgba(69, 100, 255, 0.4), 0 0 0 8px rgba(2, 197, 245, 0.12)",
                zIndex: 10,
                padding: 6,
                cursor: "default",
              }}
            >
              <Cpu size={16} style={{ marginBottom: 2 }} />
              <span>{isGalleryMode ? "GenAI / ML" : "Your Skills"}</span>
              <span style={{ fontSize: 9.5, opacity: 0.9, fontWeight: 700, letterSpacing: "0.02em" }}>
                Profile Map
              </span>
            </div>

            {/* Orbiting Interactive Skill Nodes across the Full Canvas */}
            {filteredNodes.map((node) => {
              const isSelected = selectedNode.id === node.id;
              const diameter = node.radius * 2;

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNode(node)}
                  style={{
                    position: "absolute",
                    top: `${node.cy}%`,
                    left: `${node.cx}%`,
                    transform: isSelected ? "translate(-50%, -50%) scale(1.08)" : "translate(-50%, -50%)",
                    width: diameter,
                    height: diameter,
                    borderRadius: "50%",
                    background: node.color,
                    color: "#FFFFFF",
                    border: isSelected ? "3px solid #FFFFFF" : "2px solid rgba(255,255,255,0.7)",
                    boxShadow: isSelected
                      ? `0 0 0 4px #5642EF, 0 12px 28px ${node.glowColor}`
                      : `0 4px 16px rgba(0,0,0,0.12), 0 0 12px ${node.glowColor}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 750,
                    textAlign: "center",
                    cursor: "pointer",
                    padding: 6,
                    lineHeight: 1.15,
                    zIndex: isSelected ? 25 : 8,
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.1)";
                      e.currentTarget.style.zIndex = "24";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)";
                      e.currentTarget.style.zIndex = "8";
                    }
                  }}
                >
                  <span style={{ maxWidth: diameter - 12, wordBreak: "break-word" }}>{node.label}</span>
                  {isGalleryMode && <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      background: "rgba(0, 0, 0, 0.25)",
                      padding: "1px 6px",
                      borderRadius: 9999,
                      marginTop: 3,
                    }}
                  >
                    {node.confidence}%
                  </span>}
                </button>
              );
            })}

            {/* Bottom Canvas Legend */}
            {isGalleryMode && <div
              style={{
                position: "absolute",
                bottom: 16,
                left: 20,
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(8px)",
                padding: "6px 14px",
                borderRadius: 9999,
                border: "1px solid #E2E8F0",
                fontSize: 11,
                color: "#64748B",
                fontWeight: 600,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED" }} />
                <span>Expert (90%+)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0284C7" }} />
                <span>Advanced (85-89%)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#D97706" }} />
                <span>Proficient (80-84%)</span>
              </div>
            </div>}
          </div>

          {/* Right Region: Evidence Detail & Knowledge Card */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 24,
              border: "1px solid rgba(226, 232, 240, 0.9)",
              boxShadow: "0 12px 36px -6px rgba(86, 66, 239, 0.08), 0 2px 12px rgba(0, 0, 0, 0.03)",
              padding: "26px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              {/* Header Badge */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#5642EF",
                      background: "#EDE9FE",
                      padding: "4px 10px",
                      borderRadius: 6,
                    }}
                  >
                    {isGalleryMode ? `${selectedNode.level} Level` : confirmed.has(selectedNode.label.toLowerCase()) ? "Reviewed skill" : "Suggested skill"}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#475569",
                      background: "#F1F5F9",
                      padding: "4px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {selectedNode.category}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 800, color: "#10B981" }}>
                  <ShieldCheck size={16} />
                  <span>{isGalleryMode ? `${selectedNode.confidence}% Grounded` : "Review pending"}</span>
                </div>
              </div>

              {/* Title & Description */}
              <h2 style={{ fontSize: 22, fontWeight: 850, color: "#171626", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                {selectedNode.label}
              </h2>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.45, margin: "0 0 18px" }}>
                {selectedNode.description}
              </p>

              {/* Metric Highlights */}
              {isGalleryMode && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: 12, background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0", marginBottom: 18 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 850, color: "#5642EF" }}>{selectedNode.metrics.githubCommits}+</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>Commits</div>
                </div>
                <div style={{ textAlign: "center", borderLeft: "1px solid #E2E8F0", borderRight: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 16, fontWeight: 850, color: "#10B981" }}>{selectedNode.metrics.benchmarkPercentile}th</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>Percentile</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 850, color: "#0284C7" }}>{selectedNode.metrics.courseCredentials}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>Certificates</div>
                </div>
              </div>}

              {/* Evidence Sources */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 5 }}>
                  <Layers size={13} color="#5642EF" /> Evidence Sources
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedNode.evidence.map((ev, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#334155" }}>
                      <CheckCircle2 size={14} color="#10B981" style={{ flexShrink: 0 }} />
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detected Toolchain */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 5 }}>
                  <Zap size={13} color="#F59E0B" /> Technologies & Frameworks
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedNode.techs.map((tc) => (
                    <span
                      key={tc}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 9px",
                        borderRadius: 6,
                        background: "#F1F5F9",
                        color: "#334155",
                        border: "1px solid #CBD5E1",
                      }}
                    >
                      {tc}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Recommendation Tip */}
            <div
              style={{
                marginTop: 18,
                padding: "10px 14px",
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(86,66,239,0.06), rgba(2,197,245,0.06))",
                border: "1px solid rgba(86,66,239,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
                color: "#1E1B4B",
              }}
            >
              <span style={{ fontWeight: 600 }}>{isGalleryMode ? "Recommended project next step is ready" : "Add evidence to support a recorded skill"}</span>
              <ArrowUpRight size={14} color="#5642EF" />
            </div>
          </div>
        </div>

        {!isGalleryMode && filteredList.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }} aria-label="All extracted and suggested skills">
          {filteredList.map((node) => <button key={node.id} type="button" onClick={() => setSelectedNode(node)}
            style={{ border: selectedNode.id === node.id ? "1px solid #5642EF" : "1px solid #CBD5E1", borderRadius: 999, padding: "6px 11px", background: selectedNode.id === node.id ? "#EDE9FE" : "#FFFFFF", color: "#334155", cursor: "pointer", fontSize: 12 }}>
            {node.label}{confirmed.has(node.label.toLowerCase()) ? " · reviewed" : " · suggested"}
          </button>)}
        </div>}

        {/* Footer Navigation */}
        <ScreenFooter
          onBack={onBack}
          onNext={onNext}
          onJumpToStep={onJumpToStep}
          activeStep={8}
          totalSteps={10}
          nextLabel="Next"
        />
      </main>
    </div>
  );
}
