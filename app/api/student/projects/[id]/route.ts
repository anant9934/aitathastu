import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import {
  getProjectById,
  updateProject,
  deleteProject,
} from "@/lib/repositories/project-repository";
import { getEvidenceByPersonId } from "@/lib/repositories/evidence-repository";
import { validateProjectUrl, type ProjectLinkRecord } from "@/lib/domain/project-taxonomy";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing project ID." }, { status: 400 });
    }

    const project = await getProjectById(auth.person.id, id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or unauthorized." }, { status: 404 });
    }

    // Fetch related evidence items
    const allEvidence = await getEvidenceByPersonId(auth.person.id);
    const relatedEvidence = allEvidence.filter(
      (e) =>
        e.importKey?.includes(project.id) ||
        e.subject.toLowerCase().includes(project.title.toLowerCase()) ||
        (e.sourceReference && project.repositoryUrl && e.sourceReference.includes(project.repositoryUrl))
    );

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        summary: project.summary || "",
        description: project.description || "",
        category: project.category || "Other AI/ML",
        purpose: project.purpose || "personal",
        visibility: project.visibility || "private",
        projectType: project.projectType || "software",
        status: project.status || "confirmed",
        repositoryUrl: project.repositoryUrl || null,
        demoUrl: project.demoUrl || null,
        technologies: (project.technologies as string[]) || [],
        sources: (project.sources as string[]) || ["manual"],
        links: (project.links as unknown[]) || [],
        timeline: (project.timeline as Record<string, unknown>) || {},
        team: (project.team as Record<string, unknown>) || {},
        aiDetails: (project.aiDetails as Record<string, unknown>) || {},
        hardwareDetails: (project.hardwareDetails as Record<string, unknown>) || {},
        media: (project.media as unknown[]) || [],
        contributionRoles: project.contributionRoles || [],
        contributionNote: project.contributionNote || "",
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      evidence: relatedEvidence.map((e) => ({
        id: e.id,
        category: e.category,
        subject: e.subject,
        value: e.value,
        source: e.source,
        verificationStatus: e.verificationStatus,
        sourceReference: e.sourceReference || null,
        interpretation: e.interpretation,
        whyItMatters: e.whyItMatters,
        observedAt: e.observedAt ? new Date(e.observedAt).toISOString() : null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load project details.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing project ID." }, { status: 400 });
    }

    const body = await req.json();
    const {
      title,
      summary,
      description,
      category,
      purpose,
      visibility,
      projectType,
      status,
      technologies,
      sources,
      repositoryUrl,
      demoUrl,
      links,
      timeline,
      team,
      aiDetails,
      hardwareDetails,
      media,
      contributionRoles,
      contributionNote,
    } = body;

    if (title !== undefined && (!title || typeof title !== "string" || !title.trim())) {
      return NextResponse.json({ error: "Project title cannot be empty." }, { status: 400 });
    }

    // SSRF URL validation
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

    let sanitizedLinks: ProjectLinkRecord[] | undefined = undefined;
    if (Array.isArray(links)) {
      sanitizedLinks = [];
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

    const updated = await updateProject(auth.person.id, id, {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(summary !== undefined ? { summary: typeof summary === "string" ? summary.trim() : "" } : {}),
      ...(description !== undefined ? { description: typeof description === "string" ? description.trim() : "" } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(purpose !== undefined ? { purpose } : {}),
      ...(visibility !== undefined ? { visibility } : {}),
      ...(projectType !== undefined ? { projectType } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(technologies !== undefined ? { technologies: Array.isArray(technologies) ? technologies.map(String) : [] } : {}),
      ...(sources !== undefined ? { sources: Array.isArray(sources) ? sources : ["manual"] } : {}),
      ...(repositoryUrl !== undefined ? { repositoryUrl: repositoryUrl ? repositoryUrl.trim() : null } : {}),
      ...(demoUrl !== undefined ? { demoUrl: demoUrl ? demoUrl.trim() : null } : {}),
      ...(sanitizedLinks !== undefined ? { links: sanitizedLinks } : {}),
      ...(timeline !== undefined ? { timeline } : {}),
      ...(team !== undefined ? { team } : {}),
      ...(aiDetails !== undefined ? { aiDetails } : {}),
      ...(hardwareDetails !== undefined ? { hardwareDetails } : {}),
      ...(media !== undefined ? { media: Array.isArray(media) ? media : [] } : {}),
      ...(contributionRoles !== undefined ? { contributionRoles: Array.isArray(contributionRoles) ? contributionRoles : [] } : {}),
      ...(contributionNote !== undefined ? { contributionNote: typeof contributionNote === "string" ? contributionNote.trim() : "" } : {}),
    });

    if (!updated) {
      return NextResponse.json({ error: "Project not found or unauthorized to update." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      project: updated,
      message: `Project "${updated.title}" updated successfully.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing project ID." }, { status: 400 });
    }

    const deleted = await deleteProject(auth.person.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "Project not found or unauthorized to delete." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Project "${deleted.title}" deleted successfully.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete project.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
