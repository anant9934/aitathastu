/**
 * Project Evidence Ledger (Tasks 2.5.1-2.5.5, 2.2.4): every project from
 * every source (CV, GitHub, Kaggle, manual), each individually selectable
 * for the portfolio, editable in place, with optional AI descriptions,
 * hero previews, chosen metadata chips, and a Research & Publications view.
 *
 * Reads only the person's own rows (every query is scoped by person_id), so
 * the ledger can never show another student's Kaggle dataset or paper.
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, projects, evidenceItems, projectContributions } from "@/lib/db";
import { getProjectById, updateProject, saveProject } from "@/lib/repositories/project-repository";
import { getExternalConnectionByProvider, getSourceSnapshots } from "@/lib/repositories/connection-repository";
import {
  sanitizeLedgerMetadata, visibleHighlights, type HighlightOption, type ProjectLedgerMetadata, type ProjectPreview,
} from "@/lib/domain/project-ledger";
import type { IntelligenceRouter } from "@/lib/intelligence/router";

export type LedgerProject = {
  id: string;
  title: string;
  summary: string;
  description: string;
  technologies: string[];
  sources: string[];
  status: string;
  repositoryUrl: string | null;
  demoUrl: string | null;
  portfolioIncluded: boolean;
  metadata: ProjectLedgerMetadata;
  /** Chips shown on the exported card, already resolved to labels. */
  highlights: { key: HighlightOption; label: string }[];
  contribution: { roles: string[]; note: string } | null;
  updatedAt: string;
};

export type LedgerPublication = {
  id: string;
  title: string;
  year: number | null;
  venue: string | null;
  coAuthors: string[];
  citationCount: number | null;
  doi: string | null;
  url: string | null;
  source: string; // "scholar" | "manual"
  editable: boolean;
  portfolioIncluded: boolean;
};

export type Ledger = {
  projects: LedgerProject[];
  publications: LedgerPublication[];
  /** A verified ORCID / Semantic Scholar ID is connected; without one, publications are never guessed. */
  hasResearchId: boolean;
  counts: { bySource: Record<string, number>; included: number; total: number };
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80);

function toLedgerProject(p: typeof projects.$inferSelect, contribution: { roles: string[]; note: string } | null): LedgerProject {
  const metadata = sanitizeLedgerMetadata(p.metadata);
  const technologies = (p.technologies as string[]) ?? [];
  return {
    id: p.id, title: p.title, summary: p.summary ?? "", description: p.description ?? "", technologies,
    sources: (p.sources as string[]) ?? [], status: p.status, repositoryUrl: p.repositoryUrl, demoUrl: p.demoUrl,
    portfolioIncluded: p.portfolioIncluded, metadata, highlights: visibleHighlights(metadata, technologies),
    contribution, updatedAt: p.updatedAt.toISOString(),
  };
}

