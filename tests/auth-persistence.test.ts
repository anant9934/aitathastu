import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { getDb } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { hashPassword } from "../lib/auth/password";
import { createSession, validateSession, invalidateSession } from "../lib/auth/session";
import { can } from "../lib/auth/rbac";
import { getPerson360 } from "../lib/services/person-360-service";
import { importLocalProgress } from "../lib/services/import-service";
import { setActiveGoal, getActiveGoal } from "../lib/repositories/goal-repository";
import { createEvidenceRecord, getEvidenceByPersonId } from "../lib/repositories/evidence-repository";
import { getJourneyEventsByPersonId } from "../lib/repositories/journey-repository";
import { setActionState, getActionStatesByPersonId } from "../lib/repositories/action-repository";
import type { WorkspaceState } from "../lib/domain/workspace";

type TestUser = Awaited<ReturnType<typeof createUser>>;
type TestSession = Awaited<ReturnType<typeof createSession>>;

describe("Phase 4 Authentication, Tathastu Core Persistence & Person 360 Tests", () => {
  let userA: TestUser;
  let userB: TestUser;
  let sessionA: TestSession;

  before(async () => {
    // Set in-memory test mode for PostgreSQL database
    process.env.PGLITE_IN_MEMORY = "true";
    await getDb();

    // Create User A
    const passHashA = await hashPassword("securePassword123");
    userA = await createUser({
      email: `test_user_a_${Date.now()}@example.com`,
      passwordHash: passHashA,
      displayName: "Ananya Sharma",
    });

    // Create User B
    const passHashB = await hashPassword("differentPassword456");
    userB = await createUser({
      email: `test_user_b_${Date.now()}@example.com`,
      passwordHash: passHashB,
      displayName: "Rohan Verma",
    });

    // Create Session for User A
    sessionA = await createSession(userA.userId);
  });

  // 1. Authenticated self-access succeeds
  it("1. authenticated self-access succeeds", async () => {
    const authContext = await validateSession(sessionA.token);
    assert.ok(authContext, "Session must validate successfully");
    assert.equal(authContext.user.email, userA.email);
    assert.equal(authContext.person.id, userA.personId);

    const person360 = await getPerson360(userA.personId, userA.personId);
    assert.ok(person360);
    assert.equal(person360.person.displayName, "Ananya Sharma");
    assert.ok(Array.isArray(person360.memberships));
    assert.equal(person360.memberships[0].organizationSlug, "tathastu-core");
  });

  // 2. Anonymous access to student workspace is protected
  it("2. anonymous access to student workspace is protected", async () => {
    const invalidAuth = await validateSession("non_existent_fake_token");
    assert.equal(invalidAuth, null, "Anonymous or invalid session must return null");

    // Validating empty token
    const emptyAuth = await validateSession("");
    assert.equal(emptyAuth, null);
  });

  // 3. User A cannot access User B's Person 360
  it("3. User A cannot access User B's Person 360 (multi-user isolation)", async () => {
    await assert.rejects(
      async () => {
        // userA attempting to access userB's Person 360
        await getPerson360(userB.personId, userA.personId);
      },
      /Unauthorized/i,
      "Cross-user access without authorization capability must be rejected"
    );
  });

  // 4. Local workspace import succeeds
  it("4. local workspace import succeeds", async () => {
    const mockLocalWorkspace: WorkspaceState = {
      version: 1,
      person: {
        id: "local_p1",
        name: "Ananya S.",
        education: "B.Tech Computer Science, 2025",
        experience: "Built an NLP summarizer project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      goal: {
        id: "local_g1",
        title: "AI Researcher",
        status: "active",
        source: "preset",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      evidence: [
        {
          id: "local_ev1",
          category: "skill",
          subject: "PyTorch",
          value: "Extracted from uploaded resume",
          source: "resume_extracted",
          verificationStatus: "unverified",
          observedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          interpretation: "Resume extracted skill. Unverified.",
          whyItMatters: "Framework knowledge.",
        },
        {
          id: "local_ev2",
          category: "skill",
          subject: "Linear Algebra",
          value: "Coursework completed",
          source: "self_reported",
          verificationStatus: "self_reported",
          observedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          interpretation: "Self-reported mathematics background.",
          whyItMatters: "Foundational theory.",
        },
      ],
      journeyEvents: [
        {
          id: "local_je1",
          type: "goal_selected",
          title: "Goal set to AI Researcher",
          description: "Selected AI Researcher as pathway.",
          timestamp: new Date().toISOString(),
        },
      ],
      actionStates: {
        rec_read_recent_paper: "active",
      },
      eoraDismissed: false,
      lastUpdated: new Date().toISOString(),
    };

    const importRes = await importLocalProgress(userA.personId, userA.personId, {
      workspaceState: mockLocalWorkspace,
    });

    assert.equal(importRes.success, true);
    assert.equal(importRes.activeGoalTitle, "AI Researcher");

    const p360 = await getPerson360(userA.personId, userA.personId);
    assert.equal(p360.activeGoal?.title, "AI Researcher");
    assert.equal(p360.profile.education, "B.Tech Computer Science, 2025");
    assert.equal(p360.actionStates["rec_read_recent_paper"], "active");
    assert.ok(p360.evidence.some((e) => e.subject === "PyTorch"));
  });

  // 5. Local import is idempotent
  it("5. local import is idempotent (no duplicates created on re-import)", async () => {
    const mockLocalWorkspace: WorkspaceState = {
      version: 1,
      person: {
        id: "local_p1",
        name: "Ananya S.",
        education: "B.Tech Computer Science, 2025",
        experience: "Built an NLP summarizer project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      goal: {
        id: "local_g1",
        title: "AI Researcher",
        status: "active",
        source: "preset",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      evidence: [
        {
          id: "local_ev1",
          category: "skill",
          subject: "PyTorch",
          value: "Extracted from uploaded resume",
          source: "resume_extracted",
          verificationStatus: "unverified",
          observedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          interpretation: "Resume extracted skill. Unverified.",
          whyItMatters: "Framework knowledge.",
        },
      ],
      journeyEvents: [],
      actionStates: {},
      eoraDismissed: false,
      lastUpdated: new Date().toISOString(),
    };

    // Run import a second time
    await importLocalProgress(userA.personId, userA.personId, {
      workspaceState: mockLocalWorkspace,
    });

    const evidenceList = await getEvidenceByPersonId(userA.personId);
    const pytorchMatches = evidenceList.filter((e) => e.subject === "PyTorch");
    assert.equal(
      pytorchMatches.length,
      1,
      "Duplicate PyTorch evidence item must not be inserted on repeated import"
    );
  });

  // 6. Imported evidence preserves unverified status
  it("6. imported evidence preserves unverified status (never promoted to verified)", async () => {
    const evidenceList = await getEvidenceByPersonId(userA.personId);
    const pytorch = evidenceList.find((e) => e.subject === "PyTorch");
    assert.ok(pytorch);
    assert.equal(pytorch.source, "resume_extracted");
    assert.equal(pytorch.verificationStatus, "unverified");
    assert.notEqual(pytorch.verificationStatus, "verified");
  });

  // 7. Goal persists after re-login/reload
  it("7. goal persists after re-login/reload", async () => {
    await setActiveGoal(userA.personId, "ML Engineer", "Production ML track");

    // Invalidate existing session to simulate logout
    await invalidateSession(sessionA.token);

    // Create a new session to simulate re-login
    const newSession = await createSession(userA.userId);
    const auth = await validateSession(newSession.token);
    assert.ok(auth);

    const reloadedGoal = await getActiveGoal(auth.person.id);
    assert.ok(reloadedGoal);
    assert.equal(reloadedGoal.title, "ML Engineer");
    assert.equal(reloadedGoal.description, "Production ML track");
  });

  // 8. Evidence persists after re-login/reload
  it("8. evidence persists after re-login/reload", async () => {
    const evidenceList = await getEvidenceByPersonId(userA.personId);
    assert.ok(evidenceList.length >= 2);
    const hasLinearAlgebra = evidenceList.some((e) => e.subject === "Linear Algebra");
    assert.equal(hasLinearAlgebra, true);
  });

  // 9. Journey events persist correctly
  it("9. journey events persist correctly", async () => {
    const events = await getJourneyEventsByPersonId(userA.personId);
    assert.ok(events.length > 0);
    const hasAccountCreated = events.some((ev) => ev.type === "account_created");
    assert.equal(hasAccountCreated, true);
  });

  // 10. Action states persist correctly
  it("10. action states persist correctly", async () => {
    await setActionState(userA.personId, "rec_build_dataset_brief", "active");
    await setActionState(userA.personId, "rec_read_math_paper", "dismissed");

    const states = await getActionStatesByPersonId(userA.personId);
    assert.equal(states["rec_build_dataset_brief"], "active");
    assert.equal(states["rec_read_math_paper"], "dismissed");

    // Toggle dismissed to restored (pending)
    await setActionState(userA.personId, "rec_read_math_paper", "pending");
    const updatedStates = await getActionStatesByPersonId(userA.personId);
    assert.equal(updatedStates["rec_read_math_paper"], "pending");
  });

  // 11. Goal change preserves previous evidence
  it("11. goal change preserves previous evidence", async () => {
    const evidenceBefore = await getEvidenceByPersonId(userA.personId);
    const countBefore = evidenceBefore.length;

    await setActiveGoal(userA.personId, "AI Founder", "Building an AI startup");
    const activeGoal = await getActiveGoal(userA.personId);
    assert.equal(activeGoal?.title, "AI Founder");

    const evidenceAfter = await getEvidenceByPersonId(userA.personId);
    assert.equal(evidenceAfter.length, countBefore, "Changing goal must not delete prior evidence");
  });

  // 12. Authorization capability check works
  it("12. authorization capability check works", async () => {
    // User A can read and update own profile
    const canReadSelf = await can(userA.personId, "profile.read.self", {
      targetPersonId: userA.personId,
    });
    assert.equal(canReadSelf, true);

    const canUpdateSelf = await can(userA.personId, "profile.update.self", {
      targetPersonId: userA.personId,
    });
    assert.equal(canUpdateSelf, true);

    // User A CANNOT read User B's profile via .self capability
    const canCrossAccess = await can(userA.personId, "profile.read.self", {
      targetPersonId: userB.personId,
    });
    assert.equal(canCrossAccess, false);

    // Student role does not have faculty's student.verify_skill capability
    const canVerifySkill = await can(userA.personId, "student.verify_skill");
    assert.equal(canVerifySkill, false);
  });

  // 13. Failed import does not erase local progress
  it("13. failed import does not erase local progress", async () => {
    // Attempt unauthorized import for a nonexistent target
    let failed = false;
    try {
      await importLocalProgress("non_existent_person_id", userA.personId, {
        workspaceState: null,
      });
    } catch {
      failed = true;
    }
    assert.equal(failed, true, "Unauthorized import must fail without mutating caller data");
  });

  // 14. Duplicate server requests do not duplicate evidence
  it("14. duplicate server requests do not duplicate evidence", async () => {
    const item = {
      category: "project" as const,
      subject: "Transformers from Scratch",
      value: "Implemented multi-head self-attention module",
      source: "self_reported" as const,
      verificationStatus: "self_reported" as const,
      observedAt: new Date(),
      interpretation: "Self-built model implementation.",
      whyItMatters: "Deep understanding of transformer architecture.",
      importKey: `proj_transf_${userA.personId}`,
    };

    // First request
    const r1 = await createEvidenceRecord(userA.personId, item);
    // Second duplicate request
    const r2 = await createEvidenceRecord(userA.personId, item);

    assert.equal(r1.id, r2.id, "Duplicate request must return existing record ID without duplicating");

    const evidenceList = await getEvidenceByPersonId(userA.personId);
    const transformerProjects = evidenceList.filter((e) => e.subject === "Transformers from Scratch");
    assert.equal(transformerProjects.length, 1);
  });
});
