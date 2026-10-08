import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createGoal,
  updateGoal,
  createEvidenceItem,
  summarizeEvidence,
  evaluateGaps,
  computeNextActions,
  createJourneyEvent,
  sortJourneyEventsChronologically,
  migrateOnboardingToWorkspace,
  type EvidenceItem,
} from "../lib/domain";
import type { JourneyState } from "../lib/onboarding";

describe("Domain Layer Unit Tests", () => {
  // 1. Evidence classification
  it("1. classifies evidence correctly into available, self-reported, and unknown", () => {
    const items: EvidenceItem[] = [
      createEvidenceItem({
        category: "goal",
        subject: "ML Engineer",
        value: "Active goal",
        source: "self_reported",
        verificationStatus: "self_reported",
      }),
      createEvidenceItem({
        category: "education",
        subject: "B.Tech Computer Science",
        value: "Graduated 2024",
        source: "self_reported",
        verificationStatus: "self_reported",
      }),
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Mentioned in resume",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
    ];

    const summary = summarizeEvidence(items, ["Deployment verification", "Assessment performance"]);
    assert.equal(summary.availableItems.length, 2); // goal + education
    assert.equal(summary.selfReportedItems.length, 3); // all self-reported or unverified
    assert.equal(summary.unknownAreas.length, 2);
  });

  // 2. Resume evidence remaining unverified
  it("2. ensures extracted resume evidence remains strictly unverified", () => {
    const resumeItem = createEvidenceItem({
      category: "skill",
      subject: "PyTorch",
      value: "Mentioned in resume",
      source: "resume_extracted",
      verificationStatus: "unverified",
    });

    assert.equal(resumeItem.source, "resume_extracted");
    assert.equal(resumeItem.verificationStatus, "unverified");
    assert.match(resumeItem.interpretation, /not verified proficiency/i);
    assert.notEqual(resumeItem.verificationStatus, "verified");
  });

  // 3. Unknown not being treated as weak
  it("3. handles missing information as unknown, never as weak", () => {
    const emptyEvidence: EvidenceItem[] = [];
    const evaluation = evaluateGaps("ML Engineer", emptyEvidence);

    const deploymentDim = evaluation.dimensions.find((d) => d.dimensionId === "deployment");
    assert.ok(deploymentDim);
    assert.equal(deploymentDim.state, "unknown");
    assert.doesNotMatch(deploymentDim.explanation.toLowerCase(), /weak/);
    assert.doesNotMatch(deploymentDim.explanation.toLowerCase(), /poor/);
    assert.equal(deploymentDim.explanation, "No verified deployment evidence yet.");
  });

  // 4. Gap calculation
  it("4. computes gaps with demonstrated, partially evidenced, and unknown states", () => {
    const evidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Python programming",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
    ];

    const evaluation = evaluateGaps("ML Engineer", evidence);
    const progDim = evaluation.dimensions.find((d) => d.dimensionId === "programming");
    const deployDim = evaluation.dimensions.find((d) => d.dimensionId === "deployment");

    assert.ok(progDim);
    assert.equal(progDim.state, "partially_evidenced");
    assert.ok(deployDim);
    assert.equal(deployDim.state, "unknown");
  });

  // 5. ML Engineer recommendations
  it("5. generates explainable ML Engineer recommendations capped at 3 actions", () => {
    const goal = createGoal("ML Engineer");
    const evidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Python and basic ML",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
    ];

    const gapEval = evaluateGaps(goal.title, evidence);
    const recs = computeNextActions(goal, evidence, gapEval);

    assert.ok(recs.length <= 3);
    assert.ok(recs.length > 0);
    const deployRec = recs.find((r) => r.id === "rec_ml_deployment");
    assert.ok(deployRec);
    assert.match(deployRec.reason, /deploying a model/i);
    assert.ok(deployRec.whyThis.goalRelevance.length > 0);
    assert.ok(deployRec.whyThis.whatWeKnow.length > 0);
    assert.ok(deployRec.whyThis.whatWeDontKnow.length > 0);
  });

  // 6. Custom goal fallback
  it("6. gracefully falls back to generic dimensions for custom goals", () => {
    const customGoal = createGoal("Community Solar Grid Architect");
    const gapEval = evaluateGaps(customGoal.title, []);

    assert.equal(gapEval.isCustomGoal, true);
    const dimensionLabels = gapEval.dimensions.map((d) => d.dimensionId);
    assert.deepEqual(dimensionLabels, ["learn", "build", "verify", "connect", "apply"]);

    const recs = computeNextActions(customGoal, [], gapEval);
    assert.ok(recs.length <= 3);
    assert.match(recs[0].title, /Community Solar Grid Architect/);
  });

  // 7. Goal change
  it("7. supports changing goal, recomputing gaps and preserving evidence", () => {
    const originalGoal = createGoal("ML Engineer");
    const evidence: EvidenceItem[] = [
      createEvidenceItem({
        category: "skill",
        subject: "Python",
        value: "Python skills",
        source: "resume_extracted",
        verificationStatus: "unverified",
      }),
    ];

    // Change to AI Founder
    const updated = updateGoal(originalGoal, "AI Founder");
    assert.equal(updated.title, "AI Founder");
    assert.equal(updated.id, originalGoal.id);

    const newGapEval = evaluateGaps(updated.title, evidence);
    assert.ok(newGapEval.dimensions.some((d) => d.dimensionId === "problem_discovery"));

    const newRecs = computeNextActions(updated, evidence, newGapEval);
    assert.ok(newRecs.some((r) => r.id.startsWith("rec_fnd_")));
    // Evidence was untouched
    assert.equal(evidence.length, 1);
  });

  // 8. Recommendation regeneration & dismiss state
  it("8. respects action state changes like dismissal and active status", () => {
    const goal = createGoal("ML Engineer");
    const gapEval = evaluateGaps(goal.title, []);

    const initialRecs = computeNextActions(goal, [], gapEval);
    assert.equal(initialRecs[0].status, "pending");

    // Dismiss first action
    const firstId = initialRecs[0].id;
    const withDismissed = computeNextActions(goal, [], gapEval, { [firstId]: "dismissed" });
    assert.ok(!withDismissed.some((r) => r.id === firstId && r.status !== "dismissed"));
  });

  // 9. Duplicate migration protection
  it("9. prevents duplicate evidence or events during idempotent migration", () => {
    const onboarding: JourneyState = {
      step: "finish",
      details: {
        name: "Aarav Sharma",
        education: "B.Tech CSE",
        skills: "Python, PyTorch",
        experience: "ML Intern at TechCorp",
      },
      profileSource: "resume",
      profileReviewed: true,
      goal: "ML Engineer",
      goalDraft: "ML Engineer",
      actionAccepted: true,
      guideMinimized: false,
    };

    const firstRun = migrateOnboardingToWorkspace(onboarding, null);
    assert.equal(firstRun.person.name, "Aarav Sharma");
    const initialEvidenceCount = firstRun.evidence.length;
    const initialEventCount = firstRun.journeyEvents.length;

    // Run again with firstRun passed as existingWorkspace
    const secondRun = migrateOnboardingToWorkspace(onboarding, firstRun);
    assert.equal(secondRun.evidence.length, initialEvidenceCount);
    assert.equal(secondRun.journeyEvents.length, initialEventCount);
  });

  // 10. Journey event creation
  it("10. creates and sorts legitimate chronological journey events", () => {
    const e1 = createJourneyEvent("onboarding_started", "Started", "Began journey", {
      timestamp: "2026-10-06T10:00:00Z",
    });
    const e2 = createJourneyEvent("goal_selected", "Goal set", "Selected ML Engineer", {
      timestamp: "2026-10-06T10:05:00Z",
    });
    const e3 = createJourneyEvent("goal_changed", "Goal changed", "Changed to AI Researcher", {
      timestamp: "2026-10-06T10:10:00Z",
    });

    const sortedDesc = sortJourneyEventsChronologically([e1, e3, e2], false);
    assert.equal(sortedDesc[0].type, "goal_changed");
    assert.equal(sortedDesc[2].type, "onboarding_started");

    const sortedAsc = sortJourneyEventsChronologically([e1, e3, e2], true);
    assert.equal(sortedAsc[0].type, "onboarding_started");
    assert.equal(sortedAsc[2].type, "goal_changed");
  });
});
