import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getUnifiedStudentActivities } from "@/lib/services/activity-service";

/**
 * GET /api/student/activity
 * Returns unified chronological activity feed for the authenticated student.
 */
export async function GET(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const activities = await getUnifiedStudentActivities(auth.person.id, Math.min(limit, 50));

    return NextResponse.json({
      activities,
      total: activities.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error loading activities.";
    console.error("[Student Activity API Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
