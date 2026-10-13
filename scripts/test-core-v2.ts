import assert from "node:assert/strict";
import { encryptConnectionToken, decryptConnectionToken } from "../lib/security/connection-token";
import { coreIngestionReady } from "../lib/security/core-ingestion-gate";
import { safeDraft } from "../lib/onboarding-v2";
import { ResumeInterpretationSchema } from "../lib/intelligence/schemas";
import { executeDeterministicFallback } from "../lib/intelligence/deterministic-fallback";
import { BackgroundJobQueue } from "./lib/job-queue";
import { getDb, persons, users } from "../lib/db";
import { claimMatchesSnapshot, resumeCandidates, saveResumeCandidates, validateReviewedResumeClaims } from "../lib/services/resume-review-service";
import { getProjectCandidatesForPerson } from "../lib/acquisition/acquisition-service";
import { saveSourceSnapshot } from "../lib/repositories/connection-repository";
import { getExternalConnectionByProvider } from "../lib/repositories/connection-repository";
import { connectGitHubAccount, disconnectGitHubAccount } from "../lib/services/github-sync-service";
import { groundResumeInterpretation } from "../lib/services/resume-extraction-service";
import { composePersonalizedDashboard, getAll96Configurations } from "../lib/domain/personalization-engine";
import { generatePersonalizedRoadmap } from "../lib/domain/roadmap";
import { mapGitHubReposToProjects } from "../lib/connectors/github/mapper";
import { interpretGitHubProject } from "../lib/services/github-project-intelligence";

const originalKey = process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY;
process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY = "test-only-key-of-at-least-thirty-two-characters";
try {
  const sealed = encryptConnectionToken("test-oauth-token", "student-a");
  assert.ok(!sealed.includes("test-oauth-token"));
  assert.equal(decryptConnectionToken(sealed, "student-a"), "test-oauth-token");
  assert.throws(() => decryptConnectionToken(sealed, "student-b"));
  assert.throws(() => decryptConnectionToken(`${sealed}tampered`, "student-a"));
} finally {
  if (originalKey === undefined) delete process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY;
  else process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY = originalKey;
}

assert.equal(coreIngestionReady({ NODE_ENV: "production" }), false);
assert.equal(coreIngestionReady({
  NODE_ENV: "production",
  CORE_INGESTION_SECURITY_APPROVED: "true",
  SESSION_SECRET: "s".repeat(32),
  HANDOFF_SIGNING_SECRET: "h".repeat(32),
  GITHUB_WEBHOOK_SECRET: "g".repeat(32),
  EXTERNAL_TOKEN_ENCRYPTION_KEY: "e".repeat(32),
}), true);

const draft = safeDraft({ version: 2, resumeReviewed: [
  { category: "skill", value: "PyTorch", sourceSpan: "PyTorch model", documentId: "a".repeat(64), corrected: false },
  { category: "skill", value: "Invented", sourceSpan: "", documentId: "invalid", corrected: false },
] });
assert.equal(draft.targetRole, "");
assert.equal(draft.goal, "");
assert.equal(draft.resumeReviewed.length, 1);
assert.equal(ResumeInterpretationSchema.safeParse({ skills: [{ name: "PyTorch" }] }).success, false);
assert.match(executeDeterministicFallback({ task: "EORA_CHAT", systemPrompt: "", userPrompt: "" }).content, /unable to provide AI guidance/i);

const configurations = getAll96Configurations();
assert.equal(configurations.length, 96);
const compositionFingerprints = new Set<string>();
for (const configuration of configurations) {
  const composed = composePersonalizedDashboard({
    personId: "test-person-a", name: "Test Student", targetRole: "GenAI Engineer", targetRoleId: "genai_engineer",
    goal: "Build a documented AI project", primaryInterest: configuration.primary,
    secondaryInterests: configuration.secondary, skills: [], projects: [], evidenceItems: [], isDemo: false,
  });
  assert.equal(composed.nextBestActions.length <= 5, true);
  assert.equal(composed.journeyRecords.length, 0);
  assert.equal(composed.summaryCards.find((card) => card.id === "card_network")?.value, "Unavailable");
  for (const action of composed.nextBestActions) {
    assert.match(action.destinationUrl, /^\/student\/(skills|projects|profile|roadmap|connections|journey)(\/|\?|$)/);
    assert.ok(action.whyAmISeeingThis.actionOutcome);
  }
  assert.match(composed.hero.primaryCta.url, /^\/student\/(skills|projects|profile|roadmap|connections|journey)(\/|\?|$)/);
  compositionFingerprints.add(JSON.stringify([composed.hero.subheadline, composed.hero.primaryCta, composed.nextBestActions.map((action) => action.title), composed.eoraPersonalizedInsight]));
}
assert.equal(compositionFingerprints.size, 96);

const roadmapWithoutProject = generatePersonalizedRoadmap("Get an AI internship", [], undefined, undefined, {
  targetRole: "GenAI Engineer", specificGoal: "Get an AI internship", primaryPriority: "jobs", confirmedProjectCount: 0,
});
const roadmapWithProject = generatePersonalizedRoadmap("Get an AI internship", [], undefined, undefined, {
  targetRole: "GenAI Engineer", specificGoal: "Get an AI internship", primaryPriority: "jobs", confirmedProjectCount: 1,
});
assert.ok(roadmapWithoutProject.totalStages > 0);
assert.equal(roadmapWithoutProject.primaryActions.some((action) => action.title === "Document evaluation for a confirmed project"), false);
assert.equal(roadmapWithProject.primaryActions.some((action) => action.title === "Document evaluation for a confirmed project"), true);
assert.equal(roadmapWithProject.stages[0].status, "in_progress");
assert.deepEqual(mapGitHubReposToProjects([
  { id: 1, name: "private-model", full_name: "test/private-model", description: null, html_url: "https://github.com/test/private-model", language: "Python", private: true },
  { id: 2, name: "public-model", full_name: "test/public-model", description: null, html_url: "https://github.com/test/public-model", language: "Python", private: false },
]).map((repo) => repo.title), ["public-model"]);

