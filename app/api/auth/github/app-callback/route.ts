import { NextResponse } from "next/server";
import { GITHUB_APP_RETURN_COOKIE, readCookie, safeGitHubReturnPath } from "@/lib/auth/github-return";
import { withInstallation } from "@/lib/connectors/github/installations";
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
  const returnTo = safeGitHubReturnPath(readCookie(req.headers.get("cookie"), GITHUB_APP_RETURN_COOKIE));
  if (!coreIngestionReady()) {
    return NextResponse.redirect(new URL(`${returnTo}?error=github_unavailable`, baseUrl));
  }

  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.redirect(new URL(`/sign-in?from=${encodeURIComponent(returnTo)}`, baseUrl));
  }

  const url = new URL(req.url);
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action");
  const returnedState = url.searchParams.get("state");
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/tathastu_gh_app_state=([^;]+)/);
  const cookieState = match ? decodeURIComponent(match[1]) : null;

  const errorRedirect = (errorParam: string) => {
    const res = NextResponse.redirect(new URL(`${returnTo}?error=${errorParam}`, baseUrl));
    res.cookies.delete("tathastu_gh_app_state");
    res.cookies.delete(GITHUB_APP_RETURN_COOKIE);
    return res;
  };

  if (!returnedState || !cookieState || returnedState !== cookieState) {
    return errorRedirect("github_app_state_invalid");
  }

  const stateVerification = verifyGitHubAppStateToken(returnedState, auth.person.id);
  if (!stateVerification.valid) {
    return errorRedirect(stateVerification.reason === "expired_state" ? "github_app_state_expired" : "github_app_state_invalid");
  }

  // "request": the install needs an organization owner's approval; GitHub sends no installation yet.
  // Remember it so the student sees "Approval pending" when they come back, even after a refresh.
  if (setupAction === "request") {
    const pending = await getExternalConnectionByProvider(auth.person.id, "github");
    if (pending && pending.status !== "disconnected") {
      await saveExternalConnection({
        personId: auth.person.id, provider: "github", externalUsername: pending.externalUsername, profileUrl: pending.profileUrl,
        metadata: { ...((pending.metadata || {}) as Record<string, unknown>), githubAppApprovalPendingAt: new Date().toISOString() },
      }).catch(() => {});
    }
    return errorRedirect("github_app_approval_pending");
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

    // Guard against account mismatch: a personal installation must be on the student's own GitHub account.
    // An organization installation is allowed: GitHub only lets owners (or approved requests) install on an organization.
    if (existing?.externalUsername && installation.account?.login && installation.account.type !== "Organization") {
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
      // Added to the student's list of installations: a personal and organisation installations coexist,
      // and a repeated callback for the same installation only refreshes it.
      metadata: {
        ...existingMetadata,
        ...withInstallation(existingMetadata, {
          id: String(installation.id),
          accountLogin: installation.account?.login || null,
          accountId: installation.account?.id ? String(installation.account.id) : null,
          accountType: installation.account?.type === "Organization" ? "Organization" : installation.account?.type === "User" ? "User" : null,
          repositorySelection: installation.repository_selection,
        }),
        githubAppPermissions: installation.permissions,
        githubAppConnectedAt: new Date().toISOString(),
        // A pending organisation request is settled only by an organisation installation.
        ...(installation.account?.type === "Organization" ? { githubAppApprovalPendingAt: null } : {}),
      },
    });

    const response = NextResponse.redirect(new URL(`${returnTo}?success=github_app_installed`, baseUrl));
    response.cookies.delete("tathastu_gh_app_state");
    response.cookies.delete(GITHUB_APP_RETURN_COOKIE);
    return response;
  } catch (error) {
    console.error("[GitHub App Setup Callback]", error);
    return errorRedirect("github_app_setup_failed");
  }
}
