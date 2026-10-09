import { RawGitHubRepo, mapGitHubReposToProjects, DiscoveredGitHubProject } from "./mapper";

export type FetchGitHubReposResult = {
  success: boolean;
  username: string;
  projects: DiscoveredGitHubProject[];
  error?: string;
  source: "api" | "fallback";
};

export async function fetchGitHubProjects(
  username: string,
  token?: string
): Promise<FetchGitHubReposResult> {
  const cleanUsername = username.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "");

  if (!cleanUsername || !/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38})$/.test(cleanUsername)) {
    return {
      success: false,
      username: cleanUsername,
      projects: [],
      error: "Please enter a valid GitHub username or profile URL.",
      source: "fallback",
    };
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "AI-Tathastu-Connector/1.0",
  };

  const authToken = token;
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const endpoint = authToken
      ? "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member"
      : `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?sort=updated&per_page=30`;
    const res = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    if (res.status === 404) {
      return {
        success: false,
        username: cleanUsername,
        projects: [],
        error: `GitHub user "${cleanUsername}" was not found.`,
        source: "api",
      };
    }

    if (res.status === 403 || res.status === 429) {
      // Rate limited
      return {
        success: false,
        username: cleanUsername,
        projects: [],
        error: "GitHub API rate limit reached. You can still add projects manually.",
        source: "api",
      };
    }

    if (!res.ok) {
      return {
        success: false,
        username: cleanUsername,
        projects: [],
        error: `GitHub API error (${res.status}). You can add projects manually.`,
        source: "api",
      };
    }

    const rawRepos = (await res.json()) as RawGitHubRepo[];
    if (!Array.isArray(rawRepos)) {
      return {
        success: false,
        username: cleanUsername,
        projects: [],
        error: "Unexpected response format from GitHub.",
        source: "api",
      };
    }

    const projects = mapGitHubReposToProjects(rawRepos);
    return {
      success: true,
      username: cleanUsername,
      projects,
      source: "api",
    };
  } catch {
    return {
      success: false,
      username: cleanUsername,
      projects: [],
      error: "Could not connect to GitHub API right now. You can continue manually.",
      source: "fallback",
    };
  }
}
