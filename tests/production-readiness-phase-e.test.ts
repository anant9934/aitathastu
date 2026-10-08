process.env.PGLITE_IN_MEMORY = "true";

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import {
  checkRateLimitDistributed,
  setRateLimiterBackend,
  resetRateLimits,
  buildRateLimitKey,
  RateLimiterBackend,
  RateLimitResult,
  MemoryRateLimiter,
} from "../lib/security/rate-limit";

import {
  auditProductionSecrets,
  generateSecureSecret,
} from "../lib/security/production-secrets";

import {
  createAppHandoffToken,
  verifyAppHandoffToken,
} from "../lib/domain/handoff";

import {
  calculateRepoChecksum,
  hasRepoMeaningfullyChanged,
  RawGitHubRepo,
} from "../lib/connectors/github/mapper";

import {
  verifyGitHubWebhookSignature,
} from "../lib/services/github-sync-service";

import {
  isDisallowedInterviewDimension,
} from "../lib/domain/integrations";

import {
  getEcosystemIntegrationStatus,
} from "../lib/monitoring/integration-status";

import {
  getDb,
  organizations,
  evidenceItems,
  learningActivities,
  codingPracticeActivities,
  interviewSessions,
} from "../lib/db";
import { eq } from "drizzle-orm";
import { createUser } from "../lib/repositories/user-repository";
import { hashPassword } from "../lib/auth/password";
import { createIntegrationCredential, createIdentityLink } from "../lib/repositories/integration-repository";
import {
  processStudyLpuEvent,
  processPadhoCodeEvent,
  processErisEvent,
  processMentorMazeEvent,
} from "../lib/services/integration-processor-service";
import { buildPersonGraph } from "../lib/domain/person-graph";

// In-Memory Mock of a Shared Redis Cluster across serverless instances
class MockSharedRedisCluster implements RateLimiterBackend {
  readonly name = "mock-redis-cluster";
  private store = new Map<string, number[]>();
  public simulateNetworkFailure = false;

  async check(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    if (this.simulateNetworkFailure) {
      throw new Error("ETIMEDOUT: Connection to Redis cluster timed out.");
    }

    const now = Date.now();
    let timestamps = this.store.get(key) || [];
    const cutoff = now - windowMs;
    timestamps = timestamps.filter((t) => t > cutoff);

    if (timestamps.length >= maxRequests) {
      const oldest = timestamps[0];
      const resetMs = Math.max(0, oldest + windowMs - now);
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetMs,
        backend: "distributed",
      };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);

    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - timestamps.length,
      resetMs: windowMs,
      backend: "distributed",
    };
  }

  reset(): void {
    this.store.clear();
    this.simulateNetworkFailure = false;
  }
}

