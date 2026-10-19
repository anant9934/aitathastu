import { listGitHubInstallationRepositories, type InstallationRepository } from "@/lib/connectors/github/app-auth";
import { GITHUB_MANIFESTS, type DeepRepoData } from "@/lib/connectors/github/graphql";
import { sanitizeTextForPrompt } from "@/lib/intelligence/prompt-defense";

const API = "https://api.github.com";
const UA = "AI-Tathastu-Private-GitHub-Access";

async function graphQL(token: string, query: string) {
  const response = await fetch(`${API}/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub private repository query failed (${response.status}).`);
  const body = await response.json() as { data?: Record<string, any>; errors?: { message: string; path?: (string | number)[] }[] };
  if (!body.data && body.errors?.length) throw new Error(body.errors[0].message.slice(0, 160));
  return body;
}

function queryFor(repos: InstallationRepository[]) {
  return `query {
    ${repos.map((repo, i) => {
      const [owner, name] = repo.full_name.split("/");
      const blob = (alias: string, path: string) => `${alias}: object(expression: ${JSON.stringify(`HEAD:${path}`)}) { ... on Blob { text isBinary } }`;
      return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
        ${blob("readme", "README.md")}
        ${GITHUB_MANIFESTS.map((path, j) => blob(`m${j}`, path)).join("\n")}
      }`;
    }).join("\n")}
  }`;
}

export type PrivateInstallationAcquisition = {
  repos: InstallationRepository[];
  deep: Map<string, DeepRepoData>;
  queries: number;
  failedRepos: { repo: string; reason: string }[];
};

/**
 * Enumerates only repositories the owner explicitly selected during GitHub App
 * installation. Reads metadata/content; it has no write permission.
 */
export async function acquireSelectedInstallationRepositories(token: string): Promise<PrivateInstallationAcquisition> {
  const repos = await listGitHubInstallationRepositories(token);
  const deep = new Map<string, DeepRepoData>();
  const failedRepos: { repo: string; reason: string }[] = [];
  let queries = 0;

  // Keep query complexity bounded; installation repository enumeration is paginated.
  for (let start = 0; start < repos.length; start += 20) {
    const chunk = repos.slice(start, start + 20);
    try {
      const body = await graphQL(token, queryFor(chunk));
      queries++;
      for (const err of body.errors || []) {
        const alias = typeof err.path?.[0] === "string" ? err.path[0] : "";
        const index = Number(alias.replace(/^r/, ""));
        if (alias.startsWith("r") && Number.isInteger(index) && chunk[index]) {
          failedRepos.push({ repo: chunk[index].full_name, reason: err.message.slice(0, 120) });
        }
      }
      chunk.forEach((repo, i) => {
        const node = body.data?.[`r${i}`];
        if (!node) {
          deep.set(repo.full_name, { languages: {}, manifests: {}, observedFiles: [], failure: "repository_unavailable_or_permission_denied" });
          return;
        }
        const languages: Record<string, number> = {};
        for (const edge of node.languages?.edges || []) languages[edge.node.name] = edge.size;
        const manifests: Record<string, string> = {};
        const observedFiles: string[] = [];
        const read = (blob: any, path: string, limit: number) => {
          if (!blob || blob.isBinary || typeof blob.text !== "string") return;
          observedFiles.push(path);
          return blob.text.slice(0, limit);
        };
        const readme = read(node.readme, "README.md", 8000);
        GITHUB_MANIFESTS.forEach((path, j) => {
          const value = read(node[`m${j}`], path, 8000);
          if (value !== undefined) manifests[path] = value;
        });
        deep.set(repo.full_name, { readme: readme ? sanitizeTextForPrompt(readme).slice(0, 4000) : undefined, languages, manifests, observedFiles });
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 140) : "private_repository_query_failed";
      for (const repo of chunk) {
        deep.set(repo.full_name, { languages: {}, manifests: {}, observedFiles: [], failure: reason });
        failedRepos.push({ repo: repo.full_name, reason });
      }
    }
  }

  return { repos, deep, queries, failedRepos };
}
