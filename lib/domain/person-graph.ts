import { getPerson360 } from "../services/person-360-service";
import { getProjectsByPersonId, getProjectContributionsByPersonId } from "../repositories/project-repository";
import { getExternalConnections } from "../repositories/connection-repository";
import {
  getLearningActivitiesByPersonId,
  getCodingActivitiesByPersonId,
  getStudentAssessments,
  getStudentInterviews,
} from "../repositories/integration-repository";
import type { StudentActivity } from "./integrations";
import { getUnifiedStudentActivities } from "../services/activity-service";
import { AI_ML_TECH_REGISTRY } from "../connectors/github/mapper";
import { SkillIntelligenceService } from "../services/skill-intelligence-service";

export type SkillEvidenceState =
  | "Unknown"
  | "Claimed"
  | "Evidence available"
  | "Demonstrated"
  | "Verified";

export type SkillGraphNode = {
  name: string;
  category: "AI & ML" | "GenAI" | "Data" | "Backend" | "Tools" | "Cloud" | "Other";
  state: SkillEvidenceState;
  level?: import("../services/skill-intelligence-service").SkillProficiencyLevel;
  goalRelevance?: import("../services/skill-intelligence-service").GoalRelevance;
  isGoalPrerequisite?: boolean;
  evidenceCount: number;
  evidenceItems: Array<{
    id: string;
    source: string;
    verificationStatus: string;
    sourceReference: string | null;
    observedAt: string;
    interpretation: string;
  }>;
  relatedProjects: Array<{
    id: string;
    title: string;
    repositoryUrl?: string | null;
    personalContributionRoles: string[];
  }>;
  whyTathastuThinksThis: string;
  conciseExplanation?: string;
  sevenQuestions?: import("../services/skill-intelligence-service").SevenQuestionsAnalysis;
  graph?: import("../services/skill-intelligence-service").SkillEvidenceGraph;
  lastObservedAt: string;
};

export type PersonGraphSummary = {
  person: {
    id: string;
    displayName: string;
    degree?: string;
    specialization?: string;
    institution?: string;
    expectedGraduationYear?: number | null;
    currentYear?: string;
    placementStatus?: string;
    internshipStatus?: string;
  };
  goal: {
    id?: string;
    title: string;
    description?: string;
    status: string;
  };
  skills: SkillGraphNode[];
  projects: Array<{
    id: string;
    title: string;
    description: string;
    technologies: string[];
    sources: string[];
    repositoryUrl: string | null;
    status: string;
    personalContributionRoles: string[];
    personalContributionNote: string;
  }>;
  connections: Array<{
    provider: string;
    status: string;
    externalUsername: string;
    lastSyncedAt: string | null;
  }>;
  stats: {
    totalSkills: number;
    evidencedSkills?: number;
    demonstratedSkills: number;
    assessedSkills?: number;
    verifiedSkills: number;
    totalProjects: number;
    totalEvidence: number;
  };
  learningSummary?: {
    totalCompletedModules: number;
    totalInProgressModules: number;
    recentCourses: string[];
    lastActivityAt?: string | null;
  };
  practiceSummary?: {
    totalProblemsSolved: number;
    activeTopics: string[];
    lastPracticedAt?: string | null;
  };
  assessmentSummary?: {
    totalAssessments: number;
    verifiedTopicsCount: number;
    lastAssessmentAt?: string | null;
  };
  interviewSummary?: {
    totalInterviews: number;
    targetRoles: string[];
    lastInterviewAt?: string | null;
  };
  recentActivities?: StudentActivity[];
};

function categorizeSkill(skillName: string): "AI & ML" | "GenAI" | "Data" | "Backend" | "Tools" | "Cloud" | "Other" {
  const norm = skillName.toLowerCase();
  for (const item of AI_ML_TECH_REGISTRY) {
    if (item.name.toLowerCase() === norm || item.regexes.some((r) => r.test(skillName))) {
      if (item.category === "GenAI") return "GenAI";
      if (item.category === "AI & ML") return "AI & ML";
      if (item.category === "Data & Databases") return "Data";
      if (item.category === "Backend & APIs") return "Backend";
      if (item.category === "DevOps & Cloud") return "Cloud";
      return "Tools";
    }
  }
  if (norm.includes("rag") || norm.includes("llm") || norm.includes("langchain") || norm.includes("transformer")) return "GenAI";
  if (norm.includes("ml") || norm.includes("model") || norm.includes("vision") || norm.includes("deep learning")) return "AI & ML";
  if (norm.includes("sql") || norm.includes("data") || norm.includes("pandas")) return "Data";
  if (norm.includes("api") || norm.includes("fastapi") || norm.includes("node") || norm.includes("backend")) return "Backend";
  if (norm.includes("git") || norm.includes("docker") || norm.includes("linux")) return "Tools";
  if (norm.includes("aws") || norm.includes("cloud") || norm.includes("gcp") || norm.includes("azure")) return "Cloud";
  return "Other";
}

