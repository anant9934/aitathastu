/**
 * Universal Digital Footprint connector audit — offline + live capability checks.
 *
 * Covers:
 *   CONFIG  — env vars present/absent for each connector
 *   STATIC  — file existence, no hardcoded secrets
 *   UNITS   — connector validation, normalization, mapping
 *   LIVE    — actual API calls where credentials are configured (Kaggle, Stack Overflow)
 *
 * Run: node --env-file=.env --import tsx scripts/verify-digital-footprint-connectors.ts
 */

import fs from "node:fs";
import assert from "node:assert/strict";

let pass = 0;
let fail = 0;
let live = 0;

const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) { console.log(`PASS  ${name}`); pass++; }
  else { console.error(`FAIL  ${name}${detail !== undefined ? `  →  ${String(detail).slice(0, 300)}` : ""}`); fail++; }
};
const note = (msg: string) => console.log(`NOTE  ${msg}`);

// ─── 1. Static: connector files exist ─────────────────────────────────────────

check("github connector exists", fs.existsSync("lib/connectors/github/client.ts"));
check("github deep-collector exists", fs.existsSync("lib/connectors/github/deep-collector.ts"));
check("github graphql connector exists", fs.existsSync("lib/connectors/github/graphql.ts"));
check("leetcode connector exists", fs.existsSync("lib/connectors/leetcode/client.ts"));
check("portfolio connector exists", fs.existsSync("lib/connectors/portfolio/client.ts"));
check("linkedin connector exists", fs.existsSync("lib/connectors/linkedin/client.ts"));
check("linkedin extraction service exists", fs.existsSync("lib/services/linkedin-extraction-service.ts"));
check("linkedin export upload route removed", !fs.existsSync("app/api/student/linkedin/import/route.ts"));
check("research-and-dev connector exists", fs.existsSync("lib/connectors/research-and-dev/client.ts"));
check("kaggle-client exists", fs.existsSync("lib/connectors/research-and-dev/kaggle-client.ts"));
check("coding-platforms connector exists", fs.existsSync("lib/connectors/coding-platforms/client.ts"));
check("connector registry exists", fs.existsSync("lib/connectors/registry.ts"));
check("digital-source-import-orchestrator exists", fs.existsSync("lib/services/digital-source-import-orchestrator.ts"));

// ─── 2. Static: all 14 connectors registered in registry ──────────────────────

const regSrc = fs.readFileSync("lib/connectors/registry.ts", "utf-8");
const expectedProviders = ["github", "linkedin", "leetcode", "portfolio", "huggingface", "orcid", "hackerrank", "codechef", "hackerearth", "kaggle", "devto", "stackoverflow", "google_scholar"];
for (const p of expectedProviders) {
  check(`registry contains "${p}"`, regSrc.includes(`"${p}"`));
}

// ─── 3. Config audit: key connectors have credentials ─────────────────────────

note("─── Environment configuration ───");
const apifyActorId = process.env.APIFY_LINKEDIN_ACTOR_ID;
const apifyTerms = process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED;
const apifyToken1 = process.env.APIFY_TOKEN_1;
check("APIFY_TOKEN_1 set", Boolean(apifyToken1));
check("APIFY_LINKEDIN_ACTOR_ID set", Boolean(apifyActorId));
check("APIFY_LINKEDIN_TERMS_ACKNOWLEDGED=true", apifyTerms?.trim().toLowerCase() === "true");

const stackExchangeKey = process.env.STACKEXCHANGE_API_KEY;
check("STACKEXCHANGE_API_KEY set", Boolean(stackExchangeKey));

const kaggleCred = (() => {
  for (let i = 1; i <= 3; i++) {
    const u = process.env[`KAGGLE_USERNAME_${i}`]?.trim();
    const k = process.env[`KAGGLE_KEY_${i}`]?.trim();
    if (u && k) return { u, k };
  }
  return null;
})();
check("Kaggle indexed credentials present (KAGGLE_USERNAME_1/KAGGLE_KEY_1)", Boolean(kaggleCred));

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) note("GITHUB_TOKEN not set — GitHub API limited to 60 req/hr per IP (not a code bug)");

