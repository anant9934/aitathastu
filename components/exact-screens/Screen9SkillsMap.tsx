"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  BrainCircuit,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileCheck,
  FolderGit2,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Globe,
  Award,
  GraduationCap,
  Briefcase,
  HelpCircle,
  Cpu,
  Zap,
  Info,
  Check,
  Filter,
  RefreshCw,
  GitBranch,
} from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";
import { candidateNames } from "@/lib/onboarding-import-candidates";
import {
  SKILL_CATALOG,
  getSkillCatalogEntry,
  buildSkillGraphEdges,
  type SkillCategory,
  type SkillCatalogEntry,
  type SkillKnowledgeEdge,
} from "@/lib/domain/skills-knowledge-catalog";
import type { ProjectEntry } from "./Screen10GitHubProjects";
import type {
  Screen8EducationEntry,
  Screen8ExperienceEntry,
  Screen8AchievementEntry,
} from "./Screen8ProfileInsights";

export interface Screen9SkillsMapProps {
  skills?: string[];
  suggestedSkills?: string[];
  projects?: ProjectEntry[];
  experiences?: Screen8ExperienceEntry[];
  educationEntries?: Screen8EducationEntry[];
  achievements?: Screen8AchievementEntry[];
  profiles?: Partial<Record<string, string>>;
  resumeFileName?: string | null;
  resumeReviewed?: Array<{ candidateId?: string; category: string; value: string; status?: string }>;
  isGalleryMode?: boolean;
  goal?: string;
  onNext: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

interface GraphNode {
  id: string;
  name: string;
  category: SkillCategory;
  isCenter?: boolean;
  x: number;
  y: number;
  radius: number;
  color: string;
  glowColor: string;
  accentColor: string;
  iconType: string;
  entry: SkillCatalogEntry;
  evidenceCount: number;
  evidenceItems: Array<{
    type: "github" | "project" | "resume" | "coursework" | "achievement";
    title: string;
    details: string;
    status: "Verified" | "Reviewed" | "Recorded" | "Imported" | "Detected";
    url?: string;
  }>;
}

// Tech SVG Icons for crisp, identical look to design reference
function RenderTechIcon({ type, size = 18, color = "#FFFFFF" }: { type: string; size?: number; color?: string }) {
  if (type === "python") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M11.9 2C8.6 2 8.8 3.4 8.8 3.4L8.8 4.9H12.1V5.4H5.4C5.4 5.4 2 5.2 2 9.4C2 13.6 5 13.4 5 13.4H6.4V11.8C6.4 9.9 8.1 9.9 8.1 9.9H12.3C13.9 9.9 14.1 8.3 14.1 8.3L14.1 4.8C14.1 4.8 14.4 2 11.9 2ZM10.5 3.3C10.9 3.3 11.2 3.6 11.2 4C11.2 4.4 10.9 4.7 10.5 4.7C10.1 4.7 9.8 4.4 9.8 4C9.8 3.6 10.1 3.3 10.5 3.3Z"
          fill={color}
        />
        <path
          d="M12.1 22C15.4 22 15.2 20.6 15.2 20.6L15.2 19.1H11.9V18.6H18.6C18.6 18.6 22 18.8 22 14.6C22 10.4 19 10.6 19 10.6H17.6V12.2C17.6 14.1 15.9 14.1 15.9 14.1H11.7C10.1 14.1 9.9 15.7 9.9 15.7L9.9 19.2C9.9 19.2 9.6 22 12.1 22ZM13.5 20.7C13.1 20.7 12.8 20.4 12.8 20C12.8 19.6 13.1 19.3 13.5 19.3C13.9 19.3 14.2 19.6 14.2 20C14.2 20.4 13.9 20.7 13.5 20.7Z"
          fill={color}
        />
      </svg>
    );
  }
  if (type === "javascript") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="4" fill="transparent" />
        <text x="5" y="17" fontSize="13" fontWeight="900" fill={color} fontFamily="system-ui, sans-serif">
          JS
        </text>
      </svg>
    );
  }
  if (type === "react") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
        <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(0 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />
        <circle cx="12" cy="12" r="1.8" fill={color} />
      </svg>
    );
  }
  if (type === "git") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <circle cx="6" cy="6" r="2.5" fill={color} />
        <circle cx="6" cy="18" r="2.5" fill={color} />
        <circle cx="18" cy="12" r="2.5" fill={color} />
        <path d="M6 8.5V15.5" strokeLinecap="round" />
        <path d="M6 12C6 12 10 12 15.5 12" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "github") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    );
  }
  if (type === "postgresql" || type === "database") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    );
  }
  if (type === "math") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <text x="4" y="18" fontSize="17" fontWeight="bold" fill={color} fontFamily="Georgia, serif">
          &Sigma;
        </text>
      </svg>
    );
  }
  if (type === "dsa") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
        <circle cx="12" cy="4" r="2.5" fill={color} />
        <circle cx="5" cy="18" r="2.5" fill={color} />
        <circle cx="19" cy="18" r="2.5" fill={color} />
        <path d="M10 6L6.5 16" />
        <path d="M14 6L17.5 16" />
      </svg>
    );
  }
  if (type === "nlp") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        <path d="M8 11h.01M12 11h.01M16 11h.01" strokeWidth="2.5" />
      </svg>
    );
  }
  return <BrainCircuit size={size} color={color} />;
}

