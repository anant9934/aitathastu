import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getAll96Configurations,
  composePersonalizedDashboard,
  type StudentPersonalizationContext,
} from "../lib/domain/personalization-engine";

describe("AI Tathastu — 96-Configuration Personalization Engine", () => {
  it("generates exactly 96 priority-aware configurations (6 single + 30 pairs + 60 triples)", () => {
    const configs = getAll96Configurations();
    assert.strictEqual(configs.length, 96, "Must generate exactly 96 priority configurations");

    const singleConfigs = configs.filter((c) => c.secondary.length === 0);
    assert.strictEqual(singleConfigs.length, 6, "Must have 6 single-interest configurations");

    const pairConfigs = configs.filter((c) => c.secondary.length === 1);
    assert.strictEqual(pairConfigs.length, 30, "Must have 30 two-interest configurations (15 pairs * 2 primaries)");

    const tripleConfigs = configs.filter((c) => c.secondary.length === 2);
    assert.strictEqual(tripleConfigs.length, 60, "Must have 60 three-interest configurations (20 triples * 3 primaries)");

    // Ensure all configuration IDs are unique
    const idSet = new Set(configs.map((c) => c.id));
    assert.strictEqual(idSet.size, 96, "All 96 configuration IDs must be unique");
  });

  it("verifies every one of the 96 configurations produces a valid composed dashboard", () => {
    const configs = getAll96Configurations();

    for (const cfg of configs) {
      const mockContext: StudentPersonalizationContext = {
        personId: `usr_test_${cfg.id}`,
        name: "Aman Sharma",
        targetRole: "Generative AI Engineer",
        targetRoleId: "generative_ai_engineer",
        goal: "Get an AI/ML internship",
        targetTimeline: "Summer 2027",
        primaryInterest: cfg.primary,
        secondaryInterests: cfg.secondary,
        degree: "B.Tech Computer Science",
        institution: "Lovely Professional University",
        cohort: 2027,
        skills: [{ name: "Python", verificationStatus: "unverified", source: "self_report" }],
        projects: [],
        evidenceItems: [],
        verifiedReadinessScore: null,
        isReadinessAvailable: false,
      };

      const dashboard = composePersonalizedDashboard(mockContext);

      assert.ok(dashboard, `Dashboard must be composed for ${cfg.id}`);
      assert.strictEqual(dashboard.primaryInterest, cfg.primary);
      assert.strictEqual(dashboard.secondaryInterests.length, cfg.secondary.length);
      assert.ok(dashboard.hero.headline.length > 0, "Hero headline must be populated");
      assert.ok(dashboard.nextBestActions.length > 0, "Must have next best actions");
      assert.ok(dashboard.nextBestActions.length <= 5, "Must never exceed 5 next best actions");
      assert.strictEqual(dashboard.summaryCards.length, 6, "Must provide 6 summary cards");
      assert.ok(dashboard.eoraPersonalizedInsight.length > 0, "EORA insight must be generated");
    }
  });

  it("differentiates primary vs. secondary priority emphasis (Learning Primary vs. Jobs Primary)", () => {
    const baseContext: StudentPersonalizationContext = {
      personId: "usr_contrast_1",
      name: "Rohan V",
      targetRole: "Machine Learning Engineer",
      targetRoleId: "ml_engineer",
      goal: "Prepare for an AI/ML job",
      skills: [{ name: "Python", verificationStatus: "unverified" }],
      projects: [],
      evidenceItems: [],
    };

    // Configuration 1: Jobs Primary, Learning Secondary
    const jobsPrimaryDashboard = composePersonalizedDashboard({
      ...baseContext,
      primaryInterest: "jobs",
      secondaryInterests: ["learning"],
    });

    // Configuration 2: Learning Primary, Jobs Secondary
    const learningPrimaryDashboard = composePersonalizedDashboard({
      ...baseContext,
      primaryInterest: "learning",
      secondaryInterests: ["jobs"],
    });

    // The headlines and top action priorities must differ
    assert.notStrictEqual(jobsPrimaryDashboard.hero.headline, learningPrimaryDashboard.hero.headline);
    assert.strictEqual(jobsPrimaryDashboard.primaryInterest, "jobs");
    assert.strictEqual(learningPrimaryDashboard.primaryInterest, "learning");

    // Jobs primary prioritizes career action / project build higher than pure learning
    const jobsTopAction = jobsPrimaryDashboard.nextBestActions[0];
    const learningTopAction = learningPrimaryDashboard.nextBestActions[0];
    assert.ok(jobsTopAction.relevantInterests.includes("jobs") || jobsTopAction.relevantInterests.includes("projects"));
    assert.ok(learningTopAction.relevantInterests.includes("learning"));
  });

  it("produces role-specific prerequisite actions for different AI/ML targets", () => {
    const studentCV = composePersonalizedDashboard({
      personId: "usr_cv",
      name: "Ananya",
      targetRole: "Computer Vision Engineer",
      targetRoleId: "computer_vision_engineer",
      primaryInterest: "learning",
      skills: [],
      projects: [],
      evidenceItems: [],
    });

    const studentGenAI = composePersonalizedDashboard({
      personId: "usr_genai",
      name: "Karan",
      targetRole: "Generative AI Engineer",
      targetRoleId: "generative_ai_engineer",
      primaryInterest: "learning",
      skills: [],
      projects: [],
      evidenceItems: [],
    });

    const cvAction = studentCV.nextBestActions.find((a) => a.actionType === "Learn");
    const genAiAction = studentGenAI.nextBestActions.find((a) => a.actionType === "Learn");

    assert.ok(cvAction, "CV student must receive a Learn action");
    assert.ok(genAiAction, "GenAI student must receive a Learn action");
    assert.ok(cvAction.title.includes("Python") || cvAction.title.includes("OpenCV") || cvAction.title.includes("PyTorch"));
    assert.ok(genAiAction.title.includes("Python") || genAiAction.title.includes("Transformers") || genAiAction.title.includes("LLMs"));
  });

  it("strictly isolates two different students and avoids cross-user data leakage", () => {
    const studentA = composePersonalizedDashboard({
      personId: "usr_student_a",
      name: "Student A",
      targetRole: "AI Researcher",
      targetRoleId: "ai_researcher",
      primaryInterest: "research_events",
      secondaryInterests: ["people"],
      skills: [{ name: "Linear Algebra", verificationStatus: "verified" }],
      projects: [],
      evidenceItems: [],
    });

    const studentB = composePersonalizedDashboard({
      personId: "usr_student_b",
      name: "Student B",
      targetRole: "MLOps Engineer",
      targetRoleId: "mlops_engineer",
      primaryInterest: "projects",
      secondaryInterests: ["collaboration"],
      skills: [{ name: "Docker", verificationStatus: "verified" }],
      projects: [
        {
          id: "proj_b1",
          title: "Kubernetes ML Pipeline",
          technologies: ["Docker", "Kubernetes"],
          sources: ["github"],
          status: "completed",
        },
      ],
      evidenceItems: [],
    });

    assert.strictEqual(studentA.hero.targetRoleBadge, "AI Researcher");
    assert.strictEqual(studentB.hero.targetRoleBadge, "MLOps Engineer");
    assert.strictEqual(studentA.summaryCards.find((c) => c.id === "card_projects")?.value, 0);
    assert.strictEqual(studentB.summaryCards.find((c) => c.id === "card_projects")?.value, 1);
    assert.ok(studentA.eoraPersonalizedInsight.includes("AI Researcher"));
    assert.ok(studentB.eoraPersonalizedInsight.includes("MLOps Engineer"));
  });

  it("handles low-data / first-time students honestly without hallucinated metrics", () => {
    const firstTimeStudent = composePersonalizedDashboard({
      personId: "usr_first_timer",
      name: "Fresh Learner",
      targetRole: "AI Engineer",
      targetRoleId: "ai_engineer",
      primaryInterest: "learning",
      skills: [],
      projects: [],
      evidenceItems: [],
      isReadinessAvailable: false,
      verifiedReadinessScore: null,
    });

    const readinessCard = firstTimeStudent.summaryCards.find((c) => c.id === "card_readiness");
    assert.strictEqual(readinessCard?.value, "Provisional", "Unverified student must show provisional status");
    assert.strictEqual(readinessCard?.provenance, "provisional");

    const projectCard = firstTimeStudent.summaryCards.find((c) => c.id === "card_projects");
    assert.strictEqual(projectCard?.value, 0);
    assert.strictEqual(projectCard?.subtext, "No repositories linked");

    const addProjectAction = firstTimeStudent.nextBestActions.find((a) => a.id === "act_add_first_project");
    assert.ok(addProjectAction, "Must suggest adding first project without pretending one exists");
  });
});
