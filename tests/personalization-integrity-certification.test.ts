import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  composePersonalizedDashboard,
  evaluatePrerequisiteCompetency,
  CANONICAL_INTEREST_KEYS,
  type CanonicalInterest,
  type StudentPersonalizationContext,
} from "../lib/domain/personalization-engine";
import { getRoleById } from "../lib/domain/aiml-role-taxonomy";
import { calculateReadiness } from "../lib/domain/readiness";
import type { EvidenceItem } from "../lib/domain/evidence";

function makeEvidence(item: Partial<EvidenceItem> & { id: string; subject: string; value: string }): EvidenceItem {
  return {
    category: "skill",
    verificationStatus: "unverified",
    source: "imported",
    observedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    interpretation: item.subject,
    whyItMatters: "Grounded test record.",
    ...item,
  };
}

describe("AI TATHASTU — PERSONALIZATION INTEGRITY & REAL-DATA CERTIFICATION", () => {
  // --------------------------------------------------------------------------
  // 1. ZERO-DATA STUDENT INTEGRITY & EMPTY STATE HONESTY
  // --------------------------------------------------------------------------
  describe("1. Zero-Data Student Baseline & Zero Mock Leakage", () => {
    const zeroDataStudent: StudentPersonalizationContext = {
      personId: "student-fresh-001",
      name: "Devika Sen",
      targetRole: "Machine Learning Engineer",
      targetRoleId: "ml_engineer",
      goal: "Get an AI/ML internship",
      targetTimeline: "Within 6 months",
      primaryInterest: "jobs",
      secondaryInterests: ["learning"],
      skills: [],
      projects: [],
      evidenceItems: [],
      verifiedReadinessScore: null,
      isReadinessAvailable: false,
      isDemo: false,
    };

    it("does not leak fake projects, repositories, or external entities", () => {
      const comp = composePersonalizedDashboard(zeroDataStudent);

      // Section 1: Summary Cards
      const projCard = comp.summaryCards.find((c) => c.id === "card_projects");
      assert.strictEqual(projCard?.value, 0, "Active projects count must be 0");
      assert.ok(projCard?.subtext.includes("No repositories linked"));

      const readCard = comp.summaryCards.find((c) => c.id === "card_readiness");
      assert.strictEqual(readCard?.value, "Provisional", "Readiness score must be Provisional when unverified");
      assert.strictEqual(readCard?.badge, "Gate Active");

      // Section 2: Evidence Ledger
      assert.strictEqual(comp.evidenceSection.cardsData.recentProjects.items.length, 0, "No projects in ledger");
      assert.strictEqual(comp.evidenceSection.cardsData.publications.items.length, 0, "No publications");
      assert.strictEqual(comp.evidenceSection.cardsData.achievements.items.length, 0, "No achievements");
      assert.strictEqual(comp.evidenceSection.cardsData.githubActivity.connected, false, "GitHub disconnected");

      // Section 4: Ecosystem
      assert.strictEqual(comp.ecosystemSection.internships.length, 0, "Zero fake internships leaked");
      assert.strictEqual(comp.ecosystemSection.recommendedMentors.length, 0, "Zero fake mentors leaked");
      assert.strictEqual(comp.ecosystemSection.peopleYouShouldKnow.length, 0, "Zero fake people leaked");
      assert.strictEqual(comp.ecosystemSection.relevantOpportunities.length, 0, "Zero fake opportunities leaked");
      assert.strictEqual(comp.ecosystemSection.collaborativeProjects.length, 0, "Zero fake collaborative projects leaked");

      // Source Freshness
      assert.strictEqual(comp.sourceFreshness.isDemo, false, "Must not be marked as demo");
      assert.strictEqual(comp.sourceFreshness.evidenceCount, 0, "Evidence count must be 0");
    });

    it("marks all target-role prerequisites as Insufficient Evidence / To Demonstrate without fabricating percentage deficiencies", () => {
      const comp = composePersonalizedDashboard(zeroDataStudent);
      const roleDef = getRoleById("ml_engineer");

      assert.strictEqual(comp.growthSection.rolePrerequisites.length, roleDef.corePrerequisites.length);

      for (const prereq of comp.growthSection.rolePrerequisites) {
        assert.strictEqual(prereq.tier, "insufficient_evidence", "Must be classified as insufficient_evidence");
        assert.strictEqual(prereq.tierLabel, "Insufficient Evidence");
        assert.strictEqual(prereq.status, "To Demonstrate", "Status must be To Demonstrate, NOT a deficit");
        assert.strictEqual(prereq.levelPct, 0, "Trust depth percentage must be 0, never a fabricated 35/40%");
        assert.strictEqual(prereq.evidenceCount, 0);
      }
    });

    it("generates honest next best actions prioritizing project creation and foundational learning", () => {
      const comp = composePersonalizedDashboard(zeroDataStudent);
      assert.ok(comp.nextBestActions.length > 0);

      const addProjectAction = comp.nextBestActions.find((a) => a.id === "act_add_first_project");
      assert.ok(addProjectAction, "Must recommend adding first project artifact");
      assert.strictEqual(addProjectAction.actionType, "Build");
      assert.ok(addProjectAction.destinationUrl.includes("/student/projects"));
    });
  });

  // --------------------------------------------------------------------------
  // 2. COMPETENCY EVIDENCE TIERS (5 DISTINCT TIERS)
  // --------------------------------------------------------------------------
  describe("2. Competency Evidence Tiers Separation", () => {
    it("Tier 1: Institutionally Verified (100% trust depth, status: Verified)", () => {
      const context: StudentPersonalizationContext = {
        personId: "student-tier-1",
        name: "Aarav",
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
        skills: [{ name: "Python", category: "skill", verificationStatus: "verified", source: "eris" }],
        projects: [],
        evidenceItems: [
          makeEvidence({
            id: "ev-1",
            category: "skill",
            subject: "Python & Algorithms",
            value: "Advanced",
            verificationStatus: "verified",
            source: "institutional",
          }),
        ],
        isDemo: false,
      };

      const evalResult = evaluatePrerequisiteCompetency("Python & Algorithms", context);
      assert.strictEqual(evalResult.tier, "institutionally_verified");
      assert.strictEqual(evalResult.tierLabel, "Institutionally Verified");
      assert.strictEqual(evalResult.trustDepthPct, 100);
      assert.strictEqual(evalResult.status, "Verified");
      assert.strictEqual(evalResult.isMet, true);
    });

    it("Tier 2: Demonstrated in Confirmed Projects (75% trust depth, status: Demonstrated)", () => {
      const context: StudentPersonalizationContext = {
        personId: "student-tier-2",
        name: "Bhavna",
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
        skills: [],
        projects: [
          {
            id: "proj-1",
            title: "Local Vector RAG Engine",
            description: "ChromaDB and FAISS dense retrieval pipeline with LangChain.",
            technologies: ["Python", "Vector Databases", "LangChain"],
            sources: ["github"],
            status: "confirmed",
          },
        ],
        evidenceItems: [],
        isDemo: false,
      };

      const evalResult = evaluatePrerequisiteCompetency("Vector Databases & RAG Architecture", context);
      assert.strictEqual(evalResult.tier, "demonstrated");
      assert.strictEqual(evalResult.tierLabel, "Demonstrated in Projects");
      assert.strictEqual(evalResult.trustDepthPct, 75);
      assert.strictEqual(evalResult.status, "Demonstrated");
      assert.strictEqual(evalResult.isMet, true);
    });

    it("Tier 3: Source Detected / Inferred (50% trust depth, status: Evidence Active)", () => {
      const context: StudentPersonalizationContext = {
        personId: "student-tier-3",
        name: "Chetan",
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
        skills: [],
        projects: [],
        evidenceItems: [
          makeEvidence({
            id: "ev-resume",
            category: "skill",
            subject: "Deep Learning & Transformers",
            value: "Intermediate",
            verificationStatus: "unverified",
            source: "resume_extracted",
          }),
        ],
        isDemo: false,
      };

      const evalResult = evaluatePrerequisiteCompetency("Deep Learning & Transformers", context);
      assert.strictEqual(evalResult.tier, "source_detected");
      assert.strictEqual(evalResult.tierLabel, "Source Detected");
      assert.strictEqual(evalResult.trustDepthPct, 50);
      assert.strictEqual(evalResult.status, "Evidence Active");
      assert.strictEqual(evalResult.isMet, true);
    });

    it("Tier 4: Student Reported (25% trust depth, status: Evidence Active)", () => {
      const context: StudentPersonalizationContext = {
        personId: "student-tier-4",
        name: "Divya",
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
        skills: [{ name: "Docker", category: "skill", verificationStatus: "unverified", source: "self_reported" }],
        projects: [],
        evidenceItems: [],
        isDemo: false,
      };

      const evalResult = evaluatePrerequisiteCompetency("Docker Containerization", context);
      assert.strictEqual(evalResult.tier, "student_reported");
      assert.strictEqual(evalResult.tierLabel, "Student Reported");
      assert.strictEqual(evalResult.trustDepthPct, 25);
      assert.strictEqual(evalResult.status, "Evidence Active");
      assert.strictEqual(evalResult.isMet, true);
    });

    it("Tier 5: Insufficient Evidence (0% trust depth, status: To Demonstrate, isMet: false)", () => {
      const context: StudentPersonalizationContext = {
        personId: "student-tier-5",
        name: "Esha",
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
        skills: [],
        projects: [],
        evidenceItems: [],
        isDemo: false,
      };

      const evalResult = evaluatePrerequisiteCompetency("Vector Databases & RAG Architecture", context);
      assert.strictEqual(evalResult.tier, "insufficient_evidence");
      assert.strictEqual(evalResult.tierLabel, "Insufficient Evidence");
      assert.strictEqual(evalResult.trustDepthPct, 0);
      assert.strictEqual(evalResult.status, "To Demonstrate");
      assert.strictEqual(evalResult.isMet, false);
      assert.strictEqual(evalResult.evidenceCount, 0);
    });

    it("does not infer mastery simply from selecting a target role", () => {
      const context: StudentPersonalizationContext = {
        personId: "student-role-select",
        name: "Farhan",
        targetRole: "AI Researcher",
        targetRoleId: "ai_researcher",
        skills: [],
        projects: [],
        evidenceItems: [],
        isDemo: false,
      };

      const comp = composePersonalizedDashboard(context);
      const researcherRole = getRoleById("ai_researcher");

      for (const p of researcherRole.corePrerequisites) {
        const prereq = comp.growthSection.rolePrerequisites.find((r) => r.name === p);
        assert.ok(prereq, `Prerequisite ${p} must exist in composed dashboard`);
        assert.strictEqual(prereq.tier, "insufficient_evidence", `Role selection must not grant unearned mastery for ${p}`);
        assert.strictEqual(prereq.levelPct, 0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. DEFENSIVE READINESS POLICY GATE VERIFICATION
  // --------------------------------------------------------------------------
  describe("3. Defensible Readiness Calculation & Gate Enforcement", () => {
    it("enforces strict gate when verified coverage is insufficient", () => {
      const evidence: EvidenceItem[] = [
        makeEvidence({
          id: "ev-unverified-1",
          category: "skill",
          subject: "Python algorithms",
          value: "advanced",
          verificationStatus: "unverified",
          source: "self_reported",
        }),
      ];

      const res = calculateReadiness({ title: "Machine Learning Engineer" }, evidence);
      assert.strictEqual(res.publishable, false, "Must not publish score with unverified evidence");
      assert.strictEqual(res.score, undefined, "Score must be undefined");
      assert.ok(res.unavailableReasons.length > 0, "Must provide reasons for gate withholding");
      assert.ok(res.unavailableReasons[0].includes("verified coverage"));
    });

    it("publishes deterministic readiness score only when independently verified coverage satisfies policy gate", () => {
      const evidence: EvidenceItem[] = [
        makeEvidence({
          id: "ev-prog",
          category: "assessment",
          subject: "Python Programming Mastery",
          value: "Advanced",
          verificationStatus: "verified",
          source: "institutional",
          interpretation: "ERIS verified algorithms score",
        }),
        makeEvidence({
          id: "ev-ml",
          category: "assessment",
          subject: "Machine Learning Foundations",
          value: "Proficient",
          verificationStatus: "verified",
          source: "institutional",
          interpretation: "ERIS verified scikit-learn models",
        }),
        makeEvidence({
          id: "ev-dep",
          category: "project",
          subject: "FastAPI ML Model Serving",
          value: "Docker container deployed",
          verificationStatus: "verified",
          source: "institutional",
          sourceReference: "github.com/org/repo",
        }),
        makeEvidence({
          id: "ev-data",
          category: "assessment",
          subject: "Feature Engineering & Data Pipeline",
          value: "Passed",
          verificationStatus: "verified",
          source: "institutional",
        }),
      ];

      const res = calculateReadiness({ title: "Machine Learning Engineer" }, evidence);
      assert.strictEqual(res.publishable, true, "Must be publishable with full verified coverage");
      assert.ok(typeof res.score === "number" && res.score > 0, "Must compute valid score");
      assert.strictEqual(res.unavailableReasons.length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. DYNAMIC ADAPTATION TO ROLE, GOAL, INTERESTS, EVIDENCE
  // --------------------------------------------------------------------------
  describe("4. Dynamic Personalization Across Roles, Goals, and Evidence", () => {
    it("dynamically adapts prerequisites, skills map, and gaps when AI/ML target role changes", () => {
      const baseContext: StudentPersonalizationContext = {
        personId: "student-dynamic-1",
        name: "Gaurav",
        goal: "Get an AI/ML internship",
        primaryInterest: "learning",
        secondaryInterests: [],
        skills: [],
        projects: [],
        evidenceItems: [],
        isDemo: false,
      };

      const genAiComp = composePersonalizedDashboard({
        ...baseContext,
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
      });

      const cvComp = composePersonalizedDashboard({
        ...baseContext,
        targetRole: "Computer Vision Engineer",
        targetRoleId: "computer_vision_engineer",
      });

      // Role titles differ
      assert.strictEqual(genAiComp.targetRole, "Generative AI Engineer");
      assert.strictEqual(cvComp.targetRole, "Computer Vision Engineer");

      // Prerequisites differ
      assert.notDeepStrictEqual(
        genAiComp.growthSection.rolePrerequisites.map((p) => p.name),
        cvComp.growthSection.rolePrerequisites.map((p) => p.name),
        "Prerequisites must differ across roles"
      );

      // Skill Map nodes differ
      assert.notDeepStrictEqual(
        genAiComp.skillMap.nodes.map((n) => n.label),
        cvComp.skillMap.nodes.map((n) => n.label),
        "Skill map nodes must differ across roles"
      );
      assert.ok(genAiComp.skillMap.nodes.some((n) => n.label.toLowerCase().includes("vector") || n.label.toLowerCase().includes("langchain")));
      assert.ok(cvComp.skillMap.nodes.some((n) => n.label.toLowerCase().includes("opencv") || n.label.toLowerCase().includes("yolo")));
    });

    it("dynamically adapts hero, prominent cards, and action priorities when primary interest changes", () => {
      const baseContext: StudentPersonalizationContext = {
        personId: "student-dynamic-2",
        name: "Hina",
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
        goal: "Get an AI/ML internship",
        skills: [],
        projects: [],
        evidenceItems: [],
        isDemo: true, // test prominent cards with demo fixtures
      };

      const jobsComp = composePersonalizedDashboard({ ...baseContext, primaryInterest: "jobs" });
      const collabComp = composePersonalizedDashboard({ ...baseContext, primaryInterest: "collaboration" });
      const researchComp = composePersonalizedDashboard({ ...baseContext, primaryInterest: "research_events" });

      // Ecosystem prominent cards
      assert.strictEqual(jobsComp.ecosystemSection.prominentCard, "internships");
      assert.strictEqual(collabComp.ecosystemSection.prominentCard, "collaborative_projects");
      assert.strictEqual(researchComp.ecosystemSection.prominentCard, "opportunities");

      // Evidence prominent cards
      assert.strictEqual(researchComp.evidenceSection.prominentCard, "publications");
      assert.strictEqual(researchComp.evidenceSection.cardsOrder[0], "publications");

      // Actions priorities
      assert.ok(jobsComp.nextBestActions.some((a) => a.category === "jobs" || a.actionType === "Interview"));
      assert.ok(collabComp.nextBestActions.some((a) => a.actionType === "Collaborate"));
      assert.ok(researchComp.nextBestActions.some((a) => a.category === "research_events"));
    });

    it("dynamically adapts recommendations between different evidence states with identical goals", () => {
      const zeroEvidenceCtx: StudentPersonalizationContext = {
        personId: "student-evidence-diff-1",
        name: "Ishaan",
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
        goal: "Get an AI/ML internship",
        primaryInterest: "jobs",
        secondaryInterests: ["projects"],
        skills: [],
        projects: [],
        evidenceItems: [],
        isDemo: false,
      };

      const strongEvidenceCtx: StudentPersonalizationContext = {
        personId: "student-evidence-diff-2",
        name: "Jaya",
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
        goal: "Get an AI/ML internship",
        primaryInterest: "jobs",
        secondaryInterests: ["projects"],
        skills: [
          { name: "Python", category: "skill", verificationStatus: "verified", source: "padho_code" },
          { name: "Transformers", category: "skill", verificationStatus: "verified", source: "assessment" },
        ],
        projects: [
          {
            id: "proj-1",
            title: "Multi-Agent Code Assistant",
            technologies: ["Python", "LangChain", "FastAPI", "Docker"],
            sources: ["github"],
            status: "confirmed",
          },
        ],
        evidenceItems: [
          makeEvidence({
            id: "ev-1",
            category: "skill",
            subject: "Python & Algorithms",
            value: "Advanced",
            verificationStatus: "verified",
            source: "institutional",
          }),
        ],
        verifiedReadinessScore: 82,
        isReadinessAvailable: true,
        isDemo: false,
      };

      const compZero = composePersonalizedDashboard(zeroEvidenceCtx);
      const compStrong = composePersonalizedDashboard(strongEvidenceCtx);

      // Student with zero evidence is told to build first project
      assert.ok(compZero.nextBestActions.some((a) => a.id === "act_add_first_project"));
      assert.strictEqual(compZero.summaryCards.find((c) => c.id === "card_readiness")?.value, "Provisional");

      // Student with verified project is recommended verification or interview practice
      assert.ok(!compStrong.nextBestActions.some((a) => a.id === "act_add_first_project"));
      assert.ok(compStrong.nextBestActions.some((a) => a.id === "act_verify_project" || a.actionType === "Interview"));
      assert.strictEqual(compStrong.summaryCards.find((c) => c.id === "card_readiness")?.value, "82%");
    });
  });

  // --------------------------------------------------------------------------
  // 5. CERTIFICATION OF ALL 96 COMBINATIONS
  // --------------------------------------------------------------------------
  describe("5. Combination Engine — All 96 Permutations Certification", () => {
    function generateAll96Combinations(): Array<{ primary: CanonicalInterest; secondaries: CanonicalInterest[] }> {
      const combos: Array<{ primary: CanonicalInterest; secondaries: CanonicalInterest[] }> = [];

      for (const primary of CANONICAL_INTEREST_KEYS) {
        const others = CANONICAL_INTEREST_KEYS.filter((k) => k !== primary);

        // 1. Single-interest mode (0 secondary)
        combos.push({ primary, secondaries: [] });

        // 2. Pair mode (1 secondary): 5 combinations
        for (const sec of others) {
          combos.push({ primary, secondaries: [sec] });
        }

        // 3. Triad mode (2 secondaries): (5 * 4)/2 = 10 combinations
        for (let i = 0; i < others.length; i++) {
          for (let j = i + 1; j < others.length; j++) {
            combos.push({ primary, secondaries: [others[i], others[j]] });
          }
        }
      }
      return combos;
    }

    it("verifies exact mathematical count of 96 configurations", () => {
      const combos = generateAll96Combinations();
      assert.strictEqual(combos.length, 96, "Must generate exactly 96 interest combinations");
    });

    it("executes all 96 configurations against isolated real-data fixtures without error or undefined fields", () => {
      const combos = generateAll96Combinations();

      for (const combo of combos) {
        const ctx: StudentPersonalizationContext = {
          personId: `test-96-${combo.primary}`,
          name: "Student",
          targetRole: "Generative AI Engineer",
          targetRoleId: "genai_engineer",
          goal: "Get an AI/ML internship",
          primaryInterest: combo.primary,
          secondaryInterests: combo.secondaries,
          skills: [],
          projects: [],
          evidenceItems: [],
          isDemo: false,
        };

        const comp = composePersonalizedDashboard(ctx);

        // Verification assertions
        assert.strictEqual(comp.primaryInterest, combo.primary);
        assert.deepStrictEqual(comp.secondaryInterests, combo.secondaries);
        assert.ok(comp.hero.headline, `Hero headline required for ${comp.configurationId}`);
        assert.ok(comp.hero.subheadline, `Hero subheadline required for ${comp.configurationId}`);
        assert.ok(comp.hero.focusTags.length >= 2, `Focus tags required for ${comp.configurationId}`);
        assert.ok(comp.summaryCards.length === 6, `Summary cards must be exactly 6 for ${comp.configurationId}`);
        assert.ok(comp.skillMap.nodes.length >= 6, `Skill map nodes must be at least 6 for ${comp.configurationId}`);
        assert.ok(comp.growthSection.rolePrerequisites.length >= 3, `Prerequisites required for ${comp.configurationId}`);
        assert.ok(comp.nextBestActions.length >= 1, `Next actions required for ${comp.configurationId}`);

        // Every action must have valid destination URL and whyAmISeeingThis justification
        for (const act of comp.nextBestActions) {
          assert.ok(act.destinationUrl.startsWith("/") || act.destinationUrl.startsWith("#"), "Action URL must be absolute or anchor");
          assert.ok(act.whyAmISeeingThis.goalRelevance, "Goal relevance justification required");
          assert.ok(act.whyAmISeeingThis.actionOutcome, "Action outcome justification required");
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 6. MULTI-USER ISOLATION & PERSISTENCE INTEGRITY
  // --------------------------------------------------------------------------
  describe("6. Cross-Account Isolation & Demonstration Guardrails", () => {
    it("ensures student A and student B receive strictly isolated compositions", () => {
      const studentA: StudentPersonalizationContext = {
        personId: "student-alpha",
        name: "Alpha User",
        targetRole: "AI Researcher",
        targetRoleId: "ai_researcher",
        primaryInterest: "research_events",
        secondaryInterests: ["people"],
        skills: [{ name: "Linear Algebra", category: "skill", verificationStatus: "verified", source: "exam" }],
        projects: [],
        evidenceItems: [],
        isDemo: false,
      };

      const studentB: StudentPersonalizationContext = {
        personId: "student-beta",
        name: "Beta User",
        targetRole: "Machine Learning Engineer",
        targetRoleId: "ml_engineer",
        primaryInterest: "jobs",
        secondaryInterests: ["projects"],
        skills: [{ name: "Docker", category: "skill", verificationStatus: "unverified", source: "self_reported" }],
        projects: [],
        evidenceItems: [],
        isDemo: false,
      };

      const compA = composePersonalizedDashboard(studentA);
      const compB = composePersonalizedDashboard(studentB);

      assert.strictEqual(compA.hero.greeting, "Welcome, Alpha User");
      assert.strictEqual(compB.hero.greeting, "Welcome, Beta User");
      assert.strictEqual(compA.targetRole, "AI Researcher");
      assert.strictEqual(compB.targetRole, "Machine Learning Engineer");
      assert.notStrictEqual(compA.hero.headline, compB.hero.headline);
    });

    it("strictly isolates demo catalog to demo mode", () => {
      const realCtx: StudentPersonalizationContext = {
        personId: "real-student",
        name: "Real User",
        targetRole: "Generative AI Engineer",
        targetRoleId: "genai_engineer",
        primaryInterest: "jobs",
        skills: [],
        projects: [],
        evidenceItems: [],
        isDemo: false,
      };

      const demoCtx: StudentPersonalizationContext = {
        ...realCtx,
        isDemo: true,
      };

      const compReal = composePersonalizedDashboard(realCtx);
      const compDemo = composePersonalizedDashboard(demoCtx);

      assert.strictEqual(compReal.ecosystemSection.internships.length, 0, "Real student must get 0 fake internships");
      assert.ok(compDemo.ecosystemSection.internships.length > 0, "Demo student gets preview catalog");
      assert.strictEqual(compReal.sourceFreshness.isDemo, false);
      assert.strictEqual(compDemo.sourceFreshness.isDemo, true);
    });
  });
});
