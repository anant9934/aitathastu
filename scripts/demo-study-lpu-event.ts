import { processStudyLpuEvent } from "../lib/services/integration-processor-service";
import { STUDY_LPU_DEV_KEY } from "./seed-phase6-integration";

async function main() {
  console.log("Submitting demo Study LPU academic learning event...");

  const externalEventId = `study_lpu_evt_${Date.now()}`;

  const payload = {
    producer: "study_lpu",
    externalEventId,
    payloadVersion: 1,
    occurredAt: new Date().toISOString(),
    student: {
      externalStudentId: "study_stu_arjun",
    },
    event: {
      eventType: "module.completed",
      courseId: "cse_401_ml",
      courseTitle: "Machine Learning & Pattern Recognition",
      moduleId: "mod_03_supervised",
      moduleTitle: "Supervised Learning: Linear & Logistic Regression",
      topicKey: "machine_learning",
      topicTitle: "Linear & Logistic Regression Foundations",
      durationMinutes: 90,
      startedAt: new Date(Date.now() - 5400000).toISOString(),
      completedAt: new Date().toISOString(),
    },
  };

  const response = await processStudyLpuEvent({
    rawKey: STUDY_LPU_DEV_KEY,
    payload,
  });

  console.log("Response status:", response.status);
  console.log("Result:", response.data);

  if (response.status === 200) {
    console.log("✓ Study LPU event processed! Academic learning recorded without claiming unearned verification.");
  } else {
    console.error("Failed to process event:", response.data);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
