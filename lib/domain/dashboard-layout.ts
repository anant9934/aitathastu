/**
 * Priority-shaped dashboard (Tasks 2.3.1, 2.3.2). The student's #1 priority
 * picks an archetype with its own hero widget, primary call to action and
 * section set (not a reordering of one fixed layout); every priority then
 * weights the digital-footprint module, and each footprint card says why it
 * is ranked where it is.
 *
 * Pure: the dashboard service gathers the inputs, Phase 3's UI renders this
 * contract. Keep it additive.
 */
import type { CanonicalInterest } from "./personalization-engine";

export type FootprintSource = "github" | "linkedin" | "leetcode" | "hackerrank" | "kaggle" | "scholar";

export type DashboardLayoutInput = {
  primary: CanonicalInterest;
  secondary: CanonicalInterest[];
  targetRole: string;
  /** Publishable verified readiness 0..100, or null when there is not enough verified evidence. */
  readiness: number | null;
  /** Skills the target role needs that have no evidence yet. */
  skillGaps: string[];
  projects: { id: string; title: string; portfolioIncluded: boolean; updatedAt: string; sources: string[] }[];
  /** Next learning steps from the roadmap. */
  learning: { title: string }[];
  publications: number;
  footprints: Partial<Record<FootprintSource, { connected: boolean; state: string; found: string | null }>>;
};

type Cta = { label: string; href: string };

export type HeroWidget =
  | { kind: "readiness"; title: string; readiness: number | null; note: string; gaps: string[]; cta: Cta }
  | { kind: "project_workbench"; title: string; projects: { id: string; title: string; inPortfolio: boolean }[]; portfolioCount: number; cta: Cta }
  | { kind: "learning_path"; title: string; nextSteps: string[]; gaps: string[]; cta: Cta }
  | { kind: "research_profile"; title: string; publications: number; hasResearchId: boolean; cta: Cta }
  | { kind: "network"; title: string; linkedinConnected: boolean; sharedProjects: number; cta: Cta };

export type SectionKind = "skill_gaps" | "portfolio" | "roadmap" | "practice" | "footprint" | "publications" | "journey" | "opportunities" | "people";
export type DashboardSection = { id: SectionKind; title: string; emphasis: "primary" | "secondary" | "supporting" };

export type FootprintCard = {
  source: FootprintSource;
  label: string;
  connected: boolean;
  /** What the source contributed, e.g. "312 problems solved"; null when nothing yet. */
  headline: string | null;
  /** Why this source is ranked here, in the student's words. */
  reason: string;
  weight: number;
  href: string;
};

export type DashboardLayout = {
  archetype: CanonicalInterest;
  hero: HeroWidget;
  sections: DashboardSection[];
  footprint: FootprintCard[];
};

const LABEL: Record<FootprintSource, string> = {
  github: "GitHub", linkedin: "LinkedIn", leetcode: "LeetCode", hackerrank: "HackerRank", kaggle: "Kaggle", scholar: "Research papers",
};

/** How much each focus values each source (0-3). */
const WEIGHTS: Record<CanonicalInterest, Partial<Record<FootprintSource, number>>> = {
  learning: { leetcode: 3, hackerrank: 3, github: 2, kaggle: 1 },
  jobs: { github: 3, linkedin: 3, leetcode: 2, hackerrank: 2, kaggle: 1 },
  projects: { github: 3, kaggle: 2, linkedin: 1 },
  research_events: { scholar: 3, kaggle: 2, github: 1 },
  collaboration: { linkedin: 3, github: 2, kaggle: 1 },
  people: { linkedin: 3, github: 1, scholar: 1 },
};

const WHY: Record<CanonicalInterest, string> = {
  learning: "practice and code volume show what you are learning",
  jobs: "recruiters look here first",
  projects: "your built work lives here",
  research_events: "your research record",
  collaboration: "shows who you have built with",
  people: "how mentors and peers find you",
};

const FOCUS_NAME: Record<CanonicalInterest, string> = {
  learning: "learning", jobs: "internships and jobs", projects: "building projects",
  research_events: "research", collaboration: "collaboration", people: "people and mentors",
};

