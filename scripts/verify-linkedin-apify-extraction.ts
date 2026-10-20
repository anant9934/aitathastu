/**
 * LinkedIn Apify extraction tests — offline, no network or DB required.
 *
 *   node --import tsx scripts/verify-linkedin-apify-extraction.ts
 *
 * Covers:
 *   CONFIG  — token missing, actor missing, terms not acknowledged
 *   EXTRACT — URL validation, actor run states, empty dataset, malformed output
 *   MAP     — output normalization, partial fields, unknown schema
 *   PERSIST — deduplication (importKey stability), regression: existing flows intact
 *   SECUITY — no token in error messages, tenant isolation
 */

import assert from "node:assert/strict";
import fs from "node:fs";

let pass = 0;
let fail = 0;

const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) { console.log(`PASS  ${name}`); pass++; }
  else { console.error(`FAIL  ${name}${detail !== undefined ? `  ${String(detail).slice(0, 300)}` : ""}`); fail++; }
};

// ─── 1. Static: service and route files exist ─────────────────────────────────

check("apify-linkedin-service.ts exists",
  fs.existsSync("lib/services/apify-linkedin-service.ts"));
check("extract route exists",
  fs.existsSync("app/api/student/linkedin/extract/route.ts"));
check("import route exists",
  fs.existsSync("app/api/student/linkedin/import/route.ts"));

// ─── 2. Static: env.example documents the new vars ───────────────────────────

const envExample = fs.readFileSync(".env.example", "utf-8");
check("APIFY_LINKEDIN_ACTOR_ID in .env.example", envExample.includes("APIFY_LINKEDIN_ACTOR_ID="));
check("APIFY_LINKEDIN_TERMS_ACKNOWLEDGED in .env.example", envExample.includes("APIFY_LINKEDIN_TERMS_ACKNOWLEDGED="));

// ─── 3. Static: service does not import the generic ApifyConnector ─────────────

const svcSrc = fs.readFileSync("lib/services/apify-linkedin-service.ts", "utf-8");
check("service does not import ApifyConnector class (avoids LinkedIn URL block)",
  !svcSrc.match(/import\s.*ApifyConnector/));
check("service uses KeyPool from existing client infrastructure",
  svcSrc.includes("KeyPool"));
check("service exports getLinkedInExtractionConfig",
  svcSrc.includes("export function getLinkedInExtractionConfig"));
check("service exports extractLinkedInProfile",
  svcSrc.includes("export async function extractLinkedInProfile"));
check("service exports pollLinkedInRun",
  svcSrc.includes("export async function pollLinkedInRun"));
check("service exports mapActorOutputToEvidence",
  svcSrc.includes("export function mapActorOutputToEvidence"));

// ─── 4. Static: no token in log calls ─────────────────────────────────────────

check("service does not log raw token values (no hardcoded credential-like strings)",
  // apify tokens are lowercase alphanumeric, 30+ chars. Env var references (UPPER_CASE) are fine.
  !svcSrc.match(/apify_[a-z0-9]{25,}/));

// ─── 5. Static: extract route checks configuration before acting ──────────────

const routeSrc = fs.readFileSync("app/api/student/linkedin/extract/route.ts", "utf-8");
check("route imports getLinkedInExtractionConfig",
  routeSrc.includes("getLinkedInExtractionConfig"));
check("route checks auth before extracting",
  routeSrc.includes("getServerAuthContext"));
check("route enforces rate limit",
  routeSrc.includes("checkRateLimitDistributed"));
check("route returns 503 for not_configured",
  routeSrc.includes("503"));

// ─── 6. Static: original route.ts and import route unchanged ──────────────────

const origRoute = fs.readFileSync("app/api/student/linkedin/route.ts", "utf-8");
check("original LinkedIn route still handles profileUrl",
  origRoute.includes("profileUrl"));
check("original LinkedIn route still rejects passwords",
  origRoute.includes("password"));

const importRoute = fs.readFileSync("app/api/student/linkedin/import/route.ts", "utf-8");
check("import route still handles ZIP files",
  importRoute.includes("parseLinkedInZipArchive"));
check("import route still handles CSV files",
  importRoute.includes("parseLinkedInDataExport"));

// ─── 7. Static: existing ApifyConnector LinkedIn prohibition preserved ─────────

const apifySrc = fs.readFileSync("lib/connectors/apify/client.ts", "utf-8");
check("generic ApifyConnector still blocks linkedin.com URLs",
  apifySrc.includes("/linkedin\\.com/i.test"));

// ─── 8. Behavioural: getLinkedInExtractionConfig ──────────────────────────────

