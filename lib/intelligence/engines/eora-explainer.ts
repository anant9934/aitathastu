import { defaultIntelligenceRouter } from "../router";
import { buildEoraExplanationContext } from "../context-firewall";
import { buildSafePrompt } from "../prompt-defense";

export type EoraExplanationInput = {
  studentName: string;
  activeGoal: string;
  targetRole?: string;
  specificGoal?: string;
  evidenceItems: Array<{
    category: string;
    subject: string;
    value: string;
    verificationStatus: string;
  }>;
};

export async function explainProfileInsights(input: EoraExplanationInput): Promise<string> {
  const demonstratedSkills = input.evidenceItems
    .filter((e) => e.category === "skill")
    .map((e) => e.subject);

  const projectsCount = input.evidenceItems.filter((e) => e.category === "project").length;
  const roleMention = input.targetRole || "AI/ML Engineer";
  const goalMention = input.specificGoal || input.activeGoal;

  if (demonstratedSkills.length === 0 && projectsCount === 0) {
    return `Welcome, ${input.studentName}. You want to become a ${roleMention} and you're focusing on "${goalMention}". Tathastu has calibrated your initial roadmap and recommendations. As you add projects and evidence, EORA will guide your next best actions.`;
  }

  const contextStr = buildEoraExplanationContext({
    activeGoal: goalMention,
    evidenceSummary: input.evidenceItems,
  });

  const systemPrompt = `You are EORA, the warm, clear, and intelligent AI companion for AI Tathastu.
Your role is to explain to the student why Tathastu understands their profile this way.
Target Role: ${roleMention}
Active Goal: ${goalMention}
RULES:
1. Speak in friendly, professional English only.
2. Ground your explanation EXCLUSIVELY in the provided evidence. Never invent imaginary skills or achievements.
3. Acknowledge their target role (${roleMention}) and active goal (${goalMention}).
4. Keep it concise (2-3 sentences max).
5. Missing evidence is never a weakness; it simply means unevidenced.`;

  const userPrompt = buildSafePrompt(
    `Explain the student's current profile standing for their target role "${roleMention}" and goal "${goalMention}":`,
    { evidence_data: contextStr }
  );

  const response = await defaultIntelligenceRouter.complete({
    task: "eora_explanation",
    systemPrompt,
    userPrompt,
  });

  return response.content.trim();
}
