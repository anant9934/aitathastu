/**
 * Onboarding flow contracts — offline, no network or DB.
 *
 *   node --import tsx --test scripts/verify-onboarding-flow.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  STUDENT_SCREEN_ORDER, normalizeOnboardingScreen, onboardingStages, onboardingSteps, stepForScreen,
} from "../lib/onboarding-step-registry";
import { nextOnboardingScreen, resumeCoveredScreens } from "../lib/onboarding-resume-coverage";
import { statusFromServer } from "../lib/client/onboarding/use-footprint-connectors";
import { readCookie, safeGitHubReturnPath } from "../lib/auth/github-return";
import { PLATFORMS, PLATFORM_GROUPS } from "../lib/client/onboarding/platforms";
import { safeDraft } from "../lib/onboarding-v2";

test("student flow: 11 steps in 4 stages, sources merged, details after review", () => {
  assert.deepEqual(STUDENT_SCREEN_ORDER, [3, 3.2, 3.5, 5, 5.5, 7, 8, 4, 9, 10, 11]);
  assert.deepEqual(onboardingStages().map((s) => s.id), ["personalize", "build", "refine", "complete"]);
  for (const step of onboardingSteps()) {
    assert.ok(onboardingStages().some((s) => s.id === step.stage), `${step.id} belongs to a known stage`);
  }
  const stageOrder = onboardingSteps().map((s) => onboardingStages().findIndex((st) => st.id === s.stage));
  assert.deepEqual(stageOrder, [...stageOrder].sort((a, b) => a - b), "stages never interleave");
  assert.equal(stepForScreen(2), null);
  assert.deepEqual(
    [stepForScreen(5.5)?.number, stepForScreen(5.5)?.total, stepForScreen(5.5)?.stage.name],
    [5, 11, "Build your profile"],
  );
});

test("faculty flow is unchanged", () => {
  assert.deepEqual(onboardingSteps("faculty").map((s) => s.screen), [3, 3.5, 3.7]);
  assert.equal(stepForScreen(3.7, "faculty")?.stageNumber, 2);
});

test("drafts saved on the retired accounts screen resume on sources, and the server still accepts them", () => {
  assert.equal(normalizeOnboardingScreen(6), 5.5);
  assert.equal(normalizeOnboardingScreen(8), 8);
  assert.equal(stepForScreen(6)?.step.id, "connect_sources");
  assert.equal(safeDraft({ currentScreen: 6 }).currentScreen, 6);
});

test("navigation: CV → sources → import → review → details, skipping what the CV covered", () => {
  assert.equal(nextOnboardingScreen(5, []), 5.5);
  assert.equal(nextOnboardingScreen(5.5, []), 7);
  assert.equal(nextOnboardingScreen(7, []), 8);
  assert.equal(nextOnboardingScreen(8, []), 4);
  assert.equal(nextOnboardingScreen(4, []), 9);
  const covered = resumeCoveredScreens({ skills: { total: 3, accepted: 3 } }, { fullName: "A", institution: "B", degree: "C" });
  assert.deepEqual(covered, [4, 9]);
  assert.equal(nextOnboardingScreen(8, covered), 10, "details and skills both skipped");
  assert.ok(!resumeCoveredScreens({ links: { total: 1, accepted: 1 } }, {}).includes(6), "links no longer skip a screen");
});

test("connector status comes from what the server recorded, never from a timestamp alone", () => {
  const row = (status: string) => ({ provider: "github", status, profileUrl: "https://github.com/x", lastSyncedAt: "2026-10-20T00:00:00Z" });
  assert.equal(statusFromServer(row("reference_only")), "linked");
  assert.equal(statusFromServer(row("detected")), "detected");
  assert.equal(statusFromServer(row("connected")), "connected", "a sync time alone is not an import");
  assert.equal(statusFromServer(row("connected"), { provider: "github", status: "completed", recordsFetched: 0 }), "connected");
  assert.equal(statusFromServer(row("pending"), { provider: "github", status: "completed", recordsFetched: 0 }), "linked");
  assert.equal(statusFromServer(row("connected"), { provider: "github", status: "completed", recordsFetched: 12 }), "imported");
  assert.equal(statusFromServer(row("connected"), { provider: "github", status: "partial", recordsFetched: 4 }), "partial");
  assert.equal(statusFromServer(row("connected"), { provider: "github", status: "failed" }), "failed");
  assert.equal(statusFromServer(row("revoked")), "revoked");
  assert.equal(statusFromServer(row("syncing")), "importing");
  assert.equal(statusFromServer(row("needs_attention")), "failed");
  assert.equal(statusFromServer(row("unavailable")), "linked");
});

test("every source is grouped and says how it connects", () => {
  for (const p of PLATFORMS) {
    assert.ok(PLATFORM_GROUPS.some((g) => g.id === p.group), `${p.id} has a known group`);
    assert.ok(p.method.length > 3, `${p.id} has a connection method`);
  }
});

test("GitHub return paths are allow-listed", () => {
  assert.equal(safeGitHubReturnPath("/onboarding"), "/onboarding");
  for (const bad of ["https://evil.example", "//evil.example", "/onboarding/../admin", "/student", null, undefined, 42]) {
    assert.equal(safeGitHubReturnPath(bad), "/student/connections");
  }
  assert.equal(readCookie("a=1; tathastu_gh_app_return=%2Fonboarding; b=2", "tathastu_gh_app_return"), "/onboarding");
  assert.equal(readCookie("xtathastu_gh_app_return=/onboarding", "tathastu_gh_app_return"), null);
});

test("OAuth callback sends cancel, bad state and state mismatch back to onboarding", async () => {
  const { GET } = await import("../app/api/auth/github/callback/route");
  const state = (returnTo: string) => Buffer.from(JSON.stringify({ state: "s1", personId: "p1", returnTo })).toString("base64url");
  const call = async (query: string, cookie = "") => {
    const res = await GET(new Request(`http://localhost:3000/api/auth/github/callback?${query}`, { headers: cookie ? { cookie } : {} }));
    return new URL(res.headers.get("location") || "");
  };

  const cancelled = await call(`error=access_denied&state=${state("/onboarding")}`);
  assert.equal(cancelled.pathname, "/onboarding");
  assert.equal(cancelled.searchParams.get("error"), "github_cancelled");

  const mismatch = await call(`code=abc&state=${state("/onboarding")}`, "tathastu_gh_oauth_state=other");
  assert.equal(mismatch.pathname, "/onboarding");
  assert.equal(mismatch.searchParams.get("error"), "state_mismatch");

  const forged = await call(`error=access_denied&state=${state("https://evil.example")}`);
  assert.equal(forged.pathname, "/student/connections", "an unlisted returnTo never leaves the allow-list");

  const garbage = await call("code=abc&state=%%%");
  assert.equal(garbage.searchParams.get("error"), "invalid_state");
});

test("browser-test server can never reach Postgres, Neon or Upstash", async () => {
  const { ISOLATED_ENV } = await import("./e2e-isolation");
  assert.equal(ISOLATED_ENV.DATABASE_MODE, "pglite");
  assert.equal(ISOLATED_ENV.PGLITE_IN_MEMORY, "true");
  for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "NEON_BRANCH"]) {
    assert.ok(ISOLATED_ENV[key], `${key} is set (non-empty), so .env cannot refill it`);
  }
  assert.ok(!ISOLATED_ENV.DATABASE_URL.startsWith("postgres"));
  assert.ok(!/neon\.tech|upstash\.io/.test(Object.values(ISOLATED_ENV).join(" ")));
  assert.match(ISOLATED_ENV.UPSTASH_REDIS_REST_URL, /^http:\/\/127\.0\.0\.1:/);
});
