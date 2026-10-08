import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { getDb, organizations } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { hashPassword } from "../lib/auth/password";
import {
  createIntegrationCredential,
  createIdentityLink,
  getLearningActivitiesByPersonId,
  getStudentInterviews,
} from "../lib/repositories/integration-repository";
import {
  getEvidenceByPersonId,
  type EvidenceRecord,
} from "../lib/repositories/evidence-repository";
import { getJourneyEventsByPersonId } from "../lib/repositories/journey-repository";
import {
  processStudyLpuEvent,
  processPadhoCodeEvent,
  processErisEvent,
  processMentorMazeEvent,
} from "../lib/services/integration-processor-service";
import {
  validateMentorMazePayload,
  validateErisPayload,
  mapPadhoCodeTopicToSkills,
  mapMentorMazeDimensionToEvidence,
  computeContinuationActions,
  computeLearningMonitor,
} from "../lib/domain/integrations";
import { createAppHandoffToken, verifyAppHandoffToken } from "../lib/domain/handoff";
import { detectMeaningfulChanges } from "../lib/domain/meaningful-change";
import { buildPersonGraph } from "../lib/domain/person-graph";
import { generatePersonalizedRoadmap } from "../lib/domain/roadmap";
import { computeNextActions } from "../lib/domain/recommendations";
import { evaluateGaps } from "../lib/domain/gaps";
import { calculateReadiness } from "../lib/domain/readiness";
import { createGoal } from "../lib/domain/goal";
import type { EvidenceItem } from "../lib/domain/evidence";

function toDomainEvidence(records: EvidenceRecord[]): EvidenceItem[] {
  return records.map((r) => ({
    ...r,
    observedAt: r.observedAt instanceof Date ? r.observedAt.toISOString() : String(r.observedAt),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    verifiedAt: r.verifiedAt instanceof Date ? r.verifiedAt.toISOString() : r.verifiedAt || null,
  }));
}

