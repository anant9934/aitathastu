import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import {
  getStudentDashboardComposition,
  getDemoDashboardComposition,
} from "@/lib/services/dashboard-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const isGuest = searchParams.get("guest") === "true" || searchParams.get("demo") === "true";
    const primary = searchParams.get("primary");
    const secondaryRaw = searchParams.get("secondary");
    const secondary = secondaryRaw ? secondaryRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const role = searchParams.get("role") || undefined;
    const goal = searchParams.get("goal") || undefined;

    const auth = await getServerAuthContext();

    if (isGuest || !auth) {
      const demo = getDemoDashboardComposition({ primary, secondary, role, goal });
      return NextResponse.json(demo, {
        headers: { "x-guest-mode": "true" },
      });
    }

    const composition = await getStudentDashboardComposition(auth.person.id, {
      primary,
      secondary,
      role,
      goal,
    });

    return NextResponse.json(composition);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard composition.";
    console.error("[Dashboard API Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
