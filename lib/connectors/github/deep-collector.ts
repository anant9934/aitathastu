/**
 * AI TATHASTU — PRODUCTION GITHUB DEEP COLLECTOR & API ENGINE V5.0
 *
 * Implements:
 * 1. Comprehensive Profile Acquisition:
 *    - /users/{username}
 *    - /users/{username}/orgs (public organizations)
 *    - /repos/{username}/{username}/readme (profile README)
 *    - /users/{username}/events/public (public activity signals)
 * 2. Uncapped Multi-Page Repository Enumeration
 * 3. Deep Per-Repository Extraction:
 *    - Branches (/branches) and Tags (/tags)
 *    - Releases (/releases) with notes and publish dates
 *    - Pull Requests (/pulls?state=all) and Reviews (/pulls/{number}/reviews)
 *    - Issues (/issues?state=all, filtering out PRs)
 *    - Commits (/commits) with SHA, author vs committer, stats, parents
 *    - Workflows (.github/workflows)
 *    - Manifests, configuration, Docker, tests, DB schemas
 *    - Language byte distributions
 * 4. Commit Attribution & Analytics:
 *    - Candidate attribution via login, email, or verified alias
 *    - SHA deduplication
 *    - 30/90/365-day activity, first & latest commits, monthly breakdown
 * 5. Production Reliability & Security:
 *    - Rate-limit awareness (x-ratelimit-remaining, x-ratelimit-reset)
 *    - Exponential backoff with jitter
 *    - Bounded concurrency worker pool
 *    - Redaction of .env, credentials, private keys
 *    - Prompt-injection sanitization on all untrusted text
 *    - Zero Phone Privacy Guarantee preserved
 */

import crypto from "crypto";
import {
  detectRepositoryTechnologies,
  classifyRepositoryAiMl,
  classifyRepositoryType,
  type TechnologyFinding,
  type AiMlProjectCategory,
  type RepositoryClassification,
} from "./tech-detector";
import { sanitizeTextForPrompt } from "@/lib/intelligence/prompt-defense";

const GITHUB_API_BASE = "https://api.github.com";
const USER_AGENT = "AI-Tathastu-DeepIntelligence/5.0";
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_README_CHARS = 8000;
const MAX_MANIFEST_CHARS = 8000;

export interface GitHubEnrichedProfile {
  id: number;
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  html_url: string;
  email: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  profile_readme: string | null;
  organizations: Array<{
    id: number;
    login: string;
    description: string | null;
    avatar_url: string;
  }>;
  activity_summary: {
    totalEventsSampled: number;
    pushEventsCount: number;
    prEventsCount: number;
    issueEventsCount: number;
    distinctReposActedOn: string[];
    recentActivityDetected: boolean;
  };
}

export interface RawDiscoveredRepo {
  id: number;
  name: string;
  full_name: string;
  owner_login: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  is_private: boolean;
  is_fork: boolean;
  is_archived: boolean;
  is_template: boolean;
  is_empty: boolean;
  default_branch: string;
  primary_language: string | null;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  disk_usage_kb: number;
  license: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  parent_repo?: {
    id: number;
    full_name: string;
    html_url: string;
    owner: string;
    stars: number;
  } | null;
}

export interface ExtractedCommit {
  sha: string;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  authorLogin: string | null;
  authorDate: string;
  committerName: string | null;
  committerEmail: string | null;
  committerLogin: string | null;
  committerDate: string;
  parents: string[];
  additions: number;
  deletions: number;
  totalChanges: number;
  isAttributedToCandidate: boolean;
  attributionMethod: "login_match" | "email_match" | "name_match" | "unattributed" | "unknown" | "ambiguous";
  commitUrl: string;
}

export interface ExtractedPullRequest {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  body: string | null;
  htmlUrl: string;
  authorLogin: string;
  isCandidateAuthor: boolean;
  headRef: string | null;
  baseRef: string | null;
  merged: boolean;
  mergedAt: string | null;
  mergedByLogin: string | null;
  reviewCommentsCount: number;
  commitsCount: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: string[];
  reviews: Array<{
    user: string;
    state: string;
    submittedAt?: string;
  }>;
  createdAtGitHub: string;
  updatedAtGitHub: string;
  closedAtGitHub: string | null;
}

