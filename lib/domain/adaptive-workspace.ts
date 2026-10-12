export type WorkspaceRole = "student" | "faculty";

export const PURPOSES = {
  student: [
    { id: "learning", title: "Learn AI & ML", widget: "learning", description: "A learning path shaped by your goal and current evidence." },
    { id: "jobs", title: "Internships & Jobs", widget: "opportunities", description: "Relevant openings and the evidence to prepare for them." },
    { id: "people", title: "People & Mentors", widget: "people", description: "Connect with people when real connections are available." },
    { id: "collaboration", title: "Collaborate", widget: "collaboration", description: "Find shared work and build with others." },
    { id: "projects", title: "Build Projects", widget: "projects", description: "Turn your work into clear, reviewable evidence." },
    { id: "research_events", title: "Research & Events", widget: "research", description: "Follow research work and relevant events." },
  ],
  faculty: [
    { id: "teaching", title: "Teaching & Learning", widget: "teaching", description: "Plan teaching and share learning resources." },
    { id: "assessments", title: "Assessments & Evaluation", widget: "assessments", description: "Review assigned evaluation work when authorized." },
    { id: "mentorship", title: "Student Mentorship", widget: "mentorship", description: "Support students assigned to you." },
    { id: "research", title: "Research & Publications", widget: "research", description: "Organize publications and research activity." },
    { id: "projects", title: "Projects & Collaboration", widget: "projects", description: "Coordinate academic projects." },
    { id: "meetings", title: "Meetings & Academic Coordination", widget: "meetings", description: "Keep academic conversations in view." },
  ],
} as const;

export type WidgetLayout = { version: 1; pinned: string[]; hidden: string[]; order: string[]; density: "comfortable" | "compact"; sizes: Record<string, "standard" | "wide"> };
export const emptyWidgetLayout: WidgetLayout = { version: 1, pinned: [], hidden: [], order: [], density: "comfortable", sizes: {} };

export function validPurposeIds(role: WorkspaceRole, input: unknown): string[] {
  const allowed = new Set<string>(PURPOSES[role].map((purpose) => purpose.id));
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((id): id is string => typeof id === "string" && allowed.has(id)))].slice(0, 3);
}

export function validatePurposes(role: WorkspaceRole, input: unknown): string[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 3) throw new Error("Choose one to three ranked purposes.");
  const purposes = validPurposeIds(role, input);
  if (purposes.length !== input.length) throw new Error("Purposes must be distinct and available for your selected role.");
  return purposes;
}

export function normalizeWidgetLayout(role: WorkspaceRole, input: unknown): WidgetLayout {
  const raw = input && typeof input === "object" ? input as Partial<WidgetLayout> : {};
  const allowed = new Set<string>(PURPOSES[role].map((purpose) => purpose.widget));
  const list = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && allowed.has(id)))] : [];
  const sizes: WidgetLayout["sizes"] = {};
  if (raw.sizes && typeof raw.sizes === "object") for (const [key, size] of Object.entries(raw.sizes)) {
    if (allowed.has(key) && (size === "standard" || size === "wide")) sizes[key] = size;
  }
  return { version: 1, pinned: list(raw.pinned), hidden: list(raw.hidden), order: list(raw.order), density: raw.density === "compact" ? "compact" : "comfortable", sizes };
}

export function composeWidgetIds(role: WorkspaceRole, purposes: string[], layout: WidgetLayout): string[] {
  const registry = PURPOSES[role];
  const defaults: string[] = purposes.flatMap((id) => { const widget = registry.find((purpose) => purpose.id === id)?.widget; return widget ? [widget] : []; });
  const pinned = [...new Set([...layout.order, ...layout.pinned])].filter((id) => layout.pinned.includes(id));
  const order = [...new Set([...pinned, ...layout.order.filter((id) => defaults.includes(id)), ...defaults])];
  return order.filter((id) => !layout.hidden.includes(id));
}
