import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getCanonicalOrigin } from "@/lib/auth/origin";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { getExternalConnectionByProvider, saveExternalConnection } from "@/lib/repositories/connection-repository";
import { getGitHubAppInstallation } from "@/lib/connectors/github/app-auth";

export const runtime = "nodejs";

/**
 * GitHub App setup callback. GitHub redirects here after the signed-in student
 * installs the App and chooses which repositories it may access.
 */
export async function GET(req: Request) {
  const baseUrl = getCanonicalOrigin(req);
  if (!coreIngestionReady()) {
    return NextResponse.redirect(new URL("/student/connections?error=github_unavailable", baseUrl));
  }

  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.redirect(new URL("/sign-in?from=%2Fstudent%2Fconnections", baseUrl));
  }

  const url = new URL(req.url);
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action");
  const returnedState = url.searchParams.get("state");
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/tathastu_gh_app_state=([^;]+)/);
  const cookieState = match ? decodeURIComponent(match[1]) : null;

  if (!installationId || !/^\d+$/.test(installationId) || !returnedState || !cookieState || returnedState !== cookieState) {
    return NextResponse.redirect(new URL("/student/connections?error=github_app_state_invalid", baseUrl));
  }
  if (setupAction !== "install" && setupAction !== "update") {
    return NextResponse.redirect(new URL("/student/connections?error=github_app_setup_cancelled", baseUrl));
  }

  try {
    const installation = await getGitHubAppInstallation(installationId);
    if (installation.suspended_at) {
      return NextResponse.redirect(new URL("/student/connections?error=github_app_suspended", baseUrl));
    }

    const existing = await getExternalConnectionByProvider(auth.person.id, "github");
    const existingMetadata = (existing?.metadata || {}) as Record<string, unknown>;
    await saveExternalConnection({
      personId: auth.person.id,
      provider: "github",
      externalUsername: existing?.externalUsername || installation.account?.login || "github-app",
      externalAccountId: existing?.externalAccountId || (installation.account?.id ? String(installation.account.id) : undefined),
      profileUrl: existing?.profileUrl || (installation.account?.login ? `https://github.com/${installation.account.login}` : "https://github.com"),
      displayName: existing?.displayName || installation.account?.login || "GitHub",
      scopes: Array.isArray(existing?.scopes) ? existing.scopes as string[] : [],
      status: "connected",
      metadata: {
        ...existingMetadata,
        githubAppInstallationId: String(installation.id),
        githubAppAccountLogin: installation.account?.login || null,
        githubAppAccountType: installation.account?.type || null,
        githubAppRepositorySelection: installation.repository_selection,
        githubAppPermissions: installation.permissions,
        githubAppConnectedAt: new Date().toISOString(),
      },
    });

    const response = NextResponse.redirect(new URL("/student/connections?success=github_app_installed", baseUrl));
    response.cookies.delete("tathastu_gh_app_state");
    return response;
  } catch (error) {
    console.error("[GitHub App Setup Callback]", error);
    return NextResponse.redirect(new URL("/student/connections?error=github_app_setup_failed", baseUrl));
  }
}