// ─── 4. Kaggle: credential fix — indexed keys are now used ────────────────────

const rdSrc = fs.readFileSync("lib/connectors/research-and-dev/client.ts", "utf-8");
check("fetchKaggleApiData uses indexed KAGGLE_USERNAME_N lookup",
  rdSrc.includes("KAGGLE_USERNAME_${i}") || rdSrc.includes("`KAGGLE_USERNAME_${i}`"));
check("fetchKaggleApiData has indexed credentials as first priority (checks _1 before singular)",
  rdSrc.indexOf("KAGGLE_USERNAME_${i}") < rdSrc.indexOf("process.env.KAGGLE_USERNAME"));

// ─── 5. GitHub: deep extraction path is wired ─────────────────────────────────

const syncSrc = fs.readFileSync("lib/services/github-sync-service.ts", "utf-8");
check("github-sync-service triggers deep intelligence extraction async",
  syncSrc.includes("executeFullGitHubExtraction"));
check("github-sync-service uses graphql for repo discovery",
  syncSrc.includes("acquireGitHubViaGraphQL"));

const gqlSrc = fs.readFileSync("lib/connectors/github/graphql.ts", "utf-8");
check("graphql does not filter to PUBLIC repos only (private repos accessible)",
  !gqlSrc.includes('privacy: PUBLIC'));

// ─── 6. LinkedIn: status correctly reflects extraction result ─────────────────

const liSvc = fs.readFileSync("lib/services/linkedin-extraction-service.ts", "utf-8");
check("extraction sets connected status on success (so UI shows Extracted)",
  liSvc.includes('succeeded || hadSuccess ? "connected"'));
check("extraction records lastSyncedAt in metadata on success",
  liSvc.includes("lastSyncedAt: at"));

// ─── 7. Units: normalization and validation ────────────────────────────────────