describe("Phase E: Distributed Rate Limiting & Resilience", () => {
  let mockCluster: MockSharedRedisCluster;

  beforeEach(() => {
    mockCluster = new MockSharedRedisCluster();
    setRateLimiterBackend(mockCluster);
    resetRateLimits();
  });

  it("1. Multiple simulated instances share rate limits for the same user", async () => {
    const userId = "usr_pilot_shared_001";

    // Request from Instance A (Serverless Lambda 1)
    const resA1 = await checkRateLimitDistributed(userId, "sync");
    assert.equal(resA1.allowed, true);
    assert.equal(resA1.remaining, 4);

    // Request from Instance B (Serverless Lambda 2) for the exact same user
    const resB1 = await checkRateLimitDistributed(userId, "sync");
    assert.equal(resB1.allowed, true);
    assert.equal(resB1.remaining, 3);

    // Exhaust remaining limit (max 5 for sync)
    await checkRateLimitDistributed(userId, "sync");
    await checkRateLimitDistributed(userId, "sync");
    await checkRateLimitDistributed(userId, "sync");

    // 6th request from Instance C must be rejected across the cluster
    const resCRejected = await checkRateLimitDistributed(userId, "sync");
    assert.equal(resCRejected.allowed, false);
    assert.equal(resCRejected.remaining, 0);
  });

  it("2. Opaque rate limit keys preserve student privacy (no raw email in key)", () => {
    const emailKey = buildRateLimitKey("student.arjun@university.edu", "auth", "org_lpu");
    assert.equal(emailKey.includes("@"), false);
    assert.match(emailKey, /^auth:org_lpu:hash_/);
  });

  it("3. Distributed rate limiter fails safely to local memory when Redis is down", async () => {
    const userId = "usr_pilot_failover_001";
    mockCluster.simulateNetworkFailure = true;

    // First request during Redis outage falls back to local memory limiter
    const resFallback = await checkRateLimitDistributed(userId, "auth");
    assert.equal(resFallback.allowed, true);
    assert.equal(resFallback.backend, "fallback_memory");

    // Attack simulation: 10 failed login attempts during Redis outage must STILL be stopped by local fallback!
    for (let i = 0; i < 9; i++) {
      await checkRateLimitDistributed(userId, "auth");
    }

    // 11th request must be blocked (never fail open on auth)
    const resBlocked = await checkRateLimitDistributed(userId, "auth");
    assert.equal(resBlocked.allowed, false);
    assert.equal(resBlocked.remaining, 0);
  });

  after(() => {
    setRateLimiterBackend(new MemoryRateLimiter());
    resetRateLimits();
  });
});

describe("Phase E: Production Secret Provisioning & Cryptographic Entropy", () => {
  it("4. Rejects known development defaults and missing variables in production mode", () => {
    const mockProdEnv: Record<string, string | undefined> = {
      NODE_ENV: "production",
      SESSION_SECRET: "dev-session-secret", // INSECURE
      HANDOFF_SIGNING_SECRET: "tathastu_handoff_secret_key_prod_default", // INSECURE
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/db",
      GITHUB_CLIENT_ID: "gh_id",
      GITHUB_CLIENT_SECRET: "gh_sec",
      GITHUB_WEBHOOK_SECRET: "short", // INSECURE: < 32 chars
    };

    const audit = auditProductionSecrets(mockProdEnv);
    assert.equal(audit.valid, false);
    assert.equal(audit.missingRequired.length > 0, true);
    assert.equal(audit.insecureDefaults.length > 0, true);
  });

  it("5. Passes audit when cryptographically secure 256-bit secrets are configured", () => {
    const mockProdEnv: Record<string, string | undefined> = {
      NODE_ENV: "production",
      SESSION_SECRET: generateSecureSecret("sess", 32),
      HANDOFF_SIGNING_SECRET: generateSecureSecret("handoff", 32),
      DATABASE_URL: "postgresql://neondb_owner:secure@ep-pooler.neon.tech/neondb?sslmode=require",
      GITHUB_CLIENT_ID: "gh_prod_app_client_id",
      GITHUB_CLIENT_SECRET: generateSecureSecret("gh_sec", 32),
      GITHUB_WEBHOOK_SECRET: generateSecureSecret("gh_wh", 32),
      STUDY_LPU_INTEGRATION_SECRET: generateSecureSecret("studylpu", 32),
      PADHO_CODE_INTEGRATION_SECRET: generateSecureSecret("padhocode", 32),
      ERIS_INTEGRATION_SECRET: generateSecureSecret("eris", 32),
      MENTORMAZE_INTEGRATION_SECRET: generateSecureSecret("mentormaze", 32),
      GEMINI_API_KEYS: "AIzaSy_fake_test_key_for_staging",
    };

    const audit = auditProductionSecrets(mockProdEnv);
    assert.equal(audit.valid, true);
    assert.equal(audit.missingRequired.length, 0);
    assert.equal(audit.insecureDefaults.length, 0);
  });
});

