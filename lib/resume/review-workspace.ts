/**
 * The fixed-schema CV review workspace: ten sections, every supported field
 * (shown even when the CV did not contain it), repeatable records, mandatory
 * profile fields and the canonical save payload. Pure and shared by the
 * review screen and /api/resume/[id]/apply, so both validate the same way.
 *
 * Values are the canonical interpretation fields (lib/intelligence/schemas.ts);
 * nothing here invents a value: a field the CV did not contain stays empty
 * until the student types it, and its source says so.
 */

export type SectionId = "identity" | "contact" | "location" | "education" | "experience" | "skills" | "projects" | "achievements" | "publications" | "online";
export type FieldKind = "text" | "textarea" | "email" | "phone" | "url" | "github" | "date" | "list" | "select";
export type RecordType =
  | "education" | "experience" | "skill" | "project" | "certification" | "training" | "achievement" | "hackathon"
  | "publication" | "research" | "link" | "language" | "leadership" | "volunteering" | "additional";

export interface FieldDef { key: string; label: string; kind: FieldKind; options?: string[]; placeholder?: string; sensitive?: boolean }
export interface SingleDef extends FieldDef { mandatory?: boolean; repeatable?: boolean; derived?: boolean }
export interface RecordTypeDef { type: RecordType; category: string; label: string; addLabel: string; fields: FieldDef[] }
export interface SectionDef { id: SectionId; title: string; description: string; singles: SingleDef[]; recordTypes: RecordType[] }

export const EDUCATION_STATUS = ["Pursuing", "Graduated"] as const;

export const RECORD_TYPES: Record<RecordType, RecordTypeDef> = {
  education: { type: "education", category: "education", label: "Education", addLabel: "Add education", fields: [
    { key: "degree", label: "Qualification / degree", kind: "text", placeholder: "B.Tech" },
    { key: "institution", label: "College / university", kind: "text" },
    { key: "fieldOfStudy", label: "Specialization / branch", kind: "text" },
    { key: "startDate", label: "Start year", kind: "date", placeholder: "2022 or Aug 2022" },
    { key: "status", label: "Education status", kind: "select", options: [...EDUCATION_STATUS] },
    { key: "endDate", label: "Passing-out date", kind: "date", placeholder: "May 2026" },
    { key: "grade", label: "CGPA / percentage", kind: "text" },
    { key: "location", label: "Location", kind: "text" },
  ] },
  experience: { type: "experience", category: "experience", label: "Role", addLabel: "Add work experience", fields: [
    { key: "role", label: "Job title", kind: "text" },
    { key: "company", label: "Organisation", kind: "text" },
    { key: "type", label: "Type", kind: "select", options: ["employment", "internship", "freelance", "founder", "other"] },
    { key: "location", label: "Location", kind: "text" },
    { key: "startDate", label: "Start date", kind: "date" },
    { key: "endDate", label: "End date", kind: "date", placeholder: "Present" },
    { key: "highlights", label: "Responsibilities and achievements", kind: "list" },
    { key: "technologies", label: "Technologies", kind: "list" },
  ] },
  skill: { type: "skill", category: "skill", label: "Skill", addLabel: "Add skill", fields: [{ key: "name", label: "Skill", kind: "text" }] },
  project: { type: "project", category: "project", label: "Project", addLabel: "Add project", fields: [
    { key: "title", label: "Title", kind: "text" },
    { key: "description", label: "Description", kind: "textarea" },
    { key: "technologies", label: "Technologies", kind: "list" },
    { key: "repositoryUrl", label: "Repository URL", kind: "url" },
    { key: "demoUrl", label: "Live / demo URL", kind: "url" },
  ] },
  certification: { type: "certification", category: "certification", label: "Certification", addLabel: "Add certification", fields: [
    { key: "name", label: "Name", kind: "text" },
    { key: "issuer", label: "Issuer", kind: "text" },
    { key: "issueDate", label: "Issued", kind: "date" },
    { key: "expiryDate", label: "Expires", kind: "date" },
    { key: "credentialId", label: "Credential ID", kind: "text" },
    { key: "credentialUrl", label: "Credential URL", kind: "url" },
  ] },
  training: { type: "training", category: "training", label: "Course / training", addLabel: "Add course", fields: [
    { key: "title", label: "Course", kind: "text" },
    { key: "provider", label: "Provider", kind: "text" },
    { key: "dates", label: "Dates", kind: "text" },
  ] },
  achievement: { type: "achievement", category: "achievement", label: "Award / achievement", addLabel: "Add award", fields: [
    { key: "title", label: "Title", kind: "text" },
    { key: "issuer", label: "Issuer", kind: "text" },
    { key: "date", label: "Date", kind: "date" },
    { key: "description", label: "Description", kind: "textarea" },
  ] },
  hackathon: { type: "hackathon", category: "hackathon", label: "Competition", addLabel: "Add competition", fields: [
    { key: "event", label: "Event", kind: "text" },
    { key: "rank", label: "Result / rank", kind: "text" },
    { key: "organizer", label: "Organiser", kind: "text" },
    { key: "date", label: "Date", kind: "date" },
  ] },
  publication: { type: "publication", category: "publication", label: "Publication / patent", addLabel: "Add publication or patent", fields: [
    { key: "title", label: "Title", kind: "text" },
    { key: "issuer", label: "Venue / office", kind: "text" },
    { key: "date", label: "Date", kind: "date" },
  ] },
  research: { type: "research", category: "research", label: "Research", addLabel: "Add research", fields: [
    { key: "title", label: "Title", kind: "text" },
    { key: "publisher", label: "Venue / publisher", kind: "text" },
    { key: "date", label: "Date", kind: "date" },
    { key: "url", label: "URL / DOI", kind: "url" },
  ] },
  link: { type: "link", category: "digitalFootprint", label: "Profile link", addLabel: "Add profile link", fields: [
    { key: "platform", label: "Platform", kind: "text" },
    { key: "url", label: "URL", kind: "url" },
  ] },
  language: { type: "language", category: "language", label: "Language", addLabel: "Add language", fields: [
    { key: "language", label: "Language", kind: "text" },
    { key: "proficiency", label: "Proficiency", kind: "text" },
  ] },
  leadership: { type: "leadership", category: "leadership", label: "Leadership role", addLabel: "Add leadership role", fields: [
    { key: "role", label: "Role", kind: "text" },
    { key: "organization", label: "Organisation", kind: "text" },
    { key: "startDate", label: "Start date", kind: "date" },
    { key: "endDate", label: "End date", kind: "date" },
  ] },
  volunteering: { type: "volunteering", category: "volunteering", label: "Volunteering", addLabel: "Add volunteering", fields: [
    { key: "role", label: "Role", kind: "text" },
    { key: "organization", label: "Organisation", kind: "text" },
    { key: "dates", label: "Dates", kind: "text" },
  ] },
  additional: { type: "additional", category: "additional", label: "Other detail", addLabel: "Add other detail", fields: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "content", label: "Details", kind: "textarea" },
  ] },
};

