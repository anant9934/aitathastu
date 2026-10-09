"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Plus,
  ExternalLink,
  Trash2,
  Edit3,
  Eye,
  Sparkles,
  AlertCircle,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Github,
  Link2,
  Terminal,
  Lock,
  Globe,
  FileText,
} from "lucide-react";
import {
  PROJECT_CATEGORIES,
  PROJECT_TYPES,
  PROJECT_PURPOSES,
  PROJECT_VISIBILITIES,
  PROJECT_LINK_TYPES,
  CONTRIBUTION_ROLES,
  TECH_GROUPS,
  validateProjectUrl,
  type ProjectLinkRecord,
  type ProjectTimelineRecord,
  type TeamMemberRecord,
  type MentorRecord,
  type AiMlDetailsRecord,
  type HardwareDetailsRecord,
  type StructuredMetricResult,
} from "@/lib/domain/project-taxonomy";

interface ProjectItem {
  id: string;
  title: string;
  summary?: string;
  description: string;
  category: string;
  purpose: string;
  visibility: string;
  projectType: string;
  technologies: string[];
  sources: string[];
  status: string;
  repositoryUrl: string | null;
  demoUrl: string | null;
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

export function StudentProjectsView() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [creationMethod, setCreationMethod] = useState<"manual" | "github" | "link">("manual");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // GitHub Import state
  const [ghUsername, setGhUsername] = useState("");
  const [ghLoading, setGhLoading] = useState(false);
  const [ghRepos, setGhRepos] = useState<Array<{ id: string; title: string; description: string; technologies: string[]; url: string; stars?: number }>>([]);
  const [ghError, setGhError] = useState<string | null>(null);

  // Link Import state
  const [importUrlInput, setImportUrlInput] = useState("");
  const [linkExtractStatus, setLinkExtractStatus] = useState<string | null>(null);

  // Form Fields (Sections A-J)
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Machine Learning");
  const [purpose, setPurpose] = useState("personal");
  const [visibility, setVisibility] = useState("private");
  const [projectType, setProjectType] = useState("software");
  const [status, setStatus] = useState("in_progress");

  // Section B: Links
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [links, setLinks] = useState<ProjectLinkRecord[]>([]);

  // Section C: Technologies
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [customTechInput, setCustomTechInput] = useState("");

  // Section D: Contribution
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [contributionNote, setContributionNote] = useState("");

  // Section E: Team & Mentors
  const [projectStructure, setProjectStructure] = useState<"individual" | "team">("individual");
  const [teamName, setTeamName] = useState("");
  const [teamMembersText, setTeamMembersText] = useState("");
  const [mentorsText, setMentorsText] = useState("");

  // Section F: Timeline
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [hackathon, setHackathon] = useState("");

  // Section G: AI/ML Specs
  const [problemStatement, setProblemStatement] = useState("");
  const [proposedSolution, setProposedSolution] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [datasetSource, setDatasetSource] = useState("");
  const [datasetUrl, setDatasetUrl] = useState("");
  const [datasetLicense, setDatasetLicense] = useState("");
  const [modelFamily, setModelFamily] = useState("");
  const [algorithm, setAlgorithm] = useState("");
  const [trainingApproach, setTrainingApproach] = useState("");
  const [metricName, setMetricName] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [metricSplit, setMetricSplit] = useState("");
  const [metricBaseline, setMetricBaseline] = useState("");
  const [metricsList, setMetricsList] = useState<StructuredMetricResult[]>([]);
  const [limitations, setLimitations] = useState("");
  const [futureImprovements, setFutureImprovements] = useState("");

  // Section H: Hardware Specs
  const [hwPlatform, setHwPlatform] = useState("");
  const [hwMicrocontroller, setHwMicrocontroller] = useState("");
  const [hwSensors, setHwSensors] = useState("");
  const [hwCamera, setHwCamera] = useState("");
  const [hwPrototypeStage, setHwPrototypeStage] = useState("");
  const [hwTestingNotes, setHwTestingNotes] = useState("");

