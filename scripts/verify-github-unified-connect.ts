/**
 * Unified GitHub connect — offline. GitHub's API is replaced by a fake fetch;
 * no network, no credentials, no database.
 *
 *   node --import tsx --test scripts/verify-github-unified-connect.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { deriveGitHubState, mergeRepositories, planGitHubImport, type GitHubRepoView } from "../lib/services/github-connect-service";
import type { InstallationRepository } from "../lib/connectors/github/app-auth";

const repo = (id: number, over: Partial<InstallationRepository> = {}): InstallationRepository => ({
  id, name: `r${id}`, full_name: `asha/r${id}`, private: false, description: null, html_url: `https://github.com/asha/r${id}`,
  homepage: null, language: "Python", stargazers_count: 0, forks_count: 0, fork: false, archived: false, default_branch: "main",
  created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", pushed_at: `2025-0${(id % 9) + 1}-01T00:00:00Z`,
  owner: { login: "asha", id: 1 }, ...over,
});

test("repositories from both access paths merge by GitHub's stable ID", () => {
  const merged = mergeRepositories(
    [repo(1), repo(2, { fork: true }), repo(3)],
    [{ installationId: "42", repos: [repo(3), repo(9, { private: true, full_name: "asha/secret" })] }, { installationId: "77", repos: [repo(9, { private: true, full_name: "asha/secret" })] }],
    null,
  );
  assert.deepEqual(merged.map((r) => r.id).sort(), [1, 2, 3, 9]);
  assert.deepEqual(merged.find((r) => r.id === 3)!.access.sort(), ["app_installation", "public"]);
  assert.equal(merged.find((r) => r.id === 9)!.private, true);
  assert.deepEqual(merged.find((r) => r.id === 9)!.installationIds, ["42", "77"], "every installation that grants it is remembered");
  assert.equal(merged.find((r) => r.id === 2)!.selected, false, "forks are not preselected");
  assert.equal(merged.find((r) => r.id === 9)!.selected, true, "repositories granted on GitHub are preselected");
});

test("a saved selection is respected exactly", () => {
  const merged = mergeRepositories([repo(1), repo(3)], [{ installationId: "42", repos: [repo(9, { private: true })] }], new Set([3]));
  assert.deepEqual(merged.filter((r) => r.selected).map((r) => r.id), [3]);
});

test("import plan drops anything GitHub didn't list and routes private repos only through the App", () => {
  const accessible: GitHubRepoView[] = mergeRepositories([repo(1), repo(3)], [{ installationId: "42", repos: [repo(3), repo(9, { private: true })] }], null);
  const { chosen, plan } = planGitHubImport(accessible, [1, 3, 9, 777, 1, -5], true);
  assert.deepEqual([...chosen].sort((a, b) => a - b), [1, 3, 9], "unknown IDs (777) and junk are dropped; duplicates collapse");
  const via = (p: typeof plan) => Object.fromEntries(p.map((i) => [i.id, i.via === "app" ? `app:${i.installationId}` : "account"]));
  assert.deepEqual(via(plan), { 1: "account", 3: "account", 9: "app:42" });

  const noAccount = planGitHubImport(accessible, [1, 3, 9], false).plan;
  assert.deepEqual(via(noAccount), { 3: "app:42", 9: "app:42" }, "without a signed-in account, only App-granted repositories can be imported");
});

test("state comes from persisted records; a sign-in alone is never 'imported'", () => {
  const conn = (status: string, metadata: Record<string, unknown> = {}) => ({ status, metadata }) as never;
  assert.equal(deriveGitHubState({ connection: null, verified: false, jobInFlight: false }), "not_connected");
  assert.equal(deriveGitHubState({ connection: conn("disconnected"), verified: false, jobInFlight: false }), "not_connected");
  assert.equal(deriveGitHubState({ connection: conn("detected"), verified: false, jobInFlight: false }), "not_connected", "a username link is not a connection");
  assert.equal(deriveGitHubState({ connection: conn("connected"), verified: true, jobInFlight: false }), "selecting", "signed in, nothing imported yet");
  assert.equal(deriveGitHubState({ connection: conn("connected", { githubAppApprovalPendingAt: "x" }), verified: true, jobInFlight: false }), "awaiting_approval");
  assert.equal(deriveGitHubState({ connection: conn("connected", { githubUnifiedLastImport: { status: "completed" } }), verified: true, jobInFlight: true }), "importing");
  assert.equal(deriveGitHubState({ connection: conn("connected", { githubUnifiedLastImport: { status: "completed" } }), verified: true, jobInFlight: false }), "imported");
  assert.equal(deriveGitHubState({ connection: conn("connected", { githubUnifiedLastImport: { status: "partial" } }), verified: true, jobInFlight: false }), "partial");
  assert.equal(deriveGitHubState({ connection: conn("connected", { githubUnifiedLastImport: { status: "failed" } }), verified: true, jobInFlight: false }), "needs_attention");
  assert.equal(deriveGitHubState({ connection: conn("connected", { githubAppInstallationId: "42", githubAppRevokedAt: "x" }), verified: false, jobInFlight: false }), "revoked", "every route is gone");
  assert.equal(deriveGitHubState({ connection: conn("connected", { githubAppInstallationId: "42", githubAppRevokedAt: "x", githubUnifiedLastImport: { status: "completed" } }), verified: true, jobInFlight: false }), "imported", "a removed App doesn't hide the still-working public access");
  assert.equal(deriveGitHubState({ connection: conn("connected"), verified: false, jobInFlight: false, accountRevoked: true }), "revoked", "the sign-in was revoked on GitHub");
  assert.equal(deriveGitHubState({ connection: conn("connected", { githubAppInstallationId: "42" }), verified: false, jobInFlight: false }), "selecting", "App-only access still lets the student choose");
});

test("one entry point: sign-in first, then the App; allow-listed return; clear error when unconfigured", async () => {
  const { GET } = await import("../app/api/auth/github/connect/route");
  const saved = { id: process.env.GITHUB_CLIENT_ID, slug: process.env.GITHUB_APP_SLUG, appId: process.env.GITHUB_APP_ID, key: process.env.GITHUB_APP_PRIVATE_KEY };
  const go = async (q: string) => new URL((await GET(new Request(`http://localhost:3000/api/auth/github/connect?${q}`))).headers.get("location")!);
  try {
    process.env.GITHUB_CLIENT_ID = "test-client";
    const a = await go("returnTo=/onboarding");
    assert.equal(a.pathname, "/api/auth/github/start");
    assert.equal(a.searchParams.get("then"), "app");
    assert.equal(a.searchParams.get("returnTo"), "/onboarding");
    assert.equal((await go("returnTo=https://evil.example")).searchParams.get("returnTo"), "/student/connections");

    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_APP_SLUG; delete process.env.GITHUB_APP_ID; delete process.env.GITHUB_APP_PRIVATE_KEY;
    const none = await go("returnTo=/onboarding");
    assert.equal(none.pathname, "/onboarding");
    assert.equal(none.searchParams.get("error"), "github_signin_unavailable");
  } finally {
    for (const [k, v] of Object.entries({ GITHUB_CLIENT_ID: saved.id, GITHUB_APP_SLUG: saved.slug, GITHUB_APP_ID: saved.appId, GITHUB_APP_PRIVATE_KEY: saved.key })) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test("installation import reads only selected repositories and counts only commits GitHub links to the student", async () => {
  const { acquireSelectedInstallationRepositories } = await import("../lib/connectors/github/app-installation-acquisition");
  const queried: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/installation/repositories")) {
      return new Response(JSON.stringify({ total_count: 2, repositories: [repo(9, { private: true, full_name: "asha/secret" }), repo(10, { private: true, full_name: "asha/other" })] }), { status: 200 });
    }
    const q = JSON.parse(String(init?.body)).query as string;
    queried.push(q);
    if (q.includes("user(login:")) return new Response(JSON.stringify({ data: { user: { id: "U_asha" } } }), { status: 200 });
    return new Response(JSON.stringify({
      data: { r0: { languages: { edges: [{ size: 100, node: { name: "Python" } }] }, readme: null,
        defaultBranchRef: { target: { all: { totalCount: 40 }, mine: { totalCount: 12, nodes: [{ committedDate: "2025-06-01T00:00:00Z" }] } } } } },
    }), { status: 200 });
  }) as typeof fetch;
  try {
    const acq = await acquireSelectedInstallationRepositories("tok", { onlyRepoIds: new Set([9]), authorLogin: "asha" });
    assert.deepEqual(acq.repos.map((r) => r.id), [9], "the unselected repository is never read");
    const repoQuery = queried.find((q) => q.includes("r0:"))!;
    assert.ok(repoQuery.includes('"secret"') && !repoQuery.includes('"other"'));
    assert.ok(repoQuery.includes('author: { id: "U_asha" }'), "authorship is filtered by GitHub, not guessed");
    assert.deepEqual(acq.deep.get("asha/secret")?.commitCounts, { total: 40, authored: 12, latestAuthoredAt: "2025-06-01T00:00:00Z" });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("without a known account, commits are counted but none are attributed to the student", async () => {
  const { acquireSelectedInstallationRepositories } = await import("../lib/connectors/github/app-installation-acquisition");
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes("/installation/repositories")) return new Response(JSON.stringify({ total_count: 1, repositories: [repo(9, { private: true })] }), { status: 200 });
    return new Response(JSON.stringify({ data: { r0: { languages: { edges: [] }, defaultBranchRef: { target: { all: { totalCount: 7 } } } } } }), { status: 200 });
  }) as typeof fetch;
  try {
    const acq = await acquireSelectedInstallationRepositories("tok", {});
    assert.deepEqual(acq.deep.get("asha/r9")?.commitCounts, { total: 7, authored: null, latestAuthoredAt: null });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a deleted or suspended installation reads as revoked, not as a configuration error", async () => {
  const { isInstallationRevokedError } = await import("../lib/connectors/github/app-auth");
  assert.equal(isInstallationRevokedError(new Error("GitHub App API request failed (404): Not Found")), true);
  assert.equal(isInstallationRevokedError(new Error("GitHub App API request failed (403): This installation has been suspended")), true);
  assert.equal(isInstallationRevokedError(new Error("GitHub App API request failed (401): A JSON web token could not be decoded")), false);
  assert.equal(isInstallationRevokedError(new Error("GitHub App API request failed (403): rate limit exceeded")), false);
});

test("personal and organisation installations coexist; one never replaces another", async () => {
  const { installationsOf, withInstallation, withInstallationRevoked, activeInstallations } = await import("../lib/connectors/github/installations");
  const legacy = { githubAppInstallationId: "42", githubAppAccountLogin: "asha", githubAppAccountType: "User", githubAppRepositorySelection: "selected" };
  assert.deepEqual(installationsOf(legacy).map((i) => i.id), ["42"], "an installation saved before the list is still recognised");

  let m: Record<string, unknown> = { ...legacy, ...withInstallation(legacy, { id: "77", accountLogin: "acme", accountId: "9", accountType: "Organization", repositorySelection: "selected" }) };
  assert.deepEqual(installationsOf(m).map((i) => i.id).sort(), ["42", "77"]);
  assert.equal(m.githubAppInstallationId, "42", "the legacy field keeps pointing at the personal installation");

  const again = { ...m, ...withInstallation(m, { id: "77", accountLogin: "acme", accountId: "9", accountType: "Organization", repositorySelection: "all" }) };
  assert.equal(installationsOf(again).length, 2, "a repeated callback refreshes, never duplicates");
  assert.equal(installationsOf(again).find((i) => i.id === "77")!.repositorySelection, "all");

  m = { ...m, ...withInstallationRevoked(m, "42") };
  assert.deepEqual(activeInstallations(m).map((i) => i.id), ["77"], "revoking the personal installation leaves the organisation one");
  assert.equal(m.githubAppInstallationId, "77");
  assert.equal(m.githubAppRevokedAt, null, "not revoked overall while one installation remains");
  m = { ...m, ...withInstallationRevoked(m, "77") };
  assert.ok(m.githubAppRevokedAt, "revoked overall once every installation is gone");
});

test("commit authorship needs GitHub's own link to the student's account", async () => {
  const { attributeCommit } = await import("../lib/connectors/github/deep-collector");
  const me = { id: 1, login: "asha", name: "Asha Rao", email: "asha@example.com" };
  const c = (over: Partial<Parameters<typeof attributeCommit>[0]>) => attributeCommit({ authorId: null, authorLogin: null, authorType: null, authorName: null, authorEmail: null, committerLogin: null, parentCount: 1, ...over }, me);
  assert.deepEqual(c({ authorId: 1, authorLogin: "asha" }), { isAttributed: true, attributionMethod: "login_match" });
  assert.deepEqual(c({ authorId: 1, authorLogin: "asha-renamed" }), { isAttributed: true, attributionMethod: "login_match" }, "a renamed login is still the same account");
  assert.deepEqual(c({ authorId: 2, authorLogin: "asha" }), { isAttributed: false, attributionMethod: "unattributed" }, "a reused login belonging to another account is not the student");
  assert.deepEqual(c({ authorId: 1, authorLogin: "asha", parentCount: 2 }), { isAttributed: false, attributionMethod: "merge_commit" });
  assert.deepEqual(c({ authorId: 5, authorLogin: "dependabot[bot]", authorType: "Bot" }), { isAttributed: false, attributionMethod: "bot" });
  assert.deepEqual(c({ authorId: 7, authorLogin: "other", committerLogin: "asha" }), { isAttributed: false, attributionMethod: "ambiguous" }, "committing someone else's work is not authoring it");
  assert.deepEqual(c({ authorEmail: "asha@example.com" }), { isAttributed: false, attributionMethod: "ambiguous" }, "an unlinked email can be typed by anyone");
  assert.deepEqual(c({ authorName: "Asha Rao" }), { isAttributed: false, attributionMethod: "ambiguous" }, "a matching display name is not proof");
  assert.deepEqual(c({}), { isAttributed: false, attributionMethod: "unattributed" }, "unknown author information is never credited");
});

test("students see plain failure reasons, never GitHub's raw error text", async () => {
  const { publicReason } = await import("../lib/services/github-import-job");
  assert.equal(publicReason("GitHub App API request failed (401): A JSON web token could not be decoded"), "github_error");
  assert.equal(publicReason("Resource not accessible by integration"), "not_accessible");
  assert.equal(publicReason("API rate limit exceeded for installation"), "rate_limited");
  assert.equal(publicReason("GitHub App API request failed (404): Not Found"), "no_longer_available");
  assert.equal(publicReason("graphql:Something went wrong"), "content_unreadable");
  assert.equal(publicReason("no_longer_available"), "no_longer_available", "our own codes pass through");
});