export const SECTIONS: SectionDef[] = [
  { id: "identity", title: "Identity & Personal Details", description: "Who you are.", recordTypes: [], singles: [
    { key: "fullName", label: "Full name", kind: "text", mandatory: true },
    { key: "pronouns", label: "Pronouns", kind: "text" },
    { key: "dateOfBirth", label: "Date of birth", kind: "date", sensitive: true },
    { key: "nationality", label: "Nationality", kind: "text", sensitive: true },
    { key: "headline", label: "Headline", kind: "text" },
    { key: "summary", label: "Professional summary", kind: "textarea" },
  ] },
  { id: "contact", title: "Contact Information", description: "How recruiters reach you.", recordTypes: [], singles: [
    { key: "email", label: "Email", kind: "email", mandatory: true },
    { key: "alternateEmail", label: "Alternate email", kind: "email", repeatable: true },
    { key: "mobile", label: "Phone", kind: "phone", sensitive: true },
    { key: "alternatePhone", label: "Alternate phone", kind: "phone", repeatable: true, sensitive: true },
  ] },
  { id: "location", title: "Location & Work Authorization", description: "Where you are based and where you can work.", recordTypes: [], singles: [
    { key: "location", label: "Current location", kind: "text" },
    { key: "address", label: "Address", kind: "textarea", repeatable: true, sensitive: true },
    { key: "workAuthorization", label: "Work authorisation", kind: "text" },
    { key: "drivingLicence", label: "Driving licence", kind: "text", sensitive: true },
  ] },
  { id: "education", title: "Education", description: "Mark the education you are pursuing or completed most recently as current: all of its fields are required.", singles: [], recordTypes: ["education"] },
  { id: "experience", title: "Work Experience", description: "Jobs, internships and freelance work.", recordTypes: ["experience"], singles: [
    { key: "currentRole", label: "Current designation", kind: "text", derived: true },
    { key: "currentEmployer", label: "Current employer", kind: "text", derived: true },
    { key: "experienceDuration", label: "Total experience", kind: "text", derived: true },
  ] },
  { id: "skills", title: "Skills & Technologies", description: "What you can work with.", singles: [], recordTypes: ["skill"] },
  { id: "projects", title: "Projects", description: "Things you have built.", singles: [], recordTypes: ["project"] },
  { id: "achievements", title: "Certifications, Awards & Achievements", description: "Credentials, courses, awards and competitions.", singles: [], recordTypes: ["certification", "training", "achievement", "hackathon"] },
  { id: "publications", title: "Publications, Research & Patents", description: "Papers, research and patents.", singles: [], recordTypes: ["publication", "research"] },
  { id: "online", title: "Online Presence & Other Details", description: "Profiles, languages, leadership, volunteering and anything else.", recordTypes: ["link", "language", "leadership", "volunteering", "additional"], singles: [
    { key: "githubUrl", label: "GitHub profile URL", kind: "github", mandatory: true, placeholder: "https://github.com/your-username" },
  ] },
];

