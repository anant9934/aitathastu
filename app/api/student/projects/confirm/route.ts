import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { confirmDiscoveredProject, getProjectCandidatesForPerson } from "@/lib/acquisition/acquisition-service";

export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { action, project } = body;

    if (!project || !project.title) {
      return NextResponse.json({ error: "Project data is required." }, { status: 400 });
    }

    if (action === "reject" || action === "ignore") {
      return NextResponse.json({
        success: true,
        action,
        message: `Project candidate "${project.title}" ${action === "reject" ? "rejected" : "ignored"}.`,
      });
    }

    const candidates = await getProjectCandidatesForPerson(auth.person.id);
    const sourceCandidate = candidates.find((candidate) =>
      candidate.title === project.title &&
      (candidate.repositoryUrl || "") === (project.repositoryUrl || "")
    );
    if (!sourceCandidate) {
      return NextResponse.json({ error: "Project candidate is not in your imported sources. Add it manually or sync its source first." }, { status: 400 });
    }
    if (sourceCandidate.sources.includes("github") && !String(project.contributionNote || "").trim()) {
      return NextResponse.json({ error: "Describe what you personally contributed before confirming a GitHub project." }, { status: 400 });
    }

    const saved = await confirmDiscoveredProject(auth.person.id, {
      title: project.title,
      description: project.description || "",
      technologies: sourceCandidate.technologies,
      sources: sourceCandidate.sources,
      repositoryUrl: sourceCandidate.repositoryUrl,
      contributionRoles: Array.isArray(project.contributionRoles) ? project.contributionRoles : [],
      contributionNote: project.contributionNote || "",
    });

    return NextResponse.json({
      success: true,
      action: "confirm",
      project: saved,
      message: `Project "${project.title}" confirmed with personal contributions.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error confirming project.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
