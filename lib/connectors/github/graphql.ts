/**
 * Batched GitHub GraphQL acquisition (Tasks 1.5.1-1.5.3).
 *
 * At most two round trips per sync:
 *   1. metadata: the user + up to 100 owned public repos (incl. pushedAt)
 *   2. deep: languages, README and manifests, aliased per repo, ONLY for
 *      repos whose pushedAt differs from the last snapshot (1.5.2)
 * A binary/oversized/unreadable blob is recorded as a per-repo failure and
 * the rest of the sync continues (1.5.3). Every request goes through
 * connectorFetch, so the shared rate window and circuit breaker apply, and
 * GitHub's X-RateLimit-Reset opens the breaker until the reset (1.7.2).
 *
 * GraphQL needs a token; callers without one use the REST path in client.ts.
 */
import { connectorFetch } from "@/lib/connectors/rate-limiter";
import { sanitizeTextForPrompt } from "@/lib/intelligence/prompt-defense";
import type { GitHubUserProfile, RawGitHubRepo } from "./client";

const ENDPOINT = "https://api.github.com/graphql";
export const GITHUB_MANIFESTS = [
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
] as const;

const MAX_PAGE_REPOS = 100;
const MAX_README_CHARS = 4000;
const MAX_MANIFEST_CHARS = 8000;

export class GitHubGraphQLError extends Error {
  constructor(message: string, readonly status?: number, readonly rateLimited = false) {
    super(message);
  }
}

export const METADATA_QUERY = `query($login: String!, $first: Int!, $after: String) {
  rateLimit { remaining resetAt cost }
  user(login: $login) {
    databaseId login name bio websiteUrl location company url avatarUrl createdAt
    followers { totalCount } following { totalCount }
    repositories(first: $first, after: $after, ownerAffiliations: [OWNER, COLLABORATOR], privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        databaseId name nameWithOwner description url homepageUrl
        stargazerCount forkCount isFork isPrivate isArchived isTemplate isEmpty diskUsage
        pushedAt createdAt updatedAt
        defaultBranchRef { name } primaryLanguage { name }
        licenseInfo { spdxId name }
        repositoryTopics(first: 10) { nodes { topic { name } } }
      }
    }
  }
}`;

const blob = (alias: string, path: string) => `${alias}: object(expression: ${JSON.stringify(`HEAD:${path}`)}) { ... on Blob { text isBinary byteSize } }`;

/** One aliased `repository(...)` block per changed repo, in a single document. */
export function buildDeepQuery(repos: { owner: string; name: string }[]) {
  const blocks = repos.map((r, i) => `r${i}: repository(owner: ${JSON.stringify(r.owner)}, name: ${JSON.stringify(r.name)}) {
    languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
    ${blob("readme", "README.md")}
    ${GITHUB_MANIFESTS.map((m, j) => blob(`m${j}`, m)).join("\n    ")}
  }`);
  return `query { rateLimit { remaining resetAt cost }\n  ${blocks.join("\n  ")}\n}`;
}

type Blob = { text: string | null; isBinary: boolean; byteSize: number } | null;

async function graphql(query: string, variables: Record<string, unknown>, token: string, correlationId?: string) {
  const res = await connectorFetch("github", ENDPOINT, {
    method: "POST",
    correlationId,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "AI-Tathastu-LiveIntelligence/5.0" },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401) throw new GitHubGraphQLError("GitHub rejected the token (401). Reconnect GitHub.", 401);
  if (res.status === 403 || res.status === 429) throw new GitHubGraphQLError("GitHub rate limit reached.", res.status, true);
  if (!res.ok) throw new GitHubGraphQLError(`GitHub GraphQL HTTP ${res.status}.`, res.status);
  let body: { data?: Record<string, unknown>; errors?: { message: string; type?: string; path?: string[] }[] };
  try {
    body = await res.json();
  } catch {
    throw new GitHubGraphQLError("GitHub returned a malformed GraphQL response.");
  }
  return body;
}

