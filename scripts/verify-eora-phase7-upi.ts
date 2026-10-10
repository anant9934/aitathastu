/**
 * EORA ALIVE PHASE 7 — Universal Page Intelligence (UPI) & Intent Verification
 * 
 * Verifies:
 * 1. Page Knowledge Registry & Route Resolution across all 16 routes + fallbacks.
 * 2. Intent Engine disambiguation & multilingual intent detection (EN/HI/Hinglish).
 * 3. Dialogue generation grounding in page contracts and authenticated context.
 * 4. Safe Action Engine whitelisting & sensitive field protection.
 * 5. Strict User Context Isolation between distinct students.
 * 6. Zero LLM calls during all standard UPI interactions.
 */

import {
  PAGE_CONTRACTS,
  getPageContract,
  resolvePageContract,
  getAllPageContracts,
  getCoverageReport,
  type EoraPageContract
} from "../lib/eora/page-registry";

import {
  recognizeIntent,
  type EoraIntent
} from "../lib/eora/intent";

import {
  getIntentResponse,
  getRouteWelcomeMessage,
  type EoraMessage
} from "../lib/eora/dialogue";

import {
  createDefaultContext,
  type EoraContext,
  type StudentContext
} from "../lib/eora/context";

import {
  executeSafeAction,
  isActionSafe,
  ALLOWED_EORA_ACTIONS,
  ALLOWED_NAVIGATION_ROUTES,
  type EoraSafeAction
} from "../lib/eora/actions";

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const testResults: TestResult[] = [];

function assert(suite: string, name: string, condition: boolean, details?: string) {
  testResults.push({ suite, name, passed: condition, details });
  const mark = condition ? "✓ PASS" : "✗ FAIL";
  console.log(`[${suite}] ${mark}: ${name}${details ? ` (${details})` : ""}`);
}

