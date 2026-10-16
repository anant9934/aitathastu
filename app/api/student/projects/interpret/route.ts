import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
/**
 * AI TATHASTU — PROJECT INTELLIGENCE API
 *
 * POST /api/student/projects/interpret
 *
 * Accepts a GitHub repo full name (owner/repo) and the student's stored OAuth token.
 * Fetches README + metadata, calls the LLM Project Intelligence Engine,
 * and returns structured interpretation for student review.
 *
 * Nothing is saved until the student confirms it on the onboarding review screens.
 *
 * Security:
 * - Requires authenticated session
 * - Only fetches repos accessible with the student's own stored token
 * - Prompt injection defense applied to all fetched content
 * - Rate limited
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { interpretGitHubProject } from "@/lib/services/github-project-intelligence";
import { getExternalConnectionByProvider } from "@/lib/repositories/connection-repository";
import { decryptConnectionToken } from "@/lib/security/connection-token";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";

export const runtime = "nodejs";
export const maxDuration = 30; // seconds — LLM call can take up to 15s

async function POST_handler(request: NextRequest) {
  if (!coreIngestionReady()) return NextResponse.json({ error: "Project interpretation is unavailable until credential rotation is complete." }, { status: 503 });
  // Authentication required
  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // Rate limiting
  const rl = checkRateLimit(auth.person.id, "ai");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before interpreting another project." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

  let body: { repoFullName?: string; aiConsent?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (body.aiConsent !== true) return NextResponse.json({ error: "Confirm AI processing of this repository before interpretation." }, { status: 400 });

  const repoFullName = body.repoFullName?.trim();
  if (!repoFullName || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoFullName)) {
    return NextResponse.json(
      { error: "Provide a valid repository name in owner/repo format." },
      { status: 400 }
    );
  }

  // Retrieve the student's stored GitHub OAuth token
  const githubConnection = await getExternalConnectionByProvider(auth.person.id, "github");
  const encryptedToken = (githubConnection?.metadata as Record<string, unknown> | null)?.encryptedAccessToken;
  if (githubConnection?.status !== "connected" || typeof encryptedToken !== "string") {
    return NextResponse.json({ error: "Connect GitHub with OAuth before interpreting repositories." }, { status: 403 });
  }
  let storedToken: string;
  try {
    storedToken = decryptConnectionToken(encryptedToken, auth.person.id);
  } catch {
    return NextResponse.json({ error: "GitHub authorization has expired. Reconnect your account." }, { status: 403 });
  }

  // Validate that the requested repo belongs to the connected GitHub account
  if (githubConnection && githubConnection.externalUsername) {
    const repoOwner = repoFullName.split("/")[0].toLowerCase();
    const connectedUsername = githubConnection.externalUsername.toLowerCase();
    // Allow owner repos and org repos the student has access to
    // We can't know for certain about org repos without API call, so we proceed
    // but the GitHub API will return 404 if the token can't access it
    if (repoOwner !== connectedUsername) {
      // Not blocking — student may have contributed to org repos
      // The GitHub API will enforce access control
    }
  }

  // Run project intelligence
  const result = await interpretGitHubProject(
    repoFullName,
    storedToken,
    auth.person.id
  );

  if (!result.success && !result.rawMeta) {
    return NextResponse.json(
      { error: result.error ?? "Could not fetch this repository." },
      { status: 422 }
    );
  }

  return NextResponse.json({
    repoFullName,
    interpretation: result.interpretation,
    rawMeta: result.rawMeta,
    meta: {
      provider: result.provider,
      modelUsed: result.modelUsed,
      fallbackUsed: result.fallbackUsed,
      latencyMs: result.latencyMs,
      readmeFetched: result.readmeFetched,
      success: result.success,
      error: result.error,
    },
    reviewNote: "AI interpretation is based on repository metadata and README content accessible to your authorized account. Review all claims and describe your own contribution before saving.",
  });
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