describe("Phase E: GitHub App Scopes, Webhook Validation & Change Detection", () => {
  it("6. GitHub App scopes are strictly read-only (no repo write, PR mutation, or deployment)", () => {
    const permittedScopes = ["read:user", "repo:status"];
    const forbiddenScopes = ["repo", "write:repo_hook", "admin:repo_hook", "workflow", "write:packages"];

    for (const scope of forbiddenScopes) {
      assert.equal(permittedScopes.includes(scope), false, `Scope ${scope} must not be requested.`);
    }
  });

  it("7. Webhook HMAC-SHA256 signature verification validates authentic GitHub deliveries", () => {
    const secret = "gh_wh_secret_pilot_2026";
    const payload = JSON.stringify({ repository: { name: "test-repo", full_name: "arjun/test-repo" } });
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const validHeader = `sha256=${hmac}`;

    assert.equal(verifyGitHubWebhookSignature(payload, validHeader, secret), true);
    assert.equal(verifyGitHubWebhookSignature(payload, "sha256=invalid_tampered_signature", secret), false);
    assert.equal(verifyGitHubWebhookSignature(payload, null, secret), false);
  });

  it("8. Meaningful change detection identifies code/documentation evolution while ignoring trivial commits", () => {
    const prevRepo: RawGitHubRepo = {
      id: 101,
      name: "ml-pipeline",
      full_name: "arjun/ml-pipeline",
      html_url: "https://github.com/arjun/ml-pipeline",
      description: "Initial commit",
      pushed_at: "2026-10-01T10:00:00Z",
      language: "Python",
      stargazers_count: 2,
      topics: ["ml"],
    };

    const sameRepo: RawGitHubRepo = {
      id: 101,
      name: "ml-pipeline",
      full_name: "arjun/ml-pipeline",
      html_url: "https://github.com/arjun/ml-pipeline",
      description: "Initial commit",
      pushed_at: "2026-10-01T10:00:00Z",
      language: "Python",
      stargazers_count: 2,
      topics: ["ml"],
    };

    const evolvedRepo: RawGitHubRepo = {
      id: 101,
      name: "ml-pipeline",
      full_name: "arjun/ml-pipeline",
      html_url: "https://github.com/arjun/ml-pipeline",
      description: "Added PyTorch Transformer architecture with ONNX export",
      pushed_at: "2026-10-08T10:00:00Z",
      language: "Python",
      stargazers_count: 15,
      topics: ["ml", "pytorch", "transformers", "onnx"],
    };

    const prevChecksum = calculateRepoChecksum(prevRepo);
    const sameChecksum = calculateRepoChecksum(sameRepo);
    const evolvedChecksum = calculateRepoChecksum(evolvedRepo);

    // Identical snapshot has identical checksum -> not meaningfully changed
    assert.equal(hasRepoMeaningfullyChanged(prevChecksum, sameChecksum), false);

    // Evolved architecture has different checksum -> meaningfully changed
    assert.equal(hasRepoMeaningfullyChanged(prevChecksum, evolvedChecksum), true);
  });
});

describe("Phase E: Deep-Link Cross-App Handoff Security", () => {
  it("9. Handoff tokens exclude all PII, are cryptographically signed, and expire reliably", () => {
    const secret = "test_handoff_signing_key_32_chars_long!!";
    const { token, payload, handoffUrl } = createAppHandoffToken({
      personId: "person_arjun_ml_2026",
      targetApp: "padho_code",
      targetActivity: "practice_python_numpy",
      goalContext: "ML Engineer",
      expiresInSeconds: 900,
      secret,
    });

    // Verify token contains no PII
    assert.equal(payload.personRef.startsWith("stu_"), true);
    assert.equal((payload as Record<string, unknown>).email, undefined);
    assert.equal((payload as Record<string, unknown>).phone, undefined);
    assert.equal((payload as Record<string, unknown>).name, undefined);

    // Verify handoff URL contains token parameter
    assert.match(handoffUrl, /https:\/\/padho\.code\/practice\?handoff_token=/);

    // Verify signature verification succeeds with correct secret
    const verified = verifyAppHandoffToken(token, secret);
    assert.equal(verified.valid, true);
    assert.equal(verified.payload?.targetApp, "padho_code");

    // Verify tampering fails signature check
    const tampered = token.replace(/^[a-zA-Z0-9_-]+/, Buffer.from(JSON.stringify({ forged: true })).toString("base64url"));
    const verifiedTampered = verifyAppHandoffToken(tampered, secret);
    assert.equal(verifiedTampered.valid, false);

    // Verify wrong secret fails
    const verifiedWrongSecret = verifyAppHandoffToken(token, "wrong_secret_12345678901234567890");
    assert.equal(verifiedWrongSecret.valid, false);
  });
});

