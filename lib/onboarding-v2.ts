import { createEvidenceItem, summarizeEvidence } from "@/lib/domain/evidence";
export const STORAGE_KEY = "ai-tathastu-onboarding-v2";
export const stageIds = [
  "name",
  "welcome",
  "role",
  "direction",
  "priorities",
  "academic",
  "resume",
  "footprints",
  "analysis",
  "insights",
  "python",
  "technologies",
  "certifications",
  "projects",
  "contribution",
  "goal",
  "reveal",
] as const;
export type StageId = (typeof stageIds)[number];
export type SourceId = "github" | "linkedin" | "leetcode" | "hackerrank" | "hackerearth" | "codechef";
export type Project = {
  id: string;
  title: string;
  description?: string;
  technologies: string[];
  sources: string[];
  status: "suggested" | "confirmed" | "removed";
  contribution: string[];
  contributionNote: string;
  url?: string;
  aiPurpose?: string;
  uncertaintyNotes?: string[];
};
export type ReviewedResumeClaim = {
  candidateId?: string;
  category: "education" | "experience" | "project" | "skill" | "certification" | "achievement";
  value: string;
  sourceSpan: string;
  documentId: string;
  corrected: boolean;
};

export type OnboardingDraft = {
  version: 2;
  stage: StageId;
  name: string;
  role: string;
  targetRole: string;
  targetRoleId?: string;
  targetTimeline?: string;
  customGoalText?: string;
  degree: string;
  specialization: string;
  institution?: string;
  year: string;
  semester: string;
  expectedGraduationYear?: number;
  resume: "pending" | "processed" | "skipped" | "unreadable";
  resumeSuggestions: { education: string; skills: string; experience: string };
  acceptedResumeSkills: string[];
  resumeReviewed: ReviewedResumeClaim[];
  certificationSuggestions: { title: string; status: "suggested" | "kept" | "removed" }[];
  profiles: Partial<Record<SourceId, string>>;
  githubConsent: boolean;
  python: "yes" | "not_yet" | "";
  skills: string[];
  certifications: string[];
  projects: Project[];
  education?: OnboardingEducationEntry[];
  experiences?: OnboardingExperienceEntry[];
  achievements?: OnboardingAchievementEntry[];
  goal: string;
  priorities?: string[];
  primaryPriority?: string;
  discoveredResumeProfiles?: Partial<Record<string, string>>;
  completed: boolean;
};

export type OnboardingEducationEntry = {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  graduationYear?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  percentage?: string;
  academicLevel?: "undergraduate" | "postgraduate" | "high_school" | "diploma" | "doctorate";
  status?: "candidate" | "confirmed";
  source?: string;
};

export type OnboardingExperienceEntry = {
  company: string;
  role: string;
  type?: "employment" | "internship" | "freelance" | "founder" | "leadership" | "volunteering" | "other";
  duration?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  technologies?: string[];
  status?: "candidate" | "confirmed";
  source?: string;
};

export type OnboardingAchievementEntry = {
  title: string;
  category: "award" | "certification" | "competition" | "publication" | "patent" | "academic";
  subType?: "patent_application" | "patent_granted" | "published_paper" | "manuscript" | "book" | "book_coauthor" | "hackathon" | "honor" | "other";
  status?: string;
  issuer?: string;
  date?: string;
  description?: string;
  candidateId?: string;
  source?: string;
};

export const initialDraft: OnboardingDraft = {
  version: 2,
  stage: "name",
  name: "",
  role: "student",
  targetRole: "",
  targetRoleId: "",
  targetTimeline: "",
  customGoalText: "",
  degree: "",
  specialization: "",
  institution: "",
  year: "",
  semester: "",
  resume: "pending",
  resumeSuggestions: { education: "", skills: "", experience: "" },
  acceptedResumeSkills: [],
  resumeReviewed: [],
  certificationSuggestions: [],
  profiles: {},
  githubConsent: false,
  python: "",
  skills: [],
  certifications: [],
  projects: [],
  education: [],
  experiences: [],
  achievements: [],
  goal: "",
  priorities: [],
  primaryPriority: undefined,
  completed: false,
};

