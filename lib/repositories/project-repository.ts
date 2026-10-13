import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { getDb, projects, projectContributions } from "../db";
import { normalizeProjectTitle } from "../text/normalize";
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
};

type ProjectRow = typeof projects.$inferSelect;

const normalizeRepoUrl = (url: string) => url.trim().toLowerCase().replace(/\.git$/, "").replace(/\/+$/, "");

/** Finds this person's project that is the same as `input`: same normalized title, or same repository URL. */
async function findMatchingProject(personId: string, input: CreateProjectInput): Promise<{ match: ProjectRow | null; all: ProjectRow[] }> {
  const db = await getDb();
  const all = await db.select().from(projects).where(eq(projects.personId, personId));
  const key = normalizeProjectTitle(input.title);
  const repo = input.repositoryUrl ? normalizeRepoUrl(input.repositoryUrl) : "";
  const match = all.find((p) =>
    (p.normalizedTitle ?? normalizeProjectTitle(p.title)) === key ||
    Boolean(repo && p.repositoryUrl && normalizeRepoUrl(p.repositoryUrl) === repo)
  ) ?? null;
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
    const existingSources = (existing[0].sources as string[]) || [];
    const mergedSources = Array.from(new Set([...existingSources, ...(input.sources || [])]));
    const existingTechs = (existing[0].technologies as string[]) || [];
    const mergedTechs = Array.from(new Set([...existingTechs, ...(input.technologies || [])]));
    const targetStatus = existing[0].status === "confirmed" ? "confirmed" : (input.status ?? existing[0].status);

    const [updated] = await db
      .update(projects)
      .set({
        summary: input.summary ?? existing[0].summary,
        description: input.description ?? existing[0].description,
        category: input.category ?? existing[0].category,
        purpose: input.purpose ?? existing[0].purpose,
        visibility: input.visibility ?? existing[0].visibility,
        projectType: input.projectType ?? existing[0].projectType,
        repositoryUrl: input.repositoryUrl !== undefined ? input.repositoryUrl : existing[0].repositoryUrl,
        demoUrl: input.demoUrl !== undefined ? input.demoUrl : existing[0].demoUrl,
        technologies: mergedTechs,
        sources: mergedSources,
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
