import { NextResponse } from "next/server";
import { GITHUB_APP_RETURN_COOKIE, safeGitHubReturnPath } from "@/lib/auth/github-return";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { sameHostRedirect } from "@/lib/auth/origin";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { isGitHubAppConfigured, createGitHubAppStateToken } from "@/lib/connectors/github/app-auth";

export async function GET(req: Request) {
  const returnTo = safeGitHubReturnPath(new URL(req.url).searchParams.get("returnTo"));
  if (!coreIngestionReady()) {
    return sameHostRedirect(`${returnTo}?error=github_unavailable`);
  }

  const auth = await getServerAuthContext();
  if (!auth) {
    return sameHostRedirect(`/sign-in?from=${encodeURIComponent(returnTo)}`);
  }

  const slug = process.env.GITHUB_APP_SLUG?.trim();
  if (!slug || !isGitHubAppConfigured()) {
    return sameHostRedirect(`${returnTo}?error=github_app_not_configured`);
  }

  const state = createGitHubAppStateToken(auth.person.id);
  const installUrl = new URL(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new`);
  installUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(installUrl.toString());
  response.cookies.set("tathastu_gh_app_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  response.cookies.set(GITHUB_APP_RETURN_COOKIE, returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
