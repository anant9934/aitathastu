/**
 * GitHub repository discovery regression tests, offline.
 * GitHub's GraphQL API is stubbed; the DB is in-memory PGlite.
 *
 *   DATABASE_URL= PGLITE_IN_MEMORY=true node --import tsx scripts/verify-github-repo-discovery.ts
 *
 * Covers:
 *   1. METADATA_QUERY no longer contains `privacy: PUBLIC` (fix 2)
 *   2. useFootprintConnectors has auto-import-after-OAuth logic (fix 1)
 *   3. ProjectsStep has Restore + hidden-section logic (fix 3)
 *   4. GraphQL pagination: 150 repos across 2 pages — all discovered, no duplicates
 *   5. Private repos are NOT filtered out when the token can see them
 *   6. Repository IDs are unique across pages (no off-by-one duplication)
 */
import fs from "node:fs";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail !== undefined ? `  ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  if (!ok) failures++;
};

// ---------------------------------------------------------------------------
// 1. Static: privacy: PUBLIC must be gone from METADATA_QUERY
// ---------------------------------------------------------------------------
const graphqlSrc = fs.readFileSync("lib/connectors/github/graphql.ts", "utf-8");
check(
  "METADATA_QUERY does not contain privacy: PUBLIC filter",
  !graphqlSrc.includes("privacy: PUBLIC"),
);
check(
  "METADATA_QUERY still contains ownerAffiliations (OWNER, COLLABORATOR)",
  graphqlSrc.includes("ownerAffiliations: [OWNER, COLLABORATOR]"),
);
check(
  "METADATA_QUERY still paginates with hasNextPage and endCursor",
  graphqlSrc.includes("hasNextPage") && graphqlSrc.includes("endCursor"),
);

// ---------------------------------------------------------------------------
// 2. Static: auto-import-after-OAuth logic in useFootprintConnectors
// ---------------------------------------------------------------------------
const hookSrc = fs.readFileSync("lib/client/onboarding/use-footprint-connectors.ts", "utf-8");
check(
  "hook reads success=github_connected on mount",
  hookSrc.includes("github_connected"),
);
check(
  "hook uses a ref to guard single-fire auto-import",
  hookSrc.includes("autoImportGitHubRef"),
);
check(
  "hook captures importFrom via ref to avoid TDZ",
  hookSrc.includes("importFromRef"),
);
check(
  "hook auto-import effect depends only on profiles (not importFrom)",
  /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*autoImportGitHubRef/.test(hookSrc) ||
    hookSrc.includes("importFrom intentionally excluded"),
);
check(
  "hook cleans up the success URL param after triggering import",
  hookSrc.includes("url.searchParams.delete") && hookSrc.includes("replaceState"),
);

// ---------------------------------------------------------------------------
// 3. Static: ProjectsStep has Restore + hidden-items section
// ---------------------------------------------------------------------------
const stepSrc = fs.readFileSync("components/onboarding/steps/ProjectsStep.tsx", "utf-8");
check(
  "ProjectsStep has restore() function for removed/rejected items",
  stepSrc.includes("const restore") && stepSrc.includes("status: \"candidate\""),
);
check(
  "ProjectsStep renders a hidden section for removed/rejected items",
  stepSrc.includes("showHidden") && stepSrc.includes("hidden.length"),
);
check(
  "ProjectsStep renders a Restore button",
  stepSrc.includes(">Restore</Button>"),
);
check(
  "ProjectsStep shows search input for large lists",
  stepSrc.includes("MagnifyingGlass") && stepSrc.includes("active.length > 4"),
);

// ---------------------------------------------------------------------------
// 4 & 5 & 6. Behavioural: GraphQL pagination + private repos
// ---------------------------------------------------------------------------

const TOTAL_REPOS = 150;
const PAGE_SIZE = 100;
// Half the repos are private — these were previously invisible due to privacy: PUBLIC
const makeRepo = (i: number) => ({
  databaseId: i,
  name: `repo-${i}`,
  nameWithOwner: `octo/repo-${i}`,
  description: "demo",
  url: `https://github.com/octo/repo-${i}`,
  homepageUrl: null,
  stargazerCount: 0,
  forkCount: 0,
  isFork: false,
  isPrivate: i % 2 === 0, // even-numbered repos are private
  isArchived: false,
  isTemplate: false,
  isEmpty: false,
  diskUsage: 1,
  pushedAt: new Date(Date.now() - i * 1000).toISOString(),
  createdAt: "2021-01-01T00:00:00Z",
  updatedAt: "2023-01-01T00:00:00Z",
  defaultBranchRef: { name: "main" },
  primaryLanguage: { name: "TypeScript" },
  licenseInfo: null,
  repositoryTopics: { nodes: [] },
});

const allRepos = Array.from({ length: TOTAL_REPOS }, (_, i) => makeRepo(i));
const CURSOR_PAGE1 = "cursor_after_100";