export async function getLedger(personId: string): Promise<Ledger> {
  const db = await getDb();
  const [rows, contribs, pubs, scholarConn, snaps] = await Promise.all([
    db.select().from(projects).where(eq(projects.personId, personId)).orderBy(desc(projects.updatedAt)),
    db.select().from(projectContributions).where(eq(projectContributions.personId, personId)),
    db.select().from(evidenceItems).where(and(eq(evidenceItems.personId, personId), eq(evidenceItems.category, "publication"))),
    getExternalConnectionByProvider(personId, "scholar"),
    getSourceSnapshots(personId, "scholar", { limit: 1 }),
  ]);
  const contributionOf = new Map(contribs.map((c) => [c.projectId, { roles: (c.roles as string[]) ?? [], note: c.description ?? "" }]));
  const ledgerProjects = rows.filter((p) => p.status !== "archived" && p.status !== "removed").map((p) => toLedgerProject(p, contributionOf.get(p.id) ?? null));

  // Structured paper fields live in the latest Scholar snapshot; evidence rows carry the student's curation.
  type Paper = { title: string; year: number | null; venue: string | null; doi: string | null; url: string | null; citationCount: number | null; coAuthors: string[]; sourceId: string };
  const papers = ((snaps[0]?.snapshotData as { papers?: Paper[] } | undefined)?.papers ?? []);
  const paperByKey = new Map(papers.map((p) => [`scholar_${p.doi ? `doi_${slug(p.doi)}` : slug(p.sourceId)}`, p]));
  const publications: LedgerPublication[] = pubs.map((e) => {
    const paper = e.importKey ? paperByKey.get(e.importKey) : undefined;
    const yearFromValue = Number((e.value.match(/\b(19|20)\d{2}\b/) ?? [])[0]) || null;
    return {
      id: e.id, title: e.subject, year: paper?.year ?? yearFromValue, venue: paper?.venue ?? (e.value.split(",")[0]?.trim() || null),
      coAuthors: paper?.coAuthors ?? [], citationCount: paper?.citationCount ?? null, doi: paper?.doi ?? null,
      url: paper?.url ?? (e.sourceReference?.startsWith("http") ? e.sourceReference : null),
      source: e.originSource === "scholar" ? "scholar" : "manual", editable: e.editable, portfolioIncluded: e.portfolioIncluded,
    };
  });

  const bySource: Record<string, number> = {};
  for (const p of ledgerProjects) for (const s of p.sources) bySource[s] = (bySource[s] ?? 0) + 1;
  return {
    projects: ledgerProjects, publications,
    hasResearchId: Boolean(scholarConn && scholarConn.status !== "disconnected" && scholarConn.externalUsername),
    counts: { bySource, included: ledgerProjects.filter((p) => p.portfolioIncluded).length, total: ledgerProjects.length },
  };
}

export class LedgerError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export type LedgerProjectPatch = {
  title?: string; summary?: string; description?: string; technologies?: string[];
  repositoryUrl?: string | null; demoUrl?: string | null;
  portfolioIncluded?: boolean; status?: "confirmed" | "candidate" | "archived";
  role?: string; highlight?: HighlightOption[];
};

/** In-place edit from the ledger (2.2.4): content edits are recorded so re-imports leave them alone. */
export async function updateLedgerProject(personId: string, projectId: string, patch: LedgerProjectPatch) {
  if (patch.title !== undefined && !patch.title.trim()) throw new LedgerError("A project needs a name.", 400);
  const updated = await updateProject(personId, projectId, {
    title: patch.title?.trim(), summary: patch.summary, description: patch.description,
    technologies: patch.technologies?.map((t) => t.trim()).filter(Boolean),
    repositoryUrl: patch.repositoryUrl, demoUrl: patch.demoUrl, status: patch.status,
    portfolioIncluded: patch.portfolioIncluded,
    ledgerMetadata: patch.role !== undefined || patch.highlight !== undefined ? { role: patch.role, highlight: patch.highlight } : undefined,
    markEdited: true,
  });
  if (!updated) throw new LedgerError("Project not found.", 404);
  return toLedgerProject(updated, null);
}

/** Manual "add a project" (2.5.1): confirmed, in the portfolio, source "manual". */
export async function addManualProject(personId: string, input: { title: string; summary?: string; technologies?: string[]; repositoryUrl?: string | null; demoUrl?: string | null }) {
  if (!input.title?.trim()) throw new LedgerError("A project needs a name.", 400);
  const created = await saveProject(personId, {
    title: input.title.trim(), summary: input.summary ?? "", description: input.summary ?? "",
    technologies: input.technologies ?? [], sources: ["manual"], repositoryUrl: input.repositoryUrl ?? null, demoUrl: input.demoUrl ?? null, status: "confirmed",
  });
  return toLedgerProject(created, null);
}

