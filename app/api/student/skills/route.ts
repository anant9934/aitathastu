import { NextResponse } from "next/server";
import { cachedStudentJson, invalidateStudentCache } from "@/lib/cache/response-cache";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { buildPersonGraph } from "@/lib/domain/person-graph";
import { SkillIntelligenceService } from "@/lib/services/skill-intelligence-service";
import { addStudentSkill, getHiddenSkills, listStudentSkills, removeStudentSkill, setHidden, setSkillProficiency, SkillEditError } from "@/lib/services/skill-edit-service";

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const personId = auth.person.id;
    const { value, hit } = await cachedStudentJson(personId, "skills", async () => {
      const [graph, intelligence, studentSkills, hiddenSkills] = await Promise.all([
        buildPersonGraph(personId),
        SkillIntelligenceService.getSkillsIntelligence(personId),
        listStudentSkills(personId),
        getHiddenSkills(personId),
      ]);

      return {
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
        studentSkills,
        hiddenSkills,
      };
    });
    return NextResponse.json(value, { headers: { "x-cache": hit ? "hit" : "miss" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error loading skills.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** In-place skill edits (Task 2.2.3). Each returns the recomputed tracked count. */
async function mutate(run: (personId: string, body: Record<string, unknown>) => Promise<unknown>, request: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  const body = request.method === "DELETE"
    ? { name: new URL(request.url).searchParams.get("name") }
    : ((await request.json().catch(() => null)) ?? {});
  try {
    const result = await run(auth.person.id, body as Record<string, unknown>);
    await invalidateStudentCache(auth.person.id);
    const intelligence = await SkillIntelligenceService.getSkillsIntelligence(auth.person.id);
    return NextResponse.json({ result, stats: intelligence.stats });
  } catch (err) {
    if (err instanceof SkillEditError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[Skills edit error]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Your skills could not be saved. Please try again." }, { status: 500 });
  }
}

export const POST = (request: Request) => mutate((id, b) => addStudentSkill(id, b.name, b.proficiency), request);
export const PATCH = (request: Request) => mutate((id, b) => (b.hidden !== undefined ? setHidden(id, b.name, b.hidden === true) : setSkillProficiency(id, b.name, b.proficiency)), request);
export const DELETE = (request: Request) => mutate((id, b) => removeStudentSkill(id, b.name), request);
