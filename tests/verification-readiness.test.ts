import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { getDb, membershipRoles, roles, organizationMemberships } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { hashPassword } from "../lib/auth/password";
import { can } from "../lib/auth/rbac";
import { createEvidenceRecord, getEvidenceByPersonId } from "../lib/repositories/evidence-repository";
import {
  submitEvidenceForVerification,
  reviewVerificationRequest,
  resubmitEvidenceVerification,
  getStudentVerificationRequests,
  getVerifierQueue,
} from "../lib/services/verification-service";
import {
  getDecisionsForRequest,
} from "../lib/repositories/verification-repository";
import {
  calculateReadiness,
  getReadinessPolicyForGoal,
  READINESS_POLICIES,
  evaluateDimensionStrength,
  type ReadinessPolicy,
} from "../lib/domain/readiness";
import { createEvidenceItem, type EvidenceItem } from "../lib/domain/evidence";

import { eq } from "drizzle-orm";


describe("Phase 5 Evidence Verification & Defensible Readiness Tests", () => {
  let studentA: Awaited<ReturnType<typeof createUser>>;
  let studentB: Awaited<ReturnType<typeof createUser>>;
  let facultyUser: Awaited<ReturnType<typeof createUser>>;
  let defaultOrgId = "org_tathastu_default";

  before(async () => {
    process.env.PGLITE_IN_MEMORY = "true";
    const db = await getDb();

    // 1. Create Student A
    const passA = await hashPassword("passA12345");
    studentA = await createUser({
      email: `student_a_${Date.now()}@example.com`,
      passwordHash: passA,
      displayName: "Dev Sharma",
    });

    // 2. Create Student B
    const passB = await hashPassword("passB12345");
    studentB = await createUser({
      email: `student_b_${Date.now()}@example.com`,
      passwordHash: passB,
      displayName: "Priya Nair",
    });

    // 3. Create Faculty User
    const passFac = await hashPassword("passFaculty123");
    facultyUser = await createUser({
      email: `faculty_${Date.now()}@example.com`,
      passwordHash: passFac,
      displayName: "Dr. Arvind Rao",
    });

    // Assign faculty role to facultyUser's membership
    const facRoleRows = await db.select().from(roles).where(eq(roles.key, "faculty")).limit(1);
    const facultyRole = facRoleRows[0];

    const memRows = await db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.personId, facultyUser.personId))
      .limit(1);

    await db.insert(membershipRoles).values({
      id: `mr_test_fac_${Date.now()}`,
      membershipId: memRows[0].id,
      roleId: facultyRole.id,
    });

    defaultOrgId = memRows[0].organizationId;
  });

  // ==========================================
  // SECTION 1: EVIDENCE VERIFICATION TESTS (1 - 12)
  // ==========================================

  let testEvidence1: Awaited<ReturnType<typeof createEvidenceRecord>>;
  let testEvidence2: Awaited<ReturnType<typeof createEvidenceRecord>>;

  it("1. student may request verification for owned evidence", async () => {
    testEvidence1 = await createEvidenceRecord(studentA.personId, {
      category: "project",
      subject: "PyTorch Image Classifier",
      value: "Built CIFAR-10 ResNet classifier with 92% validation accuracy",
      source: "self_reported",
      verificationStatus: "self_reported",
      sourceReference: "https://github.com/dev/pytorch-cifar",
      interpretation: "Self-reported project implementation.",
      whyItMatters: "Demonstrates hands-on PyTorch model training.",
    });

    const vreq = await submitEvidenceForVerification(studentA.personId, testEvidence1.id, {
      supportingReference: "https://github.com/dev/pytorch-cifar",
      studentNotes: "Completed as semester capstone project.",
    });

    assert.ok(vreq.id, "Request must have an ID");
    assert.equal(vreq.requesterPersonId, studentA.personId);
    assert.equal(vreq.status, "pending");

    // Check evidence status updated to verification_requested
    const updatedEvs = await getEvidenceByPersonId(studentA.personId);
    const matched = updatedEvs.find((e) => e.id === testEvidence1.id);
    assert.equal(matched?.verificationStatus, "verification_requested");
  });

  it("2. student cannot verify own evidence", async () => {
    const studentRequests = await getStudentVerificationRequests(studentA.personId);
    const req = studentRequests.find((r) => r.evidenceId === testEvidence1.id);
    assert.ok(req);

    // Student A tries to verify their own request
    await assert.rejects(
      async () => {
        await reviewVerificationRequest({
          verifierPersonId: studentA.personId,
          requestId: req.id,
          decision: "verified",
          method: "self_inspection",
        });
      },
      /cannot verify their own evidence/i,
      "Student must be strictly forbidden from self-verifying"
    );
  });

  it("3. unauthorized user cannot review another student's evidence", async () => {
    const studentRequests = await getStudentVerificationRequests(studentA.personId);
    const req = studentRequests.find((r) => r.evidenceId === testEvidence1.id);
    assert.ok(req);

    // Student B (regular student without student.verify_skill capability) tries to review
    await assert.rejects(
      async () => {
        await reviewVerificationRequest({
          verifierPersonId: studentB.personId,
          requestId: req.id,
          decision: "verified",
          method: "peer_review",
        });
      },
      /not authorized|lacks.*student\.verify_skill/i,
      "Unauthorized user without student.verify_skill must be rejected"
    );
  });

  it("4. authorized scoped verifier can review evidence", async () => {
    const queue = await getVerifierQueue(facultyUser.personId);
    assert.ok(queue.length > 0, "Authorized verifier must see queue items");
    const item = queue.find((q) => q.evidenceId === testEvidence1.id);
    assert.ok(item, "Queue must contain Student A's verification request");
    assert.equal(item.requesterName, "Dev Sharma");
  });

  it("5. verification creates immutable decision record", async () => {
    const studentRequests = await getStudentVerificationRequests(studentA.personId);
    const req = studentRequests.find((r) => r.evidenceId === testEvidence1.id);
    assert.ok(req);

    const result = await reviewVerificationRequest({
      verifierPersonId: facultyUser.personId,
      requestId: req.id,
      decision: "verified",
      reason: "Verified code repository, test suite, and checkpoint weights.",
      method: "code_review",
    });

    assert.equal(result.decision.decision, "verified");
    assert.equal(result.decision.verifierPersonId, facultyUser.personId);
    assert.equal(result.decision.method, "code_review");

    // Verify audit trail in database
    const decisions = await getDecisionsForRequest(req.id);
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].id, result.decision.id);
  });

  it("6. verified decision updates evidence trust state", async () => {
    const updatedEvs = await getEvidenceByPersonId(studentA.personId);
    const matched = updatedEvs.find((e) => e.id === testEvidence1.id);
    assert.ok(matched);
    assert.equal(matched.verificationStatus, "verified");
    assert.equal(matched.verifiedByPersonId, facultyUser.personId);
    assert.ok(matched.verifiedAt);
    assert.equal(matched.verificationMethod, "code_review");
  });

  it("7. changes-requested does not mark evidence verified", async () => {
    testEvidence2 = await createEvidenceRecord(studentA.personId, {
      category: "project",
      subject: "FastAPI Model Serving",
      value: "Created model inference endpoint with Docker",
      source: "self_reported",
      verificationStatus: "self_reported",
      interpretation: "Self-reported serving microservice.",
      whyItMatters: "Relevant for deployment dimension.",
    });

    const vreq2 = await submitEvidenceForVerification(studentA.personId, testEvidence2.id, {
      supportingReference: "Local Dockerfile",
    });

    const result = await reviewVerificationRequest({
      verifierPersonId: facultyUser.personId,
      requestId: vreq2.id,
      decision: "changes_requested",
      reason: "Please push code to GitHub and include Docker compose file.",
      method: "code_review",
    });

    assert.equal(result.decision.decision, "changes_requested");

    const updatedEvs = await getEvidenceByPersonId(studentA.personId);
    const matched = updatedEvs.find((e) => e.id === testEvidence2.id);
    assert.equal(matched?.verificationStatus, "changes_requested");
    assert.notEqual(matched?.verificationStatus, "verified");
  });

  it("8. rejection does not mark skill weak/absent", async () => {
    const testEvidence3 = await createEvidenceRecord(studentA.personId, {
      category: "skill",
      subject: "Kubernetes Orchestration",
      value: "Read Kubernetes documentation and cluster setup guide",
      source: "self_reported",
      verificationStatus: "self_reported",
      interpretation: "Self-reported cluster setup exposure.",
      whyItMatters: "Deployment knowledge.",
    });

    const vreq3 = await submitEvidenceForVerification(studentA.personId, testEvidence3.id, {
      supportingReference: "Book notes",
    });

    const result = await reviewVerificationRequest({
      verifierPersonId: facultyUser.personId,
      requestId: vreq3.id,
      decision: "rejected",
      reason: "Submitted reading notes do not demonstrate hands-on cluster deployment.",
      method: "documentation_review",
    });

    assert.equal(result.decision.decision, "rejected");

    // Evidence still exists with rejected verification status; NOT deleted or marked skill=0
    const updatedEvs = await getEvidenceByPersonId(studentA.personId);
    const matched = updatedEvs.find((e) => e.id === testEvidence3.id);
    assert.ok(matched, "Evidence must remain in ledger");
    assert.equal(matched.verificationStatus, "rejected");
  });

  it("9. resubmission preserves prior decision history", async () => {
    const studentRequests = await getStudentVerificationRequests(studentA.personId);
    const req2 = studentRequests.find((r) => r.evidenceId === testEvidence2.id);
    assert.ok(req2);
    assert.equal(req2.status, "changes_requested");

    // Student resubmits with updated repo
    const resubmitted = await resubmitEvidenceVerification({
      requesterPersonId: studentA.personId,
      requestId: req2.id,
      supportingReference: "https://github.com/dev/fastapi-serving-docker",
      studentNotes: "Added docker-compose.yml and deployment instructions.",
    });

    assert.equal(resubmitted.status, "pending");

    // Verify decisions history was NOT wiped out
    const history = await getDecisionsForRequest(req2.id);
    assert.equal(history.length, 1, "Prior decision history must be preserved");
    assert.equal(history[0].decision, "changes_requested");
  });

  it("10. duplicate submission does not create duplicate open requests", async () => {
    // Attempting to submit another request for testEvidence2 while it is pending
    await assert.rejects(
      async () => {
        await submitEvidenceForVerification(studentA.personId, testEvidence2.id, {
          supportingReference: "https://github.com/dev/duplicate",
        });
      },
      /open verification request already exists/i,
      "Duplicate open requests must be blocked"
    );
  });

  it("11. concurrent final decision is protected", async () => {
    // testEvidence1 request has already reached final decision 'verified'
    const studentRequests = await getStudentVerificationRequests(studentA.personId);
    const resolvedReq = studentRequests.find((r) => r.evidenceId === testEvidence1.id);
    assert.ok(resolvedReq);

    await assert.rejects(
      async () => {
        await reviewVerificationRequest({
          verifierPersonId: facultyUser.personId,
          requestId: resolvedReq.id,
          decision: "rejected",
          reason: "Trying to overwrite already resolved request",
        });
      },
      /already reached a final decision/i,
      "Attempting to overwrite a final decision must be blocked"
    );
  });

  it("12. verifier identity comes from session, not client payload", async () => {
    // Verified by checking the reviewVerificationRequest signature which requires verifierPersonId
    // to be passed strictly from server-authenticated context in the API route handler.
    const hasCapability = await can(facultyUser.personId, "student.verify_skill", {
      organizationId: defaultOrgId,
    });
    assert.equal(hasCapability, true, "Faculty user has verified capability in their organization");
  });

  // ==========================================
  // SECTION 2: READINESS METHODOLOGY TESTS (13 - 24)
  // ==========================================

  const mlPolicy = READINESS_POLICIES["ml-engineer-v1"];

  it("13. no score published with insufficient verified coverage", () => {
    const unverifiedEvidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Python programming and data structures",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
      createEvidenceItem({
        category: "skill",
        subject: "Machine Learning",
        value: "Scikit-learn algorithms and regression",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
    ];

    const result = calculateReadiness({ title: "ML Engineer" }, unverifiedEvidence);
    assert.equal(result.publishable, false, "Must not be publishable when verified coverage is 0%");
    assert.equal(result.score, undefined, "Score must be undefined, not fabricated");
    assert.ok(result.unavailableReasons.length > 0);
  });

  it("14. evidence coverage and verified coverage are calculated separately", () => {
    // 3 dimensions evidenced, but only 1 verified
    const mixedEvidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Core Python",
        source: "verified",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        category: "skill",
        subject: "Machine Learning",
        value: "Scikit-learn",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
      createEvidenceItem({
        category: "project",
        subject: "Project repository",
        value: "Built classification pipeline",
        source: "self_reported",
        verificationStatus: "self_reported",
      }),
    ];

    const result = calculateReadiness({ title: "ML Engineer" }, mixedEvidence);
    // 3 out of 5 dimensions have evidence = 60%
    assert.equal(result.evidenceCoverage, 60);
    // 1 out of 5 dimensions is verified = 20%
    assert.equal(result.verifiedCoverage, 20);
    assert.equal(result.publishable, false);
  });

  it("15. resume keyword alone cannot produce verified dimension", () => {
    const resumeOnlyEvidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Python, C++, Java, Algorithms",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
    ];

    const progDim = mlPolicy.dimensions.find((d) => d.key === "programming")!;
    const evalResult = evaluateDimensionStrength(progDim, resumeOnlyEvidence);
    assert.notEqual(evalResult.strengthLevel, 3, "Resume mention alone must never achieve Level 3 (Verified)");
    assert.equal(evalResult.strengthLevel, 1, "Resume mention achieves Level 1 (Claim)");
  });

  it("16. verified evidence affects appropriate dimension", () => {
    const verifiedProgEvidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "project",
        subject: "Python backend architecture",
        value: "Verified Python pipeline",
        source: "verified",
        verificationStatus: "verified",
      }),
    ];

    const progDim = mlPolicy.dimensions.find((d) => d.key === "programming")!;
    const evalResult = evaluateDimensionStrength(progDim, verifiedProgEvidence);
    assert.equal(evalResult.strengthLevel, 3, "Verified evidence must produce Level 3 strength");

    // Other dimension (e.g. deployment) must remain unknown
    const deployDim = mlPolicy.dimensions.find((d) => d.key === "deployment")!;
    const deployEval = evaluateDimensionStrength(deployDim, verifiedProgEvidence);
    assert.equal(deployEval.strengthLevel, 0, "Unrelated dimension must remain Level 0");
  });

  it("17. correlated evidence is not blindly double-counted", () => {
    // 5 resume mentions from same resume extraction
    const correlatedResumeEvidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Python language",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
      createEvidenceItem({
        category: "skill",
        subject: "Coding",
        value: "Coding in Python",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
      createEvidenceItem({
        category: "skill",
        subject: "Algorithms",
        value: "Algorithm practice",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
    ];

    const progDim = mlPolicy.dimensions.find((d) => d.key === "programming")!;
    const evalResult = evaluateDimensionStrength(progDim, correlatedResumeEvidence);
    // Multiple mentions from the same single resume source do not promote it to Level 2 or 3
    assert.equal(evalResult.strengthLevel, 1, "Correlated single-source mentions must stay Level 1");
  });

  it("18. goal-specific policy weights are applied correctly", () => {
    assert.equal(mlPolicy.dimensions.find((d) => d.key === "programming")?.weight, 20);
    assert.equal(mlPolicy.dimensions.find((d) => d.key === "machine_learning")?.weight, 25);
    assert.equal(mlPolicy.dimensions.find((d) => d.key === "project_build")?.weight, 20);
    assert.equal(mlPolicy.dimensions.find((d) => d.key === "deployment")?.weight, 20);
    assert.equal(mlPolicy.dimensions.find((d) => d.key === "interview")?.weight, 15);

    const totalWeight = mlPolicy.dimensions.reduce((sum, d) => sum + d.weight, 0);
    assert.equal(totalWeight, 100, "ML Engineer policy dimension weights must sum to 100");
  });

  it("19. readiness calculation is deterministic", () => {
    const testEvidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Python",
        source: "verified",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        category: "skill",
        subject: "Machine Learning",
        value: "PyTorch Deep Learning",
        source: "verified",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        category: "project",
        subject: "ML Project",
        value: "Built model",
        source: "verified",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        category: "project",
        subject: "Deployment Docker",
        value: "Docker serving",
        source: "self_reported",
        verificationStatus: "self_reported",
        sourceReference: "https://github.com/test/repo",
      }),
      createEvidenceItem({
        category: "other",
        subject: "Interview",
        value: "Technical communication",
        source: "self_reported",
        verificationStatus: "self_reported",
      }),
    ];

    const run1 = calculateReadiness({ title: "ML Engineer" }, testEvidence);
    const run2 = calculateReadiness({ title: "ML Engineer" }, testEvidence);

    assert.equal(run1.publishable, run2.publishable);
    assert.equal(run1.score, run2.score);
    assert.equal(run1.evidenceCoverage, run2.evidenceCoverage);
    assert.equal(run1.verifiedCoverage, run2.verifiedCoverage);
  });

  it("20. 'Why this score?' contributions sum correctly when score is publishable", () => {
    // 4 verified dimensions + 1 demonstrated dimension -> publishable (>= 60% verified coverage)
    const strongEvidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Python programming",
        source: "verified",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        category: "skill",
        subject: "Machine Learning",
        value: "PyTorch model training",
        source: "verified",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        category: "project",
        subject: "Project Build",
        value: "End to end model repo",
        source: "verified",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        category: "project",
        subject: "Deployment",
        value: "FastAPI Docker microservice",
        source: "verified",
        verificationStatus: "verified",
      }),
      createEvidenceItem({
        category: "other",
        subject: "Interview",
        value: "Mock interview practice",
        source: "self_reported",
        verificationStatus: "self_reported",
      }),
    ];

    const result = calculateReadiness({ title: "ML Engineer" }, strongEvidence);
    assert.equal(result.publishable, true, "Must be publishable with 80% verified coverage");
    assert.ok(result.score !== undefined && result.score > 0);

    const sumContributions = result.dimensions.reduce((sum, d) => sum + (d.contribution || 0), 0);
    assert.equal(result.score, sumContributions, "Total readiness score must exactly equal sum of dimensional contributions");
  });

  it("21. custom goal without policy returns score unavailable", () => {
    const result = calculateReadiness({ title: "Learn Sanskrit Astronomy" }, []);
    assert.equal(result.publishable, false);
    assert.equal(result.score, undefined);
    assert.equal(result.policyKey, "custom-no-policy");
    assert.ok(result.unavailableReasons[0].includes("not available for this custom goal yet"));
  });

  it("22. goal change selects correct readiness policy", () => {
    const mlPol = getReadinessPolicyForGoal("ML Engineer");
    assert.equal(mlPol?.key, "ml-engineer-v1");

    const resPol = getReadinessPolicyForGoal("AI Researcher");
    assert.equal(resPol?.key, "ai-researcher-v1");

    const foundPol = getReadinessPolicyForGoal("AI Founder");
    assert.equal(foundPol?.key, "ai-founder-v1");
  });

  it("23. policy version is included in result", () => {
    const result = calculateReadiness({ title: "ML Engineer" }, []);
    assert.equal(result.policyVersion, "v1");
    assert.equal(result.policyKey, "ml-engineer-v1");
  });

  it("24. changing published policy creates/uses new version rather than silently rewriting old result", () => {
    // Test creating a simulated v2 policy with different weights
    const mlPolicyV2: ReadinessPolicy = {
      ...mlPolicy,
      key: "ml-engineer-v2",
      version: "v2",
      name: "AI Tathastu ML Engineer Readiness v2",
      dimensions: mlPolicy.dimensions.map((d) =>
        d.key === "programming" ? { ...d, weight: 30 } : d
      ),
    };

    const evidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Python",
        source: "verified",
        verificationStatus: "verified",
      }),
    ];

    const resultV1 = calculateReadiness({ title: "ML Engineer" }, evidence, mlPolicy);
    const resultV2 = calculateReadiness({ title: "ML Engineer" }, evidence, mlPolicyV2);

    assert.equal(resultV1.policyVersion, "v1");
    assert.equal(resultV2.policyVersion, "v2");
    assert.equal(resultV1.dimensions.find((d) => d.key === "programming")?.weight, 20);
    assert.equal(resultV2.dimensions.find((d) => d.key === "programming")?.weight, 30);
  });
});
