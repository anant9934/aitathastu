import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getUserPreferences, updateUserPreferences } from "@/lib/repositories/person-repository";
import { getStudentDashboardComposition } from "@/lib/services/dashboard-service";
import { validatePurposes } from "@/lib/domain/adaptive-workspace";

export async function PATCH(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const existing = await getUserPreferences(auth.person.id);
    const metadata = (existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
    if (metadata.requestedRole === "faculty") return NextResponse.json({ error: "Use faculty workspace preferences for this account." }, { status: 403 });
    const rankChanged = body.primaryPriority !== undefined || body.secondaryPriorities !== undefined;
    const ranked = rankChanged ? validatePurposes("student", [body.primaryPriority ?? existing?.primaryPriority, ...(body.secondaryPriorities ?? (Array.isArray(existing?.secondaryPriorities) ? existing.secondaryPriorities : []))]) : null;
    const targetRole = body.metadata && typeof body.metadata === "object" && typeof body.metadata.targetRole === "string" ? body.metadata.targetRole.slice(0,100) : undefined;
    await updateUserPreferences(auth.person.id, {
      reducedGuidance: typeof body.reducedGuidance === "boolean" ? body.reducedGuidance : undefined,
      eoraDismissed: typeof body.eoraDismissed === "boolean" ? body.eoraDismissed : undefined,
      primaryPriority: ranked?.[0],
      secondaryPriorities: ranked?.slice(1),
      metadata: targetRole === undefined ? undefined : { targetRole },
    });

    const composition = await getStudentDashboardComposition(auth.person.id);

    return NextResponse.json({ success: true, composition });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update preferences.";
    console.error("[Preferences Update Error]", message);
    return NextResponse.json(
      { error: message },
      { status: message.includes("purpose") || message.includes("Purposes") ? 400 : 500 }
    );
  }
}
