import { sameHostRedirect } from "@/lib/auth/origin";
import { safeGitHubReturnPath } from "@/lib/auth/github-return";
import { isGitHubAppConfigured } from "@/lib/connectors/github/app-auth";

/**
 * The single "Connect GitHub & Import Repositories" entry point. Account
 * sign-in comes first (it proves the account is the student's); the callback
 * then continues to the GitHub App installation when private access isn't set
 * up yet. With no sign-in configured, it goes straight to the App.
 *
 * Every hop here stays on the host the student is on (their session cookie
 * lives there); only the OAuth redirect_uri built in /start uses the canonical
 * origin. Hopping via APP_BASE_URL sent production to a deleted deployment.
 */
export async function GET(req: Request) {
  const returnTo = safeGitHubReturnPath(new URL(req.url).searchParams.get("returnTo"));
  const q = `returnTo=${encodeURIComponent(returnTo)}`;
  if (process.env.GITHUB_CLIENT_ID?.trim()) return sameHostRedirect(`/api/auth/github/start?${q}&then=app`);
  if (isGitHubAppConfigured()) return sameHostRedirect(`/api/auth/github/app-start?${q}`);
  return sameHostRedirect(`${returnTo}?error=github_signin_unavailable`);
}
