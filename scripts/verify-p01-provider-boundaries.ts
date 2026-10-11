import assert from "node:assert/strict";
import { fetchGitHubIntelligence } from "../lib/connectors/github/client";
import { isSafePublicUrl } from "../lib/connectors/portfolio/client";

async function main() {
  for (const url of [
    "http://example.org",
    "https://localhost",
    "https://localhost.localdomain",
    "https://127.0.0.1",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]",
    "https://user:password@example.org",
    "https://example.org:8443",
  ]) assert.equal(isSafePublicUrl(url).safe, false, `Unsafe portfolio URL accepted: ${url}`);
  assert.equal(isSafePublicUrl("https://example.org/").safe, true);

  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  try {
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      return new Response("", { status: 429 });
    };
    const rateLimited = await fetchGitHubIntelligence("syntheticstudent", { token: "synthetic-test-token" });
    assert.equal(rateLimited.success, false);
    assert.equal(rateLimited.projects.length, 0, "Rate limit fabricated repositories");
    assert.equal(rateLimited.profile, null, "Rate limit fabricated a profile");

    globalThis.fetch = async (input) => {
      requests.push(String(input));
      if (String(input).endsWith("/users/syntheticstudent")) {
        return Response.json({ id: 123, login: "syntheticstudent", public_repos: 1, html_url: "https://github.com/syntheticstudent" });
      }
      return new Response("", { status: 429 });
    };
    const reposRateLimited = await fetchGitHubIntelligence("syntheticstudent", { token: "synthetic-test-token" });
    assert.equal(reposRateLimited.success, false);
    assert.equal(reposRateLimited.projects.length, 0, "Repository rate limit fabricated repositories");
    assert.ok(requests.some((url) => url.includes("/users/syntheticstudent/repos?")), "Authenticated public import called the wrong account endpoint");
    assert.ok(requests.every((url) => !url.includes("/user/repos?")), "Authenticated public import used token owner's repositories");
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log("Provider boundaries passed: unsafe portfolio URLs rejected, GitHub rate limits return no fabricated data, tokenized public import uses the requested account.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
