/** In-app pages a GitHub authorization may return to. Anything else falls back to connections (no open redirect). */
export type GitHubReturnPath = "/onboarding" | "/student/connections";

export function safeGitHubReturnPath(value: unknown): GitHubReturnPath {
  return value === "/onboarding" ? "/onboarding" : "/student/connections";
}

/** Holds the allow-listed return path across the GitHub App install round trip. */
export const GITHUB_APP_RETURN_COOKIE = "tathastu_gh_app_return";

export function readCookie(header: string | null, name: string): string | null {
  const match = (header || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
