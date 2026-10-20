import { NextResponse } from "next/server";
import { getCanonicalOrigin } from "@/lib/auth/origin";
import { safeGitHubReturnPath } from "@/lib/auth/github-return";
import { isGitHubAppConfigured } from "@/lib/connectors/github/app-auth";

/**
 * The single "Connect GitHub & Import Repositories" entry point. Account
 * sign-in comes first (it proves the account is the student's); the callback
 * then continues to the GitHub App installation when private access isn't set
 * up yet. With no sign-in configured, it goes straight to the App.
 */
export async function GET(req: Request) {
  const baseUrl = getCanonicalOrigin(req);
  const returnTo = safeGitHubReturnPath(new URL(req.url).searchParams.get("returnTo"));
  const q = `returnTo=${encodeURIComponent(returnTo)}`;
  if (process.env.GITHUB_CLIENT_ID?.trim()) return NextResponse.redirect(new URL(`/api/auth/github/start?${q}&then=app`, baseUrl));
  if (isGitHubAppConfigured()) return NextResponse.redirect(new URL(`/api/auth/github/app-start?${q}`, baseUrl));
  return NextResponse.redirect(new URL(`${returnTo}?error=github_signin_unavailable`, baseUrl));
}