async function checkUnregisteredJobFails() {
  const queue = new BackgroundJobQueue();
  const unhandled = await queue.enqueue({
    ownerPersonId: "student-a",
    jobType: "RESUME_INTERPRETATION",
    idempotencyKey: "unhandled-resume",
    payload: {},
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(queue.getJob(unhandled.jobId)?.state, "failed");
  assert.match(queue.getJob(unhandled.jobId)?.error || "", /No registered worker handler/);
}

checkUnregisteredJobFails().then(() => {
  return checkResumeProvenance();
}).then(() => {
  return checkGitHubRevocation();
}).then(() => {
  return checkPrivateRepositoryBoundary();
}).then(() => {
  console.log("Core V2 security and data integrity checks passed.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function checkResumeProvenance() {
  process.env.PGLITE_IN_MEMORY = "true";
  process.env.DATABASE_MODE = "pglite";
  const db = await getDb();
  await db.insert(users).values([
    { id: "test-user-a", email: "test-a@example.invalid", passwordHash: "unused" },
    { id: "test-user-b", email: "test-b@example.invalid", passwordHash: "unused" },
  ]);
  await db.insert(persons).values([
    { id: "test-person-a", primaryUserId: "test-user-a", displayName: "Test A" },
    { id: "test-person-b", primaryUserId: "test-user-b", displayName: "Test B" },
  ]);
  const extracted = ResumeInterpretationSchema.parse({
    skills: [{ name: "PyTorch", sourceSpan: "Built a PyTorch model" }],
  });
  const grounded = groundResumeInterpretation(ResumeInterpretationSchema.parse({
    skills: [
      { name: "PyTorch", sourceSpan: "Built a PyTorch model" },
      { name: "TensorFlow", sourceSpan: "Built a PyTorch model" },
    ],
  }), "Built a PyTorch model for classification.");
  assert.deepEqual(grounded.skills.map((skill) => skill.name), ["PyTorch"]);
  const candidates = resumeCandidates(extracted);
  const documentId = "a".repeat(64);
  const base = { documentId, category: "skill" as const, candidateId: "skill_0", sourceSpan: "Built a PyTorch model" };
  assert.equal(claimMatchesSnapshot({ ...base, value: "PyTorch", corrected: false }, candidates), true);
  assert.equal(claimMatchesSnapshot({ ...base, value: "TensorFlow", corrected: false }, candidates), false);
  assert.equal(claimMatchesSnapshot({ ...base, value: "TensorFlow", corrected: true }, candidates), true);
  await saveResumeCandidates("test-person-a", documentId, extracted);
  await validateReviewedResumeClaims("test-person-a", [{ ...base, value: "PyTorch", corrected: false }]);
  await assert.rejects(validateReviewedResumeClaims("test-person-b", [{ ...base, value: "PyTorch", corrected: false }]));
  await assert.rejects(validateReviewedResumeClaims("test-person-a", [{ ...base, value: "TensorFlow", corrected: false }]));
  await assert.rejects(validateReviewedResumeClaims("test-person-a", [{ ...base, candidateId: "skill_9", value: "PyTorch", corrected: true }]));
  await saveSourceSnapshot("test-person-a", "github", "https://github.com/test-a/model", {
    title: "model", description: "A test repository", technologies: ["PyTorch"],
  });
  const owned = await getProjectCandidatesForPerson("test-person-a");
  const other = await getProjectCandidatesForPerson("test-person-b");
  assert.equal(owned.some((candidate) => candidate.repositoryUrl === "https://github.com/test-a/model"), true);
  assert.equal(other.length, 0);
}

async function checkPrivateRepositoryBoundary() {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  try {
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      return Response.json({ id: 1, full_name: "test/private-model", name: "private-model", private: true });
    };
    const result = await interpretGitHubProject("test/private-model", "test-token", "test-person-a");
    assert.equal(result.success, false);
    assert.deepEqual(requests, ["https://api.github.com/repos/test/private-model"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function checkGitHubRevocation() {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY;
  const oldClientId = process.env.GITHUB_CLIENT_ID;
  const oldClientSecret = process.env.GITHUB_CLIENT_SECRET;
  process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY = "test-only-key-of-at-least-thirty-two-characters";
  process.env.GITHUB_CLIENT_ID = "test-client";
  process.env.GITHUB_CLIENT_SECRET = "test-secret";
  let called = false;
  try {
    await connectGitHubAccount({ personId: "test-person-a", username: "test-a", token: "test-oauth-token" });
    globalThis.fetch = async (input, init) => {
      called = true;
      assert.match(String(input), /api\.github\.com\/applications\/test-client\/token/);
      assert.equal(init?.method, "DELETE");
      assert.deepEqual(JSON.parse(String(init?.body)), { access_token: "test-oauth-token" });
      return new Response(null, { status: 204 });
    };
    const result = await disconnectGitHubAccount("test-person-a");
    assert.equal(result.providerRevoked, true);
    assert.equal(called, true);
    const connection = await getExternalConnectionByProvider("test-person-a", "github");
    assert.equal(connection?.status, "disconnected");
    assert.deepEqual(connection?.metadata, {});
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY;
    else process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY = oldKey;
    if (oldClientId === undefined) delete process.env.GITHUB_CLIENT_ID;
    else process.env.GITHUB_CLIENT_ID = oldClientId;
    if (oldClientSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
    else process.env.GITHUB_CLIENT_SECRET = oldClientSecret;
  }
}