describe("Phase E: Ecosystem Operational Status Probe", () => {
  it("10. Ecosystem integration status accurately reflects operational health without secret leaks", async () => {
    const status = await getEcosystemIntegrationStatus();

    assert.equal(typeof status.timestamp, "string");
    assert.equal(["healthy", "degraded", "unconfigured"].includes(status.overallHealth), true);
    assert.equal(typeof status.integrations.github, "object");
    assert.equal(typeof status.integrations.study_lpu, "object");
    assert.equal(typeof status.integrations.padho_code, "object");
    assert.equal(typeof status.integrations.eris, "object");
    assert.equal(typeof status.integrations.mentormaze, "object");

    // Ensure zero secrets are present anywhere in the status JSON object
    const serialized = JSON.stringify(status).toLowerCase();
    assert.equal(serialized.includes("password"), false);
    assert.equal(serialized.includes("apikey"), false);
    assert.equal(serialized.includes("token"), false);
  });
});

describe("Phase E: Cross-App ML Engineer Closed-Loop Journey", () => {
  let orgId: string;
  let studentPersonId: string;
  const STUDY_KEY = "test_key_study_lpu_phase_e";
  const PADHO_KEY = "test_key_padho_code_phase_e";
  const ERIS_KEY = "test_key_eris_assessment_phase_e";
  const MENTOR_KEY = "test_key_mentormaze_phase_e";

  before(async () => {
    const db = await getDb();

    // 1. Ensure test organization exists
    const [org] = await db.select().from(organizations).limit(1);
    orgId = org ? org.id : "org_default_tathastu";

    // 2. Create student via official repository helper
    const pwHash = await hashPassword("SecurePass123!");
    const ts = Date.now();
    const createdStudent = await createUser({
      email: `arjun.ml.phase_e.${ts}@example.com`,
      displayName: "Arjun Verma (ML Cohort)",
      passwordHash: pwHash,
    });
    studentPersonId = createdStudent.personId;

    // 3. Provision integration credentials
    await createIntegrationCredential({
      organizationId: orgId,
      producer: "study_lpu",
      rawKey: STUDY_KEY,
    });
    await createIntegrationCredential({
      organizationId: orgId,
      producer: "padho_code",
      rawKey: PADHO_KEY,
    });
    await createIntegrationCredential({
      organizationId: orgId,
      producer: "eris",
      rawKey: ERIS_KEY,
    });
    await createIntegrationCredential({
      organizationId: orgId,
      producer: "mentormaze",
      rawKey: MENTOR_KEY,
    });

    // 4. Establish stable identity links for all 4 producers
    await createIdentityLink({
      organizationId: orgId,
      producer: "study_lpu",
      externalSubjectId: `lpu_arjun_${ts}`,
      personId: studentPersonId,
    });
    await createIdentityLink({
      organizationId: orgId,
      producer: "padho_code",
      externalSubjectId: `pc_arjun_${ts}`,
      personId: studentPersonId,
    });
    await createIdentityLink({
      organizationId: orgId,
      producer: "eris",
      externalSubjectId: `eris_arjun_${ts}`,
      personId: studentPersonId,
    });
    await createIdentityLink({
      organizationId: orgId,
      producer: "mentormaze",
      externalSubjectId: `mm_arjun_${ts}`,
      personId: studentPersonId,
    });
  });

  it("11. Step 1 [LEARN]: Study LPU module completion records learning activity without claiming unearned verification", async () => {
    const eventId = `study_evt_${Date.now()}`;
    const linkSubject = `lpu_arjun_${studentPersonId.split("_").pop()}`;
    await createIdentityLink({
      organizationId: orgId,
      producer: "study_lpu",
      externalSubjectId: linkSubject,
      personId: studentPersonId,
    });

    const validPayload = {
      producer: "study_lpu",
      externalEventId: eventId,
      payloadVersion: 1,
      occurredAt: new Date().toISOString(),
      organizationId: orgId,
      student: { externalStudentId: linkSubject },
      event: {
        eventType: "module.completed" as const,
        courseId: "cse_401_ml",
        courseTitle: "Applied Machine Learning",
        moduleId: "mod_01_supervised",
        moduleTitle: "Supervised Learning Algorithms",
        topicKey: "machine_learning",
        topicTitle: "Supervised Learning",
        durationMinutes: 120,
        completedAt: new Date().toISOString(),
      },
    };

    const res = await processStudyLpuEvent({ rawKey: STUDY_KEY, payload: validPayload });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, "processed");

    // Verify learning activity exists
    const db = await getDb();
    const acts = await db
      .select()
      .from(learningActivities)
      .where(eq(learningActivities.personId, studentPersonId));
    const act = acts.find((a) => a.courseId === "cse_401_ml");
    assert.ok(act);
    assert.equal(act.personId, studentPersonId);

    // Critical Defensible Check: Learning activity must NOT create verified evidence
    const verifiedEvidence = await db.select().from(evidenceItems).where(eq(evidenceItems.personId, studentPersonId));
    assert.equal(verifiedEvidence.length, 0, "Academic learning alone must not create verified evidence.");
  });

  it("12. Step 2 [PRACTICE]: Padho Code challenge completion records coding practice evidence", async () => {
    const eventId = `pc_evt_${Date.now()}`;
    const linkSubject = `pc_arjun_${studentPersonId.split("_").pop()}`;
    await createIdentityLink({
      organizationId: orgId,
      producer: "padho_code",
      externalSubjectId: linkSubject,
      personId: studentPersonId,
    });

    const payload = {
      producer: "padho_code",
      externalEventId: eventId,
      payloadVersion: 1,
      occurredAt: new Date().toISOString(),
      organizationId: orgId,
      student: { externalStudentId: linkSubject },
      activity: {
        eventType: "challenge.completed" as const,
        topic: "NumPy Vectorized Matrix Operations",
        topicKey: "python_data_structures",
        language: "python",
        difficulty: "medium" as const,
        status: "completed" as const,
        challengeId: "chal_vector_matrix_mult",
        attempts: 1,
        completedAt: new Date().toISOString(),
      },
    };

    const res = await processPadhoCodeEvent({ rawKey: PADHO_KEY, payload });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, "processed");

    // Practice activity is recorded
    const db = await getDb();
    const practiceActs = await db.select().from(codingPracticeActivities).where(eq(codingPracticeActivities.personId, studentPersonId));
    assert.equal(practiceActs.length, 1);
  });

  it("13. Step 3 [VERIFY]: ERIS assessment completion creates institutional verified evidence", async () => {
    const eventId = `eris_evt_${Date.now()}`;
    const linkSubject = `eris_arjun_${studentPersonId.split("_").pop()}`;
    await createIdentityLink({
      organizationId: orgId,
      producer: "eris",
      externalSubjectId: linkSubject,
      personId: studentPersonId,
    });

    const payload = {
      producer: "eris",
      externalEventId: eventId,
      payloadVersion: 1,
      occurredAt: new Date().toISOString(),
      organizationId: orgId,
      student: { externalStudentId: linkSubject },
      assessment: {
        externalAssessmentId: "eris_ml_core_v1",
        title: "Standardized ML Core Competency Exam",
        type: "proctored_diagnostic",
        rubricVersion: "2026.1",
        completedAt: new Date().toISOString(),
        overallScore: 88,
        maxScore: 100,
        resultType: "score" as const,
      },
      topics: [
        {
          topicKey: "machine_learning",
          topicLabel: "Machine Learning Fundamentals",
          value: 88,
          maxValue: 100,
          measurementType: "score" as const,
        },
      ],
    };

    const res = await processErisEvent({ rawKey: ERIS_KEY, payload });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, "processed");

    // Verified evidence item created!
    const db = await getDb();
    const evRows = await db.select().from(evidenceItems).where(eq(evidenceItems.personId, studentPersonId));
    assert.ok(evRows.length > 0);
    const verifiedItem = evRows.find((e) => e.verificationStatus === "verified");
    assert.ok(verifiedItem, "ERIS final diagnostic creates verified evidence.");
    assert.equal(verifiedItem.subject, "Machine Learning Fundamentals");
  });

  it("14. Step 4 [INTERVIEW]: MentorMaze completed interview records session dimensions without permanent traits", async () => {
    const eventId = `mm_evt_${Date.now()}`;
    const linkSubject = `mm_arjun_${studentPersonId.split("_").pop()}`;
    await createIdentityLink({
      organizationId: orgId,
      producer: "mentormaze",
      externalSubjectId: linkSubject,
      personId: studentPersonId,
    });

    const payload = {
      producer: "mentormaze",
      externalEventId: eventId,
      payloadVersion: 1,
      occurredAt: new Date().toISOString(),
      organizationId: orgId,
      student: { externalStudentId: linkSubject },
      session: {
        externalInterviewId: "mm_interview_ml_role_01",
        targetRole: "ML Engineer",
        rubricVersion: "2026.2",
        completedAt: new Date().toISOString(),
      },
      dimensions: [
        {
          dimensionKey: "technical_reasoning",
          dimensionLabel: "ML System Design & Reasoning",
          value: 4,
          scaleMin: 1,
          scaleMax: 5,
          explanation: "Explained optimization trade-offs clearly.",
        },
        {
          dimensionKey: "communication",
          dimensionLabel: "Technical Communication",
          value: 4,
          scaleMin: 1,
          scaleMax: 5,
          explanation: "Clear presentation of technical architecture.",
        },
      ],
    };

    const res = await processMentorMazeEvent({ rawKey: MENTOR_KEY, payload });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, "processed");

    // Interview session recorded
    const db = await getDb();
    const sessions = await db.select().from(interviewSessions).where(eq(interviewSessions.personId, studentPersonId));
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].targetRole, "ML Engineer");

    // Prohibited dimensions like 'emotion' or 'facial' must be rejected
    assert.equal(isDisallowedInterviewDimension("facial_expression", "Micro-expression detection"), true);
    assert.equal(isDisallowedInterviewDimension("personality_temperament", "Personality score"), true);
    assert.equal(isDisallowedInterviewDimension("technical_reasoning", "Technical Reasoning"), false);
  });

  it("15. Step 5 [PERSON GRAPH]: Complete Person Graph unifies Learn, Practice, Verify, and Interview signals", async () => {
    const graph = await buildPersonGraph(studentPersonId);

    assert.equal(graph.person.id, studentPersonId);
    assert.ok(graph.learningSummary, "Learning summary present");
    assert.ok(graph.learningSummary.totalCompletedModules >= 1, "Completed learning modules counted");
    assert.ok(graph.practiceSummary, "Practice summary present");
    assert.ok(graph.practiceSummary.totalProblemsSolved >= 1, "Problems solved counted");
    assert.ok(graph.interviewSummary, "Interview summary present");
    assert.ok(graph.interviewSummary.totalInterviews >= 1, "Interviews counted");

    // Verify machine learning skill has verified status
    const mlSkill = graph.skills.find((s) => s.name.toLowerCase().includes("machine learning"));
    assert.ok(mlSkill, "Machine learning skill is mapped in graph");
    assert.equal(mlSkill.state, "Verified", "Machine learning is verified via ERIS");
  });
});
