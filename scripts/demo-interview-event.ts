import { processAiInterviewEvent } from "../lib/services/integration-processor-service";
import { INTERVIEW_DEV_KEY } from "./seed-phase6-integration";

async function main() {
  console.log("Submitting demo AI Interview completed event...");

  const externalEventId = `int_evt_demo_${Date.now()}`;

  const payload = {
    producer: "ai_interview",
    externalEventId,
    payloadVersion: 1,
    occurredAt: new Date().toISOString(),
    student: {
      externalStudentId: "ai_int_arjun",
      email: "arjun.student@example.com",
    },
    session: {
      externalInterviewId: "session_ml_interview_01",
      targetRole: "ML Engineer",
      rubricVersion: "v1.0",
      completedAt: new Date().toISOString(),
    },
    dimensions: [
      {
        dimensionKey: "technical_reasoning",
        dimensionLabel: "Technical Reasoning",
        value: 4,
        scaleMin: 1,
        scaleMax: 5,
        explanation: "Articulated loss optimization and model trade-offs with clear mathematical justification.",
      },
      {
        dimensionKey: "problem_solving",
        dimensionLabel: "Problem Solving",
        value: 3.5,
        scaleMin: 1,
        scaleMax: 5,
        explanation: "Structured edge case analysis well, though initial architecture proposal had scaling bottlenecks.",
      },
      {
        dimensionKey: "communication",
        dimensionLabel: "Communication",
        value: 3,
        scaleMin: 1,
        scaleMax: 5,
        explanation: "Explained core technical concepts clearly, but answers could be more structured and concise.",
      },
      {
        dimensionKey: "role_knowledge",
        dimensionLabel: "Role Knowledge",
        value: 4,
        scaleMin: 1,
        scaleMax: 5,
        explanation: "Demonstrated solid familiarity with modern ML deployment lifecycles and latency constraints.",
      },
    ],
  };

  const response = await processAiInterviewEvent({
    rawKey: INTERVIEW_DEV_KEY,
    payload,
  });

  console.log("Response status:", response.status);
  console.log("Result:", response.data);

  if (response.status === 200) {
    console.log("✓ AI Interview event successfully processed into verified session evidence!");
  } else {
    console.error("Failed to process event:", response.data);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Interview demo event submission failed:", err);
  process.exit(1);
});
