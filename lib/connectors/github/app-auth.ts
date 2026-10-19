import crypto from "crypto";

const API = "https://api.github.com";
const USER_AGENT = "AI-Tathastu-Private-GitHub-Access";

export interface GitHubAppConfigValidation {
  valid: boolean;
  appId?: string;
  appSlug?: string;
  error?: string;
}

/**
 * Validates server-side GitHub App configuration.
 * Confirms required variables are present, App ID is numeric, slug is valid,
 * and the private key is a valid PEM-encoded RSA key capable of RS256 signing.
 */
export function validateGitHubAppConfiguration(): GitHubAppConfigValidation {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const appSlug = process.env.GITHUB_APP_SLUG?.trim();
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim();

  if (!appId || !appSlug || !rawKey) {
    const missing: string[] = [];
    if (!appId) missing.push("GITHUB_APP_ID");
    if (!appSlug) missing.push("GITHUB_APP_SLUG");
    if (!rawKey) missing.push("GITHUB_APP_PRIVATE_KEY");
    return {
      valid: false,
      error: `Missing required environment variables: ${missing.join(", ")}`,
    };
  }

  if (!/^\d+$/.test(appId)) {
    return {
      valid: false,
      error: "GITHUB_APP_ID must be a positive integer.",
    };
  }

  if (!/^[a-z0-9-_]+$/i.test(appSlug)) {
    return {
      valid: false,
      error: "GITHUB_APP_SLUG contains invalid characters.",
    };
  }

  // Detect accidental client secret usage (e.g. 40 hex chars)
  if (/^[a-f0-9]{40}$/i.test(rawKey)) {
    return {
      valid: false,
      error:
        "GITHUB_APP_PRIVATE_KEY is a 40-character OAuth/App Client Secret, not an RSA Private Key. GitHub App RS256 signing requires an RSA Private Key in PEM format. Generate one in GitHub App settings (Developer Settings > GitHub Apps > Private keys > 'Generate a private key').",
    };
  }

  const normalizedKey = rawKey.replace(/\\n/g, "\n");
  if (!normalizedKey.includes("-----BEGIN") || !normalizedKey.includes("PRIVATE KEY-----")) {
    return {
      valid: false,
      error:
        "GITHUB_APP_PRIVATE_KEY is missing PEM headers. Expected '-----BEGIN RSA PRIVATE KEY-----' or '-----BEGIN PRIVATE KEY-----'.",
    };
  }

  try {
    crypto.createPrivateKey(normalizedKey);
  } catch {
    return {
      valid: false,
      error: "GITHUB_APP_PRIVATE_KEY cannot be parsed as a valid RSA private key.",
    };
  }

  return { valid: true, appId, appSlug };
}

export function isGitHubAppConfigured(): boolean {
  return validateGitHubAppConfiguration().valid;
}

function getStateTokenSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be configured in production to sign GitHub App state tokens.");
    }
    return "aitathastu-github-app-auth-state-secret";
  }
  return secret;
}

/**
 * Creates a cryptographically signed, person-bound state token for GitHub App OAuth.
 */
export function createGitHubAppStateToken(personId: string): string {
  const nonce = crypto.randomBytes(24).toString("hex");
  const timestamp = Date.now();
  const secret = getStateTokenSecret();
  const payload = `${personId}:${timestamp}:${nonce}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

/**
 * Validates a GitHub App installation state token:
 * 1. Valid HMAC signature
 * 2. Matches the expected authenticated person ID
 * 3. Within max age (default: 10 minutes)
 */
export function verifyGitHubAppStateToken(
  stateToken: string | null | undefined,
  expectedPersonId: string,
  maxAgeMs = 10 * 60 * 1000
): { valid: boolean; reason?: string } {
  if (!stateToken || typeof stateToken !== "string") {
    return { valid: false, reason: "missing_state" };
  }
  const parts = stateToken.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "malformed_state" };
  }
  const [encodedPayload, signature] = parts;
  const secret = getStateTokenSecret();
  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return { valid: false, reason: "invalid_encoding" };
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (signature.length !== expectedSignature.length) {
    return { valid: false, reason: "invalid_signature" };
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))) {
    return { valid: false, reason: "invalid_signature" };
  }

  const [personId, timestampStr] = payload.split(":");
  if (!personId || personId !== expectedPersonId) {
    return { valid: false, reason: "person_mismatch" };
  }

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > maxAgeMs || timestamp > Date.now() + 60_000) {
    return { valid: false, reason: "expired_state" };
  }

  return { valid: true };
}

/**
 * Generates an RS256 JWT authenticated as the GitHub App.
 * Lifetime: 8 minutes (GitHub accepts up to 10 minutes).
 */
export function generateGitHubAppJwt(): string {
  const validation = validateGitHubAppConfiguration();
  if (!validation.valid) {
    throw new Error(`Private GitHub access configuration error: ${validation.error}`);
  }
  const appId = validation.appId!;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY!.trim();
  const privateKey = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat: now - 30, exp: now + 8 * 60, iss: appId })).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");
  return `${unsigned}.${signature}`;
}

const appJwt = generateGitHubAppJwt;

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

/**
 * Validates that the GitHub App installation has the required read permissions.
 * Specifically checks for read access to metadata and contents.
 */
export function validateInstallationPermissions(permissions: Record<string, string> | undefined): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  const contents = permissions?.contents;
  const metadata = permissions?.metadata;

  if (!contents || !["read", "write"].includes(contents)) {
    missing.push("contents");
  }
  if (!metadata || !["read", "write"].includes(metadata)) {
    missing.push("metadata");
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Deletes/uninstalls the GitHub App installation on GitHub's side.
 * Used during user disconnect to ensure provider-side access revocation.
 */
export async function deleteGitHubAppInstallation(installationId: string | number): Promise<boolean> {
  try {
    const jwt = appJwt();
    const response = await fetch(`${API}/app/installations/${encodeURIComponent(String(installationId))}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(10_000),
    });
    return response.status === 204;
  } catch {
    return false;
  }
}