export const SINGLE_SECTION: Record<string, SectionId> = Object.fromEntries(SECTIONS.flatMap((s) => s.singles.map((f) => [f.key, s.id])));
const CATEGORY_TYPE: Record<string, RecordType> = Object.fromEntries(Object.values(RECORD_TYPES).map((t) => [t.category, t.type]));
export const RECORD_SECTION: Record<RecordType, SectionId> = Object.fromEntries(SECTIONS.flatMap((s) => s.recordTypes.map((t) => [t, s.id]))) as Record<RecordType, SectionId>;
export const singleDef = (key: string) => SECTIONS.flatMap((s) => s.singles).find((f) => f.key === key);

// ---------------------------------------------------------------- workspace model

export type Source = "cv" | "ai" | "derived" | "user" | "none";
export type Confidence = "high" | "medium" | "low";

export interface WsItem {
  /** Stable id: the review candidate id, or user_<type>_<suffix> for something the student added. */
  id: string;
  section: SectionId;
  /** "single" for a personal field; otherwise the record type. */
  kind: "single" | RecordType;
  field?: string;
  category: string;
  values: Record<string, string>;
  original: Record<string, string>;
  source: Source;
  confidence?: Confidence;
  /** The extractor's own field statuses and issues (not changed by the student). */
  extractorStatus?: string;
  fieldStatus: Record<string, string>;
  issues: string[];
  evidence?: { page?: number; section?: string; text: string };
  /** Set when the student saved a decision on it (reload / reprocessing). */
  saved?: "confirmed" | "rejected";
  selected: boolean;
  removed: boolean;
  recordData?: Record<string, unknown>;
  /** For a GitHub URL taken from a footprint suggestion: that suggestion's id. */
  linkedCandidateId?: string;
  /** The suggestion exactly as extracted (category, source text, display value): what the CV claim is checked against. */
  extracted?: { category: string; sourceSpan: string; value: string };
}
export interface Workspace { items: WsItem[]; currentEducationId: string | null }

export interface CandidateLike {
  candidateId: string;
  category: string;
  field?: string;
  value: string;
  sourceSpan?: string;
  recordData?: Record<string, unknown>;
  decision?: "confirmed" | "rejected";
  decidedValue?: string;
  /** Decision on the same item in an earlier upload of this file (pre-ticks it). */
  previousDecision?: string;
  decidedFields?: Record<string, string>;
  currentEducation?: boolean;
  userAdded?: boolean;
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).join("\n") : str(v));
const isPresent = (v?: string) => /\b(?:present|current|now|ongoing|till date|to date)\b/i.test(v ?? "");

/** Only what the CV says: "present", "expected" or a current flag means Pursuing; a bare year is left for the student to choose. */
function educationStatus(r: Record<string, unknown>): string {
  return r.current === true || isPresent(str(r.endDate)) || /expected|pursuing/i.test(str(r.endDate)) ? "Pursuing" : "";
}

