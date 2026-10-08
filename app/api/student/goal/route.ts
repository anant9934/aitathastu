import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { can } from "@/lib/auth/rbac";
import { setActiveGoal, getActiveGoal } from "@/lib/repositories/goal-repository";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";

export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const isAuthorized = await can(auth.person.id, "goal.manage.self", {
      targetPersonId: auth.person.id,
    });
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized to manage goals." }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, source } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Goal title cannot be empty." }, { status: 400 });
    }

    const prevGoal = await getActiveGoal(auth.person.id);
    const newGoal = await setActiveGoal(auth.person.id, title, description, source);

    // Create journey event if goal changed
    if (!prevGoal || prevGoal.title.toLowerCase() !== title.trim().toLowerCase()) {
      await createJourneyEventRecord(auth.person.id, {
        type: "goal_changed",
        title: `Goal changed to ${newGoal.title}`,
        description: `Updated active pathway direction from ${prevGoal ? prevGoal.title : "initial"} to ${newGoal.title}. Previous evidence preserved.`,
        relatedEntityId: newGoal.id,
      });
    }

    return NextResponse.json({ success: true, goal: newGoal });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update goal.";
    console.error("[Goal Update Error]", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
