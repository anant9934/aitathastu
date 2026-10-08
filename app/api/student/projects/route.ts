import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getProjectsByPersonId, getProjectContributions, deleteProject } from "@/lib/repositories/project-repository";
import { confirmDiscoveredProject } from "@/lib/acquisition/acquisition-service";

import { validateProjectUrl } from "@/lib/domain/project-taxonomy";

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const [projectsList, contributions] = await Promise.all([
      getProjectsByPersonId(auth.person.id),
      getProjectContributions(auth.person.id),
    ]);

    const contribMap = new Map<string, { roles: string[]; description: string }>();
    for (const c of contributions) {
      contribMap.set(c.projectId, {
        roles: (c.roles as string[]) || [],
        description: c.description || "",
      });
    }

    const projects = projectsList.map((p) => {
      const contrib = contribMap.get(p.id) || { roles: [], description: "" };
      return {
        id: p.id,
        title: p.title,
        summary: p.summary || "",
        description: p.description || "",
        category: p.category || "Other AI/ML",
        purpose: p.purpose || "personal",
        visibility: p.visibility || "private",
        projectType: p.projectType || "software",
        technologies: (p.technologies as string[]) || [],
        sources: (p.sources as string[]) || ["manual"],
        status: p.status,
        repositoryUrl: p.repositoryUrl || null,
        demoUrl: p.demoUrl || null,
        links: (p.links as unknown[]) || [],
        timeline: (p.timeline as Record<string, unknown>) || {},
        team: (p.team as Record<string, unknown>) || {},
        aiDetails: (p.aiDetails as Record<string, unknown>) || {},
        hardwareDetails: (p.hardwareDetails as Record<string, unknown>) || {},
        media: (p.media as unknown[]) || [],
        contributionRoles: contrib.roles,
        contributionNote: contrib.description,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load projects.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      summary = "",
      description = "",
      category = "Other AI/ML",
      purpose = "personal",
      visibility = "private",
      projectType = "software",
      technologies = [],
      sources = ["manual"],
      repositoryUrl,
      demoUrl,
      links = [],
      timeline = {},
      team = {},
      aiDetails = {},
      hardwareDetails = {},
      media = [],
      contributionRoles = ["Machine Learning"],
      contributionNote = "",
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Project title is required." }, { status: 400 });
    }

    // SSRF-safe URL validation
    if (repositoryUrl) {
      const v = validateProjectUrl(repositoryUrl);
      if (!v.valid) {
        return NextResponse.json({ error: `Repository URL error: ${v.error}` }, { status: 400 });
      }
    }

    if (demoUrl) {
      const v = validateProjectUrl(demoUrl);
      if (!v.valid) {
        return NextResponse.json({ error: `Demo URL error: ${v.error}` }, { status: 400 });
      }
    }

    const sanitizedLinks = [];
    if (Array.isArray(links)) {
      for (const link of links) {
        if (!link || typeof link !== "object") continue;
        if (link.url && typeof link.url === "string") {
          const v = validateProjectUrl(link.url);
          if (!v.valid) {
            return NextResponse.json({ error: `Link URL error for "${link.label || 'link'}": ${v.error}` }, { status: 400 });
          }
          sanitizedLinks.push({
            id: link.id || `lnk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: link.type || "other",
            label: typeof link.label === "string" ? link.label.trim() : "Resource Link",
            url: v.cleanUrl || link.url.trim(),
            description: typeof link.description === "string" ? link.description.trim() : "",
            visibility: link.visibility || "public",
          });
        }
      }
    }

    const saved = await confirmDiscoveredProject(auth.person.id, {
      title: title.trim(),
      summary: typeof summary === "string" ? summary.trim() : "",
      description: typeof description === "string" ? description.trim() : "",
      category: typeof category === "string" ? category.trim() : "Other AI/ML",
      purpose: typeof purpose === "string" ? purpose.trim() : "personal",
      visibility: typeof visibility === "string" ? visibility.trim() : "private",
      projectType: typeof projectType === "string" ? projectType.trim() : "software",
      technologies: Array.isArray(technologies) ? technologies.map((t) => String(t).trim()).filter(Boolean) : ["Python"],
      sources: Array.isArray(sources) && sources.length > 0 ? sources : ["manual"],
      repositoryUrl: typeof repositoryUrl === "string" && repositoryUrl.trim() ? repositoryUrl.trim() : undefined,
      demoUrl: typeof demoUrl === "string" && demoUrl.trim() ? demoUrl.trim() : undefined,
      links: sanitizedLinks,
      timeline: typeof timeline === "object" && timeline !== null ? timeline : {},
      team: typeof team === "object" && team !== null ? team : {},
      aiDetails: typeof aiDetails === "object" && aiDetails !== null ? aiDetails : {},
      hardwareDetails: typeof hardwareDetails === "object" && hardwareDetails !== null ? hardwareDetails : {},
      media: Array.isArray(media) ? media : [],
      contributionRoles: Array.isArray(contributionRoles) && contributionRoles.length > 0 ? contributionRoles : ["Machine Learning"],
      contributionNote: typeof contributionNote === "string" ? contributionNote.trim() : "",
    });

    return NextResponse.json({
      success: true,
      project: saved,
      message: `Project "${title}" added and confirmed.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save project.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { projectId } = await req.json();
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
    }

    await deleteProject(auth.person.id, projectId);

    return NextResponse.json({
      success: true,
      message: "Project removed successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove project.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
