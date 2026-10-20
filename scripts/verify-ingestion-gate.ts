/**
 * Ingestion gate regression tests, offline — no DB or network needed.
 *
 *   node --import tsx scripts/verify-ingestion-gate.ts
 *
 * Covers:
 *   1. resumeIngestionReady() does NOT require GITHUB_WEBHOOK_SECRET
 *   2. coreIngestionReady() / githubIngestionReady() DOES require GITHUB_WEBHOOK_SECRET
 *   3. Both gates pass in non-production environments regardless of secret state
 *   4. resumeIngestionReady() still requires the core session secrets
 */
import fs from "node:fs";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail !== undefined ? `  ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  if (!ok) failures++;
};

// ---------------------------------------------------------------------------
// 1. Static: gate exports are present with correct names
// ---------------------------------------------------------------------------
const gateSrc = fs.readFileSync("lib/security/core-ingestion-gate.ts", "utf-8");
check("resumeIngestionReady is exported", gateSrc.includes("export function resumeIngestionReady"));
check("githubIngestionReady is exported", gateSrc.includes("export function githubIngestionReady"));
check("coreIngestionReady is still exported (backwards compat)", gateSrc.includes("export function coreIngestionReady"));
check("RESUME_GATE_SECRETS does not include GITHUB_WEBHOOK_SECRET",
  gateSrc.includes("RESUME_GATE_SECRETS") &&
  !gateSrc.slice(
    gateSrc.indexOf("RESUME_GATE_SECRETS"),
    gateSrc.indexOf("GITHUB_GATE_EXTRA_SECRETS")
  ).includes("GITHUB_WEBHOOK_SECRET")
);
check("GITHUB_GATE_EXTRA_SECRETS contains GITHUB_WEBHOOK_SECRET",
  gateSrc.includes("GITHUB_GATE_EXTRA_SECRETS") &&
  gateSrc.slice(
    gateSrc.indexOf("GITHUB_GATE_EXTRA_SECRETS"),
    gateSrc.indexOf("GITHUB_GATE_EXTRA_SECRETS") + 200
  ).includes("GITHUB_WEBHOOK_SECRET")
);

// ---------------------------------------------------------------------------
// 2. Static: resume extract route uses resumeIngestionReady, not coreIngestionReady
// ---------------------------------------------------------------------------
const resumeRouteSrc = fs.readFileSync("app/api/resume/extract/route.ts", "utf-8");
check(
  "resume/extract route imports resumeIngestionReady",
  resumeRouteSrc.includes("resumeIngestionReady"),
);
check(
  "resume/extract route does NOT import coreIngestionReady directly",
  !resumeRouteSrc.includes("coreIngestionReady"),
);

// ---------------------------------------------------------------------------
// 3. Static: processing-jobs route separates resume gate from GitHub gate
// ---------------------------------------------------------------------------
const jobsRouteSrc = fs.readFileSync("app/api/student/processing-jobs/route.ts", "utf-8");
check(
  "processing-jobs imports both resumeIngestionReady and coreIngestionReady",
  jobsRouteSrc.includes("resumeIngestionReady") && jobsRouteSrc.includes("coreIngestionReady"),
);
check(
  "processing-jobs uses resumeIngestionReady for resume source",
  /sourceId === "resume"[^:]*resumeIngestionReady/.test(jobsRouteSrc.replace(/\s+/g, " ")),
);
check(
  "processing-jobs uses coreIngestionReady for github source",
  /sourceId === "github"[^:]*coreIngestionReady/.test(jobsRouteSrc.replace(/\s+/g, " ")),
);

// ---------------------------------------------------------------------------
// 4. Behavioural: gate logic in non-production always returns true
// ---------------------------------------------------------------------------
async function main() {
  const { resumeIngestionReady, githubIngestionReady, coreIngestionReady } = await import("../lib/security/core-ingestion-gate");

  const devEnv = { NODE_ENV: "development", CORE_INGESTION_SECURITY_APPROVED: "false" };
  check("resumeIngestionReady() returns true in development (no secrets needed)", resumeIngestionReady(devEnv as NodeJS.ProcessEnv));
  check("githubIngestionReady() returns true in development (no secrets needed)", githubIngestionReady(devEnv as NodeJS.ProcessEnv));
  check("coreIngestionReady() returns true in development (backwards compat)", coreIngestionReady(devEnv as NodeJS.ProcessEnv));

  // 5. In production, resumeIngestionReady succeeds without GITHUB_WEBHOOK_SECRET
  const prodEnvNoWebhook: Partial<NodeJS.ProcessEnv> = {
    NODE_ENV: "production",
    CORE_INGESTION_SECURITY_APPROVED: "true",
    SESSION_SECRET: "a".repeat(64),
    HANDOFF_SIGNING_SECRET: "b".repeat(64),
    EXTERNAL_TOKEN_ENCRYPTION_KEY: "c".repeat(64),
    // deliberately omitting GITHUB_WEBHOOK_SECRET
  };
  check(
    "resumeIngestionReady() passes in production WITHOUT GITHUB_WEBHOOK_SECRET",
    resumeIngestionReady(prodEnvNoWebhook as NodeJS.ProcessEnv),
  );
  check(
    "githubIngestionReady() FAILS in production WITHOUT GITHUB_WEBHOOK_SECRET",
    !githubIngestionReady(prodEnvNoWebhook as NodeJS.ProcessEnv),
  );

  // 6. With GITHUB_WEBHOOK_SECRET set, both gates open
  const prodEnvFull: Partial<NodeJS.ProcessEnv> = {
    ...prodEnvNoWebhook,
    GITHUB_WEBHOOK_SECRET: "d".repeat(64),
  };
  check(
    "resumeIngestionReady() passes in production WITH GITHUB_WEBHOOK_SECRET",
    resumeIngestionReady(prodEnvFull as NodeJS.ProcessEnv),
  );
  check(
    "githubIngestionReady() passes in production WITH GITHUB_WEBHOOK_SECRET",
    githubIngestionReady(prodEnvFull as NodeJS.ProcessEnv),
  );
  check(
    "coreIngestionReady() passes in production WITH GITHUB_WEBHOOK_SECRET (backwards compat)",
    coreIngestionReady(prodEnvFull as NodeJS.ProcessEnv),
  );

  // 7. resumeIngestionReady() still requires its own session secrets
  const prodEnvMissingSession: Partial<NodeJS.ProcessEnv> = {
    NODE_ENV: "production",
    CORE_INGESTION_SECURITY_APPROVED: "true",
    // SESSION_SECRET missing
    HANDOFF_SIGNING_SECRET: "b".repeat(64),
    EXTERNAL_TOKEN_ENCRYPTION_KEY: "c".repeat(64),
    GITHUB_WEBHOOK_SECRET: "d".repeat(64),
  };
  check(
    "resumeIngestionReady() FAILS when SESSION_SECRET is missing",
    !resumeIngestionReady(prodEnvMissingSession as NodeJS.ProcessEnv),
  );

  console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