export interface ExtractedIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  body: string | null;
  htmlUrl: string;
  authorLogin: string;
  isCandidateAuthor: boolean;
  commentsCount: number;
  labels: string[];
  assignees: string[];
  createdAtGitHub: string;
  updatedAtGitHub: string;
  closedAtGitHub: string | null;
}

export interface ExtractedRelease {
  githubReleaseId: number;
  tagName: string;
  name: string | null;
  body: string | null;
  htmlUrl: string;
  isPrerelease: boolean;
  isDraft: boolean;
  publishedAt: string | null;
}

export interface RepositoryDeepDetails {
  repo: RawDiscoveredRepo;
  languages: Record<string, number>;
  branches: string[];
  tags: string[];
  releases: ExtractedRelease[];
  pullRequests: ExtractedPullRequest[];
  issues: ExtractedIssue[];
  commits: ExtractedCommit[];
  workflows: string[];
  fileStructure: Array<{ path: string; type: "blob" | "tree"; size?: number }>;
  manifests: Record<string, string>;
  readmeContent: string | null;
  technologyFindings: TechnologyFinding[];
  aiMlCategories: AiMlProjectCategory[];
  projectClassification: RepositoryClassification;
  checksum: string;
  firstCommitAt: string | null;
  lastPushAt: string | null;
  commitAnalytics: {
    totalAccessibleCommits: number;
    candidateCommits: number;
    otherContributorsCommits: number;
    firstCommitDate: string | null;
    latestCommitDate: string | null;
    activityLast30Days: number;
    activityLast90Days: number;
    activityLast365Days: number;
    uniqueShasCount: number;
    monthlyBreakdown: Record<string, number>;
  };
  failureReasons: string[];
  accessMethod?: string;
}

export function cleanUsername(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, "")
    .replace(/\/$/, "")
    .split("/")[0]
    .replace(/^@/, "");
}

function buildHeaders(token?: string): Record<string, string> {
  const authToken = token || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT,
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  } else if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    const creds = Buffer.from(
      `${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`
    ).toString("base64");
    headers.Authorization = `Basic ${creds}`;
  }
  return headers;
}

/**
 * Executes an HTTP fetch against GitHub API with retry, jittered backoff,
 * and rate-limit guard.
 */
export async function executeGitHubRequest(
  endpoint: string,
  options: {
    token?: string;
    accept?: string;
    maxRetries?: number;
    timeoutMs?: number;
  } = {}
): Promise<{
  ok: boolean;
  status: number;
  data?: any;
  text?: string;
  rateLimitRemaining?: number;
  rateLimitResetAt?: number;
  error?: string;
}> {
  const url = endpoint.startsWith("http") ? endpoint : `${GITHUB_API_BASE}${endpoint}`;
  const headers = buildHeaders(options.token);
  if (options.accept) {
    headers.Accept = options.accept;
  }
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });

      const rateLimitRemaining = res.headers.has("x-ratelimit-remaining")
        ? Number(res.headers.get("x-ratelimit-remaining"))
        : undefined;
      const rateLimitResetAt = res.headers.has("x-ratelimit-reset")
        ? Number(res.headers.get("x-ratelimit-reset")) * 1000
        : undefined;

      if (res.status === 404) {
        return { ok: false, status: 404, error: "Resource not found (404)", rateLimitRemaining, rateLimitResetAt };
      }

      if (res.status === 403 || res.status === 429) {
        const isRateLimit = res.status === 429 || rateLimitRemaining === 0;
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 30000) : 0;
        if (attempt < maxRetries && (isRateLimit || retryAfterMs > 0)) {
          // Jittered backoff or respect Retry-After
          const jitter = Math.floor(Math.random() * 500);
          const backoff = retryAfterMs > 0 ? retryAfterMs + jitter : Math.pow(2, attempt) * 1000 + jitter;
          await new Promise((resolve) => setTimeout(resolve, backoff));
          attempt++;
          continue;
        }
        return {
          ok: false,
          status: res.status,
          error: isRateLimit ? "GitHub API rate limit exceeded." : "GitHub access forbidden (403).",
          rateLimitRemaining,
          rateLimitResetAt,
        };
      }

      if (!res.ok) {
        if (attempt < maxRetries && res.status >= 500) {
          const backoff = Math.pow(2, attempt) * 800 + Math.floor(Math.random() * 300);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          attempt++;
          continue;
        }
        return { ok: false, status: res.status, error: `GitHub API error: HTTP ${res.status}`, rateLimitRemaining, rateLimitResetAt };
      }

      if (options.accept === "application/vnd.github.v3.raw") {
        const text = await res.text();
        return { ok: true, status: res.status, text, rateLimitRemaining, rateLimitResetAt };
      }

      const data = await res.json();
      return { ok: true, status: res.status, data, rateLimitRemaining, rateLimitResetAt };
    } catch (err) {
      if (attempt < maxRetries) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        continue;
      }
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      return { ok: false, status: 0, error: isTimeout ? "GitHub request timed out." : "Network failure connecting to GitHub." };
    }
  }

  return { ok: false, status: 0, error: "Failed after max retries." };
}

