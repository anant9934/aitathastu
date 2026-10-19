import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getCanonicalOrigin } from "@/lib/auth/origin";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { isGitHubAppConfigured, createGitHubAppStateToken } from "@/lib/connectors/github/app-auth";

export async function GET(req: Request) {
  const baseUrl = getCanonicalOrigin(req);
  if (!coreIngestionReady()) {
    return NextResponse.redirect(new URL("/student/connections?error=github_unavailable", baseUrl));
  }

  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.redirect(new URL("/sign-in?from=%2Fstudent%2Fconnections", baseUrl));
  }

  const slug = process.env.GITHUB_APP_SLUG?.trim();
  if (!slug || !isGitHubAppConfigured()) {
    return NextResponse.redirect(new URL("/student/connections?error=github_app_not_configured", baseUrl));
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
  return response;
}
