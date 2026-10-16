/**
 * Project Evidence Ledger contract (Tasks 2.5.1-2.5.5, 2.2.4). Stored on
 * `projects.metadata` (jsonb) next to `projects.portfolio_included`.
 *
 * Phase 3 builds against these shapes; keep them additive.
 */

/** Metadata chips a student can choose to show on the exported project card (2.5.4). */
export const HIGHLIGHT_OPTIONS = ["stars", "forks", "languages", "role"] as const;
export type HighlightOption = (typeof HIGHLIGHT_OPTIONS)[number];

/** Fields a student can edit in place; once edited, imports never overwrite them (2.2.4). */
export const EDITABLE_PROJECT_FIELDS = ["title", "summary", "description", "technologies", "repositoryUrl", "demoUrl"] as const;
export type EditableProjectField = (typeof EDITABLE_PROJECT_FIELDS)[number];

export type AiProjectSummary = {
  problem: string;
  architecture: string;
  impact: string;
  generatedAt: string;
  provider: string;
  model: string;
};

export type ProjectPreview =
  | { kind: "image"; imageUrl: string; sourceUrl: string; checkedAt: string }
  | { kind: "banner"; reason: "no_demo_url" | "no_image_found" | "fetch_failed" | "blocked_url"; checkedAt: string };

export type ProjectLedgerMetadata = {
  /** From GitHub; never set by hand. */
  stars?: number;
  forks?: number;
  isFork?: boolean;
  languages?: string[];
  /** The student's own role on the project, e.g. "Sole developer". */
  role?: string;
  /** Chips shown on the exported card, in order. */
  highlight?: HighlightOption[];
  aiSummary?: AiProjectSummary;
  preview?: ProjectPreview;
  /** Fields the student edited; imports leave these alone. */
  editedFields?: EditableProjectField[];
};

/** Keys an import (GitHub, Kaggle, CV) may write. Everything else is the student's. */
export const IMPORT_METADATA_KEYS = ["stars", "forks", "isFork", "languages"] as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined);

/** Keeps only known, well-typed keys: metadata arrives from clients and imports. */
export function sanitizeLedgerMetadata(raw: unknown): ProjectLedgerMetadata {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: ProjectLedgerMetadata = {};
  if (num(m.stars) !== undefined) out.stars = num(m.stars);
  if (num(m.forks) !== undefined) out.forks = num(m.forks);
  if (typeof m.isFork === "boolean") out.isFork = m.isFork;
  if (Array.isArray(m.languages)) out.languages = [...new Set(m.languages.map((l) => str(l, 40)).filter(Boolean) as string[])].slice(0, 12);
  const role = str(m.role, 80);
  if (role) out.role = role;
  if (Array.isArray(m.highlight)) out.highlight = [...new Set(m.highlight.filter((h): h is HighlightOption => (HIGHLIGHT_OPTIONS as readonly string[]).includes(h as string)))];
  if (Array.isArray(m.editedFields)) out.editedFields = [...new Set(m.editedFields.filter((f): f is EditableProjectField => (EDITABLE_PROJECT_FIELDS as readonly string[]).includes(f as string)))];
  const ai = m.aiSummary as Record<string, unknown> | undefined;
  if (ai && typeof ai === "object" && str(ai.problem, 400) && str(ai.architecture, 400) && str(ai.impact, 400)) {
    out.aiSummary = {
      problem: str(ai.problem, 400)!, architecture: str(ai.architecture, 400)!, impact: str(ai.impact, 400)!,
      generatedAt: str(ai.generatedAt, 40) || new Date(0).toISOString(), provider: str(ai.provider, 40) || "unknown", model: str(ai.model, 80) || "unknown",
    };
  }
  const p = m.preview as Record<string, unknown> | undefined;
  if (p && p.kind === "image" && str(p.imageUrl, 1000)?.startsWith("https://")) {
    out.preview = { kind: "image", imageUrl: str(p.imageUrl, 1000)!, sourceUrl: str(p.sourceUrl, 1000) || "", checkedAt: str(p.checkedAt, 40) || "" };
  } else if (p && p.kind === "banner" && ["no_demo_url", "no_image_found", "fetch_failed", "blocked_url"].includes(p.reason as string)) {
    out.preview = { kind: "banner", reason: p.reason as "no_demo_url", checkedAt: str(p.checkedAt, 40) || "" };
  }
  return out;
}

/** Only the import-owned keys of `raw` (what a GitHub/Kaggle sync may write). */
export function importMetadata(raw: unknown): Partial<ProjectLedgerMetadata> {
  const clean = sanitizeLedgerMetadata(raw);
  return Object.fromEntries(IMPORT_METADATA_KEYS.filter((k) => clean[k] !== undefined).map((k) => [k, clean[k]]));
}

/** The chips actually shown for a project: chosen highlights that have a value. */
export function visibleHighlights(meta: ProjectLedgerMetadata, technologies: string[]): { key: HighlightOption; label: string }[] {
  const out: { key: HighlightOption; label: string }[] = [];
  for (const key of meta.highlight ?? []) {
    if (key === "stars" && meta.stars !== undefined) out.push({ key, label: `${meta.stars} star${meta.stars === 1 ? "" : "s"}` });
    if (key === "forks" && meta.forks !== undefined) out.push({ key, label: `${meta.forks} fork${meta.forks === 1 ? "" : "s"}` });
    if (key === "languages") {
      const langs = meta.languages?.length ? meta.languages : technologies;
      if (langs.length) out.push({ key, label: langs.slice(0, 4).join(" · ") });
    }
    if (key === "role" && meta.role) out.push({ key, label: meta.role });
  }
  return out;
}
