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
  "goal", // legacy stage id: kept so drafts saved before Task 2.1.1 still parse
  "reveal",
] as const;
export type StageId = (typeof stageIds)[number];
export type SourceId = "github" | "linkedin" | "leetcode" | "hackerrank" | "hackerearth" | "codechef" | "portfolio" | "huggingface" | "orcid" | "kaggle" | "devto" | "stackoverflow" | "google_scholar";
export type Project = ReviewEditMeta & {
  stars?: number;
  isFork?: boolean;
  id: string;
  title: string;
  description?: string;
  technologies: string[];
  sources: string[];
  status: "candidate" | "suggested" | "confirmed" | "removed";
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
  currentScreen?: number;
  name: string;
  role: string;
  targetRole: string;
  targetRoleId?: string;
  degree: string;
  specialization: string;
  institution?: string;
  year: string;
  semester: string;
  expectedGraduationYear?: number;
  resume: "pending" | "processed" | "skipped" | "unreadable";
  /** The uploaded CV, so a refresh can rehydrate its review from the server. */
  resumeDocumentId?: string;
  resumeFileName?: string;
  resumeSuggestions: { education: string; skills: string; experience: string };
  acceptedResumeSkills: string[];
  resumeReviewed: ReviewedResumeClaim[];
  certificationSuggestions: { title: string; status: "suggested" | "kept" | "removed" }[];
  profiles: Partial<Record<SourceId, string>>;
  githubConsent: boolean;
  python: "yes" | "not_yet" | "";
  skills: string[];
  techCandidates?: Array<ReviewEditMeta & { name: string; category?: string; source: string; provenance?: string; sourceFile?: string; status?: "candidate" | "rejected" }>;
  certifications: string[];
  projects: Project[];
  education?: OnboardingEducationEntry[];
  experiences?: OnboardingExperienceEntry[];
  achievements?: OnboardingAchievementEntry[];
  priorities?: string[];
  primaryPriority?: string;
  discoveredResumeProfiles?: Partial<Record<string, string>>;
  /** Screens fully covered by accepted resume data; onboarding skips them (lib/onboarding-resume-coverage.ts). */
  resumeCoveredScreens?: number[];
  completed: boolean;
};

/**
 * Review edits (Task 2.1.4). `originKey` is the entry's merge key from when it
 * was imported, kept after the student edits the fields the key is built from,
 * so a late scraper write recognises the entry instead of re-adding the
 * original. `editedFields` lists what the student changed. A rejected entry
 * stays in the draft (hidden) for the same reason: so it is not re-imported.
 */
export type ReviewEditMeta = { originKey?: string; editedFields?: string[] };

export type OnboardingEducationEntry = ReviewEditMeta & {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  graduationYear?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  percentage?: string;
  academicLevel?: "undergraduate" | "postgraduate" | "high_school" | "diploma" | "doctorate";
  status?: "candidate" | "confirmed" | "rejected";
  source?: string;
};

export type OnboardingExperienceEntry = ReviewEditMeta & {
  company: string;
  role: string;
  type?: "employment" | "internship" | "freelance" | "founder" | "leadership" | "volunteering" | "other";
  duration?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  technologies?: string[];
  status?: "candidate" | "confirmed" | "rejected";
  source?: string;
};

export type OnboardingAchievementEntry = ReviewEditMeta & {
  title: string;
  category: "award" | "certification" | "competition" | "publication" | "patent" | "academic" | "other" | "hackathon" | "book";
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
  currentScreen: 2,
  name: "",
  role: "",
  targetRole: "",
  targetRoleId: "",
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
  techCandidates: [],
  certifications: [],
  projects: [],
  education: [],
  experiences: [],
  achievements: [],
  priorities: [],
  primaryPriority: undefined,
  completed: false,
};

export const sections = ["Meet EORA", "Direction", "Profile", "Footprints", "Skills", "Projects", "Goal"];

export function nextStage(stage: StageId): StageId {
  return stageIds[Math.min(stageIds.length - 1, stageIds.indexOf(stage) + 1)];
}

