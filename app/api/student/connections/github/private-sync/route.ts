import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { syncGitHubAppInstallation } from "@/lib/services/github-app-sync-service";
import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { getExternalConnectionByProvider } from "@/lib/repositories/connection-repository";
import { validateGitHubAppConfiguration } from "@/lib/connectors/github/app-auth";

export const maxDuration = 30;

export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  const connection = await getExternalConnectionByProvider(auth.person.id, "github");
  const metadata = (connection?.metadata || {}) as Record<string, unknown>;
  const validation = validateGitHubAppConfiguration();
  const configured = validation.valid;
  const installed = Boolean(metadata.githubAppInstallationId && connection?.status !== "disconnected");

  return NextResponse.json({
    configured,
    configDiagnostic: configured ? null : validation.error,
    appSlug: process.env.GITHUB_APP_SLUG || null,
    installed,
    installationId: installed ? metadata.githubAppInstallationId : null,
    accountLogin: installed ? metadata.githubAppAccountLogin : null,
    accountType: installed ? metadata.githubAppAccountType : null,
    repositorySelection: installed ? metadata.githubAppRepositorySelection : null,
    lastSyncedAt: installed ? metadata.githubAppLastSyncedAt : null,
    repositoryCount: installed ? (metadata.githubAppRepositoryCount as number) || 0 : 0,
    privateRepositoryCount: installed ? (metadata.githubAppPrivateRepositoryCount as number) || 0 : 0,
    publicRepositoryCount: installed ? (metadata.githubAppPublicRepositoryCount as number) || 0 : 0,
    lastSyncStatus: installed ? metadata.githubAppLastSyncStatus : null,
    connectedAccount: connection?.status !== "disconnected" ? connection?.externalUsername : null,
  });
}

async function POST_handler() {
  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  const result = await syncGitHubAppInstallation(auth.person.id);

  let statusCode = 200;
  if (!result.success) {
    switch (result.status) {
      case "PARTIAL":
        statusCode = 207;
        break;
      case "NOT_AUTHORIZED":
        statusCode = 403;
        break;
      case "RATE_LIMITED":
        statusCode = 429;
        break;
      case "FAILED":
      default:
        statusCode = 400;
        break;
    }
  }

  return NextResponse.json(result, { status: statusCode });
}

export const POST = withStudentCacheInvalidation(POST_handler);