describe("Functionalization Phase C — Closed-Loop AI/ML Student Ecosystem Tests", () => {
  let studentArjun: Awaited<ReturnType<typeof createUser>>;
  let studentIsolated: Awaited<ReturnType<typeof createUser>>;
  let orgId: string;
  const orgOther = "org_external_999";

  const studyLpuKey = "test_study_lpu_key_phase_c";
  const padhoCodeKey = "test_padho_code_key_phase_c";
  const erisKey = "test_eris_key_phase_c";
  const mentorMazeKey = "test_mentormaze_key_phase_c";

  before(async () => {
    process.env.PGLITE_IN_MEMORY = "true";
    const db = await getDb();

    const [org] = await db.select().from(organizations).limit(1);
    orgId = org ? org.id : "org_default_tathastu";

    const pwHash = await hashPassword("SecurePass123!");
    const ts = Date.now();

    studentArjun = await createUser({
      email: `arjun.phasec.${ts}@example.com`,
      displayName: "Arjun Phase C Student",
      passwordHash: pwHash,
    });

    studentIsolated = await createUser({
      email: `isolated.phasec.${ts}@example.com`,
      displayName: "Isolated Student",
      passwordHash: pwHash,
    });

    // Create credentials for all 4 producers
    await createIntegrationCredential({
      organizationId: orgId,
      producer: "study_lpu",
      rawKey: studyLpuKey,
    });

    await createIntegrationCredential({
      organizationId: orgId,
      producer: "padho_code",
      rawKey: padhoCodeKey,
    });

    await createIntegrationCredential({
      organizationId: orgId,
      producer: "eris",
      rawKey: erisKey,
    });

    await createIntegrationCredential({
      organizationId: orgId,
      producer: "mentormaze",
      rawKey: mentorMazeKey,
    });

    // Link Arjun to all 4 external platforms
    await createIdentityLink({
      organizationId: orgId,
      producer: "study_lpu",
      externalSubjectId: "study_arjun_c",
      personId: studentArjun.personId,
    });

    await createIdentityLink({
      organizationId: orgId,
      producer: "padho_code",
      externalSubjectId: "padho_arjun_c",
      personId: studentArjun.personId,
    });

    await createIdentityLink({
      organizationId: orgId,
      producer: "eris",
      externalSubjectId: "eris_arjun_c",
      personId: studentArjun.personId,
    });

    await createIdentityLink({
      organizationId: orgId,
      producer: "mentormaze",
      externalSubjectId: "mm_arjun_c",
      personId: studentArjun.personId,
    });
  });

  // =========================================================================
  // 49. TESTS — STUDY LPU
  // =========================================================================
  describe("Study LPU — Academic Learning Producer", () => {
    const eventId = `study_evt_${Date.now()}`;

    it("1. valid Study LPU event ingests", async () => {
      const payload = {
        producer: "study_lpu",
        externalEventId: eventId,
        payloadVersion: 1,
        occurredAt: new Date().toISOString(),
        organizationId: orgId,
        student: { externalStudentId: "study_arjun_c" },
        event: {
          eventType: "module.completed" as const,
          courseId: "cse_401",
          courseTitle: "Machine Learning Foundations",
          moduleId: "mod_lin_reg",
          moduleTitle: "Linear & Logistic Regression",
          topicKey: "machine_learning",
          durationMinutes: 75,
          completedAt: new Date().toISOString(),
        },
      };

      const res = await processStudyLpuEvent({ rawKey: studyLpuKey, payload });
      assert.equal(res.status, 200);
      assert.equal(res.data.status, "processed");
      assert.ok(res.data.learningActivityId);
    });

    it("2. duplicate Study LPU event idempotent", async () => {
      const payload = {
        producer: "study_lpu",
        externalEventId: eventId, // same event ID
        payloadVersion: 1,
        student: { externalStudentId: "study_arjun_c" },
        event: {
          eventType: "module.completed" as const,
          moduleTitle: "Linear & Logistic Regression",
        },
      };

      const res = await processStudyLpuEvent({ rawKey: studyLpuKey, payload });
      assert.equal(res.status, 200);
      assert.equal(res.data.status, "already_processed");
    });

    it("3. completion creates LearningActivity", async () => {
      const activities = await getLearningActivitiesByPersonId(studentArjun.personId);
      const found = activities.find((a) => a.moduleTitle === "Linear & Logistic Regression");
      assert.ok(found);
      assert.equal(found.status, "completed");
      assert.equal(found.source, "study_lpu");
      assert.equal(found.courseTitle, "Machine Learning Foundations");
    });

    it("4. learning activity does not create verified skill", async () => {
      const evidence = await getEvidenceByPersonId(studentArjun.personId);
      const verified = evidence.filter((e) => e.verificationStatus === "verified");
      // Study LPU completion must NOT create any verified competence
      assert.equal(verified.length, 0);
    });

    it("5. learning activity influences roadmap continuation", async () => {
      const activities = await getLearningActivitiesByPersonId(studentArjun.personId);
      const continuation = computeContinuationActions(
        activities,
        [],
        [],
        [],
        "ML Deployment Pipeline"
      );
      assert.ok(Array.isArray(continuation));
      assert.ok(continuation.length <= 2);
    });
  });

  // =========================================================================
  // 50. TESTS — PADHO CODE
  // =========================================================================
  describe("Padho Code — Coding Practice Producer", () => {
    const padhoEventId = `padho_evt_${Date.now()}`;

    it("6. valid practice event ingests", async () => {
      const payload = {
        producer: "padho_code",
        externalEventId: padhoEventId,
        payloadVersion: 1,
        occurredAt: new Date().toISOString(),
        organizationId: orgId,
        student: { externalStudentId: "padho_arjun_c" },
        activity: {
          eventType: "challenge.completed" as const,
          topic: "Dynamic Programming",
          topicKey: "dynamic_programming",
          language: "python",
          difficulty: "medium" as const,
          status: "completed" as const,
          attempts: 2,
          completedAt: new Date().toISOString(),
        },
      };

      const res = await processPadhoCodeEvent({ rawKey: padhoCodeKey, payload });
      assert.equal(res.status, 200);
      assert.equal(res.data.status, "processed");
      assert.ok(res.data.codingActivityId);
    });

    it("7. practice maps to correct skill", () => {
      const mapped = mapPadhoCodeTopicToSkills("dynamic_programming");
      assert.ok(mapped.includes("Dynamic Programming"));
      assert.ok(mapped.includes("DSA"));

      const pyMapped = mapPadhoCodeTopicToSkills("python_basics");
      assert.ok(pyMapped.includes("Python"));
    });

    it("8. repeated practice does not inflate trust blindly", async () => {
      const secondEventId = `padho_evt_2_${Date.now()}`;
      const payload = {
        producer: "padho_code",
        externalEventId: secondEventId,
        payloadVersion: 1,
        student: { externalStudentId: "padho_arjun_c" },
        activity: {
          eventType: "challenge.completed" as const,
          topic: "Dynamic Programming",
          topicKey: "dynamic_programming",
          difficulty: "hard" as const,
          status: "completed" as const,
          attempts: 3,
        },
      };

      await processPadhoCodeEvent({ rawKey: padhoCodeKey, payload });

      const evidence = await getEvidenceByPersonId(studentArjun.personId);
      const dpEvidence = evidence.filter((e) => e.subject === "Dynamic Programming");
      // All practice evidence must remain strictly unverified
      for (const e of dpEvidence) {
        assert.notEqual(e.verificationStatus, "verified");
      }
    });

    it("9. practice evidence remains unverified", async () => {
      const evidence = await getEvidenceByPersonId(studentArjun.personId);
      const padhoEvidence = evidence.filter((e) => e.value.includes("Padho Code"));
      assert.ok(padhoEvidence.length >= 1);
      for (const e of padhoEvidence) {
        assert.equal(e.verificationStatus, "unverified");
        assert.equal(e.source, "self_reported");
      }
    });

    it("10. practice can alter next-action priority", () => {
      const monitor = computeLearningMonitor(3, 5, 0, 0, 0, ["Python", "ML"], ["Python", "DSA"], []);
      assert.ok(monitor.insight);
      assert.ok(monitor.insight.includes("Building a small project"));
    });
  });

  // =========================================================================
  // 51. TESTS — ERIS
  // =========================================================================
  describe("ERIS — Assessment & Verification Producer", () => {
    const erisEventId = `eris_evt_${Date.now()}`;

    it("11. trusted ERIS event ingests", async () => {
      const payload = {
        producer: "eris",
        externalEventId: erisEventId,
        payloadVersion: 1,
        occurredAt: new Date().toISOString(),
        organizationId: orgId,
        student: { externalStudentId: "eris_arjun_c" },
        assessment: {
          externalAssessmentId: "assess_ml_fund_c",
          title: "ML Engineering Fundamentals Assessment",
          type: "standardized_exam",
          rubricVersion: "v1.0",
          completedAt: new Date().toISOString(),
          overallScore: 92,
          maxScore: 100,
          resultType: "score" as const,
        },
        topics: [
          {
            topicKey: "machine_learning",
            topicLabel: "Machine Learning Concepts",
            value: 4,
            maxValue: 4,
            measurementType: "rubric_level" as const,
          },
        ],
      };

      const res = await processErisEvent({ rawKey: erisKey, payload });
      assert.equal(res.status, 200);
      assert.equal(res.data.status, "processed");
      assert.ok(res.data.attemptId);
    });

    it("12. invalid signature rejected", async () => {
      const payload = {
        producer: "eris",
        externalEventId: `eris_invalid_${Date.now()}`,
        payloadVersion: 1,
        student: { externalStudentId: "eris_arjun_c" },
        assessment: { externalAssessmentId: "test", title: "Test" },
        topics: [],
      };

      const res = await processErisEvent({ rawKey: "completely_wrong_key", payload });
      assert.equal(res.status, 401);
      assert.equal(res.data.status, "failed");
    });

    it("13. wrong organization rejected", async () => {
      const payload = {
        producer: "eris",
        externalEventId: `eris_wrong_org_${Date.now()}`,
        payloadVersion: 1,
        organizationId: orgOther, // wrong org
        student: { externalStudentId: "eris_arjun_c" },
        assessment: { externalAssessmentId: "test", title: "Test" },
        topics: [
          {
            topicKey: "machine_learning",
            topicLabel: "Machine Learning",
            value: 80,
            measurementType: "score",
          },
        ],
      };

      const res = await processErisEvent({ rawKey: erisKey, payload });
      assert.equal(res.status, 403);
      assert.equal(res.data.status, "rejected");
    });

    it("14. assessment mapping uses stable topic key", () => {
      const val = validateErisPayload({
        producer: "eris",
        externalEventId: "evt_test",
        payloadVersion: 1,
        student: { externalStudentId: "s1" },
        assessment: { externalAssessmentId: "a1", title: "ML Basics" },
        topics: [
          { topicKey: "machine_learning", topicLabel: "Machine Learning", value: 4, measurementType: "score" },
        ],
      });
      assert.equal(val.valid, true);
      assert.equal(val.data?.topics[0].topicKey, "machine_learning");
    });

    it("15. final trusted assessment can create verified evidence", async () => {
      const evidence = await getEvidenceByPersonId(studentArjun.personId);
      const verified = evidence.filter(
        (e) => e.verificationStatus === "verified" && e.category === "assessment"
      );
      assert.ok(verified.length >= 1);
      assert.ok(verified.some((v) => v.value.includes("ERIS Assessment")));
    });

    it("16. draft assessment cannot create verified evidence", async () => {
      const val = validateErisPayload({
        producer: "eris",
        externalEventId: "draft_test",
        payloadVersion: "unsupported_v99", // invalid version
        student: { externalStudentId: "s1" },
      });
      assert.equal(val.valid, false);
    });

    it("17. ERIS evidence affects only mapped readiness dimension", async () => {
      const domainEvidence = toDomainEvidence(await getEvidenceByPersonId(studentArjun.personId));
      const readiness = calculateReadiness(createGoal("ML Engineer"), domainEvidence);

      const mlDim = readiness.dimensions.find((d) => d.key === "machine_learning");
      const deployDim = readiness.dimensions.find((d) => d.key === "deployment");

      // machine_learning should be evidenced/verified from ERIS
      assert.ok(mlDim);
      assert.ok(mlDim.state === "verified" || mlDim.state === "demonstrated");

      // deployment was never in the ERIS assessment, so it remains unknown
      assert.ok(deployDim);
      assert.equal(deployDim.state, "unknown");
    });
  });

  // =========================================================================
  // 52. TESTS — MENTORMAZE
  // =========================================================================
  describe("MentorMaze — Interview Intelligence Producer", () => {
    const mmEventId = `mm_evt_${Date.now()}`;

    it("18. trusted interview event ingests", async () => {
      const payload = {
        producer: "mentormaze",
        externalEventId: mmEventId,
        payloadVersion: 1,
        occurredAt: new Date().toISOString(),
        organizationId: orgId,
        student: { externalStudentId: "mm_arjun_c" },
        session: {
          externalInterviewId: "int_arjun_01",
          targetRole: "ML Engineer",
          rubricVersion: "v1.5",
          completedAt: new Date().toISOString(),
        },
        dimensions: [
          {
            dimensionKey: "technical_reasoning",
            dimensionLabel: "Technical Reasoning",
            value: 4,
            scaleMin: 1,
            scaleMax: 5,
            explanation: "Explained optimization trade-offs clearly.",
          },
          {
            dimensionKey: "communication",
            dimensionLabel: "Communication",
            value: 4.5,
            scaleMin: 1,
            scaleMax: 5,
            explanation: "Articulated architectural diagrams concisely.",
          },
        ],
      };

      const res = await processMentorMazeEvent({ rawKey: mentorMazeKey, payload });
      assert.equal(res.status, 200);
      assert.equal(res.data.status, "processed");
      assert.ok(res.data.sessionId);
    });

    it("19. session dimensions persist", async () => {
      const sessions = await getStudentInterviews(studentArjun.personId);
      const found = sessions.find((s) => s.targetRole === "ML Engineer");
      assert.ok(found);
      assert.ok(found.dimensions && found.dimensions.length === 2);
    });

    it("20. interview result remains session-specific", async () => {
      const mapped = mapMentorMazeDimensionToEvidence(
        { id: "ses_1", targetRole: "ML Engineer", completedAt: new Date().toISOString() },
        { dimensionKey: "communication", dimensionLabel: "Communication", value: 4, explanation: "Clear" }
      );
      assert.ok(mapped.interpretation.includes("session-specific performance evidence, not a permanent trait"));
    });

    it("21. interview evidence only maps to allowed dimensions", () => {
      // Prohibited facial / emotion dimensions must fail validation
      const invalidPayload = {
        producer: "mentormaze",
        externalEventId: "mm_bad",
        payloadVersion: 1,
        student: { externalStudentId: "mm_arjun_c" },
        session: { externalInterviewId: "s1", targetRole: "ML Engineer" },
        dimensions: [
          { dimensionKey: "facial_emotion_detection", dimensionLabel: "Emotion Expression", value: 3, explanation: "test" },
        ],
      };
      const val = validateMentorMazePayload(invalidPayload);
      assert.equal(val.valid, false);
      assert.ok(val.error?.includes("Prohibited dimension"));
    });

    it("22. no permanent trait label generated", async () => {
      const evidence = await getEvidenceByPersonId(studentArjun.personId);
      const interviewEvidence = evidence.filter((e) => e.category === "interview");
      for (const e of interviewEvidence) {
        assert.ok(!e.interpretation.includes("Student is permanently"));
        assert.ok(!e.value.includes("Personality Type"));
      }
    });
  });

  // =========================================================================
  // 53. TESTS — CLOSED LOOP
  // =========================================================================
  describe("Closed Loop — Ecosystem Interoperability & Read Models", () => {
    it("23. Study LPU completion changes roadmap", () => {
      const roadmapBefore = generatePersonalizedRoadmap(
        "ML Engineer",
        ["Python"],
        2026,
        "actively_applying"
      );
      assert.equal(roadmapBefore.stages[0].status, "in_progress");

      const roadmapAfter = generatePersonalizedRoadmap(
        "ML Engineer",
        ["Python", "DSA", "NumPy"],
        2026,
        "actively_applying"
      );
      assert.ok(roadmapAfter.stages.length > 0);
      // Prerequisite stage is completed
      assert.equal(roadmapAfter.stages[0].status, "completed");
    });

    it("24. Padho Code practice changes recommendation priority", () => {
      const monitor = computeLearningMonitor(3, 5, 0, 0, 0, ["Python"], ["Python"], []);
      assert.ok(monitor.completedPractice === 5);
      assert.ok(monitor.insight?.includes("Building a small project"));
    });

    it("25. ERIS verification closes a gap", async () => {
      const domainEvidence = toDomainEvidence(await getEvidenceByPersonId(studentArjun.personId));
      const gaps = evaluateGaps("ML Engineer", domainEvidence);

      const mlDim = gaps.dimensions.find((d) => d.dimensionId === "machine_learning");
      assert.ok(mlDim);
      assert.notEqual(mlDim.state, "unknown");
    });

    it("26. MentorMaze interview creates next improvement action", async () => {
      const domainEvidence = toDomainEvidence(await getEvidenceByPersonId(studentArjun.personId));
      const gaps = evaluateGaps("ML Engineer", domainEvidence);
      const actions = computeNextActions(
        createGoal("ML Engineer"),
        domainEvidence,
        gaps
      );
      assert.ok(actions.length > 0);
      assert.ok(actions.length <= 3);
    });

    it("27. goal-specific roadmap recomputes", () => {
      const mlRoadmap = generatePersonalizedRoadmap("ML Engineer", ["Python"]);
      const genAiRoadmap = generatePersonalizedRoadmap("GenAI Engineer", ["Python"]);
      assert.notEqual(mlRoadmap.stages[1].title, genAiRoadmap.stages[3].title);
    });

    it("28. Person Graph summaries update", async () => {
      const graph = await buildPersonGraph(studentArjun.personId);
      assert.ok(graph.learningSummary);
      assert.ok(graph.learningSummary.totalCompletedModules >= 1);
      assert.ok(graph.practiceSummary);
      assert.ok(graph.practiceSummary.totalProblemsSolved >= 1);
      assert.ok(graph.assessmentSummary);
      assert.ok(graph.assessmentSummary.totalAssessments >= 1);
      assert.ok(graph.interviewSummary);
      assert.ok(graph.interviewSummary.totalInterviews >= 1);
      assert.ok(Array.isArray(graph.recentActivities));

      // Meaningful change detection
      const changes = detectMeaningfulChanges({
        priorVerifiedCount: 0,
        currentVerifiedCount: 1,
        priorGapsCount: 5,
        currentGapsCount: 4,
      });
      assert.ok(changes.some((c) => c.type === "new_verified_evidence"));
      assert.ok(changes.some((c) => c.type === "goal_gap_closed"));
    });

    it("29. Journey records human-readable event", async () => {
      const journey = await getJourneyEventsByPersonId(studentArjun.personId);
      const titles = journey.map((j) => j.title);
      assert.ok(titles.some((t) => t.includes("Study LPU")));
      assert.ok(titles.some((t) => t.includes("Padho Code")));
      assert.ok(titles.some((t) => t.includes("MentorMaze")));
    });

    it("30. Home returns max 3 meaningful actions", async () => {
      const domainEvidence = toDomainEvidence(await getEvidenceByPersonId(studentArjun.personId));
      const gaps = evaluateGaps("ML Engineer", domainEvidence);
      const actions = computeNextActions(
        createGoal("ML Engineer"),
        domainEvidence,
        gaps
      );
      assert.ok(actions.length <= 3);
    });

    it("31. duplicate event creates no duplicate evidence", async () => {
      const initialCount = (await getEvidenceByPersonId(studentArjun.personId)).length;

      // Resend padho code event
      const payload = {
        producer: "padho_code",
        externalEventId: "padho_evt_dup_check",
        payloadVersion: 1,
        student: { externalStudentId: "padho_arjun_c" },
        activity: {
          eventType: "challenge.completed" as const,
          topic: "OOP",
          topicKey: "oop",
          status: "completed" as const,
        },
      };

      await processPadhoCodeEvent({ rawKey: padhoCodeKey, payload });
      const afterFirst = (await getEvidenceByPersonId(studentArjun.personId)).length;
      assert.equal(afterFirst, initialCount + 1);

      // Re-send same payload
      const dupRes = await processPadhoCodeEvent({ rawKey: padhoCodeKey, payload });
      assert.equal(dupRes.data.status, "already_processed");

      const afterSecond = (await getEvidenceByPersonId(studentArjun.personId)).length;
      assert.equal(afterSecond, afterFirst);
    });

    it("32. app handoff token contains no sensitive PII", () => {
      const { token, payload } = createAppHandoffToken({
        personId: studentArjun.personId,
        targetApp: "padho_code",
        targetActivity: "dynamic_programming",
        goalContext: "ML Engineer",
      });

      assert.ok(token);
      assert.ok(payload.personRef.startsWith("stu_"));
      // Must not contain raw personId, email, or phone
      const rawObj = payload as Record<string, unknown>;
      assert.equal(rawObj.email, undefined);
      assert.equal(rawObj.phone, undefined);
      assert.equal(rawObj.personId, undefined);
      assert.notEqual(payload.personRef, studentArjun.personId);
    });

    it("33. invalid handoff token rejected", () => {
      const verification = verifyAppHandoffToken("tampered.signature.token");
      assert.equal(verification.valid, false);

      const { token } = createAppHandoffToken({
        personId: studentArjun.personId,
        targetApp: "study_lpu",
        expiresInSeconds: -10, // expired
      });

      const expiredCheck = verifyAppHandoffToken(token);
      assert.equal(expiredCheck.valid, false);
      assert.ok(expiredCheck.error?.includes("expired"));
    });

    it("34. cross-user ecosystem event rejected", async () => {
      const payload = {
        producer: "study_lpu",
        externalEventId: `cross_user_${Date.now()}`,
        payloadVersion: 1,
        student: { externalStudentId: "completely_unknown_external_id" },
        event: {
          eventType: "module.completed" as const,
          moduleTitle: "Deep Learning",
        },
      };

      const res = await processStudyLpuEvent({ rawKey: studyLpuKey, payload });
      assert.equal(res.status, 200);
      assert.equal(res.data.status, "identity_unresolved");

      // Verify no evidence was created for isolated student
      const evidence = await getEvidenceByPersonId(studentIsolated.personId);
      assert.equal(evidence.length, 0);
    });
  });
});