const graphqlJson = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const profileFields = {
  databaseId: 1,
  login: "octo",
  name: "Octo User",
  bio: null,
  websiteUrl: null,
  location: null,
  company: null,
  url: "https://github.com/octo",
  avatarUrl: "https://avatars.githubusercontent.com/octo",
  createdAt: "2020-01-01T00:00:00Z",
  followers: { totalCount: 10 },
  following: { totalCount: 5 },
};

let graphqlCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

  if (url === "https://api.github.com/graphql") {
    graphqlCalls++;
    const body = JSON.parse((init?.body as string) || "{}");
    const after: string | null = body.variables?.after ?? null;

    if (after === null) {
      // Page 1: repos 0..99
      return graphqlJson({
        data: {
          rateLimit: { remaining: 4990, resetAt: "2099-01-01T00:00:00Z", cost: 1 },
          user: {
            ...profileFields,
            repositories: {
              totalCount: TOTAL_REPOS,
              pageInfo: { hasNextPage: true, endCursor: CURSOR_PAGE1 },
              nodes: allRepos.slice(0, PAGE_SIZE),
            },
          },
        },
      });
    }

    if (after === CURSOR_PAGE1) {
      // Page 2: repos 100..149
      return graphqlJson({
        data: {
          rateLimit: { remaining: 4989, resetAt: "2099-01-01T00:00:00Z", cost: 1 },
          user: {
            ...profileFields,
            repositories: {
              totalCount: TOTAL_REPOS,
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: allRepos.slice(PAGE_SIZE),
            },
          },
        },
      });
    }

    // Deep-inspection query (no user field): return empty data
    return graphqlJson({ data: { rateLimit: { remaining: 4988, resetAt: "2099-01-01T00:00:00Z", cost: 1 } } });
  }

  return new Response("not found", { status: 404 });
}) as typeof fetch;

async function main() {
  if (process.env.DATABASE_URL) throw new Error("Refusing to run with DATABASE_URL set; in-memory only.");

  const { acquireGitHubViaGraphQL } = await import("../lib/connectors/github/graphql");

  graphqlCalls = 0;
  const result = await acquireGitHubViaGraphQL({
    login: "octo",
    token: "ghs_test_token_for_unit_test",
    maxDeep: 0, // skip deep inspection; we only want to test discovery
  });

  check(
    `all ${TOTAL_REPOS} repositories discovered across 2 pages`,
    result.repos.length === TOTAL_REPOS,
    { discovered: result.repos.length, expected: TOTAL_REPOS },
  );

  check(
    "2 GraphQL metadata page requests were made",
    graphqlCalls === 2,
    { graphqlCalls },
  );

  const ids = result.repos.map((r) => r.id);
  const uniqueIds = new Set(ids);
  check(
    "no duplicate repository IDs across pages",
    uniqueIds.size === ids.length,
    { total: ids.length, unique: uniqueIds.size },
  );

  const expectedIds = new Set(Array.from({ length: TOTAL_REPOS }, (_, i) => i));
  const missing = [...expectedIds].filter((id) => !uniqueIds.has(id));
  check(
    "no repository IDs missing from the paginated result",
    missing.length === 0,
    { missing: missing.slice(0, 10) },
  );

  const privateCount = result.repos.filter((r) => r.private).length;
  const expectedPrivateCount = allRepos.filter((r) => r.isPrivate).length;
  check(
    `private repositories not filtered out (${expectedPrivateCount} expected)`,
    privateCount === expectedPrivateCount,
    { privateCount, expectedPrivateCount },
  );

  const publicCount = result.repos.filter((r) => !r.private).length;
  const expectedPublicCount = allRepos.filter((r) => !r.isPrivate).length;
  check(
    `public repositories all present (${expectedPublicCount} expected)`,
    publicCount === expectedPublicCount,
    { publicCount, expectedPublicCount },
  );

  check(
    "first page repos are ids 0..99 (correct ordering, no off-by-one)",
    result.repos[0]?.id === 0 && result.repos[PAGE_SIZE - 1]?.id === PAGE_SIZE - 1,
    { first: result.repos[0]?.id, hundredth: result.repos[PAGE_SIZE - 1]?.id },
  );

  check(
    "second page repos are ids 100..149 (no duplication at page boundary)",
    result.repos[PAGE_SIZE]?.id === PAGE_SIZE && result.repos[TOTAL_REPOS - 1]?.id === TOTAL_REPOS - 1,
    { pageStart: result.repos[PAGE_SIZE]?.id, last: result.repos[TOTAL_REPOS - 1]?.id },
  );

  check(
    "result.totalRepos matches the totalCount reported by the API",
    result.totalRepos === TOTAL_REPOS,
    { totalRepos: result.totalRepos },
  );

  console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
