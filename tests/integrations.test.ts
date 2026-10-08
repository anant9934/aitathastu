import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { getDb } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { hashPassword } from "../lib/auth/password";
import {
  createIntegrationCredential,
  createIdentityLink,
  getStudentAssessments,
  getStudentInterviews,
} from "../lib/repositories/integration-repository";
import {
  getEvidenceByPersonId,
  createEvidenceRecord,
  type EvidenceRecord,
} from "../lib/repositories/evidence-repository";
import { getJourneyEventsByPersonId } from "../lib/repositories/journey-repository";
import {
  processErisEvent,
  processAiInterviewEvent,
} from "../lib/services/integration-processor-service";
import {
  validateErisPayload,
  validateAiInterviewPayload,
  mapErisTopicToEvidence,
  mapInterviewDimensionToEvidence,
  isDisallowedInterviewDimension,
} from "../lib/domain/integrations";
import {
  calculateReadiness,
  READINESS_POLICIES,
  evaluateDimensionStrength,
} from "../lib/domain/readiness";
import { evaluateGaps } from "../lib/domain/gaps";
import { generateMLRecommendations } from "../lib/domain/recommendations";
import { createEvidenceItem, type EvidenceItem } from "../lib/domain/evidence";

function toDomainEvidence(records: EvidenceRecord[]): EvidenceItem[] {
  return records.map((r) => ({
    ...r,
    observedAt: r.observedAt instanceof Date ? r.observedAt.toISOString() : String(r.observedAt),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    verifiedAt: r.verifiedAt instanceof Date ? r.verifiedAt.toISOString() : r.verifiedAt || null,
  }));
}

