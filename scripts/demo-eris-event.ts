import { processErisEvent } from "../lib/services/integration-processor-service";
import { ERIS_DEV_KEY } from "./seed-phase6-integration";

async function main() {
  console.log("Submitting demo ERIS assessment completed event...");

  const externalEventId = `eris_evt_demo_${Date.now()}`;

  const payload = {
    producer: "eris",
    externalEventId,
    payloadVersion: 1,
    occurredAt: new Date().toISOString(),
    student: {
      externalStudentId: "eris_stu_arjun",
      email: "arjun.student@example.com",
    },
    assessment: {
      externalAssessmentId: "assess_ml_foundations_01",
      title: "Machine Learning Foundations",
      type: "coding_and_theory",
      rubricVersion: "v1.2",
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date().toISOString(),
      overallScore: 88,
      maxScore: 100,
      resultType: "score",
    },
    topics: [
      {
        topicKey: "programming",
        topicLabel: "Python Programming",
        value: 3.5,
        maxValue: 4,
        measurementType: "rubric_level",
      },
      {
        topicKey: "machine_learning",
        topicLabel: "Machine Learning Concepts & Loss Optimization",
        value: 3,
        maxValue: 4,
        measurementType: "rubric_level",
      },
    ],
  };

  const response = await processErisEvent({
    rawKey: ERIS_DEV_KEY,
    payload,
  });

  console.log("Response status:", response.status);
  console.log("Result:", response.data);

  if (response.status === 200) {
    console.log("✓ ERIS event successfully processed into verified institutional evidence!");
  } else {
    console.error("Failed to process event:", response.data);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("ERIS demo event submission failed:", err);
  process.exit(1);
});