/** Canonical record -> the workspace field values for its type. */
export function valuesFromRecord(type: RecordType, r: Record<string, unknown>, fallbackValue = ""): Record<string, string> {
  switch (type) {
    case "education": return {
      degree: str(r.degree), institution: str(r.institution), fieldOfStudy: str(r.fieldOfStudy), startDate: str(r.startDate),
      status: str(r.status) && EDUCATION_STATUS.includes(str(r.status) as never) ? str(r.status) : educationStatus(r),
      endDate: isPresent(str(r.endDate)) ? "" : str(r.endDate).replace(/\s*\(?expected\)?/i, "") || str(r.graduationYear),
      grade: str(r.gpa) || str(r.percentage) || str((r.grade as { raw?: string } | undefined)?.raw), location: str(r.location),
    };
    case "experience": return {
      role: str(r.role), company: str(r.company), type: str(r.type), location: str(r.location),
      startDate: str(r.startDate), endDate: str(r.endDate), highlights: list(r.highlights), technologies: list(r.technologies),
    };
    case "skill": return { name: str(r.originalName) || str(r.name) || fallbackValue };
    case "project": return { title: str(r.title) || fallbackValue, description: str(r.description), technologies: list(r.technologies), repositoryUrl: str(r.repositoryUrl), demoUrl: str(r.demoUrl) };
    case "certification": return { name: str(r.name) || fallbackValue, issuer: str(r.issuer), issueDate: str(r.issueDate) || str(r.year), expiryDate: str(r.expiryDate), credentialId: str(r.credentialId), credentialUrl: str(r.credentialUrl) };
    case "training": return { title: str(r.title) || fallbackValue, provider: str(r.provider), dates: str(r.dates) || str(r.duration) };
    case "achievement": return { title: str(r.title) || fallbackValue, issuer: str(r.issuer), date: str(r.date), description: str(r.description) };
    case "hackathon": return { event: str(r.event) || fallbackValue, rank: str(r.rank) || str(r.award), organizer: str(r.organizer), date: str(r.date) };
    case "publication": return { title: str(r.title) || fallbackValue, issuer: str(r.issuer), date: str(r.date) };
    case "research": return { title: str(r.title) || fallbackValue, publisher: str(r.publisher), date: str(r.date), url: str(r.url) };
    case "link": return { platform: str(r.platform), url: str(r.url) || str(r.normalizedUrl) || fallbackValue };
    case "language": return { language: str(r.language) || fallbackValue, proficiency: str(r.proficiency) };
    case "leadership": return { role: str(r.role), organization: str(r.organization), startDate: str(r.startDate), endDate: str(r.endDate) };
    case "volunteering": return { role: str(r.role), organization: str(r.organization), dates: str(r.dates) };
    case "additional": return { heading: str(r.heading), content: str(r.content) || fallbackValue };
  }
}

/** Workspace values -> canonical record fields (merged over the original record). */
export function recordFromValues(type: RecordType, v: Record<string, string>, original: Record<string, unknown> = {}): Record<string, unknown> {
  const lines = (s?: string) => (s ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const csv = (s?: string) => (s ?? "").split(/\n+|\s*,\s*/).map((x) => x.trim()).filter(Boolean);
  const base = { ...original };
  switch (type) {
    case "education": {
      const pursuing = v.status === "Pursuing";
      return { ...base, degree: v.degree, institution: v.institution, fieldOfStudy: v.fieldOfStudy || undefined, startDate: v.startDate || undefined,
        endDate: v.endDate || undefined, current: pursuing, status: v.status || undefined,
        graduationYear: v.endDate?.match(/\b(19|20)\d{2}\b/)?.[0], location: v.location || undefined,
        ...(v.grade ? (/%/.test(v.grade) ? { percentage: v.grade, gpa: undefined } : { gpa: v.grade, percentage: undefined }) : {}) };
    }
    case "experience": return { ...base, role: v.role, company: v.company, type: v.type || base.type || "employment", location: v.location || undefined,
      startDate: v.startDate || undefined, endDate: v.endDate || undefined, highlights: lines(v.highlights), technologies: csv(v.technologies) };
    case "skill": return { ...base, name: v.name, originalName: v.name };
    case "project": return { ...base, title: v.title, description: v.description ?? "", technologies: csv(v.technologies), repositoryUrl: v.repositoryUrl || "", demoUrl: v.demoUrl || undefined };
    case "certification": return { ...base, name: v.name, issuer: v.issuer || undefined, issueDate: v.issueDate || undefined, expiryDate: v.expiryDate || undefined, credentialId: v.credentialId || undefined, credentialUrl: v.credentialUrl || undefined };
    case "training": return { ...base, title: v.title, provider: v.provider || undefined, dates: v.dates || undefined };
    case "achievement": return { ...base, title: v.title, issuer: v.issuer || undefined, date: v.date || undefined, description: v.description ?? "" };
    case "hackathon": return { ...base, event: v.event, rank: v.rank || undefined, organizer: v.organizer || undefined, date: v.date || undefined };
    case "publication": return { ...base, title: v.title, issuer: v.issuer || undefined, date: v.date || undefined };
    case "research": return { ...base, title: v.title, publisher: v.publisher || undefined, date: v.date || undefined, url: v.url || undefined };
    case "link": return { ...base, platform: v.platform, url: v.url };
    case "language": return { ...base, language: v.language, proficiency: v.proficiency || undefined };
    case "leadership": return { ...base, role: v.role, organization: v.organization, startDate: v.startDate || undefined, endDate: v.endDate || undefined };
    case "volunteering": return { ...base, role: v.role, organization: v.organization, dates: v.dates || undefined };
    case "additional": return { ...base, heading: v.heading || "Other", content: v.content };
  }
}

/** One-line summary of a record, used as the legacy corrected value and the card title. */
export function summarize(kind: WsItem["kind"], v: Record<string, string>): string {
  if (kind === "single") return v.value ?? "";
  const parts: Record<RecordType, string[]> = {
    education: [v.degree, v.fieldOfStudy, v.institution], experience: [v.role, v.company], skill: [v.name], project: [v.title],
    certification: [v.name, v.issuer], training: [v.title, v.provider], achievement: [v.title], hackathon: [v.event, v.rank],
    publication: [v.title], research: [v.title], link: [v.platform, v.url], language: [v.language, v.proficiency],
    leadership: [v.role, v.organization], volunteering: [v.role, v.organization], additional: [v.heading, v.content],
  };
  return parts[kind].filter(Boolean).join(" · ").slice(0, 500);
}

const GITHUB_PROFILE = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})\/?$/;
const RESERVED_GITHUB = new Set(["orgs", "settings", "login", "about", "features", "pricing", "topics", "explore", "marketplace", "sponsors", "enterprise"]);

