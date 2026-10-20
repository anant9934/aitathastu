/**
 * Canonical origin and GitHub connect hop — offline, no network, no database.
 *
 *   node --import tsx --test scripts/verify-canonical-origin.ts
 *
 * Regression for the production bug where APP_BASE_URL still pointed at
 * https://tathastuai.vercel.app (a deployment that no longer exists), sending
 * "Connect GitHub" and Google sign-in to 404 DEPLOYMENT_NOT_FOUND.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { resolveCanonicalOrigin, parseOrigin } from "../lib/auth/origin";

const STALE = "https://tathastuai.vercel.app";
const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });
const prod = (extra: Record<string, string | undefined>) => ({ NODE_ENV: "production", VERCEL_ENV: "production", ...extra }) as NodeJS.ProcessEnv;

test("production uses APP_BASE_URL when it is this project's production domain (www and apex are the same site)", () => {
  assert.deepEqual(resolveCanonicalOrigin(prod({ APP_BASE_URL: "https://aitathastu.com", VERCEL_PROJECT_PRODUCTION_URL: "aitathastu.com" })), { origin: "https://aitathastu.com", source: "APP_BASE_URL" });
  assert.deepEqual(resolveCanonicalOrigin(prod({ APP_BASE_URL: "https://www.aitathastu.com/", VERCEL_PROJECT_PRODUCTION_URL: "aitathastu.com" })), { origin: "https://www.aitathastu.com", source: "APP_BASE_URL" }, "a www APP_BASE_URL (matching a registered www callback) is kept");
});

test("a stale APP_BASE_URL can never send production to the old deployment", () => {
  const r = resolveCanonicalOrigin(prod({ APP_BASE_URL: STALE, VERCEL_PROJECT_PRODUCTION_URL: "aitathastu.com" }));
  assert.equal(r.origin, "https://aitathastu.com");
  assert.equal(r.source, "VERCEL_PROJECT_PRODUCTION_URL");
  assert.match(r.problem!, /tathastuai\.vercel\.app/);
  assert.match(r.problem!, /Set APP_BASE_URL=https:\/\/aitathastu\.com/, "the diagnostic names the exact fix");
});

test("missing or malformed APP_BASE_URL fails safely with an actionable diagnostic", () => {
  for (const bad of ["http://aitathastu.com", "https://aitathastu.com/onboarding", "not a url", "https://user:pw@aitathastu.com"]) {
    const r = resolveCanonicalOrigin(prod({ APP_BASE_URL: bad, VERCEL_PROJECT_PRODUCTION_URL: "aitathastu.com" }));
    assert.equal(r.origin, "https://aitathastu.com", bad);
    assert.match(r.problem!, /not a valid https origin/, bad);
  }
  assert.match(resolveCanonicalOrigin(prod({ APP_BASE_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: "aitathastu.com" })).problem!, /missing/);
  assert.throws(() => resolveCanonicalOrigin({ NODE_ENV: "production" } as NodeJS.ProcessEnv), /APP_BASE_URL must be set in production/);
  assert.throws(() => resolveCanonicalOrigin({ NODE_ENV: "production", APP_BASE_URL: "http://x.example/path" } as NodeJS.ProcessEnv), /must be an https origin/);
});

test("request headers never choose the production origin", () => {
  const r = resolveCanonicalOrigin(prod({ APP_BASE_URL: "https://aitathastu.com", VERCEL_PROJECT_PRODUCTION_URL: "aitathastu.com" }), req("https://evil.example/x", { host: "evil.example", "x-forwarded-host": "evil.example" }));
  assert.equal(r.origin, "https://aitathastu.com");
  assert.equal(parseOrigin("evil.example/redirect", { requireHttps: true }), null);
});

test("preview and local development keep working", () => {
  // A preview deployment is NODE_ENV=production but not VERCEL_ENV=production: APP_BASE_URL is used as configured.
  assert.equal(resolveCanonicalOrigin({ NODE_ENV: "production", VERCEL_ENV: "preview", APP_BASE_URL: "https://www.aitathastu.com", VERCEL_PROJECT_PRODUCTION_URL: "aitathastu.com" } as NodeJS.ProcessEnv).origin, "https://www.aitathastu.com");
  const dev = { NODE_ENV: "development", APP_BASE_URL: STALE } as NodeJS.ProcessEnv;
  assert.equal(resolveCanonicalOrigin(dev, req("http://localhost:3000/x", { host: "localhost:3000" })).origin, "http://localhost:3000", "a developer's OAuth stays local");
  assert.equal(resolveCanonicalOrigin(dev, req("http://evil.example/x", { host: "evil.example" })).origin, STALE, "a non-loopback host is never trusted, even in development");
});

async function connect(url: string) {
  const { GET } = await import("../app/api/auth/github/connect/route");
  const location = (await GET(req(url, { host: new URL(url).host }))).headers.get("location")!;
  assert.ok(location.startsWith("/") && !location.startsWith("//"), `the hop is relative, so the browser stays on its own host: ${location}`);
  return new URL(location, url); // what the browser does
}

test("Connect GitHub stays on the student's host with the stale value still configured; returnTo and then=app survive", async () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "production", VERCEL_ENV: "production", APP_BASE_URL: STALE, VERCEL_PROJECT_PRODUCTION_URL: "aitathastu.com", GITHUB_CLIENT_ID: "test-client" });
    const next = await connect("https://www.aitathastu.com/api/auth/github/connect?returnTo=%2Fonboarding");
    assert.equal(next.host, "www.aitathastu.com", "never tathastuai.vercel.app");
    assert.equal(next.pathname, "/api/auth/github/start");
    assert.equal(next.searchParams.get("returnTo"), "/onboarding");
    assert.equal(next.searchParams.get("then"), "app");

    const bad = await connect("https://www.aitathastu.com/api/auth/github/connect?returnTo=https%3A%2F%2Fevil.example");
    assert.equal(bad.searchParams.get("returnTo"), "/student/connections", "an unlisted return path is replaced");
    assert.equal(bad.host, "www.aitathastu.com");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