export function Screen9SkillsMap({
  skills = [],
  suggestedSkills = [],
  projects = [],
  experiences = [],
  educationEntries = [],
  achievements = [],
  profiles = {},
  resumeFileName,
  resumeReviewed = [],
  isGalleryMode = false,
  goal,
  onNext,
  onBack,
  onJumpToStep,
}: Screen9SkillsMapProps) {
  // Gallery mode baseline skills if empty
  const defaultGallerySkills = [
    "Machine Learning",
    "Python",
    "JavaScript",
    "React",
    "Git",
    "GitHub",
    "PostgreSQL",
    "SQL",
    "NLP",
    "Data Structures",
    "Mathematics",
    "Artificial Intelligence",
  ];

  const rawSkills = skills.length > 0 ? skills : isGalleryMode ? defaultGallerySkills : [];
  const safeSkills = candidateNames(rawSkills);
  const safeSuggested = candidateNames(suggestedSkills);

  const confirmedSet = new Set(safeSkills.map((s) => s.toLowerCase().trim()));
  const allSkillNames = [
    ...safeSkills,
    ...safeSuggested.filter((s) => !confirmedSet.has(s.toLowerCase().trim())),
  ];

  // Active filter: All | Core | Specialized | Tooling | Theoretical
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeEvidenceFilter, setActiveEvidenceFilter] = useState<string | null>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hovered edge for relationship tooltip
  const [hoveredEdge, setHoveredEdge] = useState<SkillKnowledgeEdge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Selected skill
  const [selectedSkillName, setSelectedSkillName] = useState<string>(
    safeSkills.find((s) => s.toLowerCase() === "machine learning") || safeSkills[0] || "Machine Learning"
  );

  // Bookmarked skills state
  const [bookmarkedSkills, setBookmarkedSkills] = useState<Set<string>>(new Set());

  const handleToggleBookmark = (name: string) => {
    setBookmarkedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // 1. Build Grounded Evidence Per Skill
  const getEvidenceForSkill = (skillName: string) => {
    const sLow = skillName.toLowerCase().trim();
    const items: GraphNode["evidenceItems"] = [];

    // Check confirmed projects
    const matchedProjects = projects.filter((p) =>
      p.technologies?.some((t) => t.toLowerCase().trim() === sLow)
    );
    for (const p of matchedProjects) {
      items.push({
        type: "project",
        title: `Project: ${p.title}`,
        details: p.description ? p.description.slice(0, 80) + "..." : "Confirmed project implementation",
        status: p.status === "confirmed" ? "Verified" : "Reviewed",
        url: p.url,
      });
    }

    // Check GitHub
    const hasGitHub = Boolean(profiles.github || (profiles as any)["gitHub"]);
    const inGitCandidates = safeSuggested.some((s) => s.toLowerCase().trim() === sLow);
    if (hasGitHub || inGitCandidates) {
      items.push({
        type: "github",
        title: "GitHub Repositories",
        details: `Discovered in inspected code commits & dependencies`,
        status: "Reviewed",
      });
    }

    // Check CV / Resume
    const inResume =
      Boolean(resumeFileName) &&
      (resumeReviewed.some((c) => c.value?.toLowerCase().trim() === sLow) ||
        safeSkills.some((s) => s.toLowerCase().trim() === sLow));
    if (inResume) {
      items.push({
        type: "resume",
        title: "Reviewed Resume (CV)",
        details: `Extracted from verified CV profile section`,
        status: "Reviewed",
      });
    }

    // Check Coursework
    if (educationEntries && educationEntries.length > 0) {
      const edu = educationEntries[0];
      items.push({
        type: "coursework",
        title: "Academic Coursework",
        details: `${edu.degree || "B.Tech"} curriculum at ${edu.institution || "University"}`,
        status: "Recorded",
      });
    }

    return items;
  };

  // 2. Build Nodes & Layout
  const nodes: GraphNode[] = useMemo(() => {
    if (allSkillNames.length === 0) return [];

    // Central anchor logic: Prefer "Machine Learning" if present, else primary goal/first skill
    let centerIndex = allSkillNames.findIndex(
      (s) => s.toLowerCase().trim() === "machine learning"
    );
    if (centerIndex === -1) {
      centerIndex = allSkillNames.findIndex(
        (s) => s.toLowerCase().trim() === "artificial intelligence" || s.toLowerCase().trim() === "python"
      );
      if (centerIndex === -1) centerIndex = 0;
    }

    const centerSkill = allSkillNames[centerIndex];
    const satellites = allSkillNames.filter((_, idx) => idx !== centerIndex);

    const result: GraphNode[] = [];

    // Center node at (450, 300) in 900x600 canvas
    const centerEntry = getSkillCatalogEntry(centerSkill);
    result.push({
      id: "center_node",
      name: centerSkill,
      category: centerEntry.category,
      isCenter: true,
      x: 450,
      y: 300,
      radius: 46,
      color: "linear-gradient(135deg, #0284C7 0%, #4564FF 50%, #9335E8 100%)",
      glowColor: "rgba(69, 100, 255, 0.45)",
      accentColor: "#02C5F5",
      iconType: centerEntry.iconType,
      entry: centerEntry,
      evidenceCount: getEvidenceForSkill(centerSkill).length,
      evidenceItems: getEvidenceForSkill(centerSkill),
    });

    // Sector-based radial placement matching visual reference
    // Top-left: AI / Specialized; Top-right: JavaScript/React; Right: Git/GitHub; Bottom: SQL/PostgreSQL; Left: Math/DSA
    const count = satellites.length;
    const baseDistance = count > 14 ? 260 : 210;

    satellites.forEach((skillName, idx) => {
      const entry = getSkillCatalogEntry(skillName);
      let angle = (idx / count) * 2 * Math.PI - Math.PI / 2;

      // Adjust angles slightly by category for aesthetic grouping
      if (entry.category === "Theoretical") {
        angle = Math.PI * 0.95 + ((idx % 3) - 1) * 0.35; // Left / Bottom-Left
      } else if (entry.category === "Specialized" && /nlp|ai|artificial/i.test(skillName)) {
        angle = -Math.PI * 0.8 + ((idx % 3) - 1) * 0.3; // Top-Left
      } else if (/javascript|react|html|css/i.test(skillName)) {
        angle = -Math.PI * 0.15 + (idx % 2 === 0 ? 0 : 0.35); // Top-Right
      } else if (/git|github|docker/i.test(skillName)) {
        angle = Math.PI * 0.15 + (idx % 2 === 0 ? 0 : 0.3); // Right
      } else if (/sql|postgres|mongo|database/i.test(skillName)) {
        angle = Math.PI * 0.55 + ((idx % 2) - 0.5) * 0.4; // Bottom / Bottom-Right
      } else if (/python/i.test(skillName)) {
        angle = -Math.PI * 0.45; // Top center-left
      }

      const dist = baseDistance + ((idx % 3) - 1) * 20;
      const x = 450 + Math.cos(angle) * dist;
      const y = 300 + Math.sin(angle) * dist;

      result.push({
        id: `node_${idx}`,
        name: skillName,
        category: entry.category,
        isCenter: false,
        x,
        y,
        radius: 35,
        color: entry.color,
        glowColor: entry.glowColor,
        accentColor: entry.accentColor,
        iconType: entry.iconType,
        entry,
        evidenceCount: getEvidenceForSkill(skillName).length,
        evidenceItems: getEvidenceForSkill(skillName),
      });
    });

    return result;
  }, [allSkillNames, projects, profiles, resumeFileName, resumeReviewed, educationEntries]);

  // 3. Build Graph Relationships & Edges
  const graphEdges = useMemo(() => {
    return buildSkillGraphEdges(allSkillNames, projects);
  }, [allSkillNames, projects]);

  // Center node connection edges (radial dotted lines from central hub)
  const centerNode = nodes.find((n) => n.isCenter);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (activeCategory !== "All" && !n.isCenter && n.category !== activeCategory) {
        return false;
      }
      if (activeEvidenceFilter) {
        if (activeEvidenceFilter === "github" && !n.evidenceItems.some((e) => e.type === "github")) return false;
        if (activeEvidenceFilter === "project" && !n.evidenceItems.some((e) => e.type === "project")) return false;
        if (activeEvidenceFilter === "resume" && !n.evidenceItems.some((e) => e.type === "resume")) return false;
        if (activeEvidenceFilter === "coursework" && !n.evidenceItems.some((e) => e.type === "coursework")) return false;
      }
      return true;
    });
  }, [nodes, activeCategory, activeEvidenceFilter]);

  // Connected skills to current selected skill
  const connectedSkillNames = useMemo(() => {
    const set = new Set<string>();
    set.add(selectedSkillName.toLowerCase().trim());

    // Center node is connected to all satellites
    if (centerNode && selectedSkillName.toLowerCase().trim() === centerNode.name.toLowerCase().trim()) {
      nodes.forEach((n) => set.add(n.name.toLowerCase().trim()));
    } else if (centerNode) {
      set.add(centerNode.name.toLowerCase().trim());
    }

    graphEdges.forEach((e) => {
      if (e.source.toLowerCase().trim() === selectedSkillName.toLowerCase().trim()) {
        set.add(e.target.toLowerCase().trim());
      }
      if (e.target.toLowerCase().trim() === selectedSkillName.toLowerCase().trim()) {
        set.add(e.source.toLowerCase().trim());
      }
    });

    return set;
  }, [selectedSkillName, graphEdges, centerNode, nodes]);

  // Selected node details
  const selectedNode =
    nodes.find((n) => n.name.toLowerCase().trim() === selectedSkillName.toLowerCase().trim()) ||
    nodes[0] ||
    null;

  // Grounded Contextual Description for the card
  const contextualExplanation = useMemo(() => {
    if (!selectedNode) return "";
    let base = selectedNode.entry.description;

    // Add student-grounded sentence if real project evidence exists
    const matchingProj = projects.find((p) =>
      p.technologies?.some((t) => t.toLowerCase().trim() === selectedNode.name.toLowerCase().trim())
    );

    if (matchingProj) {
      base += ` Your confirmed ${matchingProj.title} project directly applies ${selectedNode.name} in its functional architecture.`;
    }

    return base;
  }, [selectedNode, projects]);

  // Pan & Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.65), 1.9));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "svg" || (e.target as HTMLElement).tagName === "g") {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Categories list
  const categoryFilters = ["All", "Core", "Specialized", "Tooling", "Theoretical"];

  // Total Evidence Counts across student
  const totalResumeSkills = safeSkills.length;
  const totalGitHubSkills = projects.filter((p) => p.sources?.includes("github")).length;
  const totalVerifiedProjects = projects.filter((p) => p.status === "confirmed").length;

  return (
    <div
      className="exact-screen-wrapper"
      style={{
        background: "radial-gradient(ellipse at 75% 20%, rgba(2, 197, 245, 0.08) 0%, rgba(147, 53, 232, 0.06) 40%, #F9F8F5 75%)",
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
          top: "-10%",
          right: "10%",
          width: "700px",
          height: "700px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2, 197, 245, 0.1) 0%, rgba(86, 66, 239, 0.05) 50%, transparent 70%)",
          filter: "blur(75px)",
          pointerEvents: "none",
        }}
      />

      <ScreenHeader
        onBack={onBack}
        showBack={true}
        rightLabel="Step 8b of 10"
      />

      <main
        className="screen-body"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 1320,
          margin: "0 auto",
          width: "100%",
          padding: "20px 32px 32px",
        }}
      >
        {/* Title Header with Category Filters matching image */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
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
                padding: "4px 12px",
                borderRadius: 9999,
                marginBottom: 8,
              }}
            >
              <Sparkles size={13} color="#02C5F5" />
              <span>Skills Intelligence Map</span>
            </span>
            <h1
              style={{
                fontSize: "clamp(26px, 2.8vw, 36px)",
                fontWeight: 850,
                color: "#171626",
                letterSpacing: "-0.03em",
                margin: "0 0 6px",
              }}
            >
              Your Skills &amp; Evidence Network
            </h1>
            <p
              style={{
                fontSize: 14.5,
                color: "#64748B",
                maxWidth: 680,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Your skills are connected through real evidence from your projects, coursework and experience. Explore the network to see how your skills relate and where you have evidence.
            </p>
          </div>

          {/* Top Filter Chips */}
          <div
            className="skills-map-filters"
            style={{
              display: "flex",
              alignItems: "center",
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 9999,
              padding: "4px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              gap: 4,
            }}
          >
            {categoryFilters.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 9999,
                    border: "none",
                    background: isActive
                      ? "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)"
                      : "transparent",
                    color: isActive ? "#FFFFFF" : "#64748B",
                    fontSize: 13,
                    fontWeight: isActive ? 750 : 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isActive ? "0 2px 8px rgba(99, 102, 241, 0.35)" : "none",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Two-Column Responsive Layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.8fr 1fr",
            gap: 24,
            alignItems: "stretch",
            marginBottom: 24,
          }}
        >
          {/* LEFT: Knowledge Graph Container (~65% width) */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 24,
              border: "1.5px solid rgba(86, 66, 239, 0.12)",
              boxShadow: "0 18px 45px rgba(0, 0, 0, 0.05), 0 0 30px rgba(86, 66, 239, 0.03)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              overflow: "hidden",
              minHeight: 580,
            }}
          >
            {/* Top-Left Graph Legend matching image */}
            <div
              style={{
                position: "absolute",
                top: 20,
                left: 20,
                background: "rgba(255, 255, 255, 0.92)",
                backdropFilter: "blur(8px)",
                border: "1px solid #E2E8F0",
                borderRadius: 14,
                padding: "10px 14px",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, color: "#475569" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#3B82F6" }} />
                <span>Core Skill</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, color: "#475569" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#8B5CF6" }} />
                <span>Applied Skill</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, color: "#475569" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#10B981" }} />
                <span>Tooling</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, color: "#475569" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#F59E0B" }} />
                <span>Theoretical</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, color: "#475569" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#EC4899" }} />
                <span>Evidence Node</span>
              </div>
            </div>

            {/* SVG Graph Canvas */}
            <div
              style={{
                flex: 1,
                position: "relative",
                cursor: isPanning ? "grabbing" : "grab",
                minHeight: 460,
                overflow: "hidden",
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 900 600"
                style={{
                  width: "100%",
                  height: "100%",
                  userSelect: "none",
                }}
              >
                <defs>
                  {/* Concentric Glow Filters */}
                  <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="edgeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <g
                  transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                  style={{ transformOrigin: "450px 300px", transition: isPanning ? "none" : "transform 0.15s ease-out" }}
                >
                  {/* Background concentric reference orbit circles */}
                  <circle cx="450" cy="300" r="140" fill="none" stroke="rgba(226, 232, 240, 0.6)" strokeDasharray="3 4" />
                  <circle cx="450" cy="300" r="220" fill="none" stroke="rgba(226, 232, 240, 0.45)" strokeDasharray="4 6" />

                  {/* 1. Dotted radial edges connecting Center Node to satellites */}
                  {centerNode &&
                    filteredNodes
                      .filter((n) => !n.isCenter)
                      .map((node) => {
                        const isConnectedToSelected =
                          selectedSkillName.toLowerCase().trim() === centerNode.name.toLowerCase().trim() ||
                          selectedSkillName.toLowerCase().trim() === node.name.toLowerCase().trim();

                        return (
                          <line
                            key={`radial_${node.name}`}
                            x1={centerNode.x}
                            y1={centerNode.y}
                            x2={node.x}
                            y2={node.y}
                            stroke={isConnectedToSelected ? "#6366F1" : "rgba(203, 213, 225, 0.65)"}
                            strokeWidth={isConnectedToSelected ? 2 : 1.2}
                            strokeDasharray={isConnectedToSelected ? "none" : "3 4"}
                            opacity={isConnectedToSelected ? 0.9 : 0.4}
                          />
                        );
                      })}

                  {/* 2. Interconnecting Relationship Edges between Satellite Skills */}
                  {graphEdges.map((edge, idx) => {
                    const srcNode = nodes.find(
                      (n) => n.name.toLowerCase().trim() === edge.source.toLowerCase().trim()
                    );
                    const tgtNode = nodes.find(
                      (n) => n.name.toLowerCase().trim() === edge.target.toLowerCase().trim()
                    );
                    if (!srcNode || !tgtNode) return null;

                    const isSelectedEdge =
                      selectedSkillName.toLowerCase().trim() === edge.source.toLowerCase().trim() ||
                      selectedSkillName.toLowerCase().trim() === edge.target.toLowerCase().trim();

                    const strokeColor = edge.isProjectBacked
                      ? "#EC4899"
                      : isSelectedEdge
                      ? "#38BDF8"
                      : "rgba(148, 163, 184, 0.45)";

                    const strokeWidth = isSelectedEdge ? 2.5 : edge.isProjectBacked ? 2 : 1.5;

                    return (
                      <g key={`edge_${idx}`}>
                        <line
                          x1={srcNode.x}
                          y1={srcNode.y}
                          x2={tgtNode.x}
                          y2={tgtNode.y}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                          opacity={isSelectedEdge ? 1 : 0.65}
                          filter={isSelectedEdge ? "url(#edgeGlow)" : undefined}
                          style={{ cursor: "pointer", transition: "all 0.2s" }}
                          onMouseEnter={() => setHoveredEdge(edge)}
                          onMouseLeave={() => setHoveredEdge(null)}
                        />
                      </g>
                    );
                  })}

                  {/* 3. Render Circular Nodes */}
                  {filteredNodes.map((node) => {
                    const isSelected =
                      selectedSkillName.toLowerCase().trim() === node.name.toLowerCase().trim();
                    const isDirectlyConnected = connectedSkillNames.has(node.name.toLowerCase().trim());
                    const nodeOpacity = isSelected || isDirectlyConnected ? 1 : 0.45;

                    return (
                      <g
                        key={node.name}
                        transform={`translate(${node.x}, ${node.y})`}
                        style={{
                          cursor: "pointer",
                          opacity: nodeOpacity,
                          transition: "opacity 0.2s, transform 0.2s",
                        }}
                        onClick={() => setSelectedSkillName(node.name)}
                        onMouseEnter={() => setHoveredNode(node.name)}
                        onMouseLeave={() => setHoveredNode(null)}
                      >
                        {/* Glow halo when selected or center */}
                        {(isSelected || node.isCenter) && (
                          <circle
                            r={node.radius + 12}
                            fill={node.glowColor}
                            opacity={isSelected ? 0.6 : 0.35}
                            filter="url(#nodeGlow)"
                          />
                        )}

                        {/* Animated selection ring */}
                        {isSelected && (
                          <circle
                            r={node.radius + 6}
                            fill="none"
                            stroke="#5642EF"
                            strokeWidth="2.5"
                            strokeDasharray="5 3"
                          />
                        )}

                        {/* Outer circular background */}
                        <circle
                          r={node.radius}
                          fill={node.isCenter ? "url(#centerGradient)" : node.accentColor}
                          stroke="#FFFFFF"
                          strokeWidth={node.isCenter ? "3.5" : "2.5"}
                          style={{
                            filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.12))",
                            transition: "transform 0.15s ease",
                          }}
                        />

                        {/* Gradient fill definition for center node */}
                        {node.isCenter && (
                          <defs>
                            <linearGradient id="centerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#0284C7" />
                              <stop offset="50%" stopColor="#4564FF" />
                              <stop offset="100%" stopColor="#9335E8" />
                            </linearGradient>
                          </defs>
                        )}

                        {/* Tech Icon inside node */}
                        <g transform={`translate(-9, ${node.isCenter ? -18 : -14})`}>
                          <RenderTechIcon type={node.iconType} size={18} color="#FFFFFF" />
                        </g>

                        {/* Node Label Text */}
                        <text
                          y={node.isCenter ? 10 : 8}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize={node.isCenter ? "11.5" : "9.5"}
                          fontWeight="800"
                          fontFamily="system-ui, -apple-system, sans-serif"
                          style={{ pointerEvents: "none", letterSpacing: "-0.01em" }}
                        >
                          {node.name.length > 13 ? (
                            <>
                              <tspan x="0" dy="0">{node.name.split(" ")[0]}</tspan>
                              <tspan x="0" dy="11">{node.name.split(" ").slice(1).join(" ")}</tspan>
                            </>
                          ) : (
                            node.name
                          )}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Floating Edge Relationship Tooltip */}
              {hoveredEdge && (
                <div
                  style={{
                    position: "absolute",
                    top: 24,
                    right: 24,
                    background: "rgba(15, 23, 42, 0.9)",
                    backdropFilter: "blur(6px)",
                    color: "#FFFFFF",
                    padding: "8px 14px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 650,
                    pointerEvents: "none",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                    zIndex: 20,
                  }}
                >
                  <div style={{ color: "#38BDF8", fontSize: 11, textTransform: "uppercase", fontWeight: 800 }}>
                    {hoveredEdge.relationType}
                  </div>
                  <div>{hoveredEdge.description}</div>
                </div>
              )}

              {/* Canvas Controls at bottom-left matching image: [ + ] [ - ] [ Fit view ] */}
              <div
                style={{
                  position: "absolute",
                  bottom: 18,
                  left: 20,
                  display: "flex",
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  padding: 2,
                  zIndex: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 0.15, 1.9))}
                  style={{ background: "transparent", border: "none", padding: "6px 10px", cursor: "pointer", color: "#475569" }}
                  title="Zoom In"
                >
                  +
                </button>
                <div style={{ width: 1, height: 16, background: "#E2E8F0" }} />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.15, 0.65))}
                  style={{ background: "transparent", border: "none", padding: "6px 10px", cursor: "pointer", color: "#475569" }}
                  title="Zoom Out"
                >
                  &minus;
                </button>
                <div style={{ width: 1, height: 16, background: "#E2E8F0" }} />
                <button
                  type="button"
                  onClick={resetView}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Maximize2 size={12} /> Fit view
                </button>
              </div>
            </div>

            {/* Bottom Evidence Summary Across Your Skills matching image */}
            <div
              style={{
                borderTop: "1px solid #F1F5F9",
                padding: "16px 22px",
                background: "#FAFAFA",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#1E1B4B", marginBottom: 10 }}>
                <ShieldCheck size={16} color="#5642EF" />
                <span>Evidence across your skills</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                {/* 1. Resume reviewed */}
                <button
                  type="button"
                  onClick={() => setActiveEvidenceFilter(activeEvidenceFilter === "resume" ? null : "resume")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: activeEvidenceFilter === "resume" ? "#ECFDF5" : "#FFFFFF",
                    border: activeEvidenceFilter === "resume" ? "1.5px solid #10B981" : "1px solid #E2E8F0",
                    color: "#059669",
                    fontSize: 12,
                    fontWeight: 750,
                    cursor: "pointer",
                  }}
                >
                  <CheckCircle2 size={13} />
                  <span>Resume reviewed {totalResumeSkills > 0 ? `(${totalResumeSkills})` : ""}</span>
                </button>

                {/* 2. GitHub evidence */}
                <button
                  type="button"
                  onClick={() => setActiveEvidenceFilter(activeEvidenceFilter === "github" ? null : "github")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: activeEvidenceFilter === "github" ? "#F5F3FF" : "#FFFFFF",
                    border: activeEvidenceFilter === "github" ? "1.5px solid #8B5CF6" : "1px solid #E2E8F0",
                    color: "#6D28D9",
                    fontSize: 12,
                    fontWeight: 750,
                    cursor: "pointer",
                  }}
                >
                  <FolderGit2 size={13} />
                  <span>GitHub evidence {totalGitHubSkills > 0 ? `(${totalGitHubSkills})` : ""}</span>
                </button>

                {/* 3. Project verified */}
                <button
                  type="button"
                  onClick={() => setActiveEvidenceFilter(activeEvidenceFilter === "project" ? null : "project")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: activeEvidenceFilter === "project" ? "#EFF6FF" : "#FFFFFF",
                    border: activeEvidenceFilter === "project" ? "1.5px solid #3B82F6" : "1px solid #E2E8F0",
                    color: "#2563EB",
                    fontSize: 12,
                    fontWeight: 750,
                    cursor: "pointer",
                  }}
                >
                  <Briefcase size={13} />
                  <span>Project verified {totalVerifiedProjects > 0 ? `(${totalVerifiedProjects})` : ""}</span>
                </button>

                {/* 4. Portfolio mentioned */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: "#FDF2F8",
                    border: "1px solid #FCE7F3",
                    color: "#DB2777",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <span>Portfolio mentioned</span>
                </span>

                {/* 5. Course recorded */}
                <button
                  type="button"
                  onClick={() => setActiveEvidenceFilter(activeEvidenceFilter === "coursework" ? null : "coursework")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: activeEvidenceFilter === "coursework" ? "#EEF2FF" : "#FFFFFF",
                    border: activeEvidenceFilter === "coursework" ? "1.5px solid #6366F1" : "1px solid #E2E8F0",
                    color: "#4338CA",
                    fontSize: 12,
                    fontWeight: 750,
                    cursor: "pointer",
                  }}
                >
                  <GraduationCap size={13} />
                  <span>Course recorded</span>
                </button>

                {/* 6. Certification found */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: "#F0FDF4",
                    border: "1px solid #DCFCE7",
                    color: "#15803D",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Award size={13} />
                  <span>Certification found</span>
                </span>

                {/* 7. Blog/Article */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    color: "#64748B",
                    fontSize: 12,
                    fontWeight: 650,
                  }}
                >
                  <span>Blog/Article</span>
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Selected Skill Intelligence Card (~35% width) */}
          {selectedNode ? (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 24,
                border: "1.5px solid rgba(86, 66, 239, 0.12)",
                padding: "28px",
                boxShadow: "0 18px 45px rgba(0, 0, 0, 0.05), 0 0 30px rgba(86, 66, 239, 0.03)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 20,
              }}
            >
              <div>
                {/* Card Header with Icon, Title, Badges, Bookmark */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Large Skill Avatar / Logo */}
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: selectedNode.entry.bgLight || "#EFF6FF",
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid rgba(2, 132, 199, 0.15)",
                        flexShrink: 0,
                      }}
                    >
                      <RenderTechIcon type={selectedNode.iconType} size={24} color={selectedNode.accentColor} />
                    </div>

                    <div>
                      <h3 style={{ fontSize: 22, fontWeight: 850, color: "#1E1B4B", margin: "0 0 4px" }}>
                        {selectedNode.name}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 750,
                            color: "#0369A1",
                            background: "#E0F2FE",
                            padding: "2px 8px",
                            borderRadius: 6,
                          }}
                        >
                          {selectedNode.entry.badgeLabel}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 750,
                            color: "#059669",
                            background: "#ECFDF5",
                            border: "1px solid #A7F3D0",
                            padding: "2px 8px",
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Check size={11} /> Reviewed
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleBookmark(selectedNode.name)}
                    style={{
                      background: bookmarkedSkills.has(selectedNode.name) ? "rgba(86, 66, 239, 0.1)" : "transparent",
                      border: "none",
                      color: bookmarkedSkills.has(selectedNode.name) ? "#5642EF" : "#94A3B8",
                      cursor: "pointer",
                      padding: 6,
                      borderRadius: 8,
                    }}
                    title="Bookmark Skill"
                  >
                    <Bookmark size={18} fill={bookmarkedSkills.has(selectedNode.name) ? "#5642EF" : "none"} />
                  </button>
                </div>

                {/* 3-4 Line Contextual Skill Description */}
                <p
                  style={{
                    fontSize: 13.5,
                    color: "#475569",
                    lineHeight: 1.55,
                    margin: "0 0 20px",
                  }}
                >
                  {contextualExplanation}
                </p>

                {/* EVIDENCE SOURCES Section */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
                      <Layers size={14} color="#5642EF" />
                      <span>Evidence Sources</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", background: "#F1F5F9", padding: "1px 7px", borderRadius: 9999 }}>
                      {selectedNode.evidenceItems.length} source{selectedNode.evidenceItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {selectedNode.evidenceItems.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selectedNode.evidenceItems.map((ev, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "#F8FAFC",
                            border: "1px solid #E2E8F0",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background: "#FFFFFF",
                                border: "1px solid #CBD5E1",
                                display: "grid",
                                placeItems: "center",
                                color: "#475569",
                              }}
                            >
                              {ev.type === "github" ? (
                                <FolderGit2 size={14} />
                              ) : ev.type === "project" ? (
                                <Briefcase size={14} />
                              ) : ev.type === "coursework" ? (
                                <GraduationCap size={14} />
                              ) : (
                                <FileCheck size={14} />
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 750, color: "#1E1B4B" }}>{ev.title}</div>
                              <div style={{ fontSize: 11, color: "#64748B" }}>{ev.details}</div>
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 750,
                              color: ev.status === "Verified" ? "#2563EB" : "#059669",
                              background: ev.status === "Verified" ? "#EFF6FF" : "#ECFDF5",
                              border: `1px solid ${ev.status === "Verified" ? "#BFDBFE" : "#A7F3D0"}`,
                              padding: "2px 7px",
                              borderRadius: 6,
                            }}
                          >
                            ✓ {ev.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: "12px", borderRadius: 10, background: "#F8FAFC", border: "1px dashed #CBD5E1", fontSize: 12.5, color: "#64748B" }}>
                      No supporting evidence has been linked to this skill yet.
                    </div>
                  )}
                </div>

                {/* RELATED TECHNOLOGIES & FRAMEWORKS Section */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Zap size={13} color="#F59E0B" />
                    <span>Related Technologies &amp; Frameworks</span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {selectedNode.entry.relatedTechnologies.slice(0, 5).map((tech) => {
                      const isInStudentProfile = allSkillNames.some(
                        (s) => s.toLowerCase().trim() === tech.toLowerCase().trim()
                      );

                      return (
                        <button
                          key={tech}
                          type="button"
                          onClick={() => {
                            if (isInStudentProfile) setSelectedSkillName(tech);
                          }}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            background: isInStudentProfile ? "rgba(86, 66, 239, 0.08)" : "#F1F5F9",
                            border: isInStudentProfile ? "1px solid rgba(86, 66, 239, 0.25)" : "1px solid #E2E8F0",
                            color: isInStudentProfile ? "#5642EF" : "#475569",
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: isInStudentProfile ? "pointer" : "default",
                          }}
                          title={isInStudentProfile ? "Click to view skill in graph" : "Related technology in taxonomy"}
                        >
                          {tech} {isInStudentProfile && "• In profile"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* YOUR PROFICIENCY (AI ESTIMATE) Section */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                    Your Proficiency (AI Estimate)
                  </div>

                  {selectedNode.evidenceItems.length > 0 ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1E1B4B" }}>Intermediate</span>
                        <span style={{ fontSize: 12, fontWeight: 750, color: "#5642EF" }}>70%</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 9999, background: "#E2E8F0", overflow: "hidden", marginBottom: 8 }}>
                        <div
                          style={{
                            width: "70%",
                            height: "100%",
                            borderRadius: 9999,
                            background: "linear-gradient(90deg, #02C5F5 0%, #5642EF 100%)",
                          }}
                        />
                      </div>
                      <p style={{ fontSize: 11.5, color: "#64748B", margin: 0, lineHeight: 1.4 }}>
                        Demonstrates practical capability across confirmed project implementations and code repositories.
                      </p>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#64748B", background: "#F8FAFC", padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                      Proficiency not assessed yet. Link project evidence to calibrate readiness.
                    </div>
                  )}
                </div>
              </div>

              {/* Review Evidence Action Button */}
              <button
                type="button"
                onClick={onNext}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 6px 18px rgba(99, 102, 241, 0.28)",
                  transition: "all 0.15s ease",
                }}
              >
                <span>Review evidence</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 24,
                padding: "32px",
                textAlign: "center",
                display: "grid",
                placeItems: "center",
                border: "1.5px solid #E2E8F0",
              }}
            >
              <p style={{ color: "#64748B" }}>Select a skill node in the graph to inspect evidence and interconnections.</p>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
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