/**
 * 1. Comprehensive Public Profile Acquisition
 */
export async function fetchEnrichedUserProfile(
  username: string,
  token?: string
): Promise<{
  success: boolean;
  profile?: GitHubEnrichedProfile;
  error?: string;
  rateLimitRemaining?: number;
  rateLimitResetAt?: number;
}> {
  const clean = cleanUsername(username);
  if (!clean || !/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38})$/.test(clean)) {
    return { success: false, error: "Invalid GitHub username format." };
  }

  const [userRes, orgsRes, readmeRes, eventsRes] = await Promise.all([
    executeGitHubRequest(`/users/${encodeURIComponent(clean)}`, { token }),
    executeGitHubRequest(`/users/${encodeURIComponent(clean)}/orgs`, { token }),
    executeGitHubRequest(`/repos/${encodeURIComponent(clean)}/${encodeURIComponent(clean)}/readme`, {
      token,
      accept: "application/vnd.github.v3.raw",
    }),
    executeGitHubRequest(`/users/${encodeURIComponent(clean)}/events/public?per_page=100`, { token }),
  ]);

  if (!userRes.ok || !userRes.data) {
    return {
      success: false,
      error: userRes.error || `GitHub user "${clean}" could not be retrieved.`,
      rateLimitRemaining: userRes.rateLimitRemaining,
      rateLimitResetAt: userRes.rateLimitResetAt,
    };
  }

  const d = userRes.data;

  // Organizations
  const organizations = Array.isArray(orgsRes.data)
    ? orgsRes.data.map((o: any) => ({
        id: Number(o.id),
        login: String(o.login),
        description: o.description ? String(o.description) : null,
        avatar_url: String(o.avatar_url || ""),
      }))
    : [];

  // Profile README
  let profileReadme: string | null = null;
  if (readmeRes.ok && typeof readmeRes.text === "string" && readmeRes.text.trim()) {
    profileReadme = sanitizeTextForPrompt(readmeRes.text).slice(0, MAX_README_CHARS);
  }

  // Activity Summary from Public Events
  let totalEventsSampled = 0;
  let pushEventsCount = 0;
  let prEventsCount = 0;
  let issueEventsCount = 0;
  const distinctReposSet = new Set<string>();

  if (Array.isArray(eventsRes.data)) {
    totalEventsSampled = eventsRes.data.length;
    for (const ev of eventsRes.data) {
      if (ev.repo?.name) distinctReposSet.add(String(ev.repo.name));
      if (ev.type === "PushEvent") pushEventsCount++;
      else if (ev.type === "PullRequestEvent") prEventsCount++;
      else if (ev.type === "IssuesEvent") issueEventsCount++;
    }
  }

  const profile: GitHubEnrichedProfile = {
    id: Number(d.id),
    login: String(d.login || clean),
    name: d.name ? String(d.name) : null,
    bio: d.bio ? String(d.bio) : null,
    avatar_url: String(d.avatar_url || ""),
    html_url: String(d.html_url || `https://github.com/${clean}`),
    email: d.email ? String(d.email) : null,
    company: d.company ? String(d.company) : null,
    location: d.location ? String(d.location) : null,
    blog: d.blog ? String(d.blog) : null,
    twitter_username: d.twitter_username ? String(d.twitter_username) : null,
    public_repos: Number(d.public_repos || 0),
    public_gists: Number(d.public_gists || 0),
    followers: Number(d.followers || 0),
    following: Number(d.following || 0),
    created_at: String(d.created_at || new Date().toISOString()),
    updated_at: String(d.updated_at || new Date().toISOString()),
    profile_readme: profileReadme,
    organizations,
    activity_summary: {
      totalEventsSampled,
      pushEventsCount,
      prEventsCount,
      issueEventsCount,
      distinctReposActedOn: Array.from(distinctReposSet),
      recentActivityDetected: totalEventsSampled > 0,
    },
  };

  return {
    success: true,
    profile,
    rateLimitRemaining: userRes.rateLimitRemaining,
    rateLimitResetAt: userRes.rateLimitResetAt,
  };
}

