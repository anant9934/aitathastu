import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getPersonProfile } from "@/lib/repositories/person-repository";
import { getActiveGoal } from "@/lib/repositories/goal-repository";
import { getEvidenceByPersonId } from "@/lib/repositories/evidence-repository";
import { generatePersonalizedRoadmap } from "@/lib/domain/roadmap";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const personId = auth.person.id;
  const profile = await getPersonProfile(personId);
  const activeGoal = await getActiveGoal(personId);
  const evidenceList = await getEvidenceByPersonId(personId);

  const goalTitle = activeGoal ? activeGoal.title : "GenAI Engineer";
  const evidencedSkills = evidenceList
    .filter((e) => e.category === "skill")
    .map((e) => e.subject);

  const cohort = profile?.expectedGraduationYear || undefined;
  const placementStatus = profile?.placementStatus || undefined;

  const roadmap = generatePersonalizedRoadmap(goalTitle, evidencedSkills, cohort, placementStatus);

  return NextResponse.json({
    roadmap,
    studentName: auth.person.displayName,
    goal: goalTitle,
    cohort,
  });
}
