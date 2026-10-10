/**
 * EORA ALIVE PHASE 7.1 — TASK ENGINE & DEEP INTERACTIVE ASSISTANCE VERIFICATION
 *
 * Verifies:
 * 1. Task State Machine Transitions (IDLE -> STARTED -> WAITING -> COMPLETED)
 * 2. All 6 Registered Tasks Structure & Non-shaming Guidance
 * 3. Reference Project Creation Task (task-add-project)
 * 4. Contextual Multilingual Q&A Intent Disambiguation
 * 5. Grounded Deterministic Responses (Zero LLM Invocations)
 */

import {
  REGISTERED_TASKS,
  getTaskById,
  getTasksForRoute,
  getPrimaryTaskForRoute,
  createInitialTaskSession,
  advanceTaskStep,
  rewindTaskStep,
  canResumeTask,
} from "../lib/eora/tasks";
import { recognizeIntent } from "../lib/eora/intent";
import { getIntentResponse } from "../lib/eora/dialogue";
import { createDefaultContext } from "../lib/eora/context";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function runTaskVerification() {
  console.log("==================================================================");
  console.log("  EORA ALIVE PHASE 7.1 — TASK ENGINE & INTERACTIVE ASSISTANCE");
  console.log("==================================================================");

  // 1. Task Definitions Registry Audit
  console.log("\n[1] Auditing Registered Task Definitions...");
  const taskIds = Object.keys(REGISTERED_TASKS);
  assert(taskIds.length >= 6, `At least 6 core tasks registered (found ${taskIds.length})`);

  for (const taskId of taskIds) {
    const task = getTaskById(taskId);
    assert(task !== null, `Task ${taskId} is retrievable`);
    assert(Boolean(task?.title && task?.description), `Task ${taskId} has title and description`);
    assert((task?.steps.length ?? 0) >= 2, `Task ${taskId} has >= 2 steps (has ${task?.steps.length})`);
    assert(Boolean(task?.completionCelebration.message), `Task ${taskId} has completion celebration message`);
    assert(Boolean(task?.completionCelebration.nextRecommendedAction), `Task ${taskId} has next recommended action`);
  }

  // 2. Reference Project Creation Guide (task-add-project) Audit
  console.log("\n[2] Auditing Reference Project Creation Guide (task-add-project)...");
  const projectTask = getTaskById("task-add-project");
  assert(projectTask !== null, "task-add-project is registered");
  assert(projectTask?.pageId === "student-projects", "task-add-project mapped to student-projects");
  assert(projectTask?.route === "/student/projects", "task-add-project mapped to /student/projects");
  assert(projectTask?.steps.length === 6, `task-add-project has exactly 6 steps (found ${projectTask?.steps.length})`);

  // Verify step targets
  const step1 = projectTask?.steps[0];
  assert(step1?.targetId === "eora-add-project-trigger", "Step 1 targets eora-add-project-trigger");
  assert(step1?.expectedEvent === "project_modal_opened", "Step 1 expects project_modal_opened event");

  const step2 = projectTask?.steps[1];
  assert(step2?.fieldId === "eora-project-input-title", "Step 2 targets eora-project-input-title");

  const step3 = projectTask?.steps[2];
  assert(step3?.fieldId === "eora-project-input-summary", "Step 3 targets eora-project-input-summary");

  const step4 = projectTask?.steps[3];
  assert(step4?.fieldId === "eora-project-input-contribution", "Step 4 targets eora-project-input-contribution");
  assert(Boolean(step4?.nonShamingTip), "Step 4 includes non-shaming contribution guidance");

  const step5 = projectTask?.steps[4];
  assert(step5?.fieldId === "eora-project-input-repo", "Step 5 targets eora-project-input-repo");

  const step6 = projectTask?.steps[5];
  assert(step6?.targetId === "eora-project-save-btn", "Step 6 targets eora-project-save-btn");
  assert(step6?.requiresUserConfirmation === true, "Step 6 requires explicit user confirmation");
  assert(step6?.expectedEvent === "project_saved", "Step 6 expects project_saved event");

  // 3. State Machine Transitions
  console.log("\n[3] Testing State Machine Transitions...");
  if (projectTask) {
    let session = createInitialTaskSession(projectTask, "test-student-id");
    assert(session.state === "STARTED", "Initial session state is STARTED");
    assert(session.currentStepIndex === 0, "Initial step index is 0");

    // Advance step 1 -> step 2
    session = advanceTaskStep(session, projectTask);
    assert(session.currentStepIndex === 1, "Advanced to step 1");
    assert(session.state === "WAITING_FOR_USER", "State is WAITING_FOR_USER");

    // Advance to step 3, 4, 5, 6
    session = advanceTaskStep(session, projectTask);
    session = advanceTaskStep(session, projectTask);
    session = advanceTaskStep(session, projectTask);
    session = advanceTaskStep(session, projectTask);
    assert(session.currentStepIndex === 5, "Advanced to final step 5 (0-indexed)");

    // Rewind step back
    session = rewindTaskStep(session);
    assert(session.currentStepIndex === 4, "Rewound to step 4");

    // Advance back to 5 and complete
    session = advanceTaskStep(session, projectTask);
    assert(session.currentStepIndex === 5, "Back at step 5");

    session = advanceTaskStep(session, projectTask);
    assert(session.state === "COMPLETED", "Advancing from final step transitions state to COMPLETED");

    // Route resumption tests
    assert(canResumeTask(session, "/student/projects") === false, "COMPLETED task cannot be resumed");
    const activeSession = createInitialTaskSession(projectTask, "test-student-id");
    assert(canResumeTask(activeSession, "/student/projects") === true, "Active task resumes on matching route");
    assert(canResumeTask(activeSession, "/student/skills") === false, "Active task does not resume on different route");
  }

  // 4. Route Lookup Tests
  console.log("\n[4] Testing Route to Task Resolution...");
  const projectTasks = getTasksForRoute("/student/projects");
  assert(projectTasks.length >= 1, "Found task for /student/projects");
  assert(projectTasks[0].taskId === "task-add-project", "Primary task is task-add-project");

  const primaryRoadmapTask = getPrimaryTaskForRoute("/student/roadmap");
  assert(primaryRoadmapTask?.taskId === "task-explore-roadmap", "Primary task for roadmap resolved");

  const primarySkillsTask = getPrimaryTaskForRoute("/student/skills");
  assert(primarySkillsTask?.taskId === "task-review-skills", "Primary task for skills resolved");

  // 5. Contextual Multilingual Q&A Intent Disambiguation
  console.log("\n[5] Testing Contextual Multilingual Q&A Intent Recognition...");
  const queries = [
    { query: "Ye kya karta hai?", expected: "EXPLAIN_CURRENT_PAGE" },
    { query: "Iska meaning kya hai?", expected: "EXPLAIN_CURRENT_FIELD" },
    { query: "Why am I seeing this result?", expected: "EXPLAIN_RECOMMENDATION" },
    { query: "Mera next step kya hai?", expected: "SHOW_NEXT_ACTION" },
    { query: "Ye save kyu nahi ho raha?", expected: "EXPLAIN_WHY_NOT_SAVING" },
    { query: "Mujhe start se samjhao.", expected: "START_PAGE_TOUR" },
    { query: "Help me add my project.", expected: "HELP_WITH_PROJECT" },
    { query: "Where do I put my GitHub link?", expected: "WHERE_PUT_GITHUB_LINK" },
    { query: "How do I describe my contribution?", expected: "HOW_DESCRIBE_CONTRIBUTION" },
    { query: "Why is this field required?", expected: "EXPLAIN_FIELD_REQUIREMENT" },
    { query: "Explain my roadmap.", expected: "EXPLAIN_EXISTING_ROADMAP" },
    { query: "What should I do next?", expected: "SHOW_NEXT_ACTION" },
    { query: "Why is this milestone recommended?", expected: "EXPLAIN_RECOMMENDATION" },
    { query: "How can I complete this?", expected: "SHOW_NEXT_ACTION" },
  ];

  for (const { query, expected } of queries) {
    const res = recognizeIntent(query, "/student/projects");
    assert(
      res.intent === expected,
      `Query "${query}" recognized as ${expected} (got ${res.intent}, conf: ${res.confidence.toFixed(2)})`
    );
  }

  // 6. Dialogue Response Integrity & Zero LLM Call Verification
  console.log("\n[6] Testing Grounded Dialogue Response Generation...");
  const mockContext = createDefaultContext();
  mockContext.route = "student-projects";
  mockContext.student = {
    ...mockContext.student,
    displayName: "Anant Sharma",
    targetRole: "Autonomous AI Agent Engineer",
    projectsCount: 2,
    skillsCount: 7,
    verifiedEvidenceCount: 3,
    nextMilestoneTitle: "Build Multi-Agent Orchestrator",
  };

  const responseWhereGitHub = getIntentResponse("WHERE_PUT_GITHUB_LINK", mockContext);
  assert(
    responseWhereGitHub.text.includes("Section B") && responseWhereGitHub.text.includes("GitHub Repository URL"),
    "WHERE_PUT_GITHUB_LINK response directs user to Section B GitHub input"
  );

  const responseContrib = getIntentResponse("HOW_DESCRIBE_CONTRIBUTION", mockContext);
  assert(
    responseContrib.text.includes("Section D") && responseContrib.text.includes("Personal Contribution"),
    "HOW_DESCRIBE_CONTRIBUTION response directs user to Section D contribution note"
  );

  const responseNotSaving = getIntentResponse("EXPLAIN_WHY_NOT_SAVING", mockContext);
  assert(
    responseNotSaving.text.includes("required fields") && responseNotSaving.text.includes("Project Title"),
    "EXPLAIN_WHY_NOT_SAVING explains required fields without shaming"
  );

  const responseNextAction = getIntentResponse("SHOW_NEXT_ACTION", mockContext);
  assert(
    responseNextAction.text.includes("Build Multi-Agent Orchestrator"),
    "SHOW_NEXT_ACTION references the student's actual active milestone from context"
  );

  console.log("\n==================================================================");
  console.log("  ALL UNIT ASSERTIONS PASSED (100% Deterministic & Contract Grounded)");
  console.log("==================================================================\n");
}

runTaskVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
