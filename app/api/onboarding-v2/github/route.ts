import { NextResponse } from "next/server";
import { fetchGitHubIntelligence } from "@/lib/connectors/github/client";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { saveProject } from "@/lib/repositories/project-repository";
import { writeEvidenceBatch, type EvidenceInsertParams } from "@/lib/repositories/evidence-repository";
import { slugify } from "@/lib/text/normalize";
import {
  saveExternalConnection,
  saveSourceSnapshot,
  getLatestSourceSnapshot,
  getExternalConnectionByProvider,
} from "@/lib/repositories/connection-repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!coreIngestionReady()) {
    return NextResponse.json(
      { error: "GitHub import is unavailable because production ingestion security setup is incomplete." },
      { status: 503 }
    );
  }

  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Sign in before importing GitHub repositories." }, { status: 401 });
  }

  if (!checkRateLimit(auth.person.id, "sync").allowed) {
    return NextResponse.json({ error: "Please wait before retrying GitHub import." }, { status: 429 });
  }

  let jobId: string | null = null;
  try {
    const body = await request.json();

    if (typeof body.jobId === "string") {
      const existing = await SourceProcessingJobService.getJobForPerson(body.jobId, auth.person.id);
      if (!existing || existing.sourceId !== "github" || existing.status !== "running") {
        return NextResponse.json({ error: "Invalid GitHub processing job." }, { status: 400 });
      }
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

    // Initialize or continue Source Processing Job
    if (!jobId) {
      jobId = await SourceProcessingJobService.startJob({
        personId: auth.person.id,
        sourceId: "github",
        stage: "acquire",
      });
    }

    // Stage 1: Acquire & Parse
    await SourceProcessingJobService.updateStage(jobId, auth.person.id, "parse");

    // Fetch official GitHub Intelligence (Profile + Repos + Manifests + Classification)
    const result = await fetchGitHubIntelligence(username);

    if (!result.success) {
      await SourceProcessingJobService.failJob({
        jobId,
        personId: auth.person.id,
        errorCode: "GITHUB_FETCH_FAILED",
        errorMessage: result.error || "Could not fetch GitHub repositories.",
      });
      return NextResponse.json(
        { error: result.error || "Could not fetch GitHub repositories. You can continue manually." },
        { status: 502 }
      );
    }

    // Stage 2: Extract & Validate
    await SourceProcessingJobService.updateStage(jobId, auth.person.id, "extract");
    await SourceProcessingJobService.updateStage(jobId, auth.person.id, "validate");

    // Stage 3: Persist
    await SourceProcessingJobService.updateStage(jobId, auth.person.id, "persist");

    // 1. Persist External Connection record with provenance metadata.
    // A typed username proves nothing about ownership, so this is "detected".
    // Only the OAuth flow (/api/auth/github/*) may mark GitHub "connected";
    // never downgrade an account that already completed OAuth.
    const existingGithub = await getExternalConnectionByProvider(auth.person.id, "github");
    const prior = existingGithub?.status === "connected" ? existingGithub : null;
    await saveExternalConnection({
      personId: auth.person.id,
      provider: "github",
      externalAccountId: result.profile?.id ? String(result.profile.id) : undefined,
      externalUsername: result.username,
      displayName: result.profile?.name || result.username,
      profileUrl: result.profile?.html_url || `https://github.com/${result.username}`,
      status: prior && prior.externalUsername.toLowerCase() === result.username.toLowerCase() ? "connected" : "detected",
      metadata: {
        connectionState: "PUBLIC_DATA_IMPORTED",
        ownershipVerified: Boolean(prior && prior.externalUsername.toLowerCase() === result.username.toLowerCase()),
        failedRepos: result.failedRepos,
        truncated: result.truncated,
        totalPublicRepos: result.totalPublicRepos,
        fetchedReposCount: result.fetchedReposCount,
        analyzedReposCount: result.analyzedReposCount,
        avatarUrl: result.profile?.avatar_url,
        bio: result.profile?.bio,
        followers: result.profile?.followers,
        lastSyncedAt: new Date().toISOString(),
      },
    });

    // 2. Persist Discovered Projects and Evidence Items.
    // Snapshot lookups are independent, so they run in parallel; projects stay
    // sequential because saveProject dedupes against earlier rows; evidence is
    // collected and written in one bounded-concurrency batch at the end.
    const snapshots = await Promise.all(
      result.projects.map((p) => getLatestSourceSnapshot(auth.person.id, "github", p.repositoryUrl))
    );
    const evidence: EvidenceInsertParams[] = [];
    for (const [index, project] of result.projects.entries()) {
      const snapshot = snapshots[index];
      if (!snapshot || snapshot.checksum !== project.checksum) {
        await saveSourceSnapshot(
          auth.person.id,
          "github",
          project.repositoryUrl,
          {
            title: project.title,
            description: project.description || "",
            technologies: project.technologies || [],
            technologyFindings: project.technologyFindings,
            aiMlCategories: project.aiMlCategories,
            stars: project.stars,
            forks: project.forks,
            isFork: project.isFork,
            detectedManifests: project.detectedManifests,
            syncedAt: new Date().toISOString(),
          },
          project.checksum
        );
      }

      await saveProject(auth.person.id, {
        title: project.title,
        summary: project.description || "GitHub repository candidate",
        description: project.description || "",
        technologies: project.technologies || [],
        sources: ["github"],
        repositoryUrl: project.repositoryUrl,
        demoUrl: project.homepageUrl || undefined,
        status: "candidate",
        aiDetails: {
          categories: project.aiMlCategories,
          observedFiles: project.observedFiles,
          primaryLanguage: project.primaryLanguage,
        },
      });

      // 3. Persist Technology Evidence with strict provenance
      for (const finding of project.technologyFindings) {
        const sourceRef = finding.sourceFile
          ? `${project.repositoryUrl}#${finding.sourceFile}`
          : project.repositoryUrl;

        evidence.push({
          category: "skill",
          subject: finding.name,
          value: finding.name,
          source: "imported",
          verificationStatus: "unverified",
          sourceReference: sourceRef,
          interpretation: `Observed in ${project.title} (${finding.provenance.toLowerCase().replace(/_/g, " ")}${finding.sourceFile ? ` in ${finding.sourceFile}` : ""}). Evidence confidence: ${finding.confidence}. Personal proficiency requires review.`,
          whyItMatters: "Repository manifest and source code evidence indicates candidate familiarity with technology.",
          importKey: `github_skill_${project.id}_${slugify(finding.name)}`,
        });
      }
    }
    await writeEvidenceBatch(auth.person.id, evidence);

    // Complete processing job
    await SourceProcessingJobService.completeJob({
      jobId,
      personId: auth.person.id,
      resultReference: `github:${result.username}`,
      metadata: {
        candidates: result.projects.length,
        technologiesCount: result.allDetectedTechnologies.length,
        totalPublicRepos: result.totalPublicRepos,
        analyzedRepos: result.analyzedReposCount,
      },
    });

    return NextResponse.json({
      ok: true,
      jobId,
      connectionState: "PUBLIC_DATA_IMPORTED",
      // "detected": public data read for a typed username; "connected": verified via GitHub OAuth.
      connectionStatus: prior && prior.externalUsername.toLowerCase() === result.username.toLowerCase() ? "connected" : "detected",
      // Partial-data reporting: never claim a complete import when it was not.
      partial: result.failedRepos.length > 0 || result.truncated,
      failedRepos: result.failedRepos,
      truncated: result.truncated,
      rateLimited: result.rateLimited,
      fetchedReposCount: result.fetchedReposCount,
      username: result.username,
      profile: result.profile,
      totalPublicRepos: result.totalPublicRepos,
      analyzedReposCount: result.analyzedReposCount,
      projects: result.projects.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        technologies: p.technologies,
        technologyFindings: p.technologyFindings,
        aiMlCategories: p.aiMlCategories,
        url: p.repositoryUrl,
        homepageUrl: p.homepageUrl,
        stars: p.stars,
        forks: p.forks,
        isFork: p.isFork,
        sources: ["github"],
        status: "candidate",
        studentContributionStatus: p.studentContributionStatus,
      })),
      allDetectedTechnologies: result.allDetectedTechnologies,
      provenance: "Detected from GitHub public repositories via official REST API. Personal contributions unverified until confirmed.",
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (jobId) {
      await SourceProcessingJobService.failJob({
        jobId,
        personId: auth.person.id,
        errorCode: "GITHUB_ERROR",
        errorMessage: err instanceof Error ? err.message : "Could not connect to GitHub right now.",
      }).catch(() => null);
    }
    return NextResponse.json(
      { error: "Could not connect to GitHub right now. You can continue manually." },
      { status: 502 }
    );
  }
}
