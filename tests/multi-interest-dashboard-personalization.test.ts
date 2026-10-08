import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  composePersonalizedDashboard,
  normalizeInterest,
  type StudentPersonalizationContext,
  type ProjectRecord,
} from "../lib/domain/personalization-engine";
import { getDemoDashboardComposition } from "../lib/services/dashboard-service";

function createMockContext(overrides: Partial<StudentPersonalizationContext> = {}): StudentPersonalizationContext {
  return {
    personId: "student-test-1",
    name: "Aarav Sharma",
    targetRole: "Generative AI Engineer",
    targetRoleId: "genai_engineer",
    goal: "Get an AI/ML internship",
    targetTimeline: "Within 6 months",
    primaryInterest: "learning",
    secondaryInterests: [],
    degree: "B.Tech Computer Science and Engineering",
    institution: "Lovely Professional University (LPU)",
    cohort: 2026,
    skills: [
      { name: "Python", category: "skill", verificationStatus: "verified", source: "padho_code" },
      { name: "Transformers", category: "skill", verificationStatus: "verified", source: "assessment" },
    ],
    projects: [
      {
        id: "proj-1",
        title: "Multi-Agent Code Assistant",
        description: "Autonomous programming agent utilizing LangChain, AST inspection, and deterministic rollback verification.",
        technologies: ["Python", "LangChain", "FastAPI", "Docker"],
        sources: ["github"],
        status: "Verified",
      },
    ],
    evidenceItems: [],
    verifiedReadinessScore: 82,
    isReadinessAvailable: true,
    isDemo: true,
    ...overrides,
  };
}

