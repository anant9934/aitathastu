/** Normalize untrusted import responses before they enter onboarding form state. */
export function candidateName(value: unknown): string | null {
  const name = typeof value === "string"
    ? value
    : value && typeof value === "object" && "name" in value && typeof value.name === "string"
      ? value.name
      : null;
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

export function candidateNames(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(candidateName).filter((name): name is string => name !== null)));
}

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const str = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const rows = (value: unknown): UnknownRecord[] => Array.isArray(value) ? value.map(record) : [];

export function normalizeImportCandidates(input: unknown) {
  const data = record(input);
  return {
    projects: rows(data.projects).filter((p) => str(p.title)).map((p) => ({
      id: str(p.id) || undefined,
      title: str(p.title),
      description: str(p.description),
      technologies: candidateNames(p.technologies),
      url: str(p.url) || undefined,
      source: str(p.source),
      primaryLanguage: str(p.primaryLanguage) || undefined,
      aiMlCategories: candidateNames(p.aiMlCategories),
      stars: typeof p.stars === "number" ? p.stars : undefined,
      isFork: p.isFork === true ? true : undefined,
      technologyFindings: rows(p.technologyFindings).filter((finding) => str(finding.name)).map((finding) => ({
        name: str(finding.name), category: str(finding.category) || undefined,
        sourceFile: str(finding.sourceFile) || undefined,
        confidence: str(finding.confidence) || undefined,
      })),
    })),
    skills: candidateNames(data.skills),
    experiences: rows(data.experiences).filter((e) => str(e.company) || str(e.role) || str(e.title)).map((e) => ({
      company: str(e.company),
      role: str(e.role) || str(e.title),
      startDate: str(e.startDate) || undefined,
      endDate: str(e.endDate) || undefined,
      description: str(e.description) || undefined,
      employmentType: str(e.employmentType) || undefined,
      source: str(e.source) || str(e.sourceReference),
    })),
    educations: rows(data.educations).filter((e) => str(e.institution) || str(e.school)).map((e) => ({
      institution: str(e.institution) || str(e.school),
      degree: str(e.degree) || undefined,
      fieldOfStudy: str(e.fieldOfStudy) || undefined,
      startDate: str(e.startDate) || undefined,
      endDate: str(e.endDate) || undefined,
      graduationYear: str(e.graduationYear) || undefined,
      gpa: str(e.gpa) || undefined,
      percentage: str(e.percentage) || undefined,
      academicLevel: str(e.academicLevel) || undefined,
      source: str(e.source) || str(e.sourceReference),
    })),
    achievements: rows(data.achievements).filter((a) => str(a.title)).map((a) => ({
      title: str(a.title),
      issuer: str(a.issuer) || undefined,
      issueDate: str(a.issueDate) || undefined,
      category: str(a.category) || "other",
      source: str(a.source) || str(a.sourceReference),
    })),
  };
}
