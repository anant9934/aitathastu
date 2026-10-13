import { fetchGitHubProjects } from "../connectors/github/client";
import { saveSourceSnapshot, saveExternalConnection, getSourceSnapshots } from "../repositories/connection-repository";
import { saveProject, saveProjectContribution, getProjectsByPersonId, type CreateProjectInput } from "../repositories/project-repository";
import { createEvidenceRecord } from "../repositories/evidence-repository";
import { CrossSourceFusionService } from "../services/cross-source-fusion-service";

export type ProjectCandidate = {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  sources: string[];
  repositoryUrl?: string;
  status: "candidate" | "confirmed" | "removed";
  contributionRoles: string[];
  contributionNote: string;
  ambiguousDuplicate?: boolean;
};

function deduplicateProjects(
  githubProjects: Array<{ title: string; description: string; technologies: string[]; repositoryUrl?: string }>,
  resumeProjects: Array<{ title: string; description?: string; technologies?: string[] }>
): ProjectCandidate[] {
  const mergedMap = new Map<string, ProjectCandidate>();

  const normalize = (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

  // Add GitHub projects
  for (const gh of githubProjects) {
    const key = normalize(gh.title);
    if (!key) continue;
    mergedMap.set(key, {
      id: `proj_gh_${key}`,
      title: gh.title,
      description: gh.description || "Project discovered from GitHub.",
      technologies: gh.technologies || [],
      sources: ["github"],
      repositoryUrl: gh.repositoryUrl,
      status: "candidate",
      contributionRoles: [],
      contributionNote: "",
      ambiguousDuplicate: false,
    });
  }

  // Merge Resume projects
  for (const res of resumeProjects) {
    const key = normalize(res.title);
    if (!key) continue;
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      existing.sources = Array.from(new Set([...existing.sources, "resume"]));
      existing.technologies = Array.from(
        new Set([...existing.technologies, ...(res.technologies || [])])
      );
      if (!existing.description && res.description) {
        existing.description = res.description;
      }
      existing.ambiguousDuplicate = true; // Flag that this project exists in multiple sources
    } else {
      mergedMap.set(key, {
        id: `proj_res_${key}`,
        title: res.title,
        description: res.description || "Project extracted from resume.",
        technologies: res.technologies || [],
        sources: ["resume"],
        status: "candidate",
        contributionRoles: [],
        contributionNote: "",
        ambiguousDuplicate: false,
      });
    }
  }

  return Array.from(mergedMap.values());
}

export async function getProjectCandidatesForPerson(personId: string): Promise<ProjectCandidate[]> {
  // 1. Fetch GitHub snapshots
  const snapshots = await getSourceSnapshots(personId, "github");
  const githubProjects: Array<{ title: string; description: string; technologies: string[]; repositoryUrl?: string }> = [];

  for (const snap of snapshots) {
    const data = snap.snapshotData as Record<string, unknown> | null;
    if (data && data.isPrivate !== true && typeof data.title === "string") {
      githubProjects.push({
        title: data.title,
        description: (data.description as string) || "",
        technologies: (data.technologies as string[]) || [],
        repositoryUrl: snap.sourceReference,
      });
    }
  }

  // 2. Fetch Resume snapshots
  const resumeSnapshots = await getSourceSnapshots(personId, "resume");
  const resumeProjects: Array<{ title: string; description?: string; technologies?: string[] }> = [];

  for (const snap of resumeSnapshots) {
    const data = snap.snapshotData as Record<string, unknown> | null;
    const extracted = data?.extractedProjects || (Array.isArray(data?.candidates)
      ? data.candidates.filter((candidate): candidate is { category: string; value: string } =>
        Boolean(candidate && typeof candidate === "object" && candidate.category === "project" && typeof candidate.value === "string")
      ).map((candidate) => ({ title: candidate.value }))
      : []);
    if (Array.isArray(extracted)) {
      for (const item of extracted) {
        const p = item as { title?: string; description?: string; technologies?: string[] };
        if (p.title) {
          resumeProjects.push({
            title: p.title,
            description: p.description,
            technologies: p.technologies,
          });
        }
      }
    }
  }

  // 3. Deduplicate
  const candidates = deduplicateProjects(githubProjects, resumeProjects);

  // 4. Exclude already confirmed projects
  const confirmed = await getProjectsByPersonId(personId);
  const confirmedTitles = new Set(
    confirmed
      .filter((p) => p.status === "confirmed")
      .map((p) => p.title.toLowerCase().replace(/[^a-z0-9]/g, "").trim())
  );

  return candidates.filter((c) => {
    const key = c.title.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    return !confirmedTitles.has(key);
  });
}