export type DeepRepoData = {
  readme?: string;
  languages: Record<string, number>;
  manifests: Record<string, string>;
  observedFiles: string[];
  failure?: string;
};

export type GraphQLAcquisition = {
  profile: GitHubUserProfile;
  repos: RawGitHubRepo[];
  totalRepos: number;
  /** Deep data for repos that changed; unchanged repos are absent. */
  deep: Map<string, DeepRepoData>;
  unchanged: string[];
  queries: number;
  rateLimitRemaining?: number;
  pageInfo?: { hasNextPage: boolean; endCursor: string | null };
  isComplete: boolean;
};

/**
 * Complete, resumable GitHub GraphQL repository discovery and batch deep inspection.
 * Paginates until all accessible repositories are discovered or paused by quota.
 *
 * @param previousPushedAt  nameWithOwner -> pushedAt from the last snapshot;
 *                          repos with an equal value skip deep inspection.
 */
export async function acquireGitHubViaGraphQL(params: {
  login: string;
  token: string;
  previousPushedAt?: Map<string, string>;
  maxRepos?: number;
  maxDeep?: number;
  cursor?: string;
  correlationId?: string;
}): Promise<GraphQLAcquisition> {
  const maxRepos = params.maxRepos ?? 2000;
  let cursor: string | null = params.cursor ?? null;
  let hasNextPage = true;
  let queries = 0;
  let rateLimitRemaining: number | undefined;

  let profile: GitHubUserProfile | null = null;
  let totalRepos = 0;
  const rawNodes: any[] = [];

  while (hasNextPage && rawNodes.length < maxRepos) {
    const pageSize = Math.min(MAX_PAGE_REPOS, maxRepos - rawNodes.length);
    const variables: Record<string, unknown> = { login: params.login, first: pageSize };
    if (cursor) variables.after = cursor;

    const res = await graphql(METADATA_QUERY, variables, params.token, params.correlationId);
    queries++;
    rateLimitRemaining = (res.data?.rateLimit as { remaining?: number } | undefined)?.remaining ?? rateLimitRemaining;

    const user = (res.data?.user ?? null) as any;
    if (!user) {
      if (!profile) {
        const notFound = res.errors?.some((e) => e.type === "NOT_FOUND");
        throw new GitHubGraphQLError(
          notFound ? `GitHub user "${params.login}" not found.` : `GitHub GraphQL error: ${res.errors?.[0]?.message ?? "no user returned"}`,
          notFound ? 404 : undefined
        );
      }
      break;
    }

    if (!profile) {
      totalRepos = user.repositories?.totalCount ?? 0;
      profile = {
        id: user.databaseId,
        login: user.login,
        name: user.name,
        bio: user.bio,
        blog: user.websiteUrl,
        location: user.location,
        company: user.company,
        html_url: user.url,
        avatar_url: user.avatarUrl,
        public_repos: totalRepos,
        created_at: user.createdAt,
        followers: user.followers?.totalCount ?? 0,
        following: user.following?.totalCount ?? 0,
      };
    }

    const pageInfo = user.repositories?.pageInfo;
    const nodes = (user.repositories?.nodes ?? []).filter(Boolean);
    rawNodes.push(...nodes);

    hasNextPage = Boolean(pageInfo?.hasNextPage);
    cursor = pageInfo?.endCursor ?? null;

    if (!hasNextPage || rawNodes.length >= maxRepos) {
      break;
    }
  }

  if (!profile) {
    throw new GitHubGraphQLError(`Could not acquire GitHub profile for "${params.login}".`);
  }

  const repos: RawGitHubRepo[] = rawNodes.map((n) => ({
    id: n.databaseId,
    name: n.name,
    full_name: n.nameWithOwner,
    description: n.description,
    html_url: n.url,
    language: n.primaryLanguage?.name ?? null,
    topics: (n.repositoryTopics?.nodes ?? []).map((t: any) => t.topic.name),
    stargazers_count: n.stargazerCount,
    forks_count: n.forkCount,
    fork: n.isFork,
    private: n.isPrivate,
    archived: n.isArchived,
    isTemplate: Boolean(n.isTemplate),
    isEmpty: Boolean(n.isEmpty || n.diskUsage === 0),
    diskUsage: n.diskUsage,
    license: n.licenseInfo?.spdxId || n.licenseInfo?.name || null,
    default_branch: n.defaultBranchRef?.name,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
    pushed_at: n.pushedAt ?? undefined,
    homepage: n.homepageUrl,
  }));

  const prev = params.previousPushedAt ?? new Map<string, string>();
  const changed = repos.filter((r) => !r.fork && prev.get(r.full_name) !== r.pushed_at);
  const unchanged = repos.filter((r) => !changed.includes(r)).map((r) => r.full_name);
  const maxDeep = params.maxDeep ?? 100;
  const toInspect = changed.slice(0, maxDeep);
  const deep = new Map<string, DeepRepoData>();

  // Batch changed repositories into chunks of 25 to avoid single-query complexity limits
  const CHUNK_SIZE = 25;
  for (let c = 0; c < toInspect.length; c += CHUNK_SIZE) {
    const chunk = toInspect.slice(c, c + CHUNK_SIZE);
    const targets = chunk.map((r) => {
      const [owner, name] = r.full_name.split("/");
      return { owner, name };
    });

    try {
      const body = await graphql(buildDeepQuery(targets), {}, params.token, params.correlationId);
      queries++;
      rateLimitRemaining = (body.data?.rateLimit as { remaining?: number } | undefined)?.remaining ?? rateLimitRemaining;

      const failedAliases = new Map<string, string>();
      for (const e of body.errors ?? []) if (e.path?.[0]) failedAliases.set(e.path[0], e.message.slice(0, 120));

      chunk.forEach((repo, i) => {
        const node = body.data?.[`r${i}`] as undefined | null | Record<string, unknown>;
        const failures: string[] = [];
        if (failedAliases.has(`r${i}`)) failures.push(`graphql:${failedAliases.get(`r${i}`)}`);
        if (!node) {
          deep.set(repo.full_name, { languages: {}, manifests: {}, observedFiles: [], failure: failures.join(",") || "missing" });
          return;
        }
        const languages: Record<string, number> = {};
        for (const edge of (node.languages as { edges?: { size: number; node: { name: string } }[] } | null)?.edges ?? []) languages[edge.node.name] = edge.size;
        const observedFiles: string[] = [];
        const manifests: Record<string, string> = {};
        const read = (b: Blob, file: string, max: number) => {
          if (!b) return undefined;
          if (b.isBinary || b.text === null) { failures.push(`unreadable:${file}`); return undefined; }
          observedFiles.push(file);
          return b.text.slice(0, max);
        };
        const readmeRaw = read(node.readme as Blob, "README.md", MAX_README_CHARS * 2);
        GITHUB_MANIFESTS.forEach((file, j) => {
          const text = read(node[`m${j}`] as Blob, file, MAX_MANIFEST_CHARS);
          if (text !== undefined) {
            if (file === "package.json") { try { JSON.parse(text); } catch { failures.push("malformed:package.json"); return; } }
            manifests[file] = text;
          }
        });
        deep.set(repo.full_name, {
          readme: readmeRaw ? sanitizeTextForPrompt(readmeRaw).slice(0, MAX_README_CHARS) : undefined,
          languages, manifests, observedFiles,
          failure: failures.length ? failures.join(",") : undefined,
        });
      });
    } catch (err) {
      for (const repo of chunk) {
        deep.set(repo.full_name, {
          languages: {},
          manifests: {},
          observedFiles: [],
          failure: err instanceof Error ? err.message.slice(0, 120) : "chunk_failed",
        });
      }
      if (err instanceof GitHubGraphQLError && err.rateLimited) {
        break;
      }
    }
  }

  const isComplete = repos.length >= profile.public_repos && !hasNextPage;

  return {
    profile,
    repos,
    totalRepos: profile.public_repos,
    deep,
    unchanged,
    queries,
    rateLimitRemaining,
    pageInfo: { hasNextPage, endCursor: cursor },
    isComplete,
  };
}