export const stageConfig: Record<
  StageId,
  { section: string; optional: boolean; canContinue: (draft: OnboardingDraft) => boolean }
> = {
  name: { section: "Meet EORA", optional: false, canContinue: (d) => d.name.trim().length >= 2 },
  welcome: { section: "Meet EORA", optional: false, canContinue: () => true },
  role: { section: "Profile", optional: false, canContinue: (d) => d.role === "student" },
  direction: { section: "Direction", optional: false, canContinue: (d) => Boolean(d.targetRole && d.goal) },
  priorities: { section: "Direction", optional: false, canContinue: () => true },
  academic: {
    section: "Profile",
    optional: false,
    canContinue: (d) => Boolean(d.degree && d.specialization && d.year),
  },
  resume: { section: "Profile", optional: true, canContinue: (d) => d.resume !== "pending" },
  footprints: { section: "Footprints", optional: true, canContinue: () => true },
  analysis: { section: "Footprints", optional: false, canContinue: () => true },
  insights: { section: "Footprints", optional: false, canContinue: () => true },
  python: { section: "Skills", optional: false, canContinue: (d) => Boolean(d.python) },
  technologies: { section: "Skills", optional: true, canContinue: () => true },
  certifications: { section: "Skills", optional: true, canContinue: () => true },
  projects: { section: "Projects", optional: true, canContinue: () => true },
  contribution: { section: "Projects", optional: true, canContinue: () => true },
  goal: { section: "Goal", optional: false, canContinue: (d) => Boolean(d.goal.trim()) },
  reveal: { section: "Goal", optional: false, canContinue: () => true },
};

export const sections = ["Meet EORA", "Direction", "Profile", "Footprints", "Skills", "Projects", "Goal"];

export function nextStage(stage: StageId): StageId {
  return stageIds[Math.min(stageIds.length - 1, stageIds.indexOf(stage) + 1)];
}

export function previousStage(stage: StageId): StageId {
  return stageIds[Math.max(0, stageIds.indexOf(stage) - 1)];
}

