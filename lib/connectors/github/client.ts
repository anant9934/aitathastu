/**
 * AI TATHASTU — OFFICIAL GITHUB REST API CLIENT & INTELLIGENCE EXTRACTOR V4.3
 *
 * Implements:
 * 1. Public profile acquisition (GET /users/{username}) with stable account ID
 * 2. Bounded repository discovery (GET /users/{username}/repos) with pagination
 * 3. Deep repository content analysis (README, languages, manifests: package.json, requirements.txt, pyproject.toml, Dockerfile)
 * 4. Deterministic technology detection & AI/ML project classification
 * 5. Prompt injection defense on all untrusted repository content
 * 6. Rate-limit aware backoff and graceful degradation
 */

import crypto from "crypto";
import {
  detectRepositoryTechnologies,
  classifyRepositoryAiMl,
  type TechnologyFinding,
  type AiMlProjectCategory,
} from "./tech-detector";
import { sanitizeTextForPrompt } from "@/lib/intelligence/prompt-defense";

export type GitHubConnectionState =
  | "PROFILE_DISCOVERED"
  | "PUBLIC_PROFILE_CONFIRMED"
  | "PUBLIC_DATA_IMPORTED"
  | "GITHUB_IDENTITY_AUTHENTICATED"
  | "PRIVATE_REPOSITORY_ACCESS_AUTHORIZED";

export interface GitHubUserProfile {
  id: number;
  login: string;
  name: string | null;
  bio: string | null;
  blog: string | null;
  location: string | null;
  company: string | null;
  html_url: string;
  avatar_url: string;
  public_repos: number;
  created_at: string;
  followers: number;
  following: number;
}

export interface RawGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  topics?: string[];
  stargazers_count?: number;
  forks_count?: number;
  fork?: boolean;
  private?: boolean;
  archived?: boolean;
  default_branch?: string;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
  homepage?: string | null;
  manifests?: Record<string, string>;
  readmeSnippet?: string;
  languages?: Record<string, number>;
  workflows?: string[];
}

export interface DiscoveredGitHubProject {
  id: string;
  externalRepoId: number;
  title: string;
  description: string;
  repositoryUrl: string;
  homepageUrl?: string | null;
  primaryLanguage: string | null;
  languages: string[];
  technologies: string[];
  technologyFindings: TechnologyFinding[];
  aiMlCategories: AiMlProjectCategory[];
  stars: number;
  forks: number;
  isFork: boolean;
  isArchived: boolean;
  isPrivate: boolean;
  sources: string[];
  status: "candidate";
  provenance: string;
  checksum: string;
  detectedManifests: string[];
  observedFiles: string[];
  studentContributionStatus: "UNVERIFIED" | "STUDENT_CONFIRMED" | "GITHUB_ATTRIBUTED";
  lastGitHubSyncAt: string;
  lastGitHubPushAt: string;
  analysisStage?: "metadata" | "manifest_verified" | "deep_inspected";
}

export interface FetchGitHubIntelligenceResult {
  success: boolean;
  connectionState: GitHubConnectionState;
  username: string;
  profile: GitHubUserProfile | null;
  totalPublicRepos: number;
  fetchedReposCount: number;
  analyzedReposCount: number;
  isComplete: boolean;
  projects: DiscoveredGitHubProject[];
  allDetectedTechnologies: TechnologyFinding[];
  rateLimitRemaining?: number;
  rateLimitResetAt?: number;
  error?: string;
  source: "api" | "fallback";
  /** Repos whose README/manifests could not be read (rate limit, timeout, HTTP error). Their tech lists are incomplete. */
  failedRepos: Array<{ repo: string; reason: string }>;
  /** True when the account has more public repos than were listed (MAX_REPO_PAGES cap). */
  truncated: boolean;
  rateLimited: boolean;
}

/** Bounded so one import cannot exhaust the shared 5000/h (token) or 60/h (anonymous) budget. */
const MAX_REPO_PAGES = 3;
const REPOS_PER_PAGE = 100;

const GITHUB_API_BASE = "https://api.github.com";
const USER_AGENT = "AI-Tathastu-LiveIntelligence/4.3";
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_DEEP_INSPECT_REPOS = 6;
const MAX_README_CHARS = 4000;

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function cleanGitHubUsername(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, "")
    .replace(/\/$/, "")
    .split("/")[0]
    .replace(/^@/, "");
}

/**
 * 1. Public Profile Acquisition: GET /users/{username}
 */
