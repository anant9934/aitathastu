import { processPadhoCodeEvent } from "../lib/services/integration-processor-service";
import { PADHO_CODE_DEV_KEY } from "./seed-phase6-integration";

async function main() {
  console.log("Submitting demo Padho Code practice event...");

  const externalEventId = `padho_evt_${Date.now()}`;

  const payload = {
    producer: "padho_code",
    externalEventId,
    payloadVersion: 1,
    occurredAt: new Date().toISOString(),
    student: {
      externalStudentId: "padho_stu_arjun",
    },
    activity: {
      eventType: "challenge.completed",
      topic: "Python Data Structures",
      topicKey: "python_basics",
      language: "python",
      challengeId: "chal_py_dict_042",
      difficulty: "medium" as const,
      attempts: 2,
      status: "completed" as const,
      completedAt: new Date().toISOString(),
    },
  };

  const response = await processPadhoCodeEvent({
    rawKey: PADHO_CODE_DEV_KEY,
    payload,
  });

  console.log("Response status:", response.status);
  console.log("Result:", response.data);

  if (response.status === 200) {
    console.log("✓ Padho Code practice event processed! Practice evidence available (unverified).");
  } else {
    console.error("Failed to process event:", response.data);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
