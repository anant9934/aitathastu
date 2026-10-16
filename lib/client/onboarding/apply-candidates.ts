/**
 * Merges what an account import found into the draft as suggestions (logic
 * from the Phase 2 container). Imported items are candidates until the person
 * confirms them; anything they rejected or edited is not re-added.
 */
import { candidateNames } from "@/lib/onboarding-import-candidates";
import { isSuppressed, sameEntry } from "@/lib/review/entry-edits";
import type { DiscoveredCandidates } from "./use-footprint-connectors";
import type { OnboardingData, ProjectEntry } from "./types";

const lc = (s?: string) => (s ?? "").toLowerCase().trim();

export function applyDiscoveredCandidates(data: OnboardingData, c: DiscoveredCandidates, provider: string) {
  const projects = [...data.projects];
  for (const [i, p] of (c.projects ?? []).entries()) {
    const entry: ProjectEntry = {
      id: p.id || `proj_${Date.now()}_${i}`, title: p.title, description: p.description || "", technologies: p.technologies || [],
      sources: [p.source || provider], status: "candidate", contribution: [], contributionNote: "", url: p.url,
      aiPurpose: p.aiMlCategories?.join(", "), stars: p.stars, isFork: p.isFork,
    };
    if (!projects.some((x) => sameEntry("projects", x, entry) || (x.url && x.url === entry.url) || lc(x.title) === lc(entry.title))) projects.push(entry);
  }

  const techCandidates = [...data.techCandidates];
  const addTech = (name: string, extra: Partial<(typeof techCandidates)[number]> = {}) => {
    if (isSuppressed("techCandidates", techCandidates, { name })) return;
    if (techCandidates.some((t) => lc(t.name) === lc(name) && t.source === provider)) return;
    techCandidates.push({ name, source: provider, provenance: "SOURCE_EXTRACTED", ...extra });
  };
  for (const s of candidateNames(c.skills)) addTech(s);
  for (const p of c.projects ?? []) for (const f of p.technologyFindings ?? []) addTech(f.name, { category: f.category, sourceFile: f.sourceFile, provenance: f.confidence || "SOURCE_EXTRACTED" });

  const experiences = [...data.experiences];
  for (const x of c.experiences ?? []) {
    if (experiences.some((e) => sameEntry("experiences", e, x) || (lc(e.company) === lc(x.company) && lc(e.role) === lc(x.role)))) continue;
    experiences.push({ company: x.company, role: x.role, type: x.employmentType, startDate: x.startDate, endDate: x.endDate, highlights: x.description ? [x.description] : [], status: "candidate", source: x.source || provider });
  }

  const education = [...data.education];
  for (const x of c.educations ?? []) {
    if (education.some((e) => sameEntry("education", e, x) || (lc(e.institution) === lc(x.institution) && (!x.degree || lc(e.degree) === lc(x.degree))))) continue;
    education.push({ institution: x.institution, degree: x.degree, fieldOfStudy: x.fieldOfStudy, graduationYear: x.graduationYear, startDate: x.startDate, endDate: x.endDate, gpa: x.gpa, percentage: x.percentage, academicLevel: x.academicLevel, status: "candidate", source: x.source || provider });
  }

  const achievements = [...data.achievements];
  for (const x of c.achievements ?? []) {
    if (achievements.some((a) => sameEntry("achievements", a, x) || lc(a.title) === lc(x.title))) continue;
    achievements.push({ title: x.title, issuer: x.issuer, date: x.issueDate, category: x.category || "other", subType: x.category, status: "candidate", source: x.source || provider });
  }

  const next: OnboardingData = { ...data, projects, techCandidates, experiences, education, achievements };
  return { next, patch: { projects, techCandidates, experiences, education, achievements }, newProjects: projects.length - data.projects.length };
}