export function safeDraft(value: unknown): OnboardingDraft {
  if (!value || typeof value !== "object") return initialDraft;
  const raw = value as Partial<OnboardingDraft>;
  const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
  const strings = (v: unknown) =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string")
          .slice(0, 80)
          .map((x) => x.slice(0, 120))
      : [];
  const profiles: OnboardingDraft["profiles"] = {};
  for (const id of ["github", "linkedin", "leetcode", "hackerrank", "hackerearth", "codechef"] as SourceId[]) {
    if (raw.profiles?.[id]) profiles[id] = str(raw.profiles[id], 300);
  }
  const gradYear =
    typeof raw.expectedGraduationYear === "number" && !isNaN(raw.expectedGraduationYear)
      ? raw.expectedGraduationYear
      : raw.year && /20\d\d/.test(raw.year)
      ? parseInt(raw.year.match(/20\d\d/)![0], 10)
      : undefined;
  const priorities = Array.isArray(raw.priorities) ? strings(raw.priorities) : [];
  const primaryPriority = raw.primaryPriority ? str(raw.primaryPriority) : undefined;

  return {
    version: 2,
    stage: stageIds.includes(raw.stage as StageId) ? (raw.stage as StageId) : "name",
    name: str(raw.name, 80),
    role: str(raw.role, 40) || "student",
    targetRole: str(raw.targetRole, 100),
    targetRoleId: raw.targetRoleId ? str(raw.targetRoleId, 60) : undefined,
    targetTimeline: str(raw.targetTimeline, 80),
    customGoalText: str(raw.customGoalText, 200),
    degree: str(raw.degree, 100),
    specialization: str(raw.specialization, 100),
    institution: str(raw.institution, 140),
    year: str(raw.year, 30),
    semester: str(raw.semester, 30),
    expectedGraduationYear: gradYear,
    resume: ["pending", "processed", "skipped", "unreadable"].includes(raw.resume || "")
      ? raw.resume!
      : "pending",
    resumeSuggestions: {
      education: str(raw.resumeSuggestions?.education),
      skills: str(raw.resumeSuggestions?.skills),
      experience: str(raw.resumeSuggestions?.experience),
    },
    acceptedResumeSkills: strings(raw.acceptedResumeSkills),
    resumeReviewed: Array.isArray(raw.resumeReviewed) ? raw.resumeReviewed.slice(0, 100).filter((claim): claim is ReviewedResumeClaim =>
      Boolean(claim && ["education", "experience", "project", "skill", "certification", "achievement"].includes(claim.category) &&
      typeof claim.value === "string" && typeof claim.sourceSpan === "string" &&
      typeof claim.documentId === "string" && /^[a-f0-9]{64}$/.test(claim.documentId))
    ).map((claim) => ({ candidateId: str(claim.candidateId, 80) || undefined, category: claim.category, value: str(claim.value, 300), sourceSpan: str(claim.sourceSpan, 300), documentId: claim.documentId, corrected: claim.corrected === true })) : [],
    certificationSuggestions: Array.isArray(raw.certificationSuggestions)
      ? raw.certificationSuggestions
          .slice(0, 20)
          .filter((x) => x && typeof x.title === "string")
          .map((x) => ({
            title: str(x.title, 140),
            status: x.status === "kept" || x.status === "removed" ? x.status : "suggested",
          }))
      : [],
    profiles,
    githubConsent: raw.githubConsent === true,
    python: raw.python === "yes" || raw.python === "not_yet" ? raw.python : "",
    skills: strings(raw.skills),
    certifications: strings(raw.certifications),
    projects: Array.isArray(raw.projects)
      ? raw.projects
          .slice(0, 30)
          .filter((p) => p && typeof p.title === "string")
          .map((p) => ({
            id: str(p.id, 80),
            title: str(p.title, 180),
            description: str(p.description, 500),
            technologies: strings(p.technologies),
            sources: strings(p.sources),
            status: p.status === "confirmed" || p.status === "removed" ? p.status : "suggested",
            contribution: strings(p.contribution),
            contributionNote: str(p.contributionNote),
            url: str(p.url, 500),
            aiPurpose: str(p.aiPurpose, 1000),
            uncertaintyNotes: strings(p.uncertaintyNotes),
          }))
      : [],
    education: Array.isArray(raw.education)
      ? raw.education
          .slice(0, 10)
          .filter((e) => e && typeof e.institution === "string")
          .map((e) => ({
            institution: str(e.institution, 180),
            degree: e.degree ? str(e.degree, 120) : undefined,
            fieldOfStudy: e.fieldOfStudy ? str(e.fieldOfStudy, 120) : undefined,
            graduationYear: e.graduationYear ? str(e.graduationYear, 20) : undefined,
            startDate: e.startDate ? str(e.startDate, 30) : undefined,
            endDate: e.endDate ? str(e.endDate, 30) : undefined,
            gpa: e.gpa ? str(e.gpa, 20) : undefined,
            percentage: e.percentage ? str(e.percentage, 20) : undefined,
            academicLevel: ["undergraduate", "postgraduate", "high_school", "diploma", "doctorate"].includes(e.academicLevel || "")
              ? (e.academicLevel as OnboardingEducationEntry["academicLevel"])
              : undefined,
            status: e.status === "confirmed" ? "confirmed" : "candidate",
            source: e.source ? str(e.source, 60) : undefined,
          }))
      : [],
    experiences: Array.isArray(raw.experiences)
      ? raw.experiences
          .slice(0, 20)
          .filter((e) => e && typeof e.company === "string")
          .map((e) => ({
            company: str(e.company, 150),
            role: str(e.role, 120),
            type: ["employment", "internship", "freelance", "founder", "leadership", "volunteering", "other"].includes(e.type || "")
              ? (e.type as OnboardingExperienceEntry["type"])
              : undefined,
            duration: e.duration ? str(e.duration, 60) : undefined,
            startDate: e.startDate ? str(e.startDate, 30) : undefined,
            endDate: e.endDate ? str(e.endDate, 30) : undefined,
            highlights: Array.isArray(e.highlights) ? strings(e.highlights) : undefined,
            technologies: Array.isArray(e.technologies) ? strings(e.technologies) : undefined,
            status: e.status === "confirmed" ? "confirmed" : "candidate",
            source: e.source ? str(e.source, 60) : undefined,
          }))
      : [],
    achievements: Array.isArray(raw.achievements)
      ? raw.achievements
          .slice(0, 30)
          .filter((a) => a && typeof a.title === "string")
          .map((a) => ({
            title: str(a.title, 200),
            category: ["award", "certification", "competition", "publication", "patent", "academic"].includes(a.category)
              ? a.category
              : "academic",
            subType: ["patent_application", "patent_granted", "published_paper", "manuscript", "book", "book_coauthor", "hackathon", "honor", "other"].includes(a.subType || "")
              ? (a.subType as OnboardingAchievementEntry["subType"])
              : undefined,
            status: a.status ? str(a.status, 60) : undefined,
            issuer: a.issuer ? str(a.issuer, 120) : undefined,
            date: a.date ? str(a.date, 40) : undefined,
            description: a.description ? str(a.description, 400) : undefined,
            candidateId: a.candidateId ? str(a.candidateId, 80) : undefined,
            source: a.source ? str(a.source, 60) : undefined,
          }))
      : [],
    goal: str(raw.goal, 160),
    priorities,
    primaryPriority,
    discoveredResumeProfiles:
      raw.discoveredResumeProfiles && typeof raw.discoveredResumeProfiles === "object"
        ? Object.fromEntries(
            Object.entries(raw.discoveredResumeProfiles)
              .filter(([k, v]) => typeof k === "string" && typeof v === "string")
              .map(([k, v]) => [k, str(v, 300)])
          )
        : undefined,
    completed: raw.completed === true,
  };
}

