import { defaultIntelligenceRouter } from "../lib/intelligence/router";

async function main() {
  console.log("==================================================");
  console.log("AI TATHASTU: LIVE LLM ROUTER MULTI-TASK AUDIT");
  console.log("==================================================");

  // 1. Task: EORA_CHAT
  console.log("\n--- 1. Testing EORA Personalized Chat ---");
  const chatRes = await defaultIntelligenceRouter.complete({
    task: "EORA_CHAT",
    systemPrompt: "You are EORA, the blue-hoodie mentor for AI Tathastu.",
    userPrompt: "Give a 1-sentence motivational advice for a student learning Computer Vision.",
  });
  console.log("Provider:", chatRes.provider, "| Model:", chatRes.modelUsed, `| Latency: ${chatRes.latencyMs}ms`);
  console.log("Response:", chatRes.content.trim());

  // 2. Task: PROJECT_SUMMARY
  console.log("\n--- 2. Testing Project Summary ---");
  const projRes = await defaultIntelligenceRouter.complete({
    task: "PROJECT_SUMMARY",
    systemPrompt: "You are an AI/ML portfolio evaluator for AI Tathastu.",
    userPrompt: "Summarize in 2 bullets: Computer Vision Defect Detector. Uses PyTorch, OpenCV, ResNet50 to detect surface scratches on solar panels with 94% accuracy.",
  });
  console.log("Provider:", projRes.provider, "| Model:", projRes.modelUsed, `| Latency: ${projRes.latencyMs}ms`);
  console.log("Response:\n" + projRes.content.trim());

  // 3. Task: GOAL_INTERPRETATION
  console.log("\n--- 3. Testing Goal Interpretation ---");
  const goalRes = await defaultIntelligenceRouter.complete({
    task: "GOAL_INTERPRETATION",
    systemPrompt: "You are an AI/ML career taxonomy mapper for AI Tathastu.",
    userPrompt: "Extract core technical competencies required for: MLOps Engineer focused on Kubernetes, Kubeflow, model monitoring, and latency reduction.",
  });
  console.log("Provider:", goalRes.provider, "| Model:", goalRes.modelUsed, `| Latency: ${goalRes.latencyMs}ms`);
  console.log("Response:\n" + goalRes.content.trim());

  console.log("\n==================================================");
  console.log("LIVE LLM ROUTER MULTI-TASK AUDIT: ALL TESTS PASSED");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Live LLM test failed:", err);
  process.exit(1);
});