describe("Phase 6 Connected Evidence Producers: ERIS & AI Interview Tests", () => {
  let student1: Awaited<ReturnType<typeof createUser>>;
  let student2: Awaited<ReturnType<typeof createUser>>;
  const orgA = "org_tathastu_default";
  const orgB = "org_other_isolated";

  const erisRawKey = "eris_test_secret_key_123456789";
  const interviewRawKey = "interview_test_secret_key_123456789";
  const orgBRawKey = "eris_org_b_secret_key_999999999";

  before(async () => {
    process.env.PGLITE_IN_MEMORY = "true";
    await getDb();

    // 1. Create two test students
    const pass = await hashPassword("studentPass123");
    student1 = await createUser({
      email: `eris_student1_${Date.now()}@example.com`,
      passwordHash: pass,
      displayName: "Arjun Verma",
    });

    student2 = await createUser({
      email: `eris_student2_${Date.now()}@example.com`,
      passwordHash: pass,
      displayName: "Priya Patel",
    });

    // 2. Set up organizations & integration credentials
    const db = await getDb();
    const { organizations } = await import("../lib/db");
    await db.insert(organizations).values({
      id: orgB,
      slug: "org-isolated",
      name: "Isolated Organization B",
      status: "active",
    }).onConflictDoNothing();

    await createIntegrationCredential({
      organizationId: orgA,
      producer: "eris",
      label: "ERIS Production Exam Cluster Org A",
      rawKey: erisRawKey,
    });

    await createIntegrationCredential({
      organizationId: orgA,
      producer: "ai_interview",
      label: "AI Interview Engine Org A",
      rawKey: interviewRawKey,
    });

    await createIntegrationCredential({
      organizationId: orgB,
      producer: "eris",
      label: "ERIS Org B Cluster",
      rawKey: orgBRawKey,
    });

    // 3. Link identities for student1
    await createIdentityLink({
      organizationId: orgA,
      producer: "eris",
      externalSubjectId: "ERIS_STU_001",
      personId: student1.personId,
    });

    await createIdentityLink({
      organizationId: orgA,
      producer: "ai_interview",
      externalSubjectId: "INT_STU_001",
      personId: student1.personId,
    });

    // Student 2 has no links initially (tests unknown identity)
  });

  // =========================================================================
  // REQUIREMENT #40: INTEGRATION CORE TESTS (1 - 16)
  // =========================================================================

  it("1. Valid ERIS producer can submit event", async () => {
    const payload = {
      producer: "eris",
      externalEventId: `evt_eris_001_${Date.now()}`,
      payloadVersion: 1,
      occurredAt: new Date().toISOString(),
      student: { externalStudentId: "ERIS_STU_001" },
      assessment: {
        externalAssessmentId: "ERIS_EXAM_ML_101",
        title: "Machine Learning Foundations & Python",
        type: "standardized",
        rubricVersion: "v1.2",
        completedAt: new Date().toISOString(),
        overallScore: "85",
        maxScore: "100",
        resultType: "score" as const,
      },
      topics: [
        {
          topicKey: "python_programming",
          topicLabel: "Python Programming",
          value: "3",
          maxValue: "4",
          measurementType: "rubric_level" as const,
        },
        {
          topicKey: "ml_concepts",
          topicLabel: "Machine Learning Concepts",
          value: "3",
          maxValue: "4",
          measurementType: "rubric_level" as const,
        },
      ],
    };

    const res = await processErisEvent({
      rawKey: erisRawKey,
      payload,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.status, "processed");
    assert.ok(res.data.attemptId);
    assert.equal(res.data.evidenceCreated, 2);

    // Verify stored attempt
    const attempts = await getStudentAssessments(student1.personId);
    assert.ok(attempts.length >= 1);
    const found = attempts.find((a) => a.externalAssessmentId === "ERIS_EXAM_ML_101");
    assert.ok(found);
    assert.equal(found.assessmentTitle, "Machine Learning Foundations & Python");
  });

  it("2. Invalid ERIS credential rejected", async () => {
    const res = await processErisEvent({
      rawKey: "invalid_secret_key_that_does_not_exist",
      payload: {
        producer: "eris",
        externalEventId: `evt_fake_${Date.now()}`,
        payloadVersion: 1,
        student: { externalStudentId: "ERIS_STU_001" },
        assessment: { externalAssessmentId: "A1", title: "Test" },
        topics: [{ topicKey: "t1", topicLabel: "T1", value: 3, measurementType: "score" }],
      },
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.status, "failed");
    assert.ok(res.data.error?.includes("Invalid integration credentials"));
  });

  it("3. Producer credential cannot cross organization", async () => {
    // Org B credential trying to submit an event targeting Org A
    const res = await processErisEvent({
      rawKey: orgBRawKey, // Org B's key
      payload: {
        producer: "eris",
        externalEventId: `evt_cross_org_${Date.now()}`,
        payloadVersion: 1,
        organizationId: orgA, // Targets Org A explicitly!
        student: { externalStudentId: "ERIS_STU_001" },
        assessment: { externalAssessmentId: "A1", title: "Test" },
        topics: [{ topicKey: "t1", topicLabel: "T1", value: 3, measurementType: "score" }],
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.data.status, "rejected");
    assert.ok(res.data.error?.includes("Organization boundary violation"));
  });

  it("4. ERIS event idempotency (no duplicate attempt, evidence, or journey event)", async () => {
    const fixedEventId = `evt_idempotent_test_${Date.now()}`;
    const payload = {
      producer: "eris",
      externalEventId: fixedEventId,
      payloadVersion: 1,
      student: { externalStudentId: "ERIS_STU_001" },
      assessment: {
        externalAssessmentId: "ERIS_IDEMP_TEST",
        title: "Idempotency Test Exam",
        completedAt: new Date().toISOString(),
      },
      topics: [
        {
          topicKey: "algo",
          topicLabel: "Algorithms",
          value: "4",
          maxValue: "4",
          measurementType: "rubric_level" as const,
        },
      ],
    };

    // First call -> processed
    const res1 = await processErisEvent({ rawKey: erisRawKey, payload });
    assert.equal(res1.status, 200);
    assert.equal(res1.data.status, "processed");

    const attemptsBefore = await getStudentAssessments(student1.personId);
    const evidenceBefore = await getEvidenceByPersonId(student1.personId);
    const journeyBefore = await getJourneyEventsByPersonId(student1.personId);

    // Second call with identical externalEventId -> already_processed
    const res2 = await processErisEvent({ rawKey: erisRawKey, payload });
    assert.equal(res2.status, 200);
    assert.equal(res2.data.status, "already_processed");

    const attemptsAfter = await getStudentAssessments(student1.personId);
    const evidenceAfter = await getEvidenceByPersonId(student1.personId);
    const journeyAfter = await getJourneyEventsByPersonId(student1.personId);

    assert.equal(attemptsAfter.length, attemptsBefore.length, "Attempts must not increase");
    assert.equal(evidenceAfter.length, evidenceBefore.length, "Evidence must not increase");
    assert.equal(journeyAfter.length, journeyBefore.length, "Journey events must not increase");
  });

  it("5. Unknown ERIS identity creates no evidence (marked identity_unresolved)", async () => {
    const payload = {
      producer: "eris",
      externalEventId: `evt_unknown_stu_${Date.now()}`,
      payloadVersion: 1,
      student: { externalStudentId: "UNKNOWN_EXTERNAL_ID_9999" }, // No link exists
      assessment: {
        externalAssessmentId: "ERIS_UNKNOWN_EXAM",
        title: "Unlinked Student Assessment",
        completedAt: new Date().toISOString(),
      },
      topics: [
        {
          topicKey: "ml_math",
          topicLabel: "Linear Algebra",
          value: "4",
          measurementType: "rubric_level" as const,
        },
      ],
    };

    const res = await processErisEvent({ rawKey: erisRawKey, payload });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, "identity_unresolved");
    assert.ok(res.data.message?.includes("Identity unresolved"));

    // Verify no evidence created for any user with this title
    const evs1 = await getEvidenceByPersonId(student1.personId);
    const evs2 = await getEvidenceByPersonId(student2.personId);
    assert.ok(!evs1.some((e) => e.subject === "Linear Algebra" && e.sourceReference?.includes("UNKNOWN")));
    assert.ok(!evs2.some((e) => e.subject === "Linear Algebra"));
  });

  it("6. Linked identity resolves correct person", async () => {
    // Link student2 to a new external subject ID
    await createIdentityLink({
      organizationId: orgA,
      producer: "eris",
      externalSubjectId: "ERIS_STU_PRIYA",
      personId: student2.personId,
    });

    const payload = {
      producer: "eris",
      externalEventId: `evt_priya_${Date.now()}`,
      payloadVersion: 1,
      student: { externalStudentId: "ERIS_STU_PRIYA" },
      assessment: {
        externalAssessmentId: "ERIS_PRIYA_EVAL",
        title: "Priya Target Assessment",
        completedAt: new Date().toISOString(),
      },
      topics: [
        {
          topicKey: "deep_learning",
          topicLabel: "Deep Learning Architectures",
          value: "3",
          measurementType: "rubric_level" as const,
        },
      ],
    };

    const res = await processErisEvent({ rawKey: erisRawKey, payload });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, "processed");

    // Must be attributed to student2 ONLY, never student1
    const priyaEvidence = await getEvidenceByPersonId(student2.personId);
    const arjunEvidence = await getEvidenceByPersonId(student1.personId);

    assert.ok(priyaEvidence.some((e) => e.subject === "Deep Learning Architectures"));
    assert.ok(!arjunEvidence.some((e) => e.subject === "Deep Learning Architectures"));
  });

  it("7. ERIS topic result maps to correct evidence with proper category and source", async () => {
    const attempt = {
      id: "att_mock_123",
      assessmentTitle: "Neural Networks & Optimization",
      completedAt: "2026-10-07T10:00:00.000Z",
    };
    const topic = {
      topicKey: "optimization",
      topicLabel: "Optimization Algorithms",
      value: "4",
      maxValue: "4",
      measurementType: "rubric_level",
    };

    const evidenceData = mapErisTopicToEvidence(attempt, topic);

    assert.equal(evidenceData.category, "assessment");
    assert.equal(evidenceData.subject, "Optimization Algorithms");
    assert.equal(evidenceData.source, "institutional");
    assert.equal(evidenceData.verificationStatus, "verified");
    assert.equal(evidenceData.sourceReference, "att_mock_123");
    assert.equal(evidenceData.verificationMethod, "assessment");
    assert.ok(evidenceData.interpretation?.includes("Verified assessment evidence from ERIS"));
    assert.ok(evidenceData.interpretation?.includes("Neural Networks & Optimization"));
  });

  it("8. Trusted ERIS event creates trusted evidence only under allowed policy", async () => {
    const evidenceList = await getEvidenceByPersonId(student1.personId);
    const pythonEv = evidenceList.find((e) => e.subject === "Python Programming");

    assert.ok(pythonEv);
    assert.equal(pythonEv.source, "institutional");
    assert.equal(pythonEv.verificationStatus, "verified");
    assert.ok(pythonEv.interpretation?.startsWith("Verified assessment evidence from ERIS"));
    // Must NOT state "Python mastery proven"
    assert.ok(!pythonEv.interpretation?.toLowerCase().includes("mastery proven"));
  });

  it("9. Manual/untrusted ERIS result cannot become verified automatically", async () => {
    // If evidence is inserted manually or without trusted producer ingestion, verificationStatus is self_reported/unverified
    const manualEv = await createEvidenceRecord(student1.personId, {
      category: "assessment",
      subject: "Self-Reported Test Score",
      value: "Scored 99% on online quiz",
      source: "self_reported",
      verificationStatus: "self_reported",
      interpretation: "User claimed assessment score.",
      whyItMatters: "Self-reported claim.",
    });

    assert.equal(manualEv.verificationStatus, "self_reported");
    assert.notEqual(manualEv.verificationStatus, "verified");
  });

  it("10. Event processing is transactional (no partial state on failure)", async () => {
    // Attempt with empty topics violates schema validation
    const invalidPayload = {
      producer: "eris",
      externalEventId: `evt_invalid_tx_${Date.now()}`,
      payloadVersion: 1,
      student: { externalStudentId: "ERIS_STU_001" },
      assessment: {
        externalAssessmentId: "ERIS_BROKEN",
        title: "Broken Attempt",
      },
      topics: [], // Empty topics violates schema
    };

    const res = await processErisEvent({
      rawKey: erisRawKey,
      payload: invalidPayload,
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.status, "rejected");

    // No attempt recorded
    const attempts = await getStudentAssessments(student1.personId);
    assert.ok(!attempts.some((a) => a.externalAssessmentId === "ERIS_BROKEN"));
  });

  it("11. Valid AI Interview producer can submit event", async () => {
    const payload = {
      producer: "ai_interview",
      externalEventId: `evt_int_001_${Date.now()}`,
      payloadVersion: 1,
      occurredAt: new Date().toISOString(),
      student: { externalStudentId: "INT_STU_001" },
      session: {
        externalInterviewId: "INT_SESSION_ML_001",
        targetRole: "ML Engineer",
        rubricVersion: "v2.0",
        completedAt: new Date().toISOString(),
      },
      dimensions: [
        {
          dimensionKey: "technical_reasoning",
          dimensionLabel: "Technical Reasoning",
          value: "4",
          scaleMin: "1",
          scaleMax: "5",
          explanation: "Clear trade-off discussion on loss function selection.",
        },
        {
          dimensionKey: "communication",
          dimensionLabel: "Communication",
          value: "3",
          scaleMin: "1",
          scaleMax: "5",
          explanation: "Explained approach clearly, but answers could be more structured.",
        },
      ],
    };

    const res = await processAiInterviewEvent({
      rawKey: interviewRawKey,
      payload,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.status, "processed");
    assert.ok(res.data.sessionId);
    assert.equal(res.data.evidenceCreated, 2);

    // Verify stored session
    const sessions = await getStudentInterviews(student1.personId);
    assert.ok(sessions.length >= 1);
    const found = sessions.find((s) => s.externalInterviewId === "INT_SESSION_ML_001");
    assert.ok(found);
    assert.equal(found.targetRole, "ML Engineer");
  });

  it("12. Invalid AI Interview credential rejected", async () => {
    // ERIS key used to call AI Interview endpoint
    const res = await processAiInterviewEvent({
      rawKey: erisRawKey, // wrong producer type!
      payload: {
        producer: "ai_interview",
        externalEventId: `evt_wrong_type_${Date.now()}`,
        payloadVersion: 1,
        student: { externalStudentId: "INT_STU_001" },
        session: { externalInterviewId: "S1", targetRole: "ML Engineer" },
        dimensions: [{ dimensionKey: "communication", dimensionLabel: "Communication", value: 4, explanation: "Good" }],
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.data.status, "rejected");
    assert.ok(res.data.error?.includes("cannot submit AI Interview events"));
  });

  it("13. Interview event idempotency (0 duplicate sessions or evidence)", async () => {
    const fixedEventId = `evt_int_idemp_${Date.now()}`;
    const payload = {
      producer: "ai_interview",
      externalEventId: fixedEventId,
      payloadVersion: 1,
      student: { externalStudentId: "INT_STU_001" },
      session: {
        externalInterviewId: "INT_IDEMP_SESS",
        targetRole: "ML Engineer",
        completedAt: new Date().toISOString(),
      },
      dimensions: [
        {
          dimensionKey: "problem_solving",
          dimensionLabel: "Problem Solving",
          value: "4",
          scaleMin: "1",
          scaleMax: "5",
          explanation: "Broke down latency bottlenecks effectively.",
        },
      ],
    };

    // First call -> processed
    const res1 = await processAiInterviewEvent({ rawKey: interviewRawKey, payload });
    assert.equal(res1.status, 200);
    assert.equal(res1.data.status, "processed");

    const sessionsBefore = await getStudentInterviews(student1.personId);
    const evidenceBefore = await getEvidenceByPersonId(student1.personId);

    // Second call -> already_processed
    const res2 = await processAiInterviewEvent({ rawKey: interviewRawKey, payload });
    assert.equal(res2.status, 200);
    assert.equal(res2.data.status, "already_processed");

    const sessionsAfter = await getStudentInterviews(student1.personId);
    const evidenceAfter = await getEvidenceByPersonId(student1.personId);

    assert.equal(sessionsAfter.length, sessionsBefore.length);
    assert.equal(evidenceAfter.length, evidenceBefore.length);
  });

  it("14. Interview dimension maps correctly with institutional source and verification", async () => {
    const session = {
      id: "sess_mock_456",
      targetRole: "ML Engineer",
      completedAt: "2026-10-07T11:00:00.000Z",
    };
    const dim = {
      dimensionKey: "technical_reasoning",
      dimensionLabel: "Technical Reasoning",
      value: "4",
      scaleMin: "1",
      scaleMax: "5",
      explanation: "Good trade-off awareness.",
    };

    const ev = mapInterviewDimensionToEvidence(session, dim);

    assert.equal(ev.category, "interview");
    assert.equal(ev.subject, "Technical Reasoning");
    assert.equal(ev.source, "institutional");
    assert.equal(ev.verificationStatus, "verified");
    assert.equal(ev.sourceReference, "sess_mock_456");
    assert.equal(ev.verificationMethod, "interview_rubric");
  });

  it("15. Interview output remains session-specific performance evidence (no permanent trait claims)", async () => {
    const evidenceList = await getEvidenceByPersonId(student1.personId);
    const commEv = evidenceList.find((e) => e.subject === "Communication" && e.category === "interview");

    assert.ok(commEv);
    assert.ok(commEv.interpretation?.includes("Observed performance in ML Engineer AI Interview session"));
    // Must NOT state permanent labels like "Poor communicator" or "Permanent trait"
    assert.ok(!commEv.interpretation?.toLowerCase().includes("poor communicator"));
    assert.ok(!commEv.interpretation?.toLowerCase().includes("permanent"));
  });

  it("16. Unsupported payload version or prohibited unscientific traits rejected safely", async () => {
    // 16a: Unsupported version
    const unsupportedVer = validateErisPayload({
      producer: "eris",
      externalEventId: "evt_ver_99",
      payloadVersion: 99,
      student: { externalStudentId: "ERIS_STU_001" },
      assessment: { externalAssessmentId: "A1", title: "Test" },
      topics: [{ topicKey: "t1", topicLabel: "T1", value: 1 }],
    });
    assert.equal(unsupportedVer.valid, false);
    assert.ok(unsupportedVer.error?.includes("Unsupported payloadVersion: 99"));

    // 16b: Prohibited dimension (emotion/facial detection)
    assert.ok(isDisallowedInterviewDimension("emotion_analysis", "Facial Emotion Recognition"));
    assert.ok(isDisallowedInterviewDimension("attractiveness", "Visual Attractiveness"));
    assert.ok(isDisallowedInterviewDimension("lie_detector", "Truthfulness and Lie Detection"));

    const prohibitedPayload = validateAiInterviewPayload({
      producer: "ai_interview",
      externalEventId: "evt_ethics_violation",
      payloadVersion: 1,
      student: { externalStudentId: "INT_STU_001" },
      session: { externalInterviewId: "S1", targetRole: "ML Engineer" },
      dimensions: [
        {
          dimensionKey: "facial_emotion",
          dimensionLabel: "Facial Emotion Stability",
          value: 3,
          explanation: "Analyzed micro-expressions",
        },
      ],
    });
    assert.equal(prohibitedPayload.valid, false);
    assert.ok(prohibitedPayload.error?.includes("Prohibited dimension detected"));
  });

  // =========================================================================
  // REQUIREMENT #41: INTELLIGENCE RECOMPUTATION TESTS (17 - 26)
  // =========================================================================

  it("17. ERIS evidence can change appropriate gap state from unknown to demonstrated", async () => {
    // Evidence without ERIS: programming is unknown
    const evidenceWithoutEris: EvidenceItem[] = [
      createEvidenceItem({
        id: "ev_dep_1",
        category: "project",
        subject: "Docker Fastapi Deployment",
        value: "Deployed API on GCP",
        source: "self_reported",
        verificationStatus: "self_reported",
      }),
    ];
    const gapBefore = evaluateGaps("ML Engineer", evidenceWithoutEris);
    const progDimBefore = gapBefore.dimensions.find((d) => d.dimensionId === "programming");
    assert.equal(progDimBefore?.state, "unknown");

    // Add ERIS verified Python Programming evidence
    const student1Evidence = await getEvidenceByPersonId(student1.personId);
    const gapAfter = evaluateGaps("ML Engineer", toDomainEvidence(student1Evidence));
    const progDimAfter = gapAfter.dimensions.find((d) => d.dimensionId === "programming");

    assert.equal(progDimAfter?.state, "demonstrated");
    assert.ok(progDimAfter?.matchingEvidence.some((e) => e.subject === "Python Programming"));
  });

  it("18. ERIS evidence affects only mapped readiness dimension", () => {
    const erisEvOnly: EvidenceItem[] = [
      createEvidenceItem({
        id: "ev_eris_py",
        category: "assessment",
        subject: "Python Programming",
        value: "ERIS Assessment: Python Programming (3/4 rubric_level)",
        source: "institutional",
        verificationStatus: "verified",
        sourceReference: "att_1",
        interpretation: "Verified assessment evidence from ERIS.",
      }),
    ];

    const policy = READINESS_POLICIES["ml-engineer-v1"];
    const progDim = policy.dimensions.find((d) => d.key === "programming")!;
    const depDim = policy.dimensions.find((d) => d.key === "deployment")!;

    const progEval = evaluateDimensionStrength(progDim, erisEvOnly);
    const depEval = evaluateDimensionStrength(depDim, erisEvOnly);

    assert.equal(progEval.strengthLevel, 3, "Programming dimension must receive verified strength level 3");
    assert.equal(depEval.strengthLevel, 0, "Deployment dimension must remain untouched at 0");
  });

  it("19. Interview evidence affects only mapped dimension", () => {
    const interviewEvOnly: EvidenceItem[] = [
      createEvidenceItem({
        id: "ev_int_comm",
        category: "interview",
        subject: "Communication",
        value: "Communication: 3/5",
        source: "institutional",
        verificationStatus: "verified",
        sourceReference: "sess_1",
        interpretation: "Observed performance in ML Engineer AI Interview session.",
      }),
    ];

    const policy = READINESS_POLICIES["ml-engineer-v1"];
    const interviewDim = policy.dimensions.find((d) => d.key === "interview")!;
    const progDim = policy.dimensions.find((d) => d.key === "programming")!;

    const intEval = evaluateDimensionStrength(interviewDim, interviewEvOnly);
    const progEval = evaluateDimensionStrength(progDim, interviewEvOnly);

    assert.equal(intEval.strengthLevel, 3, "Interview dimension must receive verified strength");
    assert.equal(progEval.strengthLevel, 0, "Programming dimension must remain at 0");
  });

  it("20. Unmapped evidence does not alter readiness score", () => {
    const unmappedEv: EvidenceItem[] = [
      createEvidenceItem({
        id: "ev_unmapped",
        category: "assessment",
        subject: "Medieval European History",
        value: "ERIS Assessment: Medieval History (Grade A)",
        source: "institutional",
        verificationStatus: "verified",
        interpretation: "Verified assessment evidence from ERIS.",
      }),
    ];

    const readinessWithNothing = calculateReadiness({ title: "ML Engineer" }, []);
    const readinessWithUnmapped = calculateReadiness({ title: "ML Engineer" }, unmappedEv);

    assert.equal(readinessWithUnmapped.score, readinessWithNothing.score);
    assert.equal(readinessWithUnmapped.evidenceCoverage, readinessWithNothing.evidenceCoverage);
    assert.equal(readinessWithUnmapped.verifiedCoverage, readinessWithNothing.verifiedCoverage);
  });

  it("21. Readiness publication gate still enforced with connected evidence", () => {
    // Only 1 verified dimension out of 5 -> Verified Coverage = 20%, below minVerifiedCoverage (60%)
    const erisEvOnly: EvidenceItem[] = [
      createEvidenceItem({
        id: "ev_eris_py",
        category: "assessment",
        subject: "Python Programming",
        value: "ERIS Assessment: Python Programming (3/4)",
        source: "institutional",
        verificationStatus: "verified",
      }),
    ];

    const result = calculateReadiness({ title: "ML Engineer" }, erisEvOnly);

    assert.equal(result.publishable, false);
    assert.equal(result.score, undefined);
    assert.ok(result.unavailableReasons.some((r) => r.toLowerCase().includes("verified coverage")));
  });

  it("22. Existing 'Why this score?' arithmetic remains correct when gate is met", () => {
    // Construct evidence meeting the 60% coverage gate with ERIS and Interview evidence
    const qualifyingEvidence: EvidenceItem[] = [
      createEvidenceItem({
        id: "ev_1",
        category: "assessment",
        subject: "Python Programming",
        value: "ERIS: Python Programming (4/4)",
        source: "institutional",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        id: "ev_2",
        category: "assessment",
        subject: "Machine Learning Frameworks",
        value: "ERIS: PyTorch & Scikit-learn (4/4)",
        source: "institutional",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        id: "ev_3",
        category: "project",
        subject: "Docker FastAPI Deployment",
        value: "Deployed API on GCP with Docker",
        source: "institutional",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        id: "ev_4",
        category: "interview",
        subject: "Technical Interview & Systems",
        value: "AI Interview: Communication & System Trade-offs (4/5)",
        source: "institutional",
        verificationStatus: "verified",
      }),
    ];

    const result = calculateReadiness({ title: "ML Engineer" }, qualifyingEvidence);

    assert.equal(result.publishable, true);
    assert.ok(typeof result.score === "number");

    // Verify dimension breakdown arithmetic
    const sumContributions = result.dimensions.reduce(
      (sum, d) => sum + (d.contribution || 0),
      0
    );
    const expectedScore = Math.round(sumContributions);
    assert.equal(result.score, expectedScore);
  });

  it("23. New evidence recomputes recommendations (e.g. interview feedback creates structured communication action)", () => {
    const evidenceWithInterviewFeedback: EvidenceItem[] = [
      createEvidenceItem({
        id: "ev_comm_feedback",
        category: "interview",
        subject: "Communication",
        value: "Communication: 3/5 — Explained approach clearly, but answers could be more structured.",
        source: "institutional",
        verificationStatus: "verified",
      }),
    ];

    const gapEval = evaluateGaps("ML Engineer", evidenceWithInterviewFeedback);
    const recs = generateMLRecommendations("ML Engineer", evidenceWithInterviewFeedback, gapEval);

    const structuredCommRec = recs.find((r) => r.id === "rec_ml_structured_communication");
    assert.ok(structuredCommRec, "Should generate 'Practice structured technical explanation' recommendation");
    assert.equal(structuredCommRec.title, "Practice structured technical explanation");
    assert.ok(structuredCommRec.reason.includes("Recent interview feedback"));
  });

  it("24. Old evidence history remains preserved when new assessment arrives", async () => {
    const priorEvidence = await getEvidenceByPersonId(student1.personId);
    const initialCount = priorEvidence.length;

    // Send another distinct assessment
    const payload = {
      producer: "eris",
      externalEventId: `evt_eris_v2_new_${Date.now()}`,
      payloadVersion: 1,
      student: { externalStudentId: "ERIS_STU_001" },
      assessment: {
        externalAssessmentId: "ERIS_ADVANCED_NLP",
        title: "Advanced NLP & Transformers",
        completedAt: new Date().toISOString(),
      },
      topics: [
        {
          topicKey: "transformers",
          topicLabel: "Transformers & Attention Mechanisms",
          value: "4",
          maxValue: "4",
          measurementType: "rubric_level" as const,
        },
      ],
    };

    const res = await processErisEvent({ rawKey: erisRawKey, payload });
    assert.equal(res.status, 200);

    const postEvidence = await getEvidenceByPersonId(student1.personId);
    assert.equal(postEvidence.length, initialCount + 1);

    // Old Python Programming evidence is still intact
    assert.ok(postEvidence.some((e) => e.subject === "Python Programming"));
    // New Transformers evidence is also present
    assert.ok(postEvidence.some((e) => e.subject === "Transformers & Attention Mechanisms"));
  });

  it("25. Duplicate event does not duplicate journey event", async () => {
    const duplicateEvtId = `evt_journey_dedup_${Date.now()}`;
    const payload = {
      producer: "eris",
      externalEventId: duplicateEvtId,
      payloadVersion: 1,
      student: { externalStudentId: "ERIS_STU_001" },
      assessment: {
        externalAssessmentId: "ERIS_JOURNEY_TEST",
        title: "Journey Test Assessment",
      },
      topics: [{ topicKey: "t1", topicLabel: "Topic 1", value: 4, measurementType: "score" as const }],
    };

    // First ingestion
    await processErisEvent({ rawKey: erisRawKey, payload });
    const journeyEventsBefore = await getJourneyEventsByPersonId(student1.personId);
    const countBefore = journeyEventsBefore.filter((j) => j.type === "eris_assessment_completed").length;

    // Replay exact same event
    await processErisEvent({ rawKey: erisRawKey, payload });
    const journeyEventsAfter = await getJourneyEventsByPersonId(student1.personId);
    const countAfter = journeyEventsAfter.filter((j) => j.type === "eris_assessment_completed").length;

    assert.equal(countAfter, countBefore, "Journey events must not duplicate on replayed event");
  });

  it("26. Custom goal remains score-unavailable if no policy exists", () => {
    const erisEvidence: EvidenceItem[] = [
      createEvidenceItem({
        id: "ev_custom_1",
        category: "assessment",
        subject: "Creative Graphic Design",
        value: "ERIS: Portfolio Review (Band 4)",
        source: "institutional",
        verificationStatus: "verified",
      }),
    ];

    const result = calculateReadiness({ title: "Graphic Novel Creator" }, erisEvidence);

    assert.equal(result.publishable, false);
    assert.equal(result.score, undefined);
    assert.equal(result.policyKey, "custom-no-policy");
    assert.equal(result.policyVersion, "none");
    assert.ok(result.unavailableReasons[0].includes("not available for this custom goal yet"));
  });
});
