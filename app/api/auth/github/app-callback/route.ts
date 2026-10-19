import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getCanonicalOrigin } from "@/lib/auth/origin";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { getExternalConnectionByProvider, saveExternalConnection } from "@/lib/repositories/connection-repository";
import { getGitHubAppInstallation, verifyGitHubAppStateToken, validateInstallationPermissions } from "@/lib/connectors/github/app-auth";

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

  const errorRedirect = (errorParam: string) => {
    const res = NextResponse.redirect(new URL(`/student/connections?error=${errorParam}`, baseUrl));
    res.cookies.delete("tathastu_gh_app_state");
    return res;
  };

  if (!returnedState || !cookieState || returnedState !== cookieState) {
    return errorRedirect("github_app_state_invalid");
  }

  const stateVerification = verifyGitHubAppStateToken(returnedState, auth.person.id);
  if (!stateVerification.valid) {
    return errorRedirect(stateVerification.reason === "expired_state" ? "github_app_state_expired" : "github_app_state_invalid");
  }

  if (!installationId || !/^\d+$/.test(installationId)) {
    return errorRedirect("github_app_state_invalid");
  }

  if (setupAction !== "install" && setupAction !== "update") {
    return errorRedirect("github_app_setup_cancelled");
  }

  try {
    const installation = await getGitHubAppInstallation(installationId);
    if (installation.suspended_at) {
      return errorRedirect("github_app_suspended");
    }

    const permCheck = validateInstallationPermissions(installation.permissions);
    if (!permCheck.valid) {
      return errorRedirect("github_app_read_permissions_missing");
    }

    const existing = await getExternalConnectionByProvider(auth.person.id, "github");

    // Guard against account mismatch: if student has a linked GitHub username, ensure the app was installed for that same user
    if (existing?.externalUsername && installation.account?.login) {
      if (existing.externalUsername.toLowerCase() !== installation.account.login.toLowerCase()) {
        return errorRedirect("github_app_account_mismatch");
      }
    }

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
    return errorRedirect("github_app_setup_failed");
  }
}