export function githubProfileFrom(url: string): string | null {
  const m = url.trim().match(GITHUB_PROFILE);
  return m && !RESERVED_GITHUB.has(m[1].toLowerCase()) ? m[1] : null;
}

/** Field-level validation of what the student will save. Empty optional fields are valid. */
export function validateValue(kind: FieldKind, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  switch (kind) {
    case "email": return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v) ? null : "Enter a valid email address.";
    case "url": return /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v) ? null : "Enter a full link starting with https://";
    case "github": return githubProfileFrom(v) ? null : "Enter your GitHub profile link, like https://github.com/your-username (not a repository).";
    case "phone": return v.replace(/\D/g, "").length >= 7 ? null : "Enter a complete phone number.";
    case "date": return /\b(19|20)\d{2}\b/.test(v) || isPresent(v) ? null : "Include a year, for example 2024 or Aug 2024.";
    default: return null;
  }
}

// ---------------------------------------------------------------- building

let seq = 0;
export const newUserId = (kind: string) => `user_${kind.replace(/[^a-z]/gi, "").toLowerCase()}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function confidenceOf(rd: Record<string, unknown> | undefined): Confidence | undefined {
  const level = rd?.confidenceLevel;
  if (level === "high" || level === "medium" || level === "low") return level;
  const c = (rd?.review as { confidence?: number } | undefined)?.confidence;
  return typeof c === "number" ? (c >= 0.85 ? "high" : c >= 0.6 ? "medium" : "low") : undefined;
}

function sourceOf(c: CandidateLike, rd?: Record<string, unknown>): Source {
  if (c.userAdded) return "user";
  if (rd?.method === "derived") return "derived";
  if (rd?.provenance === "llm" || (rd?.review as { issues?: string[] } | undefined)?.issues?.includes("model_recovered")) return "ai";
  return "cv";
}

/**
 * Builds the workspace from the review candidates (with saved decisions, if
 * any). Every single field of every section is present, extracted or not.
 */
export function buildWorkspace(candidates: CandidateLike[]): Workspace {
  const items: WsItem[] = [];
  const githubCandidate = candidates.find((c) => (c.category === "digitalFootprint" || c.category === "link") && githubProfileFrom(str(c.recordData?.url) || str(c.recordData?.normalizedUrl) || c.value));
  for (const c of candidates) {
    const rd = c.recordData;
    const review = rd?.review as { status?: string; fields?: Record<string, string>; issues?: string[] } | undefined;
    const evidence = rd?.evidence as { page?: number; section?: string; text?: string } | undefined;
    const meta = {
      source: sourceOf(c, rd), confidence: confidenceOf(rd), extractorStatus: review?.status, fieldStatus: review?.fields ?? {}, issues: review?.issues ?? [],
      evidence: !c.userAdded && (evidence?.text || c.sourceSpan) ? { page: evidence?.page, section: evidence?.section, text: (evidence?.text || c.sourceSpan || "").slice(0, 300) } : undefined,
      saved: c.decision, selected: c.decision ? c.decision === "confirmed" : c.previousDecision === "confirmed", removed: c.decision === "rejected" && Boolean(c.userAdded), recordData: rd,
      ...(c.userAdded ? {} : { extracted: { category: c.category, sourceSpan: c.sourceSpan ?? "", value: c.value } }),
    };
    if (c === githubCandidate) {
      const url = str(c.recordData?.url) || str(c.recordData?.normalizedUrl) || c.value;
      items.push({ id: `github_${c.candidateId}`, linkedCandidateId: c.candidateId, section: "online", kind: "single", field: "githubUrl", category: c.category, values: { value: c.decidedValue || url }, original: { value: url }, ...meta });
      continue;
    }
    if (c.category === "profile" || c.category === "summary") {
      const field = c.category === "summary" ? "summary" : c.field ?? "";
      const section = SINGLE_SECTION[field];
      if (!section) continue;
      const original = { value: c.value };
      items.push({ id: c.candidateId, section, kind: "single", field, category: c.category, values: { value: c.decidedFields?.value ?? c.decidedValue ?? c.value }, original, ...meta });
      continue;
    }
    const type = CATEGORY_TYPE[c.category] ?? (c.category === "link" ? "link" : undefined);
    if (!type) continue;
    const original = valuesFromRecord(type, rd ?? {}, c.value);
    if (type === "link" && !original.platform && c.field) original.platform = c.field;
    items.push({ id: c.candidateId, section: RECORD_SECTION[type], kind: type, category: RECORD_TYPES[type].category, values: { ...original, ...(c.decidedFields ?? {}) }, original, ...meta });
  }
  // Every single field is shown, found or not.
  for (const s of SECTIONS) for (const f of s.singles) {
    if (items.some((i) => i.kind === "single" && i.field === f.key)) continue;
    items.push({ id: `user_profile_${f.key}`, section: s.id, kind: "single", field: f.key, category: f.key === "summary" ? "summary" : "profile", values: { value: "" }, original: { value: "" }, source: "none", fieldStatus: {}, issues: [], selected: false, removed: false });
  }
  const savedCurrent = candidates.find((c) => c.currentEducation)?.candidateId;
  return { items, currentEducationId: savedCurrent ?? defaultCurrentEducation(items) };
}

/** Pursuing first, else the most recent end year; null when there is no education. */
export function defaultCurrentEducation(items: WsItem[]): string | null {
  const edu = items.filter((i) => i.kind === "education" && !i.removed);
  if (!edu.length) return null;
  const pursuing = edu.find((i) => i.values.status === "Pursuing");
  if (pursuing) return pursuing.id;
  const year = (i: WsItem) => Number(i.values.endDate?.match(/\b(19|20)\d{2}\b/)?.[0] ?? 0);
  return [...edu].sort((a, b) => year(b) - year(a))[0].id;
}

// ---------------------------------------------------------------- editing (pure; the review screen keeps the result in state)

export function setValue(ws: Workspace, id: string, key: string, value: string): Workspace {
  return { ...ws, items: ws.items.map((i) => (i.id === id ? { ...i, values: { ...i.values, [key]: value }, selected: value.trim() ? true : i.selected } : i)) };
}
export function setSelected(ws: Workspace, id: string, selected: boolean): Workspace {
  return { ...ws, items: ws.items.map((i) => (i.id === id ? { ...i, selected } : i)) };
}
/** "Tick all" in a section never ticks what the extractor marked invalid, unreadable or conflicting. */
export const UNSAFE_FOR_BULK = new Set(["invalid", "unreadable", "conflicting"]);
export function setSectionSelected(ws: Workspace, section: SectionId, selected: boolean): Workspace {
  return { ...ws, items: ws.items.map((i) => {
    if (i.section !== section || i.removed) return i;
    if (!selected) return { ...i, selected: false };
    const hasValue = Object.values(i.values).some((v) => v.trim());
    return hasValue && !UNSAFE_FOR_BULK.has(i.extractorStatus ?? "") ? { ...i, selected: true } : i;
  }) };
}
export function addRecord(ws: Workspace, type: RecordType): { ws: Workspace; id: string } {
  const id = newUserId(type);
  const values = Object.fromEntries(RECORD_TYPES[type].fields.map((f) => [f.key, ""]));
  const item: WsItem = { id, section: RECORD_SECTION[type], kind: type, category: RECORD_TYPES[type].category, values, original: { ...values }, source: "user", fieldStatus: {}, issues: [], selected: true, removed: false };
  const next = { ...ws, items: [...ws.items, item] };
  return { ws: type === "education" && !ws.currentEducationId ? { ...next, currentEducationId: id } : next, id };
}
export function addSingle(ws: Workspace, field: string): { ws: Workspace; id: string } {
  const id = newUserId(`profile${field}`);
  const s = SINGLE_SECTION[field];
  return { ws: { ...ws, items: [...ws.items, { id, section: s, kind: "single", field, category: "profile", values: { value: "" }, original: { value: "" }, source: "user", fieldStatus: {}, issues: [], selected: true, removed: false }] }, id };
}
/** Removing a record the student added deletes it; removing an extracted one marks it "not right". */
export function removeItem(ws: Workspace, id: string): Workspace {
  const items = ws.items.map((i) => (i.id === id ? { ...i, removed: true, selected: false } : i));
  const current = ws.currentEducationId === id ? defaultCurrentEducation(items) : ws.currentEducationId;
  return { items, currentEducationId: current };
}
export function restoreItem(ws: Workspace, id: string): Workspace {
  return { ...ws, items: ws.items.map((i) => (i.id === id ? { ...i, removed: false, selected: true } : i)) };
}
export function setCurrentEducation(ws: Workspace, id: string): Workspace {
  return { ...ws, currentEducationId: id };
}

export const isUserItem = (i: WsItem) => i.id.startsWith("user_");
export const isChanged = (i: WsItem) => Object.keys({ ...i.values, ...i.original }).some((k) => (i.values[k] ?? "").trim() !== (i.original[k] ?? "").trim());

// ---------------------------------------------------------------- validation

export interface Problem { itemId: string | null; field: string; section: SectionId; label: string; message: string }

/** Field problems in what will be saved (selected, not removed). */
export function fieldProblems(ws: Workspace): Problem[] {
  const out: Problem[] = [];
  for (const i of ws.items) {
    if (!i.selected || i.removed) continue;
    const defs: FieldDef[] = i.kind === "single" ? [singleDef(i.field!)!].filter(Boolean) : RECORD_TYPES[i.kind].fields;
    for (const d of defs) {
      const value = i.kind === "single" ? i.values.value ?? "" : i.values[d.key] ?? "";
      const msg = validateValue(d.kind, value);
      if (msg) out.push({ itemId: i.id, field: d.key, section: i.section, label: d.label, message: msg });
    }
  }
  return out;
}

/** The mandatory profile fields: full name, email, GitHub profile URL and the six current-education fields. */
export function mandatoryProblems(ws: Workspace, now = new Date()): Problem[] {
  const out: Problem[] = [];
  const saved = (field: string) => ws.items.find((i) => i.kind === "single" && i.field === field && i.selected && !i.removed && (i.values.value ?? "").trim());
  const need = (field: string, label: string, section: SectionId, kind: FieldKind) => {
    const it = saved(field);
    const any = ws.items.find((i) => i.kind === "single" && i.field === field && !i.removed);
    if (!it) out.push({ itemId: any?.id ?? null, field, section, label, message: any?.values.value?.trim() ? `Tick "${label}" to save it.` : `${label} is required.` });
    else { const m = validateValue(kind, it.values.value); if (m) out.push({ itemId: it.id, field, section, label, message: m }); }
  };
  need("fullName", "Full name", "identity", "text");
  need("email", "Email", "contact", "email");
  need("githubUrl", "GitHub profile URL", "online", "github");

  const cur = ws.items.find((i) => i.id === ws.currentEducationId && i.kind === "education" && !i.removed);
  if (!cur) {
    out.push({ itemId: null, field: "currentEducation", section: "education", label: "Current education", message: "Add your current education and mark it as current." });
    return out;
  }
  if (!cur.selected) out.push({ itemId: cur.id, field: "currentEducation", section: "education", label: "Current education", message: "Tick your current education to save it." });
  const v = cur.values;
  const req: Array<[string, string]> = [["degree", "Qualification / degree"], ["institution", "College / university"], ["fieldOfStudy", "Specialization / branch"], ["startDate", "Start year"], ["status", "Education status"], ["endDate", v.status === "Graduated" ? "Passing-out date" : "Expected passing-out date"]];
  for (const [k, label] of req) if (!(v[k] ?? "").trim()) out.push({ itemId: cur.id, field: k, section: "education", label, message: `${label} is required for your current education.` });
  const yearOf = (s?: string) => Number(s?.match(/\b(19|20)\d{2}\b/)?.[0] ?? NaN);
  if (v.startDate?.trim() && Number.isNaN(yearOf(v.startDate))) out.push({ itemId: cur.id, field: "startDate", section: "education", label: "Start year", message: "Enter a four-digit start year." });
  if (v.status && !EDUCATION_STATUS.includes(v.status as never)) out.push({ itemId: cur.id, field: "status", section: "education", label: "Education status", message: "Choose Pursuing or Graduated." });
  const end = yearOf(v.endDate), start = yearOf(v.startDate), thisYear = now.getUTCFullYear();
  if (v.endDate?.trim() && Number.isNaN(end)) out.push({ itemId: cur.id, field: "endDate", section: "education", label: "Passing-out date", message: "Include the year, for example May 2026." });
  if (!Number.isNaN(end) && !Number.isNaN(start) && end < start) out.push({ itemId: cur.id, field: "endDate", section: "education", label: "Passing-out date", message: "The passing-out date is before the start year." });
  if (v.status === "Graduated" && end > thisYear) out.push({ itemId: cur.id, field: "endDate", section: "education", label: "Passing-out date", message: "A graduated course cannot end in the future; choose Pursuing if you are still studying." });
  if (v.status === "Pursuing" && end < thisYear) out.push({ itemId: cur.id, field: "endDate", section: "education", label: "Expected passing-out date", message: "An expected passing-out date cannot be in the past; choose Graduated if you have finished." });
  return out;
}

/** Everything that blocks a save, one entry per field. */
export function saveProblems(ws: Workspace, now = new Date()): Problem[] {
  const seen = new Set<string>();
  return [...mandatoryProblems(ws, now), ...fieldProblems(ws)].filter((p) => {
    const k = `${p.itemId}|${p.field}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------- canonical save payload