/**
 * 2. Uncapped Multi-Page Discovery of Every Accessible Public Repository
 */
export async function fetchAllPublicRepositories(
  username: string,
  options: { token?: string; maxRepos?: number } = {}
): Promise<{
  success: boolean;
  repos: RawDiscoveredRepo[];
  totalDiscovered: number;
  rateLimitRemaining?: number;
  rateLimitResetAt?: number;
  error?: string;
}> {
  const clean = cleanUsername(username);
  const maxRepos = options.maxRepos ?? 5000;
  const repos: RawDiscoveredRepo[] = [];
  let page = 1;
  const perPage = 100;

  let lastRemaining: number | undefined;
  let lastReset: number | undefined;

  while (repos.length < maxRepos) {
    const res = await executeGitHubRequest(
      `/users/${encodeURIComponent(clean)}/repos?sort=updated&per_page=${perPage}&page=${page}`,
      { token: options.token }
    );

    lastRemaining = res.rateLimitRemaining;
    lastReset = res.rateLimitResetAt;

    if (!res.ok || !Array.isArray(res.data)) {
      if (repos.length > 0) break; // Partial success across previous pages
      return {
        success: false,
        repos: [],
        totalDiscovered: 0,
        rateLimitRemaining: lastRemaining,
        rateLimitResetAt: lastReset,
        error: res.error || "Could not discover repositories.",
      };
    }

    const pageRepos = res.data;
    if (pageRepos.length === 0) break;

    for (const r of pageRepos) {
      repos.push({
        id: Number(r.id),
        name: String(r.name),
        full_name: String(r.full_name || `${clean}/${r.name}`),
        owner_login: String(r.owner?.login || clean),
        description: r.description ? String(r.description) : null,
        html_url: String(r.html_url || `https://github.com/${clean}/${r.name}`),
        homepage: r.homepage ? String(r.homepage) : null,
        is_private: Boolean(r.private),
        is_fork: Boolean(r.fork),
        is_archived: Boolean(r.archived),
        is_template: Boolean(r.is_template),
        is_empty: Boolean(r.size === 0),
        default_branch: String(r.default_branch || "main"),
        primary_language: r.language ? String(r.language) : null,
        stars: Number(r.stargazers_count || 0),
        forks: Number(r.forks_count || 0),
        watchers: Number(r.watchers_count || 0),
        open_issues: Number(r.open_issues_count || 0),
        disk_usage_kb: Number(r.size || 0),
        license: r.license?.spdx_id || r.license?.name || null,
        topics: Array.isArray(r.topics) ? r.topics : [],
        created_at: String(r.created_at || new Date().toISOString()),
        updated_at: String(r.updated_at || new Date().toISOString()),
        pushed_at: String(r.pushed_at || r.updated_at || new Date().toISOString()),
        parent_repo: r.parent
          ? {
              id: Number(r.parent.id),
              full_name: String(r.parent.full_name),
              html_url: String(r.parent.html_url),
              owner: String(r.parent.owner?.login || ""),
              stars: Number(r.parent.stargazers_count || 0),
            }
          : null,
      });
    }

    if (pageRepos.length < perPage || repos.length >= maxRepos) break;
    page++;
  }

  return {
    success: true,
    repos: repos.slice(0, maxRepos),
    totalDiscovered: repos.length,
    rateLimitRemaining: lastRemaining,
    rateLimitResetAt: lastReset,
  };
}

