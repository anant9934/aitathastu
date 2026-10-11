import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { buildPersonGraph } from "@/lib/domain/person-graph";
import { SkillIntelligenceService } from "@/lib/services/skill-intelligence-service";

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const [graph, intelligence] = await Promise.all([
      buildPersonGraph(auth.person.id),
      SkillIntelligenceService.getSkillsIntelligence(auth.person.id),
    ]);

    return NextResponse.json({
      skills: graph.skills,
      intelligenceSkills: intelligence.skills,
      missingGoalSkills: intelligence.missingGoalSkills,
      targetRole: intelligence.targetRole,
      targetRoleId: intelligence.targetRoleId,
      stats: {
        ...graph.stats,
        ...intelligence.stats,
      },
      activeGoal: intelligence.targetRole || graph.goal.title,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error loading skills.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