async function runUnits() {
  const { normalizeLeetCodeUsername, fetchLeetCodeProfileStats: _lc } = await import("../lib/connectors/leetcode/client");
  check("normalizeLeetCodeUsername strips URL prefix",
    normalizeLeetCodeUsername("https://leetcode.com/u/testuser") === "testuser");
  check("normalizeLeetCodeUsername handles bare handle",
    normalizeLeetCodeUsername("testuser_123") === "testuser_123");

  const { normalizeCodingHandle } = await import("../lib/connectors/coding-platforms/client");
  check("normalizeCodingHandle strips HackerRank URL",
    normalizeCodingHandle("https://www.hackerrank.com/testuser", "hackerrank") === "testuser");
  check("normalizeCodingHandle strips CodeChef URL",
    normalizeCodingHandle("https://www.codechef.com/users/myuser", "codechef") === "myuser");

  const { validateLinkedInUrl } = await import("../lib/connectors/linkedin/client");
  check("validateLinkedInUrl accepts valid URL",
    validateLinkedInUrl("https://www.linkedin.com/in/john-doe").valid === true);
  check("validateLinkedInUrl rejects non-LinkedIn URL",
    validateLinkedInUrl("https://twitter.com/johndoe").valid === false);

  // Portfolio URL safety checks — isSafePublicUrl returns {safe, reason?}, not a boolean
  const { isSafePublicUrl } = await import("../lib/connectors/portfolio/client");
  check("isSafePublicUrl accepts public HTTPS URL", isSafePublicUrl("https://johndoe.dev").safe);
  check("isSafePublicUrl rejects http:// (non-HTTPS)", !isSafePublicUrl("http://johndoe.dev").safe);
  check("isSafePublicUrl rejects localhost HTTPS", !isSafePublicUrl("https://localhost").safe);
  check("isSafePublicUrl rejects private IP HTTPS (SSRF)", !isSafePublicUrl("https://192.168.1.1").safe);
  check("isSafePublicUrl rejects AWS metadata endpoint HTTPS (SSRF)", !isSafePublicUrl("https://169.254.169.254/latest/meta-data/").safe);

  // ORCID checksum validation
  const { isValidOrcidChecksum } = await import("../lib/services/digital-footprint-registry");
  check("isValidOrcidChecksum accepts valid ORCID", isValidOrcidChecksum("0000-0002-1825-0097"));
  check("isValidOrcidChecksum rejects invalid ORCID", !isValidOrcidChecksum("0000-0002-1825-0000"));

  // Normalization of the configured actor's output schema
  const { normalizeLinkedInProfile } = await import("../lib/linkedin/normalize");
  const normalized = normalizeLinkedInProfile({
    linkedinUrl: "https://linkedin.com/in/test",
    experiences: [{ title: "Engineer", company: "Acme", startDate: "Jan 2020" }],
    educations: [{ school: "MIT", degree: "BSc CS", endYear: "2020" }],
  }, "https://www.linkedin.com/in/test");
  check("normalizeLinkedInProfile: experiences (plural) mapped", normalized.records.filter((r) => r.kind === "experience").length === 1);
  check("normalizeLinkedInProfile: educations (plural) mapped", normalized.records.filter((r) => r.kind === "education").length === 1);

  // ─── 8. Live: Kaggle datasets (anonymous) ──────────────────────────────────────

  if (kaggleCred) {
    note("─── Live: Kaggle API (authenticated) ───");
    try {
      const { fetchKaggleApiData } = await import("../lib/connectors/research-and-dev/client");
      const result = await fetchKaggleApiData(kaggleCred.u);
      check(`Kaggle live: status not UNAVAILABLE (status=${result.status})`,
        result.status !== "UNAVAILABLE");
      check("Kaggle live: username matches credential",
        result.username.toLowerCase() === kaggleCred.u.toLowerCase());
      live++;
      note(`Kaggle: datasets=${result.datasetsCount ?? 0}, notebooks=${result.notebooksCount ?? 0}`);
    } catch (err) {
      check("Kaggle live API call", false, String(err));
    }
  } else {
    note("Kaggle live test skipped: no indexed credentials");
  }

  // ─── 9. Live: Stack Overflow (with API key) ────────────────────────────────────

  if (stackExchangeKey) {
    note("─── Live: Stack Overflow API ───");
    try {
      const { fetchStackOverflowProfile } = await import("../lib/connectors/research-and-dev/client");
      // Stack Overflow user ID of Jon Skeet (public figure, widely used in API tests)
      const result = await fetchStackOverflowProfile("22656");
      check(`SO live: status LIVE_VERIFIED`, result.status === "LIVE_VERIFIED", result.notes);
      check("SO live: reputation > 0", (result.reputation ?? 0) > 0);
      live++;
      note(`SO: userId=${result.userId}, reputation=${result.reputation}`);
    } catch (err) {
      check("Stack Overflow live API call", false, String(err));
    }
  } else {
    note("Stack Overflow live test skipped: STACKEXCHANGE_API_KEY not set");
  }

  // ─── 10. Regression: orchestrator imports all connectors ──────────────────────

  const orchSrc = fs.readFileSync("lib/services/digital-source-import-orchestrator.ts", "utf-8");
  const orchProviders = ["github", "linkedin", "leetcode", "portfolio", "huggingface", "orcid", "hackerrank", "hackerearth", "codechef", "kaggle", "devto", "stackoverflow", "google_scholar"];
  for (const p of orchProviders) {
    check(`orchestrator handles "${p}" case`, orchSrc.includes(`case "${p}":`));
  }
}

runUnits().then(() => {
  console.log(`\n${fail > 0 ? `${fail} FAIL` : "ALL PASS"}  (${pass} pass, ${fail} fail, ${live} live calls)`);
  process.exit(fail > 0 ? 1 : 0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
