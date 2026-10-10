import { NextResponse } from "next/server";
import { fetchGitHubProjects } from "@/lib/connectors/github/client";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { saveProject } from "@/lib/repositories/project-repository";
import { createEvidenceRecord } from "@/lib/repositories/evidence-repository";
import { saveExternalConnection, saveSourceSnapshot, getLatestSourceSnapshot } from "@/lib/repositories/connection-repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!coreIngestionReady()) return NextResponse.json({ error: "GitHub import is unavailable because production ingestion security setup is incomplete." }, { status: 503 });
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Sign in before importing GitHub repositories." }, { status: 401 });
  if (!checkRateLimit(auth.person.id, "sync").allowed) return NextResponse.json({ error: "Please wait before retrying GitHub import." }, { status: 429 });
  let jobId: string | null = null;
  try {
    const body = await request.json();
    if (typeof body.jobId === "string") {
      const existing = await SourceProcessingJobService.getJobForPerson(body.jobId, auth.person.id);
      if (!existing || existing.sourceId !== "github" || existing.status !== "running") return NextResponse.json({ error: "Invalid GitHub processing job." }, { status: 400 });
      jobId = existing.id;
    }
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

    if (!jobId) jobId = await SourceProcessingJobService.startJob({ personId: auth.person.id, sourceId: "github", stage: "acquire" });
    await SourceProcessingJobService.updateStage(jobId, auth.person.id, "parse");
    const result = await fetchGitHubProjects(username);
    if (!result.success) {
      await SourceProcessingJobService.failJob({ jobId, personId: auth.person.id, errorCode: "GITHUB_FETCH_FAILED", errorMessage: result.error || "Could not fetch GitHub repositories." });
      return NextResponse.json(
        { error: result.error || "Could not fetch GitHub repositories. You can continue manually." },
        { status: 502 }
      );
    }
    await SourceProcessingJobService.updateStage(jobId, auth.person.id, "extract");
    await SourceProcessingJobService.updateStage(jobId, auth.person.id, "validate");
    await SourceProcessingJobService.updateStage(jobId, auth.person.id, "persist");
    await saveExternalConnection({ personId: auth.person.id, provider: "github", externalUsername: result.username,
      profileUrl: `https://github.com/${result.username}`, metadata: { lastSyncedAt: new Date().toISOString() } });
    for (const project of result.projects) {
      const snapshot = await getLatestSourceSnapshot(auth.person.id, "github", project.repositoryUrl);
      if (!snapshot || snapshot.checksum !== project.checksum) await saveSourceSnapshot(auth.person.id, "github", project.repositoryUrl, {
        title: project.title, description: project.description || "", technologies: project.technologies || [],
      }, project.checksum);
      await saveProject(auth.person.id, {
        title: project.title,
        summary: project.description || "GitHub repository candidate",
        description: project.description || "",
        technologies: project.technologies || [],
        sources: ["github"],
        repositoryUrl: project.repositoryUrl,
        status: "candidate",
      });
      for (const skill of project.technologies || []) {
        await createEvidenceRecord(auth.person.id, {
          category: "skill", subject: skill, value: skill, source: "imported",
          verificationStatus: "unverified", sourceReference: project.repositoryUrl,
          interpretation: `Detected in the public repository ${project.title}; personal use and proficiency require review.`,
          whyItMatters: "Repository technology metadata can point to a skill for student review.",
          importKey: `github_skill_${project.id}_${skill.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        });
      }
    }
    await SourceProcessingJobService.completeJob({ jobId, personId: auth.person.id, resultReference: `github:${result.username}`, metadata: { candidates: result.projects.length } });

    return NextResponse.json({
      jobId,
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
    if (jobId) await SourceProcessingJobService.failJob({ jobId, personId: auth.person.id, errorCode: "GITHUB_ERROR", errorMessage: "Could not connect to GitHub right now." }).catch(() => null);
    return NextResponse.json(
      { error: "Could not connect to GitHub right now. You can continue manually." },
      { status: 502 }
    );
  }
}