// ── 2.5.2 On-demand AI description ─────────────────────────────────────────
const SummarySchema = z.object({
  problem: z.string().min(10).max(320),
  architecture: z.string().min(10).max(320),
  impact: z.string().min(10).max(320),
});
const SUMMARY_JSON_SCHEMA = {
  type: "object", additionalProperties: false, required: ["problem", "architecture", "impact"],
  properties: {
    problem: { type: "string", description: "One sentence: the problem the project solves." },
    architecture: { type: "string", description: "One sentence: how it is built (models, data, stack)." },
    impact: { type: "string", description: "One sentence: the concrete result or who it helps. No invented numbers." },
  },
};
/** Repeat clicks inside this window return the saved summary instead of spending tokens again. */
export const ENHANCE_COOLDOWN_MS = 10 * 60_000;

export async function enhanceProject(personId: string, projectId: string, deps: { router?: Pick<IntelligenceRouter, "completeStructured">; now?: number } = {}) {
  const project = await getProjectById(personId, projectId);
  if (!project) throw new LedgerError("Project not found.", 404);
  // Cost control (2.5.2): only projects the student selected, only on explicit request.
  if (!project.portfolioIncluded) throw new LedgerError("Add this project to your portfolio first; AI descriptions are only written for selected projects.", 409);
  const meta = sanitizeLedgerMetadata(project.metadata);
  const now = deps.now ?? Date.now();
  if (meta.aiSummary && now - Date.parse(meta.aiSummary.generatedAt) < ENHANCE_COOLDOWN_MS) {
    return { project: toLedgerProject(project, null), reused: true };
  }
  const router = deps.router ?? (await import("@/lib/intelligence/router")).defaultIntelligenceRouter;
  const { buildSafePrompt } = await import("@/lib/intelligence/prompt-defense");
  const facts = {
    title: project.title,
    existing_description: (project.description || project.summary || "").slice(0, 1200),
    technologies: ((project.technologies as string[]) ?? []).slice(0, 15).join(", "),
    sources: ((project.sources as string[]) ?? []).join(", "),
  };
  let result;
  try {
    result = await router.completeStructured({
      task: "project_summary",
      personId,
      schemaName: "project_summary",
      jsonSchema: SUMMARY_JSON_SCHEMA,
      maxTokens: 400,
      timeoutMs: 20_000,
      systemPrompt: "You write short, factual engineering summaries of a student's project for a portfolio. Use only the facts given. Never invent metrics, users, awards or results; if impact is unknown, describe what the project enables. Plain English, one sentence per field.",
      userPrompt: buildSafePrompt("Summarise this project as problem, architecture and impact:", { project: JSON.stringify(facts) }),
    } as never, SummarySchema);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "quota") throw new LedgerError((error as Error).message || "You've reached today's AI limit; your project is unchanged.", 429);
    // All providers down / not configured: degrade without touching the project.
    throw new LedgerError("AI descriptions aren't available right now. Your project is unchanged; try again in a few minutes.", 503);
  }
  const aiSummary = { ...result.data, generatedAt: new Date(now).toISOString(), provider: result.provider, model: result.model };
  const summary = `${aiSummary.problem} ${aiSummary.architecture} ${aiSummary.impact}`;
  const updated = await updateProject(personId, projectId, { summary, ledgerMetadata: { aiSummary }, markEdited: true });
  return { project: toLedgerProject(updated!, null), reused: false };
}