async function runTestSuite() {
  console.log("===============================================================================");
  console.log("AI TATHASTU — EORA ALIVE PHASE 7: UNIVERSAL PAGE INTELLIGENCE (UPI) VERIFICATION");
  console.log("===============================================================================\n");

  // ===========================================================================
  // SUITE 1: Page Knowledge Registry & Route Discovery
  // ===========================================================================
  console.log("--- SUITE 1: PAGE KNOWLEDGE REGISTRY & ROUTE RESOLUTION ---");

  const expectedPageIds = [
    "landing",
    "sign-in",
    "sign-up",
    "onboarding",
    "student-home",
    "student-profile",
    "student-skills",
    "student-skill-detail",
    "student-projects",
    "student-project-detail",
    "student-roadmap",
    "student-connections",
    "student-journey",
    "student-assessments",
    "student-interviews",
    "verification"
  ];

  assert(
    "Registry",
    "All 16 required Page IDs exist in PAGE_CONTRACTS",
    expectedPageIds.every((id) => Boolean(PAGE_CONTRACTS[id])),
    `Count: ${Object.keys(PAGE_CONTRACTS).length}/16`
  );

  for (const pageId of expectedPageIds) {
    const contract = PAGE_CONTRACTS[pageId];
    const validStructure =
      Boolean(contract.pageId) &&
      Boolean(contract.routePath) &&
      Boolean(contract.pageTitle) &&
      Boolean(contract.pagePurpose) &&
      Array.isArray(contract.mainUserGoals) && contract.mainUserGoals.length > 0 &&
      Array.isArray(contract.keySections) && contract.keySections.length > 0 &&
      Array.isArray(contract.importantButtons) &&
      Array.isArray(contract.validationRules) &&
      Array.isArray(contract.commonQuestions) && contract.commonQuestions.length > 0 &&
      Boolean(contract.guidedTour) && Array.isArray(contract.guidedTour.steps) && contract.guidedTour.steps.length > 0 &&
      Array.isArray(contract.completionConditions);

    assert(
      "Registry",
      `Contract structure complete for '${pageId}'`,
      validStructure,
      `Sections: ${contract.keySections.length}, Qs: ${contract.commonQuestions.length}, Tour Steps: ${contract.guidedTour.steps.length}`
    );
  }

  // Test Route Resolution
  const routeResolutionTests: Array<{ path: string; expectedId: string }> = [
    { path: "/", expectedId: "landing" },
    { path: "/sign-in", expectedId: "sign-in" },
    { path: "/sign-up", expectedId: "sign-up" },
    { path: "/onboarding", expectedId: "onboarding" },
    { path: "/onboarding?step=3", expectedId: "onboarding" },
    { path: "/student", expectedId: "student-home" },
    { path: "/student/profile", expectedId: "student-profile" },
    { path: "/student/skills", expectedId: "student-skills" },
    { path: "/student/skills/Python", expectedId: "student-skill-detail" },
    { path: "/student/skills/Deep%20Learning", expectedId: "student-skill-detail" },
    { path: "/student/projects", expectedId: "student-projects" },
    { path: "/student/projects/proj-12345", expectedId: "student-project-detail" },
    { path: "/student/roadmap", expectedId: "student-roadmap" },
    { path: "/student/connections", expectedId: "student-connections" },
    { path: "/student/journey", expectedId: "student-journey" },
    { path: "/student/assessments", expectedId: "student-assessments" },
    { path: "/student/interviews", expectedId: "student-interviews" },
    { path: "/verification", expectedId: "verification" }
  ];

  for (const { path, expectedId } of routeResolutionTests) {
    const resolved = resolvePageContract(path);
    assert(
      "Route Resolution",
      `Resolves path '${path}' to '${expectedId}'`,
      resolved.pageId === expectedId,
      `Got: ${resolved.pageId}`
    );
  }

  // Test Fallback Contract for Unknown Routes
  const unknownPath = "/unmapped-future-experiment-route";
  const fallback = resolvePageContract(unknownPath);
  assert(
    "Route Fallback",
    "Safe generic fallback contract returned for unknown route",
    fallback.pageId === "generic-fallback" && fallback.routePath === unknownPath,
    `Fallback title: ${fallback.pageTitle}`
  );

  // Coverage Report Check
  const cov = getCoverageReport();
  assert(
    "Coverage Report",
    "Coverage report covers all 16 registered pages",
    cov.total === 16 && cov.routes.length === 16,
    `Total: ${cov.total}`
  );

  // ===========================================================================
  // SUITE 2: Intent Engine & Multilingual Capabilities
  // ===========================================================================
  console.log("\n--- SUITE 2: INTENT ENGINE & MULTILINGUAL CAPABILITIES ---");

  const intentQueries: Array<{
    query: string;
    route?: string;
    expectedIntent: EoraIntent;
    expectedParams?: Record<string, string>;
  }> = [
    // Explain Page
    { query: "What is this page?", expectedIntent: "EXPLAIN_CURRENT_PAGE" },
    { query: "Yeh page kya hai?", expectedIntent: "EXPLAIN_CURRENT_PAGE" },
    { query: "Is page ke baare mein batao", expectedIntent: "EXPLAIN_CURRENT_PAGE" },
    { query: "Explain this screen to me", expectedIntent: "EXPLAIN_CURRENT_PAGE" },

    // Tours
    { query: "Show me around", expectedIntent: "START_PAGE_TOUR" },
    { query: "Take me on a tour", expectedIntent: "START_FULL_TOUR" },
    { query: "Tour shuru karo", expectedIntent: "START_PAGE_TOUR" },
    { query: "Stop the tour please", expectedIntent: "STOP_TOUR" },
    { query: "Tour band karo", expectedIntent: "STOP_TOUR" },
    { query: "Cancel tour", expectedIntent: "STOP_TOUR" },

    // Next Action
    { query: "What should I do next?", route: "/student", expectedIntent: "SHOW_NEXT_ACTION" },
    { query: "Ab kya karu?", route: "/onboarding", expectedIntent: "SHOW_NEXT_ACTION" },
    { query: "What's my next step?", route: "/student/projects", expectedIntent: "SHOW_NEXT_ACTION" },

    // Form Assistance
    { query: "Help me complete this form", expectedIntent: "HELP_WITH_FORM" },
    { query: "Form fill karne mein help karo", expectedIntent: "HELP_WITH_FORM" },
    { query: "How do I fill these fields?", expectedIntent: "HELP_WITH_FORM" },

    // Errors
    { query: "Something went wrong here", expectedIntent: "EXPLAIN_ERROR" },
    { query: "Error aa gaya", expectedIntent: "EXPLAIN_ERROR" },
    { query: "Why is it failing?", expectedIntent: "EXPLAIN_ERROR" },

    // Explanations: Evidence / Recommendations / Metrics
    { query: "Why am I seeing this recommendation?", expectedIntent: "EXPLAIN_RECOMMENDATION" },
    { query: "Why am I seeing this evidence?", expectedIntent: "EXPLAIN_EVIDENCE" },
    { query: "Why this metric score?", expectedIntent: "EXPLAIN_METRIC" },

    // Navigation & Routing
    { query: "Take me to my projects", expectedIntent: "NAVIGATE", expectedParams: { targetRoute: "/student/projects" } },
    { query: "Go to my skills page", expectedIntent: "NAVIGATE", expectedParams: { targetRoute: "/student/skills" } },
    { query: "Take me to my roadmap", expectedIntent: "NAVIGATE", expectedParams: { targetRoute: "/student/roadmap" } },
    { query: "Take me to digital footprints", expectedIntent: "NAVIGATE", expectedParams: { targetRoute: "/student/connections" } },


    // Simplification & Hinglish Switch
    { query: "I don't understand", expectedIntent: "SIMPLIFY_EXPLANATION" },
    { query: "Samajh nahi aaya, aasan bhasha mein batao", expectedIntent: "SIMPLIFY_EXPLANATION" },
    { query: "Explain in simpler terms", expectedIntent: "SIMPLIFY_EXPLANATION" },
    { query: "Explain in Hinglish", expectedIntent: "SWITCH_LANGUAGE", expectedParams: { targetLanguage: "hinglish" } },
    { query: "Hinglish mein bolo", expectedIntent: "SWITCH_LANGUAGE", expectedParams: { targetLanguage: "hinglish" } },
    { query: "Switch to English", expectedIntent: "SWITCH_LANGUAGE", expectedParams: { targetLanguage: "english" } }
  ];

  for (const { query, route, expectedIntent, expectedParams } of intentQueries) {
    const recognized = recognizeIntent(query, route);
    assert(
      "Intent Engine",
      `Query "${query}" -> ${expectedIntent}`,
      recognized.intent === expectedIntent,
      `Got: ${recognized.intent} (Confidence: ${recognized.confidence})`
    );

    if (expectedParams) {
      for (const [key, val] of Object.entries(expectedParams)) {
        assert(
          "Intent Params",
          `Param '${key}' for "${query}" equals '${val}'`,
          recognized.params?.[key] === val,
          `Got: ${recognized.params?.[key]}`
        );
      }
    }
  }

  // Test Contextual Disambiguation of "What's next?"
  const onboardingNext = recognizeIntent("What's next?", "/onboarding");
  assert(
    "Disambiguation",
    "'What's next?' in /onboarding maps to SHOW_NEXT_ACTION",
    onboardingNext.intent === "SHOW_NEXT_ACTION"
  );

  const projectsNext = recognizeIntent("What's next?", "/student/projects");
  assert(
    "Disambiguation",
    "'What's next?' in /student/projects maps to SHOW_NEXT_ACTION",
    projectsNext.intent === "SHOW_NEXT_ACTION"
  );

  // ===========================================================================
  // SUITE 3: Grounded Dialogue Generation
  // ===========================================================================
  console.log("\n--- SUITE 3: GROUNDED DIALOGUE GENERATION ---");

  const studentContext: EoraContext = {
    ...createDefaultContext(),
    route: "student-projects",
    student: {
      personId: "student-001",
      displayName: "Aryan Sharma",
      isAuthenticated: true,
      activeGoalTitle: "Build AI Projects",
      targetRole: "Machine Learning Engineer",
      primaryPriority: "learn-ai",
      secondaryPriorities: ["collaborate"],
      skillsCount: 5,
      projectsCount: 2,
      verifiedEvidenceCount: 3,
      completedTourIds: [],
      dismissedSuggestionIds: [],
      isProcessing: false,
      connectedSources: ["github"],
      nextMilestoneTitle: "Deep Learning Architectures"
    }
  };

  // Test Page Explanation
  const pageExplanation = getIntentResponse("EXPLAIN_PAGE", studentContext);
  assert(
    "Dialogue",
    "EXPLAIN_PAGE returns grounded explanation for 'student-projects'",
    pageExplanation.text.includes("project") || pageExplanation.text.includes("Project"),
    `Text sample: ${pageExplanation.text.slice(0, 80)}...`
  );

  // Test Form Assistance
  const formAssistance = getIntentResponse("HELP_WITH_FORM", studentContext);
  assert(
    "Dialogue",
    "HELP_WITH_FORM provides step-by-step form guidance",
    formAssistance.text.includes("field") || formAssistance.text.includes("form") || formAssistance.text.includes("Project Title"),
    `Animation: ${formAssistance.animationState}`
  );

  // Test Next Action on Projects page
  const nextActionProjects = getIntentResponse("SHOW_NEXT_ACTION", studentContext);
  assert(
    "Dialogue",
    "SHOW_NEXT_ACTION on projects page suggests milestone or roadmap",
    nextActionProjects.text.includes("Deep Learning Architectures") || nextActionProjects.text.includes("roadmap"),
    `Action suggested: ${nextActionProjects.text.slice(0, 90)}...`
  );

  // Test Hinglish Switching
  const hinglishResponse = getIntentResponse("SWITCH_LANGUAGE", studentContext, { targetLanguage: "hinglish" });
  assert(
    "Dialogue",
    "Hinglish parameter generates authentic Hinglish response",
    hinglishResponse.text.includes("Hinglish") && hinglishResponse.text.includes("taiyaar"),
    `Text: ${hinglishResponse.text.slice(0, 90)}...`
  );

  // Test Simplification
  const simplified = getIntentResponse("SIMPLIFY_EXPLANATION", studentContext);
  assert(
    "Dialogue",
    "SIMPLIFY_EXPLANATION returns clear, simplified instructions",
    simplified.text.includes("Simply put:") || simplified.text.includes("get started"),
    `Animation: ${simplified.animationState}`
  );

  // Test Error Explanation
  const errorExplanation = getIntentResponse("EXPLAIN_ERROR", studentContext);
  assert(
    "Dialogue",
    "EXPLAIN_ERROR gives empathetic, recoverable guidance",
    errorExplanation.text.includes("Something didn't go as expected") || errorExplanation.text.includes("recover"),
    `Animation: ${errorExplanation.animationState}`
  );

  // ===========================================================================
  // SUITE 4: Safe Action Engine & Security Boundary
  // ===========================================================================
  console.log("\n--- SUITE 4: SAFE ACTION ENGINE & SECURITY BOUNDARY ---");

  // Valid Actions
  const validActions: EoraSafeAction[] = [
    { type: "HIGHLIGHT_ELEMENT", targetId: "eora-projects-header" },
    { type: "SCROLL_TO_SECTION", targetId: "eora-projects-list" },
    { type: "FOCUS_FIELD", fieldId: "project-title-input" },
    { type: "NAVIGATE_ROUTE", route: "/student/projects" },
    { type: "START_PAGE_TOUR", tourId: "student-projects" },
    { type: "SWITCH_LANGUAGE", language: "hinglish" },
    { type: "SET_ASSISTANCE_MODE", mode: "quiet" }
  ];

  for (const action of validActions) {
    const safetyCheck = isActionSafe(action);
    assert(
      "Safe Action",
      `Action '${action.type}' is validated as safe`,
      safetyCheck.safe,
      safetyCheck.reason
    );

    const executed = executeSafeAction(action);
    assert(
      "Safe Action Execution",
      `Action '${action.type}' executed successfully`,
      executed.success,
      executed.message
    );
  }

  // Security Gate: Disallowed / Malicious / Sensitive Actions
  const maliciousActions: EoraSafeAction[] = [
    // Sensitive field focus
    { type: "FOCUS_FIELD", fieldId: "field-password" },
    { type: "FOCUS_FIELD", fieldId: "user-otp-code" },
    { type: "FOCUS_FIELD", fieldId: "pin_security_secret" },
    { type: "FOCUS_FIELD", fieldId: "api-token-key" },
    // Unauthorized navigations
    { type: "NAVIGATE_ROUTE", route: "https://external-phishing-site.com" },
    { type: "NAVIGATE_ROUTE", route: "/admin/danger-delete-database" },
    { type: "NAVIGATE_ROUTE", route: "javascript:alert(document.cookie)" }
  ];

  for (const action of maliciousActions) {
    const safetyCheck = isActionSafe(action);
    assert(
      "Security Gate",
      `Malicious/sensitive action '${action.type}' (${action.fieldId || action.route || 'unauthorized'}) is BLOCKED`,
      !safetyCheck.safe,
      `Blocked reason: ${safetyCheck.reason}`
    );

    const result = executeSafeAction(action);
    assert(
      "Security Enforcement",
      `Execution rejected for unsafe action '${action.type}'`,
      !result.success,
      `Result: ${result.error}`
    );
  }

  // ===========================================================================
  // SUITE 5: Strict User Context Isolation
  // ===========================================================================
  console.log("\n--- SUITE 5: STRICT USER CONTEXT ISOLATION ---");

  const studentA: EoraContext = {
    ...createDefaultContext(),
    route: "student-home",
    student: {
      personId: "student-aarav",
      displayName: "Aarav Patel",
      isAuthenticated: true,
      activeGoalTitle: "Computer Vision Researcher",
      targetRole: "CV Researcher",
      primaryPriority: "learn-ai",
      secondaryPriorities: ["research"],
      skillsCount: 4,
      projectsCount: 1,
      verifiedEvidenceCount: 2,
      completedTourIds: [],
      dismissedSuggestionIds: [],
      isProcessing: false,
      connectedSources: ["github"],
      nextMilestoneTitle: "3D Gaussian Splatting"
    }
  };

  const studentB: EoraContext = {
    ...createDefaultContext(),
    route: "student-home",
    student: {
      personId: "student-diya",
      displayName: "Diya Sengupta",
      isAuthenticated: true,
      activeGoalTitle: "Data Platform Engineer",
      targetRole: "Data Engineer",
      primaryPriority: "collaborate",
      secondaryPriorities: ["jobs"],
      skillsCount: 7,
      projectsCount: 3,
      verifiedEvidenceCount: 5,
      completedTourIds: [],
      dismissedSuggestionIds: [],
      isProcessing: false,
      connectedSources: ["github", "gitlab"],
      nextMilestoneTitle: "Distributed Event Streaming"
    }
  };

  const responseA = getIntentResponse("SHOW_NEXT_ACTION", studentA);
  const responseB = getIntentResponse("SHOW_NEXT_ACTION", studentB);

  assert(
    "User Isolation",
    "Student A response does NOT contain Student B's name, goal, skills, or projects",
    !responseA.text.includes(studentB.student.displayName!) &&
    !responseA.text.includes(studentB.student.nextMilestoneTitle!) &&
    responseA.text.includes(studentA.student.nextMilestoneTitle!)
  );

  assert(
    "User Isolation",
    "Student B response does NOT contain Student A's name, goal, skills, or projects",
    !responseB.text.includes(studentA.student.displayName!) &&
    !responseB.text.includes(studentA.student.nextMilestoneTitle!) &&
    responseB.text.includes(studentB.student.nextMilestoneTitle!)
  );

  // Test session clearing
  const clearedContext: EoraContext = {
    ...createDefaultContext(),
    route: "landing",
    student: {
      personId: null,
      displayName: null,
      isAuthenticated: false,
      activeGoalTitle: null,
      targetRole: null,
      primaryPriority: null,
      secondaryPriorities: [],
      skillsCount: 0,
      projectsCount: 0,
      verifiedEvidenceCount: 0,
      completedTourIds: [],
      dismissedSuggestionIds: [],
      isProcessing: false,
      connectedSources: [],
      nextMilestoneTitle: null
    }
  };
  const visitorResponse = getIntentResponse("EXPLAIN_PAGE", clearedContext);
  assert(
    "User Isolation",
    "Logged out / visitor context contains zero previous student data",
    !visitorResponse.text.includes("Aarav") &&
    !visitorResponse.text.includes("Diya") &&
    !visitorResponse.text.includes("Gaussian") &&
    !visitorResponse.text.includes("Streaming")
  );

  // ===========================================================================
  // SUITE 6: Zero Routine LLM Calls Verification
  // ===========================================================================
  console.log("\n--- SUITE 6: ZERO ROUTINE LLM CALLS VERIFICATION ---");

  // Track global fetch calls to ensure zero LLM network traffic
  let networkCallsCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    networkCallsCount++;
    console.error(`[VIOLATION] Unexpected fetch during deterministic UPI: ${args[0]}`);
    return originalFetch(...args);
  };

  try {
    // Run 150+ combinations of intents, routes, contexts, and actions
    for (const pageId of expectedPageIds) {
      const contract = PAGE_CONTRACTS[pageId];
      const ctx: EoraContext = {
        ...createDefaultContext(),
        route: pageId as any,
        student: { ...studentA.student }
      };

      getRouteWelcomeMessage(ctx);
      getIntentResponse("EXPLAIN_PAGE", ctx);
      getIntentResponse("SHOW_NEXT_ACTION", ctx);
      getIntentResponse("HELP_WITH_FORM", ctx);
      getIntentResponse("EXPLAIN_ERROR", ctx);
      recognizeIntent("Explain this page", contract.routePath);
      recognizeIntent("Show me around", contract.routePath);
      recognizeIntent("Help me complete this", contract.routePath);
      recognizeIntent("What should I do next?", contract.routePath);
      recognizeIntent("Explain in Hinglish", contract.routePath);
    }

    assert(
      "Zero LLM Policy",
      "All 150+ routine UPI operations executed with ZERO external LLM network requests",
      networkCallsCount === 0,
      `Recorded network requests: ${networkCallsCount}`
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // ===========================================================================
  // SUMMARY REPORT
  // ===========================================================================
  console.log("\n===============================================================================");
  const totalTests = testResults.length;
  const passedTests = testResults.filter((r) => r.passed).length;
  const failedTests = testResults.filter((r) => !r.passed).length;

  console.log(`EORA PHASE 7 UPI VERIFICATION SUMMARY:`);
  console.log(`TOTAL CHECKS : ${totalTests}`);
  console.log(`PASSED       : ${passedTests}`);
  console.log(`FAILED       : ${failedTests}`);
  console.log(`SUCCESS RATE : ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log("===============================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
