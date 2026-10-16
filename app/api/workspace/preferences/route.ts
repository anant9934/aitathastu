import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { can } from "@/lib/auth/rbac";
import { getPersonProfile, getUserPreferences, updateUserPreferences } from "@/lib/repositories/person-repository";
import { AIML_ROLE_CATALOG } from "@/lib/domain/aiml-role-taxonomy";
import { setActiveGoal } from "@/lib/repositories/goal-repository";
import { roleGoalTitle } from "@/lib/domain/role-goal";
import { emptyWidgetLayout, normalizeWidgetLayout, validPurposeIds, validatePurposes, type WorkspaceRole } from "@/lib/domain/adaptive-workspace";

async function context() {
  const auth = await getServerAuthContext();
  if (!auth) return null;
  const preferences = await getUserPreferences(auth.person.id);
  const metadata = (preferences?.metadata && typeof preferences.metadata === "object" ? preferences.metadata : {}) as Record<string, unknown>;
  const canVerify = await can(auth.person.id, "student.verify_skill");
  const role: WorkspaceRole = metadata.requestedRole === "faculty" || canVerify ? "faculty" : "student";
  const purposes = validPurposeIds(role, [preferences?.primaryPriority, ...(Array.isArray(preferences?.secondaryPriorities) ? preferences.secondaryPriorities : [])]);
  return { auth, preferences, metadata, role, purposes, canVerify };
}

export async function GET() {
  const value = await context();
  if (!value) return NextResponse.json({ error: "Sign in to view your workspace." }, { status: 401 });
  const profile = await getPersonProfile(value.auth.person.id);
  return NextResponse.json({ role: value.role, requestedRole: value.metadata.requestedRole || null, facultyAccess: value.canVerify ? "authorized" : "pending", name: value.auth.person.displayName, institution: profile?.institution || null, department: profile?.specialization || null, purposes: value.purposes, layout: normalizeWidgetLayout(value.role, value.metadata.widgetLayout || emptyWidgetLayout), goal: value.metadata.targetRole || null });
}

async function PATCH_handler(request: Request) {
  const value = await context();
  if (!value) return NextResponse.json({ error: "Sign in to update your workspace." }, { status: 401 });
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid preferences.");
    if (body.role !== undefined && body.role !== value.role) throw new Error("Workspace role cannot be changed here.");
    const purposes = body.purposes !== undefined ? validatePurposes(value.role, body.purposes) : value.purposes;
    const layout = body.layout !== undefined ? normalizeWidgetLayout(value.role, body.layout) : normalizeWidgetLayout(value.role, value.metadata.widgetLayout);
    // Target role edited in place on the dashboard (Task 2.2.1): it is also the active goal.
    let roleMeta: Record<string, unknown> = {};
    if (body.targetRole !== undefined) {
      const role = AIML_ROLE_CATALOG.find((r) => r.id === body.targetRole || r.title === body.targetRole);
      if (!role) throw new Error("Choose one of the listed AI/ML roles.");
      roleMeta = { targetRole: role.title, targetRoleId: role.id };
      await setActiveGoal(value.auth.person.id, roleGoalTitle(role.title), `Target Role: ${role.title}`, "custom");
    }
    await updateUserPreferences(value.auth.person.id, { ...(body.purposes !== undefined ? { primaryPriority: purposes[0], secondaryPriorities: purposes.slice(1) } : {}), metadata: { widgetLayout: layout, purposeVersion: 4, ...roleMeta } });
    return NextResponse.json({ role: value.role, purposes, layout, goal: (roleMeta.targetRole as string | undefined) ?? value.metadata.targetRole ?? null });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid preferences." }, { status: 400 }); }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const PATCH = withStudentCacheInvalidation(PATCH_handler);