export function startingPicture(draft: OnboardingDraft) {
  const evidence = [
    ...(draft.degree && draft.specialization && draft.year
      ? [
          createEvidenceItem({
            category: "education",
            subject: draft.specialization,
            value: `${draft.degree} · ${draft.specialization} · ${draft.year}`,
            source: "self_reported",
            verificationStatus: "self_reported",
          }),
        ]
      : []),
    ...(draft.targetRole
      ? [
          createEvidenceItem({
            category: "goal",
            subject: `Target Role: ${draft.targetRole}`,
            value: draft.targetRole,
            source: "self_reported",
            verificationStatus: "self_reported",
          }),
        ]
      : []),
    ...(draft.goal
      ? [
          createEvidenceItem({
            category: "goal",
            subject: `Target Goal: ${draft.goal}`,
            value: draft.goal,
            source: "self_reported",
            verificationStatus: "self_reported",
          }),
        ]
      : []),
    ...draft.skills.map((skill) =>
      createEvidenceItem({
        category: "skill",
        subject: skill,
        value: skill,
        source: "self_reported",
        verificationStatus: "self_reported",
      })
    ),
    ...draft.projects
      .filter((project) => project.status === "confirmed")
      .map((project) =>
        createEvidenceItem({
          category: "project",
          subject: project.title,
          value: project.title,
          source: "self_reported",
          verificationStatus: "self_reported",
        })
      ),
  ];
  return summarizeEvidence(evidence);
}