export async function fetchGitHubUserProfile(
  username: string,
  token?: string
): Promise<{ success: boolean; profile?: GitHubUserProfile; error?: string; rateLimited?: boolean }> {
  const clean = cleanGitHubUsername(username);
  if (!clean || !/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38})$/.test(clean)) {
    return { success: false, error: "Please enter a valid GitHub username." };
  }

  try {
    const res = await fetch(`${GITHUB_API_BASE}/users/${encodeURIComponent(clean)}`, {
      headers: buildHeaders(token),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      cache: "no-store",
    });

    if (res.status === 404) {
      return { success: false, error: `GitHub user "${clean}" does not exist.` };
    }
    if (res.status === 403 || res.status === 429) {
      const rateLimited = res.status === 429 || res.headers.get("x-ratelimit-remaining") === "0";
      return {
        success: false,
        error: rateLimited ? "GitHub API rate limit reached. You can continue manually." : "GitHub denied the profile request (HTTP 403). You can continue manually.",
        rateLimited,
      };
    }
    if (!res.ok) {
      return { success: false, error: `GitHub API error (${res.status}).` };
    }

    const data = (await res.json()) as any;
    const profile: GitHubUserProfile = {
      id: Number(data.id),
      login: String(data.login || clean),
      name: data.name ? String(data.name) : null,
      bio: data.bio ? String(data.bio) : null,
      blog: data.blog ? String(data.blog) : null,
      location: data.location ? String(data.location) : null,
      company: data.company ? String(data.company) : null,
      html_url: String(data.html_url || `https://github.com/${clean}`),
      avatar_url: String(data.avatar_url || ""),
      public_repos: Number(data.public_repos || 0),
      created_at: String(data.created_at || new Date().toISOString()),
      followers: Number(data.followers || 0),
      following: Number(data.following || 0),
    };

    return { success: true, profile };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      success: false,
      error: isTimeout ? "GitHub request timed out. Please try again." : "Could not reach GitHub API right now.",
    };
  }
}

/**
 * 2. Repository Discovery: GET /users/{username}/repos (with bounded pagination)
 */
export async function fetchGitHubUserRepos(
  username: string,
  options: { token?: string; maxRepos?: number } = {}
): Promise<{ success: boolean; repos: RawGitHubRepo[]; error?: string; rateLimited?: boolean }> {
  const clean = cleanGitHubUsername(username);
  const maxRepos = options.maxRepos ?? MAX_REPO_PAGES * REPOS_PER_PAGE;
  const token = options.token;
  const repos: RawGitHubRepo[] = [];
  let page = 1;
  // Always request full pages. Sizing the page to maxRepos (e.g. 60) used to
  // make the first page look "full" and silently stop after it.
  const perPage = REPOS_PER_PAGE;

  try {
    while (repos.length < maxRepos) {
      const endpoint = `${GITHUB_API_BASE}/users/${encodeURIComponent(clean)}/repos?sort=updated&per_page=${perPage}&page=${page}`;

      const res = await fetch(endpoint, {
        headers: buildHeaders(token),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        cache: "no-store",
      });

      if (res.status === 404) return { success: false, repos: [], error: `GitHub user "${clean}" not found.` };
      if (res.status === 403 || res.status === 429) {
        const rateLimited = res.status === 429 || res.headers.get("x-ratelimit-remaining") === "0";
        return { success: false, repos, error: rateLimited ? "GitHub API rate limit reached." : "GitHub denied the repository request (HTTP 403).", rateLimited };
      }
      if (!res.ok) return { success: false, repos, error: `GitHub API error (${res.status}).` };

      const pageRepos = (await res.json()) as RawGitHubRepo[];
      if (!Array.isArray(pageRepos) || pageRepos.length === 0) break;

      repos.push(...pageRepos);
      if (pageRepos.length < perPage || repos.length >= maxRepos) break;
      page++;
      if (page > MAX_REPO_PAGES) break;
    }

    return { success: true, repos: repos.slice(0, maxRepos) };
  } catch {
    return { success: false, repos, error: "Could not fetch repositories from GitHub." };
  }
}

/**
 * 3. Deep Repository Content Analysis: README, languages, and manifests
 */