// Resume document ids: random UUIDs now; 64-hex sha256 ids from before the
// cross-tenant fix are still accepted so older drafts keep their claims.
const RESUME_DOCUMENT_ID = /^(?:[a-f0-9]{64}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

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
  const editMeta = (e: ReviewEditMeta): ReviewEditMeta => ({
    ...(e.originKey ? { originKey: str(e.originKey, 400) } : {}),
    ...(Array.isArray(e.editedFields) && e.editedFields.length ? { editedFields: strings(e.editedFields) } : {}),
  });
  const profiles: OnboardingDraft["profiles"] = {};
  for (const id of ["github", "linkedin", "leetcode", "hackerrank", "hackerearth", "codechef", "portfolio", "huggingface", "orcid", "kaggle", "devto", "stackoverflow", "google_scholar"] as SourceId[]) {
    if (raw.profiles?.[id]) profiles[id] = str(raw.profiles[id], 300);
  }
  // Graduation year as a number, from a number, a numeric string, or a year
  // like "2027" typed into the academic-year field (BUG #2, Task 2.1.9).
  const rawGrad = raw.expectedGraduationYear as unknown;
  const gradYear =
    typeof rawGrad === "number" && !isNaN(rawGrad)
      ? rawGrad
      : typeof rawGrad === "string" && /^(19|20)\d{2}$/.test(rawGrad.trim())
      ? parseInt(rawGrad.trim(), 10)
      : raw.year && /20\d\d/.test(raw.year)
      ? parseInt(raw.year.match(/20\d\d/)![0], 10)
      : undefined;
  const priorities = Array.isArray(raw.priorities) ? strings(raw.priorities) : [];
  const primaryPriority = raw.primaryPriority ? str(raw.primaryPriority) : undefined;

  return {
    version: 2,
    stage: stageIds.includes(raw.stage as StageId) ? (raw.stage as StageId) : "name",
    currentScreen: [2, 3, 3.2, 3.5, 3.7, 4, 5, 6, 7, 8, 9, 10, 11].includes(raw.currentScreen as number)
      ? raw.currentScreen
      : undefined,
    name: str(raw.name, 80),
    role: raw.role === "student" || raw.role === "faculty" ? raw.role : "",
    targetRole: str(raw.targetRole, 100),
    targetRoleId: raw.targetRoleId ? str(raw.targetRoleId, 60) : undefined,
    degree: str(raw.degree, 100),
    specialization: str(raw.specialization, 100),
    institution: str(raw.institution, 140),
    year: str(raw.year, 30),
    semester: str(raw.semester, 30),
    expectedGraduationYear: gradYear,
    resume: ["pending", "processed", "skipped", "unreadable"].includes(raw.resume || "")
      ? raw.resume!
      : "pending",
    resumeDocumentId: typeof raw.resumeDocumentId === "string" && RESUME_DOCUMENT_ID.test(raw.resumeDocumentId) ? raw.resumeDocumentId : undefined,
    resumeFileName: raw.resumeFileName ? str(raw.resumeFileName, 180) : undefined,
    resumeSuggestions: {
      education: str(raw.resumeSuggestions?.education),
      skills: str(raw.resumeSuggestions?.skills),
      experience: str(raw.resumeSuggestions?.experience),
    },
    acceptedResumeSkills: strings(raw.acceptedResumeSkills),
    resumeReviewed: Array.isArray(raw.resumeReviewed) ? raw.resumeReviewed.slice(0, 100).filter((claim): claim is ReviewedResumeClaim =>
      Boolean(claim && ["education", "experience", "project", "skill", "certification", "achievement"].includes(claim.category) &&
      typeof claim.value === "string" && typeof claim.sourceSpan === "string" &&
      typeof claim.documentId === "string" && RESUME_DOCUMENT_ID.test(claim.documentId))
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
    techCandidates: Array.isArray(raw.techCandidates)
      ? raw.techCandidates.slice(0, 100).filter((entry) => entry && typeof entry.name === "string" && entry.name.trim())
          .map((entry) => ({
            name: str(entry.name, 120), category: str(entry.category, 80) || undefined,
            source: str(entry.source, 160), provenance: str(entry.provenance, 80) || undefined,
            sourceFile: str(entry.sourceFile, 160) || undefined,
            status: entry.status === "rejected" ? "rejected" as const : undefined,
            ...editMeta(entry),
          }))
      : [],
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
            status: p.status === "confirmed" || p.status === "removed" || p.status === "candidate" ? p.status : "suggested",
            contribution: strings(p.contribution),
            contributionNote: str(p.contributionNote),
            url: str(p.url, 500),
            aiPurpose: str(p.aiPurpose, 1000),
            uncertaintyNotes: strings(p.uncertaintyNotes),
            ...(typeof p.stars === "number" ? { stars: p.stars } : {}),
            ...(p.isFork === true ? { isFork: true } : {}),
            ...editMeta(p),
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
            status: e.status === "confirmed" || e.status === "rejected" ? e.status : "candidate",
            source: e.source ? str(e.source, 60) : undefined,
            ...editMeta(e),
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
            status: e.status === "confirmed" || e.status === "rejected" ? e.status : "candidate",
            source: e.source ? str(e.source, 60) : undefined,
            ...editMeta(e),
          }))
      : [],
    achievements: Array.isArray(raw.achievements)
      ? raw.achievements
          .slice(0, 30)
          .filter((a) => a && typeof a.title === "string")
          .map((a) => ({
            title: str(a.title, 200),
            category: ["award", "certification", "competition", "publication", "patent", "academic", "other", "hackathon", "book"].includes(a.category)
              ? a.category
              : "other",
            subType: ["patent_application", "patent_granted", "published_paper", "manuscript", "book", "book_coauthor", "hackathon", "honor", "other"].includes(a.subType || "")
              ? (a.subType as OnboardingAchievementEntry["subType"])
              : undefined,
            status: a.status ? str(a.status, 60) : undefined,
            issuer: a.issuer ? str(a.issuer, 120) : undefined,
            date: a.date ? str(a.date, 40) : undefined,
            description: a.description ? str(a.description, 400) : undefined,
            candidateId: a.candidateId ? str(a.candidateId, 80) : undefined,
            source: a.source ? str(a.source, 60) : undefined,
            ...editMeta(a),
          }))
      : [],
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
    resumeCoveredScreens: Array.isArray(raw.resumeCoveredScreens)
      ? raw.resumeCoveredScreens.filter((n): n is number => [4, 6, 9, 10].includes(n as number))
      : undefined,
    completed: raw.completed === true,
  };
}
