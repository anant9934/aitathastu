import { processMentorMazeEvent } from "../lib/services/integration-processor-service";
import { MENTORMAZE_DEV_KEY } from "./seed-phase6-integration";

async function main() {
  console.log("Submitting demo MentorMaze interview event...");

  const externalEventId = `mm_evt_${Date.now()}`;

  const payload = {
    producer: "mentormaze",
    externalEventId,
    payloadVersion: 1,
    occurredAt: new Date().toISOString(),
    student: {
      externalStudentId: "mm_stu_arjun",
    },
    session: {
      externalInterviewId: "int_ml_eng_089",
      targetRole: "ML Engineer",
      rubricVersion: "v2.0",
      completedAt: new Date().toISOString(),
    },
    dimensions: [
      {
        dimensionKey: "technical_reasoning",
        dimensionLabel: "Technical Reasoning",
        value: 4,
        scaleMin: 1,
        scaleMax: 5,
        explanation: "Clear explanation of gradient descent and learning rate scheduling.",
      },
      {
        dimensionKey: "problem_solving",
        dimensionLabel: "Problem Solving",
        value: 3.5,
        scaleMin: 1,
        scaleMax: 5,
        explanation: "Effective decomposition of data pipeline bottlenecks.",
      },
      {
        dimensionKey: "communication",
        dimensionLabel: "Communication",
        value: 4,
        scaleMin: 1,
        scaleMax: 5,
        explanation: "Well-structured answers with clear architecture context.",
      },
    ],
  };

  const response = await processMentorMazeEvent({
    rawKey: MENTORMAZE_DEV_KEY,
    payload,
  });

  console.log("Response status:", response.status);
  console.log("Result:", response.data);

  if (response.status === 200) {
    console.log("✓ MentorMaze interview event processed! Session-specific performance evidence created.");
  } else {
    console.error("Failed to process event:", response.data);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
