import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AIML_ROLE_CATALOG,
  AIML_GOAL_OUTCOMES,
  findAimlRole,
  getPopularAimlRoles,
  searchAimlRoles,
  validateCustomGoal,
  validateTargetTimeline,
} from "../lib/domain/aiml-role-taxonomy";
import {
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
  getOnboardingStep,
  getOnboardingStepLabels,
  getStepByScreenIndex,
} from "../lib/onboarding-step-registry";
import { safeDraft, initialDraft } from "../lib/onboarding-v2";
import { generatePersonalizedRoadmap } from "../lib/domain/roadmap";
import { explainProfileInsights } from "../lib/intelligence/engines/eora-explainer";

describe("AI/ML Target Role & Goal Selector (Phase E.5 Extension)", () => {
  describe("1. AI/ML Role Taxonomy & Constraints", () => {
    it("should contain exactly 14 curated AI/ML roles across 4 distinct categories", () => {
      assert.equal(AIML_ROLE_CATALOG.length, 14);
      const categories = new Set(AIML_ROLE_CATALOG.map((r) => r.category));
      assert.deepEqual(Array.from(categories).sort(), [
        "data_product",
        "engineering",
        "exploration",
        "research",
      ]);
    });

    it("should contain strictly AI/ML roles and NO generic disciplines", () => {
      const titles = AIML_ROLE_CATALOG.map((r) => r.title.toLowerCase());
      assert.ok(!titles.includes("web developer"));
      assert.ok(!titles.includes("civil engineer"));
      assert.ok(!titles.includes("graphic designer"));
      assert.ok(!titles.includes("digital marketer"));

      assert.ok(titles.includes("generative ai engineer"));
      assert.ok(titles.includes("machine learning engineer"));
      assert.ok(titles.includes("ai engineer"));
      assert.ok(titles.includes("deep learning engineer"));
      assert.ok(titles.includes("mlops engineer"));
      assert.ok(titles.includes("nlp engineer"));
      assert.ok(titles.includes("computer vision engineer"));
      assert.ok(titles.includes("ai researcher"));
      assert.ok(titles.includes("data scientist (ai/ml)"));
      assert.ok(titles.includes("still exploring ai & ml"));
    });

    it("should return exactly 6 popular roles for the initial 3x2 grid", () => {
      const popular = getPopularAimlRoles();
      assert.equal(popular.length, 6);
      assert.ok(popular.some((r) => r.id === "genai_engineer"));
      assert.ok(popular.some((r) => r.id === "ml_engineer"));
      assert.ok(popular.some((r) => r.id === "ai_engineer"));
      assert.ok(popular.some((r) => r.id === "ai_researcher"));
      assert.ok(popular.some((r) => r.id === "data_scientist_aiml"));
      assert.ok(popular.some((r) => r.id === "exploring_aiml"));
    });

    it("should search AI/ML roles by skill, title, and category keywords", () => {
      const visionResults = searchAimlRoles("Vision");
      assert.ok(visionResults.some((r) => r.id === "computer_vision_engineer"));

      const pytorchResults = searchAimlRoles("PyTorch");
      assert.ok(pytorchResults.length > 0);

      const researchResults = searchAimlRoles("research");
      assert.ok(researchResults.some((r) => r.category === "research"));
    });

    it("should find role definition by ID or case-insensitive title", () => {
      const byId = findAimlRole("genai_engineer");
      assert.ok(byId);
      assert.equal(byId.title, "Generative AI Engineer");

      const byTitle = findAimlRole("Machine Learning Engineer");
      assert.ok(byTitle);
      assert.equal(byTitle.id, "ml_engineer");

      const byLower = findAimlRole("ai researcher");
      assert.ok(byLower);
      assert.equal(byLower.id, "ai_researcher");
    });
  });

  describe("2. Goal Outcomes & Validation", () => {
    it("should provide 8 outcome options including custom goal", () => {
      assert.equal(AIML_GOAL_OUTCOMES.length, 8);
      assert.ok(AIML_GOAL_OUTCOMES.some((g) => g.id === "goal_internship"));
      assert.ok(AIML_GOAL_OUTCOMES.some((g) => g.id === "goal_job_prep"));
      assert.ok(AIML_GOAL_OUTCOMES.some((g) => g.id === "goal_build_project"));
      assert.ok(AIML_GOAL_OUTCOMES.some((g) => g.id === "goal_research"));
      assert.ok(AIML_GOAL_OUTCOMES.some((g) => g.id === "goal_custom"));
    });

    it("should validate custom free-text goals", () => {
      const empty = validateCustomGoal("");
      assert.equal(empty.valid, false);

      const tooShort = validateCustomGoal("ML");
      assert.equal(tooShort.valid, false);

      const validGoal = validateCustomGoal("Build and deploy a medical RAG assistant with FastAPI");
      assert.equal(validGoal.valid, true);

      const tooLong = validateCustomGoal("A".repeat(250));
      assert.equal(tooLong.valid, false);
    });

    it("should validate timeline options and specific calendar dates", () => {
      const preset3m = validateTargetTimeline("Within 3 months");
      assert.equal(preset3m.valid, true);
      assert.equal(preset3m.formatted, "Within 3 months");

      const invalidDate = validateTargetTimeline("specific_date", "not-a-date");
      assert.equal(invalidDate.valid, false);

      const futureDate = "2028-12-31";
      const validFuture = validateTargetTimeline("specific_date", futureDate);
      assert.equal(validFuture.valid, true);
      assert.equal(validFuture.formatted, futureDate);

      const pastDate = "2020-01-01";
      const validPast = validateTargetTimeline("specific_date", pastDate);
      assert.equal(validPast.valid, false);
    });
  });

  describe("3. Centralized 10-Step Onboarding Registry", () => {
    it("should register exactly 10 logical steps in canonical order", () => {
      assert.equal(TOTAL_ONBOARDING_STEPS, 10);
      assert.equal(ONBOARDING_STEPS.length, 10);

      assert.equal(getOnboardingStep(1).shortLabel, "Platform Role");
      assert.equal(getOnboardingStep(2).shortLabel, "AI/ML Direction");
      assert.equal(getOnboardingStep(3).shortLabel, "Priorities");
      assert.equal(getOnboardingStep(4).shortLabel, "Academic Details");
      assert.equal(getOnboardingStep(5).shortLabel, "Resume & CV");
      assert.equal(getOnboardingStep(6).shortLabel, "Digital Profiles");
      assert.equal(getOnboardingStep(7).shortLabel, "AI Analysis");
      assert.equal(getOnboardingStep(8).shortLabel, "Profile & Skills");
      assert.equal(getOnboardingStep(9).shortLabel, "Projects");
      assert.equal(getOnboardingStep(10).shortLabel, "Launch");
    });

    it("should produce a clean 10-element array of step labels for ScreenFooter", () => {
      const labels = getOnboardingStepLabels();
      assert.equal(labels.length, 10);
      assert.deepEqual(labels, [
        "Platform Role",
        "AI/ML Direction",
        "Priorities",
        "Academic Details",
        "Resume & CV",
        "Digital Profiles",
        "AI Analysis",
        "Profile & Skills",
        "Projects",
        "Launch",
      ]);
    });

    it("should correctly map screen indexes to step definitions", () => {
      const step2 = getStepByScreenIndex(4);
      assert.ok(step2);
      assert.equal(step2.id, "aiml_direction");
      assert.equal(step2.stepNumber, 2);
    });
  });

  describe("4. Draft Sanitization & Persistence Structure", () => {
    it("should initialize default draft with targetRole and goal", () => {
      assert.equal(initialDraft.targetRole, "Generative AI Engineer");
      assert.equal(initialDraft.targetRoleId, "genai_engineer");
      assert.equal(initialDraft.targetTimeline, "Within 6 months");
      assert.equal(initialDraft.goal, "Get an AI/ML internship");
    });

    it("should sanitize and retain targetRole, timeline, and custom goal across edits", () => {
      const draft = safeDraft({
        name: "Aman Verma",
        role: "student",
        targetRole: "AI Researcher",
        targetRoleId: "ai_researcher",
        targetTimeline: "Within 12 months",
        customGoalText: "Publish a workshop paper on Transformer efficiency",
        goal: "Work on AI/ML research",
        priorities: ["learning", "research_events"],
        primaryPriority: "research_events",
      });

      assert.equal(draft.name, "Aman Verma");
      assert.equal(draft.targetRole, "AI Researcher");
      assert.equal(draft.targetRoleId, "ai_researcher");
      assert.equal(draft.targetTimeline, "Within 12 months");
      assert.equal(draft.customGoalText, "Publish a workshop paper on Transformer efficiency");
      assert.equal(draft.goal, "Work on AI/ML research");
      assert.deepEqual(draft.priorities, ["learning", "research_events"]);
      assert.equal(draft.primaryPriority, "research_events");
    });
  });

  describe("5. Dynamic Personalized AI/ML Roadmap", () => {
    it("should generate tailored roadmap for Generative AI Engineer", () => {
      const roadmap = generatePersonalizedRoadmap("Generative AI Engineer", ["Python", "DSA", "OOP"], 2026, "preparing", {
        targetRole: "Generative AI Engineer",
        specificGoal: "Get an AI/ML internship",
        primaryPriority: "jobs",
      });

      assert.equal(roadmap.targetRole, "Generative AI Engineer");
      assert.ok(roadmap.stages.length >= 3);
      assert.equal(roadmap.stages[0].status, "completed"); // Python, DSA & OOP evidenced
      assert.equal(roadmap.stages[1].status, "in_progress"); // ML foundations next
      assert.ok(roadmap.primaryActions.length > 0);
    });

    it("should generate tailored roadmap for AI Researcher", () => {
      const roadmap = generatePersonalizedRoadmap("AI Researcher", ["Mathematics & Proofs", "Probability", "Linear Algebra"], 2027, "preparing", {
        targetRole: "AI Researcher",
        specificGoal: "Work on AI/ML research",
        primaryPriority: "learning",
      });

      assert.equal(roadmap.targetRole, "AI Researcher");
      assert.ok(roadmap.stages.length >= 3);
      assert.equal(roadmap.stages[0].title, "Stage 1: Advanced Mathematical Foundations");
    });

    it("should dynamically prioritize mock interviews when student is targeting internships or near graduation", () => {
      const nearGradRoadmap = generatePersonalizedRoadmap(
        "Generative AI Engineer",
        [
          "Python",
          "DSA",
          "OOP",
          "Linear Algebra",
          "Scikit-Learn",
          "Machine Learning",
          "PyTorch",
          "Deep Learning",
          "Transformers",
          "Vector Databases",
          "FAISS",
          "LangChain",
          "RAG",
        ],
        2026,
        "actively_applying",
        {
          targetRole: "Generative AI Engineer",
          specificGoal: "Get an AI/ML internship",
          primaryPriority: "jobs",
        }
      );

      const interviewAction = nearGradRoadmap.primaryActions.find((a) => a.actionType === "Interview");
      assert.ok(interviewAction, "Should prioritize Interview action for near-graduation internship candidate");
    });
  });

  describe("6. EORA Context Awareness", () => {
    it("should acknowledge target role and goal in EORA explanations without fabricating scores", async () => {
      const explanation = await explainProfileInsights({
        studentName: "Priya",
        activeGoal: "Get an AI/ML internship",
        targetRole: "Generative AI Engineer",
        specificGoal: "Get an AI/ML internship",
        evidenceItems: [],
      });

      assert.ok(explanation.includes("Priya"));
      assert.ok(explanation.includes("Generative AI Engineer"));
      assert.ok(explanation.includes("Get an AI/ML internship"));
      assert.ok(!explanation.includes("NaN%"));
    });
  });
});
