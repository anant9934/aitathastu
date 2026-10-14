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
export const GITHUB_MANIFESTS = ["package.json", "requirements.txt", "pyproject.toml", "Pipfile", "Dockerfile", "docker-compose.yml", "go.mod", "Cargo.toml"] as const;
const MAX_REPOS = 100;
const MAX_README_CHARS = 4000;
const MAX_MANIFEST_CHARS = 8000;

export class GitHubGraphQLError extends Error {
  constructor(message: string, readonly status?: number, readonly rateLimited = false) {
    super(message);
  }
}

export const METADATA_QUERY = `query($login: String!, $first: Int!) {
  rateLimit { remaining resetAt cost }
  user(login: $login) {
    databaseId login name bio websiteUrl location company url avatarUrl createdAt
    followers { totalCount } following { totalCount }
    repositories(first: $first, ownerAffiliations: OWNER, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
      totalCount
      nodes {
        databaseId name nameWithOwner description url homepageUrl
        stargazerCount forkCount isFork isPrivate isArchived pushedAt createdAt updatedAt
        defaultBranchRef { name } primaryLanguage { name }
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
};

/**
 * @param previousPushedAt  nameWithOwner -> pushedAt from the last snapshot;
 *                          repos with an equal value skip deep inspection.
 */
export async function acquireGitHubViaGraphQL(params: {
  login: string;
  token: string;
  previousPushedAt?: Map<string, string>;
  maxDeep?: number;
  correlationId?: string;
}): Promise<GraphQLAcquisition> {
  const meta = await graphql(METADATA_QUERY, { login: params.login, first: MAX_REPOS }, params.token, params.correlationId);
  const user = (meta.data?.user ?? null) as null | {
    databaseId: number; login: string; name: string | null; bio: string | null; websiteUrl: string | null;
    location: string | null; company: string | null; url: string; avatarUrl: string; createdAt: string;
    followers: { totalCount: number }; following: { totalCount: number };
    repositories: { totalCount: number; nodes: Array<{
      databaseId: number; name: string; nameWithOwner: string; description: string | null; url: string; homepageUrl: string | null;
      stargazerCount: number; forkCount: number; isFork: boolean; isPrivate: boolean; isArchived: boolean;
      pushedAt: string | null; createdAt: string; updatedAt: string; defaultBranchRef: { name: string } | null;
      primaryLanguage: { name: string } | null; repositoryTopics: { nodes: { topic: { name: string } }[] };
    } | null> };
  };
  if (!user) {
    const notFound = meta.errors?.some((e) => e.type === "NOT_FOUND");
    throw new GitHubGraphQLError(notFound ? `GitHub user "${params.login}" not found.` : `GitHub GraphQL error: ${meta.errors?.[0]?.message ?? "no user returned"}`, notFound ? 404 : undefined);
  }

  const profile: GitHubUserProfile = {
    id: user.databaseId, login: user.login, name: user.name, bio: user.bio, blog: user.websiteUrl,
    location: user.location, company: user.company, html_url: user.url, avatar_url: user.avatarUrl,
    public_repos: user.repositories.totalCount, created_at: user.createdAt,
    followers: user.followers.totalCount, following: user.following.totalCount,
  };
  const repos: RawGitHubRepo[] = user.repositories.nodes.filter((n): n is NonNullable<typeof n> => Boolean(n)).map((n) => ({
    id: n.databaseId, name: n.name, full_name: n.nameWithOwner, description: n.description, html_url: n.url,
    language: n.primaryLanguage?.name ?? null, topics: n.repositoryTopics.nodes.map((t) => t.topic.name),
    stargazers_count: n.stargazerCount, forks_count: n.forkCount, fork: n.isFork, private: n.isPrivate,
    archived: n.isArchived, default_branch: n.defaultBranchRef?.name, created_at: n.createdAt,
    updated_at: n.updatedAt, pushed_at: n.pushedAt ?? undefined, homepage: n.homepageUrl,
  }));

  const prev = params.previousPushedAt ?? new Map<string, string>();
  const changed = repos.filter((r) => !r.fork && prev.get(r.full_name) !== r.pushed_at);
  const unchanged = repos.filter((r) => !changed.includes(r)).map((r) => r.full_name);
  const toInspect = changed.slice(0, params.maxDeep ?? 30);
  const deep = new Map<string, DeepRepoData>();
  let queries = 1;
  let rateLimitRemaining = (meta.data?.rateLimit as { remaining?: number } | undefined)?.remaining;

  if (toInspect.length) {
    const targets = toInspect.map((r) => { const [owner, name] = r.full_name.split("/"); return { owner, name }; });
    const body = await graphql(buildDeepQuery(targets), {}, params.token, params.correlationId);
    queries++;
    rateLimitRemaining = (body.data?.rateLimit as { remaining?: number } | undefined)?.remaining ?? rateLimitRemaining;
    // Errors scoped to one alias (e.g. r3) fail that repo only.
    const failedAliases = new Map<string, string>();
    for (const e of body.errors ?? []) if (e.path?.[0]) failedAliases.set(e.path[0], e.message.slice(0, 120));

    toInspect.forEach((repo, i) => {
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
        if (!b) return undefined; // absent file: not a failure
        if (b.isBinary || b.text === null) { failures.push(`unreadable:${file}`); return undefined; }
        observedFiles.push(file);
        return b.text.slice(0, max);
      };
      const readmeRaw = read(node.readme as Blob, "README.md", MAX_README_CHARS * 2);
      GITHUB_MANIFESTS.forEach((file, j) => {
        const text = read(node[`m${j}`] as Blob, file, MAX_MANIFEST_CHARS);
        if (text !== undefined) {
          // A package.json that is not JSON would poison tech detection; skip it.
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
  }

  return { profile, repos, totalRepos: user.repositories.totalCount, deep, unchanged, queries, rateLimitRemaining };
}