export interface SaveDecision { candidateId: string; state: "confirmed" | "rejected"; correctedValue?: string; fields?: Record<string, string>; currentEducation?: boolean }
export interface SaveAddition { id: string; category: string; kind: WsItem["kind"]; field?: string; fields: Record<string, string>; currentEducation?: boolean }
export interface SavePayload { workspaceVersion: 1; decisions: SaveDecision[]; additions: SaveAddition[]; currentEducationId: string | null }

const sortKeys = (o: Record<string, string>) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k].trim()]));

/**
 * The canonical payload: one decision per extracted item (unticked = rejected),
 * changed fields only, user-added items as additions, in section order.
 */
export function serializeWorkspace(ws: Workspace): SavePayload {
  const order = (i: WsItem) => SECTIONS.findIndex((s) => s.id === i.section);
  const items = [...ws.items].sort((a, b) => order(a) - order(b));
  const decisions: SaveDecision[] = [];
  const additions: SaveAddition[] = [];
  for (const i of items) {
    const hasValue = Object.values(i.values).some((x) => x.trim());
    // Ticked but emptied is the same as "not right": nothing empty is ever saved.
    const confirmed = i.selected && !i.removed && hasValue;
    const current = i.id === ws.currentEducationId && i.kind === "education";
    if (isUserItem(i)) {
      if (i.saved && !confirmed) decisions.push({ candidateId: i.id, state: "rejected" });
      else if (confirmed && hasValue) additions.push({ id: i.id, category: i.category, kind: i.kind, ...(i.field ? { field: i.field } : {}), fields: sortKeys(i.values), ...(current ? { currentEducation: true } : {}) });
      continue;
    }
    const target = i.linkedCandidateId ?? i.id;
    const changed = isChanged(i);
    decisions.push({
      candidateId: target, state: confirmed ? "confirmed" : "rejected",
      ...(confirmed && changed ? { correctedValue: summarize(i.kind, i.values), fields: sortKeys(i.values) } : {}),
      ...(current && confirmed ? { currentEducation: true } : {}),
    });
  }
  return { workspaceVersion: 1, decisions, additions, currentEducationId: ws.currentEducationId };
}