describe("AI Tathastu — Multi-Interest Dashboard Personalization Suite", () => {
  describe("1. Six Primary Interest Dashboard Modes", () => {
    it("Mode 1: Learning — adapts hero headline, focus tags, and learning actions", () => {
      const ctx = createMockContext({ primaryInterest: "learning" });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.primaryInterest, "learning");
      assert.strictEqual(comp.hero.headline, "Your AI/ML learning journey starts here.");
      assert.ok(comp.hero.subheadline.includes("learning roadmap"));
      assert.ok(comp.growthSection.title.includes("Growth"));
      assert.ok(comp.nextBestActions.some((a) => a.actionType === "Learn" || a.actionType === "Practice"));
      assert.ok(comp.hero.eoraHeroSpeech.toLowerCase().includes("learning") || comp.hero.eoraHeroSpeech.toLowerCase().includes("mastering"));
    });

    it("Mode 2: Jobs — adapts hero headline, careers emphasis, and prominent internships card", () => {
      const ctx = createMockContext({ primaryInterest: "jobs" });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.primaryInterest, "jobs");
      assert.strictEqual(comp.hero.headline, "Let's work toward your next AI/ML opportunity.");
      assert.ok(comp.hero.subheadline.includes("jobs/internships"));
      assert.strictEqual(comp.ecosystemSection.prominentCard, "internships");
      assert.strictEqual(comp.ecosystemSection.cardsOrder[0], "internships");
      assert.ok(comp.nextBestActions.some((a) => a.category === "jobs" || a.actionType === "Interview"));
    });

    it("Mode 3: People — adapts hero headline, networking focus, and prominent mentors card", () => {
      const ctx = createMockContext({ primaryInterest: "people" });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.primaryInterest, "people");
      assert.strictEqual(comp.hero.headline, "Build meaningful connections in AI & ML.");
      assert.ok(comp.hero.subheadline.includes("mentors"));
      assert.strictEqual(comp.ecosystemSection.prominentCard, "mentors");
      assert.strictEqual(comp.ecosystemSection.cardsOrder[0], "mentors");
      assert.ok(comp.nextBestActions.some((a) => a.actionType === "Connect"));
    });

    it("Mode 4: Collaboration — adapts hero headline, team focus, and prominent collaborative projects card", () => {
      const ctx = createMockContext({ primaryInterest: "collaboration" });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.primaryInterest, "collaboration");
      assert.strictEqual(comp.hero.headline, "Discover what you can build together.");
      assert.ok(comp.hero.subheadline.includes("contributors"));
      assert.strictEqual(comp.ecosystemSection.prominentCard, "collaborative_projects");
      assert.strictEqual(comp.ecosystemSection.cardsOrder[0], "collaborative_projects");
      assert.ok(comp.nextBestActions.some((a) => a.actionType === "Collaborate"));
      assert.ok(comp.ecosystemSection.collaborativeProjects.length > 0);
      assert.ok(comp.ecosystemSection.collaborativeProjects[0].roleNeeded);
    });

    it("Mode 5: Projects — adapts hero headline, builder focus, and prominent projects card in evidence", () => {
      const ctx = createMockContext({ primaryInterest: "projects" });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.primaryInterest, "projects");
      assert.strictEqual(comp.hero.headline, "Turn your AI/ML ideas into real projects.");
      assert.ok(comp.hero.subheadline.includes("GitHub evidence"));
      assert.strictEqual(comp.evidenceSection.prominentCard, "projects");
      assert.strictEqual(comp.evidenceSection.cardsOrder[0], "projects");
      assert.ok(comp.nextBestActions.some((a) => a.actionType === "Build"));
    });

    it("Mode 6: Research & Events — adapts hero headline, paper & hackathon focus, and prominent publications/events card", () => {
      const ctx = createMockContext({ primaryInterest: "research_events" });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.primaryInterest, "research_events");
      assert.strictEqual(comp.hero.headline, "Explore your next AI/ML research direction.");
      assert.ok(comp.hero.subheadline.includes("papers"));
      assert.strictEqual(comp.evidenceSection.prominentCard, "publications");
      assert.strictEqual(comp.evidenceSection.cardsOrder[0], "publications");
      assert.strictEqual(comp.ecosystemSection.prominentCard, "opportunities");
      assert.strictEqual(comp.ecosystemSection.cardsOrder[0], "opportunities");
    });
  });

  describe("2. Multi-Interest Combinations & Overlaps", () => {
    it("Combination: Jobs + Collaboration — matches exact prompt specification", () => {
      const ctx = createMockContext({
        primaryInterest: "jobs",
        secondaryInterests: ["collaboration"],
      });
      const comp = composePersonalizedDashboard(ctx);

      // Hero headline exact match from user prompt
      assert.strictEqual(comp.hero.headline, "Your next opportunity starts with what you build.");
      assert.strictEqual(comp.hero.primaryCta.label, "Prepare for an AI/ML internship");
      assert.strictEqual(comp.hero.secondaryCta?.label, "Explore Opportunities");

      // Focus tags exact match
      const expectedTags = [
        "Career Preparation",
        "Your Project Evidence",
        "Available Opportunities",
        "Collaborative Projects",
      ];
      for (const tag of expectedTags) {
        assert.ok(comp.hero.focusTags.includes(tag), `Expected tag "${tag}" in hero focus tags`);
      }

      // Growth and ecosystem subtitles
      assert.strictEqual(comp.growthSection.subtitle, "Career-specific prerequisites, portfolio and interview preparation.");
      assert.strictEqual(
        comp.ecosystemSection.subtitle,
        "Eligible internships, projects accepting contributions and authorized collaborators."
      );

      // Top 3 ranked actions exact match from user prompt
      assert.strictEqual(comp.nextBestActions[0].title, "Review your application portfolio");
      assert.strictEqual(comp.nextBestActions[1].title, "Document your contribution to a project");
      assert.strictEqual(comp.nextBestActions[2].title, "Explore available collaboration opportunities");
    });

    it("Combination: Jobs + Projects — portfolio preparation linked to target role", () => {
      const ctx = createMockContext({
        primaryInterest: "jobs",
        secondaryInterests: ["projects"],
      });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.hero.headline, "Your next opportunity starts with what you build.");
      assert.ok(comp.hero.focusTags.includes("Your Project Evidence"));
      assert.ok(comp.nextBestActions.some((a) => a.title.includes("Docker") || a.title.includes("portfolio")));
    });

    it("Combination: Learning + Projects — connect prerequisite with project application", () => {
      const ctx = createMockContext({
        primaryInterest: "learning",
        secondaryInterests: ["projects"],
      });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.hero.headline, "Learn principles, then build real systems.");
      assert.ok(comp.hero.focusTags.includes("Hands-on Code"));
    });

    it("Combination: People + Research — academic and research networking", () => {
      const ctx = createMockContext({
        primaryInterest: "people",
        secondaryInterests: ["research_events"],
      });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.hero.headline, "Connect with the minds shaping AI & ML.");
      assert.ok(comp.hero.focusTags.includes("Research Mentors"));
    });

    it("Combination: Jobs + Collaboration + Projects — career prep via team projects", () => {
      const ctx = createMockContext({
        primaryInterest: "jobs",
        secondaryInterests: ["collaboration", "projects"],
      });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.hero.headline, "Launch your career through high-impact team engineering.");
      assert.ok(comp.hero.focusTags.includes("Team Engineering"));
      assert.strictEqual(comp.growthSection.subtitle, "Career preparation through documented collaborative project work.");
    });

    it("Combination: Learning + Projects + Research — prerequisites, research & implementation", () => {
      const ctx = createMockContext({
        primaryInterest: "learning",
        secondaryInterests: ["projects", "research_events"],
      });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.hero.headline, "From foundational theory to research-grade implementation.");
      assert.ok(comp.hero.focusTags.includes("Prerequisite Mastery"));
      assert.strictEqual(comp.growthSection.subtitle, "Connect prerequisites, research methodology and implementation.");
    });
  });

  describe("3. Dynamic AI/ML Target Role Prerequisites", () => {
    it("Generative AI Engineer gets LLM, Vector DB, and RAGAS evaluation gaps", () => {
      const ctx = createMockContext({
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
      });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.targetRole, "Generative AI Engineer");
      assert.ok(comp.growthSection.rolePrerequisites.some((p) => p.name === "Transformers" || p.name === "Vector Databases"));
      assert.ok(comp.growthSection.skillGaps.some((g) => g.title.toLowerCase().includes("ragas") || g.title.toLowerCase().includes("serving")));
    });

    it("Machine Learning Engineer gets Scikit-Learn, Linear Algebra, and pipeline monitoring gaps", () => {
      const ctx = createMockContext({
        targetRole: "Machine Learning Engineer",
        targetRoleId: "ml_engineer",
      });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.targetRole, "Machine Learning Engineer");
      assert.ok(comp.growthSection.rolePrerequisites.some((p) => p.name === "Scikit-Learn" || p.name === "Linear Algebra"));
      assert.ok(comp.growthSection.skillGaps.some((g) => g.title.toLowerCase().includes("pipeline") || g.title.toLowerCase().includes("statistical")));
    });

    it("Computer Vision Engineer gets CNNs, OpenCV, and segmentation prerequisites", () => {
      const ctx = createMockContext({
        targetRole: "Computer Vision Engineer",
        targetRoleId: "computer_vision_engineer",
      });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.targetRole, "Computer Vision Engineer");
      assert.ok(comp.growthSection.rolePrerequisites.some((p) => p.name === "OpenCV" || p.name === "Convolutional Networks"));
      assert.ok(comp.growthSection.skillGaps.some((g) => g.title.includes("Production Deployment") || g.title.includes("Pipeline")));
    });

    it("AI Researcher gets Preprints, Mathematical Foundations, and Benchmark Rigor", () => {
      const ctx = createMockContext({
        targetRole: "AI Researcher",
        targetRoleId: "ai_researcher",
      });
      const comp = composePersonalizedDashboard(ctx);

      assert.strictEqual(comp.targetRole, "AI Researcher");
      assert.ok(comp.growthSection.rolePrerequisites.some((p) => p.name === "PyTorch" || p.name === "Mathematics for ML"));
      assert.ok(comp.growthSection.skillGaps.some((g) => g.title.toLowerCase().includes("benchmark") || g.title.toLowerCase().includes("preprint")));
    });
  });

  describe("4. Onboarding Step 3 Selection States & Interest Normalization", () => {
    it("normalizeInterest correctly handles 'network' and 'people'", () => {
      assert.strictEqual(normalizeInterest("network"), "people");
      assert.strictEqual(normalizeInterest("people"), "people");
      assert.strictEqual(normalizeInterest("jobs"), "jobs");
      assert.strictEqual(normalizeInterest("learning"), "learning");
      assert.strictEqual(normalizeInterest("research"), "research_events");
      assert.strictEqual(normalizeInterest("research_events"), "research_events");
    });

    it("Demo dashboard service produces valid neutral dashboard for empty priorities", () => {
      const demo = getDemoDashboardComposition({ primary: null });
      assert.ok(demo.hero.headline);
      assert.ok(demo.summaryCards.length === 6);
      assert.ok(demo.nextBestActions.length > 0);
      assert.strictEqual(demo.sourceFreshness.isDemo, true);
    });

    it("Demo dashboard service accepts custom primary, secondary, and role options", () => {
      const demo = getDemoDashboardComposition({
        primary: "jobs",
        secondary: ["collaboration"],
        role: "Machine Learning Engineer",
      });

      assert.strictEqual(demo.primaryInterest, "jobs");
      assert.deepStrictEqual(demo.secondaryInterests, ["collaboration"]);
      assert.strictEqual(demo.targetRole, "Machine Learning Engineer");
      assert.strictEqual(demo.hero.headline, "Your next opportunity starts with what you build.");
    });
  });

  describe("5. Integrity & Non-Destructive Behavior", () => {
    it("Preserves existing projects, skills, and evidence when changing priorities", () => {
      const projects: ProjectRecord[] = [
        { id: "p-custom", title: "Autonomous Drone Navigation", technologies: ["PyTorch", "ROS"], sources: ["github"] },
      ];
      const ctx1 = createMockContext({ primaryInterest: "learning", projects });
      const comp1 = composePersonalizedDashboard(ctx1);

      const ctx2 = createMockContext({ primaryInterest: "jobs", projects });
      const comp2 = composePersonalizedDashboard(ctx2);

      // Projects remain intact across both configurations
      assert.strictEqual(comp1.evidenceSection.cardsData.recentProjects.items.length, 1);
      assert.strictEqual(comp2.evidenceSection.cardsData.recentProjects.items.length, 1);
      assert.strictEqual(comp1.evidenceSection.cardsData.recentProjects.items[0].title, "Autonomous Drone Navigation");
      assert.strictEqual(comp2.evidenceSection.cardsData.recentProjects.items[0].title, "Autonomous Drone Navigation");

      // But the hero and prominence adapt!
      assert.notStrictEqual(comp1.hero.headline, comp2.hero.headline);
      assert.strictEqual(comp1.evidenceSection.prominentCard, "recentProjects" in comp1.evidenceSection.cardsData ? "projects" : "projects");
      assert.strictEqual(comp2.ecosystemSection.prominentCard, "internships");
    });

    it("Does not invent hallucinated fake metrics or unauthorized data", () => {
      const emptyCtx = createMockContext({
        skills: [],
        projects: [],
        evidenceItems: [],
        verifiedReadinessScore: null,
        isReadinessAvailable: false,
      });
      const comp = composePersonalizedDashboard(emptyCtx);

      // Verified readiness remains provisional, never hallucinated
      assert.strictEqual(comp.sourceFreshness.ledgerCoverage, "empty");
      const readinessCard = comp.summaryCards.find((c) => c.label === "Goal Readiness");
      assert.strictEqual(readinessCard?.value, "Provisional");
      assert.strictEqual(readinessCard?.provenance, "provisional");
      assert.strictEqual(readinessCard?.badge, "Gate Active");
    });
  });
});