export async function fetchRepositoryManifestsAndReadme(
  owner: string,
  repo: string,
  token?: string
): Promise<{
  readme?: string;
  languages?: Record<string, number>;
  manifests?: Record<string, string>;
  observedFiles?: string[];
  /** Set when any request for this repo failed for a reason other than "file does not exist". */
  failure?: string;
}> {
  const manifests: Record<string, string> = {};
  const observedFiles: string[] = [];
  const failures = new Set<string>();
  // 404 just means the file is absent; anything else means data is missing.
  const note = (res: Response) => {
    if (res.ok || res.status === 404) return;
    failures.add(res.status === 403 || res.status === 429 ? "rate_limited" : `http_${res.status}`);
  };
  const noteError = (err: unknown) => failures.add(err instanceof Error && err.name === "TimeoutError" ? "timeout" : "network");

  const headers = buildHeaders(token);
  const rawHeaders = { ...headers, Accept: "application/vnd.github.v3.raw" };
  const get = async (path: string, h: Record<string, string>): Promise<Response | null> => {
    try {
      const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/${path}`, {
        headers: h,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      note(res);
      return res;
    } catch (err) {
      noteError(err);
      return null;
    }
  };

  const candidateManifests = [
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "Pipfile",
    "Dockerfile",
    "docker-compose.yml",
    "go.mod",
    "Cargo.toml",
  ];

  // All requests for one repo run concurrently: done serially, a 6-repo sync
  // was ~60 round-trips and could outlive a serverless request (the OAuth
  // callback awaits the whole sync).
  const [langRes, readmeRes, ...mfResults] = await Promise.all([
    get("languages", headers),
    get("readme", rawHeaders),
    ...candidateManifests.map((mf) => get(`contents/${mf}`, rawHeaders)),
  ]);

  let languages: Record<string, number> = {};
  if (langRes?.ok) {
    try { languages = (await langRes.json()) as Record<string, number>; } catch (err) { noteError(err); }
  }

  let readme = "";
  if (readmeRes?.ok) {
    try {
      // Prompt injection defense: sanitize raw markdown and truncate
      readme = sanitizeTextForPrompt(await readmeRes.text()).slice(0, MAX_README_CHARS);
      observedFiles.push("README.md");
    } catch (err) { noteError(err); }
  }

  for (let i = 0; i < candidateManifests.length; i++) {
    const res = mfResults[i];
    if (!res?.ok) continue;
    try {
      manifests[candidateManifests[i]] = (await res.text()).slice(0, 8000); // Bounded snapshot
      observedFiles.push(candidateManifests[i]);
    } catch (err) { noteError(err); }
  }

  return { readme, languages, manifests, observedFiles, failure: failures.size ? [...failures].join(",") : undefined };
}

export function calculateProjectChecksum(repo: RawGitHubRepo, techNames: string[]): string {
  const payload = JSON.stringify({
    name: repo.name,
    description: repo.description,
    topics: repo.topics?.slice().sort(),
    language: repo.language,
    technologies: techNames.slice().sort(),
    default_branch: repo.default_branch,
    pushed_at: repo.pushed_at,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Maps a raw repository and its extracted findings into a canonical DiscoveredGitHubProject
 */
export function mapRawRepoToProject(
  repo: RawGitHubRepo,
  deepInspection?: {
    readme?: string;
    languages?: Record<string, number>;
    manifests?: Record<string, string>;
    observedFiles?: string[];
  }
): DiscoveredGitHubProject {
  const manifests = deepInspection?.manifests || repo.manifests || {};
  const languages = deepInspection?.languages || repo.languages || {};
  const observedFiles = deepInspection?.observedFiles || (repo.manifests ? Object.keys(repo.manifests) : []);
  const readmeText = deepInspection?.readme || repo.readmeSnippet || null;

  // 1. Detect technologies with strict provenance
  const techFindings = detectRepositoryTechnologies({
    manifests,
    languages,
    observedFiles,
    readmeText,
    primaryLanguage: repo.language,
  });

  const techNames = techFindings.map((f) => f.name);

  // 2. Classify AI/ML domains
  const aiMlCategories = classifyRepositoryAiMl(techFindings, repo.topics || [], repo.description || "");

  const checksum = calculateProjectChecksum(repo, techNames);
  const isPrivate = Boolean(repo.private);

  return {
    id: `gh_${repo.id}`,
    externalRepoId: repo.id,
    title: repo.name,
    description: repo.description || (isPrivate ? "Private repository" : "Public GitHub repository"),
    repositoryUrl: repo.html_url,
    homepageUrl: repo.homepage || null,
    primaryLanguage: repo.language || null,
    languages: Object.keys(languages).length > 0 ? Object.keys(languages) : repo.language ? [repo.language] : [],
    technologies: techNames,
    technologyFindings: techFindings,
    aiMlCategories,
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    isFork: Boolean(repo.fork),
    isArchived: Boolean(repo.archived),
    isPrivate,
    sources: ["github"],
    status: "candidate",
    provenance: `Detected from GitHub ${isPrivate ? "private" : "public"} repository. Discovered and candidate-mapped; personal contribution self-reported until confirmed.`,
    checksum,
    detectedManifests: Object.keys(manifests),
    observedFiles,
    studentContributionStatus: "UNVERIFIED",
    lastGitHubSyncAt: new Date().toISOString(),
    lastGitHubPushAt: repo.pushed_at || repo.updated_at || new Date().toISOString(),
  };
}

/**
 * 4. High-Level Orchestrator: Complete GitHub Live Intelligence Extraction
 */
export async function fetchGitHubIntelligence(
  username: string,
  options: {
    token?: string;
    maxReposToDiscover?: number;
    maxReposToDeepInspect?: number;
  } = {}
): Promise<FetchGitHubIntelligenceResult> {
  const clean = cleanGitHubUsername(username);
  const token = options.token || process.env.GITHUB_TOKEN;

  // Step 1: User Profile Acquisition
  const profileRes = await fetchGitHubUserProfile(clean, token);
  if (!profileRes.success || !profileRes.profile) {
    return {
      success: false,
      connectionState: "PUBLIC_PROFILE_CONFIRMED",
      username: clean,
      profile: null,
      totalPublicRepos: 0,
      fetchedReposCount: 0,
      analyzedReposCount: 0,
      isComplete: false,
      projects: [],
      allDetectedTechnologies: [],
      error: profileRes.error || "GitHub profile not found.",
      source: "api",
      failedRepos: [],
      truncated: false,
      rateLimited: false,
    };
  }

  const profile = profileRes.profile;

  // Step 2: Repository Discovery
  const reposRes = await fetchGitHubUserRepos(clean, {
    token,
    maxRepos: options.maxReposToDiscover,
  });

  if (!reposRes.success) {
    return {
      success: false,
      connectionState: "PUBLIC_PROFILE_CONFIRMED",
      username: clean,
      profile,
      totalPublicRepos: profile.public_repos,
      fetchedReposCount: 0,
      analyzedReposCount: 0,
      isComplete: false,
      projects: [],
      allDetectedTechnologies: [],
      error: reposRes.error || "Could not list repositories.",
      source: "api",
      failedRepos: [],
      truncated: false,
      rateLimited: Boolean(reposRes.rateLimited),
    };
  }

  const allRepos = reposRes.repos;
  // Filter for projects: include own repos first, non-forks prioritized
  const relevantRepos = allRepos.filter((r) => !r.private);

  // Step 3: Deep content inspection for priority candidate repos
  // Prioritize active, non-fork repos with most recent pushes
  const sortedPriorityRepos = [...relevantRepos].sort((a, b) => {
    if (a.fork !== b.fork) return a.fork ? 1 : -1;
    const timeA = new Date(a.pushed_at || 0).getTime();
    const timeB = new Date(b.pushed_at || 0).getTime();
    return timeB - timeA;
  });

  const maxInspect = options.maxReposToDeepInspect ?? MAX_DEEP_INSPECT_REPOS;
  const reposToInspect = sortedPriorityRepos.slice(0, maxInspect);

  const projects: DiscoveredGitHubProject[] = [];
  const allFindingsMap = new Map<string, TechnologyFinding>();

  const failedRepos: Array<{ repo: string; reason: string }> = [];
  for (const repo of reposToInspect) {
    const [owner, name] = repo.full_name ? repo.full_name.split("/") : [clean, repo.name];
    const deepData = await fetchRepositoryManifestsAndReadme(owner, name, token);
    if (deepData.failure) failedRepos.push({ repo: repo.name, reason: deepData.failure });
    const mapped = mapRawRepoToProject(repo, deepData);
    projects.push(mapped);
    for (const f of mapped.technologyFindings) {
      if (!allFindingsMap.has(f.name)) allFindingsMap.set(f.name, f);
    }
  }

  // Map remaining repos using shallow metadata
  for (const repo of sortedPriorityRepos.slice(maxInspect)) {
    const mapped = mapRawRepoToProject(repo);
    projects.push(mapped);
    for (const f of mapped.technologyFindings) {
      if (!allFindingsMap.has(f.name)) allFindingsMap.set(f.name, f);
    }
  }

  const isComplete = allRepos.length >= profile.public_repos;

  return {
    success: true,
    connectionState: "PUBLIC_DATA_IMPORTED",
    username: clean,
    profile,
    totalPublicRepos: profile.public_repos,
    fetchedReposCount: allRepos.length,
    analyzedReposCount: reposToInspect.length,
    isComplete,
    projects,
    allDetectedTechnologies: Array.from(allFindingsMap.values()),
    source: "api",
    failedRepos,
    truncated: allRepos.length < profile.public_repos,
    rateLimited: failedRepos.some((f) => f.reason.includes("rate_limited")),
  };
}

/**
 * Backwards compatible legacy entrypoint used by existing onboarding routes
 */
export async function fetchGitHubProjects(
  username: string,
  token?: string
): Promise<{
  success: boolean;
  username: string;
  projects: DiscoveredGitHubProject[];
  error?: string;
  source: "api" | "fallback";
}> {
  const result = await fetchGitHubIntelligence(username, { token });
  return {
    success: result.success,
    username: result.username,
    projects: result.projects,
    error: result.error,
    source: result.source,
  };
}
