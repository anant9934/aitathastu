import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import {
  executeFullGitHubExtraction,
  getCandidateGitHubIntelligence,
  getCandidateRepositoryDetails,
} from "@/lib/services/github-intelligence-service";
import { getExternalConnectionByProvider } from "@/lib/repositories/connection-repository";
import { decryptConnectionToken } from "@/lib/security/connection-token";

export const maxDuration = 60;

/**
 * GET /api/student/github/intelligence
 * Retrieves the candidate's persistent GitHub intelligence profile, repositories,
 * commits, PRs, issues, releases, technologies, and resume project matches.
 * Optional query parameter: ?repoId=... returns deep details for a specific repository.
 */
export async function GET(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const repoId = searchParams.get("repoId");

    if (repoId) {
      const details = await getCandidateRepositoryDetails(auth.person.id, repoId);
      if (!details) {
        return NextResponse.json({ error: "Repository not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, ...details });
    }

    const intelligence = await getCandidateGitHubIntelligence(auth.person.id);
    return NextResponse.json({ success: true, ...intelligence });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error loading GitHub intelligence.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/student/github/intelligence
 * Triggers full or incremental extraction and persistence for the candidate's GitHub profile.
 * Accepts optional body: { username?: string, forceDeepScan?: boolean }
 */
async function POST_handler(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    let username = typeof body.username === "string" ? body.username.trim() : "";
    let token: string | undefined = undefined;

    // Check existing connection if username not provided
    const conn = await getExternalConnectionByProvider(auth.person.id, "github");
    if (!username && conn) {
      username = conn.externalUsername;
    }

    if (conn && conn.metadata && typeof (conn.metadata as any).encryptedAccessToken === "string") {
      try {
        token = decryptConnectionToken((conn.metadata as any).encryptedAccessToken, auth.person.id);
      } catch {
        // Fall back to environment token or public mode
      }
    }

    if (!username) {
      return NextResponse.json(
        { error: "GitHub username is required. Please provide a username or connect your GitHub account." },
        { status: 400 }
      );
    }

    const result = await executeFullGitHubExtraction({
      personId: auth.person.id,
      username,
      token,
      trigger: "user_refresh",
      forceDeepScan: Boolean(body.forceDeepScan),
    });

    return NextResponse.json({
      success: result.success,
      runId: result.runId,
      username: result.username,
      profile: result.profile,
      repositoriesCount: result.repositoriesCount,
      processedReposCount: result.processedReposCount,
      failedReposCount: result.failedReposCount,
      totalCommitsFetched: result.totalCommitsFetched,
      totalPrsFetched: result.totalPrsFetched,
      totalIssuesFetched: result.totalIssuesFetched,
      totalReleasesFetched: result.totalReleasesFetched,
      isComplete: result.isComplete,
      failedResources: result.failedResources,
      error: result.error,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error executing GitHub extraction.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withStudentCacheInvalidation(POST_handler);