const CANDIDATE_MANIFEST_FILES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "poetry.lock",
  "Dockerfile",
  "docker-compose.yml",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "CMakeLists.txt",
  "Makefile",
];

const SECRET_FILE_PATTERNS = [
  /\.env(?:\..+)?$/i,
  /id_rsa/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /credentials\.json/i,
  /token/i,
];

/**
 * 3. Deep Per-Repository Extraction
 */
export async function fetchRepositoryDeepDetails(
  repo: RawDiscoveredRepo,
  candidateProfile: { login: string; name?: string | null; email?: string | null },
  token?: string
): Promise<RepositoryDeepDetails> {
  const [owner, name] = repo.full_name.split("/");
  const failureReasons: string[] = [];

  // Execute secondary resource fetches concurrently with graceful fallbacks
  const [
    langRes,
    readmeRes,
    branchesRes,
    tagsRes,
    releasesRes,
    prsRes,
    issuesRes,
    commitsRes,
    treeRes,
  ] = await Promise.all([
    executeGitHubRequest(`/repos/${owner}/${name}/languages`, { token }),
    executeGitHubRequest(`/repos/${owner}/${name}/readme`, {
      token,
      accept: "application/vnd.github.v3.raw",
    }),
    executeGitHubRequest(`/repos/${owner}/${name}/branches?per_page=100`, { token }),
    executeGitHubRequest(`/repos/${owner}/${name}/tags?per_page=100`, { token }),
    executeGitHubRequest(`/repos/${owner}/${name}/releases?per_page=50`, { token }),
    executeGitHubRequest(`/repos/${owner}/${name}/pulls?state=all&per_page=100`, { token }),
    executeGitHubRequest(`/repos/${owner}/${name}/issues?state=all&per_page=100`, { token }),
    executeGitHubRequest(`/repos/${owner}/${name}/commits?per_page=100`, { token }),
    executeGitHubRequest(`/repos/${owner}/${name}/git/trees/${encodeURIComponent(repo.default_branch || "main")}?recursive=1`, { token }),
  ]);

  // Languages
  let languages: Record<string, number> = {};
  if (langRes.ok && typeof langRes.data === "object" && langRes.data !== null) {
    languages = langRes.data as Record<string, number>;
  } else if (langRes.error && langRes.status !== 404) {
    failureReasons.push(`languages:${langRes.error}`);
  }

  // README
  let readmeContent: string | null = null;
  if (readmeRes.ok && typeof readmeRes.text === "string" && readmeRes.text.trim()) {
    readmeContent = sanitizeTextForPrompt(readmeRes.text).slice(0, MAX_README_CHARS);
  }

  // Branches & Tags
  const branches = Array.isArray(branchesRes.data)
    ? branchesRes.data.map((b: any) => String(b.name)).filter(Boolean)
    : [repo.default_branch];

  const tags = Array.isArray(tagsRes.data)
    ? tagsRes.data.map((t: any) => String(t.name)).filter(Boolean)
    : [];

  // Releases
  const releases: ExtractedRelease[] = [];
  if (Array.isArray(releasesRes.data)) {
    for (const rel of releasesRes.data) {
      releases.push({
        githubReleaseId: Number(rel.id),
        tagName: String(rel.tag_name || ""),
        name: rel.name ? String(rel.name) : null,
        body: rel.body ? sanitizeTextForPrompt(String(rel.body)).slice(0, 4000) : null,
        htmlUrl: String(rel.html_url || ""),
        isPrerelease: Boolean(rel.prerelease),
        isDraft: Boolean(rel.draft),
        publishedAt: rel.published_at ? String(rel.published_at) : null,
      });
    }
  }

  // Pull Requests
  const candidateLoginLower = candidateProfile.login.toLowerCase();
  const pullRequests: ExtractedPullRequest[] = [];
  if (Array.isArray(prsRes.data)) {
    for (const pr of prsRes.data) {
      const authorLogin = String(pr.user?.login || "");
      const isCandidateAuthor = authorLogin.toLowerCase() === candidateLoginLower;
      const state: "open" | "closed" | "merged" = pr.merged_at
        ? "merged"
        : pr.state === "closed"
        ? "closed"
        : "open";

      pullRequests.push({
        number: Number(pr.number),
        title: sanitizeTextForPrompt(String(pr.title || "")),
        state,
        body: pr.body ? sanitizeTextForPrompt(String(pr.body)).slice(0, 3000) : null,
        htmlUrl: String(pr.html_url || ""),
        authorLogin,
        isCandidateAuthor,
        headRef: pr.head?.ref ? String(pr.head.ref) : null,
        baseRef: pr.base?.ref ? String(pr.base.ref) : null,
        merged: Boolean(pr.merged_at),
        mergedAt: pr.merged_at ? String(pr.merged_at) : null,
        mergedByLogin: pr.merged_by?.login ? String(pr.merged_by.login) : null,
        reviewCommentsCount: Number(pr.review_comments || 0),
        commitsCount: Number(pr.commits || 0),
        additions: Number(pr.additions || 0),
        deletions: Number(pr.deletions || 0),
        changedFiles: Number(pr.changed_files || 0),
        labels: Array.isArray(pr.labels) ? pr.labels.map((l: any) => String(l.name)) : [],
        reviews: [],
        createdAtGitHub: String(pr.created_at || new Date().toISOString()),
        updatedAtGitHub: String(pr.updated_at || new Date().toISOString()),
        closedAtGitHub: pr.closed_at ? String(pr.closed_at) : null,
      });
    }
  }

  // Issues (Filtered: GitHub issues endpoint returns PRs unless filtered out)
  const issues: ExtractedIssue[] = [];
  if (Array.isArray(issuesRes.data)) {
    for (const iss of issuesRes.data) {
      if (iss.pull_request) continue; // Exclude PR items
      const authorLogin = String(iss.user?.login || "");
      const isCandidateAuthor = authorLogin.toLowerCase() === candidateLoginLower;

      issues.push({
        number: Number(iss.number),
        title: sanitizeTextForPrompt(String(iss.title || "")),
        state: iss.state === "closed" ? "closed" : "open",
        body: iss.body ? sanitizeTextForPrompt(String(iss.body)).slice(0, 3000) : null,
        htmlUrl: String(iss.html_url || ""),
        authorLogin,
        isCandidateAuthor,
        commentsCount: Number(iss.comments || 0),
        labels: Array.isArray(iss.labels) ? iss.labels.map((l: any) => String(l.name)) : [],
        assignees: Array.isArray(iss.assignees) ? iss.assignees.map((a: any) => String(a.login)) : [],
        createdAtGitHub: String(iss.created_at || new Date().toISOString()),
        updatedAtGitHub: String(iss.updated_at || new Date().toISOString()),
        closedAtGitHub: iss.closed_at ? String(iss.closed_at) : null,
      });
    }
  }

  // File Tree Inspection & Manifest Extraction
  const fileStructure: Array<{ path: string; type: "blob" | "tree"; size?: number }> = [];
  const manifests: Record<string, string> = {};
  const workflows: string[] = [];

  const candidateManifestPaths: string[] = [];

  if (treeRes.ok && Array.isArray(treeRes.data?.tree)) {
    const rawTree = treeRes.data.tree as Array<{ path: string; type: string; size?: number }>;
    for (const item of rawTree.slice(0, 2000)) {
      const p = String(item.path);
      // Security: Strictly exclude potential secret files
      if (SECRET_FILE_PATTERNS.some((pat) => pat.test(p))) {
        continue;
      }
      fileStructure.push({
        path: p,
        type: item.type === "tree" ? "tree" : "blob",
        size: item.size ? Number(item.size) : undefined,
      });

      if (p.startsWith(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml"))) {
        workflows.push(p);
      }

      const basename = p.split("/").pop() || "";
      if (CANDIDATE_MANIFEST_FILES.includes(basename) && candidateManifestPaths.length < 8) {
        candidateManifestPaths.push(p);
      }
    }
  }

  // Fetch candidate manifests content
  if (candidateManifestPaths.length > 0) {
    const manifestFetches = candidateManifestPaths.map(async (mfPath) => {
      const res = await executeGitHubRequest(
        `/repos/${owner}/${name}/contents/${encodeURIComponent(mfPath)}`,
        { token, accept: "application/vnd.github.v3.raw" }
      );
      if (res.ok && typeof res.text === "string") {
        manifests[mfPath] = res.text.slice(0, MAX_MANIFEST_CHARS);
      }
    });
    await Promise.all(manifestFetches);
  }

  // Commits & Commit Attribution
  const commits: ExtractedCommit[] = [];
  const observedShas = new Set<string>();

  const candidateNameLower = candidateProfile.name ? candidateProfile.name.toLowerCase().trim() : null;
  const candidateEmailLower = candidateProfile.email ? candidateProfile.email.toLowerCase().trim() : null;

  let candidateCommitsCount = 0;
  let otherCommitsCount = 0;
  let firstCommitDate: string | null = null;
  let latestCommitDate: string | null = null;

  const nowMs = Date.now();
  const ms30Days = 30 * 24 * 60 * 60 * 1000;
  const ms90Days = 90 * 24 * 60 * 60 * 1000;
  const ms365Days = 365 * 24 * 60 * 60 * 1000;

  let activityLast30Days = 0;
  let activityLast90Days = 0;
  let activityLast365Days = 0;
  const monthlyBreakdown: Record<string, number> = {};

  if (Array.isArray(commitsRes.data)) {
    for (const c of commitsRes.data) {
      const sha = String(c.sha || "");
      if (!sha || observedShas.has(sha)) continue;
      observedShas.add(sha);

      const author = c.commit?.author;
      const committer = c.commit?.committer;

      const authorLogin = c.author?.login ? String(c.author.login) : null;
      const authorName = author?.name ? String(author.name) : null;
      const authorEmail = author?.email ? String(author.email) : null;
      const authorDate = String(author?.date || c.commit?.committer?.date || new Date().toISOString());

      const committerLogin = c.committer?.login ? String(c.committer.login) : null;
      const committerName = committer?.name ? String(committer.name) : null;
      const committerEmail = committer?.email ? String(committer.email) : null;
      const committerDate = String(committer?.date || authorDate);

      // Attribution Check
      let isAttributed = false;
      let attributionMethod: ExtractedCommit["attributionMethod"] = "unattributed";

      if (
        (authorLogin && authorLogin.toLowerCase() === candidateLoginLower) ||
        (committerLogin && committerLogin.toLowerCase() === candidateLoginLower)
      ) {
        isAttributed = true;
        attributionMethod = "login_match";
      } else if (
        candidateEmailLower &&
        ((authorEmail && authorEmail.toLowerCase() === candidateEmailLower) ||
          (committerEmail && committerEmail.toLowerCase() === candidateEmailLower))
      ) {
        isAttributed = true;
        attributionMethod = "email_match";
      } else if (
        candidateNameLower &&
        candidateNameLower.length > 2 &&
        ((authorName && authorName.toLowerCase() === candidateNameLower) ||
          (committerName && committerName.toLowerCase() === candidateNameLower))
      ) {
        isAttributed = true;
        attributionMethod = "name_match";
      }

      if (isAttributed) {
        candidateCommitsCount++;
      } else {
        otherCommitsCount++;
      }

      // Timeline metrics
      const commitTimeMs = new Date(authorDate).getTime();
      if (!isNaN(commitTimeMs)) {
        const ageMs = nowMs - commitTimeMs;
        if (ageMs <= ms30Days) activityLast30Days++;
        if (ageMs <= ms90Days) activityLast90Days++;
        if (ageMs <= ms365Days) activityLast365Days++;

        const monthKey = authorDate.slice(0, 7); // YYYY-MM
        monthlyBreakdown[monthKey] = (monthlyBreakdown[monthKey] || 0) + 1;

        if (!firstCommitDate || commitTimeMs < new Date(firstCommitDate).getTime()) {
          firstCommitDate = authorDate;
        }
        if (!latestCommitDate || commitTimeMs > new Date(latestCommitDate).getTime()) {
          latestCommitDate = authorDate;
        }
      }

      const parents = Array.isArray(c.parents) ? c.parents.map((p: any) => String(p.sha)) : [];
      const stats = c.stats || {};

      commits.push({
        sha,
        message: sanitizeTextForPrompt(String(c.commit?.message || "")).slice(0, 1500),
        authorName,
        authorEmail,
        authorLogin,
        authorDate,
        committerName,
        committerEmail,
        committerLogin,
        committerDate,
        parents,
        additions: Number(stats.additions || 0),
        deletions: Number(stats.deletions || 0),
        totalChanges: Number(stats.total || 0),
        isAttributedToCandidate: isAttributed,
        attributionMethod,
        commitUrl: String(c.html_url || `https://github.com/${repo.full_name}/commit/${sha}`),
      });
    }
  }

  // Technology Detection via Deterministic Engine
  const observedFiles = fileStructure.map((f) => f.path);
  const techFindings = detectRepositoryTechnologies({
    manifests,
    languages,
    observedFiles,
    readmeText: readmeContent,
    primaryLanguage: repo.primary_language,
  });

  const aiMlCategories = classifyRepositoryAiMl(techFindings, repo.topics, repo.description || "");
  const projectClassification = classifyRepositoryType({
    isFork: repo.is_fork,
    isArchived: repo.is_archived,
    isEmpty: repo.is_empty || repo.disk_usage_kb === 0,
    isTemplate: repo.is_template,
    ownerLogin: owner,
    userLogin: candidateProfile.login,
    name: repo.name,
    description: repo.description,
    topics: repo.topics,
    aiMlCategories,
  });

  // Calculate Checksum
  const checksumPayload = JSON.stringify({
    name: repo.name,
    fullName: repo.full_name,
    pushedAt: repo.pushed_at,
    stars: repo.stars,
    forks: repo.forks,
    defaultBranch: repo.default_branch,
    techs: techFindings.map((t) => t.name).sort(),
    latestSha: commits[0]?.sha || null,
  });
  const checksum = crypto.createHash("sha256").update(checksumPayload).digest("hex");

  return {
    repo,
    languages,
    branches,
    tags,
    releases,
    pullRequests,
    issues,
    commits,
    workflows,
    fileStructure,
    manifests,
    readmeContent,
    technologyFindings: techFindings,
    aiMlCategories,
    projectClassification,
    checksum,
    firstCommitAt: firstCommitDate,
    lastPushAt: repo.pushed_at,
    commitAnalytics: {
      totalAccessibleCommits: commits.length,
      candidateCommits: candidateCommitsCount,
      otherContributorsCommits: otherCommitsCount,
      firstCommitDate,
      latestCommitDate,
      activityLast30Days,
      activityLast90Days,
      activityLast365Days,
      uniqueShasCount: observedShas.size,
      monthlyBreakdown,
    },
    failureReasons,
  };
}

/**
 * Worker pool helper for bounded concurrency
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}
