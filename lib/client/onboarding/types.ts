/** Client-side shapes of the onboarding draft (stored by PUT /api/onboarding-v2). */

export type EntryStatus = "candidate" | "confirmed" | "rejected";

export interface EducationEntry {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  graduationYear?: string;
  gpa?: string;
  percentage?: string;
  academicLevel?: string;
  source?: string;
  sources?: string[];
  status?: EntryStatus;
  originKey?: string;
  editedFields?: string[];
}

export interface ExperienceEntry {
  company: string;
  role: string;
  type?: string;
  duration?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  technologies?: string[];
  source?: string;
  sources?: string[];
  status?: EntryStatus;
  originKey?: string;
  editedFields?: string[];
}

export interface AchievementEntry {
  title: string;
  category?: string;
  subType?: string;
  issuer?: string;
  date?: string;
  description?: string;
  source?: string;
  sources?: string[];
  status?: EntryStatus;
  originKey?: string;
  editedFields?: string[];
}

export interface ProjectEntry {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  sources: string[];
  status: "candidate" | "confirmed" | "removed" | "rejected";
  contribution: string[];
  contributionNote: string;
  url?: string;
  stars?: number;
  forks?: number;
  /** A GitHub fork of someone else's repository (Task 2.1.5). */
  isFork?: boolean;
  aiPurpose?: string;
  uncertaintyNotes?: string[];
  originKey?: string;
  editedFields?: string[];
}

export type TechCandidate = {
  name: string;
  category?: string;
  source: string;
  provenance?: string;
  sourceFile?: string;
  status?: string;
  originKey?: string;
  editedFields?: string[];
};

export type ReviewedResumeClaim = {
  candidateId?: string;
  category: "education" | "experience" | "project" | "skill" | "certification";
  value: string;
  sourceSpan: string;
  documentId: string;
  corrected: boolean;
};

export interface AcademicDetails {
  fullName: string;
  email: string;
  mobile: string;
  institution: string;
  department: string;
  degree: string;
  currentYear: string;
  expectedGraduationYear?: number;
  password?: string;
}

export interface OnboardingData {
  name: string;
  role: string;
  targetRole: string;
  targetRoleId: string;
  priorities: string[];
  primaryPriority?: string;
  academic: AcademicDetails;
  resumeFileName: string | null;
  resumeReviewed: ReviewedResumeClaim[];
  pendingResumeDocumentId: string | null;
  extractedResumeFields: string[];
  resumeCovered: number[];
  profiles: Partial<Record<string, string>>;
  discoveredResumeProfiles: Partial<Record<string, string>>;
  skills: string[];
  techCandidates: TechCandidate[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  experiences: ExperienceEntry[];
  achievements: AchievementEntry[];
  isFresher: boolean;
}

export const EMPTY_ONBOARDING: OnboardingData = {
  name: "",
  role: "",
  targetRole: "",
  targetRoleId: "",
  priorities: [],
  primaryPriority: undefined,
  academic: { fullName: "", email: "", mobile: "", institution: "", department: "", degree: "", currentYear: "", expectedGraduationYear: undefined, password: "" },
  resumeFileName: null,
  resumeReviewed: [],
  pendingResumeDocumentId: null,
  extractedResumeFields: [],
  resumeCovered: [],
  profiles: {},
  discoveredResumeProfiles: {},
  skills: [],
  techCandidates: [],
  projects: [],
  education: [],
  experiences: [],
  achievements: [],
  isFresher: false,
};

/** Profile link types the draft stores as digital-footprint profiles. */
export const PROFILE_SOURCE_IDS = ["github", "linkedin", "leetcode", "hackerrank", "hackerearth", "codechef", "portfolio", "huggingface", "orcid", "kaggle", "devto", "stackoverflow", "google_scholar"];
