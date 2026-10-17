/**
 * Folds an accepted CV review into the onboarding draft. Only what the person
 * accepted, field by field, fills onboarding (logic carried over from the
 * Phase 2 container). Pure: returns the next data and the draft patch to save.
 */
import { hasEntry, mergeAccepted } from "@/lib/review/entry-edits";
import { resumeCoveredScreens } from "@/lib/onboarding-resume-coverage";
import type { ResumeExtraData } from "./use-resume-ingestion";
import { PROFILE_SOURCE_IDS, type AchievementEntry, type EducationEntry, type ExperienceEntry, type OnboardingData, type ProjectEntry, type ReviewedResumeClaim } from "./types";
import { bindEducation } from "./use-onboarding-flow";

export function applyResumeReview(data: OnboardingData, fileName: string, claims: ReviewedResumeClaim[], extra: ResumeExtraData) {
  const ap = extra.acceptedProfile || {};
  const acceptedLinks = Object.fromEntries(Object.entries(extra.acceptedLinks || {}).filter(([type, url]) => PROFILE_SOURCE_IDS.includes(type) && url)) as Partial<Record<string, string>>;
  const acceptedIndexes = (category: string) =>
    new Set(claims.filter((c) => c.category === category && c.candidateId).map((c) => Number(c.candidateId!.split("_").pop())));

  const discoveredFromExtraction = Object.fromEntries(
    Object.entries(extra.discoveredProfiles || {}).filter(([type, url]) => PROFILE_SOURCE_IDS.includes(type) && url)
  ) as Partial<Record<string, string>>;
  const discoveredResumeProfiles = { ...data.discoveredResumeProfiles, ...discoveredFromExtraction, ...acceptedLinks };
  const profiles = { ...acceptedLinks, ...data.profiles };
  const portfolioUrls = Array.from(new Set([
    ...(data.portfolioUrls || []),
    ...(extra.acceptedPortfolioUrls || []),
  ])).filter(Boolean);
  const skills = Array.from(new Set([...data.skills, ...claims.filter((c) => c.category === "skill").map((c) => c.value)]));

  const resumeProjects: ProjectEntry[] = claims.filter((c) => c.category === "project").map((c, index) => {
    const found = extra.extractedProjects?.find((p) => p.sourceSpan === c.sourceSpan);
    return {
      id: `resume_${c.documentId.slice(0, 12)}_${index}`,
      title: (found?.title && c.value.startsWith(found.title)) ? found.title : c.value,
      description: found?.description || "",
      technologies: found?.technologies || [],
      sources: ["resume"],
      status: "confirmed",
      contribution: [],
      contributionNote: "",
      url: found?.repositoryUrl,
    };
  });
  const projects = [
    ...data.projects.filter((p) => !p.id.startsWith("resume_") || p.status === "confirmed" || p.status === "removed"),
    ...resumeProjects.filter((incoming) => !hasEntry("projects", data.projects, incoming) && !data.projects.some((p) => p.status === "confirmed" && p.title.toLowerCase().trim() === incoming.title.toLowerCase().trim())),
  ];

  const expIdx = acceptedIndexes("experience");
  const experiences = mergeAccepted("experiences", data.experiences, (extra.extractedExperience || []).filter((_, i) => expIdx.has(i)).map((x): ExperienceEntry => ({
    company: x.company || "", role: x.role || "", type: x.type, duration: x.duration, startDate: x.startDate, endDate: x.endDate,
    highlights: x.highlights, technologies: x.technologies, status: "confirmed", source: "resume",
  })));

  const achIdx = acceptedIndexes("achievement");
  const achievements = mergeAccepted("achievements", data.achievements, (extra.extractedAchievements || []).filter((_, i) => achIdx.has(i)).map((a): AchievementEntry => ({
    title: a.title, category: a.category || "academic", subType: a.subType, issuer: a.issuer, date: a.date, description: a.description, status: "confirmed", source: "resume",
  })));

  const eduIdx = acceptedIndexes("education");
  const mergedEducation = mergeAccepted("education", data.education, (extra.extractedEducation || []).filter((_, i) => eduIdx.has(i)).map((e): EducationEntry => ({
    institution: e.institution, degree: e.degree, fieldOfStudy: e.fieldOfStudy, graduationYear: e.graduationYear, startDate: e.startDate,
    endDate: e.endDate, gpa: e.gpa, percentage: e.percentage, academicLevel: e.academicLevel, status: "confirmed", source: "resume",
  })));

  const gradYear = ap.expectedGraduationYear && /^\d{4}$/.test(ap.expectedGraduationYear) ? Number(ap.expectedGraduationYear) : undefined;
  const academic = {
    ...data.academic,
    fullName: ap.fullName || data.academic.fullName,
    email: ap.email || data.academic.email,
    mobile: ap.mobile || data.academic.mobile,
    institution: ap.institution || data.academic.institution,
    degree: ap.degree || data.academic.degree,
    department: ap.specialization || data.academic.department,
    expectedGraduationYear: gradYear || data.academic.expectedGraduationYear,
  };
  // Keep the profile's institution and the primary education entry in agreement (P4-16).
  const withAcademic: OnboardingData = { ...data, academic };
  const bound = bindEducation(withAcademic, mergedEducation);
  const name = ap.fullName || data.name || data.academic.fullName;
  const covered = resumeCoveredScreens(extra.reviewSummary || {}, ap);

  const resumeReviewed = [...data.resumeReviewed];
  for (const c of claims) if (!resumeReviewed.some((x) => x.documentId === c.documentId && x.candidateId === c.candidateId)) resumeReviewed.push(c);

  const next: OnboardingData = {
    ...data,
    name,
    academic: { ...bound.academic, fullName: name || bound.academic.fullName },
    education: bound.education,
    experiences,
    achievements,
    projects,
    skills,
    profiles,
    portfolioUrls: portfolioUrls.length > 0 ? portfolioUrls : data.portfolioUrls,
    discoveredResumeProfiles,
    resumeCovered: covered,
    resumeReviewed,
    resumeFileName: fileName,
    extractedResumeFields: Object.keys(ap).map((k) => (k === "specialization" ? "department" : k)),
  };
  const patch = {
    skills, projects, experiences, achievements,
    education: next.education.length ? next.education : undefined,
    resumeReviewed, resume: "processed", profiles,
    portfolioUrls: portfolioUrls.length > 0 ? portfolioUrls : undefined,
    discoveredResumeProfiles, resumeCoveredScreens: covered,
    name, degree: next.academic.degree, specialization: next.academic.department, institution: next.academic.institution,
    year: next.academic.currentYear, expectedGraduationYear: next.academic.expectedGraduationYear,
  };
  return { next, patch };
}