export function generateWhyTathastuThinksThis(
  skillName: string,
  state: SkillEvidenceState,
  evidenceItems: Array<{ source: string; verificationStatus: string; interpretation: string }>,
  relatedProjects: Array<{ title: string; personalContributionRoles: string[] }>
): string {
  const reasons: string[] = [];

  const resumeEvidence = evidenceItems.filter((e) => e.source === "resume_extracted" || e.interpretation.toLowerCase().includes("resume"));
  if (resumeEvidence.length > 0) {
    reasons.push("Mentioned in your reviewed resume.");
  }

  const githubEvidence = evidenceItems.filter((e) => e.source === "imported" || e.source === "github");
  if (githubEvidence.length > 0) {
    reasons.push(`Detected from a connected source (${githubEvidence.length} observations); review your personal contribution.`);
  }

  if (relatedProjects.length > 0) {
    const projectTitles = relatedProjects.map((p) => `"${p.title}"`).slice(0, 3).join(", ");
    reasons.push(`Applied in confirmed project implementation: ${projectTitles}.`);

    const withContributions = relatedProjects.filter((p) => p.personalContributionRoles.length > 0);
    if (withContributions.length > 0) {
      const roles = Array.from(new Set(withContributions.flatMap((p) => p.personalContributionRoles))).join(", ");
      reasons.push(`You explicitly confirmed personal role: ${roles}.`);
    }
  }

  const verifiedEvidence = evidenceItems.filter((e) => e.verificationStatus === "verified");
  if (verifiedEvidence.length > 0) {
    reasons.push("Independently verified by authorized faculty or assessment engine.");
  } else if (state === "Demonstrated") {
    reasons.push("Practical demonstration exists, but this skill has not yet been independently verified.");
  } else if (state === "Claimed") {
    reasons.push("Currently self-reported without verified project or assessment proof.");
  }

  if (reasons.length === 0) {
    return `${skillName} is part of your target learning roadmap.`;
  }

  return reasons.join(" ");
}