export function rankFootprints(input: Pick<DashboardLayoutInput, "primary" | "secondary" | "footprints">): FootprintCard[] {
  const sources = Object.keys(LABEL) as FootprintSource[];
  return sources
    .map((source) => {
      const primaryWeight = (WEIGHTS[input.primary][source] ?? 0) * 3;
      const secondaryWeight = input.secondary.reduce((n, s) => n + (WEIGHTS[s]?.[source] ?? 0), 0);
      const fp = input.footprints[source];
      const driver = primaryWeight > 0 ? input.primary : input.secondary.find((s) => (WEIGHTS[s]?.[source] ?? 0) > 0);
      return {
        source, label: LABEL[source], connected: Boolean(fp?.connected), headline: fp?.found ?? null,
        reason: driver ? `Ranked for ${FOCUS_NAME[driver]}: ${WHY[driver]}.` : "Not tied to your current priorities.",
        weight: primaryWeight + secondaryWeight + (fp?.connected ? 0.5 : 0),
        href: "/student/connections",
      };
    })
    .filter((c) => c.weight > 0.5 || c.connected)
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
}

function hero(input: DashboardLayoutInput): HeroWidget {
  const sharedProjects = input.projects.filter((p) => p.sources.includes("github")).length;
  switch (input.primary) {
    case "jobs":
      return {
        kind: "readiness", title: `Readiness for ${input.targetRole}`, readiness: input.readiness,
        note: input.readiness === null ? "Not enough verified evidence for a score yet. Close a gap below to start one." : "Based only on verified evidence.",
        gaps: input.skillGaps.slice(0, 4), cta: { label: "Build my application pack", href: "/student/projects" },
      };
    case "projects":
      return {
        kind: "project_workbench", title: "Your project workbench",
        projects: [...input.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4).map((p) => ({ id: p.id, title: p.title, inPortfolio: p.portfolioIncluded })),
        portfolioCount: input.projects.filter((p) => p.portfolioIncluded).length,
        cta: input.projects.length ? { label: "Open my project ledger", href: "/student/projects" } : { label: "Add my first project", href: "/student/projects" },
      };
    case "research_events":
      return {
        kind: "research_profile", title: "Your research record", publications: input.publications, hasResearchId: Boolean(input.footprints.scholar?.connected),
        cta: input.footprints.scholar?.connected ? { label: "Review my publications", href: "/student/projects" } : { label: "Connect my ORCID iD", href: "/student/connections" },
      };
    case "people":
    case "collaboration":
      return {
        kind: "network", title: input.primary === "people" ? "Your professional network" : "Building with others",
        linkedinConnected: Boolean(input.footprints.linkedin?.connected), sharedProjects,
        cta: input.footprints.linkedin?.connected ? { label: "Review my connections", href: "/student/connections" } : { label: "Connect LinkedIn (optional)", href: "/student/connections" },
      };
    case "learning":
    default:
      return {
        kind: "learning_path", title: "Your next learning steps", nextSteps: input.learning.slice(0, 3).map((l) => l.title), gaps: input.skillGaps.slice(0, 3),
        cta: { label: "Open my learning roadmap", href: "/student/roadmap" },
      };
  }
}

const SECTIONS: Record<CanonicalInterest, [SectionKind, string][]> = {
  jobs: [["skill_gaps", "Skills to close for your target role"], ["portfolio", "Your application pack"], ["footprint", "Where recruiters will look"], ["opportunities", "Openings"], ["journey", "Recent progress"]],
  projects: [["portfolio", "Portfolio projects"], ["footprint", "Your building record"], ["skill_gaps", "Skills your projects could show next"], ["roadmap", "What to build next"]],
  learning: [["roadmap", "Your roadmap"], ["practice", "Practice record"], ["skill_gaps", "Gaps to work on"], ["portfolio", "Projects that prove it"]],
  research_events: [["publications", "Publications"], ["footprint", "Your research footprint"], ["roadmap", "Research skills to grow"], ["portfolio", "Research projects"]],
  collaboration: [["footprint", "Where collaborators find you"], ["portfolio", "Shared projects"], ["people", "People to build with"], ["roadmap", "Your roadmap"]],
  people: [["footprint", "Where people find you"], ["people", "People and mentors"], ["portfolio", "Work to show them"], ["roadmap", "Your roadmap"]],
};

export function composeDashboardLayout(input: DashboardLayoutInput): DashboardLayout {
  const sections = SECTIONS[input.primary].map(([id, title], i) => ({ id, title, emphasis: i === 0 ? "primary" as const : i < 3 ? "secondary" as const : "supporting" as const }));
  return { archetype: input.primary, hero: hero(input), sections, footprint: rankFootprints(input) };
}