export async function confirmDiscoveredProject(
  personId: string,
  project: {
    title: string;
    summary?: string;
    description?: string;
    category?: string;
    purpose?: string;
    visibility?: string;
    projectType?: string;
    technologies: string[];
    sources: string[];
    repositoryUrl?: string;
    demoUrl?: string;
    contributionRoles: string[];
    contributionNote?: string;
    links?: CreateProjectInput["links"];
    timeline?: CreateProjectInput["timeline"];
    team?: CreateProjectInput["team"];
    aiDetails?: CreateProjectInput["aiDetails"];
    hardwareDetails?: CreateProjectInput["hardwareDetails"];
    media?: unknown[];
  }
) {
  // 1. Save to normalized projects table
  const savedProject = await saveProject(personId, {
    title: project.title,
    summary: project.summary,
    description: project.description || "",
    category: project.category,
    purpose: project.purpose,
    visibility: project.visibility,
    projectType: project.projectType || "software",
    technologies: project.technologies,
    sources: project.sources,
    repositoryUrl: project.repositoryUrl,
    demoUrl: project.demoUrl,
    status: "confirmed",
    links: project.links,
    timeline: project.timeline,
    team: project.team,
    aiDetails: project.aiDetails,
    hardwareDetails: project.hardwareDetails,
    media: project.media,
  });

  // 2. Save personal contribution in projectContributions table
  await saveProjectContribution(
    savedProject.id,
    personId,
    project.contributionRoles,
    project.contributionNote || ""
  );

  // 3. Add Project Evidence (marked as self_reported / unverified)
  const sourceRef = project.repositoryUrl || project.sources.join(", ");
  await createEvidenceRecord(personId, {
    category: "project",
    subject: project.title,
    value: project.title,
    source: project.sources.includes("github") ? "imported" : "self_reported",
    verificationStatus: "self_reported",
    sourceReference: sourceRef,
    interpretation: `Confirmed project. Sources: ${project.sources.join(", ")}. A repository does not establish authorship of every component.`,
    whyItMatters: "Demonstrates applied practical experience. Detailed role breakdown is captured separately.",
    importKey: `acq_proj_${personId}_${savedProject.id}`,
  });

  // 4. Add personal contribution evidence if specified
  const contributionSummary = [...project.contributionRoles, project.contributionNote].filter(Boolean).join(", ");
  if (contributionSummary) {
    await createEvidenceRecord(personId, {
      category: "other",
      subject: `Personal contribution to ${project.title}`,
      value: contributionSummary,
      source: "self_reported",
      verificationStatus: "self_reported",
      interpretation: "Self-reported breakdown of personal contributions to this project.",
      whyItMatters: "Clarifies which subsystems were built personally versus created by team collaborators or libraries.",
      importKey: `acq_contrib_${personId}_${savedProject.id}`,
    });
  }

  // 5. Register demonstrated skills from detected technologies (as unverified evidence)
  for (const tech of project.technologies) {
    const slug = tech.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    await createEvidenceRecord(personId, {
      category: "skill",
      subject: tech,
      value: tech,
      source: project.sources.includes("github") ? "imported" : "self_reported",
      verificationStatus: "unverified",
      sourceReference: sourceRef,
      interpretation: `Detected in project "${project.title}". Not independently assessed or verified.`,
      whyItMatters: "Provides context for skill demonstration through applied implementation.",
      importKey: `acq_skill_${personId}_${slug}`,
    });
  }

  // 6. Record Person 360 Profile Version update
  await CrossSourceFusionService.recordProfileVersion(
    personId,
    "project_confirmed",
    `Confirmed project: ${project.title} with sources [${project.sources.join(", ")}].`,
    {
      projectId: savedProject.id,
      title: project.title,
      sources: project.sources,
      technologies: project.technologies,
    }
  );

  return savedProject;
}