// ── 2.5.3 Hero preview ─────────────────────────────────────────────────────
function findOgImage(html: string, pageUrl: string): string | null {
  const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
  if (!m) return null;
  try {
    const url = new URL(m[1].trim(), pageUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Checks the demo site once and caches the result; the page renders an SVG banner whenever there is no image. */
export async function refreshProjectPreview(personId: string, projectId: string, deps: { fetchHtml?: (url: string) => Promise<{ url: string; html: string }> } = {}) {
  const project = await getProjectById(personId, projectId);
  if (!project) throw new LedgerError("Project not found.", 404);
  const checkedAt = new Date().toISOString();
  let preview: ProjectPreview;
  if (!project.demoUrl) {
    preview = { kind: "banner", reason: "no_demo_url", checkedAt };
  } else {
    const { isSafePublicUrl, fetchSafeHtml } = await import("@/lib/connectors/portfolio/client");
    if (!isSafePublicUrl(project.demoUrl).safe) {
      preview = { kind: "banner", reason: "blocked_url", checkedAt };
    } else {
      try {
        const page = await (deps.fetchHtml ?? fetchSafeHtml)(project.demoUrl);
        const image = findOgImage(page.html, page.url);
        preview = image && isSafePublicUrl(image).safe
          ? { kind: "image", imageUrl: image, sourceUrl: page.url, checkedAt }
          : { kind: "banner", reason: "no_image_found", checkedAt };
      } catch {
        preview = { kind: "banner", reason: "fetch_failed", checkedAt };
      }
    }
  }
  const updated = await updateProject(personId, projectId, { ledgerMetadata: { preview } });
  return toLedgerProject(updated!, null);
}

// ── 2.5.5 Publications ─────────────────────────────────────────────────────
export async function setPublicationIncluded(personId: string, evidenceId: string, included: boolean) {
  const db = await getDb();
  const [row] = await db.update(evidenceItems).set({ portfolioIncluded: included, updatedAt: new Date() })
    .where(and(eq(evidenceItems.id, evidenceId), eq(evidenceItems.personId, personId), eq(evidenceItems.category, "publication"))).returning();
  if (!row) throw new LedgerError("Publication not found.", 404);
  return row;
}

/** A manual citation the student adds or corrects; imported papers stay as imported (they are not editable here). */
export async function saveManualPublication(personId: string, input: { id?: string; title: string; venue?: string; year?: number | null; url?: string | null }) {
  if (!input.title?.trim()) throw new LedgerError("A publication needs a title.", 400);
  const { createEvidenceRecord } = await import("@/lib/repositories/evidence-repository");
  const value = [input.venue?.trim(), input.year ? String(input.year) : ""].filter(Boolean).join(", ") || "Publication";
  const db = await getDb();
  if (input.id) {
    const [row] = await db.update(evidenceItems)
      .set({ subject: input.title.trim(), value, sourceReference: input.url ?? null, updatedAt: new Date() })
      .where(and(eq(evidenceItems.id, input.id), eq(evidenceItems.personId, personId), eq(evidenceItems.category, "publication"), eq(evidenceItems.editable, true), eq(evidenceItems.originSource, "manual")))
      .returning();
    if (!row) throw new LedgerError("Only citations you added yourself can be edited.", 403);
    return row;
  }
  return createEvidenceRecord(personId, {
    category: "publication", subject: input.title.trim(), value, source: "self_reported", verificationStatus: "self_reported",
    sourceReference: input.url ?? undefined, interpretation: `Self-reported publication: ${input.title.trim()}.`,
    whyItMatters: "A publication you added yourself; it is shown as self-reported.", originSource: "manual",
  } as never);
}

// ── Export (2.5.4): the portfolio pack, with only the chips the student chose ──
export async function exportPortfolio(personId: string) {
  const ledger = await getLedger(personId);
  return {
    generatedAt: new Date().toISOString(),
    projects: ledger.projects.filter((p) => p.portfolioIncluded).map((p) => ({
      title: p.title, summary: p.summary, technologies: p.technologies, repositoryUrl: p.repositoryUrl, demoUrl: p.demoUrl,
      sources: p.sources, highlights: p.highlights.map((h) => h.label), role: p.metadata.role ?? null,
      preview: p.metadata.preview?.kind === "image" ? p.metadata.preview.imageUrl : null,
    })),
    publications: ledger.publications.filter((p) => p.portfolioIncluded).map(({ title, year, venue, doi, url, citationCount, source }) => ({ title, year, venue, doi, url, citationCount, source })),
  };
}
