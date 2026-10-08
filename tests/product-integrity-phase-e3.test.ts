process.env.PGLITE_IN_MEMORY = "true";

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { getPerson360, updatePersonProfileService } from "../lib/services/person-360-service";
import { getProjectsByPersonId, getProjectContributions, deleteProject } from "../lib/repositories/project-repository";
import { getEvidenceByPersonId } from "../lib/repositories/evidence-repository";
import { completeOnboarding, readOnboardingDraft, writeOnboardingDraft } from "../lib/services/onboarding-v2-service";
import { initialDraft, type OnboardingDraft } from "../lib/onboarding-v2";

describe("Phase E.3 Product Integrity & Multi-User Isolation", () => {
  let userA: { userId: string; personId: string; email: string };
  let userB: { userId: string; personId: string; email: string };
  let userC: { userId: string; personId: string; email: string };

  before(async () => {
    await getDb();

    // Create 3 independent test students
    userA = await createUser({
      email: `student_a_${Date.now()}@example.com`,
      passwordHash: "secure_hash_a",
      displayName: "Aarav Patel",
    });

    userB = await createUser({
      email: `student_b_${Date.now()}@example.com`,
      passwordHash: "secure_hash_b",
      displayName: "Diya Sharma",
    });

    userC = await createUser({
      email: `student_c_${Date.now()}@example.com`,
      passwordHash: "secure_hash_c",
      displayName: "Kavya Verma",
    });
  });

  it("1. User A completes onboarding with 2 confirmed projects and explicit contributions", async () => {
    const draftA: OnboardingDraft = {
      ...initialDraft,
      name: "Aarav Patel",
      role: "student",
      degree: "B.Tech",
      specialization: "Computer Science and Engineering",
      institution: "Lovely Professional University (LPU)",
      year: "3rd Year",
      semester: "6th Semester",
      skills: ["Python", "PyTorch", "FastAPI", "Computer Vision"],
      projects: [
        {
          id: "proj_a_1",
          title: "Autonomous Drone Navigation",
          description: "Visual SLAM and reinforcement learning navigation system.",
          technologies: ["Python", "PyTorch", "ROS", "OpenCV"],
          sources: ["github"],
          status: "confirmed",
          contribution: ["Machine Learning", "Research & Architecture"],
          contributionNote: "Trained the visual feature extractor and wrote policy evaluation.",
        },
        {
          id: "proj_a_2",
          title: "Medical Vision Transformer",
          description: "Multi-modal transformer for histopathology image classification.",
          technologies: ["Python", "PyTorch", "Transformers", "FastAPI"],
          sources: ["github"],
          status: "confirmed",
          contribution: ["Model Training", "Backend API"],
          contributionNote: "Designed tokenization, attention layers, and served REST inference.",
        },
      ],
      profiles: {
        github: "https://github.com/aaravpatel",
      },
      goal: "Robotics & AI Engineer",
    };

    // 1a. Persist draft
    await writeOnboardingDraft(userA.personId, draftA);
    const restoredDraft = await readOnboardingDraft(userA.personId);
    assert.ok(restoredDraft);
    assert.equal(restoredDraft.name, "Aarav Patel");
    assert.equal(restoredDraft.projects.length, 2);

    // 1b. Complete onboarding transactionally
    await completeOnboarding(userA.personId, draftA);

    // 1c. Verify Person 360 read model
    const p360A = await getPerson360(userA.personId, userA.personId);
    assert.equal(p360A.person.displayName, "Aarav Patel");
    assert.notEqual(p360A.person.displayName, "Rahul Sharma");
    assert.equal(p360A.profile.degree, "B.Tech");
    assert.equal(p360A.activeGoal?.title, "Robotics & AI Engineer");

    // 1d. Verify confirmed projects in Person 360
    assert.ok(p360A.projects);
    assert.equal(p360A.projects.length, 2);
    const titles = p360A.projects.map((p) => p.title);
    assert.ok(titles.includes("Autonomous Drone Navigation"));
    assert.ok(titles.includes("Medical Vision Transformer"));

    // 1e. Verify project contributions recorded
    const contribs = await getProjectContributions(userA.personId);
    assert.equal(contribs.length, 2);
  });

  it("2. User B completes independent onboarding with 1 confirmed project", async () => {
    const draftB: OnboardingDraft = {
      ...initialDraft,
      name: "Diya Sharma",
      role: "student",
      degree: "B.Tech",
      specialization: "Data Science",
      institution: "Lovely Professional University (LPU)",
      year: "4th Year",
      semester: "7th Semester",
      skills: ["Python", "XGBoost", "SQL", "Pandas"],
      projects: [
        {
          id: "proj_b_1",
          title: "FinTech Fraud Detection",
          description: "Graph anomaly detection and gradient boosted trees for credit fraud.",
          technologies: ["Python", "XGBoost", "NetworkX", "PostgreSQL"],
          sources: ["manual"],
          status: "confirmed",
          contribution: ["Data Engineering", "Model Training"],
          contributionNote: "Feature engineered temporal embeddings and tuned hyper-parameters.",
        },
      ],
      profiles: {},
      goal: "Quantitative ML Researcher",
    };

    await completeOnboarding(userB.personId, draftB);

    const p360B = await getPerson360(userB.personId, userB.personId);
    assert.equal(p360B.person.displayName, "Diya Sharma");
    assert.notEqual(p360B.person.displayName, "Aarav Patel");
    assert.notEqual(p360B.person.displayName, "Rahul Sharma");
    assert.equal(p360B.profile.specialization, "Data Science");
    assert.equal(p360B.activeGoal?.title, "Quantitative ML Researcher");

    assert.ok(p360B.projects);
    assert.equal(p360B.projects.length, 1);
    assert.equal(p360B.projects[0].title, "FinTech Fraud Detection");
  });

  it("3. User C (Fresh student) has 0 confirmed projects and clean empty state", async () => {
    const p360C = await getPerson360(userC.personId, userC.personId);
    assert.equal(p360C.person.displayName, "Kavya Verma");
    assert.ok(p360C.projects);
    assert.equal(p360C.projects.length, 0);

    const projectsC = await getProjectsByPersonId(userC.personId);
    assert.equal(projectsC.length, 0);
  });

  it("4. IDOR Protection: User B cannot access or mutate User A's Person 360", async () => {
    // User B tries to read User A's Person 360
    await assert.rejects(
      async () => {
        await getPerson360(userA.personId, userB.personId);
      },
      /Unauthorized/
    );

    // User B tries to update User A's profile
    await assert.rejects(
      async () => {
        await updatePersonProfileService(userA.personId, userB.personId, {
          displayName: "Hacked by User B",
        });
      },
      /Unauthorized/
    );

    // Verify User A's data was NOT mutated
    const p360A = await getPerson360(userA.personId, userA.personId);
    assert.equal(p360A.person.displayName, "Aarav Patel");
  });

  it("5. Project isolation: User B cannot delete User A's confirmed project", async () => {
    const projectsA = await getProjectsByPersonId(userA.personId);
    assert.equal(projectsA.length, 2);
    const targetProjId = projectsA[0].id;

    // User B calls deleteProject on User A's projectId
    const deletedByB = await deleteProject(userB.personId, targetProjId);
    assert.equal(deletedByB, undefined);

    // User A still has both projects
    const refreshedProjectsA = await getProjectsByPersonId(userA.personId);
    assert.equal(refreshedProjectsA.length, 2);
  });

  it("6. Defensible verification: Onboarding self-reported claims are NOT marked verified", async () => {
    const evidenceA = await getEvidenceByPersonId(userA.personId);

    // Projects and skills from onboarding are self-reported or unverified
    const verifiedItems = evidenceA.filter((e) => e.verificationStatus === "verified");
    assert.equal(verifiedItems.length, 0, "Self-reported onboarding data must never inflate to verified status.");

    const projectEvidence = evidenceA.filter((e) => e.category === "project");
    assert.equal(projectEvidence.length, 2);
    for (const p of projectEvidence) {
      assert.equal(p.verificationStatus, "self_reported");
    }
  });

  it("7. Refresh / re-query consistency: Project counts agree across Home, Projects, and Person 360", async () => {
    // Simulate multiple re-fetches (e.g. page refresh / re-login)
    const [p360_1, p360_2] = await Promise.all([
      getPerson360(userA.personId, userA.personId),
      getPerson360(userA.personId, userA.personId),
    ]);

    assert.equal(p360_1.projects?.length, 2);
    assert.equal(p360_2.projects?.length, 2);

    const dbProjects = await getProjectsByPersonId(userA.personId);
    assert.equal(dbProjects.length, 2);
    assert.equal(p360_1.projects?.length, dbProjects.length);
  });
});