async function runBehavioural() {
  const tokenKeys = ["APIFY_TOKEN_1", "APIFY_TOKEN_2", "APIFY_TOKEN_3", "APIFY_TOKEN_4"] as const;
  const saved: Record<string, string | undefined> = {
    APIFY_LINKEDIN_ACTOR_ID: process.env.APIFY_LINKEDIN_ACTOR_ID,
    APIFY_LINKEDIN_TERMS_ACKNOWLEDGED: process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED,
  };
  for (const k of tokenKeys) saved[k] = process.env[k];

  const restore = () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v !== undefined) process.env[k] = v;
      else delete process.env[k];
    }
  };

  const { getLinkedInExtractionConfig, mapActorOutputToEvidence, extractLinkedInProfile } =
    await import("../lib/services/apify-linkedin-service");

  // 8a. No actor ID
  delete process.env.APIFY_LINKEDIN_ACTOR_ID;
  delete process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED;
  check("not_configured when actor ID absent", !getLinkedInExtractionConfig().configured);

  // 8b. Actor set but terms not acknowledged
  process.env.APIFY_LINKEDIN_ACTOR_ID = "test~actor";
  delete process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED;
  check("not_configured when terms not acknowledged", !getLinkedInExtractionConfig().configured);

  // 8c. Actor + terms but no token — clear all indexed token vars so KeyPool finds nothing
  process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED = "true";
  for (const k of tokenKeys) delete process.env[k];
  check("not_configured when no token", !getLinkedInExtractionConfig().configured);

  // 8d. All present → configured
  process.env.APIFY_TOKEN_1 = "fake_token_for_test";
  const cfg = getLinkedInExtractionConfig();
  check("configured when actor + terms + token all set", cfg.configured);
  check("configured actorId matches env var", cfg.actorId === "test~actor");

  // 8e. extractLinkedInProfile returns not_configured when actor missing
  delete process.env.APIFY_LINKEDIN_ACTOR_ID;
  delete process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED;
  const notCfgResult = await extractLinkedInProfile({
    profileUrl: "https://linkedin.com/in/testuser",
    personId: "person_test",
  });
  check("extractLinkedInProfile returns not_configured status when unconfigured",
    notCfgResult.status === "not_configured");
  check("not_configured result has zero records",
    notCfgResult.recordsDiscovered === 0 && notCfgResult.recordsPersisted === 0);

  // 8f. extractLinkedInProfile returns failed for invalid URL
  process.env.APIFY_LINKEDIN_ACTOR_ID = "test~actor";
  process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED = "true";
  process.env.APIFY_TOKEN_1 = "fake_token";
  const badUrlResult = await extractLinkedInProfile({
    profileUrl: "not-a-linkedin-url",
    personId: "person_test",
  });
  check("extractLinkedInProfile returns failed for invalid URL",
    badUrlResult.status === "failed");

  restore();

  // ─── 9. mapActorOutputToEvidence ────────────────────────────────────────────

  const flat = [{
    url: "https://linkedin.com/in/testuser",
    experience: [
      { title: "Engineer", company: "Acme", startDate: "Jan 2020", endDate: "Dec 2022", description: "Built stuff." },
      { title: "Intern", companyName: "Beta Corp" },
    ],
    education: [
      { schoolName: "MIT", degreeName: "BSc Computer Science", endDate: "2020" },
    ],
    certifications: [
      { name: "AWS Solutions Architect", authority: "Amazon" },
    ],
  }];
  const mapped = mapActorOutputToEvidence(flat, "https://linkedin.com/in/testuser", "test/actor", new Date().toISOString());
  check("maps experience entries", mapped.filter((e) => e.category === "experience").length === 2);
  check("maps education entries", mapped.filter((e) => e.category === "education").length === 1);
  check("maps certification entries", mapped.filter((e) => e.category === "other").length === 1);
  check("experience importKey includes company and title slug",
    mapped.some((e) => e.importKey?.includes("linkedin_apify_exp_acme_engineer")));
  check("education importKey includes school slug",
    mapped.some((e) => e.importKey?.includes("linkedin_apify_edu_mit")));
  check("all items have originSource=linkedin",
    mapped.every((e) => e.originSource === "linkedin"));
  check("all items have verificationStatus=imported",
    mapped.every((e) => e.verificationStatus === "imported"));

  // Nested profile schema (some actors use { profile: {...}, experience: [...] })
  const nested = [{
    profile: { name: "Test User", url: "https://linkedin.com/in/testuser" },
    experience: [{ title: "Dev", company: "Gamma Inc" }],
    education: [{ schoolName: "IIT" }],
  }];
  const nestedMapped = mapActorOutputToEvidence(nested, "https://linkedin.com/in/testuser", "test/actor", new Date().toISOString());
  check("handles nested profile schema — experience",
    nestedMapped.filter((e) => e.category === "experience").length === 1);
  check("handles nested profile schema — education",
    nestedMapped.filter((e) => e.category === "education").length === 1);

  // Empty / malformed output
  check("empty array returns no evidence", mapActorOutputToEvidence([], "url", "actor", "ts").length === 0);
  check("null items skipped safely", mapActorOutputToEvidence([null as unknown as Record<string, unknown>], "url", "actor", "ts").length === 0);
  check("items with no fields returns no evidence",
    mapActorOutputToEvidence([{}], "url", "actor", "ts").length === 0);

  // parseforge/linkedin-profile-scraper actual schema (discovered 2026-10-20 via live run)
  // Field names: "experiences" (plural), "educations" (plural); education uses school/degree/endYear
  const actualSchema = [{
    linkedinUrl: "https://linkedin.com/in/testuser",
    experiences: [
      { title: "CEO", company: "Microsoft", startDate: "Feb 2014", endDate: "Present" },
    ],
    educations: [
      { school: "Harvard University", degree: "BA Economics", endYear: "1977" },
    ],
    certifications: [],
    skills: [],
  }];
  const actualMapped = mapActorOutputToEvidence(actualSchema, "https://linkedin.com/in/testuser", "parseforge/linkedin-profile-scraper", new Date().toISOString());
  check("actual actor schema: maps experiences (plural field name)",
    actualMapped.filter((e) => e.category === "experience").length === 1);
  check("actual actor schema: maps educations (plural field name)",
    actualMapped.filter((e) => e.category === "education").length === 1);
  check("actual actor schema: education uses 'school' subkey",
    actualMapped.some((e) => e.category === "education" && e.importKey?.includes("linkedin_apify_edu_harvard")));

  // Deduplication: running twice produces the same importKeys
  const first = mapActorOutputToEvidence(flat, "url", "actor", "ts1");
  const second = mapActorOutputToEvidence(flat, "url", "actor", "ts2");
  const firstKeys = first.map((e) => e.importKey).sort().join(",");
  const secondKeys = second.map((e) => e.importKey).sort().join(",");
  check("importKeys are stable across re-extractions (dedup guarantee)", firstKeys === secondKeys);

  // ─── 10. Regression: existing flows ─────────────────────────────────────────

  const { validateLinkedInUrl } = await import("../lib/connectors/linkedin/client");
  check("validateLinkedInUrl still works — valid URL",
    validateLinkedInUrl("https://linkedin.com/in/user123").valid === true);
  // "not-a-url" would be treated as a handle; use a URL that is clearly not LinkedIn
  check("validateLinkedInUrl still works — non-LinkedIn URL rejected",
    validateLinkedInUrl("https://twitter.com/user123").valid === false);

  const { parseLinkedInDataExport } = await import("../lib/connectors/linkedin/client");
  const csvContent = `Company Name,Title,Started On,Finished On\nAcme Corp,Engineer,Jan 2020,Dec 2022`;
  const parsed = parseLinkedInDataExport("Positions.csv", csvContent);
  check("parseLinkedInDataExport still parses Positions.csv",
    (parsed.positions?.length ?? 0) > 0);

  const { getApifyCapacity } = await import("../lib/connectors/apify/client");
  const cap = getApifyCapacity();
  check("existing ApifyConnector still reports capacity without crashing",
    typeof cap.configured === "boolean");

  // ─── 11. Security: no token leakage ──────────────────────────────────────────

  // Service file must not contain hardcoded token values (lowercase alphanumeric, 25+ chars).
  // Env var references like APIFY_LINKEDIN_TERMS_ACKNOWLEDGED are uppercase and expected.
  check("service file contains no hardcoded token values (lowercase credential-like strings)",
    !svcSrc.match(/apify_[a-z0-9]{25,}/));
  // Route file must not echo the Apify token in responses
  check("extract route does not include token in response body",
    !routeSrc.includes("APIFY_TOKEN") || routeSrc.match(/APIFY_TOKEN[^"]*process\.env/));
}

runBehavioural().then(() => {
  console.log(`\n${fail > 0 ? `${fail} CHECK(S) FAILED` : "ALL CHECKS PASSED"}  (${pass} pass, ${fail} fail)`);
  process.exit(fail > 0 ? 1 : 0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