  // Accordion Toggles
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    links: true,
    tech: true,
    contrib: true,
    aiml: true,
    hardware: false,
    team: false,
    timeline: false,
  });

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/student/projects");
      if (!res.ok) {
        throw new Error("Failed to load projects.");
      }
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const resetForm = useCallback(() => {
    setTitle("");
    setSummary("");
    setDescription("");
    setCategory("Machine Learning");
    setPurpose("personal");
    setVisibility("private");
    setProjectType("software");
    setStatus("in_progress");
    setRepositoryUrl("");
    setDemoUrl("");
    setLinks([]);
    setSelectedTechs([]);
    setCustomTechInput("");
    setSelectedRoles([]);
    setContributionNote("");
    setProjectStructure("individual");
    setTeamName("");
    setTeamMembersText("");
    setMentorsText("");
    setStartDate("");
    setEndDate("");
    setInstitution("");
    setCourse("");
    setHackathon("");
    setProblemStatement("");
    setProposedSolution("");
    setDatasetName("");
    setDatasetSource("");
    setDatasetUrl("");
    setDatasetLicense("");
    setModelFamily("");
    setAlgorithm("");
    setTrainingApproach("");
    setMetricName("");
    setMetricValue("");
    setMetricSplit("");
    setMetricBaseline("");
    setMetricsList([]);
    setLimitations("");
    setFutureImprovements("");
    setHwPlatform("");
    setHwMicrocontroller("");
    setHwSensors("");
    setHwCamera("");
    setHwPrototypeStage("");
    setHwTestingNotes("");
    setFormError(null);
    setLinkExtractStatus(null);
    setGhRepos([]);
    setGhError(null);
    setCreationMethod("manual");
  }, []);

  const startCreateProject = useCallback(() => {
    resetForm();
    setModalMode("create");
    setEditingProjectId(null);
    setShowModal(true);
  }, [resetForm]);

  const startEditProject = useCallback((proj: ProjectItem) => {
    resetForm();
    setModalMode("edit");
    setEditingProjectId(proj.id);
    setTitle(proj.title);
    setSummary(proj.summary || "");
    setDescription(proj.description || "");
    setCategory(proj.category || "Machine Learning");
    setPurpose(proj.purpose || "personal");
    setVisibility(proj.visibility || "private");
    setProjectType(proj.projectType || "software");
    setStatus(proj.status || "in_progress");
    setRepositoryUrl(proj.repositoryUrl || "");
    setDemoUrl(proj.demoUrl || "");
    setLinks(proj.links || []);
    setSelectedTechs(proj.technologies || []);
    setSelectedRoles(proj.contributionRoles || []);
    setContributionNote(proj.contributionNote || "");

    if (proj.team) {
      setProjectStructure(proj.team.projectStructure || "individual");
      setTeamName(proj.team.teamName || "");
      if (proj.team.teamMembers) {
        setTeamMembersText(proj.team.teamMembers.map((m) => `${m.name}${m.role ? ` (${m.role})` : ""}`).join(", "));
      }
      if (proj.team.mentors) {
        setMentorsText(proj.team.mentors.map((m) => `${m.name}${m.role ? ` - ${m.role}` : ""}`).join(", "));
      }
    }

    if (proj.timeline) {
      setStartDate(proj.timeline.startDate || "");
      setEndDate(proj.timeline.endDate || "");
      setInstitution(proj.timeline.institution || "");
      setCourse(proj.timeline.course || "");
      setHackathon(proj.timeline.hackathon || "");
    }

    if (proj.aiDetails) {
      setProblemStatement(proj.aiDetails.problemStatement || "");
      setProposedSolution(proj.aiDetails.proposedSolution || "");
      if (proj.aiDetails.dataset) {
        setDatasetName(proj.aiDetails.dataset.name || "");
        setDatasetSource(proj.aiDetails.dataset.source || "");
        setDatasetUrl(proj.aiDetails.dataset.url || "");
        setDatasetLicense(proj.aiDetails.dataset.license || "");
      }
      setModelFamily(proj.aiDetails.modelFamily || "");
      setAlgorithm(proj.aiDetails.algorithm || "");
      setTrainingApproach(proj.aiDetails.trainingApproach || "");
      setMetricsList(proj.aiDetails.results || []);
      setLimitations(proj.aiDetails.limitations || "");
      setFutureImprovements(proj.aiDetails.futureImprovements || "");
    }

    if (proj.hardwareDetails) {
      setHwPlatform(proj.hardwareDetails.platform || "");
      setHwMicrocontroller(proj.hardwareDetails.microcontroller || "");
      setHwSensors(proj.hardwareDetails.sensors?.join(", ") || "");
      setHwCamera(proj.hardwareDetails.cameraModules?.join(", ") || "");
      setHwPrototypeStage(proj.hardwareDetails.prototypeStage || "");
      setHwTestingNotes(proj.hardwareDetails.testingNotes || "");
    }

    setShowModal(true);
  }, [resetForm]);

  // Check URL query parameters for edit action
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get("edit");
      if (editId && projects.length > 0) {
        const target = projects.find((p) => p.id === editId);
        if (target) {
          startEditProject(target);
        }
      }
    }
  }, [projects, startEditProject]);

  const handleFetchGitHubRepos = async () => {
    if (!ghUsername.trim()) {
      setGhError("Please enter your GitHub username.");
      return;
    }
    setGhLoading(true);
    setGhError(null);
    try {
      const res = await fetch("/api/onboarding-v2/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ghUsername.trim(), consent: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not fetch repositories.");
      }
      setGhRepos(data.projects || []);
      if (!data.projects || data.projects.length === 0) {
        setGhError("No public repositories found for this account.");
      }
    } catch (err) {
      setGhError(err instanceof Error ? err.message : "GitHub lookup failed.");
    } finally {
      setGhLoading(false);
    }
  };

  const handleSelectGitHubRepo = (repo: { id: string; title: string; description: string; technologies: string[]; url: string }) => {
    setTitle(repo.title);
    setDescription(repo.description || "");
    setRepositoryUrl(repo.url || "");
    if (repo.technologies && repo.technologies.length > 0) {
      setSelectedTechs(repo.technologies);
    }
    setCategory("Machine Learning");
    setProjectType("software");
    setCreationMethod("manual"); // Switch back to manual review tab so user can customize
  };

  const handleImportLink = () => {
    const trimmed = importUrlInput.trim();
    if (!trimmed) {
      setLinkExtractStatus("Please provide a valid URL.");
      return;
    }

    const val = validateProjectUrl(trimmed);
    if (!val.valid) {
      setLinkExtractStatus(`Invalid link: ${val.error}`);
      return;
    }

    // Check if it is a GitHub repo link
    if (trimmed.includes("github.com/")) {
      const parts = trimmed.split("github.com/")[1]?.split("/");
      if (parts && parts.length >= 2) {
        const repoName = parts[1].replace(/\.git$/, "");
        setTitle(repoName.replace(/[-_]/g, " "));
        setRepositoryUrl(val.cleanUrl || trimmed);
        setLinkExtractStatus("Extracted repository name from GitHub link. Review details below.");
        setCreationMethod("manual");
        return;
      }
    }

    // For other links, save as reference link in Section B
    setLinks((prev) => [
      ...prev,
      {
        id: `lnk_${Date.now()}`,
        type: "other",
        label: "Imported Resource",
        url: val.cleanUrl || trimmed,
        visibility: "public",
      },
    ]);
    setLinkExtractStatus("Link verified and added to Project Links. Complete project details below.");
    setCreationMethod("manual");
  };

  const handleAddCustomTech = () => {
    const trimmed = customTechInput.trim();
    if (trimmed && !selectedTechs.includes(trimmed)) {
      setSelectedTechs((prev) => [...prev, trimmed]);
      setCustomTechInput("");
    }
  };

  const handleToggleTech = (t: string) => {
    setSelectedTechs((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const handleToggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleAddLinkRow = () => {
    setLinks((prev) => [
      ...prev,
      {
        id: `lnk_${Date.now()}`,
        type: "other",
        label: "",
        url: "",
        description: "",
        visibility: "public",
      },
    ]);
  };

  const handleUpdateLinkRow = (index: number, patch: Partial<ProjectLinkRecord>) => {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const handleRemoveLinkRow = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddMetric = () => {
    if (!metricName.trim() || !metricValue.trim()) return;
    setMetricsList((prev) => [
      ...prev,
      {
        metricName: metricName.trim(),
        metricValue: metricValue.trim(),
        datasetSplit: metricSplit.trim() || "Test Split",
        baseline: metricBaseline.trim() || undefined,
      },
    ]);
    setMetricName("");
    setMetricValue("");
    setMetricSplit("");
    setMetricBaseline("");
  };

  const handleRemoveMetric = (index: number) => {
    setMetricsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    if (!title.trim()) {
      setFormError("Project title is required.");
      return;
    }

    // SSRF URL validation
    if (repositoryUrl.trim()) {
      const v = validateProjectUrl(repositoryUrl.trim());
      if (!v.valid) {
        setFormError(`Repository URL error: ${v.error}`);
        return;
      }
    }

    if (demoUrl.trim()) {
      const v = validateProjectUrl(demoUrl.trim());
      if (!v.valid) {
        setFormError(`Demo URL error: ${v.error}`);
        return;
      }
    }

    for (const l of links) {
      if (l.url) {
        const v = validateProjectUrl(l.url);
        if (!v.valid) {
          setFormError(`Link "${l.label || l.url}" error: ${v.error}`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim(),
      category,
      purpose,
      visibility: asDraft ? "private" : visibility,
      projectType,
      status: asDraft ? "planning" : status,
      technologies: selectedTechs,
      sources: ["manual"],
      repositoryUrl: repositoryUrl.trim() || undefined,
      demoUrl: demoUrl.trim() || undefined,
      links: links.filter((l) => l.url.trim().length > 0),
      timeline: {
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
        institution: institution.trim() || undefined,
        course: course.trim() || undefined,
        hackathon: hackathon.trim() || undefined,
      },
      team: {
        projectStructure,
        teamName: projectStructure === "team" ? teamName.trim() : undefined,
        teamMembers: teamMembersText
          ? teamMembersText.split(",").map((s) => ({ name: s.trim() })).filter((m) => Boolean(m.name))
          : [],
        mentors: mentorsText
          ? mentorsText.split(",").map((s) => ({ name: s.trim() })).filter((m) => Boolean(m.name))
          : [],
      },
      aiDetails: {
        problemStatement: problemStatement.trim() || undefined,
        proposedSolution: proposedSolution.trim() || undefined,
        dataset: datasetName.trim()
          ? {
              name: datasetName.trim(),
              source: datasetSource.trim() || undefined,
              url: datasetUrl.trim() || undefined,
              license: datasetLicense.trim() || undefined,
            }
          : undefined,
        modelFamily: modelFamily.trim() || undefined,
        algorithm: algorithm.trim() || undefined,
        trainingApproach: trainingApproach.trim() || undefined,
        results: metricsList,
        limitations: limitations.trim() || undefined,
        futureImprovements: futureImprovements.trim() || undefined,
      },
      hardwareDetails:
        projectType === "hardware" || projectType === "both"
          ? {
              platform: hwPlatform.trim() || undefined,
              microcontroller: hwMicrocontroller.trim() || undefined,
              sensors: hwSensors ? hwSensors.split(",").map((s) => s.trim()).filter(Boolean) : [],
              cameraModules: hwCamera ? hwCamera.split(",").map((s) => s.trim()).filter(Boolean) : [],
              prototypeStage: hwPrototypeStage.trim() || undefined,
              testingNotes: hwTestingNotes.trim() || undefined,
            }
          : {},
      contributionRoles: selectedRoles,
      contributionNote: contributionNote.trim(),
    };

    try {
      if (modalMode === "edit" && editingProjectId) {
        const res = await fetch(`/api/student/projects/${editingProjectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update project.");
        }
      } else {
        const res = await fetch("/api/student/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create project.");
        }
      }

      await fetchProjects();
      setShowModal(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error saving project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projTitle: string) => {
    if (!window.confirm(`Are you sure you want to remove "${projTitle}"?`)) return;

    try {
      const res = await fetch(`/api/student/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete project.");
      }

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting project.");
    }
  };

  return (
    <div style={{ maxWidth: 1040, marginInline: "auto", width: "100%", padding: "28px 20px 80px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#EDE9FE",
                color: "#5942DC",
                display: "grid",
                placeItems: "center",
              }}
            >
              <FolderGit2 size={20} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#171626", margin: 0 }}>
              My Projects & Evidence
            </h1>
          </div>
          <p style={{ fontSize: 14, color: "#4B5563", margin: 0, maxWidth: 640 }}>
            Applied engineering evidence and personal contribution boundaries. Each confirmed project grounds your profile in demonstrable artifacts.
          </p>
        </div>

        <button
          type="button"
          onClick={startCreateProject}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            background: "#5942DC",
            color: "#FFF",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(89, 66, 220, 0.2)",
          }}
        >
          <Plus size={16} /> Add Project
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ padding: 48, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
          Loading your projects...
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "16px 20px",
            background: "#FEF2F2",
            borderRadius: 12,
            border: "1px solid #FEE2E2",
            color: "#991B1B",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && projects.length === 0 && (
        <div
          style={{
            padding: "56px 24px",
            textAlign: "center",
            background: "#FFFFFF",
            borderRadius: 16,
            border: "1.5px dashed #E5E7EB",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#F5F3FF",
              color: "#5942DC",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 16px",
            }}
          >
            <FolderGit2 size={28} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#171626", marginBottom: 8 }}>
            No Projects Confirmed Yet
          </h2>
          <p style={{ fontSize: 14, color: "#6B7280", maxWidth: 460, margin: "0 auto 24px", lineHeight: 1.5 }}>
            No projects yet. Add your first project using manual entry, GitHub import, or resource links to establish evidence in your profile.
          </p>
          <button
            type="button"
            onClick={startCreateProject}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 10,
              background: "#5942DC",
              color: "#FFF",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
            }}
          >
            <Plus size={16} /> Add Your First Project
          </button>
        </div>
      )}

      {/* Projects List */}
      {!loading && projects.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {projects.map((project) => {
            const isFromGitHub = project.sources?.includes("github");
            const hasRoles = project.contributionRoles && project.contributionRoles.length > 0;
            const hasSavedLinks = (project.links && project.links.length > 0) || project.repositoryUrl || project.demoUrl;

            return (
              <div
                key={project.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: 16,
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  padding: "24px",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <Link
                        href={`/student/projects/${project.id}`}
                        style={{ fontSize: 18, fontWeight: 800, color: "#171626", textDecoration: "none" }}
                      >
                        {project.title}
                      </Link>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 8,
                          background: isFromGitHub ? "#EFF6FF" : "#ECFDF5",
                          color: isFromGitHub ? "#2563EB" : "#059669",
                          border: isFromGitHub ? "1px solid #DBEAFE" : "1px solid #A7F3D0",
                        }}
                      >
                        {isFromGitHub ? "GitHub" : "Manual Entry"}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 8,
                          background: "#EDE9FE",
                          color: "#5942DC",
                        }}
                      >
                        {project.category || "AI/ML Project"}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 8,
                          background: "#F3F4F6",
                          color: "#4B5563",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {project.visibility === "private" ? <Lock size={11} /> : <Eye size={11} />}
                        {project.visibility}
                      </span>
                    </div>

                    <p style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.5, margin: 0 }}>
                      {project.summary || project.description || "Student-confirmed project artifact."}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Link
                      href={`/student/projects/${project.id}`}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "#F9FAFB",
                        color: "#5942DC",
                        border: "1px solid #E5E7EB",
                        fontSize: 12,
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Eye size={13} /> View Detail
                    </Link>
                    <button
                      type="button"
                      onClick={() => startEditProject(project)}
                      title="Edit project"
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        color: "#374151",
                        border: "1px solid #E5E7EB",
                        background: "#FFF",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(project.id, project.title)}
                      title="Remove project"
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        color: "#EF4444",
                        border: "1px solid #FEE2E2",
                        background: "#FFF",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Technologies */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginRight: 4 }}>Technologies:</span>
                  {project.technologies?.map((tech) => (
                    <span
                      key={tech}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: "#F3F4F6",
                        color: "#374151",
                        border: "1px solid #E5E7EB",
                      }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                {/* Contribution Breakdown */}
                {hasRoles && (
                  <div style={{ paddingTop: 12, borderTop: "1px solid #F3F4F6", marginBottom: hasSavedLinks ? 12 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#171626", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkles size={13} color="#5942DC" /> Personal Contribution (Self-Reported Claim)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {project.contributionRoles.map((role) => (
                        <span
                          key={role}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
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
                    {project.contributionNote && (
                      <p style={{ fontSize: 12, color: "#4B5563", margin: "6px 0 0", fontStyle: "italic" }}>
                        &ldquo;{project.contributionNote}&rdquo;
                      </p>
                    )}
                  </div>
                )}

                {/* Saved Links */}
                {hasSavedLinks && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 10, borderTop: "1px solid #F9FAFB" }}>
                    {project.repositoryUrl && (
                      <a
                        href={project.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#374151",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#F3F4F6",
                        }}
                      >
                        <Terminal size={11} /> Repository <ExternalLink size={10} />
                      </a>
                    )}
                    {project.demoUrl && (
                      <a
                        href={project.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#059669",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#ECFDF5",
                        }}
                      >
                        <Globe size={11} /> Live Demo <ExternalLink size={10} />
                      </a>
                    )}
                    {project.links?.map((l) => (
                      <a
                        key={l.id || l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#5942DC",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#EDE9FE",
                        }}
                      >
                        <FileText size={11} /> {l.label || l.type} <ExternalLink size={10} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Complete Add / Edit Project Modal with Progressive Disclosure */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(23, 22, 38, 0.45)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              maxWidth: 780,
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#FAF9F6",
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#171626", margin: "0 0 2px" }}>
                  {modalMode === "edit" ? "Edit Project" : "Add Project"}
                </h2>
                <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
                  Structured engineering ledger with attribution and verifiable evidence boundaries.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  color: "#6B7280",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Creation Method Switcher (Only on Create mode) */}
            {modalMode === "create" && (
              <div
                style={{
                  display: "flex",
                  padding: "12px 24px",
                  gap: 10,
                  borderBottom: "1px solid #F3F4F6",
                  background: "#FFFFFF",
                }}
              >
                <button
                  type="button"
                  onClick={() => setCreationMethod("manual")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: creationMethod === "manual" ? "#EDE9FE" : "#F3F4F6",
                    color: creationMethod === "manual" ? "#5942DC" : "#4B5563",
                  }}
                >
                  Add Manually
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMethod("github")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: creationMethod === "github" ? "#EDE9FE" : "#F3F4F6",
                    color: creationMethod === "github" ? "#5942DC" : "#4B5563",
                  }}
                >
                  <Github size={14} /> Import from GitHub
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMethod("link")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: creationMethod === "link" ? "#EDE9FE" : "#F3F4F6",
                    color: creationMethod === "link" ? "#5942DC" : "#4B5563",
                  }}
                >
                  <Link2 size={14} /> Import from Link
                </button>
              </div>
            )}

            {/* Modal Body / Scrollable Content */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Error banner */}
              {formError && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#FEF2F2",
                    borderRadius: 10,
                    border: "1px solid #FEE2E2",
                    color: "#991B1B",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              {/* GitHub Import Tab */}
              {creationMethod === "github" && (
                <div style={{ background: "#F9FAFB", padding: 18, borderRadius: 12, border: "1px solid #E5E7EB" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#171626", margin: "0 0 8px" }}>
                    Fetch Public Repositories
                  </h3>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 12px" }}>
                    Select an accessible GitHub repository to pre-fill metadata, detected dependencies, and code provenance.
                  </p>
                  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                    <input
                      type="text"
                      placeholder="Enter GitHub username (e.g., octocat)"
                      value={ghUsername}
                      onChange={(e) => setGhUsername(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #D1D5DB",
                        fontSize: 13,
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleFetchGitHubRepos}
                      disabled={ghLoading}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "#171626",
                        color: "#FFF",
                        fontWeight: 600,
                        fontSize: 13,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {ghLoading ? "Fetching..." : "Fetch Repos"}
                    </button>
                  </div>

                  {ghError && (
                    <p style={{ fontSize: 12, color: "#DC2626", margin: "0 0 10px" }}>{ghError}</p>
                  )}

                  {ghRepos.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                      {ghRepos.map((r) => (
                        <div
                          key={r.id || r.title}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            background: "#FFFFFF",
                            border: "1px solid #E5E7EB",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#171626" }}>{r.title}</div>
                            <div style={{ fontSize: 12, color: "#6B7280", maxWidth: 460 }}>{r.description || "No description"}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectGitHubRepo(r)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              background: "#EDE9FE",
                              color: "#5942DC",
                              fontSize: 12,
                              fontWeight: 600,
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            Pre-fill Project
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Link Import Tab */}
              {creationMethod === "link" && (
                <div style={{ background: "#F9FAFB", padding: 18, borderRadius: 12, border: "1px solid #E5E7EB" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#171626", margin: "0 0 8px" }}>
                    Import from Project URL
                  </h3>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 12px" }}>
                    Provide a project URL (GitHub repository, live demo, documentation, or paper). We validate the link safely without SSRF risk.
                  </p>
                  <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                    <input
                      type="url"
                      placeholder="https://github.com/org/project-repo"
                      value={importUrlInput}
                      onChange={(e) => setImportUrlInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #D1D5DB",
                        fontSize: 13,
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleImportLink}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "#5942DC",
                        color: "#FFF",
                        fontWeight: 600,
                        fontSize: 13,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Process Link
                    </button>
                  </div>
                  {linkExtractStatus && (
                    <p style={{ fontSize: 12, color: "#4B5563", margin: 0 }}>{linkExtractStatus}</p>
                  )}
                </div>
              )}

              {/* SECTION A: Basic Project Information */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => toggleSection("basic")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#FAF9F6",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#171626" }}>
                    Section A — Basic Project Information
                  </span>
                  {openSections.basic ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {openSections.basic && (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                        Project Title *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="AI-powered Research Assistant"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                        Short Summary
                      </label>
                      <input
                        type="text"
                        placeholder="A concise 1-2 sentence description of what the project accomplishes."
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                        Detailed Description
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Detailed technical overview, architecture, objectives, and problem solved."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                          Project Type
                        </label>
                        <select
                          value={projectType}
                          onChange={(e) => setProjectType(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        >
                          {PROJECT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                          Category
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        >
                          {PROJECT_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                          Purpose
                        </label>
                        <select
                          value={purpose}
                          onChange={(e) => setPurpose(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        >
                          {PROJECT_PURPOSES.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                          Visibility
                        </label>
                        <select
                          value={visibility}
                          onChange={(e) => setVisibility(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        >
                          {PROJECT_VISIBILITIES.map((v) => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION B: Project Links */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => toggleSection("links")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#FAF9F6",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#171626" }}>
                    Section B — Project Links
                  </span>
                  {openSections.links ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {openSections.links && (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                          GitHub Repository URL
                        </label>
                        <input
                          type="url"
                          placeholder="https://github.com/..."
                          value={repositoryUrl}
                          onChange={(e) => setRepositoryUrl(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                          Live Demo URL
                        </label>
                        <input
                          type="url"
                          placeholder="https://my-app.vercel.app"
                          value={demoUrl}
                          onChange={(e) => setDemoUrl(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                      </div>
                    </div>

                    {/* Additional Links list */}
                    {links.map((link, idx) => (
                      <div key={link.id || idx} style={{ display: "grid", gridTemplateColumns: "140px 140px 1fr 36px", gap: 8, alignItems: "center" }}>
                        <select
                          value={link.type}
                          onChange={(e) => handleUpdateLinkRow(idx, { type: e.target.value as ProjectLinkRecord["type"] })}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        >
                          {PROJECT_LINK_TYPES.map((lt) => (
                            <option key={lt.value} value={lt.value}>{lt.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Label (e.g., Paper PDF)"
                          value={link.label}
                          onChange={(e) => handleUpdateLinkRow(idx, { label: e.target.value })}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        />
                        <input
                          type="url"
                          placeholder="https://..."
                          value={link.url}
                          onChange={(e) => handleUpdateLinkRow(idx, { url: e.target.value })}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveLinkRow(idx)}
                          style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddLinkRow}
                      style={{
                        alignSelf: "flex-start",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "#F3F4F6",
                        color: "#374151",
                        fontSize: 12,
                        fontWeight: 600,
                        border: "1px solid #E5E7EB",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} /> Add Another Link
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION C: Technologies & Skills */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => toggleSection("tech")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#FAF9F6",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#171626" }}>
                    Section C — Technologies & Tools
                  </span>
                  {openSections.tech ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {openSections.tech && (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                      Select the actual libraries and tools used in this project. (Stored with project provenance; separate from verified skill mastery.)
                    </p>

                    {Object.entries(TECH_GROUPS).map(([groupName, options]) => (
                      <div key={groupName}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", marginBottom: 6 }}>
                          {groupName}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {options.map((t) => {
                            const selected = selectedTechs.includes(t);
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => handleToggleTech(t)}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  border: selected ? "1px solid #5942DC" : "1px solid #E5E7EB",
                                  background: selected ? "#EDE9FE" : "#F9FAFB",
                                  color: selected ? "#5942DC" : "#374151",
                                }}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Custom Tech */}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <input
                        type="text"
                        placeholder="Add other technology (e.g., ChromaDB)"
                        value={customTechInput}
                        onChange={(e) => setCustomTechInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomTech(); } }}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomTech}
                        style={{ padding: "6px 12px", borderRadius: 6, background: "#171626", color: "#FFF", fontSize: 12, fontWeight: 600, border: "none" }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION D: Personal Contribution */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => toggleSection("contrib")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#FAF9F6",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#171626" }}>
                    Section D — Personal Contribution (Critical)
                  </span>
                  {openSections.contrib ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {openSections.contrib && (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                      What did you personally work on? A repo does not prove you built everything. Select your specific roles:
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {CONTRIBUTION_ROLES.map((role) => {
                        const selected = selectedRoles.includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => handleToggleRole(role)}
                            style={{
                              padding: "5px 11px",
                              borderRadius: 16,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              border: selected ? "1px solid #5942DC" : "1px solid #E5E7EB",
                              background: selected ? "#5942DC" : "#F9FAFB",
                              color: selected ? "#FFFFFF" : "#374151",
                            }}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                        Describe Your Contribution (in your own words)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g., I implemented the fine-tuning training loop in PyTorch and deployed the FastAPI container; a team member built the UI."
                        value={contributionNote}
                        onChange={(e) => setContributionNote(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION G: AI/ML Project Details */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => toggleSection("aiml")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#FAF9F6",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#171626" }}>
                    Section G — AI/ML Architecture & Results
                  </span>
                  {openSections.aiml ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {openSections.aiml && (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                          Problem Statement
                        </label>
                        <input
                          type="text"
                          placeholder="What problem does this project solve?"
                          value={problemStatement}
                          onChange={(e) => setProblemStatement(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                          Proposed Solution / Method
                        </label>
                        <input
                          type="text"
                          placeholder="How does your solution work?"
                          value={proposedSolution}
                          onChange={(e) => setProposedSolution(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                      </div>
                    </div>

                    {/* Dataset details */}
                    <div style={{ background: "#F9FAFB", padding: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#171626", marginBottom: 8 }}>Dataset Information</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Dataset Name"
                          value={datasetName}
                          onChange={(e) => setDatasetName(e.target.value)}
                          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        />
                        <input
                          type="text"
                          placeholder="Source (e.g., Kaggle, HuggingFace)"
                          value={datasetSource}
                          onChange={(e) => setDatasetSource(e.target.value)}
                          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        />
                        <input
                          type="url"
                          placeholder="Dataset URL"
                          value={datasetUrl}
                          onChange={(e) => setDatasetUrl(e.target.value)}
                          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        />
                        <input
                          type="text"
                          placeholder="License (e.g., MIT, CC-BY-4.0)"
                          value={datasetLicense}
                          onChange={(e) => setDatasetLicense(e.target.value)}
                          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        />
                      </div>
                    </div>

                    {/* Model Details */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <input
                        type="text"
                        placeholder="Model Family (e.g., ResNet, LLaMA)"
                        value={modelFamily}
                        onChange={(e) => setModelFamily(e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                      />
                      <input
                        type="text"
                        placeholder="Algorithm (e.g., LoRA Fine-tuning)"
                        value={algorithm}
                        onChange={(e) => setAlgorithm(e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                      />
                      <input
                        type="text"
                        placeholder="Training Approach (e.g., Supervised)"
                        value={trainingApproach}
                        onChange={(e) => setTrainingApproach(e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                      />
                    </div>

                    {/* Structured Results */}
                    <div style={{ background: "#F9FAFB", padding: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#171626", marginBottom: 6 }}>
                        Reported Experimental Results (No Artificial Scores)
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 60px", gap: 6, marginBottom: 8 }}>
                        <input
                          type="text"
                          placeholder="Metric (e.g., Accuracy)"
                          value={metricName}
                          onChange={(e) => setMetricName(e.target.value)}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        />
                        <input
                          type="text"
                          placeholder="Value (e.g., 94.2%)"
                          value={metricValue}
                          onChange={(e) => setMetricValue(e.target.value)}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        />
                        <input
                          type="text"
                          placeholder="Split (e.g., Test Set)"
                          value={metricSplit}
                          onChange={(e) => setMetricSplit(e.target.value)}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        />
                        <input
                          type="text"
                          placeholder="Baseline (e.g., 88.0%)"
                          value={metricBaseline}
                          onChange={(e) => setMetricBaseline(e.target.value)}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                        />
                        <button
                          type="button"
                          onClick={handleAddMetric}
                          style={{ borderRadius: 6, background: "#5942DC", color: "#FFF", fontSize: 12, fontWeight: 600, border: "none" }}
                        >
                          Add
                        </button>
                      </div>

                      {metricsList.map((m, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 8px", background: "#FFFFFF", borderRadius: 4, marginBottom: 4 }}>
                          <span><strong>{m.metricName}:</strong> {m.metricValue} ({m.datasetSplit})</span>
                          <button type="button" onClick={() => handleRemoveMetric(idx)} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer" }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                          Known Limitations
                        </label>
                        <input
                          type="text"
                          placeholder="What does not work yet?"
                          value={limitations}
                          onChange={(e) => setLimitations(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                          Future Improvements
                        </label>
                        <input
                          type="text"
                          placeholder="Planned optimizations or features"
                          value={futureImprovements}
                          onChange={(e) => setFutureImprovements(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION H: Hardware Project Details (Optional) */}
              {(projectType === "hardware" || projectType === "both") && (
                <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => toggleSection("hardware")}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#FAF9F6",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#171626" }}>
                      Section H — Hardware Project Details
                    </span>
                    {openSections.hardware ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {openSections.hardware && (
                    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <input
                          type="text"
                          placeholder="Hardware Platform (e.g., Embedded Edge AI)"
                          value={hwPlatform}
                          onChange={(e) => setHwPlatform(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                        <input
                          type="text"
                          placeholder="Microcontroller / SBC (e.g., Jetson Nano, ESP32)"
                          value={hwMicrocontroller}
                          onChange={(e) => setHwMicrocontroller(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <input
                          type="text"
                          placeholder="Sensors (comma-separated)"
                          value={hwSensors}
                          onChange={(e) => setHwSensors(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                        <input
                          type="text"
                          placeholder="Camera Modules (comma-separated)"
                          value={hwCamera}
                          onChange={(e) => setHwCamera(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Testing notes and prototype stage"
                        value={hwTestingNotes}
                        onChange={(e) => setHwTestingNotes(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* SECTION E: Team & Timeline Collapsible */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => toggleSection("team")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#FAF9F6",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#171626" }}>
                    Section E & F — Collaborators, Mentors & Timeline
                  </span>
                  {openSections.team ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {openSections.team && (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="projStruct"
                          checked={projectStructure === "individual"}
                          onChange={() => setProjectStructure("individual")}
                        />
                        Individual Project
                      </label>
                      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="projStruct"
                          checked={projectStructure === "team"}
                          onChange={() => setProjectStructure("team")}
                        />
                        Team Project
                      </label>
                    </div>

                    {projectStructure === "team" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <input
                          type="text"
                          placeholder="Team Name (Optional)"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                        <input
                          type="text"
                          placeholder="Team Members (e.g., Jane Doe, John Smith)"
                          value={teamMembersText}
                          onChange={(e) => setTeamMembersText(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                        />
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="Mentors / Advisors (e.g., Dr. Sharma - Lab Supervisor)"
                      value={mentorsText}
                      onChange={(e) => setMentorsText(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}
                    />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <input
                        type="date"
                        placeholder="Start Date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                      />
                      <input
                        type="date"
                        placeholder="End Date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                      />
                      <input
                        type="text"
                        placeholder="Institution / Lab"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer / Save Actions */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#FAF9F6",
              }}
            >
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #D1D5DB",
                  background: "#FFF",
                  color: "#374151",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                {modalMode === "create" && (
                  <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={isSubmitting}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #D1D5DB",
                      background: "#FFFFFF",
                      color: "#171626",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Save Draft
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    background: "#5942DC",
                    color: "#FFF",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Check size={16} />
                  {isSubmitting
                    ? "Saving..."
                    : modalMode === "edit"
                    ? "Update Project"
                    : "Save Project"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