/** Applies a save payload to a workspace built from the stored review (server-side validation). */
export function applyPayload(ws: Workspace, p: SavePayload): Workspace {
  const byId = new Map(p.decisions.map((d) => [d.candidateId, d]));
  const items = ws.items.map((i) => {
    const d = byId.get(i.linkedCandidateId ?? i.id);
    if (!d) return isUserItem(i) ? i : { ...i, selected: false };
    // A one-line correction of a single field is that field's value, so it is validated like one.
    const values = d.fields ? { ...i.values, ...d.fields } : i.kind === "single" && d.correctedValue?.trim() ? { value: d.correctedValue.trim() } : i.values;
    return { ...i, selected: d.state === "confirmed", removed: d.state === "rejected" && isUserItem(i), values };
  });
  for (const a of p.additions) {
    const existing = items.findIndex((i) => i.id === a.id || (a.kind === "single" && i.id === `user_profile_${a.field}`));
    const item: WsItem = {
      id: a.id, section: a.kind === "single" ? SINGLE_SECTION[a.field ?? ""] ?? "identity" : RECORD_SECTION[a.kind as RecordType], kind: a.kind, field: a.field, category: a.category,
      values: a.fields, original: {}, source: "user", fieldStatus: {}, issues: [], selected: true, removed: false,
    };
    if (existing >= 0) items[existing] = item; else items.push(item);
  }
  const current = p.additions.find((a) => a.currentEducation)?.id ?? p.decisions.find((d) => d.currentEducation)?.candidateId ?? p.currentEducationId;
  return { items, currentEducationId: current ?? null };
}

/** Values the onboarding profile takes from the workspace (its own fields only). */
export function acceptedProfileFrom(ws: Workspace): Record<string, string> {
  const single = (f: string) => ws.items.find((i) => i.kind === "single" && i.field === f && i.selected && !i.removed)?.values.value?.trim();
  const cur = ws.items.find((i) => i.id === ws.currentEducationId && i.selected && !i.removed);
  const out: Record<string, string | undefined> = {
    fullName: single("fullName"), email: single("email"), mobile: single("mobile"), location: single("location"),
    institution: cur?.values.institution, degree: cur?.values.degree, specialization: cur?.values.fieldOfStudy,
    expectedGraduationYear: cur?.values.endDate?.match(/\b(19|20)\d{2}\b/)?.[0],
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as Record<string, string>;
}
