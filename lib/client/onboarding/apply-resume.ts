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
  // The review workspace sends the confirmed records themselves (edited and added ones included);
  // older callers send claims that index into the extracted arrays.
  const reviewed = extra.reviewedRecords;
  const accepted = <T,>(category: string, all: T[] | undefined, mine: T[] | undefined): T[] => {
    if (reviewed) return mine ?? [];
    const idx = acceptedIndexes(category);
    return (all || []).filter((_, i) => idx.has(i));
  };

  const discoveredFromExtraction = Object.fromEntries(
    Object.entries(extra.discoveredProfiles || {}).filter(([type, url]) => PROFILE_SOURCE_IDS.includes(type) && url)
  ) as Partial<Record<string, string>>;
  const discoveredResumeProfiles = { ...data.discoveredResumeProfiles, ...discoveredFromExtraction, ...acceptedLinks };
  const profiles = { ...acceptedLinks, ...data.profiles };
  const portfolioUrls = Array.from(new Set([
    ...(data.portfolioUrls || []),
    ...(extra.acceptedPortfolioUrls || []),
  ])).filter(Boolean);
  const skills = Array.from(new Set([...data.skills, ...(extra.reviewedRecords?.skills ?? claims.filter((c) => c.category === "skill").map((c) => c.value))]));

  const resumeProjects: ProjectEntry[] = reviewed ? reviewed.projects.map((p, index) => ({
    id: `resume_${(claims[0]?.documentId ?? "cv").slice(0, 12)}_${index}`,
    title: p.title, description: p.description || "", technologies: p.technologies || [], sources: ["resume"], status: "confirmed",
    contribution: [], contributionNote: "", url: p.repositoryUrl || undefined,
  })) : claims.filter((c) => c.category === "project").map((c, index) => {
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

  const experiences = mergeAccepted("experiences", data.experiences, accepted("experience", extra.extractedExperience, reviewed?.experience).map((x): ExperienceEntry => ({
    company: x.company || "", role: x.role || "", type: x.type, duration: x.duration, startDate: x.startDate, endDate: x.endDate,
    highlights: x.highlights, technologies: x.technologies, status: "confirmed", source: "resume",
  })));

  const achievements = mergeAccepted("achievements", data.achievements, accepted("achievement", extra.extractedAchievements, reviewed?.achievements).map((a): AchievementEntry => ({
    title: a.title, category: a.category || "academic", subType: a.subType, issuer: a.issuer, date: a.date, description: a.description, status: "confirmed", source: "resume",
  })));

  const mergedEducation = mergeAccepted("education", data.education, accepted("education", extra.extractedEducation, reviewed?.education).map((e): EducationEntry => ({
    institution: e.institution, degree: e.degree, fieldOfStudy: e.fieldOfStudy, graduationYear: e.graduationYear, startDate: e.startDate,
    endDate: e.endDate, gpa: e.gpa, percentage: e.percentage, academicLevel: e.academicLevel, status: "confirmed", source: "resume",
  })));

  const gradYear = ap.expectedGraduationYear && /^\d{4}$/.test(ap.expectedGraduationYear) ? Number(ap.expectedGraduationYear) : undefined;
  const academic = {
    ...data.academic,
    fullName: ap.fullName || data.academic.fullName,
    email: ap.email || data.academic.email,
    mobile: data.academic.mobile || (ap as any).mobile || "",
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
    extractedResumeFields: Object.keys(ap).filter((k) => k !== "mobile" && k !== "phone").map((k) => (k === "specialization" ? "department" : k)),
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
