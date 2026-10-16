import crypto from "crypto";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { getDb, projects, projectContributions } from "../db";
import { normalizeProjectTitle, baseProjectTitle } from "../text/normalize";
import { pageBounds, type PageOptions } from "./pagination";
import type {
  ProjectLinkRecord,
  ProjectTimelineRecord,
  TeamMemberRecord,
  MentorRecord,
  AiMlDetailsRecord,
  HardwareDetailsRecord,
  ProjectCategory,
  ProjectPurpose,
  ProjectStatus,
  ProjectVisibility,
  ProjectType,
} from "../domain/project-taxonomy";
import { importMetadata, sanitizeLedgerMetadata, EDITABLE_PROJECT_FIELDS, type EditableProjectField, type ProjectLedgerMetadata } from "../domain/project-ledger";

export type CreateProjectInput = {
  title: string;
  summary?: string;
  description?: string;
  category?: ProjectCategory | string;
  purpose?: ProjectPurpose | string;
  visibility?: ProjectVisibility | string;
  projectType?: ProjectType | string;
  repositoryUrl?: string | null;
  demoUrl?: string | null;
  technologies?: string[];
  sources?: string[];
  status?: ProjectStatus | string;
  links?: ProjectLinkRecord[];
  timeline?: ProjectTimelineRecord;
  team?: {
    projectStructure: "individual" | "team";
    teamName?: string;
    teamMembers?: TeamMemberRecord[];
    mentors?: MentorRecord[];
  };
  aiDetails?: AiMlDetailsRecord;
  hardwareDetails?: HardwareDetailsRecord;
  media?: unknown[];
  /** Import-owned ledger metadata (stars, forks, isFork, languages); see lib/domain/project-ledger.ts. */
  metadata?: Partial<ProjectLedgerMetadata>;
};

type ProjectRow = typeof projects.$inferSelect;

const normalizeRepoUrl = (url: string) => url.trim().toLowerCase().replace(/\.git$/, "").replace(/\/+$/, "");

/** Finds this person's project that is the same as `input`: same normalized title, or same repository URL. */
async function findMatchingProject(personId: string, input: CreateProjectInput): Promise<{ match: ProjectRow | null; all: ProjectRow[] }> {
  const db = await getDb();
  const all = await db.select().from(projects).where(eq(projects.personId, personId));
  const key = normalizeProjectTitle(input.title);
  const base = baseProjectTitle(input.title);
  const repo = input.repositoryUrl ? normalizeRepoUrl(input.repositoryUrl) : "";
  const demo = input.demoUrl ? normalizeRepoUrl(input.demoUrl) : "";
  const keyOf = (p: ProjectRow) => p.normalizedTitle ?? normalizeProjectTitle(p.title);
  // Strongest evidence first: same repository, same demo link, same title,
  // then a title that is the other's name without its subtitle
  // ("Pathified" vs "Pathified (AI Career App)"); short bases (< 4 chars)
  // are too generic to merge on.
  const match =
    all.find((p) => Boolean(repo && p.repositoryUrl && normalizeRepoUrl(p.repositoryUrl) === repo)) ??
    all.find((p) => Boolean(demo && p.demoUrl && normalizeRepoUrl(p.demoUrl) === demo)) ??
    all.find((p) => keyOf(p) === key) ??
    all.find((p) => {
      const otherBase = baseProjectTitle(p.title);
      return (base.length >= 4 && (base === keyOf(p) || base === otherBase)) || (otherBase.length >= 4 && otherBase === key);
    }) ??
    null;
  return { match, all };
}

/**
 * Creates a project, or merges into the matching one when the same project
 * arrives again (e.g. "Face Recognition System" from a CV and the
 * "face-recognition" GitHub repo). Matching is by normalizeProjectTitle or
 * repository URL. The unique index on (person_id, normalized_title) closes
 * the race between two concurrent imports; the loser retries as a merge.
 */