export async function buildPersonGraph(personId: string): Promise<PersonGraphSummary> {
  const [
    person360,
    projectsList,
    contributionsList,
    connectionsList,
    learningList,
    codingList,
    assessmentsList,
    interviewsList,
    recentActivitiesList,
  ] = await Promise.all([
    getPerson360(personId, personId),
    getProjectsByPersonId(personId),
    getProjectContributionsByPersonId(personId),
    getExternalConnections(personId),
    getLearningActivitiesByPersonId(personId).catch(() => []),
    getCodingActivitiesByPersonId(personId).catch(() => []),
    getStudentAssessments(personId).catch(() => []),
    getStudentInterviews(personId).catch(() => []),
    getUnifiedStudentActivities(personId, 10).catch(() => []),
  ]);

  const contributionsMap = new Map<string, { roles: string[]; description: string }>();
  for (const c of contributionsList) {
    contributionsMap.set(c.projectId, {
      roles: (c.roles as string[]) || [],
      description: c.description || "",
    });
  }

  // Map confirmed projects
  const confirmedProjects = projectsList
    .filter((p) => p.status === "confirmed")
    .map((p) => {
      const contrib = contributionsMap.get(p.id) || { roles: [], description: "" };
      return {
        id: p.id,
        title: p.title,
        description: p.description || "",
        technologies: (p.technologies as string[]) || [],
        sources: (p.sources as string[]) || [],
        repositoryUrl: p.repositoryUrl || null,
        status: p.status,
        personalContributionRoles: contrib.roles,
        personalContributionNote: contrib.description,
      };
    });

  // Build canonical explainable skill intelligence
  const intel = await SkillIntelligenceService.getSkillsIntelligence(personId);

  const skillNodes: SkillGraphNode[] = intel.skills.map((s) => {
    let mappedState: SkillEvidenceState = "Claimed";
    if (s.level === "Verified" || s.level === "Assessed") {
      mappedState = "Verified";
    } else if (s.level === "Demonstrated") {
      mappedState = "Demonstrated";
    } else if (s.level === "Applied evidence available" || s.level === "Exposure recorded") {
      mappedState = "Evidence available";
    } else if (s.level === "Claimed") {
      mappedState = "Claimed";
    } else {
      mappedState = "Unknown";
    }

    const cat: "AI & ML" | "GenAI" | "Data" | "Backend" | "Tools" | "Cloud" | "Other" =
      s.category === "Languages" ? "Tools" : (s.category as any);

    return {
      name: s.canonicalName,
      category: cat,
      state: mappedState,
      level: s.level,
      goalRelevance: s.goalRelevance,
      isGoalPrerequisite: s.isGoalPrerequisite,
      evidenceCount: s.observations.length,
      evidenceItems: s.observations.map((o) => ({
        id: o.id,
        source: o.source,
        verificationStatus: o.sourceType === "faculty_verification" ? "verified" : "unverified",
        sourceReference: o.sourceReference,
        observedAt: o.observedAt,
        interpretation: o.summary,
      })),
      relatedProjects: s.dimensions.demonstratedApplication.projects.map((p) => ({
        id: p.id,
        title: p.title,
        repositoryUrl: p.repositoryUrl || null,
        personalContributionRoles: p.roles,
      })),
      whyTathastuThinksThis: s.conciseExplanation,
      conciseExplanation: s.conciseExplanation,
      sevenQuestions: s.sevenQuestions,
      graph: s.graph,
      lastObservedAt: s.lastObservedAt,
    };
  });

  return {
    person: {
      id: person360.person.id,
      displayName: person360.person.displayName,
      degree: person360.profile?.degree || "",
      specialization: person360.profile?.specialization || "",
      institution: person360.profile?.institution || "",
      expectedGraduationYear: person360.profile?.expectedGraduationYear || null,
      currentYear: person360.profile?.currentYear || "",
      placementStatus: person360.profile?.placementStatus || "preparing",
      internshipStatus: person360.profile?.internshipStatus || "seeking",
    },
    goal: {
      id: person360.activeGoal?.id,
      title: intel.targetRole || person360.activeGoal?.title || "GenAI Engineer",
      description: person360.activeGoal?.description || "",
      status: person360.activeGoal?.status || "active",
    },
    skills: skillNodes,
    projects: confirmedProjects,
    connections: connectionsList.map((c) => ({
      provider: c.provider,
      status: c.status,
      externalUsername: c.externalUsername,
      lastSyncedAt: c.lastSyncedAt ? new Date(c.lastSyncedAt).toISOString() : null,
    })),
    stats: {
      totalSkills: intel.stats.trackedSkills,
      evidencedSkills: intel.stats.evidencedSkills,
      demonstratedSkills: intel.stats.demonstratedSkills,
      assessedSkills: intel.stats.assessedSkills,
      verifiedSkills: intel.stats.verifiedSkills,
      totalProjects: confirmedProjects.length,
      totalEvidence: person360.evidence?.length || 0,
    },
    learningSummary: {
      totalCompletedModules: learningList.filter((l) => l.status === "completed").length,
      totalInProgressModules: learningList.filter((l) => l.status === "started" || l.status === "progressed").length,
      recentCourses: Array.from(new Set(learningList.map((l) => l.courseTitle).filter(Boolean) as string[])).slice(0, 3),
      lastActivityAt: learningList[0]?.completedAt || learningList[0]?.startedAt || null,
    },
    practiceSummary: {
      totalProblemsSolved: codingList.filter((c) => c.status === "completed").length,
      activeTopics: Array.from(new Set(codingList.map((c) => c.topic))).slice(0, 5),
      lastPracticedAt: codingList[0]?.completedAt || codingList[0]?.createdAt || null,
    },
    assessmentSummary: {
      totalAssessments: assessmentsList.length,
      verifiedTopicsCount: assessmentsList.reduce((acc, a) => acc + (a.topics?.length || 0), 0),
      lastAssessmentAt: assessmentsList[0]?.completedAt || assessmentsList[0]?.createdAt || null,
    },
    interviewSummary: {
      totalInterviews: interviewsList.length,
      targetRoles: Array.from(new Set(interviewsList.map((i) => i.targetRole))),
      lastInterviewAt: interviewsList[0]?.completedAt || interviewsList[0]?.createdAt || null,
    },
    recentActivities: recentActivitiesList,
  };
}
