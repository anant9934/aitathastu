import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { updateUserPreferences } from "@/lib/repositories/person-repository";
import { getStudentDashboardComposition } from "@/lib/services/dashboard-service";

export async function PATCH(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    await updateUserPreferences(auth.person.id, {
      reducedGuidance: body.reducedGuidance,
      eoraDismissed: body.eoraDismissed,
      primaryPriority: body.primaryPriority,
      secondaryPriorities: body.secondaryPriorities,
      metadata: body.metadata,
    });

    const composition = await getStudentDashboardComposition(auth.person.id);

    return NextResponse.json({ success: true, composition });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update preferences.";
    console.error("[Preferences Update Error]", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