export async function saveProject(personId: string, input: CreateProjectInput, attempt = 0): Promise<ProjectRow> {
  const db = await getDb();
  const now = new Date();
  const id = `proj_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const normalizedTitle = normalizeProjectTitle(input.title);

  const { match, all } = await findMatchingProject(personId, input);
  const existing = match ? [match] : [];

  if (existing.length > 0) {
    // Backfill the key on older rows, unless another of this person's rows already claims it.
    const canClaimKey = !existing[0].normalizedTitle &&
      !all.some((p) => p.id !== existing[0].id && p.normalizedTitle === normalizedTitle);
    // Union computed by Postgres against the row as it is at UPDATE time, so
    // two imports merging into one project concurrently both keep their
    // sources (a JS read-modify-write here would let the slower one win).
    const unionJsonArray = (column: typeof projects.sources | typeof projects.technologies, values: string[]): SQL =>
      sql`(SELECT coalesce(jsonb_agg(DISTINCT v ORDER BY v), '[]'::jsonb) FROM jsonb_array_elements(coalesce(${column}, '[]'::jsonb) || ${JSON.stringify(values)}::jsonb) AS v)`;
    const targetStatus = existing[0].status === "confirmed" ? "confirmed" : (input.status ?? existing[0].status);
    // Fields the student edited are theirs: a re-import never overwrites them (Task 2.2.4).
    const existingMeta = sanitizeLedgerMetadata(existing[0].metadata);
    const edited = new Set(existingMeta.editedFields ?? []);
    const keep = <T,>(field: EditableProjectField, incoming: T | undefined, current: T) => (edited.has(field) || incoming === undefined ? current : incoming);

    const [updated] = await db
      .update(projects)
      .set({
        summary: keep("summary", input.summary, existing[0].summary),
        description: keep("description", input.description, existing[0].description),
        category: input.category ?? existing[0].category,
        purpose: input.purpose ?? existing[0].purpose,
        visibility: input.visibility ?? existing[0].visibility,
        projectType: input.projectType ?? existing[0].projectType,
        repositoryUrl: keep("repositoryUrl", input.repositoryUrl, existing[0].repositoryUrl),
        demoUrl: keep("demoUrl", input.demoUrl, existing[0].demoUrl),
        technologies: edited.has("technologies") ? existing[0].technologies : unionJsonArray(projects.technologies, input.technologies || []),
        metadata: { ...existingMeta, ...importMetadata(input.metadata) },
        sources: unionJsonArray(projects.sources, input.sources || []),
        status: targetStatus,
        links: input.links ?? existing[0].links,
        timeline: input.timeline ?? existing[0].timeline,
        team: input.team ?? existing[0].team,
        aiDetails: input.aiDetails ?? existing[0].aiDetails,
        hardwareDetails: input.hardwareDetails ?? existing[0].hardwareDetails,
        media: input.media ?? existing[0].media,
        ...(canClaimKey ? { normalizedTitle } : {}),
        updatedAt: now,
      })
      .where(and(eq(projects.id, existing[0].id), eq(projects.personId, personId)))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(projects)
    .values({
      id,
      personId,
      title: input.title,
      normalizedTitle,
      summary: input.summary || "",
      description: input.description || "",
      category: input.category || "Other AI/ML",
      purpose: input.purpose || "personal",
      visibility: input.visibility || "private",
      projectType: input.projectType || "software",
      repositoryUrl: input.repositoryUrl || null,
      demoUrl: input.demoUrl || null,
      technologies: input.technologies || [],
      sources: input.sources || ["manual"],
      status: input.status || "confirmed",
      links: input.links || [],
      timeline: input.timeline || {},
      team: input.team || {},
      aiDetails: input.aiDetails || {},
      hardwareDetails: input.hardwareDetails || {},
      media: input.media || [],
      metadata: importMetadata(input.metadata),
      portfolioIncluded: (input.status || "confirmed") === "confirmed",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  // A concurrent import inserted the same project first: merge into it instead.
  if (attempt >= 1) throw new Error(`Project "${input.title}" could not be saved for ${personId}`);
  return saveProject(personId, input, attempt + 1);
}

export async function getProjectsByPersonId(personId: string, page?: PageOptions) {
  const db = await getDb();
  const { limit, offset } = pageBounds(page);
  return db
    .select()
    .from(projects)
    .where(eq(projects.personId, personId))
    .orderBy(desc(projects.updatedAt), desc(projects.id))
    .limit(limit)
    .offset(offset);
}

export async function getProjectById(personId: string, projectId: string) {
  const db = await getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.personId, personId)))
    .limit(1);

  if (!project) return null;

  const [contribution] = await db
    .select()
    .from(projectContributions)
    .where(and(eq(projectContributions.projectId, projectId), eq(projectContributions.personId, personId)))
    .limit(1);

  return {
    ...project,
    contributionRoles: (contribution?.roles as string[]) || [],
    contributionNote: contribution?.description || "",
  };
}

export async function updateProject(
  personId: string,
  projectId: string,
  updates: Partial<CreateProjectInput> & {
    contributionRoles?: string[];
    contributionNote?: string;
    /** Ledger (Task 2.5): portfolio toggle and student-owned metadata (role, highlight, aiSummary, preview). */
    portfolioIncluded?: boolean;
    ledgerMetadata?: Partial<ProjectLedgerMetadata>;
    /** Set when the student edited fields in place, so imports leave them alone. */
    markEdited?: boolean;
  }
) {
  const db = await getDb();
  const now = new Date();

  // Verify ownership
  const [existing] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.personId, personId)))
    .limit(1);

  if (!existing) {
    return null;
  }

  const patch: Record<string, unknown> = {
    updatedAt: now,
  };

  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.summary !== undefined) patch.summary = updates.summary;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.purpose !== undefined) patch.purpose = updates.purpose;
  if (updates.visibility !== undefined) patch.visibility = updates.visibility;
  if (updates.projectType !== undefined) patch.projectType = updates.projectType;
  if (updates.repositoryUrl !== undefined) patch.repositoryUrl = updates.repositoryUrl;
  if (updates.demoUrl !== undefined) patch.demoUrl = updates.demoUrl;
  if (updates.technologies !== undefined) patch.technologies = updates.technologies;
  if (updates.sources !== undefined) patch.sources = updates.sources;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.links !== undefined) patch.links = updates.links;
  if (updates.timeline !== undefined) patch.timeline = updates.timeline;
  if (updates.team !== undefined) patch.team = updates.team;
  if (updates.aiDetails !== undefined) patch.aiDetails = updates.aiDetails;
  if (updates.hardwareDetails !== undefined) patch.hardwareDetails = updates.hardwareDetails;
  if (updates.media !== undefined) patch.media = updates.media;
  if (updates.portfolioIncluded !== undefined) patch.portfolioIncluded = updates.portfolioIncluded;
  if (updates.ledgerMetadata !== undefined || updates.markEdited) {
    const current = sanitizeLedgerMetadata(existing.metadata);
    const editedNow = updates.markEdited
      ? EDITABLE_PROJECT_FIELDS.filter((f) => updates[f] !== undefined && JSON.stringify(updates[f]) !== JSON.stringify(existing[f]))
      : [];
    // Import-owned keys (stars, forks, ...) are not writable from here.
    const { stars: _s, forks: _f, isFork: _i, languages: _l, ...studentOwned } = updates.ledgerMetadata ?? {};
    patch.metadata = sanitizeLedgerMetadata({
      ...current,
      ...studentOwned,
      editedFields: [...new Set([...(current.editedFields ?? []), ...editedNow])],
    });
  }

  const [updatedProject] = await db
    .update(projects)
    .set(patch)
    .where(and(eq(projects.id, projectId), eq(projects.personId, personId)))
    .returning();

  // If contributions are updated
  if (updates.contributionRoles !== undefined || updates.contributionNote !== undefined) {
    await saveProjectContribution(
      projectId,
      personId,
      updates.contributionRoles ?? ((existing.technologies as string[]) || []),
      updates.contributionNote ?? ""
    );
  }

  return updatedProject;
}

export async function saveProjectContribution(
  projectId: string,
  personId: string,
  roles: string[],
  description: string = ""
) {
  const db = await getDb();
  const now = new Date();
  const id = `pcon_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const existing = await db
    .select()
    .from(projectContributions)
    .where(
      and(
        eq(projectContributions.projectId, projectId),
        eq(projectContributions.personId, personId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(projectContributions)
      .set({
        roles,
        description,
        updatedAt: now,
      })
      .where(eq(projectContributions.id, existing[0].id));
    return { ...existing[0], roles, description, updatedAt: now };
  }

  const [created] = await db
    .insert(projectContributions)
    .values({
      id,
      projectId,
      personId,
      roles,
      description,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function getProjectContributions(personId: string) {
  const db = await getDb();
  return db
    .select()
    .from(projectContributions)
    .where(eq(projectContributions.personId, personId));
}

export const getProjectContributionsByPersonId = getProjectContributions;

export async function deleteProject(personId: string, projectId: string) {
  const db = await getDb();
  await db
    .delete(projectContributions)
    .where(and(eq(projectContributions.projectId, projectId), eq(projectContributions.personId, personId)));
  const [deleted] = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.personId, personId)))
    .returning();
  return deleted;
}

/**
 * Removes one source from a person's projects (Task 1.2.2): the source is
 * dropped from each project's `sources`; a project left with no source is
 * deleted unless the student confirmed it (then it becomes "manual").
 * Projects from other sources are untouched.
 */
export async function removeProjectSource(personId: string, source: string): Promise<{ updated: number; deleted: number }> {
  const db = await getDb();
  const rows = await db.select().from(projects).where(eq(projects.personId, personId));
  let updated = 0;
  let deleted = 0;
  for (const p of rows) {
    const sources = (p.sources as string[]) || [];
    if (!sources.includes(source)) continue;
    const rest = sources.filter((s) => s !== source);
    if (rest.length === 0 && p.status !== "confirmed") {
      await db.delete(projects).where(and(eq(projects.id, p.id), eq(projects.personId, personId)));
      deleted++;
    } else {
      await db
        .update(projects)
        .set({ sources: rest.length ? rest : ["manual"], ...(source === "github" ? { repositoryUrl: rest.length ? p.repositoryUrl : null } : {}), updatedAt: new Date() })
        .where(and(eq(projects.id, p.id), eq(projects.personId, personId)));
      updated++;
    }
  }
  return { updated, deleted };
}

