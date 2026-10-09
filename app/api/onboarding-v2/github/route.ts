import { NextResponse } from "next/server";
import { fetchGitHubProjects } from "@/lib/connectors/github/client";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!coreIngestionReady()) return NextResponse.json({ error: "GitHub import is unavailable until credential rotation is complete." }, { status: 503 });
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Sign in before importing GitHub repositories." }, { status: 401 });
  if (!checkRateLimit(auth.person.id, "sync").allowed) return NextResponse.json({ error: "Please wait before retrying GitHub import." }, { status: 429 });
  try {
    const body = await request.json();
    if (body.consent !== true) {
      return NextResponse.json(
        { error: "Please confirm consent to look up public GitHub repositories." },
        { status: 400 }
      );
    }

    const username = String(body.username || "").trim();
    if (!username) {
      return NextResponse.json(
        { error: "Please enter a valid GitHub username." },
        { status: 400 }
      );
    }

    const result = await fetchGitHubProjects(username);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Could not fetch GitHub repositories. You can continue manually." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      username: result.username,
      projects: result.projects.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        technologies: p.technologies,
        url: p.repositoryUrl,
        sources: ["github"],
        stars: p.stars,
      })),
      provenance: "Detected from GitHub public repositories. Unverified until confirmed.",
    });
  } catch {
    return NextResponse.json(
      { error: "Could not connect to GitHub right now. You can continue manually." },
      { status: 502 }
    );
  }
}
