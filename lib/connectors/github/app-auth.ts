import crypto from "crypto";

const API = "https://api.github.com";
const USER_AGENT = "AI-Tathastu-Private-GitHub-Access";

/**
 * GitHub App authentication is intentionally separate from the existing
 * read:user OAuth flow. The App must be configured with read-only Metadata
 * and Contents permissions and installed only on repositories the student
 * explicitly selects.
 */
function appJwt(): string {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!appId || !rawKey) {
    throw new Error("Private GitHub access is not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.");
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat: now - 30, exp: now + 8 * 60, iss: appId })).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function appRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": USER_AGENT,
      ...(init.headers || {}),
    },
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub App API request failed (${response.status}): ${body.slice(0, 180)}`);
  }
  return response.json() as Promise<T>;
}

export type InstallationRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  owner: { login: string; id: number };
  topics?: string[];
  license?: { spdx_id?: string | null; name?: string | null } | null;
  permissions?: { pull?: boolean; push?: boolean; admin?: boolean };
};

export type InstallationInfo = {
  id: number;
  account: { login: string; id: number; type: string } | null;
  repository_selection: "all" | "selected";
  permissions: Record<string, string>;
  suspended_at: string | null;
};

export async function getGitHubAppInstallation(installationId: string | number): Promise<InstallationInfo> {
  const jwt = appJwt();
  return appRequest<InstallationInfo>(`${API}/app/installations/${encodeURIComponent(String(installationId))}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
}

export async function createGitHubInstallationToken(installationId: string | number): Promise<string> {
  const jwt = appJwt();
  const result = await appRequest<{ token: string; expires_at: string }>(
    `${API}/app/installations/${encodeURIComponent(String(installationId))}/access_tokens`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: { contents: "read", metadata: "read" } }),
    }
  );
  return result.token;
}

/** Lists only repositories selected for this installation, across all pages. */
export async function listGitHubInstallationRepositories(token: string): Promise<InstallationRepository[]> {
  const repos: InstallationRepository[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = await appRequest<{ total_count: number; repositories: InstallationRepository[] }>(
      `${API}/installation/repositories?per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    repos.push(...(result.repositories || []));
    if (repos.length >= result.total_count || (result.repositories || []).length < 100) break;
  }
  return repos;
}
