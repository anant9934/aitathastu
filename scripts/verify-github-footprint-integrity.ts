/**
 * GitHub / digital-footprint integrity, offline: GitHub's API is stubbed, the DB is in-memory PGlite.
 *
 *   DATABASE_URL= PGLITE_IN_MEMORY=true node --import tsx scripts/verify-github-footprint-integrity.ts
 *
 * Covers: pagination beyond the first page, partial-failure reporting,
 * "detected" (not "connected") for a typed username, and CV/GitHub project dedupe.
 */
import { normalizeProjectTitle } from "../lib/text/normalize";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail !== undefined ? `  ${JSON.stringify(detail).slice(0, 300)}` : ""}`);
  if (!ok) failures++;
};

const REPO_COUNT = 250;
const RATE_LIMITED_REPO = "repo-3";
const repos = Array.from({ length: REPO_COUNT }, (_, i) => ({
  id: i, name: i === 0 ? "face-recognition" : `repo-${i}`, full_name: `octo/${i === 0 ? "face-recognition" : `repo-${i}`}`,
  html_url: `https://github.com/octo/${i === 0 ? "face-recognition" : `repo-${i}`}`, description: "demo", fork: false, private: false,
  language: "Python", topics: [], stargazers_count: 0, forks_count: 0, pushed_at: new Date(Date.now() - i * 1000).toISOString(), default_branch: "main",
}));
const requested: string[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  requested.push(url);
  if (url.endsWith("/users/octo")) return json({ id: 1, login: "octo", html_url: "https://github.com/octo", public_repos: REPO_COUNT, created_at: "2020-01-01T00:00:00Z" });
  const page = /\/users\/octo\/repos\?.*page=(\d+)/.exec(url);
  if (page) {
    const n = Number(page[1]);
    const perPage = Number(/per_page=(\d+)/.exec(url)![1]);
    return json(repos.slice((n - 1) * perPage, n * perPage));
  }
  if (url.includes(`/repos/octo/${RATE_LIMITED_REPO}/`)) return new Response("rate limited", { status: 403, headers: { "x-ratelimit-remaining": "0" } });
  if (url.endsWith("/languages")) return json({ Python: 100 });
  return new Response("not found", { status: 404 });
}) as typeof fetch;

async function main() {
  if (process.env.DATABASE_URL) throw new Error("Refusing to run with DATABASE_URL set; in-memory only.");

  check('"Face Recognition System" and "face-recognition" normalize to the same key',
    normalizeProjectTitle("Face Recognition System") === normalizeProjectTitle("face-recognition"),
    [normalizeProjectTitle("Face Recognition System"), normalizeProjectTitle("face-recognition")]);
  check("distinct projects stay distinct", normalizeProjectTitle("Chat Bot") !== normalizeProjectTitle("Chess Bot"));

  const { fetchGitHubIntelligence } = await import("../lib/connectors/github/client");
  const gh = await fetchGitHubIntelligence("octo");
  check(`all ${REPO_COUNT} repos listed across pages (was capped at 60)`, gh.fetchedReposCount === REPO_COUNT, gh.fetchedReposCount);
  check("3 pages of 100 requested", requested.filter((u) => u.includes("/users/octo/repos")).length === 3);
  check("not reported as truncated when everything was listed", gh.truncated === false);
  check(`rate-limited repo reported in failedRepos`, gh.failedRepos.some((f) => f.repo === RATE_LIMITED_REPO && f.reason.includes("rate_limited")), gh.failedRepos);
  check("404 for absent manifest files is not reported as a failure", gh.failedRepos.length === 1, gh.failedRepos);
  check("result flags rateLimited", gh.rateLimited === true);

  const { createUser } = await import("../lib/repositories/user-repository");
  const { DigitalSourceImportOrchestrator } = await import("../lib/services/digital-source-import-orchestrator");
  const { getExternalConnectionByProvider } = await import("../lib/repositories/connection-repository");
  const user = await createUser({ email: "gh.tester@example.test", passwordHash: "x", displayName: "GH" });
  const imported = await DigitalSourceImportOrchestrator.startImport({ personId: user.personId, provider: "github", identifier: "octo", consent: true });
  const conn = await getExternalConnectionByProvider(user.personId, "github");
  check('typed username stored as "detected", not "connected"', conn?.status === "detected" && imported.connectionStatus === "detected", conn?.status);
  check("partial import surfaced in result and summary", imported.partial === true && /Partial data: 1 repo/.test(imported.summary), imported.summary);

  const { saveProject, getProjectsByPersonId } = await import("../lib/repositories/project-repository");
  await saveProject(user.personId, { title: "Face Recognition System", sources: ["resume"], status: "candidate" });
  await saveProject(user.personId, { title: "face-recognition", sources: ["github"], repositoryUrl: "https://github.com/octo/face-recognition", status: "candidate" });
  await saveProject(user.personId, { title: "Totally Different", sources: ["github"], repositoryUrl: "https://github.com/octo/face-recognition.git", status: "candidate" });
  const projects = await getProjectsByPersonId(user.personId);
  check("CV project and GitHub repo merged into one project (by title, then by repo URL)", projects.length === 1, projects.map((p) => p.title));
  check("merged project keeps both sources", JSON.stringify(projects[0]?.sources) === JSON.stringify(["resume", "github"]), projects[0]?.sources);

  // Concurrent imports of the same project: the unique index makes one lose and merge.
  await Promise.all([1, 2, 3].map(() => saveProject(user.personId, { title: "Race Project", sources: ["github"] })));
  const race = (await getProjectsByPersonId(user.personId)).filter((p) => p.title === "Race Project");
  check("3 concurrent saves of one project create a single row", race.length === 1, race.length);

  console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
